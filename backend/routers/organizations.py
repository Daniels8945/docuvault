from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List

import storage
from auth import get_current_user, require_admin
from database import get_session
from permissions import (
    visible_organization_ids, organization_visible, can_manage_sharing,
)
from models import (
    Organization, OrganizationCreate, OrganizationRead, OrganizationUpdate,
    OrganizationMember, OrganizationMemberRead,
    Workspace, Folder, Document, DocumentVersion, Approval, WhatsAppGroupRule,
    WorkspaceMember, User,
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
    admin: User = Depends(require_admin),
):
    db_org = Organization(**org.dict(), owner_id=admin.id)
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
    _admin: User = Depends(require_admin),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
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
    _admin: User = Depends(require_admin),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    workspaces = session.exec(select(Workspace).where(Workspace.organization_id == org_id)).all()

    for ws in workspaces:
        for rule in session.exec(
            select(WhatsAppGroupRule).where(WhatsAppGroupRule.workspace_id == ws.id)
        ).all():
            session.delete(rule)

        for member in session.exec(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == ws.id)
        ).all():
            session.delete(member)

        for doc in session.exec(
            select(Document).where(Document.workspace_id == ws.id)
        ).all():
            for v in session.exec(
                select(DocumentVersion).where(DocumentVersion.document_id == doc.id)
            ).all():
                session.delete(v)
            for a in session.exec(
                select(Approval).where(Approval.document_id == doc.id)
            ).all():
                session.delete(a)
            try:
                storage.delete_file(doc.file_path)
            except Exception:
                pass
            session.delete(doc)

        for folder in session.exec(
            select(Folder).where(Folder.workspace_id == ws.id)
        ).all():
            session.delete(folder)

        session.delete(ws)

    for member in session.exec(
        select(OrganizationMember).where(OrganizationMember.organization_id == org_id)
    ).all():
        session.delete(member)

    session.delete(org)
    session.commit()
    return {"message": f"Organization deleted along with {len(workspaces)} workspace(s)"}
