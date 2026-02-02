#!/bin/bash
# MongoDB Initialization Script
# This script runs when MongoDB container starts

# Wait for MongoDB to start
sleep 5

# Connect to MongoDB and initialize databases and collections
mongosh << EOF

// Switch to admin database
db = db.getSiblingDB('admin');

// Create root admin user
db.createUser({
  user: 'root',
  pwd: 'root_password_secure',
  roles: [{role: 'root', db: 'admin'}]
});

// Switch to ott_platform database
db = db.getSiblingDB('ott_platform');

// Create application user
db.createUser({
  user: 'ott_user',
  pwd: 'ott_password_secure',
  roles: [
    {role: 'readWrite', db: 'ott_platform'},
    {role: 'dbOwner', db: 'ott_platform'}
  ]
});

// Create collections with schema validation
db.createCollection('videos', {
  validator: {
    \$jsonSchema: {
      bsonType: 'object',
      required: ['title', 'user_id', 'status', 'created_at'],
      properties: {
        _id: {bsonType: 'objectId'},
        title: {bsonType: 'string', description: 'Video title'},
        description: {bsonType: 'string', description: 'Video description'},
        user_id: {bsonType: 'string', description: 'User ID of video owner'},
        original_filename: {bsonType: 'string'},
        upload_path: {bsonType: 'string'},
        hls_path: {bsonType: 'string'},
        thumbnail_url: {bsonType: 'string'},
        duration: {bsonType: 'int', description: 'Duration in seconds'},
        file_size: {bsonType: 'int', description: 'File size in bytes'},
        status: {
          enum: ['uploading', 'processing', 'ready', 'error', 'deleted'],
          description: 'Video status'
        },
        resolution: {bsonType: 'string'},
        bitrate: {bsonType: 'int'},
        views: {bsonType: 'int', description: 'View count'},
        likes: {bsonType: 'int', description: 'Like count'},
        comments_count: {bsonType: 'int'},
        tags: {bsonType: 'array', items: {bsonType: 'string'}},
        category: {bsonType: 'string'},
        is_private: {bsonType: 'bool'},
        created_at: {bsonType: 'date'},
        updated_at: {bsonType: 'date'},
        deleted_at: {bsonType: ['date', 'null']}
      }
    }
  }
});

db.createCollection('watchlist', {
  validator: {
    \$jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'video_id', 'added_at'],
      properties: {
        _id: {bsonType: 'objectId'},
        user_id: {bsonType: 'string'},
        video_id: {bsonType: 'string'},
        added_at: {bsonType: 'date'},
        position: {bsonType: 'int'}
      }
    }
  }
});

db.createCollection('comments', {
  validator: {
    \$jsonSchema: {
      bsonType: 'object',
      required: ['video_id', 'user_id', 'content', 'created_at'],
      properties: {
        _id: {bsonType: 'objectId'},
        video_id: {bsonType: 'string'},
        user_id: {bsonType: 'string'},
        content: {bsonType: 'string'},
        likes: {bsonType: 'int'},
        replies: {bsonType: 'array'},
        created_at: {bsonType: 'date'},
        updated_at: {bsonType: 'date'},
        deleted_at: {bsonType: ['date', 'null']}
      }
    }
  }
});

db.createCollection('video_analytics', {
  validator: {
    \$jsonSchema: {
      bsonType: 'object',
      properties: {
        _id: {bsonType: 'objectId'},
        video_id: {bsonType: 'string'},
        user_id: {bsonType: 'string'},
        watched_duration: {bsonType: 'int'},
        total_duration: {bsonType: 'int'},
        quality_watched: {bsonType: 'string'},
        device_type: {bsonType: 'string'},
        timestamp: {bsonType: 'date'}
      }
    }
  }
});

// Create indexes for better query performance
db.videos.createIndex({user_id: 1});
db.videos.createIndex({status: 1});
db.videos.createIndex({created_at: -1});
db.videos.createIndex({category: 1});
db.videos.createIndex({tags: 1});

db.watchlist.createIndex({user_id: 1});
db.watchlist.createIndex({video_id: 1});
db.watchlist.createIndex({user_id: 1, added_at: -1});

db.comments.createIndex({video_id: 1});
db.comments.createIndex({user_id: 1});
db.comments.createIndex({created_at: -1});

db.video_analytics.createIndex({video_id: 1});
db.video_analytics.createIndex({user_id: 1});
db.video_analytics.createIndex({timestamp: -1});

print('MongoDB initialization completed successfully!');
print('Created databases: admin, ott_platform');
print('Created collections: videos, watchlist, comments, video_analytics');
print('Created users: root, ott_user');

EOF
