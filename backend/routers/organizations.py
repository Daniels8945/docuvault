from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List

from database import get_session
from models import Organization, OrganizationCreate, OrganizationRead

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
