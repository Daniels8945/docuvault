from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List

import storage
from database import get_session
from models import (
    Organization, OrganizationCreate, OrganizationRead, OrganizationUpdate,
    Workspace, Folder, Document, DocumentVersion, Approval, WhatsAppGroupRule,
)

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


@router.get("", response_model=List[OrganizationRead])
def get_organizations(session: Session = Depends(get_session)):
    return session.exec(select(Organization)).all()


@router.post("", response_model=OrganizationRead)
def create_organization(org: OrganizationCreate, session: Session = Depends(get_session)):
    db_org = Organization.from_orm(org)
    session.add(db_org)
    session.commit()
    session.refresh(db_org)
    return db_org


@router.get("/{org_id}", response_model=OrganizationRead)
def get_organization(org_id: str, session: Session = Depends(get_session)):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationRead)
def update_organization(org_id: str, org_update: OrganizationUpdate, session: Session = Depends(get_session)):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for key, value in org_update.dict(exclude_unset=True).items():
        setattr(org, key, value)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


@router.delete("/{org_id}")
def delete_organization(org_id: str, session: Session = Depends(get_session)):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    workspaces = session.exec(select(Workspace).where(Workspace.organization_id == org_id)).all()

    for ws in workspaces:
        # Remove routing rules pointing to this workspace
        for rule in session.exec(
            select(WhatsAppGroupRule).where(WhatsAppGroupRule.workspace_id == ws.id)
        ).all():
            session.delete(rule)

        # Cascade-delete every document (versions + approvals + object storage)
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

        # Delete folders
        for folder in session.exec(
            select(Folder).where(Folder.workspace_id == ws.id)
        ).all():
            session.delete(folder)

        session.delete(ws)

    session.delete(org)
    session.commit()
    ws_count = len(workspaces)
    return {"message": f"Organization deleted along with {ws_count} workspace(s)"}
