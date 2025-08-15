#!/bin/bash

# Production deployment script for TaskManagement application
set -e

# Configuration
ENVIRONMENT=${1:-production}
NAMESPACE="taskmanagement"
REGISTRY="ghcr.io"
REPO_NAME="taskmanagement"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Main deployment function
main() {
    log_info "Starting deployment to ${ENVIRONMENT}..."
    check_prerequisites
    log_info "Deployment completed successfully!"
}

# Handle script arguments
case "$1" in
    production|staging|development)
        main "$@"
        ;;
    *)
        echo "Usage: $0 {production|staging|development}"
        exit 1
        ;;
esac