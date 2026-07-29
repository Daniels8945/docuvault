import os
import logging
from sqlmodel import SQLModel, create_engine, Session, text
from typing import Generator

log = logging.getLogger("docuvault.db")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./docuvault.db")

_is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # PostgreSQL connection pool settings (ignored by SQLite)
    **({} if _is_sqlite else {
        "pool_size": 10,        # keep 10 persistent connections
        "max_overflow": 20,     # allow 20 extra under spike load
        "pool_timeout": 30,     # wait up to 30s for a connection
        "pool_recycle": 1800,   # recycle connections every 30 min (avoids stale TCP)
        "pool_pre_ping": True,  # test connection liveness before use
    }),
)


def init_db():
    SQLModel.metadata.create_all(engine)

    # Safe migration: add hashed_password column to user table if it doesn't exist yet.
    # This handles upgrades from deployments that predate auth.
    if not _is_sqlite:
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='user' AND column_name='hashed_password'"
                )
            )
            if not result.fetchone():
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN hashed_password VARCHAR"))
                conn.commit()
                log.info("Migration: added hashed_password column to user table")

    with Session(engine) as session:
        from models import Organization, Workspace, Folder

        if session.query(Organization).first():
            return

        log.info("Seeding initial data…")

        org1 = Organization(id="org_onction", name="Onction Services Limited", description="NERC-licensed bulk electricity trader")
        org2 = Organization(id="org_jcl", name="Josephine Consulting Limited", description="Strategic consulting services")
        org3 = Organization(id="org_tahf", name="Temitayo Awosika Help Foundation", description="Healthcare and community support")
        session.add_all([org1, org2, org3])
        session.commit()

        ws1 = Workspace(id="ws_trading",    name="Trading Operations",  organization_id="org_onction")
        ws2 = Workspace(id="ws_legal",      name="Legal & Compliance",  organization_id="org_onction")
        ws3 = Workspace(id="ws_strategic",  name="Strategic Documents", organization_id="org_jcl")
        ws4 = Workspace(id="ws_programs",   name="Program Documents",   organization_id="org_tahf")
        ws_inbox = Workspace(id="ws_inbox", name="WhatsApp Inbox",
                             description="Uncategorized documents from WhatsApp",
                             organization_id="org_onction")
        session.add_all([ws1, ws2, ws3, ws4, ws_inbox])
        session.commit()

        folder1 = Folder(name="Contracts",            workspace_id="ws_trading")
        folder2 = Folder(name="Reports",              workspace_id="ws_trading")
        folder3 = Folder(name="Regulatory Filings",   workspace_id="ws_legal")
        folder4 = Folder(name="Client Presentations", workspace_id="ws_strategic")
        folder5 = Folder(name="Event Materials",      workspace_id="ws_programs")
        session.add_all([folder1, folder2, folder3, folder4, folder5])
        session.commit()

        log.info("Seed data created. Visit /register to create the first admin account.")


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
