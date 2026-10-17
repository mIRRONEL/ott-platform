# Kafka Cluster Monitoring & Health Checks

## Quick Health Check

Run the automated health check script:
```bash
bash scripts/kafka-health-check.sh
```

---

## Manual Verification Commands

### 1. Check Broker Status

**Container health:**
```bash
docker compose ps kafka-1 kafka-2 kafka-3
```
✅ All brokers should show `(healthy)` status.

**Broker connectivity:**
```bash
docker compose exec kafka-1 kafka-broker-api-versions \
  --bootstrap-server kafka-1:9092,kafka-2:9092,kafka-3:9092 | grep "^kafka-"
```
✅ Should show all 3 brokers responding.

---

### 2. Topic Management

**List all topics:**
```bash
docker compose exec kafka-1 kafka-topics \
  --bootstrap-server kafka-1:9092 --list
```

**Describe topic replication:**
```bash
docker compose exec kafka-1 kafka-topics \
  --bootstrap-server kafka-1:9092 --describe --topic <topic-name>
```
✅ Check that `Isr` (in-sync replicas) matches `Replicas` count.

**Check under-replicated partitions:**
```bash
docker compose exec kafka-1 kafka-topics \
  --bootstrap-server kafka-1:9092 --describe --under-replicated-partitions
```
✅ Should return empty (no output means healthy).

**Create a test topic:**
```bash
docker compose exec kafka-1 kafka-topics \
  --bootstrap-server kafka-1:9092 \
  --create --topic test.topic \
  --partitions 3 --replication-factor 3 \
  --config min.insync.replicas=2
```

---

### 3. Producer & Consumer Testing

**Produce a test message:**
```bash
echo '{"test":"message","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' | \
docker compose exec -T kafka-1 kafka-console-producer \
  --bootstrap-server kafka-1:9092,kafka-2:9092,kafka-3:9092 \
  --topic test.topic
```

**Consume messages:**
```bash
docker compose exec kafka-1 kafka-console-consumer \
  --bootstrap-server kafka-1:9092,kafka-2:9092,kafka-3:9092 \
  --topic test.topic \
  --from-beginning \
  --max-messages 5
```

**Check topic offsets:**
```bash
docker compose exec kafka-1 kafka-get-offsets \
  --bootstrap-server kafka-1:9092,kafka-2:9092,kafka-3:9092 \
  --topic test.topic
```
✅ Offsets > 0 indicate messages were written.

---

### 4. Consumer Group Monitoring

**List consumer groups:**
```bash
docker compose exec kafka-1 kafka-consumer-groups \
  --bootstrap-server kafka-1:9092 --list
```

**Describe consumer group lag:**
```bash
docker compose exec kafka-1 kafka-consumer-groups \
  --bootstrap-server kafka-1:9092 \
  --describe --group <group-name>
```
✅ `LAG` column should be low or zero for healthy consumers.

---

### 5. Broker Logs

**View recent logs:**
```bash
docker compose logs --tail=50 kafka-1 kafka-2 kafka-3
```

**Follow logs in real-time:**
```bash
docker compose logs -f kafka-1 kafka-2 kafka-3
```

**Filter for errors:**
```bash
docker compose logs kafka-1 kafka-2 kafka-3 | grep ERROR
```

---

### 6. DNS & Network Validation

**From another container (e.g., streaming-service):**
```bash
docker compose exec streaming-service getent hosts kafka-1 kafka-2 kafka-3
```
✅ Should resolve to 3 different IPs on the Docker network.

**From broker container:**
```bash
docker compose exec kafka-1 getent hosts kafka-1 kafka-2 kafka-3
```

---

### 7. Application Client Test

**From streaming-service (producer test):**
```bash
docker compose exec streaming-service node -e "
const { Kafka, Partitioners } = require('kafkajs');
(async () => {
  const kafka = new Kafka({
    clientId: 'health-check',
    brokers: ['kafka-1:9092','kafka-2:9092','kafka-3:9092']
  });
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
  });
  await producer.connect();
  console.log('✅ Producer connected successfully');
  await producer.disconnect();
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
"
```

**From notification-service (consumer test):**
```bash
docker compose exec notification-service node -e "
const { Kafka } = require('kafkajs');
(async () => {
  const kafka = new Kafka({
    clientId: 'health-check-consumer',
    brokers: ['kafka-1:9092','kafka-2:9092','kafka-3:9092']
  });
  const consumer = kafka.consumer({ groupId: 'health-check-group' });
  await consumer.connect();
  console.log('✅ Consumer connected successfully');
  await consumer.disconnect();
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
"
```

---

## Health Indicators

### ✅ Healthy Cluster
- All 3 brokers showing `(healthy)` status
- All topics have Isr count = Replicas count
- No under-replicated partitions
- Consumer lag is low/zero
- No ERROR logs (except transient during topic creation)
- All brokers reachable via API version check

### ⚠️ Warning Signs
- One broker unhealthy (cluster still works with 2/3)
- Consumer lag increasing
- Transient connection warnings in logs

### ❌ Critical Issues
- 2+ brokers down (quorum lost)
- Under-replicated partitions persisting
- Producer/consumer connection failures
- Repeated ERROR logs from brokers

---

## Performance Metrics

**Check partition leader distribution:**
```bash
docker compose exec kafka-1 kafka-topics \
  --bootstrap-server kafka-1:9092 --describe | \
  grep "Leader:" | awk '{print $4}' | sort | uniq -c
```
✅ Leaders should be roughly balanced across brokers.

**Monitor log sizes:**
```bash
docker compose exec kafka-1 du -sh /var/lib/kafka/data
docker compose exec kafka-2 du -sh /var/lib/kafka/data
docker compose exec kafka-3 du -sh /var/lib/kafka/data
```

---

## Troubleshooting

### Broker won't start
```bash
# Check logs
docker compose logs kafka-1 --tail=100

# Verify environment variables
docker compose exec kafka-1 env | grep KAFKA_
```

### Can't connect from app
```bash
# Test DNS resolution
docker compose exec <service-name> getent hosts kafka-1 kafka-2 kafka-3

# Test network connectivity
docker compose exec <service-name> nc -zv kafka-1 9092
docker compose exec <service-name> nc -zv kafka-2 9092
docker compose exec <service-name> nc -zv kafka-3 9092
```

### Under-replicated partitions
```bash
# Restart affected broker
docker compose restart kafka-<id>

# Wait for ISR to catch up (check describe output)
watch -n 2 'docker compose exec -T kafka-1 kafka-topics \
  --bootstrap-server kafka-1:9092 --describe --under-replicated-partitions'
```

---

## Monitoring Best Practices

1. **Regular health checks**: Run `kafka-health-check.sh` daily or after deployments
2. **Monitor consumer lag**: Check groups consuming critical topics
3. **Watch broker logs**: Set up alerts for ERROR level logs
4. **Track disk usage**: Kafka data can grow quickly
5. **Test failover**: Periodically stop one broker to verify cluster resilience
6. **Backup metadata**: Document topic configurations and consumer group states

---

## Quick Reference Card

| What to Check | Command | Expected |
|---------------|---------|----------|
| Broker health | `docker compose ps kafka-1 kafka-2 kafka-3` | All `(healthy)` |
| Topic list | `kafka-topics --list` | Shows your topics |
| Replication | `kafka-topics --describe` | Isr = Replicas |
| Under-replication | `--describe --under-replicated-partitions` | Empty output |
| Consumer lag | `kafka-consumer-groups --describe --group <name>` | LAG near zero |
| Produce test | `echo "test" \| kafka-console-producer` | No errors |
| Consume test | `kafka-console-consumer --from-beginning` | See messages |

---

*Last updated: 2026-02-22*
