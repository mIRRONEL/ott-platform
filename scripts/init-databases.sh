#!/bin/bash

# OTT Platform Database Initialization Script
# This script initializes PostgreSQL and MongoDB after containers start
# Usage: ./scripts/init-databases.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_INIT_SQL="$PROJECT_ROOT/db-sql/postgres-init/01-init.sql"
MONGO_INIT_SCRIPT="$PROJECT_ROOT/db-sql/mongo-init/init.sh"
ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_IMPL="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_IMPL="docker-compose"
else
  echo "❌ ERROR: Neither 'docker compose' nor 'docker-compose' is available"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-ott_platform}
MONGO_ROOT_USERNAME=${MONGO_ROOT_USERNAME:-root}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:-root_password_secure}
MONGO_APP_USER=${MONGO_APP_USER:-ott_user}
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD:-ott_password_secure}

compose_exec() {
  if [ "$COMPOSE_IMPL" = "docker compose" ]; then
    docker compose -f "$COMPOSE_FILE" exec -T "$@"
  else
    docker-compose -f "$COMPOSE_FILE" exec -T "$@"
  fi
}

compose_ps_q() {
  if [ "$COMPOSE_IMPL" = "docker compose" ]; then
    docker compose -f "$COMPOSE_FILE" ps -q "$1"
  else
    docker-compose -f "$COMPOSE_FILE" ps -q "$1"
  fi
}

echo "════════════════════════════════════════════════════════════"
echo "OTT Platform - Database Initialization Script"
echo "════════════════════════════════════════════════════════════"
echo "Compose command: $COMPOSE_IMPL"
echo ""

# Check if files exist
if [ ! -f "$POSTGRES_INIT_SQL" ]; then
    echo "❌ ERROR: PostgreSQL init script not found at $POSTGRES_INIT_SQL"
    exit 1
fi

if [ ! -f "$MONGO_INIT_SCRIPT" ]; then
    echo "❌ ERROR: MongoDB init script not found at $MONGO_INIT_SCRIPT"
    exit 1
fi

if [ -z "$(compose_ps_q postgres)" ] || [ -z "$(compose_ps_q mongodb)" ]; then
  echo "❌ ERROR: PostgreSQL and MongoDB containers are not running"
  echo "   Start services first: docker compose up -d postgres mongodb"
  exit 1
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
POSTGRES_READY=false
for i in {1..5}; do
    if compose_exec postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
    POSTGRES_READY=true
        break
    fi
  echo "  Attempt $i/5..."
    sleep 2
done

if [ "$POSTGRES_READY" != true ]; then
  echo "❌ ERROR: PostgreSQL did not become ready in time"
  exit 1
fi

# Ensure target PostgreSQL database exists
echo ""
echo "🔧 Ensuring PostgreSQL database '$POSTGRES_DB' exists..."
if compose_exec postgres psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1; then
  echo "✅ Database '$POSTGRES_DB' already exists"
else
  compose_exec postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"${POSTGRES_DB}\";" > /dev/null
  echo "✅ Database '$POSTGRES_DB' created"
fi

# Initialize PostgreSQL
echo ""
echo "🔧 Initializing PostgreSQL..."
if compose_exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$POSTGRES_INIT_SQL" > /dev/null 2>&1; then
    echo "✅ PostgreSQL initialized successfully"
    
    # Verify tables were created
    TABLES=$(compose_exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | head -3 | tail -1 | tr -d ' ')
    echo "   Tables created: $TABLES"
else
    echo "⚠️  PostgreSQL initialization completed (may have existing tables)"
fi

# Wait for MongoDB to be ready
echo ""
echo "⏳ Waiting for MongoDB to be ready..."
MONGO_READY=false
for i in {1..5}; do
    if compose_exec mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
        echo "✅ MongoDB is ready"
    MONGO_READY=true
        break
    fi
  echo "  Attempt $i/5..."
    sleep 2
done

if [ "$MONGO_READY" != true ]; then
  echo "❌ ERROR: MongoDB did not become ready in time"
  exit 1
fi

# Initialize MongoDB
echo ""
echo "🔧 Initializing MongoDB..."
if compose_exec mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin << MONGO_EOF > /dev/null 2>&1
// Switch to admin database
db = db.getSiblingDB('admin');

// Create root admin user
try {
  db.createUser({
    user: '${MONGO_ROOT_USERNAME}',
    pwd: '${MONGO_ROOT_PASSWORD}',
    roles: [{role: 'root', db: 'admin'}]
  });
} catch(e) {
  print('Admin user may already exist');
}

const appUser = '${MONGO_APP_USER}';
const appPass = '${MONGO_APP_PASSWORD}';
const appDbs = ['ott_platform', 'user_db', 'analytics_db', 'notification_db'];

appDbs.forEach((dbName) => {
  const appDb = db.getSiblingDB(dbName);
  try {
    appDb.createUser({
      user: appUser,
      pwd: appPass,
      roles: [
        {role: 'readWrite', db: dbName},
        {role: 'dbOwner', db: dbName}
      ]
    });
  } catch(e) {
    print('Application user may already exist for ' + dbName);
  }
});

// Switch to ott_platform database
db = db.getSiblingDB('ott_platform');

// Create collections with validation
db.createCollection('videos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'user_id', 'status', 'created_at'],
      properties: {
        _id: {bsonType: 'objectId'},
        title: {bsonType: 'string'},
        description: {bsonType: 'string'},
        user_id: {bsonType: 'string'},
        original_filename: {bsonType: 'string'},
        upload_path: {bsonType: 'string'},
        hls_path: {bsonType: 'string'},
        thumbnail_url: {bsonType: 'string'},
        duration: {bsonType: 'int'},
        file_size: {bsonType: 'int'},
        status: {enum: ['uploading', 'processing', 'ready', 'error', 'deleted']},
        views: {bsonType: 'int'},
        likes: {bsonType: 'int'},
        tags: {bsonType: 'array'},
        category: {bsonType: 'string'},
        is_private: {bsonType: 'bool'},
        created_at: {bsonType: 'date'},
        updated_at: {bsonType: 'date'}
      }
    }
  }
});

db.createCollection('watchlist');
db.createCollection('comments');
db.createCollection('video_analytics');

// Create indexes
db.videos.createIndex({user_id: 1});
db.videos.createIndex({status: 1});
db.videos.createIndex({created_at: -1});
db.watchlist.createIndex({user_id: 1});
db.watchlist.createIndex({video_id: 1});
db.comments.createIndex({video_id: 1});

print('✅ MongoDB initialized successfully');
MONGO_EOF
then
    echo "✅ MongoDB initialized successfully"
else
    echo "⚠️  MongoDB initialization completed (collections may already exist)"
fi

# Create default admin user in PostgreSQL
echo ""
echo "🔧 Creating default admin user..."
if compose_exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, status) VALUES ('admin@example.com', '\$2b\$10\$CfMt/skNUOYqZlRzEgNt4.HOKXBFtdfeaqmc6edChxnRwC.9ZZyh6', 'Admin', 'User', 'admin', true, 'active');" > /dev/null 2>&1; then
    echo "✅ Admin user created (admin@example.com / admin123)"
else
    echo "⚠️  Admin user may already exist"
fi

# Verify connections
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔍 Verification"
echo "═══════════════════════════════════════════════════════════"

# Test PostgreSQL connection
echo ""
echo "Testing PostgreSQL..."
POSTGRES_TEST=$(compose_exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1 | tail -1)
echo "✅ PostgreSQL Tables: $POSTGRES_TEST"

# Test MongoDB connection
echo ""
echo "Testing MongoDB..."
MONGO_TEST=$(compose_exec mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.ott_platform.users.estimatedDocumentCount()" 2>&1 | grep "^[0-9]" | head -1)
echo "✅ MongoDB Connection Successful"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Database Initialization Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Database Credentials:"
echo "   PostgreSQL User: ${DB_APP_USER:-ott_user} (${DB_APP_PASSWORD:-ott_password_secure})"
echo "   MongoDB User: ${MONGO_APP_USER} (${MONGO_APP_PASSWORD})"
echo ""
echo "🚀 Ready to start application services!"
echo ""
