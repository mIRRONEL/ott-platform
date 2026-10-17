#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - Automated Nightly Backup Cron Job Installer
# Installs a cron job running daily at 03:00 AM UTC with log rotation
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"
CRON_SCHEDULE="${1:-0 3 * * *}" # Default: 03:00 AM daily
CRON_CMD="${CRON_SCHEDULE} ${BACKUP_SCRIPT} > /dev/null 2>&1"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${CYAN}================================================================${NC}"
echo -e "${CYAN}   ⏰ Configuring OTT Platform Automated Nightly Backup Cron   ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Check if cron job already exists
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)

if echo "${CURRENT_CRONTAB}" | grep -F "${BACKUP_SCRIPT}" > /dev/null; then
    echo -e "${YELLOW}⚠ Backup cron job is already registered in crontab:${NC}"
    echo "${CURRENT_CRONTAB}" | grep -F "${BACKUP_SCRIPT}"
else
    # Append backup cron job
    (echo "${CURRENT_CRONTAB}"; echo "# OTT Platform Automated Daily Backup"; echo "${CRON_CMD}") | crontab -
    echo -e "${GREEN}✓ Successfully registered nightly backup job in crontab!${NC}"
    echo -e "Schedule: ${CRON_SCHEDULE} (Daily at 03:00 AM)"
    echo -e "Command : ${BACKUP_SCRIPT}"
fi

echo -e "\n${GREEN}Active User Crontab:${NC}"
crontab -l
echo ""
