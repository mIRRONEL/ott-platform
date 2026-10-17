#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - Production Kubernetes Automated Deployment & Verification
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${ROOT_DIR}/k8s"

NAMESPACE="ott-platform"
REGISTRY="${CONTAINER_REGISTRY:-}" # Set e.g. "myregistry.io/ott" if pushing to remote
BUILD_IMAGES="${BUILD_IMAGES:-false}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300s}"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}${BOLD}=================================================================${NC}"
echo -e "${BLUE}${BOLD}         🚀 OTT Platform Kubernetes Orchestrator 🚀             ${NC}"
echo -e "${BLUE}${BOLD}=================================================================${NC}"

# 1. Dependency checks
echo -e "\n${BOLD}[1/5] Checking Tooling Prerequisites...${NC}"
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ 'kubectl' CLI not found. Please install kubectl or configure your cluster connection.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ kubectl is available: $(kubectl version --client -o json | grep gitVersion | head -n1 | tr -d ' ",')${NC}"

# 2. Build images if requested
if [ "${BUILD_IMAGES}" = "true" ]; then
    echo -e "\n${BOLD}[2/5] Building Docker Images for Microservices & Frontend...${NC}"
    SERVICES=("api-gateway" "auth-service" "user-service" "content-service" "streaming-service" "encoding-service" "live-service" "payment-service" "notification-service" "analytics-service")
    
    for svc in "${SERVICES[@]}"; do
        echo -e "${YELLOW}⚙️ Building ${svc}...${NC}"
        docker build -t "ott-${svc}:latest" "${ROOT_DIR}/services/${svc}"
        if [ -n "${REGISTRY}" ]; then
            docker tag "ott-${svc}:latest" "${REGISTRY}/ott-${svc}:latest"
            docker push "${REGISTRY}/ott-${svc}:latest"
        fi
    done

    echo -e "${YELLOW}⚙️ Building frontend...${NC}"
    docker build -t "ott-frontend:latest" "${ROOT_DIR}/frontend"
    if [ -n "${REGISTRY}" ]; then
        docker tag "ott-frontend:latest" "${REGISTRY}/ott-frontend:latest"
        docker push "${REGISTRY}/ott-frontend:latest"
    fi
    echo -e "${GREEN}✓ All container images built successfully.${NC}"
else
    echo -e "\n${BOLD}[2/5] Skipping image build (set BUILD_IMAGES=true to build).${NC}"
fi

# 3. Apply manifests via Kustomize
echo -e "\n${BOLD}[3/5] Applying Kubernetes Manifests via Kustomize...${NC}"
kubectl apply -k "${K8S_DIR}"

# 4. Wait for StatefulSets and Deployments
echo -e "\n${BOLD}[4/5] Waiting for Cluster Pods to Become Ready...${NC}"

echo -e "${YELLOW}⏳ Waiting for Databases (PostgreSQL, MongoDB, Redis, Elasticsearch)...${NC}"
kubectl rollout status statefulset/postgres -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}" || true
kubectl rollout status statefulset/mongodb -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}" || true
kubectl rollout status statefulset/redis -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}" || true
kubectl rollout status statefulset/elasticsearch -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}" || true

echo -e "${YELLOW}⏳ Waiting for 3-Node Kafka KRaft Cluster...${NC}"
kubectl rollout status statefulset/kafka -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}" || true

echo -e "${YELLOW}⏳ Waiting for Core Microservices & API Gateway...${NC}"
DEPLOYMENTS=("api-gateway" "auth-service" "user-service" "content-service" "streaming-service" "encoding-service" "live-service" "payment-service" "notification-service" "analytics-service" "frontend" "prometheus" "grafana")

for dep in "${DEPLOYMENTS[@]}"; do
    echo -e "  ↳ Checking deployment/${dep}..."
    kubectl rollout status "deployment/${dep}" -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}" || true
done

# 5. Summary & Health Status
echo -e "\n${BOLD}[5/5] Deployment Verification & Status Summary:${NC}"
echo -e "${BLUE}=================================================================${NC}"
kubectl get pods -n "${NAMESPACE}" -o wide
echo -e "${BLUE}-----------------------------------------------------------------${NC}"
kubectl get services -n "${NAMESPACE}"
echo -e "${BLUE}-----------------------------------------------------------------${NC}"
kubectl get ingress -n "${NAMESPACE}" || true
echo -e "${BLUE}=================================================================${NC}"

echo -e "\n${GREEN}${BOLD}🎉 OTT Platform successfully deployed to Kubernetes namespace '${NAMESPACE}'!${NC}\n"
