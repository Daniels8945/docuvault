import logging
import os
import time
import uuid
from typing import List

import httpx
import redis
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlmodel import Session, select

import storage
from auth import get_current_user, require_admin
from database import get_session
from metrics import (
    WHATSAPP_MESSAGES, WHATSAPP_DUPLICATES,
    DOCUMENTS_UPLOADED, UPLOAD_FAILURES, S3_OPERATION_SECONDS,
)
from models import (
    Document, DocumentVersion, User,
    WhatsAppGroupRule, WhatsAppGroupRuleCreate, WhatsAppGroupRuleRead,
)

log = logging.getLogger("docuvault.whatsapp")

WAHA_API_KEY  = os.getenv("WAHA_API_KEY", "")
WAHA_BASE_URL = os.getenv("WAHA_BASE_URL", "http://localhost:3000")
MAX_WHATSAPP_BYTES = 50 * 1024 * 1024  # 50 MB — same limit as manual upload

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

# ── Redis client (with graceful fallback to in-memory if Redis unavailable) ────

_redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
_WH_WINDOW = 60
# All real traffic here comes from one source (the waha container calling over
# the docker network), and every "message" event counts against this budget
# even when it has no media — a moderately busy group chat can burn through
# 120/min on plain text alone. Generous enough that only genuine abuse trips it.
_WH_LIMIT  = 600
_DEDUP_TTL = 3600

try:
    _redis = redis.from_url(_redis_url, decode_responses=True, socket_connect_timeout=2)
    _redis.ping()
    _use_redis = True
    log.info("WhatsApp: Redis connected for rate limiting and deduplication")
except Exception as exc:
    log.warning("WhatsApp: Redis unavailable (%s) — falling back to in-memory state", exc)
    _use_redis = False
    from collections import defaultdict as _dd
    _wh_hits: dict = _dd(list)
    _processed_ids: dict = {}


def _is_rate_limited(ip: str) -> bool:
    if _use_redis:
        key = f"ratelimit:{ip}"
        # Only arm the TTL on the first hit of a window — re-running EXPIRE on
        # every call (as this used to) keeps pushing the window forward as long
        # as requests keep arriving, so a retry storm (WAHA retries a failed
        # webhook up to 15x) never lets the window close and the limit never
        # resets, permanently 429ing every message including its retries.
        count = _redis.incr(key)
        if count == 1:
            _redis.expire(key, _WH_WINDOW)
        return count > _WH_LIMIT
    # In-memory fallback
    now = time.monotonic()
    cutoff = now - _WH_WINDOW
    recent = [t for t in _wh_hits[ip] if t > cutoff]
    if len(recent) >= _WH_LIMIT:
        return True
    recent.append(now)
    _wh_hits[ip] = recent
    return False


def _is_duplicate(msg_id: str) -> bool:
    if _use_redis:
        # SET NX (only set if not exists) with TTL — returns True if key was new
        result = _redis.set(f"dedup:{msg_id}", 1, ex=_DEDUP_TTL, nx=True)
        return result is None  # None = key already existed → duplicate
    # In-memory fallback
    now = time.monotonic()
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


# ── Group routing rules (protected) ───────────────────────────────────────────

@router.get("/api/whatsapp/rules", response_model=List[WhatsAppGroupRuleRead])
def get_group_rules(
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    return session.exec(select(WhatsAppGroupRule)).all()


@router.post("/api/whatsapp/rules", response_model=WhatsAppGroupRuleRead)
def create_group_rule(
    rule: WhatsAppGroupRuleCreate,
    session: Session = Depends(get_session),
    _editor: User = Depends(get_current_user),
):
    db_rule = WhatsAppGroupRule(**rule.dict())
    session.add(db_rule)
    session.commit()
    session.refresh(db_rule)
    return db_rule


@router.delete("/api/whatsapp/rules/{rule_id}")
def delete_group_rule(
    rule_id: str,
    session: Session = Depends(get_session),
    _editor: User = Depends(get_current_user),
):
    rule = session.get(WhatsAppGroupRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    session.delete(rule)
    session.commit()
    return {"message": "Rule deleted"}


# ── WhatsApp health (protected) ────────────────────────────────────────────────

@router.get("/api/whatsapp/health")
async def whatsapp_health(_user: User = Depends(get_current_user)):
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


# ── Incoming webhook (public — called by WAHA, not by users) ──────────────────

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

    # WAHA has to fetch and decrypt the file from WhatsApp's E2E-encrypted media
    # servers before it can hand it back to us — for multi-MB attachments that
    # routinely takes well over 30s. The old 30s timeout with no error handling
    # meant it raised an unhandled httpx exception straight through the request
    # handler on anything but small files, 500ing the whole webhook (and never
    # getting a clean retry, since WAHA saw a 500, not a graceful error).
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(media_url, headers=headers)
    except httpx.HTTPError as exc:
        log.warning("Media download errored: url=%s  error=%s", media_url, exc)
        WHATSAPP_MESSAGES.labels(status="failed").inc()
        return {"status": "media_download_failed", "detail": str(exc)}

    if resp.status_code != 200:
        log.warning("Media download failed: url=%s  status=%d", media_url, resp.status_code)
        WHATSAPP_MESSAGES.labels(status="failed").inc()
        return {"status": "media_download_failed", "code": resp.status_code}
    file_bytes = resp.content
    content_type = resp.headers.get("content-type", mimetype).split(";")[0]
    content_disp = resp.headers.get("content-disposition", "")
    if "filename=" in content_disp:
        filename = content_disp.split("filename=")[-1].strip('"').strip("'")

    # File size guard — reject oversized attachments
    if len(file_bytes) > MAX_WHATSAPP_BYTES:
        log.warning(
            "WhatsApp file too large: size=%d  from=%s  filename=%s",
            len(file_bytes), from_jid, filename,
        )
        WHATSAPP_MESSAGES.labels(status="skipped").inc()
        return {
            "status": "skipped_too_large",
            "size_mb": round(len(file_bytes) / 1024 / 1024, 1),
            "limit_mb": MAX_WHATSAPP_BYTES // 1024 // 1024,
        }

    rule = session.exec(
        select(WhatsAppGroupRule).where(WhatsAppGroupRule.group_jid == from_jid)
    ).first()

    workspace_id = rule.workspace_id if rule else "ws_inbox"
    folder_id    = rule.folder_id    if rule else None

    file_key = f"{workspace_id}/{uuid.uuid4().hex}/{filename}"

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
