# ☸️ OTT Platform - Kubernetes Production Deployment Guide

This directory contains cloud-agnostic, modular, and enterprise-grade Kubernetes manifests orchestrated with **Kustomize** for the entire OTT streaming platform.

---

## 🏛️ Architecture Overview

The Kubernetes deployment mirrors the modular architecture of the platform, structured into distinct operational tiers:

```
                          [ Client Request ]
                                   │
                         [ Nginx Ingress Controller ]
                         (10GB uploads, HLS caching)
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
[ Frontend Service ]      [ API Gateway (HPA) ]       [ Content / HLS ]
  (React / Vite UI)         (ClusterIP: 3000)         (ClusterIP: 3003)
                                   │                           │
         ┌──────────────┬──────────┴───────────┬──────────────┐│
         ▼              ▼                      ▼              ▼▼
   [ Auth Service ] [ User Service ]   [ Payment Service ] [ Streaming (HPA) ]
         │              │                      │              │
         └──────────────┴──────────┬───────────┴──────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
[ 3-Node Kafka KRaft ]    [ PostgreSQL / Mongo / Redis ]  [ Shared Video PVC ]
(kafka-0,1,2 headless)    (StatefulSets with PVCs)       (ReadWriteMany 100GB)
```

---

## 📁 Directory Structure

```
k8s/
├── 00-namespace.yaml             # Dedicated 'ott-platform' namespace
├── 01-configmap-secrets.yaml     # Central ConfigMaps & encrypted Secrets
├── 02-storage-pvcs.yaml          # PersistentVolumeClaims (RWX video, RWO DBs)
├── 03-databases/                 # Stateful Database Layer
│   ├── postgres.yaml             # PostgreSQL 15 StatefulSet & Service
│   ├── mongodb.yaml              # MongoDB 6.0 StatefulSet & Service
│   ├── redis.yaml                # Redis 7.0 StatefulSet & Service
│   └── elasticsearch.yaml        # Elasticsearch 8.11 StatefulSet & Service
├── 04-kafka/                     # Event Streaming Layer
│   └── kafka-kraft.yaml          # 3-Node KRaft Kafka Cluster (ZooKeeper-less)
├── 05-microservices/             # Application Microservices
│   ├── api-gateway.yaml          # API Gateway (Deployment + HPA)
│   ├── auth-service.yaml         # Auth Service
│   ├── user-service.yaml         # User Service
│   ├── content-service.yaml      # Content Service (mounts /videos)
│   ├── streaming-service.yaml    # Streaming Service (mounts /videos + HPA)
│   ├── encoding-service.yaml     # FFmpeg Transcoder (mounts /videos + initContainer)
│   ├── live-service.yaml         # Live Streaming & RTMP Ingest Service
│   ├── payment-service.yaml      # Stripe Payment Processing Service
│   ├── notification-service.yaml # Kafka-backed Notification Consumer
│   └── analytics-service.yaml    # High-throughput Analytics & Telemetry
├── 06-frontend/
│   └── frontend.yaml             # React / Vite Web Application + HPA
├── 07-ingress/
│   └── ingress.yaml              # Nginx Ingress routing (/, /api, /hls, /grafana)
├── 08-monitoring/                # Observability Stack
│   ├── prometheus.yaml           # Prometheus TSDB + Service Scraping Config
│   ├── alertmanager.yaml         # Alert Routing & Deduplication
│   └── grafana.yaml              # Grafana Dashboards & Datasources
└── kustomization.yaml            # Master Kustomize file
```

---

## 🚀 Quick Start Deployment

### 1. One-Click Automated Script
```bash
# Deploys manifests and monitors rollout until all pods are Healthy
./scripts/deploy-k8s.sh

# Or build & push images before deploying:
BUILD_IMAGES=true CONTAINER_REGISTRY=your-docker-registry.com/ott ./scripts/deploy-k8s.sh
```

### 2. Standard `kubectl` / `kustomize` Command
```bash
kubectl apply -k k8s/
```

### 3. Verify Deployment
```bash
# Check all Pods in the namespace
kubectl get pods -n ott-platform -o wide

# Check services & LoadBalancer/NodePort ports
kubectl get svc -n ott-platform

# Check HPA autoscalers
kubectl get hpa -n ott-platform
```

---

## 💾 Storage & Persistent Volumes (RWX & RWO)

| Claim Name | Access Mode | Size | Mount Path | Primary Consumers | Recommended Storage Driver |
|---|---|---|---|---|---|
| `videos-data-pvc` | **ReadWriteMany** | 100Gi | `/videos` | `content-service`, `encoding-service`, `streaming-service`, `live-service` | AWS EFS / GCP Filestore / NFS / Longhorn / CephFS |
| `postgres-pvc` | ReadWriteOnce | 20Gi | `/var/lib/postgresql/data` | `postgres` | AWS EBS gp3 / GCP pd-ssd / Azure Managed Disk |
| `mongodb-pvc` | ReadWriteOnce | 20Gi | `/data/db` | `mongodb` | AWS EBS gp3 / GCP pd-ssd / Azure Managed Disk |
| `redis-pvc` | ReadWriteOnce | 5Gi | `/data` | `redis` | AWS EBS gp3 / GCP pd-ssd / Azure Managed Disk |
| `elasticsearch-pvc` | ReadWriteOnce | 20Gi | `/usr/share/elasticsearch/data` | `elasticsearch` | AWS EBS gp3 / GCP pd-ssd / Azure Managed Disk |
| `prometheus-pvc` | ReadWriteOnce | 15Gi | `/prometheus` | `prometheus` | Standard Block Storage |

> 💡 **Cloud Storage Tip:** For cloud providers, specify your `storageClassName` in [`k8s/02-storage-pvcs.yaml`](file:///home/almalinux/ott-app/k8s/02-storage-pvcs.yaml) (e.g. `efs-sc` for AWS EKS, `standard-rwx` for GKE/Filestore, or `longhorn` for on-premise clusters).

---

## 📈 Auto-Scaling (HPA)

Horizontal Pod Autoscalers dynamically scale frontend and streaming pods during high viewer traffic:
- **`api-gateway`**: Auto-scales from **2 to 10 replicas** when CPU > 70% or RAM > 80%.
- **`streaming-service`**: Auto-scales from **2 to 10 replicas** when CPU > 75% or RAM > 80%.
- **`frontend`**: Auto-scales from **2 to 8 replicas** when CPU > 75%.

---

## 🔒 Security & RBAC Hardening

All microservice containers adhere to Kubernetes Pod Security Standards:
1. **Non-Root Execution**: Runs under UID `1001` with `runAsNonRoot: true`.
2. **Privilege Escalation Blocked**: `allowPrivilegeEscalation: false`.
3. **OWASP Ingress Protections**: Strict CORS headers, X-Frame-Options, CSP, and rate limiting configured at Ingress level.
4. **Isolated Credentials**: All DB, Redis, and JWT tokens reside in `ott-secrets`.
