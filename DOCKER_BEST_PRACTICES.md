# 🐳 Docker, Compose & Config Best Practices Guide

This document provides a comprehensive technical reference and audit checklist for **Dockerfile optimization, Docker Compose orchestration, and Docker engine/client configuration (`config.json` and `daemon.json`)** aligned with the **CIS Docker Benchmark, OWASP Container Security Guidelines, and 12-Factor App methodology**.

---

## 📑 Table of Contents
1. [Dockerfile Best Practices](#1-dockerfile-best-practices)
2. [Docker Compose Best Practices](#2-docker-compose-best-practices)
3. [Docker Config (`config.json` & `daemon.json`) Best Practices](#3-docker-config-configjson--daemonjson-best-practices)
4. [OTT Platform Current Implementation Audit](#4-ott-platform-current-implementation-audit)
5. [Golden Dockerfile Template](#5-golden-dockerfile-template)
6. [Golden Compose & Daemon Configuration](#6-golden-compose--daemon-configuration)

---

## 1. Dockerfile Best Practices

### 1.1 Multi-Stage Builds
**Rule**: Separate the build environment (compilers, devDependencies, TypeScript toolchains) from the production runtime.
- **Why**: Keeps runtime images lightweight (e.g., reduces a Node.js image from ~1.2 GB to ~130 MB) and removes build-time security vulnerabilities.
- **Implementation**:
  ```dockerfile
  # Stage 1: Build & Compile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json tsconfig.json ./
  RUN npm ci
  COPY src ./src
  RUN npm run build

  # Stage 2: Lean Production Runtime
  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  ```

### 1.2 Non-Root User Execution
**Rule**: Never run production containers as `root` (UID 0).
- **Why**: Mitigates container breakout and privilege escalation attacks. If a process is compromised, the attacker only has unprivileged access.
- **Implementation**:
  ```dockerfile
  # Create an explicit group and user with a fixed UID/GID
  RUN addgroup -g 1001 -S nodejs && \
      adduser -S nodejs -u 1001 -G nodejs

  # Copy files with appropriate ownership
  COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist

  # Switch to non-root user
  USER nodejs
  ```

### 1.3 Proper PID 1 Process & Signal Reaping (`dumb-init` / `tini`)
**Rule**: Node.js and many CLI runtimes are not designed to run as PID 1 (init process). Use a lightweight init system like `dumb-init` or `tini`.
- **Why**:
  - Forwards `SIGTERM` and `SIGINT` signals properly so containers shut down gracefully within the timeout window instead of being abruptly killed (`SIGKILL`).
  - Reaps zombie processes spawned by subshells or child processes (e.g., FFmpeg workers).
- **Implementation**:
  ```dockerfile
  RUN apk add --no-cache dumb-init
  ENTRYPOINT ["dumb-init", "--"]
  CMD ["node", "dist/index.js"]
  ```

### 1.4 Layer Caching & Dependency Hygiene
**Rule**: Order Dockerfile instructions from least-frequently-changing to most-frequently-changing.
- **Why**: Drastically speeds up CI/CD builds by reusing cached layers.
- **Implementation**:
  ```dockerfile
  # 1. Copy package definitions first (cached unless dependencies change)
  COPY package.json package-lock.json ./
  
  # 2. Install production dependencies only & clean npm cache
  RUN npm ci --omit=dev && npm cache clean --force

  # 3. Copy application code last (changes frequently)
  COPY --from=builder /app/dist ./dist
  ```

### 1.5 Strict `.dockerignore` Files
**Rule**: Every build context must have a `.dockerignore` file.
- **Why**: Prevents accidental leakage of `.env` files, `.git` history, local `node_modules` (which may have host-specific binary builds), logs, and temporary files into the build context.
- **Recommended `.dockerignore`**:
  ```gitignore
  node_modules
  npm-debug.log
  .env*
  !.env.example
  .git
  .github
  coverage
  dist
  build
  .DS_Store
  *.log
  ```

### 1.6 Explicit HEALTHCHECK Instructions
**Rule**: Define container healthchecks inside the Dockerfile or Compose file.
- **Why**: Allows Docker Engine, Kubernetes, and reverse proxies (like Nginx) to detect hung or deadlocked processes and route traffic only to healthy instances.
- **Implementation**:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { r.resume(); process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"
  ```

---

## 2. Docker Compose Best Practices

### 2.1 Centralized Logging with Size Rotation (`x-default-logging`)
**Rule**: Always configure log rotation limits on all containers.
- **Why**: Default Docker logging (`json-file`) has no size limit and will eventually fill 100% of server disk space, causing system-wide outages.
- **Implementation**:
  ```yaml
  x-default-logging: &default-logging
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "5"

  services:
    auth-service:
      logging: *default-logging
      # ...
  ```

### 2.2 Health-Aware Dependency Management (`condition: service_healthy`)
**Rule**: Use `condition: service_healthy` instead of `service_started` for upstream databases and messaging queues.
- **Why**: Ensures microservices don't start before PostgreSQL, MongoDB, or Kafka are fully initialized and listening for TCP sockets.
- **Implementation**:
  ```yaml
  services:
    auth-service:
      depends_on:
        postgres:
          condition: service_healthy
        redis:
          condition: service_healthy
        kafka-1:
          condition: service_healthy
  ```

### 2.3 Network Segmentation & Name Isolation
**Rule**: Attach microservices to a dedicated user-defined bridge network rather than the default `bridge` network.
- **Why**: Enables automatic DNS service discovery (e.g., `http://auth-service:3001`), network isolation, and alias routing.
- **Implementation**:
  ```yaml
  networks:
    ott-network:
      driver: bridge
      ipam:
        config:
          - subnet: 172.18.0.0/16
  ```

### 2.4 Volume Permission Management via One-Shot Init Containers
**Rule**: If non-root containers need to write to shared host volumes (e.g., video storage), use a temporary `0:0` root init container to prepare directories and permissions.
- **Implementation**:
  ```yaml
  encoding-volume-init:
    image: alpine:3.20
    volumes:
      - videos_data:/videos
      - ott_uploads:/tmp/ott-uploads
    user: "0:0"
    command: ["sh", "-c", "mkdir -p /videos/raw /videos/encoded /tmp/ott-uploads && chown -R 1001:1001 /videos /tmp/ott-uploads && chmod 750 /videos /videos/raw /videos/encoded /tmp/ott-uploads"]
    restart: "no"

  encoding-service:
    depends_on:
      encoding-volume-init:
        condition: service_completed_successfully
  ```

### 2.5 Resource Constraints & Restart Policies
**Rule**: Define memory limits and restart policies (`unless-stopped`) to prevent OOM cascade failures.
- **Implementation**:
  ```yaml
  services:
    content-service:
      restart: unless-stopped
      deploy:
        resources:
          limits:
            cpus: '2.0'
            memory: 1024M
          reservations:
            memory: 256M
  ```

---

## 3. Docker Config (`config.json` & `daemon.json`) Best Practices

Docker configuration is divided into two distinct files:
1. **Client Configuration (`~/.docker/config.json`)**: Controls how the `docker` CLI interacts with registries, builders, and contexts.
2. **Daemon Engine Configuration (`/etc/docker/daemon.json` or `~/.config/docker/daemon.json`)**: Configures the Docker daemon runtime, networking, logging, and security.

### 3.1 Client Configuration: `~/.docker/config.json`

```json
{
  "auths": {},
  "credsStore": "pass",
  "currentContext": "rootless",
  "plugins": {
    "buildx": {
      "builder": "default"
    }
  },
  "aliases": {
    "builder": "buildx"
  }
}
```

#### Key Client Best Practices:
1. **Secure Credential Storage (`credsStore`)**:
   - **Never store plaintext base64 passwords in `auths`**.
   - Use an OS-native credential helper such as `pass`, `secretservice` (Linux), or `osxkeychain` (macOS).
2. **Context Management (`currentContext`)**:
   - Explicitly define the active context (e.g. `rootless` for unprivileged daemon operation).
3. **Buildx as Default Builder**:
   - Ensures BuildKit is active by default with modern features (cache mounts, multi-stage parallel builds, secrets mounting).

---

### 3.2 Daemon Engine Configuration: `daemon.json`

#### Location:
- **System-wide (Rootful)**: `/etc/docker/daemon.json`
- **Rootless User Mode**: `~/.config/docker/daemon.json`

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  },
  "live-restore": true,
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    },
    "nproc": {
      "Name": "nproc",
      "Hard": 4096,
      "Soft": 4096
    }
  },
  "dns": [
    "8.8.8.8",
    "1.1.1.1"
  ],
  "no-new-privileges": true,
  "icc": false
}
```

#### Daemon Key Parameter Explanations:
1. **`live-restore: true`**:
   - Keeps containers running if the Docker daemon crashes or is updated/restarted. Prevents platform downtime during daemon maintenance.
2. **`log-driver` & `log-opts`**:
   - Enforces a system-wide default limit on all container stdout/stderr logs (50MB per file, 5 rotated files).
3. **`no-new-privileges: true`**:
   - Prevents processes inside containers from gaining additional privileges using `setuid` or `setgid` binaries.
4. **`default-ulimits`**:
   - Sets maximum open file descriptors (`nofile: 65536`) required for high-volume HLS video chunk delivery and WebSocket connections.
5. **`dns`**:
   - Prevents build/runtime failures when local host systemd-resolved has DNS caching issues.

---

## 4. OTT Platform Current Implementation Audit

| Area | Best Practice Item | Status | Notes & Verification |
|---|---|---|---|
| **Dockerfile** | Multi-Stage Builds | ✅ Compliant | Used across all microservices & React frontend |
| **Dockerfile** | Non-Root User (`USER nodejs`) | ✅ Compliant | Strict UID/GID 1001:1001 configured |
| **Dockerfile** | Signal Reaping (`dumb-init`) | ✅ Compliant | Handled across all Node.js backend services |
| **Dockerfile** | `.dockerignore` Hygiene | ✅ Compliant | Dedicated .dockerignore across all 11 service directories |
| **Dockerfile** | Built-in HEALTHCHECKs | ✅ Compliant | Probes `/health` with automatic retry intervals |
| **Compose** | Read-Only Root Filesystem | ✅ Compliant | `read_only: true` with `tmpfs` mounts (/tmp, /app/logs) |
| **Compose** | Linux Capability Dropping | ✅ Compliant | `cap_drop: [ALL]` across all application containers |
| **Compose** | Privilege Escalation Defense | ✅ Compliant | `no-new-privileges: true` across all 19 services |
| **Compose** | Direct Process Supervision | ✅ Compliant | `dumb-init -> node dist/index.js` (no npm CLI wrapper) |
| **Compose** | Log File Rotation | ✅ Compliant | `max-size: 50m`, `max-file: 5` via `x-default-logging` |
| **Compose** | Healthcheck Readiness | ✅ Compliant | Kafka, Postgres, Mongo, Redis declare health tests |
| **Compose** | Zero-Root Volume Inits | ✅ Compliant | `encoding-volume-init` handles volume ownership |
| **CI/CD** | Vulnerability Scanning | ✅ Compliant | Aqua Security Trivy container & filesystem scanner |
| **Daemon** | Rootless Mode & Real-IP | ✅ Compliant | `slirp4netns` port driver preserves source IP |
| **Daemon** | Fallback DNS Servers | ✅ Compliant | Google (`8.8.8.8`) & Cloudflare (`1.1.1.1`) active |

---

## 5. Golden Dockerfile Template

Use this golden template for all new Node.js / TypeScript microservices:

```dockerfile
# ==============================================================================
# Stage 1: Build & Compile
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Install dependencies first (leverage layer cache)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# 2. Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM node:20-alpine

WORKDIR /app

# 1. Install runtime dependencies & init process
RUN apk add --no-cache dumb-init curl

# 2. Create unprivileged service user (UID 1001)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# 3. Copy production dependencies
COPY --chown=nodejs:nodejs package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# 4. Copy compiled artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# 5. Create logs directory with correct permissions
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs && chmod 750 /app/logs

# 6. Switch to unprivileged user
USER nodejs

# 7. Environment & Port settings
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# 8. Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 9. Signal Handling & Execution
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

---

## 6. Golden Compose & Daemon Configuration

### 6.1 Compose Service Snippet
```yaml
services:
  sample-service:
    build:
      context: ./services/sample-service
      dockerfile: Dockerfile
    restart: unless-stopped
    logging: *default-logging
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: 3010
    expose:
      - "3010"
    networks:
      - ott-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 512M
```

### 6.2 Host Setup Command for `daemon.json`
To apply the production `daemon.json` settings:
```bash
# For rootless Docker:
mkdir -p ~/.config/docker
cat << 'EOF' > ~/.config/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  },
  "dns": ["8.8.8.8", "1.1.1.1"],
  "storage-driver": "overlay2"
}
EOF

# Restart Docker daemon
systemctl --user restart docker
```

---

*Docker Standards & Operations Specification — OTT Platform Production Environment.*
