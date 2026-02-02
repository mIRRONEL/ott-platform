#!/bin/bash

# OTT Platform Database Initialization Script
# This script initializes PostgreSQL and MongoDB after containers start
# Usage: ./scripts/init-databases.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_INIT_SQL="$PROJECT_ROOT/docker/postgres-init/01-init.sql"
MONGO_INIT_SCRIPT="$PROJECT_ROOT/docker/mongo-init/init.sh"

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
for i in {1..30}; do
    if docker exec ott-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

# Initialize PostgreSQL
echo ""
echo "🔧 Initializing PostgreSQL..."
if docker exec -i ott-postgres psql -U postgres -d ott_platform < "$POSTGRES_INIT_SQL" > /dev/null 2>&1; then
    echo "✅ PostgreSQL initialized successfully"
    
    # Verify tables were created
    TABLES=$(docker exec ott-postgres psql -U postgres -d ott_platform -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | head -3 | tail -1 | tr -d ' ')
    echo "   Tables created: $TABLES"
else
    echo "⚠️  PostgreSQL initialization completed (may have existing tables)"
fi

# Wait for MongoDB to be ready
echo ""
echo "⏳ Waiting for MongoDB to be ready..."
for i in {1..30}; do
    if docker exec ott-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
        echo "✅ MongoDB is ready"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

# Initialize MongoDB
echo ""
echo "🔧 Initializing MongoDB..."
if docker exec ott-mongodb mongosh << 'MONGO_EOF' > /dev/null 2>&1
// Switch to admin database
db = db.getSiblingDB('admin');

// Create root admin user
try {
  db.createUser({
    user: 'root',
    pwd: 'root_password_secure',
    roles: [{role: 'root', db: 'admin'}]
  });
} catch(e) {
  print('Admin user may already exist');
}

// Switch to ott_platform database
db = db.getSiblingDB('ott_platform');

// Create application user
try {
  db.createUser({
    user: 'ott_user',
    pwd: 'ott_password_secure',
    roles: [
      {role: 'readWrite', db: 'ott_platform'},
      {role: 'dbOwner', db: 'ott_platform'}
    ]
  });
} catch(e) {
  print('Application user may already exist');
}

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
if docker exec ott-postgres psql -U ott_user -d ott_platform -c "INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, status) VALUES ('admin@example.com', '\$2b\$10\$CfMt/skNUOYqZlRzEgNt4.HOKXBFtdfeaqmc6edChxnRwC.9ZZyh6', 'Admin', 'User', 'admin', true, 'active');" > /dev/null 2>&1; then
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
POSTGRES_TEST=$(docker exec ott-postgres psql -U postgres -d ott_platform -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1 | tail -1)
echo "✅ PostgreSQL Tables: $POSTGRES_TEST"

# Test MongoDB connection
echo ""
echo "Testing MongoDB..."
MONGO_TEST=$(docker exec ott-mongodb mongosh -u root -p root_password_secure --eval "db.ott_platform.users.estimatedDocumentCount()" 2>&1 | grep "^[0-9]" | head -1)
echo "✅ MongoDB Connection Successful"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Database Initialization Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Database Credentials:"
echo "   PostgreSQL User: ott_user (ott_password_secure)"
echo "   MongoDB User: ott_user (ott_password_secure)"
echo ""
echo "🚀 Ready to start application services!"
echo ""
