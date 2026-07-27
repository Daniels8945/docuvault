import logging
import os
import time
import uuid
from collections import defaultdict
from typing import List

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlmodel import Session, select

import storage
from database import get_session
from metrics import (
    WHATSAPP_MESSAGES, WHATSAPP_DUPLICATES,
    DOCUMENTS_UPLOADED, UPLOAD_FAILURES, S3_OPERATION_SECONDS,
)
from models import (
    Document, DocumentVersion,
    WhatsAppGroupRule, WhatsAppGroupRuleCreate, WhatsAppGroupRuleRead,
)

log = logging.getLogger("docuvault.whatsapp")

WAHA_API_KEY  = os.getenv("WAHA_API_KEY", "")
WAHA_BASE_URL = os.getenv("WAHA_BASE_URL", "http://localhost:3000")

router = APIRouter(tags=["WhatsApp"])

# ── Allowed document types ─────────────────────────────────────────────────────

_MIME_TO_EXT = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain": ".txt",
}

ALLOWED_MIMETYPES = set(_MIME_TO_EXT.keys())

# ── In-memory rate limiter (per source IP) ─────────────────────────────────────

_wh_hits: dict[str, list] = defaultdict(list)
_WH_WINDOW = 60
_WH_LIMIT  = 120


def _is_rate_limited(ip: str) -> bool:
    now = time.monotonic()
    cutoff = now - _WH_WINDOW
    recent = [t for t in _wh_hits[ip] if t > cutoff]
    if len(recent) >= _WH_LIMIT:
        return True
    recent.append(now)
    _wh_hits[ip] = recent
    return False


# ── Message deduplication (in-memory, 1-hour TTL) ─────────────────────────────
# Prevents double-save when WAHA retries a webhook delivery.

_processed_ids: dict[str, float] = {}
_DEDUP_TTL = 3600  # seconds


def _is_duplicate(msg_id: str) -> bool:
    now = time.monotonic()
    # Evict stale entries
    stale = [k for k, ts in _processed_ids.items() if now - ts > _DEDUP_TTL]
    for k in stale:
        del _processed_ids[k]
    if msg_id in _processed_ids:
        return True
    _processed_ids[msg_id] = now
    return False


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


# ── WhatsApp health ────────────────────────────────────────────────────────────

@router.get("/api/whatsapp/health")
async def whatsapp_health():
    """
    Live connectivity check against WAHA. Returns session list and status.
    Used by monitoring dashboards and manual troubleshooting.
    """
    headers = {"X-Api-Key": WAHA_API_KEY} if WAHA_API_KEY else {}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{WAHA_BASE_URL}/api/sessions", headers=headers)
        if resp.status_code != 200:
            return {"status": "waha_error", "code": resp.status_code, "sessions": []}
        sessions = resp.json()
        working = [s for s in (sessions or []) if s.get("status") == "WORKING"]
        return {
            "status": "connected" if working else "disconnected",
            "sessions": sessions,
            "working_count": len(working),
        }
    except Exception as exc:
        return {"status": "unreachable", "error": str(exc), "sessions": []}


# ── Incoming webhook ───────────────────────────────────────────────────────────

@router.post("/webhook/waha")
async def waha_webhook(request: Request, session: Session = Depends(get_session)):
    client_ip = request.client.host if request.client else "unknown"

    if _is_rate_limited(client_ip):
        log.warning("Webhook rate limit exceeded for IP=%s", client_ip)
        WHATSAPP_MESSAGES.labels(status="rate_limited").inc()
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    payload = await request.json()

    if payload.get("event") != "message":
        WHATSAPP_MESSAGES.labels(status="ignored").inc()
        return {"status": "ignored"}

    msg = payload.get("payload", {})
    if not msg.get("hasMedia"):
        WHATSAPP_MESSAGES.labels(status="no_media").inc()
        return {"status": "no_media"}

    from_jid = msg.get("from", "unknown")
    caption  = msg.get("body", "")
    media    = msg.get("media") or {}
    msg_id   = msg.get("id", uuid.uuid4().hex)

    # Deduplication — reject if we already processed this message ID
    if _is_duplicate(msg_id):
        log.warning("Duplicate webhook msg_id=%s from=%s — skipping", msg_id, from_jid)
        WHATSAPP_DUPLICATES.inc()
        return {"status": "duplicate", "msg_id": msg_id}

    mimetype = media.get("mimetype", "application/octet-stream")
    if mimetype not in ALLOWED_MIMETYPES:
        log.debug("Webhook skipped unsupported mimetype=%s from=%s", mimetype, from_jid)
        WHATSAPP_MESSAGES.labels(status="skipped").inc()
        return {"status": "skipped_unsupported_type", "mimetype": mimetype}

    filename = media.get("filename") or _guess_filename(mimetype, msg_id)

    from urllib.parse import urlparse, urlunparse
    raw_url = media.get("url")
    if raw_url:
        parsed = urlparse(raw_url)
        if parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
            waha_parsed = urlparse(WAHA_BASE_URL)
            raw_url = urlunparse(parsed._replace(netloc=waha_parsed.netloc))
    media_url = raw_url or f"{WAHA_BASE_URL}/api/default/messages/{msg_id}/download-media"
    headers = {"X-Api-Key": WAHA_API_KEY} if WAHA_API_KEY else {}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(media_url, headers=headers)
        if resp.status_code != 200:
            log.warning("Media download failed: url=%s  status=%d", media_url, resp.status_code)
            WHATSAPP_MESSAGES.labels(status="failed").inc()
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
    folder_id    = rule.folder_id    if rule else None

    file_key = f"{workspace_id}/{uuid.uuid4().hex}/{filename}"

    # Upload to S3 — timed for Prometheus
    t0 = time.perf_counter()
    try:
        storage.upload_file(file_bytes, file_key, content_type)
        S3_OPERATION_SECONDS.labels(operation="upload").observe(time.perf_counter() - t0)
    except Exception as exc:
        S3_OPERATION_SECONDS.labels(operation="upload").observe(time.perf_counter() - t0)
        log.error("WhatsApp S3 upload failed: %s", exc)
        UPLOAD_FAILURES.labels(stage="s3", source="whatsapp").inc()
        WHATSAPP_MESSAGES.labels(status="failed").inc()
        return {"status": "storage_error", "detail": str(exc)}

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
        status="active",
        tags=tags,
        current_version=1,
    )

    try:
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
    except Exception as exc:
        log.error("WhatsApp DB commit failed — rolling back S3 key=%s: %s", file_key, exc)
        try:
            storage.delete_file(file_key)
        except Exception:
            pass
        UPLOAD_FAILURES.labels(stage="db", source="whatsapp").inc()
        WHATSAPP_MESSAGES.labels(status="failed").inc()
        return {"status": "db_error", "detail": str(exc)}

    DOCUMENTS_UPLOADED.labels(source="whatsapp").inc()
    WHATSAPP_MESSAGES.labels(status="saved").inc()
    log.info("WhatsApp document saved: id=%s  name=%s  from=%s  workspace=%s",
             doc.id, filename, from_jid, workspace_id)
    return {"status": "ok", "document_id": doc.id, "workspace_id": workspace_id}
