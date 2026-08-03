from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List

from auth import get_current_user
from database import get_session
from permissions import (
    visible_organization_ids, organization_visible, can_manage_sharing,
)
from deletion import delete_workspace_contents
from models import (
    Organization, OrganizationCreate, OrganizationRead, OrganizationUpdate,
    OrganizationMember, OrganizationMemberRead,
    Workspace, WorkspaceMember, User,
)

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


@router.get("", response_model=List[OrganizationRead])
def get_organizations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    ids = visible_organization_ids(session, current_user)
    query = select(Organization)
    if ids is not None:
        query = query.where(Organization.id.in_(ids))
    return session.exec(query).all()


@router.post("", response_model=OrganizationRead)
def create_organization(
    org: OrganizationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Any signed-in user can create an organization — it belongs to them
    and defaults to public, same as workspaces. Structural admin control
    over ORG CONTENT (delete, force-manage sharing) still exists via
    require_admin below; this just opens up who can start one."""
    db_org = Organization(**org.dict(), owner_id=current_user.id)
    session.add(db_org)
    session.commit()
    session.refresh(db_org)
    return db_org


@router.get("/{org_id}", response_model=OrganizationRead)
def get_organization(
    org_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not organization_visible(org, session, current_user):
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationRead)
def update_organization(
    org_id: str,
    org_update: OrganizationUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not organization_visible(org, session, current_user):
        raise HTTPException(status_code=404, detail="Organization not found")
    if not can_manage_sharing(org.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can edit this organization")
    for key, value in org_update.dict(exclude_unset=True).items():
        setattr(org, key, value)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


# ── Sharing (owner or admin) ────────────────────────────────────────────────

@router.get("/{org_id}/members", response_model=List[OrganizationMemberRead])
def get_organization_members(
    org_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not organization_visible(org, session, current_user):
        raise HTTPException(status_code=404, detail="Organization not found")
    members = session.exec(select(OrganizationMember).where(OrganizationMember.organization_id == org_id)).all()
    users = {u.id: u for u in session.exec(select(User)).all()}
    return [
        OrganizationMemberRead(
            id=m.id, user_id=m.user_id,
            user_name=users[m.user_id].name if m.user_id in users else "Unknown",
            user_email=users[m.user_id].email if m.user_id in users else "",
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post("/{org_id}/members", response_model=OrganizationMemberRead)
def add_organization_member(
    org_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not can_manage_sharing(org.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can manage sharing")
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = session.exec(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")
    member = OrganizationMember(organization_id=org_id, user_id=user_id, added_by=current_user.id)
    session.add(member)
    session.commit()
    session.refresh(member)
    return OrganizationMemberRead(
        id=member.id, user_id=target.id, user_name=target.name, user_email=target.email,
        created_at=member.created_at,
    )


@router.delete("/{org_id}/members/{user_id}")
def remove_organization_member(
    org_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not can_manage_sharing(org.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can manage sharing")
    member = session.exec(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user_id
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Not shared with this user")
    session.delete(member)
    session.commit()
    return {"message": "Member removed"}


@router.delete("/{org_id}")
def delete_organization(
    org_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not organization_visible(org, session, current_user):
        raise HTTPException(status_code=404, detail="Organization not found")
    if not can_manage_sharing(org.owner_id, current_user):
        raise HTTPException(status_code=403, detail="Only the owner or an admin can delete this organization")

    workspaces = session.exec(select(Workspace).where(Workspace.organization_id == org_id)).all()

    for ws in workspaces:
        for member in session.exec(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == ws.id)
        ).all():
            session.delete(member)
        delete_workspace_contents(ws.id, session)
        session.delete(ws)

    for member in session.exec(
        select(OrganizationMember).where(OrganizationMember.organization_id == org_id)
    ).all():
        session.delete(member)

    session.delete(org)
    session.commit()
    return {"message": f"Organization deleted along with {len(workspaces)} workspace(s)"}
