from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON
from typing import Optional, List
from datetime import datetime
import uuid

# ==================== ORGANIZATIONS ====================

class OrganizationBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None

class Organization(OrganizationBase, table=True):
    id: str = Field(default_factory=lambda: f"org_{uuid.uuid4().hex[:8]}", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    workspaces: List["Workspace"] = Relationship(back_populates="organization")

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationRead(OrganizationBase):
    id: str
    created_at: datetime

# ==================== WORKSPACES ====================

class WorkspaceBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None
    organization_id: str = Field(foreign_key="organization.id")

class Workspace(WorkspaceBase, table=True):
    id: str = Field(default_factory=lambda: f"ws_{uuid.uuid4().hex[:8]}", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    organization: Organization = Relationship(back_populates="workspaces")
    folders: List["Folder"] = Relationship(back_populates="workspace")
    documents: List["Document"] = Relationship(back_populates="workspace")

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceRead(WorkspaceBase):
    id: str
    created_at: datetime

# ==================== FOLDERS ====================

class FolderBase(SQLModel):
    name: str = Field(index=True)
    workspace_id: str = Field(foreign_key="workspace.id")
    parent_folder_id: Optional[str] = Field(default=None, foreign_key="folder.id")

class Folder(FolderBase, table=True):
    id: str = Field(default_factory=lambda: f"fld_{uuid.uuid4().hex[:8]}", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    workspace: Workspace = Relationship(back_populates="folders")
    documents: List["Document"] = Relationship(back_populates="folder")

class FolderCreate(FolderBase):
    pass

class FolderRead(FolderBase):
    id: str
    created_at: datetime

# ==================== DOCUMENTS ====================

class DocumentBase(SQLModel):
    name: str = Field(index=True)
    file_type: str
    file_size: int
    workspace_id: str = Field(foreign_key="workspace.id")
    folder_id: Optional[str] = Field(default=None, foreign_key="folder.id")
    tags: Optional[List[str]] = None
    status: str = Field(default="draft")  # draft, pending_approval, approved, rejected
    uploaded_by: str

class Document(DocumentBase, table=True):
    id: str = Field(default_factory=lambda: f"doc_{uuid.uuid4().hex[:12]}", primary_key=True)
    file_path: str
    tags: Optional[List[str]] = Field(default=None, sa_column=Column(JSON, nullable=True))
    current_version: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    workspace: Workspace = Relationship(back_populates="documents")
    folder: Optional[Folder] = Relationship(back_populates="documents")
    versions: List["DocumentVersion"] = Relationship(back_populates="document")
    approvals: List["Approval"] = Relationship(back_populates="document")

class DocumentCreate(DocumentBase):
    file_path: str

class DocumentUpdate(SQLModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    folder_id: Optional[str] = None
    workspace_id: Optional[str] = None

class DocumentRead(DocumentBase):
    id: str
    current_version: int
    created_at: datetime
    updated_at: datetime

# ==================== DOCUMENT VERSIONS ====================

class DocumentVersionBase(SQLModel):
    document_id: str = Field(foreign_key="document.id")
    version_number: int
    file_path: str
    uploaded_by: str
    notes: Optional[str] = None

class DocumentVersion(DocumentVersionBase, table=True):
    id: str = Field(default_factory=lambda: f"ver_{uuid.uuid4().hex[:8]}", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    document: Document = Relationship(back_populates="versions")

class DocumentVersionRead(DocumentVersionBase):
    id: str
    created_at: datetime

# ==================== APPROVALS ====================

class ApprovalBase(SQLModel):
    document_id: str = Field(foreign_key="document.id")
    submitted_by: str
    status: str = Field(default="pending")  # pending, approved, rejected
    reviewers: List[str] = []
    notes: Optional[str] = None

class Approval(ApprovalBase, table=True):
    id: str = Field(default_factory=lambda: f"appr_{uuid.uuid4().hex[:8]}", primary_key=True)
    reviewers: List[str] = Field(sa_column=Column(JSON, nullable=False))
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    # Relationships
    document: Document = Relationship(back_populates="approvals")

class ApprovalCreate(ApprovalBase):
    pass

class ApprovalUpdate(SQLModel):
    status: Optional[str] = None
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None

class ApprovalRead(ApprovalBase):
    id: str
    submitted_at: datetime
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]

# ==================== WHATSAPP GROUP RULES ====================

class WhatsAppGroupRule(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"rule_{uuid.uuid4().hex[:8]}", primary_key=True)
    group_jid: str = Field(index=True)        # e.g. "120363xxx@g.us" or "2348xxx@c.us"
    group_name: str                            # human-readable label for the dashboard
    workspace_id: str = Field(foreign_key="workspace.id")
    folder_id: Optional[str] = Field(default=None, foreign_key="folder.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class WhatsAppGroupRuleCreate(SQLModel):
    group_jid: str
    group_name: str
    workspace_id: str
    folder_id: Optional[str] = None

class WhatsAppGroupRuleRead(SQLModel):
    id: str
    group_jid: str
    group_name: str
    workspace_id: str
    folder_id: Optional[str]
    created_at: datetime

# ==================== USERS ====================

class UserBase(SQLModel):
    name: str
    email: str = Field(index=True, unique=True)
    role: str = Field(default="viewer")  # admin, editor, viewer

class User(UserBase, table=True):
    id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:8]}", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserRead(UserBase):
    id: str
    created_at: datetime
