import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

import storage
from database import get_session
from models import Document, DocumentRead, DocumentUpdate, DocumentVersion, DocumentVersionRead

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", response_model=List[DocumentRead])
def get_documents(
    workspace_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(Document)
    if workspace_id:
        query = query.where(Document.workspace_id == workspace_id)
    if folder_id:
        query = query.where(Document.folder_id == folder_id)
    if status:
        query = query.where(Document.status == status)
    if search:
        query = query.where(Document.name.contains(search))
    return session.exec(query).all()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    workspace_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    tags: Optional[str] = None,
    uploaded_by: str = "user_olaoluwa",
    session: Session = Depends(get_session),
):
    file_bytes = await file.read()
    effective_workspace = workspace_id or "ws_inbox"
    file_key = f"{effective_workspace}/{uuid.uuid4().hex}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    storage.upload_file(file_bytes, file_key, content_type)

    document = Document(
        name=file.filename,
        file_path=file_key,
        file_type=content_type,
        file_size=len(file_bytes),
        workspace_id=effective_workspace,
        folder_id=folder_id,
        uploaded_by=uploaded_by,
        status="draft",
        current_version=1,
    )
    if tags:
        document.tags = [t.strip() for t in tags.split(",")]

    session.add(document)
    session.commit()
    session.refresh(document)

    version = DocumentVersion(
        document_id=document.id,
        version_number=1,
        file_path=file_key,
        uploaded_by=uploaded_by,
    )
    session.add(version)
    session.commit()

    return document


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: str,
    document_update: DocumentUpdate,
    session: Session = Depends(get_session),
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    for key, value in document_update.dict(exclude_unset=True).items():
        setattr(document, key, value)
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.get("/{document_id}/download")
def download_document(document_id: str, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    url = storage.get_presigned_url(document.file_path)
    return RedirectResponse(url=url)


@router.delete("/{document_id}")
def delete_document(document_id: str, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    storage.delete_file(document.file_path)
    session.delete(document)
    session.commit()
    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/versions", response_model=List[DocumentVersionRead])
def get_document_versions(document_id: str, session: Session = Depends(get_session)):
    return session.exec(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id)
    ).all()


@router.post("/{document_id}/versions")
async def upload_new_version(
    document_id: str,
    file: UploadFile = File(...),
    uploaded_by: str = "user_olaoluwa",
    session: Session = Depends(get_session),
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_bytes = await file.read()
    file_key = f"{document.workspace_id}/{uuid.uuid4().hex}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    storage.upload_file(file_bytes, file_key, content_type)

    new_version_number = document.current_version + 1
    document.current_version = new_version_number
    document.file_path = file_key
    document.updated_at = datetime.utcnow()

    version = DocumentVersion(
        document_id=document_id,
        version_number=new_version_number,
        file_path=file_key,
        uploaded_by=uploaded_by,
    )
    session.add(version)
    session.add(document)
    session.commit()
    session.refresh(version)
    return version
