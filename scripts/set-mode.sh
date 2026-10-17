#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - Environment Mode & Troubleshooting Switcher
# ==============================================================================
# Easily toggle between Production, Unconstrained, and Deep Debug modes.
# Usage:
#   ./scripts/set-mode.sh [prod | unconstrained | debug | status]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

update_env_compose_file() {
    local compose_value="$1"
    if [ ! -f "$ENV_FILE" ]; then
        touch "$ENV_FILE"
    fi

    if grep -q "^COMPOSE_FILE=" "$ENV_FILE"; then
        # Replace existing COMPOSE_FILE line
        sed -i "s|^COMPOSE_FILE=.*|COMPOSE_FILE=${compose_value}|" "$ENV_FILE"
    else
        # Append COMPOSE_FILE to .env
        echo "COMPOSE_FILE=${compose_value}" >> "$ENV_FILE"
    fi
}

get_current_mode() {
    if [ ! -f "$ENV_FILE" ] || ! grep -q "^COMPOSE_FILE=" "$ENV_FILE"; then
        echo "unconstrained"
        return
    fi
    local current
    current=$(grep "^COMPOSE_FILE=" "$ENV_FILE" | cut -d '=' -f2)
    if [[ "$current" == *"docker-compose.security.yml"* ]] && [[ "$current" == *"docker-compose.resources.yml"* ]]; then
        echo "prod"
    elif [[ "$current" == *"docker-compose.debug.yml"* ]]; then
        echo "debug"
    else
        echo "unconstrained"
    fi
}

show_status() {
    local mode
    mode=$(get_current_mode)
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN} OTT Platform - Current Operating Mode${NC}"
    echo -e "${CYAN}======================================================${NC}"
    if [ "$mode" == "prod" ]; then
        echo -e "Active Mode: ${GREEN}PRODUCTION (Hardened Security + Resource Capped)${NC}"
        echo -e "Overlays:    docker-compose.yml + docker-compose.resources.yml + docker-compose.security.yml"
        echo -e "Description: Maximum container security (read_only, cap_drop) and strict CPU/RAM limits."
    elif [ "$mode" == "debug" ]; then
        echo -e "Active Mode: ${YELLOW}DEEP DEBUG (Direct Port Access & Verbose Logs)${NC}"
        echo -e "Overlays:    docker-compose.yml + docker-compose.debug.yml"
        echo -e "Description: Ports 3001-3009 exposed directly on localhost, debug logs enabled, writable root FS."
    else
        echo -e "Active Mode: ${CYAN}UNCONSTRAINED / TROUBLESHOOTING (Unlimited CPU/RAM)${NC}"
        echo -e "Overlays:    docker-compose.yml (Base modular stacks)"
        echo -e "Description: Unlimited host cores & RAM for high-throughput transcoding and stress testing."
    fi
    echo -e "${CYAN}------------------------------------------------------${NC}"
    echo -e "Run ${YELLOW}./scripts/set-mode.sh [prod|unconstrained|debug]${NC} to switch."
    echo -e "${CYAN}======================================================${NC}"
}

MODE="${1:-status}"

case "$MODE" in
    prod|production)
        echo -e "${YELLOW}Switching to PRODUCTION mode...${NC}"
        update_env_compose_file "docker-compose.yml:docker-compose.resources.yml:docker-compose.security.yml"
        cd "$ROOT_DIR"
        docker compose config --quiet
        echo -e "${GREEN}✓ Successfully set to PRODUCTION mode!${NC}"
        echo -e "  - Resource Limits: ${GREEN}ENABLED${NC} (CPU & RAM capped across 27 services)"
        echo -e "  - Container Security: ${GREEN}HARDENED${NC} (read_only: true, cap_drop: ALL)"
        echo -e "\nApply changes with: ${CYAN}docker compose up -d${NC}"
        ;;

    unconstrained|troubleshoot|test)
        echo -e "${YELLOW}Switching to UNCONSTRAINED / TROUBLESHOOTING mode...${NC}"
        update_env_compose_file "docker-compose.yml"
        cd "$ROOT_DIR"
        docker compose config --quiet
        echo -e "${GREEN}✓ Successfully set to UNCONSTRAINED mode!${NC}"
        echo -e "  - Resource Limits: ${YELLOW}DISABLED${NC} (Unlimited CPU & RAM for transcoding/benchmarks)"
        echo -e "  - Security Locks: ${YELLOW}DISABLED${NC} (Writable root filesystem for debug tools)"
        echo -e "\nApply changes with: ${CYAN}docker compose up -d${NC}"
        ;;

    debug|dev)
        echo -e "${YELLOW}Switching to DEEP DEBUG mode...${NC}"
        update_env_compose_file "docker-compose.yml:docker-compose.debug.yml"
        cd "$ROOT_DIR"
        docker compose config --quiet
        echo -e "${GREEN}✓ Successfully set to DEEP DEBUG mode!${NC}"
        echo -e "  - Microservice Ports: ${GREEN}EXPOSED on localhost:3001-3009${NC}"
        echo -e "  - Database Ports: ${GREEN}EXPOSED on localhost:5432, 27017, 6379, 9200${NC}"
        echo -e "  - Verbose Logs: ${GREEN}LOG_LEVEL=debug${NC}"
        echo -e "\nApply changes with: ${CYAN}docker compose up -d${NC}"
        ;;

    status)
        show_status
        ;;

    *)
        echo -e "${RED}Unknown mode: '$MODE'${NC}"
        echo -e "Usage: $0 [prod | unconstrained | debug | status]"
        exit 1
        ;;
esac
