# Project Details - OTT Platform

## Overview
A microservices-based OTT (Over-The-Top) platform with user management, content upload/processing, streaming, payments, notifications, analytics, search, and API gateway, plus a React frontend.

## Architecture
- **Frontend**: React (Vite) app served on port 5173
- **API Gateway**: Node.js service exposing REST API on port 3000
- **Core Services**:
  - Auth Service (3001)
  - User Service (3002)
  - Content Service (3003)
  - Streaming Service (3004)
  - Payment Service (3005)
  - Notification Service (3006)
  - Analytics Service (3007)
- **Datastores**:
  - PostgreSQL 15 (primary relational DB)
  - MongoDB 6 (document DB for content, analytics, etc.)
  - Redis 7 (cache/session/queues)
  - Elasticsearch 8 (search/indexing)
  - Kafka + Zookeeper (event streaming)

## Key Features
- JWT-based authentication
- Role-based access control (admin/user)
- Video upload and processing workflow
- HLS streaming pipeline
- Subscription and payment flows
- Notifications and analytics events
- Search via Elasticsearch

## Ports
- Frontend: 5173
- API Gateway: 3000
- Auth: 3001
- User: 3002
- Content: 3003
- Streaming: 3004
- Payment: 3005
- Notification: 3006
- Analytics: 3007
- PostgreSQL: 5432
- MongoDB: 27017
- Redis: 6379
- Elasticsearch: 9200
- Kafka: 9092
- Zookeeper: 2181

## Data Model (High-Level)
**PostgreSQL**:
- users
- user_preferences
- subscription_plans
- subscriptions
- payments
- audit_logs

**MongoDB**:
- videos
- watchlist
- comments
- video_analytics

## Deployment
- **Development**: [docker-compose.yml](docker-compose.yml)
- **Production**: [docker-compose-prod.yml](docker-compose-prod.yml)

## Initialization
- PostgreSQL schema and seed data: [docker/postgres-init/01-init.sql](docker/postgres-init/01-init.sql)
- MongoDB initialization: [docker/mongo-init/init.sh](docker/mongo-init/init.sh)
- Orchestrated init: [scripts/init-databases.sh](scripts/init-databases.sh)

## Admin Access
Default admin:
- Email: admin@example.com
- Password: admin123

## Known Requirements
- Docker + Docker Compose
- 8GB+ RAM recommended (Elasticsearch + Kafka)

## Related Docs
- [README.md](README.md)
- [DATABASE_INIT_GUIDE.md](DATABASE_INIT_GUIDE.md)
- [VIDEO_UPLOAD_GUIDE.md](VIDEO_UPLOAD_GUIDE.md)
- [STARTUP_GUIDE.md](STARTUP_GUIDE.md)
