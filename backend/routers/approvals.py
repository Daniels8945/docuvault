from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from database import get_session
from models import Approval, ApprovalCreate, ApprovalRead, ApprovalUpdate, Document

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


@router.get("", response_model=List[ApprovalRead])
def get_approvals(
    document_id: Optional[str] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(Approval)
    if document_id:
        query = query.where(Approval.document_id == document_id)
    if status:
        query = query.where(Approval.status == status)
    return session.exec(query).all()


@router.post("", response_model=ApprovalRead)
def create_approval(approval: ApprovalCreate, session: Session = Depends(get_session)):
    document = session.get(Document, approval.document_id)
    if document:
        document.status = "pending_approval"
        session.add(document)
    db_approval = Approval.from_orm(approval)
    session.add(db_approval)
    session.commit()
    session.refresh(db_approval)
    return db_approval


@router.put("/{approval_id}", response_model=ApprovalRead)
def update_approval(
    approval_id: str,
    approval_update: ApprovalUpdate,
    session: Session = Depends(get_session),
):
    approval = session.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    for key, value in approval_update.dict(exclude_unset=True).items():
        setattr(approval, key, value)
    approval.reviewed_at = datetime.utcnow()

    document = session.get(Document, approval.document_id)
    if document:
        if approval.status == "approved":
            document.status = "approved"
        elif approval.status == "rejected":
            document.status = "rejected"
        session.add(document)

    session.add(approval)
    session.commit()
    session.refresh(approval)
    return approval
