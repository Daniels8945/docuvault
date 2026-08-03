"""Shared cascade-delete logic for a workspace's contents — used by both
the workspace delete endpoint and the organization delete endpoint (which
deletes every workspace inside it), so they clean up identically.
"""

from sqlmodel import Session, select

import storage
from models import Folder, FolderNote, Document, DocumentVersion, Approval, WhatsAppGroupRule


def delete_workspace_contents(workspace_id: str, session: Session):
    for rule in session.exec(
        select(WhatsAppGroupRule).where(WhatsAppGroupRule.workspace_id == workspace_id)
    ).all():
        session.delete(rule)

    for doc in session.exec(select(Document).where(Document.workspace_id == workspace_id)).all():
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

    # Folders can nest (parent_folder_id is self-referencing) — null out that
    # link on every folder first so deletion order can never trip the FK
    # constraint, regardless of how deep the tree goes. Notes are cleaned up
    # per-folder since FolderNote.folder_id is NOT NULL.
    folders = session.exec(select(Folder).where(Folder.workspace_id == workspace_id)).all()
    for f in folders:
        f.parent_folder_id = None
        session.add(f)
    if folders:
        session.flush()
    for f in folders:
        for note in session.exec(select(FolderNote).where(FolderNote.folder_id == f.id)).all():
            session.delete(note)
        session.delete(f)
