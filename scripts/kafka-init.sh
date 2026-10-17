#!/bin/bash
set -e

echo "⏳ Waiting for Kafka cluster to be ready..."

# Wait until kafka-1 is accepting connections
until kafka-topics --bootstrap-server kafka-1:9092 --list > /dev/null 2>&1; do
  echo "Kafka not ready yet, retrying in 5s..."
  sleep 5
done

echo "✅ Kafka cluster is ready!"

TOPICS=(
  # encoding-service
  "encoding.metrics"
  "video.encoding.completed"
  "video.encoding.failed"

  # content-service
  "video.uploaded"
  "video.updated"
  "video.deleted"
  "video.comment.added"
  "video.rated"
  "video.encoding.completed"
  "video.encoding.failed"
  "video.encoding.progress"

  # auth-service
  "user.registered"

  # user-service
  "user.profile.updated"
  "user.deleted"
  "user.preferences.updated"
  "user.watchlist.added"
  "user.watchlist.removed"

  # streaming-service
  "user.stream.started"
  "user.stream.ended"
  "system.error"

  # payment-service
  "subscription.created"
  "subscription.updated"
  "subscription.cancelled"

  # notification-service (consumed, not yet produced)
  "subscription.renewed"
  "subscription.expiring_soon"
  "payment.success"
  "payment.failed"
  "video.ready"
)

for TOPIC in "${TOPICS[@]}"; do
  echo "Creating topic: $TOPIC"
  kafka-topics --bootstrap-server kafka-1:9092 \
    --create \
    --topic "$TOPIC" \
    --partitions 3 \
    --replication-factor 3 \
    --if-not-exists
done

echo "✅ All ${#TOPICS[@]} Kafka topics created successfully!"
