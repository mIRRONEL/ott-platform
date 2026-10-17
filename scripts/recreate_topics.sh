#!/bin/bash
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
  docker compose exec kafka-1 kafka-topics --bootstrap-server kafka-1:9092 --create --topic "$TOPIC" --partitions 3 --replication-factor 3 --if-not-exists
done
