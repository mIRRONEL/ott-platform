# OTT Platform - Backend Services

Complete microservices implementation for Over-The-Top streaming platform.

## Project Structure

```
ott-platform/
├── services/
│   ├── auth-service/          # Authentication & Authorization
│   ├── user-service/          # User Management
│   ├── content-service/       # Content Management
│   ├── streaming-service/     # Video Streaming
│   ├── payment-service/       # Payment Processing
│   ├── notification-service/  # Email, SMS, Push Notifications
│   └── analytics-service/     # Analytics & Recommendations
├── api-gateway/               # API Gateway (Request Router)
├── database/
│   ├── postgresql-schema.sql  # PostgreSQL schemas
│   └── mongodb-schema.js      # MongoDB collections
├── kafka/
│   ├── topics.sh              # Kafka topics configuration
│   └── event-schemas.json     # Event schemas (Avro)
└── docker/                    # Docker configurations
```

## Prerequisites

- Docker 24.x
- Docker Compose 2.x
- Node.js 20 LTS (for local development without Docker)
- PostgreSQL 15 (optional, if running locally)
- MongoDB 6.0 (optional, if running locally)
- Redis 7.0 (optional, if running locally)
- Kafka 3.6+ (optional, if running locally)

## Quick Start with Docker Compose

### 1. Start All Services

```bash
cd ott-platform

# Start all services (PostgreSQL, MongoDB, Redis, Kafka, Elasticsearch, Auth Service)
docker-compose up -d

# View logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f postgres
docker-compose logs -f kafka
docker-compose logs -f auth-service
```

### 2. Verify Services are Running

```bash
# Check all services
docker-compose ps

# Test Auth Service health
curl http://localhost:3001/health
```

### 3. Create Kafka Topics

```bash
# Copy topics creation script into Kafka container
docker cp kafka/topics.sh ott-kafka:/tmp/topics.sh

# Execute topics script
docker exec ott-kafka bash /tmp/topics.sh
```

### 4. Initialize MongoDB Collections

```bash
# Connect to MongoDB and run the schema
docker exec -it ott-mongodb mongosh ott_platform < database/mongodb-schema.js
```

## Service Endpoints

### Auth Service
- **Base URL**: `http://localhost:3001/api`
- **Health Check**: `http://localhost:3001/health`

#### Endpoints:
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/logout` - Logout user
- `POST /auth/forgot-password` - Initiate password reset
- `POST /auth/reset-password/:token` - Reset password
- `GET /auth/validate` - Validate JWT token

### Example Requests

**Register:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "confirm_password": "SecurePassword123!",
    "first_name": "John",
    "last_name": "Doe",
    "country": "US"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

## Database Access

### PostgreSQL
```bash
# Connect to PostgreSQL
docker exec -it ott-postgres psql -U postgres -d ott_platform

# View tables
\dt

# Exit
\q
```

### MongoDB
```bash
# Connect to MongoDB
docker exec -it ott-mongodb mongosh ott_platform

# View collections
show collections

# Exit
exit
```

### Redis
```bash
# Connect to Redis
docker exec -it ott-redis redis-cli

# View keys
keys *

# Exit
exit
```

## Kafka Management

### View Topics
```bash
docker exec ott-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Describe a Topic
```bash
docker exec ott-kafka kafka-topics --describe \
  --topic user.registered \
  --bootstrap-server localhost:9092
```

### Monitor Messages
```bash
docker exec ott-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic user.registered \
  --from-beginning
```

## Development Setup (Local)

### 1. Install Dependencies

```bash
# Install auth service dependencies
cd services/auth-service
npm install
cd ../../
```

### 2. Setup Environment

```bash
# Copy example env file
cp services/auth-service/.env.example services/auth-service/.env

# Edit .env with your configuration
```

### 3. Run Services Locally

```bash
# Start PostgreSQL, MongoDB, Redis, Kafka with Docker
docker-compose up -d postgres mongodb redis kafka zookeeper

# In separate terminal, start Auth Service
cd services/auth-service
npm run dev
```

## Running Tests

```bash
# Unit tests
cd services/auth-service
npm test

# With coverage
npm test -- --coverage

# E2E tests (if configured)
npm run test:e2e
```

## Building Docker Images

### Build Auth Service
```bash
docker build -t ott-auth-service:latest ./services/auth-service
```

### Build All Services
```bash
docker-compose build
```

## Environment Variables

See `.env.example` files in each service directory for required environment variables.

**Key Variables:**
- `NODE_ENV` - Environment (development, staging, production)
- `DB_HOST` - PostgreSQL host
- `REDIS_HOST` - Redis host
- `KAFKA_BROKERS` - Kafka broker addresses
- `JWT_SECRET` - JWT signing secret
- `SMTP_*` - Email service configuration

## Monitoring & Logs

### View Service Logs
```bash
docker-compose logs -f auth-service
```

### Check Service Health
```bash
# Each service exposes /health endpoint
curl http://localhost:3001/health
```

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart services
docker-compose restart
```

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in docker-compose.yml
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Verify connection
docker exec ott-postgres pg_isready -U postgres
```

### Kafka Connection Issues
```bash
# Check Kafka broker
docker-compose logs kafka

# Verify Zookeeper
docker-compose logs zookeeper
```

### Clear All Data
```bash
docker-compose down -v
docker-compose up -d
```

## Next Steps

1. **Implement remaining services:**
   - User Service
   - Content Service
   - Streaming Service
   - Payment Service
   - Notification Service
   - Analytics Service

2. **Setup API Gateway:**
   - Request routing
   - Authentication middleware
   - Rate limiting
   - Request/response logging

3. **Setup monitoring:**
   - Prometheus metrics
   - Grafana dashboards
   - ELK stack for logging
   - Jaeger for tracing

4. **Deploy to Kubernetes:**
   - Create Helm charts
   - Setup CI/CD pipeline
   - Configure ingress
   - Setup monitoring alerts

## API Documentation

Swagger/OpenAPI documentation will be available at:
- `http://localhost:3001/api/docs` (when implemented)

## Contributing

1. Create a feature branch
2. Follow coding standards
3. Write tests
4. Submit pull request

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.
