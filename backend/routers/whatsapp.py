import os
import uuid
from typing import List

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlmodel import Session, select

import storage
from database import get_session
from models import (
    Document, DocumentVersion,
    WhatsAppGroupRule, WhatsAppGroupRuleCreate, WhatsAppGroupRuleRead,
)

WAHA_API_KEY = os.getenv("WAHA_API_KEY", "")
WAHA_BASE_URL = os.getenv("WAHA_BASE_URL", "http://localhost:3000")

router = APIRouter(tags=["WhatsApp"])

_MIME_TO_EXT = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "text/plain": ".txt",
}


def _guess_filename(mimetype: str, msg_id: str) -> str:
    ext = _MIME_TO_EXT.get(mimetype, "")
    return f"whatsapp_{msg_id[:8]}{ext}"


# ── Group routing rules ────────────────────────────────────────────────────────

@router.get("/api/whatsapp/rules", response_model=List[WhatsAppGroupRuleRead])
def get_group_rules(session: Session = Depends(get_session)):
    return session.exec(select(WhatsAppGroupRule)).all()


@router.post("/api/whatsapp/rules", response_model=WhatsAppGroupRuleRead)
def create_group_rule(rule: WhatsAppGroupRuleCreate, session: Session = Depends(get_session)):
    db_rule = WhatsAppGroupRule(**rule.dict())
    session.add(db_rule)
    session.commit()
    session.refresh(db_rule)
    return db_rule


@router.delete("/api/whatsapp/rules/{rule_id}")
def delete_group_rule(rule_id: str, session: Session = Depends(get_session)):
    rule = session.get(WhatsAppGroupRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    session.delete(rule)
    session.commit()
    return {"message": "Rule deleted"}


# ── Incoming webhook ───────────────────────────────────────────────────────────

@router.post("/webhook/waha")
async def waha_webhook(request: Request, session: Session = Depends(get_session)):
    payload = await request.json()

    if payload.get("event") != "message":
        return {"status": "ignored"}

    msg = payload.get("payload", {})
    if not msg.get("hasMedia"):
        return {"status": "no_media"}

    from_jid = msg.get("from", "unknown")
    caption = msg.get("body", "")
    media = msg.get("media") or {}
    msg_id = msg.get("id", uuid.uuid4().hex)

    mimetype = media.get("mimetype", "application/octet-stream")
    filename = media.get("filename") or _guess_filename(mimetype, msg_id)

    media_url = media.get("url") or f"{WAHA_BASE_URL}/api/default/messages/{msg_id}/download-media"
    headers = {"X-Api-Key": WAHA_API_KEY} if WAHA_API_KEY else {}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(media_url, headers=headers)
        if resp.status_code != 200:
            return {"status": "media_download_failed", "code": resp.status_code}
        file_bytes = resp.content
        content_type = resp.headers.get("content-type", mimetype).split(";")[0]
        content_disp = resp.headers.get("content-disposition", "")
        if "filename=" in content_disp:
            filename = content_disp.split("filename=")[-1].strip('"').strip("'")

    rule = session.exec(
        select(WhatsAppGroupRule).where(WhatsAppGroupRule.group_jid == from_jid)
    ).first()

    workspace_id = rule.workspace_id if rule else "ws_inbox"
    folder_id = rule.folder_id if rule else None

    file_key = f"{workspace_id}/{uuid.uuid4().hex}/{filename}"
    storage.upload_file(file_bytes, file_key, content_type)

    tags = ["whatsapp"]
    if caption:
        tags.append(caption[:80])

    doc = Document(
        name=filename,
        file_path=file_key,
        file_type=content_type,
        file_size=len(file_bytes),
        workspace_id=workspace_id,
        folder_id=folder_id,
        uploaded_by="whatsapp",
        status="draft",
        tags=tags,
        current_version=1,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    version = DocumentVersion(
        document_id=doc.id,
        version_number=1,
        file_path=file_key,
        uploaded_by="whatsapp",
        notes=caption[:500] if caption else None,
    )
    session.add(version)
    session.commit()

    return {"status": "ok", "document_id": doc.id, "workspace_id": workspace_id}
