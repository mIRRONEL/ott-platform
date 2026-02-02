# docker-compose.yml vs docker-compose-prod.yml

## Quick Summary

| Feature | docker-compose.yml | docker-compose-prod.yml |
|---------|-------------------|----------------------|
| **Purpose** | Local development | Production deployment |
| **Health Checks** | ✅ Yes (postgres, mongodb) | ❌ No |
| **depends_on** | `condition: service_started` | Simple `depends_on: [service]` |
| **Container Comments** | ✅ Yes (helpful) | ❌ No |
| **PostgreSQL Command** | ✅ `max_connections=1000` | ❌ No |
| **Kafka Listeners** | ✅ Internal + external | ✅ Internal + external |

---

## Detailed Differences

### 1) **Health Checks**
**Development (docker-compose.yml):**
```yaml
postgres:
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U postgres']
    interval: 10s
    timeout: 5s
    retries: 5

mongodb:
  healthcheck:
    test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
    interval: 10s
    timeout: 5s
    retries: 5
```

**Production (docker-compose-prod.yml):**
- ❌ **NO healthchecks at all** - services may start unhealthy

---

### 2) **Service Dependencies**
**Development:**
```yaml
auth-service:
  depends_on:
    postgres:
      condition: service_started  # Waits for service to start
    redis:
      condition: service_started
    kafka:
      condition: service_started
```

**Production:**
```yaml
auth-service:
  depends_on:
    - postgres  # Just lists, no waiting
    - redis
    - kafka
```

---

### 3) **PostgreSQL Configuration**
**Development:**
```yaml
postgres:
  command:
    - "postgres"
    - "-c"
    - "max_connections=1000"  # High connection pool for dev
```

**Production:**
```yaml
postgres:
  # No custom command - uses defaults
```

---

### 4) **Container Comments**
**Development:** Has comments like `# PostgreSQL Database`, `# Auth Service`, etc.  
**Production:** No comments - cleaner file but less documentation

---

### 5) **Frontend Environment**
**Development:**
```yaml
frontend:
  environment:
    NODE_ENV: production
    VITE_API_URL: http://localhost:3000/api
```

**Production:**
```yaml
frontend:
  environment:
    NODE_ENV: production
    VITE_API_URL: http://localhost:3000/api
  environment:  # ⚠️ DUPLICATE! (Bug)
    NODE_ENV: production
    VITE_API_URL: http://localhost:3000/api
```

---

## Issues Found in Production Compose

### ⚠️ BUG: Frontend has duplicate `environment` block
The production compose has the frontend section defined twice:
```yaml
frontend:
  ...
  environment:
    NODE_ENV: production
    VITE_API_URL: http://localhost:3000/api
  environment:  # This will override the first one
    NODE_ENV: production
    VITE_API_URL: http://localhost:3000/api
```

**Fix:** Remove the duplicate.

---

## When to Use Each

### Use `docker-compose.yml` for:
- ✅ Local development
- ✅ Testing during development
- ✅ Quick iterations
- **Why:** Health checks ensure all services are ready before starting

### Use `docker-compose-prod.yml` for:
- ❌ **Currently: Not recommended** - missing healthchecks
- **Needs:** Add healthchecks first
- Then use for staging/production

---

## Recommendation

1. **Add healthchecks to production compose** (copy from dev)
2. **Add service dependency conditions** (use `service_healthy` not just `service_started`)
3. **Fix frontend duplicate environment** 
4. **Add PostgreSQL command** to production for consistency

Once these are fixed, `docker-compose-prod.yml` will be production-ready.
