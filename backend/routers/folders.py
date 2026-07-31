from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, func
from typing import List, Optional

from auth import get_current_user, require_admin, require_editor
from database import get_session
from models import Folder, FolderCreate, FolderRead, Document, User

router = APIRouter(prefix="/api/folders", tags=["Folders"])


@router.get("", response_model=List[FolderRead])
def get_folders(
    workspace_id: Optional[str] = None,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    query = select(Folder)
    if workspace_id:
        query = query.where(Folder.workspace_id == workspace_id)
    folders = session.exec(query).all()
    if not folders:
        return []

    folder_ids = [f.id for f in folders]
    counts = dict(session.exec(
        select(Document.folder_id, func.count(Document.id))
        .where(Document.folder_id.in_(folder_ids))
        .group_by(Document.folder_id)
    ).all())

    return [
        FolderRead(**f.dict(), document_count=counts.get(f.id, 0))
        for f in folders
    ]


@router.post("", response_model=FolderRead)
def create_folder(
    folder: FolderCreate,
    session: Session = Depends(get_session),
    _editor: User = Depends(require_editor),
):
    db_folder = Folder.from_orm(folder)
    session.add(db_folder)
    session.commit()
    session.refresh(db_folder)
    return db_folder


@router.get("/{folder_id}", response_model=FolderRead)
def get_folder(
    folder_id: str,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: str,
    session: Session = Depends(get_session),
    _editor: User = Depends(require_editor),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    doc_count = session.exec(
        select(func.count()).select_from(Document).where(Document.folder_id == folder_id)
    ).one()
    if doc_count:
        raise HTTPException(
            status_code=400,
            detail=f"This folder has {doc_count} document(s) — move or delete them first.",
        )

    subfolder_count = session.exec(
        select(func.count()).select_from(Folder).where(Folder.parent_folder_id == folder_id)
    ).one()
    if subfolder_count:
        raise HTTPException(
            status_code=400,
            detail=f"This folder has {subfolder_count} subfolder(s) — delete them first.",
        )

    session.delete(folder)
    session.commit()
    return {"message": "Folder deleted"}
