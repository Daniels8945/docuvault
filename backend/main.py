import asyncio
import logging
import os
from datetime import datetime

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from sqlmodel import Session, text

from database import get_session, engine, init_db
from metrics import WAHA_SESSION_CONNECTED
from routers import organizations, workspaces, folders, documents, approvals, users, whatsapp

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("docuvault")

# ── CORS ───────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

WAHA_API_KEY  = os.getenv("WAHA_API_KEY", "")
WAHA_BASE_URL = os.getenv("WAHA_BASE_URL", "http://localhost:3000")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="DocuVault API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Expose /metrics for Prometheus scraping (must be registered before routers)
Instrumentator(
    should_group_status_codes=True,
    excluded_handlers=["/metrics", "/api/health"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

app.include_router(organizations.router)
app.include_router(workspaces.router)
app.include_router(folders.router)
app.include_router(documents.router)
app.include_router(approvals.router)
app.include_router(users.router)
app.include_router(whatsapp.router)


# ── WAHA session monitor ───────────────────────────────────────────────────────

async def _waha_session_monitor():
    """
    Background task: polls WAHA every 60 s to check if the WhatsApp
    session is connected, and updates the Prometheus gauge accordingly.
    """
    await asyncio.sleep(10)  # let WAHA start up first
    while True:
        try:
            headers = {"X-Api-Key": WAHA_API_KEY} if WAHA_API_KEY else {}
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{WAHA_BASE_URL}/api/sessions", headers=headers)
            if resp.status_code == 200:
                sessions = resp.json()
                connected = (
                    isinstance(sessions, list)
                    and any(s.get("status") == "WORKING" for s in sessions)
                )
                WAHA_SESSION_CONNECTED.set(1 if connected else 0)
                if not connected:
                    log.warning("WAHA session monitor: no WORKING session detected")
            else:
                WAHA_SESSION_CONNECTED.set(0)
                log.warning("WAHA session monitor: unexpected status %d", resp.status_code)
        except Exception as exc:
            WAHA_SESSION_CONNECTED.set(0)
            log.error("WAHA session monitor: unreachable — %s", exc)
        await asyncio.sleep(60)


@app.on_event("startup")
async def on_startup():
    init_db()
    asyncio.create_task(_waha_session_monitor())
    log.info("DocuVault started. Allowed origins: %s", ALLOWED_ORIGINS)


# ── Request logger ─────────────────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/metrics") and not request.url.path.startswith("/api/health"):
        log.info("%s %s → %s", request.method, request.url.path, response.status_code)
    return response


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
def health_check():
    db_status = "ok"
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"
        log.error("Health check: DB unreachable — %s", exc)

    waha_connected = int(WAHA_SESSION_CONNECTED._value.get())
    status = "ok" if db_status == "ok" else "degraded"
    return {
        "status": status,
        "db": db_status,
        "whatsapp": "connected" if waha_connected else "disconnected",
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
