# 🚀 OTT Platform - Production Deployment & Operations Manual

This document is the definitive production deployment, operations, and disaster recovery guide for the Enterprise OTT Platform.

---

## 📑 Table of Contents
1. [System Requirements & Prerequisites](#1-system-requirements--prerequisites)
2. [Environment Configuration & Secrets](#2-environment-configuration--secrets)
3. [One-Step Production Bootstrapping](#3-one-step-production-bootstrapping)
4. [Zero-Downtime Safe Rolling Deployments](#4-zero-downtime-safe-rolling-deployments)
5. [Edge Reverse Proxy & SSL/TLS Termination](#5-edge-reverse-proxy--ssltls-termination)
6. [Live Streaming & RTMP Ingestion Setup](#6-live-streaming--rtmp-ingestion-setup)
7. [Automated Backup & Disaster Recovery Runbook](#7-automated-backup--disaster-recovery-runbook)
8. [System Verification & Health Probing](#8-system-verification--health-probing)
9. [Operational Troubleshooting & Maintenance SOPs](#9-operational-troubleshooting--maintenance-sops)

---

## 1. System Requirements & Prerequisites

### 1.1 Minimum Server Specifications
| Component | Development / Staging | Production Minimum | Production Recommended |
|---|---|---|---|
| **Operating System** | Linux (AlmaLinux 9, RHEL 9, Ubuntu 22.04 LTS, Debian 12) | Linux 64-bit | Linux 64-bit |
| **CPU** | 4 Cores | 8 Cores (AVX2 supported for FFmpeg) | 16+ Cores |
| **RAM** | 8 GB | 16 GB | 32 GB+ |
| **Disk Storage** | 30 GB SSD | 100 GB NVMe SSD | 500 GB+ NVMe SSD |
| **Docker Version** | Docker CE 24.0+ & Compose v2.20+ | Docker CE 26.0+ | Docker CE 26.0+ |

### 1.2 Kernel & System Tunings
Ensure network backlog and file descriptors are tuned for high-throughput HLS streaming:
```bash
# Apply kernel parameters for high-concurrency streaming
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w fs.file-max=2097152
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=65535
```

### 1.3 Rootless Docker Real-IP Configuration (If Using Rootless Docker)
To preserve real client IP addresses through Rootless Docker:
```bash
mkdir -p ~/.config/systemd/user/docker.service.d
cat << 'EOF' > ~/.config/systemd/user/docker.service.d/override.conf
[Service]
Environment="DOCKERD_ROOTLESS_ROOTLESSKIT_PORT_DRIVER=slirp4netns"
EOF

systemctl --user daemon-reload
systemctl --user restart docker
```

---

## 2. Environment Configuration & Secrets

### 2.1 Generate Environment File
Clone the repository and copy the production template:
```bash
git clone <repo-url> /home/almalinux/ott-app
cd /home/almalinux/ott-app
cp .env.example .env
```

### 2.2 Production Secret Generation
Generate high-entropy cryptographic keys using `openssl`:
```bash
# Generate 256-bit secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
STREAM_SIGNING_KEY=$(openssl rand -base64 32)
DRM_MASTER_SECRET=$(openssl rand -base64 32)
INTERNAL_SERVICE_SECRET=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 24)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
MONGO_ROOT_PASSWORD=$(openssl rand -base64 24)
```

### 2.3 Core Environment Variable Reference

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `SERVER_PUBLIC_IP` | Public IP or Domain of the server | `180.94.20.40` or `ott.example.com` |
| `POSTGRES_PASSWORD` | PostgreSQL master password | High-entropy random string |
| `DB_APP_PASSWORD` | PostgreSQL `ott_user` password | High-entropy random string |
| `MONGO_ROOT_PASSWORD` | MongoDB admin password | High-entropy random string |
| `REDIS_PASSWORD` | Redis authentication password | High-entropy random string |
| `JWT_SECRET` | Secret for signing user access tokens | 256-bit base64 secret |
| `STREAM_SIGNING_KEY` | Secret for HMAC-SHA256 DRM stream tokens| 256-bit base64 secret |
| `INTERNAL_SERVICE_SECRET`| Shared secret for Gateway-to-Service auth | 256-bit base64 secret |
| `STRIPE_API_KEY` | Stripe live/test API secret key | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

---

## 3. One-Step Production Bootstrapping

### 3.1 Start the Complete Microservices Mesh
Execute Docker Compose to build and start all 19 containers:
```bash
docker compose up -d --build
```

### 3.2 Automated Kafka KRaft Topic Provisioning
The `kafka-init` container executes on initial boot and creates all 15 required Kafka event topics:
```bash
# Verify topic creation status
docker logs ott-kafka-init
```

### 3.3 Bootstrap Default Superadmin Account
Initialize database schemas and register the default administrator:
```bash
# Run database schema and admin initialization
./scripts/init-databases.sh
```

#### Default Credentials:
- **Admin Email**: `admin@example.com`
- **Admin Password**: `admin123`
- **Role**: `admin` / `superadmin`
- **Tier**: `vip`

---

## 4. Zero-Downtime Safe Rolling Deployments

The platform includes a dedicated deployment automation script [`./scripts/deploy.sh`](file:///home/almalinux/ott-app/scripts/deploy.sh) that builds images in the background, swaps containers gracefully, awaits internal healthcheck verification, and sends a zero-downtime reload signal to the Nginx reverse proxy.

### 4.1 Deploying a Single Microservice
```bash
# Deploy Frontend SPA (React bundle rebuild)
./scripts/deploy.sh frontend

# Deploy Auth Service
./scripts/deploy.sh auth-service

# Deploy Content Service
./scripts/deploy.sh content-service

# Deploy Streaming Service
./scripts/deploy.sh streaming-service

# Deploy Live Broadcasting Service
./scripts/deploy.sh live-service
```

### 4.2 How the Zero-Downtime Deployment Works:
1. **Background Image Build**: Compiles TypeScript / Vite assets into a new Docker image layer without stopping running containers.
2. **Container Swap**: Launches the updated container instance with `--no-deps`.
3. **Healthcheck Polling**: Loops through 15 attempts (30s) testing `/health` endpoint until the container confirms `healthy`.
4. **Nginx Upstream Hot-Reload**: Executes `nginx -s reload` across the edge proxy, switching active TCP sockets with 0 dropped requests.

---

## 5. Edge Reverse Proxy & SSL/TLS Termination

The Nginx reverse proxy ([`infra/nginx/nginx.conf`](file:///home/almalinux/ott-app/infra/nginx/nginx.conf)) handles:
- Port `80` (HTTP) & Port `443` (HTTPS) ingress
- Port `1935` (RTMP live stream ingest)
- 10GB Edge HLS segment microcaching (`~3.4ms` latency)
- Real client IP preservation via `set_real_ip_from` and `X-Forwarded-For`
- WebSocket upgrade proxying for live chat (`/ws`)

### 5.1 Let's Encrypt SSL/TLS Certificate Setup
To enable HTTPS with automatic SSL certificates using Certbot:

```bash
# 1. Install Certbot
sudo dnf install -y certbot # (AlmaLinux / RHEL)
# or sudo apt install -y certbot (Ubuntu / Debian)

# 2. Issue Certificate (Standalone Mode)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 3. Mount certificates in docker-compose.yml under nginx service:
# - /etc/letsencrypt:/etc/letsencrypt:ro

# 4. Uncomment HTTPS server block in infra/nginx/nginx.conf:
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# 5. Reload Nginx
./scripts/deploy.sh nginx
```

---

## 6. Live Streaming & RTMP Ingestion Setup

### 6.1 RTMP Broadcasting Configuration (OBS / Wirecast / Mobile)
- **Stream Type**: Custom Streaming Server
- **Server / Ingest URL**: `rtmp://<SERVER_PUBLIC_IP>:1935/live` (or `rtmp://180.94.20.40:1935/live`)
- **Stream Key**: Any channel slug (e.g. `cinema-4k`, `esports-live`, `test-stream`)

### 6.2 OBS Recommended Output Settings
| Parameter | Value | Rationale |
|---|---|---|
| **Video Bitrate** | 4,500 – 6,000 Kbps | High quality 1080p60 delivery |
| **Encoder** | NVIDIA NVENC (or x264) | Hardware accelerated low latency |
| **Keyframe Interval** | **2 Seconds** | Essential for HLS chunk alignment |
| **Rate Control** | CBR (Constant Bitrate) | Stable HLS segment generation |
| **Audio Bitrate** | 160 Kbps AAC | High fidelity audio |

### 6.3 Live Playback URLs
- **HLS Live Playlist**: `http://<SERVER_PUBLIC_IP>/api/live/stream/<channelKey>/index.m3u8`
- **Web App Live Arena**: `http://<SERVER_PUBLIC_IP>/live`
- **Creator Live Studio**: `http://<SERVER_PUBLIC_IP>/admin/live`

---

## 7. Automated Backup & Disaster Recovery Runbook

### 7.1 Automated Nightly Backups
The platform includes [`./scripts/backup.sh`](file:///home/almalinux/ott-app/scripts/backup.sh) which generates timestamped, gzip-compressed backups of both PostgreSQL (SQL dump) and MongoDB (mongodump BSON archive) with a 7-day retention cleanup.

```bash
# Run manual backup now
./scripts/backup.sh
```

### 7.2 Configure Nightly Cron Job
To automatically run backups every night at 03:00 AM:
```bash
./scripts/setup-cron.sh
```
This registers the following crontab entry:
```crontab
0 3 * * * /home/almalinux/ott-app/scripts/backup.sh >> /home/almalinux/ott-app/backups/backup.log 2>&1
```

### 7.3 Disaster Recovery & Database Restoration
To restore the platform to a previous snapshot:
```bash
# List available backup snapshots
ls -la /home/almalinux/ott-app/backups/

# Execute restoration
./scripts/restore.sh /home/almalinux/ott-app/backups/backup_2026-08-30_030000
```

---

## 8. System Verification & Health Probing

### 8.1 Public Web Endpoints
- **Main Web Application**: `http://<SERVER_PUBLIC_IP>/`
- **4K Video Catalog**: `http://<SERVER_PUBLIC_IP>/browse`
- **Live TV Arena**: `http://<SERVER_PUBLIC_IP>/live`
- **Admin Console**: `http://<SERVER_PUBLIC_IP>/admin` (User: `admin@example.com` / `admin123`)
- **System Health Monitor**: `http://<SERVER_PUBLIC_IP>/system`
- **Prometheus Metrics Dashboard**: `http://<SERVER_PUBLIC_IP>:9090`

### 8.2 Command-Line Health Probing
```bash
# 1. Check container health states
docker compose ps

# 2. Probe API Gateway Health
curl -s http://localhost/health | jq .

# 3. Probe Content & Search Catalog
curl -s "http://localhost/api/content/search?q=4k" | jq .

# 4. Check Elasticsearch Indexing
docker exec -i ott-app-elasticsearch-1 curl -s "http://localhost:9200/videos/_search" | jq .hits.total

# 5. Check Kafka Cluster Status
./scripts/kafka-health-check.sh
```

---

## 9. Operational Troubleshooting & Maintenance SOPs

### 9.1 Container Issues & Diagnostic Commands
| Issue | Diagnostic Command | Remediation Action |
|---|---|---|
| **Container restarting / crashloop** | `docker logs --tail 100 <container_name>` | Check database connection credentials or missing `.env` parameters |
| **Kafka cluster not electing leader** | `docker logs ott-app-kafka-1-1` | Run `./scripts/recreate_topics.sh` to recreate topic metadata |
| **HLS segments 404 Not Found** | `docker exec ott-app-content-service-1 ls -la /videos/encoded` | Trigger re-encoding via `/api/content/videos/:id/encode` |
| **Search returns 0 results** | `docker exec ott-app-elasticsearch-1 curl http://localhost:9200/_cat/indices` | Restart content-service (`./scripts/deploy.sh content-service`) to trigger auto-sync |
| **Nginx upstream 502 Bad Gateway** | `docker exec ott-app-nginx-1 nginx -t` | Verify downstream container is healthy (`docker compose ps`) and reload Nginx |

### 9.2 Complete System Restart & Cold Boot SOP
```bash
# Graceful stop
docker compose down

# Cold start with rebuild
docker compose up -d

# Verify all services are up
docker compose ps
```

---

*Production Deployment Manual — OTT Platform Architecture.*
