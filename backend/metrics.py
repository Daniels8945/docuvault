"""
Central Prometheus metrics registry for DocuVault.

Import and increment these from routers — never create new metrics
in router files. All labels are defined here so dashboards stay stable.
"""
from prometheus_client import Counter, Gauge, Histogram

# ── WhatsApp pipeline ─────────────────────────────────────────────────────────

WHATSAPP_MESSAGES = Counter(
    "docuvault_whatsapp_messages_total",
    "WhatsApp webhook messages processed, by outcome",
    ["status"],  # saved | skipped | failed | rate_limited | no_media | ignored
)

WAHA_SESSION_CONNECTED = Gauge(
    "docuvault_waha_session_connected",
    "WhatsApp session connectivity (1 = connected / WORKING, 0 = disconnected)",
)

# Start pessimistic — monitor updates it after first check
WAHA_SESSION_CONNECTED.set(0)

WHATSAPP_DUPLICATES = Counter(
    "docuvault_whatsapp_duplicate_messages_total",
    "Webhook calls rejected because message ID was already processed",
)

# ── Document uploads ───────────────────────────────────────────────────────────

DOCUMENTS_UPLOADED = Counter(
    "docuvault_documents_uploaded_total",
    "Documents successfully saved to storage + DB",
    ["source"],  # manual | whatsapp
)

UPLOAD_FAILURES = Counter(
    "docuvault_upload_failures_total",
    "Failed upload attempts",
    ["stage", "source"],  # stage: s3 | db  source: manual | whatsapp
)

# ── S3 / object storage ───────────────────────────────────────────────────────

S3_OPERATION_SECONDS = Histogram(
    "docuvault_s3_operation_seconds",
    "Time spent on S3 operations",
    ["operation"],  # upload | download | delete
    buckets=[0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
)
