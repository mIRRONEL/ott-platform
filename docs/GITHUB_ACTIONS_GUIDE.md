# 🚀 GitHub Actions CI/CD Pipeline & Zero-Downtime Deployment Guide

This OTT platform includes an enterprise-grade **GitHub Actions CI/CD Pipeline** that automates static analysis, TypeScript compilation, Docker multi-stage builds, and zero-downtime rolling deployments directly to your production host (`180.94.20.40`).

---

## 🏗️ Pipeline Architecture

```
                                  GitHub Actions CI/CD
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
┌──────────────────┐                                               ┌──────────────────┐
│  CI: Test & Lint │                                               │  CD: Deploy Prod │
│  (on Push & PR)  │                                               │ (on Push: main)  │
└────────┬─────────┘                                               └────────┬─────────┘
         │                                                                  │
         ├─► Validate docker-compose.yml                                   ├─► SSH to 180.94.20.40
         ├─► Matrix Test (9 Microservices + Frontend)                      ├─► git pull origin main
         ├─► TypeScript Compilation (tsc)                                  ├─► Selective ./scripts/deploy.sh
         └─► Docker Build Verification (Buildx)                            ├─► Zero-Downtime Container Recreate
                                                                            ├─► Graceful Nginx Reload
                                                                            └─► Post-Deploy Synthetic Healthcheck
```

---

## 📁 Workflow Files

| Workflow | File Path | Trigger | Purpose |
| :--- | :--- | :--- | :--- |
| **Continuous Integration** | `.github/workflows/ci.yml` | `push`, `pull_request`, `manual` | Validates TypeScript, unit tests, and Docker builds across all 10 services. |
| **Continuous Deployment** | `.github/workflows/deploy.yml` | `push: [main]`, `manual` | Deploys changed microservices with zero downtime via SSH and `./scripts/deploy.sh`. |
| **Security Audit** | `.github/workflows/security-audit.yml` | Weekly cron, `manual` | Scans all microservice dependencies for high/critical vulnerabilities. |

---

## 🔑 GitHub Secrets Configuration

To enable automated push-to-deploy from GitHub to your production server, add these repository secrets in **GitHub ➔ Settings ➔ Secrets and variables ➔ Actions**:

| Secret Name | Recommended Value | Description |
| :--- | :--- | :--- |
| `PROD_HOST` | `180.94.20.40` | Production server IP or domain. |
| `PROD_USER` | `almalinux` | SSH deployment user on the server. |
| `PROD_SSH_KEY` | *(Your Private SSH Key)* | Private key with SSH access to the deployment host. |
| `PROD_PORT` | `22` | SSH port (Default: 22). |

---

## 🔄 How Zero-Downtime Rolling Deployment Works

When you push code to `main`:
1. GitHub Actions establishes an authenticated SSH session with `180.94.20.40`.
2. It detects which microservices have changed via `git diff HEAD~1 HEAD`.
3. It executes our specialized `./scripts/deploy.sh <service>` script:
   - Builds the new container image in the background.
   - Replaces the container in memory.
   - Runs healthchecks (`/health`) up to 15 attempts.
   - Signals Nginx to reload upstream routing with `kill -HUP` (zero dropped HTTP or video stream requests).
   - Runs automated post-deployment synthetic verification across all API endpoints.

---

## 🎯 Manual Deploy Trigger

You can also trigger deployments on demand directly from the GitHub UI:
1. Go to **GitHub ➔ Actions ➔ OTT Platform - Production Zero-Downtime Deployment (CD)**.
2. Click **Run workflow**.
3. Select target service (e.g. `frontend`, `live-service`, `streaming-service`, or `all`).
4. Click **Run workflow**.
