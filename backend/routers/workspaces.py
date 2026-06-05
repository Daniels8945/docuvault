from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List, Optional

from database import get_session
from models import Workspace, WorkspaceCreate, WorkspaceRead

router = APIRouter(prefix="/api/workspaces", tags=["Workspaces"])


@router.get("", response_model=List[WorkspaceRead])
def get_workspaces(org_id: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Workspace)
    if org_id:
        query = query.where(Workspace.organization_id == org_id)
    return session.exec(query).all()


@router.post("", response_model=WorkspaceRead)
def create_workspace(workspace: WorkspaceCreate, session: Session = Depends(get_session)):
    db_workspace = Workspace.from_orm(workspace)
    session.add(db_workspace)
    session.commit()
    session.refresh(db_workspace)
    return db_workspace


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(workspace_id: str, session: Session = Depends(get_session)):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str, session: Session = Depends(get_session)):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    session.delete(workspace)
    session.commit()
    return {"message": "Workspace deleted"}
