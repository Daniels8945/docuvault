"""Cascading visibility rules for organizations and workspaces.

Admins always see everything (structural containers, not personal files —
they need full oversight to manage the org). For everyone else, a private
organization/workspace is visible only to its owner or an explicitly
added member. A workspace also inherits its parent organization's
visibility: you can't see a workspace inside an organization you can't see,
even if the workspace itself is public.
"""

from typing import Optional, Set

from sqlmodel import Session, select

from models import Organization, OrganizationMember, Workspace, WorkspaceMember, User


def visible_organization_ids(session: Session, user: User) -> Optional[Set[str]]:
    """None means 'no restriction' (admin)."""
    if user.role == "admin":
        return None
    member_org_ids = {
        m.organization_id for m in
        session.exec(select(OrganizationMember).where(OrganizationMember.user_id == user.id)).all()
    }
    orgs = session.exec(select(Organization)).all()
    return {
        o.id for o in orgs
        if o.visibility != "private" or o.owner_id == user.id or o.id in member_org_ids
    }


def organization_visible(org: Organization, session: Session, user: User) -> bool:
    if user.role == "admin":
        return True
    if org.visibility != "private" or org.owner_id == user.id:
        return True
    return session.exec(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id,
        )
    ).first() is not None


def visible_workspace_ids(session: Session, user: User) -> Optional[Set[str]]:
    """None means 'no restriction' (admin)."""
    if user.role == "admin":
        return None
    visible_orgs = visible_organization_ids(session, user)  # a set, since user isn't admin
    member_ws_ids = {
        m.workspace_id for m in
        session.exec(select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)).all()
    }
    workspaces = session.exec(select(Workspace)).all()
    result = set()
    for w in workspaces:
        if w.organization_id not in visible_orgs:
            continue
        if w.visibility != "private" or w.owner_id == user.id or w.id in member_ws_ids:
            result.add(w.id)
    return result


def workspace_visible(workspace: Workspace, session: Session, user: User) -> bool:
    if user.role == "admin":
        return True
    org = session.get(Organization, workspace.organization_id)
    if org and not organization_visible(org, session, user):
        return False
    if workspace.visibility != "private" or workspace.owner_id == user.id:
        return True
    return session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user.id,
        )
    ).first() is not None


def can_manage_sharing(resource_owner_id: Optional[str], user: User) -> bool:
    """Only an admin or the resource's own owner may change its visibility
    or manage who it's shared with."""
    return user.role == "admin" or (resource_owner_id is not None and resource_owner_id == user.id)
