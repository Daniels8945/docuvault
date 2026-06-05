# DocuVault

A self-hosted document management platform that captures files shared on WhatsApp and organises them into a searchable, versioned knowledge base. Built for Onction Services Limited, Josephine Consulting Limited, and Temitayo Awosika Help Foundation.

---

## Stack

| Service | What it does | Port |
|---|---|---|
| **docuvault** (FastAPI) | Backend API | 8000 |
| **frontend** (React + Nginx) | Dashboard | 5173 |
| **postgres** | Metadata database | 5432 (internal) |
| **minio** | File storage (S3-compatible) | 9000 (API), 9001 (Console) |
| **waha** | WhatsApp HTTP API | 3000 |

All five services run in a single Docker Compose stack on one machine.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker + Docker Compose (Linux)
- A WhatsApp account to link (personal number is fine — no Meta Business API needed)

---

## 1. First-time Setup

### 1.1 Clone and configure environment

```bash
# Copy the environment template
cp .env.example .env
```

Open `.env` and fill in your values:

```env
POSTGRES_DB=docuvault
POSTGRES_USER=docuvault
POSTGRES_PASSWORD=choose_a_strong_password

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=choose_a_strong_password
MINIO_BUCKET=docuvault

# Any secret string — used to authenticate calls to the WAHA API
WAHA_API_KEY=choose_a_secret_key
```

> Do not use the example values in production. Pick real passwords.

### 1.2 Start all services

```bash
docker-compose up -d
```

First run will build images and pull dependencies — takes a few minutes. Subsequent starts are fast.

### 1.3 Verify everything is running

```bash
docker-compose ps
```

All five services should show `running`. Check the backend health:

```
http://localhost:8000/api/health
```

Should return: `{"status": "healthy", ...}`

---

## 2. Connecting WhatsApp (Development)

WAHA runs a REST API that connects to WhatsApp on your behalf. You scan a QR code once and the session persists in a Docker volume across restarts.

### Step 1 — Open the WAHA Swagger UI

```
http://localhost:3000/
```

All calls below require the `X-Api-Key` header set to the `WAHA_API_KEY` value from your `.env`.

### Step 2 — Create a session

`POST /api/sessions`

```json
{
  "name": "default",
  "config": {}
}
```

Click **Execute**. You should get back `{"name": "default", "status": "STARTING"}`.

### Step 3 — Get the QR code

`GET /api/default/auth/qr`

Set format to `image` and click **Execute**. This returns a QR code image directly in the browser.

Alternatively, open this URL in your browser (replace `YOUR_KEY`):

```
http://localhost:3000/api/default/auth/qr?format=image
```

Add the header in Postman or use curl:

```bash
curl -H "X-Api-Key: YOUR_WAHA_API_KEY" \
  http://localhost:3000/api/default/auth/qr?format=image \
  --output qr.png
```

Then open `qr.png`.

### Step 4 — Scan the QR code

On your phone:
1. Open WhatsApp
2. Tap the three-dot menu → **Linked Devices**
3. Tap **Link a Device**
4. Scan the QR code

### Step 5 — Verify the session is connected

`GET /api/default/me`

Should return your WhatsApp account details (name, phone number).

### Step 6 — Test document capture

Send a PDF or image to yourself or any group on the linked WhatsApp account. Within seconds it should appear in the DocuVault dashboard under **WhatsApp Inbox** (`http://localhost:5173`).

---

## 3. Routing WhatsApp Groups to Workspaces

By default, all incoming documents land in the **WhatsApp Inbox** workspace. You can create rules to automatically route documents from specific groups directly into the right workspace and folder.

### Find a group's JID

Every WhatsApp group has an internal ID (JID) in the format `120363xxxxxxxxx@g.us`. To find it, send a message to the group and check the webhook log, or call:

```
GET /api/default/chats
```

Find the group by name and copy its `id` field.

### Create a routing rule

`POST /api/whatsapp/rules`

```json
{
  "group_jid": "120363xxxxxxxxx@g.us",
  "group_name": "Onction Trading Team",
  "workspace_id": "ws_trading",
  "folder_id": null
}
```

From now on, any document sent to that group is automatically filed under **Trading Operations**. Set `folder_id` to target a specific folder within the workspace.

### Manage rules

```
GET    /api/whatsapp/rules          — list all rules
POST   /api/whatsapp/rules          — create a rule
DELETE /api/whatsapp/rules/{id}     — remove a rule
```

---

## 4. Service URLs (Development)

| URL | What it is |
|---|---|
| `http://localhost:5173` | Dashboard (frontend) |
| `http://localhost:8000/docs` | Backend API docs (Swagger) |
| `http://localhost:3000` | WAHA API (Swagger) |
| `http://localhost:9001` | MinIO Console (file browser) |

MinIO Console login: use `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` from `.env`.

---

## 5. Production Deployment

### 5.1 Server requirements

- VPS with at least 2 GB RAM (DigitalOcean, Hetzner, Linode, etc.)
- Ubuntu 22.04 LTS recommended
- Docker and Docker Compose installed

```bash
# Install Docker on Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 5.2 Copy files to the server

```bash
# From your local machine
scp -r ./docuvault user@your-server-ip:/opt/docuvault
```

Or clone from your Git repository.

### 5.3 Configure production .env

On the server, edit `/opt/docuvault/.env` with strong passwords. Also update the CORS origin in `backend/main.py` to include your domain:

```python
allow_origins=["https://yourdomain.com"]
```

### 5.4 Start the stack

```bash
cd /opt/docuvault
docker-compose up -d
```

### 5.5 Expose the dashboard with a reverse proxy (recommended)

Install nginx on the host:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/docuvault`:

```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
}
```

Enable and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/docuvault /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com
sudo systemctl reload nginx
```

### 5.6 Secure internal ports

Block external access to ports that should be internal-only:

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (redirect to HTTPS)
sudo ufw allow 443   # HTTPS
sudo ufw deny 3000   # WAHA — access from your IP only
sudo ufw deny 9001   # MinIO console — access from your IP only
sudo ufw deny 5432   # Postgres — never expose
sudo ufw enable
```

To access WAHA and MinIO console securely from your computer, use an SSH tunnel:

```bash
# On your local machine — tunnels both admin ports
ssh -L 3000:localhost:3000 -L 9001:localhost:9001 user@your-server-ip
```

Then access them at `http://localhost:3000` and `http://localhost:9001` as if you were on the server.

### 5.7 Connect WhatsApp on the production server

Use the SSH tunnel above to reach `http://localhost:3000`, then follow the same QR scan steps from Section 2. The session is stored in the `waha_sessions` Docker volume and survives restarts.

---

## 6. Useful Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs (all services)
docker-compose logs -f

# View logs for one service
docker-compose logs -f docuvault
docker-compose logs -f waha

# Restart one service
docker-compose restart docuvault

# Rebuild after code changes
docker-compose build docuvault
docker-compose up -d docuvault

# Check WhatsApp session status
curl -H "X-Api-Key: YOUR_KEY" http://localhost:3000/api/default/me
```

---

## 7. Pre-configured Data

The platform seeds these on first startup:

**Organizations**
- Onction Services Limited
- Josephine Consulting Limited
- Temitayo Awosika Help Foundation

**Workspaces**
- Trading Operations (Onction)
- Legal & Compliance (Onction)
- Strategic Documents (JCL)
- Program Documents (TAHF)
- WhatsApp Inbox (catch-all for unrouted messages)

**Default folders**: Contracts, Reports, Regulatory Filings, Client Presentations, Event Materials

---

## 8. Troubleshooting

**WhatsApp session disconnects**
This happens if the phone loses internet or WhatsApp forces a logout. Re-scan the QR code following Section 2 from Step 2.

**Documents not appearing after WhatsApp send**
- Check WAHA logs: `docker-compose logs -f waha`
- Check backend logs: `docker-compose logs -f docuvault`
- Confirm the session is connected: `GET /api/default/me`
- Confirm the file type is in `WHATSAPP_FILES_MIMETYPES` (see `docker-compose.yml`)

**MinIO errors on upload**
- Confirm MinIO is healthy: `docker-compose ps`
- Check the bucket exists in the MinIO Console at `http://localhost:9001`
- Confirm `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` in `.env` match what MinIO started with

**Database migration after model changes**
The app creates tables on startup but does not drop/alter existing columns. After changing models, reset the database volume:

```bash
docker-compose down -v   # WARNING: deletes all data
docker-compose up -d
```
