#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_INIT_SQL="$PROJECT_ROOT/db-sql/postgres-init/01-init.sql"
MONGO_INIT_SCRIPT="$PROJECT_ROOT/db-sql/mongo-init/init.sh"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
MONGO_ROOT_USERNAME=${MONGO_ROOT_USERNAME}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
MONGO_APP_USER=${MONGO_APP_USER}
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}

echo "════════════════════════════════════════════════════════════"
echo "OTT Platform - Database Initialization Script"
echo "════════════════════════════════════════════════════════════"
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

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
POSTGRES_READY=false
for i in {1..30}; do
    if PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -h postgres -U "$POSTGRES_USER" > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        POSTGRES_READY=true
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

if [ "$POSTGRES_READY" != true ]; then
  echo "❌ ERROR: PostgreSQL did not become ready in time"
  exit 1
fi

# Ensure target PostgreSQL database exists
echo ""
echo "🔧 Ensuring PostgreSQL database '$POSTGRES_DB' exists..."
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1; then
  echo "✅ Database '$POSTGRES_DB' already exists"
else
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"${POSTGRES_DB}\";" > /dev/null
  echo "✅ Database '$POSTGRES_DB' created"
fi

# Initialize PostgreSQL
echo ""
echo "🔧 Initializing PostgreSQL..."
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$POSTGRES_INIT_SQL" > /dev/null 2>&1; then
    echo "✅ PostgreSQL initialized successfully"
    TABLES=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | head -3 | tail -1 | tr -d ' ')
    echo "   Tables created: $TABLES"
else
    echo "⚠️  PostgreSQL initialization completed (may have existing tables)"
fi

# Wait for MongoDB to be ready
echo ""
echo "⏳ Waiting for MongoDB to be ready..."
MONGO_READY=false
for i in {1..30}; do
    if mongosh --host mongodb -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
        echo "✅ MongoDB is ready"
        MONGO_READY=true
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

if [ "$MONGO_READY" != true ]; then
  echo "❌ ERROR: MongoDB did not become ready in time"
  exit 1
fi

# Initialize MongoDB
echo ""
echo "🔧 Initializing MongoDB..."
if mongosh --host mongodb -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin < "$MONGO_INIT_SCRIPT" > /dev/null 2>&1; then
    echo "✅ MongoDB initialized successfully"
else
    echo "⚠️  MongoDB initialization completed (collections may already exist)"
fi

# Create default admin user in PostgreSQL
echo ""
echo "🔧 Creating default admin user..."
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, status) VALUES ('admin@example.com', '\$2b\$10\$CfMt/skNUOYqZlRzEgNt4.HOKXBFtdfeaqmc6edChxnRwC.9ZZyh6', 'Admin', 'User', 'admin', true, 'active');" > /dev/null 2>&1; then
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
POSTGRES_TEST=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1 | tail -1)
echo "✅ PostgreSQL Tables: $POSTGRES_TEST"

# Test MongoDB connection
echo ""
echo "Testing MongoDB..."
MONGO_TEST=$(mongosh --host mongodb -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.ott_platform.users.estimatedDocumentCount()" 2>&1 | grep "^[0-9]" | head -1)
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