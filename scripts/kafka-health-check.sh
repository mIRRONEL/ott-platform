#!/bin/bash

# Kafka Cluster Health Check Script
# Usage: bash scripts/kafka-health-check.sh

set -e

COMPOSE_FILE="docker-compose.yml"
BOOTSTRAP_SERVERS="kafka-1:9092,kafka-2:9092,kafka-3:9092"

echo "=========================================="
echo "Kafka Cluster Health Check"
echo "=========================================="
echo ""

# 1. Check broker container status
echo "📦 Broker Container Status:"
docker compose -f "$COMPOSE_FILE" ps kafka-1 kafka-2 kafka-3 | grep -E "NAME|kafka"
echo ""

# 2. Check broker connectivity
echo "🔗 Broker Connectivity (API Versions):"
docker compose -f "$COMPOSE_FILE" exec -T kafka-1 \
  kafka-broker-api-versions --bootstrap-server "$BOOTSTRAP_SERVERS" 2>/dev/null \
  | grep -E "^kafka-[1-3]" | awk '{print $1, $2, $3}'
echo ""

# 3. List topics
echo "📋 Topics in Cluster:"
docker compose -f "$COMPOSE_FILE" exec -T kafka-1 \
  kafka-topics --bootstrap-server "$BOOTSTRAP_SERVERS" --list 2>/dev/null \
  | grep -v "^__consumer_offsets$" || echo "  (No user topics found)"
echo ""

# 4. Check topic replication health
echo "🔄 Topic Replication Health:"
docker compose -f "$COMPOSE_FILE" exec -T kafka-1 \
  kafka-topics --bootstrap-server "$BOOTSTRAP_SERVERS" --describe 2>/dev/null \
  | grep -v "^$" | grep -E "^Topic:" | while read line; do
    topic=$(echo "$line" | awk '{print $2}')
    if [[ "$topic" != "__consumer_offsets" ]]; then
      rf=$(echo "$line" | grep -oP "ReplicationFactor: \K\d+")
      pc=$(echo "$line" | grep -oP "PartitionCount: \K\d+")
      echo "  ✓ $topic (Partitions: $pc, RF: $rf)"
    fi
  done
echo ""

# 5. Check for under-replicated partitions
echo "⚠️  Under-Replicated Partitions:"
UNDER_REPLICATED=$(docker compose -f "$COMPOSE_FILE" exec -T kafka-1 \
  kafka-topics --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --under-replicated-partitions 2>/dev/null)
if [[ -z "$UNDER_REPLICATED" ]]; then
  echo "  ✓ None (healthy)"
else
  echo "$UNDER_REPLICATED"
fi
echo ""

# 6. Check consumer groups
echo "👥 Consumer Groups:"
GROUPS=$(docker compose -f "$COMPOSE_FILE" exec -T kafka-1 \
  kafka-consumer-groups --bootstrap-server "$BOOTSTRAP_SERVERS" --list 2>/dev/null)
if [[ -z "$GROUPS" ]]; then
  echo "  (No consumer groups found)"
else
  echo "$GROUPS" | while read group; do
    [[ -n "$group" ]] && echo "  • $group"
  done
fi
echo ""

# 7. Check recent broker logs for errors
echo "🔍 Recent Broker Errors/Warnings:"
ERRORS=$(docker compose -f "$COMPOSE_FILE" logs --tail=50 kafka-1 kafka-2 kafka-3 2>/dev/null \
  | grep -E "ERROR" | grep -v "UNKNOWN_TOPIC_ID" | tail -5)
if [[ -z "$ERRORS" ]]; then
  echo "  ✓ No critical errors in recent logs"
else
  echo "$ERRORS"
fi
echo ""

# 8. Cluster summary
echo "=========================================="
echo "✅ Cluster Summary:"
BROKER_COUNT=$(docker compose -f "$COMPOSE_FILE" ps kafka-1 kafka-2 kafka-3 2>/dev/null | grep -c "Up" || echo "0")
TOPIC_COUNT=$(docker compose -f "$COMPOSE_FILE" exec -T kafka-1 \
  kafka-topics --bootstrap-server "$BOOTSTRAP_SERVERS" --list 2>/dev/null \
  | grep -v "^__consumer_offsets$" | wc -l)
echo "  • Brokers: $BROKER_COUNT/3 healthy"
echo "  • User Topics: $TOPIC_COUNT"
echo "  • Cluster Status: $([ "$BROKER_COUNT" -eq 3 ] && echo '✅ HEALTHY' || echo '❌ DEGRADED')"
echo "=========================================="
