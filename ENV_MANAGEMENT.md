# Environment Variables & Docker Secrets Management Architecture

This document defines the production standards, patterns, and security practices for managing environment variables and secrets in the OTT Platform.

---

## 1. Core Principles

1. **Enterprise-Grade Docker Secrets (`/run/secrets/`)**:
   - All sensitive credentials (database passwords, JWT signing keys, payment provider API keys, and internal cluster secrets) are mounted as in-memory files under `/run/secrets/`.
   - Secret files are mounted via `tmpfs` and never stored in the container root filesystem layer or exposed in `docker inspect <container>`.

2. **Principle of Least Privilege**:
   - Containers only receive the exact secrets they require to function.
   - Example: The `notification-service` does not receive `stripe_api_key`, and the `frontend` receives zero secrets.

3. **In-Memory Loading via Universal Secret Loader (`secrets.ts`)**:
   - At startup, each microservice dynamically reads `/run/secrets/` into `process.env` in-memory.
   - Compound URLs (`REDIS_URL`, `MONGODB_URL`, `MONGODB_URI`) are reconstructed dynamically in memory without plaintext secrets leaking in `docker-compose.yml`.

4. **Zero Secrets in Image Layers (`ARG`/`ENV` in Dockerfile)**:
   - Secret keys and passwords are never baked into Docker images via `ARG` or `ENV` in Dockerfiles.

---

## 2. Docker Secrets Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ HOST SECRETS STORE                                                                      │
│                                                                                         │
│  Directory: /home/almalinux/ott-app/secrets/ (chmod 755 / files chmod 644)              │
│  Excluded from Git via .gitignore                                                       │
│                                                                                         │
│  • postgres_password.txt        • jwt_secret.txt                                        │
│  • postgres_app_password.txt    • jwt_refresh_secret.txt                                │
│  • mongo_root_password.txt      • stripe_api_key.txt                                    │
│  • mongo_app_password.txt       • internal_service_secret.txt                           │
│  • redis_password.txt                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Docker Compose In-Memory tmpfs Mount
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ IN-CONTAINER LEAST-PRIVILEGE SECRETS MOUNTS (/run/secrets/)                             │
│                                                                                         │
│  • postgres         ──> /run/secrets/postgres_password, postgres_app_password           │
│  • mongodb          ──> /run/secrets/mongo_root_password, mongo_app_password            │
│  • redis            ──> /run/secrets/redis_password                                     │
│  • auth-service     ──> postgres_password, mongo_app_password, redis_password,          │
│                         jwt_secret, jwt_refresh_secret, internal_service_secret         │
│  • payment-service  ──> postgres_password, redis_password, jwt_secret,                  │
│                         stripe_api_key, internal_service_secret                         │
│  • api-gateway      ──> redis_password, jwt_secret, internal_service_secret             │
│  • frontend         ──> No secrets (static single-page app)                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Universal Loader (src/utils/secrets.ts)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ IN-MEMORY PROCESS ENVIRONMENT (Zero Plaintext in docker inspect)                       │
│                                                                                         │
│  • DB_PASSWORD, JWT_SECRET, REDIS_URL, MONGODB_URL populated at process boot            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Service Secrets Matrix

| Service | Attached Docker Secrets | Purpose |
| :--- | :--- | :--- |
| **`postgres`** | `postgres_password`, `postgres_app_password` | Root and application DB authentication |
| **`mongodb`** | `mongo_root_password`, `mongo_app_password` | Admin and database user authentication |
| **`redis`** | `redis_password` | In-memory cache authentication |
| **`auth-service`** | `postgres_password`, `mongo_app_password`, `redis_password`, `jwt_secret`, `jwt_refresh_secret`, `internal_service_secret` | User authentication & token issuance |
| **`user-service`** | `postgres_password`, `mongo_app_password`, `redis_password`, `jwt_secret`, `internal_service_secret` | Profile and user settings management |
| **`content-service`** | `mongo_app_password`, `redis_password`, `jwt_secret`, `internal_service_secret` | Video catalog and metadata management |
| **`streaming-service`**| `postgres_password`, `mongo_app_password`, `redis_password`, `jwt_secret`, `internal_service_secret` | Video stream delivery & session tracking |
| **`live-service`** | `mongo_app_password`, `redis_password`, `jwt_secret`, `internal_service_secret` | RTMP ingest & live stream broadcasting |
| **`payment-service`** | `postgres_password`, `redis_password`, `jwt_secret`, `stripe_api_key`, `internal_service_secret` | Stripe billing & subscription processing |
| **`notification-service`**| `mongo_app_password`, `redis_password`, `jwt_secret`, `internal_service_secret` | Push notifications and email dispatches |
| **`analytics-service`** | `postgres_password`, `mongo_app_password`, `redis_password`, `jwt_secret`, `internal_service_secret` | Telemetry aggregation & recommendations |
| **`encoding-service`** | `internal_service_secret` | Video transcoding job processing |
| **`api-gateway`** | `redis_password`, `jwt_secret`, `internal_service_secret` | Rate limiting & edge routing validation |
| **`frontend`** | *None* | Web SPA static asset delivery |

---

## 4. Verification Commands

### Check Secret Mounts Inside a Container
```bash
docker compose exec auth-service ls -la /run/secrets
```

### Verify Zero Secrets in Docker Inspect
```bash
docker inspect ott-app-auth-service-1 | jq '.[0].Config.Env'
```
*(Confirms no plaintext `DB_PASSWORD` or `JWT_SECRET` in inspect output)*

### Test Platform API Health
```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/api/v1/content/videos
```
