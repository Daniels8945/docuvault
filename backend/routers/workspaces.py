from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List, Optional

from auth import get_current_user, require_admin, require_editor
from database import get_session
from models import Workspace, WorkspaceCreate, WorkspaceRead, WorkspaceUpdate, Document, Folder, User

router = APIRouter(prefix="/api/workspaces", tags=["Workspaces"])


@router.get("", response_model=List[WorkspaceRead])
def get_workspaces(
    org_id: Optional[str] = None,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    query = select(Workspace)
    if org_id:
        query = query.where(Workspace.organization_id == org_id)
    return session.exec(query).all()


@router.post("", response_model=WorkspaceRead)
def create_workspace(
    workspace: WorkspaceCreate,
    session: Session = Depends(get_session),
    _editor: User = Depends(require_editor),
):
    db_workspace = Workspace.from_orm(workspace)
    session.add(db_workspace)
    session.commit()
    session.refresh(db_workspace)
    return db_workspace


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.get("/{workspace_id}/stats")
def get_workspace_stats(
    workspace_id: str,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    """Aggregate totals across the whole workspace (all folders + root),
    unlike the document grid which only lists root-level documents."""
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    documents = session.exec(select(Document).where(Document.workspace_id == workspace_id)).all()
    folder_count = len(session.exec(select(Folder).where(Folder.workspace_id == workspace_id)).all())

    now = datetime.utcnow().isocalendar()
    this_week_count = sum(1 for d in documents if d.created_at.isocalendar()[:2] == now[:2])

    return {
        "document_count": len(documents),
        "storage_bytes": sum(d.file_size for d in documents),
        "this_week_count": this_week_count,
        "folder_count": folder_count,
    }


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
def update_workspace(
    workspace_id: str,
    ws_update: WorkspaceUpdate,
    session: Session = Depends(get_session),
    _editor: User = Depends(require_editor),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    for key, value in ws_update.dict(exclude_unset=True).items():
        setattr(workspace, key, value)
    session.add(workspace)
    session.commit()
    session.refresh(workspace)
    return workspace


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    session.delete(workspace)
    session.commit()
    return {"message": "Workspace deleted"}
