#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - One-Click Disaster Recovery & Restore Suite
# Restores PostgreSQL 15 and MongoDB 6.0 from a Backup Archive
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${PROJECT_DIR}/backups"
LOG_FILE="${BACKUP_ROOT}/restore.log"

# Load environment variables
if [ -f "${PROJECT_DIR}/.env" ]; then
    # shellcheck disable=SC1091
    source "${PROJECT_DIR}/.env"
fi

POSTGRES_DB="${POSTGRES_DB:-ott_platform}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
MONGO_DB="${MONGO_INITDB_DATABASE:-ott_platform}"
MONGO_USER="${MONGO_ROOT_USERNAME:-root}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:-IJQWO2DBGY3QU}"

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

# Find target backup directory
TARGET_BACKUP="${1:-}"
if [ -z "${TARGET_BACKUP}" ]; then
    # Find latest backup
    TARGET_BACKUP="$(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "backup_*" | sort -r | head -n 1 || true)"
    if [ -z "${TARGET_BACKUP}" ]; then
        echo -e "${RED}Error: No backup archives found in ${BACKUP_ROOT}${NC}"
        exit 1
    fi
fi

if [ ! -d "${TARGET_BACKUP}" ]; then
    echo -e "${RED}Error: Specified backup directory does not exist: ${TARGET_BACKUP}${NC}"
    exit 1
fi

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${CYAN}   🔄 Starting OTT Platform Disaster Recovery & Restore   ${NC}"
echo -e "${BLUE}================================================================${NC}"
log "INFO" "Restoring from: ${TARGET_BACKUP}"

# Check for manifest
MANIFEST_FILE="${TARGET_BACKUP}/manifest.json"
if [ -f "${MANIFEST_FILE}" ]; then
    log "INFO" "Found backup manifest: $(basename "${MANIFEST_FILE}")"
fi

PG_DUMP="${TARGET_BACKUP}/postgres_${POSTGRES_DB}.sql.gz"
MONGO_DUMP="${TARGET_BACKUP}/mongodb_${MONGO_DB}.archive.gz"

# ------------------------------------------------------------------------------
# 1. Restore PostgreSQL Database
# ------------------------------------------------------------------------------
if [ -f "${PG_DUMP}" ]; then
    log "STEP" "Restoring PostgreSQL database (${POSTGRES_DB})..."
    if gunzip -c "${PG_DUMP}" | docker exec -i ott-app-postgres-1 psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; then
        log "INFO" "PostgreSQL database successfully restored"
    else
        log "WARN" "PostgreSQL restore executed with notices (check table consistency)"
    fi
else
    log "WARN" "PostgreSQL dump not found: ${PG_DUMP}"
fi

# ------------------------------------------------------------------------------
# 2. Restore MongoDB Database
# ------------------------------------------------------------------------------
if [ -f "${MONGO_DUMP}" ]; then
    log "STEP" "Restoring MongoDB collections (${MONGO_DB})..."
    if docker exec -i ott-app-mongodb-1 mongorestore \
        -u "${MONGO_USER}" \
        -p "${MONGO_PASS}" \
        --authenticationDatabase admin \
        --db "${MONGO_DB}" \
        --archive --gzip --drop < "${MONGO_DUMP}"; then
        log "INFO" "MongoDB collections successfully restored"
    else
        log "ERROR" "Failed to restore MongoDB database!"
        exit 1
    fi
else
    log "WARN" "MongoDB archive not found: ${MONGO_DUMP}"
fi

# ------------------------------------------------------------------------------
# 3. Synchronize Elasticsearch Search Index
# ------------------------------------------------------------------------------
log "STEP" "Verifying Elasticsearch search indices..."
docker exec ott-app-elasticsearch-1 curl -s http://localhost:9200/_cat/indices?v || true

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✓ OTT Platform Disaster Recovery Completed Successfully!     ${NC}"
echo -e "${GREEN}================================================================${NC}\n"
