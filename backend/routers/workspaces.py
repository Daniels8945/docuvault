from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, or_
from typing import List, Optional

from auth import get_current_user, require_admin, require_editor
from database import get_session
from permissions import visible_workspace_ids, workspace_visible, can_manage_sharing
from models import (
    Workspace, WorkspaceCreate, WorkspaceRead, WorkspaceUpdate,
    WorkspaceMember, WorkspaceMemberRead,
    Document, Folder, User,
)

router = APIRouter(prefix="/api/workspaces", tags=["Workspaces"])


@router.get("", response_model=List[WorkspaceRead])
def get_workspaces(
    org_id: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    ids = visible_workspace_ids(session, current_user)
    query = select(Workspace)
    if org_id:
        query = query.where(Workspace.organization_id == org_id)
    if ids is not None:
        query = query.where(Workspace.id.in_(ids))
    return session.exec(query).all()


@router.post("", response_model=WorkspaceRead)
def create_workspace(
    workspace: WorkspaceCreate,
    session: Session = Depends(get_session),
    editor: User = Depends(require_editor),
):
    db_workspace = Workspace(**workspace.dict(), owner_id=editor.id)
    session.add(db_workspace)
    session.commit()
    session.refresh(db_workspace)
    return db_workspace


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not workspace_visible(workspace, session, current_user):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.get("/{workspace_id}/stats")
def get_workspace_stats(
    workspace_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Aggregate totals across the whole workspace (all folders + root),
    unlike the document grid which only lists root-level documents."""
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not workspace_visible(workspace, session, current_user):
        raise HTTPException(status_code=404, detail="Workspace not found")

    documents = session.exec(
        select(Document).where(
            Document.workspace_id == workspace_id,
            or_(Document.visibility != "private", Document.owner_id == current_user.id),
        )
    ).all()
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
    current_user: User = Depends(require_editor),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not workspace_visible(workspace, session, current_user):
        raise HTTPException(status_code=404, detail="Workspace not found")

    data = ws_update.dict(exclude_unset=True)
    if "visibility" in data and not can_manage_sharing(workspace.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can change who this workspace is shared with")

    for key, value in data.items():
        setattr(workspace, key, value)
    session.add(workspace)
    session.commit()
    session.refresh(workspace)
    return workspace


# ── Sharing (owner or admin) ────────────────────────────────────────────────

@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberRead])
def get_workspace_members(
    workspace_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not workspace_visible(workspace, session, current_user):
        raise HTTPException(status_code=404, detail="Workspace not found")
    members = session.exec(select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)).all()
    users = {u.id: u for u in session.exec(select(User)).all()}
    return [
        WorkspaceMemberRead(
            id=m.id, user_id=m.user_id,
            user_name=users[m.user_id].name if m.user_id in users else "Unknown",
            user_email=users[m.user_id].email if m.user_id in users else "",
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberRead)
def add_workspace_member(
    workspace_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not can_manage_sharing(workspace.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can manage sharing")
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user_id, added_by=current_user.id)
    session.add(member)
    session.commit()
    session.refresh(member)
    return WorkspaceMemberRead(
        id=member.id, user_id=target.id, user_name=target.name, user_email=target.email,
        created_at=member.created_at,
    )


@router.delete("/{workspace_id}/members/{user_id}")
def remove_workspace_member(
    workspace_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not can_manage_sharing(workspace.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can manage sharing")
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Not shared with this user")
    session.delete(member)
    session.commit()
    return {"message": "Member removed"}


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    for member in session.exec(
        select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
    ).all():
        session.delete(member)
    session.delete(workspace)
    session.commit()
    return {"message": "Workspace deleted"}
