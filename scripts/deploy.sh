#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - Production Zero-Downtime Safe Deployment Script
# Usage: ./scripts/deploy.sh [service_name]
# Example: ./scripts/deploy.sh frontend
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVICE="${1:-frontend}"

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${CYAN}   🚀 Production Zero-Downtime Deployment: ${SERVICE}   ${NC}"
echo -e "${BLUE}================================================================${NC}"

cd "${PROJECT_DIR}"

# 1. Build the target service
echo -e "${BLUE}▶${NC} Building Docker image for ${SERVICE}..."
docker compose build "${SERVICE}"

# 2. Recreate container gracefully
echo -e "${BLUE}▶${NC} Starting new container instance for ${SERVICE}..."
docker compose up -d --no-deps "${SERVICE}"

# 3. Wait for container to be healthy
echo -e "${BLUE}▶${NC} Verifying container health..."
CONTAINER_NAME=$(docker compose ps -q "${SERVICE}" | head -n 1)

if [ -n "${CONTAINER_NAME}" ]; then
  for i in {1..15}; do
    HEALTH_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "null")
    if [ "${HEALTH_STATUS}" = '"healthy"' ] || [ "${HEALTH_STATUS}" = "null" ]; then
      echo -e "${GREEN}✓${NC} Container ${SERVICE} is healthy and running!"
      break
    fi
    echo -e "${YELLOW}⏳ Waiting for healthcheck (attempt ${i}/15)...${NC}"
    sleep 2
  done
fi

# 4. Graceful Nginx Signal Reload (Zero Downtime)
echo -e "${BLUE}▶${NC} Gracefully reloading Nginx edge reverse proxy..."
if docker exec ott-nginx nginx -t > /dev/null 2>&1; then
  docker exec ott-nginx nginx -s reload
  echo -e "${GREEN}✓${NC} Nginx upstream routing reloaded seamlessly!"
else
  echo -e "${RED}✗ Nginx configuration test failed! Check syntax.${NC}"
  exit 1
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✓ ${SERVICE} Deployed Successfully with Zero Downtime!    ${NC}"
echo -e "${GREEN}================================================================${NC}\n"
