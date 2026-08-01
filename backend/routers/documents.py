import logging
import time
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, or_

import storage
from auth import get_current_user, require_admin, require_editor
from database import get_session
from permissions import visible_workspace_ids, workspace_visible
from metrics import DOCUMENTS_UPLOADED, UPLOAD_FAILURES, S3_OPERATION_SECONDS
from models import Document, DocumentRead, DocumentUpdate, DocumentVersion, DocumentVersionRead, Approval, Workspace, User

log = logging.getLogger("docuvault.documents")

router = APIRouter(prefix="/api/documents", tags=["Documents"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


def _visible_to(user: User):
    """SQL filter: public documents, or private documents owned by this user."""
    return or_(Document.visibility != "private", Document.owner_id == user.id)


def _get_workspace_or_404(workspace_id: str, session: Session, user: User) -> Workspace:
    workspace = session.get(Workspace, workspace_id)
    if not workspace or not workspace_visible(workspace, session, user):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _assert_visible(document: Document, session: Session, user: User):
    """A private document is invisible to everyone but its owner — no exceptions,
    not even admin. A document inside a workspace you can't see is equally
    invisible. Raise 404 (not 403) either way, so nothing leaks."""
    if document.visibility == "private" and document.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    _get_workspace_or_404(document.workspace_id, session, user)


@router.get("", response_model=List[DocumentRead])
def get_documents(
    workspace_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    root_only: bool = Query(default=False),
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Document).where(_visible_to(current_user))
    if workspace_id:
        _get_workspace_or_404(workspace_id, session, current_user)
        query = query.where(Document.workspace_id == workspace_id)
    else:
        ids = visible_workspace_ids(session, current_user)
        if ids is not None:
            query = query.where(Document.workspace_id.in_(ids))
    if folder_id:
        query = query.where(Document.folder_id == folder_id)
    elif root_only:
        query = query.where(Document.folder_id == None)  # noqa: E711
    if status:
        query = query.where(Document.status == status)
    if search:
        query = query.where(Document.name.contains(search))
    query = query.offset(skip).limit(limit)
    return session.exec(query).all()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    workspace_id: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    visibility: str = Form("public"),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_editor),
):
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    file_bytes = await file.read()

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum upload size is {MAX_UPLOAD_BYTES // 1024 // 1024} MB.",
        )
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    effective_workspace = workspace_id or "ws_inbox"
    _get_workspace_or_404(effective_workspace, session, current_user)
    file_key = f"{effective_workspace}/{uuid.uuid4().hex}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    # Upload to S3 — timed for Prometheus
    t0 = time.perf_counter()
    try:
        storage.upload_file(file_bytes, file_key, content_type)
        S3_OPERATION_SECONDS.labels(operation="upload").observe(time.perf_counter() - t0)
    except Exception as exc:
        S3_OPERATION_SECONDS.labels(operation="upload").observe(time.perf_counter() - t0)
        log.error("S3 upload failed: %s", exc)
        UPLOAD_FAILURES.labels(stage="s3", source="manual").inc()
        raise HTTPException(status_code=502, detail="File storage unavailable. Please try again.")

    document = Document(
        name=file.filename,
        file_path=file_key,
        file_type=content_type,
        file_size=len(file_bytes),
        workspace_id=effective_workspace,
        folder_id=folder_id,
        uploaded_by=current_user.name,
        owner_id=current_user.id,
        visibility=visibility,
        status="active",
        current_version=1,
    )
    if tags:
        document.tags = [t.strip() for t in tags.split(",")]

    try:
        session.add(document)
        session.commit()
        session.refresh(document)

        version = DocumentVersion(
            document_id=document.id,
            version_number=1,
            file_path=file_key,
            uploaded_by=current_user.name,
        )
        session.add(version)
        session.commit()
    except Exception as exc:
        log.error("DB commit failed after S3 upload — rolling back S3 key=%s: %s", file_key, exc)
        try:
            storage.delete_file(file_key)
        except Exception as s3_exc:
            log.error("S3 rollback also failed for key=%s: %s", file_key, s3_exc)
        UPLOAD_FAILURES.labels(stage="db", source="manual").inc()
        raise HTTPException(status_code=500, detail="Upload failed. The file has been removed from storage.")

    DOCUMENTS_UPLOADED.labels(source="manual").inc()
    log.info("Document uploaded: id=%s  name=%s  size=%d  workspace=%s",
             document.id, document.name, len(file_bytes), effective_workspace)
    return document


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)
    return document


@router.put("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: str,
    document_update: DocumentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_editor),
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)

    data = document_update.dict(exclude_unset=True)
    if "visibility" in data:
        if document.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the document owner can change its visibility.")
        if data["visibility"] == "private" and not document.owner_id:
            raise HTTPException(status_code=400, detail="This document has no owner and cannot be made private.")
        if data["visibility"] not in ("public", "private"):
            raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    if "workspace_id" in data and data["workspace_id"]:
        _get_workspace_or_404(data["workspace_id"], session, current_user)

    for key, value in data.items():
        setattr(document, key, value)
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.get("/{document_id}/download")
def download_document(document_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)
    safe_name = document.name.encode("ascii", errors="replace").decode("ascii")
    log.info("Download: id=%s  name=%s", document_id, document.name)
    return StreamingResponse(
        storage.stream_file(document.file_path),
        media_type=document.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/{document_id}/preview")
def preview_document(document_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)
    return StreamingResponse(
        storage.stream_file(document.file_path),
        media_type=document.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{document.name}"'},
    )


@router.get("/{document_id}/url")
def get_document_url(document_id: str, hours: int = 1, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Return a short-lived presigned URL for direct browser access."""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)
    try:
        url = storage.get_presigned_url(document.file_path, expires_hours=hours)
    except Exception as exc:
        log.error("Presigned URL generation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not generate file URL.")
    return {"url": url, "expires_in_seconds": hours * 3600}


@router.delete("/{document_id}")
def delete_document(document_id: str, session: Session = Depends(get_session), current_user: User = Depends(require_editor)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)
    for v in session.exec(select(DocumentVersion).where(DocumentVersion.document_id == document_id)).all():
        session.delete(v)
    for a in session.exec(select(Approval).where(Approval.document_id == document_id)).all():
        session.delete(a)
    try:
        storage.delete_file(document.file_path)
    except Exception as exc:
        log.warning("S3 delete failed for key=%s (document still deleted from DB): %s", document.file_path, exc)
    session.delete(document)
    session.commit()
    log.info("Document deleted: id=%s  name=%s", document_id, document.name)
    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/versions", response_model=List[DocumentVersionRead])
def get_document_versions(document_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)
    return session.exec(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id)
    ).all()


@router.post("/{document_id}/versions")
async def upload_new_version(
    document_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_editor),
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_visible(document, session, current_user)

    file_bytes = await file.read()

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum upload size is {MAX_UPLOAD_BYTES // 1024 // 1024} MB.",
        )
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_key = f"{document.workspace_id}/{uuid.uuid4().hex}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    try:
        storage.upload_file(file_bytes, file_key, content_type)
    except Exception as exc:
        log.error("S3 upload failed for new version: %s", exc)
        raise HTTPException(status_code=502, detail="File storage unavailable. Please try again.")

    new_version_number = document.current_version + 1
    document.current_version = new_version_number
    document.file_path = file_key
    document.updated_at = datetime.utcnow()

    version = DocumentVersion(
        document_id=document_id,
        version_number=new_version_number,
        file_path=file_key,
        uploaded_by=current_user.name,
    )

    try:
        session.add(version)
        session.add(document)
        session.commit()
        session.refresh(version)
    except Exception as exc:
        log.error("DB commit failed for new version — rolling back S3 key=%s: %s", file_key, exc)
        try:
            storage.delete_file(file_key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Version upload failed.")

    log.info("New version uploaded: doc_id=%s  v%d  size=%d", document_id, new_version_number, len(file_bytes))
    return version
