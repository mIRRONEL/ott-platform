#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - Automated Enterprise Backup & Disaster Recovery Suite
# Target Databases: PostgreSQL 15, MongoDB 6.0, Elasticsearch 8, Redis 7
# ==============================================================================

set -euo pipefail

# Script directory and base paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${PROJECT_DIR}/backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIR="${BACKUP_ROOT}/backup_${TIMESTAMP}"
LOG_FILE="${BACKUP_ROOT}/backup.log"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Load environment variables
if [ -f "${PROJECT_DIR}/.env" ]; then
    # shellcheck disable=SC1091
    source "${PROJECT_DIR}/.env"
fi

# Default database variables if not set
POSTGRES_DB="${POSTGRES_DB:-ott_platform}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
MONGO_DB="${MONGO_INITDB_DATABASE:-ott_platform}"
MONGO_USER="${MONGO_ROOT_USERNAME:-root}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:-IJQWO2DBGY3QU}"

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    local level="$1"
    local message="$2"
    local log_entry="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] ${message}"
    echo -e "${log_entry}" >> "${LOG_FILE}"
    case "${level}" in
        INFO)  echo -e "${GREEN}✓${NC} ${message}" ;;
        WARN)  echo -e "${YELLOW}⚠${NC} ${message}" ;;
        ERROR) echo -e "${RED}✗${NC} ${message}" ;;
        STEP)  echo -e "${BLUE}▶${NC} ${CYAN}${message}${NC}" ;;
    esac
}

mkdir -p "${BACKUP_DIR}"
mkdir -p "${BACKUP_ROOT}"

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${CYAN}   🚀 Starting Automated OTT Platform Database Backup   ${NC}"
echo -e "${BLUE}================================================================${NC}"
log "INFO" "Backup destination directory: ${BACKUP_DIR}"

START_TIME=$(date +%s)

# ------------------------------------------------------------------------------
# 1. PostgreSQL 15 Database Backup
# ------------------------------------------------------------------------------
log "STEP" "Backing up PostgreSQL database (${POSTGRES_DB})..."
PG_DUMP_FILE="${BACKUP_DIR}/postgres_${POSTGRES_DB}.sql.gz"

if docker exec ott-app-postgres-1 pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -9 > "${PG_DUMP_FILE}"; then
    PG_SIZE=$(du -h "${PG_DUMP_FILE}" | cut -f1)
    PG_SHA256=$(sha256sum "${PG_DUMP_FILE}" | awk '{print $1}')
    log "INFO" "PostgreSQL backup completed: ${PG_DUMP_FILE} (${PG_SIZE})"
else
    log "ERROR" "Failed to dump PostgreSQL database!"
    exit 1
fi

# ------------------------------------------------------------------------------
# 2. MongoDB 6.0 Video Catalog & User Activity Backup
# ------------------------------------------------------------------------------
log "STEP" "Backing up MongoDB collections (${MONGO_DB})..."
MONGO_DUMP_FILE="${BACKUP_DIR}/mongodb_${MONGO_DB}.archive.gz"

if docker exec ott-app-mongodb-1 mongodump \
    -u "${MONGO_USER}" \
    -p "${MONGO_PASS}" \
    --authenticationDatabase admin \
    --db "${MONGO_DB}" \
    --archive --gzip > "${MONGO_DUMP_FILE}"; then
    MONGO_SIZE=$(du -h "${MONGO_DUMP_FILE}" | cut -f1)
    MONGO_SHA256=$(sha256sum "${MONGO_DUMP_FILE}" | awk '{print $1}')
    log "INFO" "MongoDB backup completed: ${MONGO_DUMP_FILE} (${MONGO_SIZE})"
else
    log "ERROR" "Failed to dump MongoDB database!"
    exit 1
fi

# ------------------------------------------------------------------------------
# 3. Elasticsearch 8 Catalog Index & Mapping Metadata
# ------------------------------------------------------------------------------
log "STEP" "Exporting Elasticsearch index catalog metadata..."
ES_DUMP_FILE="${BACKUP_DIR}/elasticsearch_indices.json"

if docker exec ott-app-elasticsearch-1 curl -s http://localhost:9200/_cat/indices?format=json > "${ES_DUMP_FILE}"; then
    ES_SIZE=$(du -h "${ES_DUMP_FILE}" | cut -f1)
    log "INFO" "Elasticsearch metadata export completed (${ES_SIZE})"
else
    log "WARN" "Elasticsearch metadata export warning (continuing backup)"
fi

# ------------------------------------------------------------------------------
# 4. Redis 7 Memory Keys & Info Snapshot
# ------------------------------------------------------------------------------
log "STEP" "Capturing Redis cache key statistics..."
REDIS_INFO_FILE="${BACKUP_DIR}/redis_info.txt"
docker exec ott-app-redis-1 redis-cli INFO > "${REDIS_INFO_FILE}" 2>/dev/null || true
log "INFO" "Redis session state metadata captured"

# ------------------------------------------------------------------------------
# 5. Generate Backup Manifest & Checksum Audit
# ------------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

cat <<EOF > "${BACKUP_DIR}/manifest.json"
{
  "backup_id": "backup_${TIMESTAMP}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "duration_seconds": ${DURATION},
  "total_size": "${TOTAL_SIZE}",
  "databases": {
    "postgresql": {
      "database": "${POSTGRES_DB}",
      "file": "postgres_${POSTGRES_DB}.sql.gz",
      "sha256": "${PG_SHA256}"
    },
    "mongodb": {
      "database": "${MONGO_DB}",
      "file": "mongodb_${MONGO_DB}.archive.gz",
      "sha256": "${MONGO_SHA256}"
    },
    "elasticsearch": {
      "file": "elasticsearch_indices.json"
    },
    "redis": {
      "file": "redis_info.txt"
    }
  },
  "host": "$(hostname)",
  "platform_version": "1.0.0-prod"
}
EOF

log "INFO" "Backup manifest created: ${BACKUP_DIR}/manifest.json"

# ------------------------------------------------------------------------------
# 6. Retention Policy Cleanup (Purge backups older than RETENTION_DAYS)
# ------------------------------------------------------------------------------
log "STEP" "Applying ${RETENTION_DAYS}-day backup retention policy..."
DELETED_COUNT=0
while IFS= read -r old_backup; do
    if [ -n "${old_backup}" ]; then
        rm -rf "${old_backup}"
        log "INFO" "Purged expired backup: $(basename "${old_backup}")"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done < <(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "backup_*" -mtime "+${RETENTION_DAYS}")

if [ "${DELETED_COUNT}" -eq 0 ]; then
    log "INFO" "No expired backups required rotation (current retention: ${RETENTION_DAYS} days)"
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✓ Automated OTT Platform Backup Completed Successfully!     ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "📦 Total Size     : ${TOTAL_SIZE}"
echo -e "⏱️ Elapsed Time   : ${DURATION}s"
echo -e "📁 Location       : ${BACKUP_DIR}"
echo -e "📄 Manifest       : ${BACKUP_DIR}/manifest.json\n"
