# DocuVault — Operations Runbook

This document covers everything you need to run, monitor, back up, and troubleshoot DocuVault in production.

---

## Architecture Overview

```
Browser / Users
      │
      ▼
┌─────────────┐   port 5173   ┌──────────────────────────────────────────────┐
│   Nginx     │ ◄─────────── │  frontend (React SPA, static files via Nginx) │
│ (frontend)  │               └──────────────────────────────────────────────┘
└──────┬──────┘
       │ /api/* proxied to port 8000
       ▼
┌──────────────────┐           ┌──────────────────────────────┐
│ docuvault        │ ──────── ▶│  PostgreSQL (postgres:5432)  │
│ (FastAPI/Python) │           │  metadata, documents, orgs   │
│    port 8000     │           └──────────────────────────────┘
└──────┬───────────┘
       │                       ┌──────────────────────────────┐
       │ MinIO SDK             │  Contabo Object Storage      │
       └─────────────────────▶│  eu2.contabostorage.com      │
                               │  bucket: docuvualt           │
                               └──────────────────────────────┘
WhatsApp ──────────────────▶ WAHA (port 3000)
                               └──▶ webhook → docuvault:8000/webhook/waha

postgres-backup ──▶ daily pg_dump → ./backups/*.sql.gz (kept 7 days)
```

### Services

| Service            | Image / Build            | Port | Purpose |
|--------------------|--------------------------|------|---------|
| `postgres`         | postgres:16-alpine       | 5432 | Metadata database |
| `postgres-backup`  | postgres:16-alpine       | —    | Daily automated backups |
| `waha`             | devlikeapro/waha         | 3000 | WhatsApp HTTP API + dashboard |
| `docuvault`        | ./backend (FastAPI)      | 8000 | REST API + business logic |
| `frontend`         | ./frontend (Nginx)       | 5173 | React dashboard |
| `cadvisor`         | gcr.io/cadvisor/cadvisor | 8080 | Docker container metrics collector |
| `prometheus`       | prom/prometheus          | 9091 | Metrics database (scrapes every 15s) |
| `grafana`          | grafana/grafana          | 3001 | Dashboards and alerting UI |

---

## Environment Variables

All variables live in `.env` at the project root. **Never commit this file.**

| Variable            | Required | Example / Default | Description |
|---------------------|----------|-------------------|-------------|
| `POSTGRES_PASSWORD` | ✅        | `s3cr3t`          | PostgreSQL password |
| `POSTGRES_USER`     | —         | `docuvault`       | PostgreSQL user |
| `POSTGRES_DB`       | —         | `docuvault`       | PostgreSQL database name |
| `WAHA_API_KEY`      | ✅        | `mykey123`        | API key for WAHA; protects the dashboard |
| `S3_ACCESS_KEY`     | ✅        | `a5339e…`         | Contabo S3 access key |
| `S3_SECRET_KEY`     | ✅        | `e4bc70…`         | Contabo S3 secret key |
| `S3_BUCKET`         | —         | `docuvualt`       | Contabo bucket name |
| `ALLOWED_ORIGINS`   | —         | `http://localhost:5173` | Comma-separated list of allowed frontend origins for CORS. Add your production URL here. |
| `GRAFANA_USER`      | —         | `admin`                 | Grafana admin username |
| `GRAFANA_PASSWORD`  | —         | `docuvault`             | Grafana admin password — **change this in production** |

**Example `.env`:**
```
POSTGRES_PASSWORD=your_strong_password_here
WAHA_API_KEY=your_waha_api_key
S3_ACCESS_KEY=a5339e64b2e0bd6692a94c11c23572ce
S3_SECRET_KEY=e4bc7003ab2d3ddb7e334bab98d178fc
S3_BUCKET=docuvualt
ALLOWED_ORIGINS=http://localhost:5173,http://your-server-ip:5173
```

---

## Daily Operations

### Start everything

```bash
docker compose up -d
```

### Stop everything (preserves data)

```bash
docker compose down
```

### Stop and remove all data (destructive — use with care)

```bash
docker compose down -v
```

### View live logs (all services)

```bash
docker compose logs -f
```

### View logs for one service

```bash
docker compose logs -f docuvault
docker compose logs -f postgres
docker compose logs -f waha
docker compose logs -f postgres-backup
```

### Check service health

```bash
docker compose ps
```

All services should show `(healthy)` in the STATUS column. If not, see the Troubleshooting section.

You can also hit the health endpoint directly:

```bash
curl http://localhost:8000/api/health
```

Expected response: `{"status":"ok","db":"ok","timestamp":"…"}`

---

## Rebuilding After Code Changes

### Rebuild only the backend

```bash
docker compose build docuvault
docker compose up -d docuvault
```

### Rebuild only the frontend

```bash
docker compose build frontend
docker compose up -d frontend
```

### Rebuild and restart everything

```bash
docker compose build
docker compose up -d
```

---

## Backups

### How automated backups work

The `postgres-backup` service runs `pg_dump` every 24 hours and writes compressed files to `./backups/`. Files older than 7 days are automatically deleted.

Backup files are named: `backup_YYYYMMDD_HHMMSS.sql.gz`

### Check that backups are running

```bash
ls -lh backups/
docker compose logs postgres-backup
```

You should see a log line like `[backup] Saved backup_20260724_223942.sql.gz`.

### Trigger a manual backup now

```bash
docker compose exec postgres-backup \
  sh -c 'pg_dump -h postgres -U $POSTGRES_USER $POSTGRES_DB | gzip > /backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz && echo done'
```

### Restore from a backup

**This overwrites the current database. Stop the backend first.**

```bash
# 1. Stop the backend so no new writes come in
docker compose stop docuvault

# 2. Drop and recreate the database
docker compose exec postgres \
  psql -U docuvault -c "DROP DATABASE docuvault; CREATE DATABASE docuvault;"

# 3. Restore (replace the filename with the backup you want)
gunzip -c backups/backup_20260724_223942.sql.gz | \
  docker compose exec -T postgres \
  psql -U docuvault docuvault

# 4. Restart the backend
docker compose start docuvault
```

---

## Log Reading Guide

### Log format

```
2026-07-24T22:39:00  INFO      docuvault.documents  Document uploaded: id=abc123  name=contract.pdf  size=204800  workspace=ws_trading
```

Fields: `timestamp  LEVEL  logger  message`

### Logger names

| Logger                  | What it covers |
|-------------------------|----------------|
| `docuvault`             | App startup, HTTP request log, health check failures |
| `docuvault.db`          | Database seed and connection events |
| `docuvault.storage`     | S3 uploads, downloads, deletions |
| `docuvault.documents`   | Document CRUD, upload errors, streaming |
| `docuvault.whatsapp`    | Webhook calls, rate limiting, WhatsApp saves |

### Key log messages and what they mean

| Log message | Meaning |
|-------------|---------|
| `DocuVault started. Allowed origins: [...]` | App is up and running |
| `Document uploaded: id=… name=…` | Successful upload |
| `S3 upload failed: …` | Contabo unreachable or credentials wrong |
| `DB commit failed after S3 upload — rolling back S3` | DB error, file was cleaned up from S3 |
| `Health check: DB unreachable` | PostgreSQL connection broken |
| `Webhook rate limit exceeded for IP=…` | Too many webhook calls from one IP (possible abuse) |
| `WhatsApp document saved: id=…` | File from WhatsApp saved successfully |
| `Webhook skipped unsupported mimetype=…` | Image/video received — correctly ignored |

---

## Troubleshooting

### Backend container won't start / keeps restarting

**Check logs:**
```bash
docker compose logs docuvault
```

**Common causes:**

| Error in logs | Fix |
|---------------|-----|
| `could not connect to server` | PostgreSQL isn't ready. Wait or run `docker compose up -d postgres` first. |
| `POSTGRES_PASSWORD not set` | Add `POSTGRES_PASSWORD=…` to your `.env` file. |
| `S3_ACCESS_KEY not set` | Add S3 credentials to `.env`. |
| `ModuleNotFoundError` | Run `docker compose build docuvault` to rebuild with new dependencies. |

---

### Frontend shows blank page or API errors

**Check CORS:**
```bash
docker compose logs docuvault | grep "Allowed origins"
```

If your frontend URL isn't in the list, add it to `ALLOWED_ORIGINS` in `.env` then restart:
```bash
docker compose up -d docuvault
```

**Check the API is reachable:**
```bash
curl http://localhost:8000/api/health
```

If this fails, the backend is down — check backend logs.

---

### WhatsApp files not being saved

**Check the webhook is being called:**
```bash
docker compose logs docuvault | grep "webhook"
```

**If no webhook calls appear:**
- WAHA is not connected to WhatsApp. Open `http://localhost:3000` and scan the QR code.
- Check WAHA logs: `docker compose logs waha`

**If you see `skipped_unsupported_type`:**
- The file sent is an image or video — those are intentionally blocked.
- Only PDF, Word, Excel, PowerPoint, and plain text are accepted.

**If you see `media_download_failed`:**
- WAHA couldn't download the file from WhatsApp's servers. This is usually temporary.

**If you see `S3 upload failed`:**
- Contabo is unreachable. Check your internet connection and S3 credentials.

**If you see `DB commit failed`:**
- Database error. Check `docker compose logs postgres`. Disk may be full.

---

### Files not loading / preview broken

**Check S3 connectivity:**
```bash
docker compose exec docuvault curl -s -o /dev/null -w "%{http_code}" \
  https://eu2.contabostorage.com
```
Should return `200` or `403` (any response means the endpoint is reachable).

**Check logs for S3 errors:**
```bash
docker compose logs docuvault | grep "S3"
```

**If previews hang forever:**
- The file in S3 may be missing (orphaned record). Delete the document and re-upload.

---

### Upload fails with "File too large"

The maximum upload size is **50 MB**. Split the file or compress it before uploading.

---

### Database health check fails (`"db": "error"`)

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection directly
docker compose exec postgres psql -U docuvault -c "SELECT 1;"
```

If PostgreSQL is running but the health check still fails, it may be overloaded. Check disk space:
```bash
docker system df
```

---

### Disk space full

**Check what's using space:**
```bash
docker system df
```

**Clean up old Docker images:**
```bash
docker image prune -f
```

**Clean up old backups (keeps only the last 3):**
```bash
ls -t backups/*.sql.gz | tail -n +4 | xargs rm -f
```

---

## Emergency Procedures

### Complete rebuild from scratch (keeps data)

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Complete rebuild from scratch (wipes all data)

Only do this if the database is corrupted beyond recovery.

```bash
docker compose down -v          # removes volumes (all DB data lost)
docker compose build --no-cache
docker compose up -d
```

### Force-restart a hung container

```bash
docker compose restart docuvault
# or
docker restart docuvault-docuvault-1
```

### Export all documents metadata (emergency data dump)

```bash
docker compose exec postgres \
  psql -U docuvault -c "COPY document TO STDOUT CSV HEADER;" > documents_export.csv
```

---

## Health Check Endpoints

| Endpoint | Method | What it checks |
|----------|--------|----------------|
| `GET /api/health` | GET | Backend alive + DB connection + WhatsApp session status |
| `GET /api/whatsapp/health` | GET | Live WAHA session check with session list |
| `GET /metrics` | GET | Prometheus metrics endpoint (scraped every 15s) |

**`/api/health` response:**
```json
{
  "status": "ok",
  "db": "ok",
  "whatsapp": "connected",
  "timestamp": "2026-07-27T10:00:00.000000"
}
```

If `status` is `"degraded"`, the database is unreachable but the backend process is alive.
If `whatsapp` is `"disconnected"`, the WAHA session is not connected — open `http://localhost:3000` and scan the QR code.

**`/api/whatsapp/health` response:**
```json
{
  "status": "connected",
  "sessions": [{ "name": "default", "status": "WORKING" }],
  "working_count": 1
}
```

---

## File Upload Limits

| Limit | Value |
|-------|-------|
| Maximum file size | 50 MB |
| Allowed types (manual upload) | Any file type |
| Allowed types (WhatsApp auto-save) | PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx), Plain text |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /webhook/waha` | 120 requests per minute per IP |

If WAHA is rate-limited (shouldn't happen in normal use), check if an external IP is hitting the webhook URL.

---

## Monitoring

### Access the dashboards

| Tool | URL | Default login |
|------|-----|---------------|
| **Grafana** (dashboards) | http://localhost:3001 | admin / docuvault |
| **Prometheus** (raw metrics) | http://localhost:9091 | none |
| **cAdvisor** (container stats) | http://localhost:8080 | none |
| **WAHA** (WhatsApp API) | http://localhost:3000 | uses `WAHA_API_KEY` |

> **Change the Grafana password** after first login: Profile → Change Password, or set `GRAFANA_PASSWORD` in `.env` before first start.

### Pre-loaded dashboards

Three dashboards are automatically provisioned when Grafana starts:

| Dashboard | What it shows |
|-----------|---------------|
| **DocuVault — App Overview** | Request rate, error rate, upload count, S3 latency, p95 response time |
| **WhatsApp Pipeline** | Session status (green/red), message saved/skipped/failed counts, flow over time, duplicate rejections |
| **Infrastructure — Docker Containers** | CPU %, RAM, network I/O, disk I/O per container |

### Key metrics reference

| Metric | Type | What it means |
|--------|------|---------------|
| `docuvault_waha_session_connected` | Gauge | 1 = WhatsApp connected, 0 = disconnected. Checked every 60s. |
| `docuvault_whatsapp_messages_total{status}` | Counter | Messages processed by outcome: `saved`, `skipped`, `failed`, `no_media`, `rate_limited`, `duplicate` |
| `docuvault_documents_uploaded_total{source}` | Counter | Successful uploads by source: `manual` or `whatsapp` |
| `docuvault_upload_failures_total{stage,source}` | Counter | Failed uploads: `stage=s3` (storage error) or `stage=db` (database error) |
| `docuvault_s3_operation_seconds{operation}` | Histogram | S3 latency for `upload`, `download`, `delete` |
| `http_requests_total{method,handler,status}` | Counter | HTTP requests by endpoint and status code |
| `http_request_duration_seconds` | Histogram | API response time — use `histogram_quantile(0.95, ...)` for p95 |
| `container_cpu_usage_seconds_total` | Counter | Per-container CPU (from cAdvisor) |
| `container_memory_usage_bytes` | Gauge | Per-container RAM usage (from cAdvisor) |

### What to watch in production

These are the signals that matter. If any of these fire, investigate immediately:

| Signal | Threshold | Meaning |
|--------|-----------|---------|
| `docuvault_waha_session_connected == 0` | Any time | WhatsApp disconnected — documents from that period are lost |
| `docuvault_upload_failures_total` increasing | > 0 / hour | S3 or DB errors during uploads |
| `http_requests_total{status=~"5.."}` rate > 0.1 req/s | Sustained 5 min | Server errors — check backend logs |
| `http_request_duration_seconds` p95 > 3s | Sustained 5 min | API is slow — possible S3 timeout or DB overload |
| `container_memory_usage_bytes` for `docuvault` > 512MB | | Memory pressure — restart the container |

### Useful Prometheus queries to run manually

```
# Is WhatsApp connected right now?
docuvault_waha_session_connected

# Documents saved via WhatsApp in the last 24 hours
increase(docuvault_whatsapp_messages_total{status="saved"}[24h])

# Upload failure rate (should be 0)
rate(docuvault_upload_failures_total[5m])

# Average S3 upload time
rate(docuvault_s3_operation_seconds_sum{operation="upload"}[5m])
  / rate(docuvault_s3_operation_seconds_count{operation="upload"}[5m])

# API error rate %
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m])) * 100

# RAM per container
container_memory_usage_bytes{name=~"docuvault.*"}
```

### Restart a monitoring service

```bash
docker compose restart prometheus
docker compose restart grafana
docker compose restart cadvisor
```

### Prometheus isn't scraping DocuVault

1. Check targets: open http://localhost:9091/targets — `docuvault` should show `UP`
2. If `DOWN`, verify the backend is healthy: `curl http://localhost:8000/metrics`
3. Check the prometheus config: `docker compose exec prometheus cat /etc/prometheus/prometheus.yml`

### Grafana shows "No data"

1. Confirm Prometheus is running: http://localhost:9091
2. In Grafana → Connections → Data sources → Prometheus → click **Test** — should say "Data source is working"
3. Check that the `docuvault` target in Prometheus is `UP`
4. Wait 1-2 minutes after startup — metrics need a scrape cycle before they appear
