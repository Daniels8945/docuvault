from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, func, or_
from typing import List, Optional

from auth import get_current_user, require_admin, require_editor
from database import get_session
from models import Folder, FolderCreate, FolderRead, FolderUpdate, Document, User

router = APIRouter(prefix="/api/folders", tags=["Folders"])


def _visible_docs(folder_ids, user: User):
    return (
        select(Document.folder_id, func.count(Document.id))
        .where(
            Document.folder_id.in_(folder_ids),
            or_(Document.visibility != "private", Document.owner_id == user.id),
        )
        .group_by(Document.folder_id)
    )


@router.get("", response_model=List[FolderRead])
def get_folders(
    workspace_id: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Folder)
    if workspace_id:
        query = query.where(Folder.workspace_id == workspace_id)
    folders = session.exec(query).all()
    if not folders:
        return []

    folder_ids = [f.id for f in folders]
    counts = dict(session.exec(_visible_docs(folder_ids, current_user)).all())

    creator_ids = {f.created_by for f in folders if f.created_by}
    names = {}
    if creator_ids:
        names = {
            u.id: u.name
            for u in session.exec(select(User).where(User.id.in_(creator_ids))).all()
        }

    return [
        FolderRead(**f.dict(), document_count=counts.get(f.id, 0), created_by_name=names.get(f.created_by))
        for f in folders
    ]


@router.post("", response_model=FolderRead)
def create_folder(
    folder: FolderCreate,
    session: Session = Depends(get_session),
    editor: User = Depends(require_editor),
):
    db_folder = Folder(**folder.dict(), created_by=editor.id)
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


@router.patch("/{folder_id}", response_model=FolderRead)
def update_folder(
    folder_id: str,
    req: FolderUpdate,
    session: Session = Depends(get_session),
    _editor: User = Depends(require_editor),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    data = req.dict(exclude_unset=True)

    if "parent_folder_id" in data:
        new_parent_id = data["parent_folder_id"]
        if new_parent_id == folder_id:
            raise HTTPException(status_code=400, detail="A folder cannot be moved into itself")
        if new_parent_id:
            new_parent = session.get(Folder, new_parent_id)
            if not new_parent:
                raise HTTPException(status_code=404, detail="Target folder not found")
            if new_parent.workspace_id != folder.workspace_id:
                raise HTTPException(status_code=400, detail="Cannot move a folder into a different workspace")
            # Walk up from the target to make sure we're not moving `folder`
            # into one of its own descendants (would create a cycle).
            node = new_parent
            seen = set()
            while node:
                if node.id == folder_id:
                    raise HTTPException(status_code=400, detail="Cannot move a folder into its own subfolder")
                if node.id in seen:
                    break
                seen.add(node.id)
                node = session.get(Folder, node.parent_folder_id) if node.parent_folder_id else None

    for key, value in data.items():
        setattr(folder, key, value)
    session.add(folder)
    session.commit()
    session.refresh(folder)
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
