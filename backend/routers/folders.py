from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, func, or_
from typing import List, Optional

from auth import get_current_user, require_editor
from database import get_session
from permissions import visible_workspace_ids, workspace_visible
from models import (
    Folder, FolderCreate, FolderRead, FolderUpdate,
    FolderNote, FolderNoteCreate, FolderNoteRead,
    Document, Workspace, User,
)

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


def _get_workspace_or_404(workspace_id: str, session: Session, user: User) -> Workspace:
    workspace = session.get(Workspace, workspace_id)
    if not workspace or not workspace_visible(workspace, session, user):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.get("", response_model=List[FolderRead])
def get_folders(
    workspace_id: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Folder)
    if workspace_id:
        _get_workspace_or_404(workspace_id, session, current_user)
        query = query.where(Folder.workspace_id == workspace_id)
    else:
        ids = visible_workspace_ids(session, current_user)
        if ids is not None:
            query = query.where(Folder.workspace_id.in_(ids))
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
    _get_workspace_or_404(folder.workspace_id, session, editor)
    db_folder = Folder(**folder.dict(), created_by=editor.id)
    session.add(db_folder)
    session.commit()
    session.refresh(db_folder)
    return db_folder


@router.get("/{folder_id}", response_model=FolderRead)
def get_folder(
    folder_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    _get_workspace_or_404(folder.workspace_id, session, current_user)
    return folder


@router.patch("/{folder_id}", response_model=FolderRead)
def update_folder(
    folder_id: str,
    req: FolderUpdate,
    session: Session = Depends(get_session),
    editor: User = Depends(require_editor),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    _get_workspace_or_404(folder.workspace_id, session, editor)

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
    editor: User = Depends(require_editor),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    _get_workspace_or_404(folder.workspace_id, session, editor)

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

    for note in session.exec(select(FolderNote).where(FolderNote.folder_id == folder_id)).all():
        session.delete(note)

    session.delete(folder)
    session.commit()
    return {"message": "Folder deleted"}


# ── Notes — lightweight instructions/tasks left on a folder ────────────────
# Any authenticated user who can see the folder can read and add notes;
# only the author or an admin can delete one.

@router.get("/{folder_id}/notes", response_model=List[FolderNoteRead])
def get_folder_notes(
    folder_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    _get_workspace_or_404(folder.workspace_id, session, current_user)
    return session.exec(
        select(FolderNote).where(FolderNote.folder_id == folder_id).order_by(FolderNote.created_at)
    ).all()


@router.post("/{folder_id}/notes", response_model=FolderNoteRead)
def create_folder_note(
    folder_id: str,
    req: FolderNoteCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    _get_workspace_or_404(folder.workspace_id, session, current_user)
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Note cannot be empty")
    note = FolderNote(
        folder_id=folder_id,
        author_id=current_user.id,
        author_name=current_user.name,
        content=req.content.strip(),
    )
    session.add(note)
    session.commit()
    session.refresh(note)
    return note


@router.delete("/{folder_id}/notes/{note_id}")
def delete_folder_note(
    folder_id: str,
    note_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    note = session.get(FolderNote, note_id)
    if not note or note.folder_id != folder_id:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the author or an admin can delete this note")
    session.delete(note)
    session.commit()
    return {"message": "Note deleted"}
