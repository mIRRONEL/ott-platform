# OTT Platform - Full-Stack Streaming Application

Complete microservices-based Over-The-Top (OTT) streaming platform with video transcoding, HLS streaming, user management, payments, and analytics.

## Architecture Overview

**Frontend:** React + Vite + TypeScript  
**API Gateway:** Express.js (Port 3000) - Single entry point for all services  
**Backend:** 7 Microservices (Node.js + TypeScript)  
**Databases:** PostgreSQL 15, MongoDB 6.0, Redis 7, Elasticsearch 8  
**Message Queue:** Apache Kafka 7.5.0 + Zookeeper  
**Video Processing:** FFmpeg with HLS transcoding (360p/480p/720p/1080p)  

## Project Structure

```
ott-platform/
├── frontend/                   # React Frontend (Vite)
├── services/
│   ├── api-gateway/           # API Gateway & Routing (Port 3000)
│   ├── auth-service/          # Authentication & Authorization (Port 3001)
│   ├── user-service/          # User Management (Port 3002)
│   ├── content-service/       # Content & Video Processing (Port 3003)
│   ├── streaming-service/     # HLS Video Streaming (Port 3004)
│   ├── payment-service/       # Stripe Payment Integration (Port 3005)
│   ├── notification-service/  # Email, Twilio SMS, Push (Port 3006)
│   └── analytics-service/     # User Analytics & Recommendations (Port 3007)
├── docker/
│   ├── postgres-init/         # PostgreSQL initialization scripts
│   └── mongo-init/            # MongoDB initialization scripts
├── scripts/                   # Database setup and utilities
└── docker-compose.yml         # Single unified compose file
```

## Prerequisites

- **Docker** 24.x or later
- **Docker Compose** 2.x or later
- **FFmpeg** (included in content-service container)
- **Minimum 8GB RAM** (for all services + Kafka)
- **Minimum 20GB disk space** (for Docker images and video storage)

## Quick Start

### 1. Start All Services

```bash
cd ott-platform

# Start all 15 services (infrastructure + microservices + frontend)
docker-compose up -d

# View logs for all services
docker-compose logs -f

# View specific service logs
docker-compose logs -f api-gateway
docker-compose logs -f content-service
docker-compose logs -f frontend
```

### 2. Access the Platform

- **Frontend**: http://localhost:5173 or http://YOUR_IP:5173
- **API Gateway**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

**Default Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

### 3. Verify Services

```bash
# Check all services are healthy
docker-compose ps

# Test API Gateway
curl http://localhost:3000/health

# Test Auth Service (via gateway)
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

## Architecture Details

### Network Design

- **API Gateway (Port 3000)**: Single public entry point - routes to all backend services
- **Frontend (Port 5173)**: React SPA served via `serve`
- **Internal Services**: Expose ports only within Docker network (not accessible from host)
- **CORS**: Configured for wildcard (`*`) - supports localhost and LAN IP access

### Persistent Storage

- `postgres_data`: PostgreSQL database
- `mongodb_data`: MongoDB collections
- `redis_data`: Redis cache and sessions
- `elasticsearch_data`: Search indexes
- `kafka_data` + `zookeeper_data`: Message queue persistence
- `ott_uploads`: Original uploaded video files
- `ott_hls`: Transcoded HLS playlists and segments

### Video Processing Pipeline

1. User uploads video via frontend → API Gateway → Content Service
2. Content Service saves original to `ott_uploads` volume
3. FFmpeg transcodes video to HLS (4 quality levels)
4. HLS files saved to `ott_hls` volume
5. Progress updates sent to MongoDB and Kafka events
6. Frontend streams via `/api/content/videos/{id}/hls` endpoint

## Service Endpoints (via API Gateway)

**Base URL**: `http://localhost:3000/api`

### Auth Service (`/api/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/logout` - Logout user
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password/:token` - Complete password reset

### User Service (`/api/users`)
- `GET /users/profile` - Get current user profile (requires auth)
- `PUT /users/profile` - Update user profile (requires auth)
- `GET /users/:id` - Get user by ID

### Content Service (`/api/content`)
- `POST /content/upload` - Upload video (multipart/form-data, requires auth)
- `GET /content/videos` - List all videos
- `GET /content/videos/:id` - Get video details
- `GET /content/videos/:id/hls` - Get HLS master playlist
- `PUT /content/videos/:id` - Update video metadata (requires auth)
- `DELETE /content/videos/:id` - Delete video (requires auth)

### Streaming Service (`/api/stream`)
- `GET /stream/session` - Create streaming session (requires auth)
- `POST /stream/heartbeat` - Update playback position (requires auth)

### Payment Service (`/api/payments`)
- `POST /payments/subscribe` - Create Stripe subscription (requires auth)
- `GET /payments/plans` - List available plans
- `POST /payments/webhook` - Stripe webhook handler

### Notification Service (`/api/notifications`)
- `GET /notifications` - Get user notifications (requires auth)
- `PUT /notifications/:id/read` - Mark notification as read (requires auth)

### Analytics Service (`/api/analytics`)
- `GET /analytics/dashboard` - Get analytics dashboard (requires auth)
- `GET /analytics/recommendations` - Get personalized recommendations (requires auth)
- `POST /analytics/track` - Track user event

### Example API Requests

**Register User:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "confirm_password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
# Returns: { "access_token": "...", "refresh_token": "..." }
```

**Upload Video:**
```bash
# Get token from login response first
TOKEN="your_access_token_here"

curl -X POST http://localhost:3000/api/content/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@./sample-video.mp4" \
  -F "title=My Video" \
  -F "description=Sample video upload"
```

**List Videos:**
```bash
curl http://localhost:3000/api/content/videos
```

**Get User Profile:**
```bash
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

## Infrastructure Access

### PostgreSQL
```bash
# Connect to PostgreSQL
docker exec -it ott-platform_postgres_1 psql -U postgres -d ott_platform

# Common commands
\dt              # List tables
\d users         # Describe users table
SELECT * FROM users LIMIT 5;
\q               # Exit
```

### MongoDB
```bash
# Connect to MongoDB
docker exec -it ott-platform_mongodb_1 mongosh ott_platform \
  -u ott_user -p change_me_app_password

# Common commands
show collections
db.videos.find().limit(5)
db.users.countDocuments()
exit
```

### Redis
```bash
# Connect to Redis CLI
docker exec -it ott-platform_redis_1 redis-cli -a change_me_redis_password

# Common commands
KEYS *                    # List all keys
GET auth:session:*        # Get session data
TTL auth:session:abc123   # Check TTL
FLUSHALL                  # Clear all data (caution!)
exit
```

### Elasticsearch
```bash
# Check cluster health
curl http://localhost:9200/_cluster/health?pretty

# List indices
curl http://localhost:9200/_cat/indices?v

# Search videos
curl http://localhost:9200/videos/_search?q=title:tutorial
```

## Kafka Event Streaming

### View Topics
```bash
docker exec ott-platform_kafka_1 kafka-topics \
  --list --bootstrap-server localhost:9092
```

### Describe Topic
```bash
docker exec ott-platform_kafka_1 kafka-topics \
  --describe --topic video.uploaded \
  --bootstrap-server localhost:9092
```

### Monitor Events (Consumer)
```bash
# Monitor video uploads
docker exec ott-platform_kafka_1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic video.uploaded \
  --from-beginning

# Monitor user registrations
docker exec ott-platform_kafka_1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic user.registered \
  --from-beginning
```

### Key Kafka Topics
- `user.registered` - New user signups
- `user.login` - User login events
- `video.uploaded` - New video uploads
- `video.processed` - Video transcoding completed
- `payment.completed` - Successful payments
- `notification.sent` - Notification delivery status

## Local Development (Without Docker)

**Note:** Production deployment uses Docker. Local development requires manual setup of all infrastructure.

### 1. Start Infrastructure Only

```bash
# Start databases and message queue with Docker
docker-compose up -d postgres mongodb redis kafka zookeeper elasticsearch
```

### 2. Run Services Locally

```bash
# Terminal 1 - API Gateway
cd services/api-gateway
npm install
npm run dev

# Terminal 2 - Auth Service
cd services/auth-service
npm install
npm run dev

# Terminal 3 - Content Service
cd services/content-service
npm install
npm run dev

# Terminal 4 - Frontend
cd frontend
npm install
npm run dev
```

### 3. Environment Configuration

Each service requires a `.env` file. See `.env.example` in each service directory.

**Critical Variables:**
```env
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
DB_HOST=localhost
REDIS_HOST=localhost
KAFKA_BROKER=localhost:9092
MONGODB_URI=mongodb://ott_user:change_me_app_password@localhost:27017/ott_platform
```

## Testing

```bash
# Run tests for a specific service
cd services/auth-service
npm test

# Run with coverage
npm test -- --coverage

# Run tests for all services
for service in services/*/; do
  (cd "$service" && npm test)
done
```

## Building & Deployment

### Build All Docker Images
```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build api-gateway

# Build with no cache (clean build)
docker-compose build --no-cache
```

### Rebuild and Restart
```bash
# Rebuild and restart all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build content-service
```

### Image Optimization
All Dockerfiles include:
- Multi-stage builds (builder + production)
- `npm cache clean --force` after installs
- Non-root user execution
- Health checks
- Dumb-init for proper signal handling

## Environment Variables

See `.env` file in project root. Key variables:

### Database
- `POSTGRES_DB=ott_platform`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=change_me_postgres_password`
- `MONGO_ROOT_USERNAME=root`
- `MONGO_ROOT_PASSWORD=change_me_root_password`
- `REDIS_PASSWORD=change_me_redis_password`

### Application
- `NODE_ENV=production`
- `JWT_SECRET=change_me_jwt_secret`
- `JWT_REFRESH_SECRET=change_me_refresh_secret`

### Services
- `AUTH_SERVICE_URL=http://auth-service:3001`
- `USER_SERVICE_URL=http://user-service:3002`
- `CONTENT_SERVICE_URL=http://content-service:3003`
- (Additional service URLs defined in compose file)

### Storage
- `UPLOAD_DIR=/tmp/ott-uploads`
- `HLS_OUTPUT_DIR=/tmp/ott-hls`
- `MAX_FILE_SIZE=5GB`

### External APIs (Optional)
- `STRIPE_API_KEY` - Stripe payment integration
- `TWILIO_ACCOUNT_SID` - SMS notifications
- `SMTP_HOST` - Email service

## Monitoring & Debugging

### Service Health Checks
```bash
# Check all service health
curl http://localhost:3000/health
curl http://localhost:3000/status

# Individual service logs
docker-compose logs -f api-gateway
docker-compose logs -f content-service --tail=100
```

### View Real-Time Logs
```bash
# All services
docker-compose logs -f

# Multiple specific services
docker-compose logs -f api-gateway auth-service content-service

# Filter logs
docker-compose logs -f | grep ERROR
```

### Container Resource Usage
```bash
# View resource consumption
docker stats

# Specific containers
docker stats ott-platform_api-gateway_1 ott-platform_content-service_1
```

## Managing Services

### Stop Services
```bash
# Stop all services (keeps volumes)
docker-compose down

# Stop and remove volumes (deletes all data!)
docker-compose down -v

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart content-service
```

### Scale Services (For Testing)
```bash
# Scale user service to 3 instances
docker-compose up -d --scale user-service=3

# Scale multiple services
docker-compose up -d --scale auth-service=2 --scale content-service=2
```

### Clean System
```bash
# Remove stopped containers, networks, dangling images
docker system prune

# Full cleanup (caution: removes all unused Docker resources)
docker system prune -a --volumes
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
lsof -ti:3000 | xargs kill -9

# Or change port in docker-compose.yml
```

### Frontend CORS Issues
- Frontend dynamically uses current hostname for API calls
- CORS configured for wildcard (`*`) - allows any origin
- Access via `http://localhost:5173` or `http://YOUR_IP:5173`

### Database Connection Failed
```bash
# Check PostgreSQL
docker-compose logs postgres
docker exec ott-platform_postgres_1 pg_isready -U postgres

# Check MongoDB
docker-compose logs mongodb
docker exec ott-platform_mongodb_1 mongosh --eval "db.adminCommand('ping')"
```

### Kafka Connection Issues
```bash
# Check Kafka broker
docker-compose logs kafka

# Verify Zookeeper
docker-compose logs zookeeper

# Test Kafka connectivity
docker exec ott-platform_kafka_1 kafka-broker-api-versions \
  --bootstrap-server localhost:9092
```

### Video Upload/Processing Issues
```bash
# Check content service logs
docker-compose logs -f content-service

# Verify FFmpeg is available
docker exec ott-platform_content-service_1 ffmpeg -version

# Check upload volume
docker volume inspect ott-platform_ott_uploads

# Check HLS volume
docker volume inspect ott-platform_ott_hls
```

### Service Won't Start (Dependency Issues)
```bash
# Check service dependencies
docker-compose config

# Start infrastructure first, then services
docker-compose up -d postgres mongodb redis kafka zookeeper elasticsearch
sleep 30
docker-compose up -d
```

### Reset Everything (Nuclear Option)
```bash
# Stop all services and remove volumes
docker-compose down -v

# Remove all OTT images
docker images | grep ott-platform | awk '{print $3}' | xargs docker rmi -f

# Rebuild from scratch
docker-compose up -d --build
```

### Network Issues (IPv4/IPv6 Changes)
```bash
# If you see "network needs to be recreated" error:
docker-compose down
docker network rm ott-platform_ott-network
docker-compose up -d
```

## Features Implemented

✅ **Authentication & Authorization**
- JWT-based auth with refresh tokens
- Password reset flow
- Role-based access control (Admin, User)

✅ **Video Management**
- Video upload (multipart/form-data)
- FFmpeg HLS transcoding (4 quality levels)
- Progressive transcoding with real-time progress
- Video metadata management

✅ **Streaming**
- HLS streaming with adaptive bitrate
- Session tracking
- Playback position persistence

✅ **User Management**
- User profiles
- Subscription management
- Activity tracking

✅ **Payment Integration**
- Stripe subscription support
- Webhook handling
- Plan management

✅ **Notifications**
- Email notifications
- SMS via Twilio
- Push notifications (infrastructure ready)

✅ **Analytics**
- User behavior tracking
- Video watch analytics
- Personalized recommendations

✅ **Infrastructure**
- API Gateway with routing
- Kafka event streaming
- Redis caching and sessions
- Elasticsearch for search
- PostgreSQL for relational data
- MongoDB for document storage

## Production Considerations

### Security Checklist
- [ ] Change all default passwords in `.env`
- [ ] Use strong JWT secrets (32+ random characters)
- [ ] Enable HTTPS/TLS (use reverse proxy like Nginx)
- [ ] Restrict CORS to specific origins in production
- [ ] Set up firewall rules (only expose ports 80/443)
- [ ] Enable Docker secrets for sensitive data
- [ ] Implement rate limiting (already configured in API Gateway)

### Performance Optimization
- Services use `npm cache clean` to reduce image size
- Multi-stage Docker builds
- Non-root user execution
- Health checks for all services
- Connection pooling for databases
- Redis caching for frequently accessed data

### Monitoring (Recommended)
- Prometheus + Grafana for metrics
- ELK Stack (Elasticsearch, Logstash, Kibana) for centralized logging
- Jaeger for distributed tracing
- Sentry for error tracking

### Backup Strategy
```bash
# Backup PostgreSQL
docker exec ott-platform_postgres_1 pg_dump -U postgres ott_platform > backup.sql

# Backup MongoDB
docker exec ott-platform_mongodb_1 mongodump --out /tmp/backup

# Backup volumes
docker run --rm -v ott-platform_ott_uploads:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup.tar.gz /data
```

## Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- Zustand (state management)
- HLS.js (video player)
- Axios

**Backend:**
- Node.js 20 + TypeScript
- Express.js
- TypeORM (PostgreSQL)
- Mongoose (MongoDB)
- ioredis (Redis)
- KafkaJS (Apache Kafka)

**Infrastructure:**
- Docker + Docker Compose
- PostgreSQL 15
- MongoDB 6.0
- Redis 7
- Apache Kafka 7.5.0
- Elasticsearch 8.0
- FFmpeg (video transcoding)

**External Services:**
- Stripe (payments)
- Twilio (SMS)
- SMTP (email)

## API Documentation

Swagger/OpenAPI documentation available at:
- **Development**: http://localhost:3000/api/docs (when running locally)
- Each service has OpenAPI schemas in `src/swagger/` directory

## Project Statistics

- **Services**: 9 (7 microservices + API Gateway + Frontend)
- **Infrastructure**: 6 components (PostgreSQL, MongoDB, Redis, Kafka, Zookeeper, Elasticsearch)
- **Total Containers**: 15
- **Languages**: TypeScript/JavaScript
- **Total Lines of Code**: ~50,000+ (estimated)
- **Docker Image Size**: ~2-3GB total for all services

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Code Standards:**
- Use TypeScript for all new code
- Follow Airbnb style guide
- Write unit tests for new features
- Update API documentation
- Add meaningful commit messages

## License

MIT License - see LICENSE file for details

## Support & Contact

- **Issues**: Open an issue on GitHub
- **Documentation**: See `/docs` directory
- **Email**: support@example.com (update with your contact)

## Acknowledgments

- Built with modern microservices architecture
- Inspired by leading OTT platforms (Netflix, Disney+, Prime Video)
- Community contributions welcome!

---

**Last Updated**: February 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
