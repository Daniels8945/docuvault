import os
from sqlmodel import SQLModel, create_engine, Session
from typing import Generator

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./docuvault.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def init_db():
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        from models import Organization, Workspace, Folder, User

        if session.query(Organization).first():
            return

        org1 = Organization(id="org_onction", name="Onction Services Limited", description="NERC-licensed bulk electricity trader")
        org2 = Organization(id="org_jcl", name="Josephine Consulting Limited", description="Strategic consulting services")
        org3 = Organization(id="org_tahf", name="Temitayo Awosika Help Foundation", description="Healthcare and community support")
        session.add_all([org1, org2, org3])
        session.commit()

        ws1 = Workspace(id="ws_trading", name="Trading Operations", organization_id="org_onction")
        ws2 = Workspace(id="ws_legal", name="Legal & Compliance", organization_id="org_onction")
        ws3 = Workspace(id="ws_strategic", name="Strategic Documents", organization_id="org_jcl")
        ws4 = Workspace(id="ws_programs", name="Program Documents", organization_id="org_tahf")
        ws_inbox = Workspace(id="ws_inbox", name="WhatsApp Inbox", description="Uncategorized documents from WhatsApp", organization_id="org_onction")
        session.add_all([ws1, ws2, ws3, ws4, ws_inbox])
        session.commit()

        folder1 = Folder(name="Contracts", workspace_id="ws_trading")
        folder2 = Folder(name="Reports", workspace_id="ws_trading")
        folder3 = Folder(name="Regulatory Filings", workspace_id="ws_legal")
        folder4 = Folder(name="Client Presentations", workspace_id="ws_strategic")
        folder5 = Folder(name="Event Materials", workspace_id="ws_programs")
        session.add_all([folder1, folder2, folder3, folder4, folder5])
        session.commit()

        user = User(id="user_olaoluwa", name="Olaoluwa", email="olaoluwa@onction.com", role="admin")
        session.add(user)
        session.commit()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
