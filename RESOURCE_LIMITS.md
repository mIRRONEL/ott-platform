# OTT Platform — Service Resource Limits & Consumption Guide

This document details the hardware capacity, live resource consumption metrics, mathematical calculation model, and resource reservation & limit policies configured across all 25 containers in the OTT Platform.

---

## 1. Host Infrastructure & Capacity Profile

- **Operating System**: AlmaLinux 9 (x86_64 Linux Kernel)
- **Total CPU Cores**: 8 Virtual Cores (`nproc = 8`)
- **Total Physical RAM**: 16 GB (`15,971 MiB`)
- **Swap**: Disabled (`0 MiB`) — Requires strict container memory boundaries to prevent kernel OOM killer invocation.
- **Docker Runtime**: Rootless Docker with cgroup v2 resource controller.

---

## 2. Resource Sizing & Consumption Methodology

### 2.1 Core Concepts
1. **Memory Reservations (`reservations.memory`)**:
   - The *guaranteed floor* allocated to each container.
   - Sum of all memory reservations must stay below physical RAM minus OS reserve (`4.67 GB < 14 GB`).
2. **Memory Limits (`limits.memory`)**:
   - The *hard ceiling* enforcement (via CFS/cgroups).
   - If a container experiences a memory leak or sudden spike beyond this limit, only that specific container is throttled or recycled, protecting the rest of the ecosystem.
3. **CPU Reservations (`reservations.cpus`)**:
   - Guaranteed minimum processing shares (`3.80 cores` total guaranteed across 25 services).
4. **CPU Limits (`limits.cpus`)**:
   - Hard CFS quota ceiling. High-throughput and media-encoding services are granted burst capacity up to 2.0 cores, while preventing any single process from 100% CPU lockup.

---

## 3. Master Resource Allocation Matrix

| Service Name | Category / Tier | Measured Idle RAM | Reserved CPU | Reserved RAM | Limit CPU | Limit RAM | Technical Sizing Justification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `encoding-service` | Media Processing | ~28 MiB | **0.25** | **256M** | **2.00** | **2048M** | Multi-threaded FFmpeg transcoding ladder (1080p/720p/480p) + Node 1024M heap |
| `live-service` | Media Processing | ~34 MiB | **0.20** | **128M** | **1.50** | **1024M** | RTMP stream ingest, WebSocket fanout, chunk packetization |
| `streaming-service` | Media Delivery | ~41 MiB | **0.20** | **128M** | **1.00** | **768M** | High-throughput HLS chunk distribution, range requests |
| `postgres` | Database | ~44 MiB | **0.25** | **256M** | **1.50** | **1024M** | `shared_buffers=256MB`, `effective_cache_size=1GB`, max 500 connections |
| `mongodb` | Database | ~99 MiB | **0.25** | **256M** | **1.50** | **1536M** | WiredTiger cache + document catalog indexing |
| `redis` | In-Memory Cache | ~11 MiB | **0.10** | **64M** | **0.75** | **512M** | LRU caching with configured `maxmemory 512m` |
| `elasticsearch` | Search Engine | ~843 MiB | **0.25** | **640M** | **1.50** | **1280M** | JVM Heap 512M (`-Xms512m -Xmx512m`) + Lucene off-heap mmap buffers |
| `kafka-1` | Message Broker | ~498 MiB | **0.20** | **384M** | **1.00** | **896M** | KRaft controller/broker JVM heap + network thread pool |
| `kafka-2` | Message Broker | ~491 MiB | **0.20** | **384M** | **1.00** | **896M** | Clustered replica broker |
| `kafka-3` | Message Broker | ~571 MiB | **0.20** | **384M** | **1.00** | **896M** | Clustered replica broker |
| `api-gateway` | Ingress / Gateway | ~29 MiB | **0.20** | **128M** | **1.00** | **640M** | High concurrent HTTP routing, JWT verification, rate limiting |
| `auth-service` | Microservice | ~38 MiB | **0.10** | **128M** | **0.75** | **512M** | Bcrypt hash compute bursts, Node `--max-old-space-size=512` |
| `user-service` | Microservice | ~43 MiB | **0.10** | **128M** | **0.75** | **512M** | Profile data management, Node `--max-old-space-size=512` |
| `content-service` | Microservice | ~66 MiB | **0.10** | **128M** | **0.75** | **640M** | Catalog metadata sync, thumbnail processing |
| `payment-service` | Microservice | ~37 MiB | **0.10** | **128M** | **0.75** | **512M** | Payment gateway webhooks & billing cycles |
| `notification-service` | Microservice | ~69 MiB | **0.10** | **128M** | **0.75** | **512M** | Kafka event consumer & async notification dispatcher |
| `analytics-service` | Microservice | ~47 MiB | **0.10** | **128M** | **0.75** | **512M** | Clickstream event aggregation & metric processing |
| `frontend` | Web UI | ~27 MiB | **0.10** | **64M** | **0.50** | **384M** | React / Next.js static asset and client bundle server |
| `nginx` | Edge Proxy | ~33 MiB | **0.15** | **64M** | **1.00** | **384M** | Edge reverse proxy, SSL termination, and HLS disk cache |
| `prometheus` | Observability | ~128 MiB | **0.15** | **192M** | **0.75** | **512M** | Time-series TSDB engine with 15-day retention |
| `grafana` | Observability | ~64 MiB | **0.10** | **96M** | **0.50** | **384M** | Dashboard renderer & alert notification manager |
| `loki` | Observability | ~110 MiB | **0.10** | **128M** | **0.50** | **384M** | Centralized log ingestion and index chunk store |
| `promtail` | Observability | ~195 MiB | **0.10** | **128M** | **0.50** | **384M** | Docker container log tailing & shipper |
| `cadvisor` | Observability | ~60 MiB | **0.05** | **64M** | **0.50** | **256M** | Container cgroups & hardware metrics collector |
| `node-exporter` | Observability | ~14 MiB | **0.05** | **32M** | **0.25** | **128M** | Host OS kernel statistics exporter |
| **TOTALS** | **25 Services** | **~3.57 GB** | **3.80 Cores** | **4.67 GB** | **Burst Limit** | **~17.7 GB** | **Guaranteed within 16GB host limits** |

---

## 4. Tier-by-Tier Breakdown

### Tier 1: Media & Transcoding Services
- **`encoding-service`**: Needs significant CPU allocation (up to 2.0 cores) during batch video encoding with FFmpeg. 2048M memory limit allows buffer management for high-bitrate video clips without risking OOM crashes.
- **`live-service`**: Handles simultaneous RTMP creator feeds and chunk generation. Configured with 1.5 CPU limit and 1024M RAM limit.
- **`streaming-service`**: Serves HLS playlist files and byte ranges. Configured with 1.0 CPU limit and 768M RAM limit.

### Tier 2: Databases & Messaging Infrastructure
- **`postgres`**: Configured with 1.5 CPU limit and 1024M RAM limit to match `shared_buffers=256MB` and internal query execution memory.
- **`mongodb`**: Configured with 1.5 CPU limit and 1536M RAM limit for WiredTiger caching and indexing.
- **`redis`**: Configured with 0.75 CPU limit and 512M RAM limit matching its command-line `--maxmemory 512m`.
- **`elasticsearch`**: Set with 1.5 CPU limit and 1280M RAM limit (`ES_JAVA_OPTS=-Xms512m -Xmx512m` plus off-heap Lucene memory).
- **`kafka-1`, `kafka-2`, `kafka-3`**: 3-broker KRaft cluster. Each allocated 1.0 CPU limit and 896M RAM limit (384M reservation) to ensure reliable leader election and zero replication lag.

### Tier 3: Application Microservices
- All Node.js backend services run with `--max-old-space-size=512` (or `1024` for content/encoding).
- Standard microservices (`auth`, `user`, `payment`, `notification`, `analytics`) are bounded at 0.75 CPU limit and 512M RAM limit (128M reservation).
- `api-gateway` and `content-service` receive larger memory envelopes (640M) and CPU (1.0 core for gateway) to handle high-concurrency request routing and file uploads.

### Tier 4: Ingress & Edge Proxy
- `nginx` and `frontend` receive modest, high-efficiency allocations (0.5 - 1.0 CPU, 384M RAM limit) to serve static assets and proxy traffic with sub-millisecond overhead.

### Tier 5: Observability Stack
- Prometheus, Grafana, Loki, Promtail, cAdvisor, and Node-Exporter combined consume under 2.0 GB maximum burst memory, leaving the vast majority of host RAM for application workloads.

---

## 5. Useful Monitoring & Verification Commands

### Inspect Live Container Consumption
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}"
```

### Inspect Container cgroup Memory Limits
```bash
docker inspect ott-app-api-gateway-1 --format '{{json .HostConfig.Memory}}'
```

### Check Host Memory Health
```bash
free -h
```
