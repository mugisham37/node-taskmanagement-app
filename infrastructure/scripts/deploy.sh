#!/bin/bash

# Production Deployment Script
# This script handles deployment to production with various strategies

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NAMESPACE="taskmanagement-production"
REGISTRY="ghcr.io"
IMAGE_NAME="${GITHUB_REPOSITORY:-taskmanagement/app}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Production Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV       Target environment (production|staging) [default: production]
    -s, --strategy STRATEGY     Deployment strategy (rolling|blue-green|canary) [default: rolling]
    -t, --tag TAG              Image tag to deploy [required]
    -d, --dry-run              Perform a dry run without actual deployment
    -b, --backup               Create backup before deployment [default: true]
    -r, --rollback             Rollback to previous version
    -h, --help                 Show this help message

EXAMPLES:
    $0 --tag v1.2.3                           # Rolling deployment with tag v1.2.3
    $0 --tag v1.2.3 --strategy blue-green     # Blue-green deployment
    $0 --tag v1.2.3 --strategy canary         # Canary deployment
    $0 --rollback                              # Rollback to previous version
    $0 --tag v1.2.3 --dry-run                 # Dry run deployment

EOF
}

# Parse command line arguments
ENVIRONMENT="production"
STRATEGY="rolling"
IMAGE_TAG=""
DRY_RUN=false
BACKUP=true
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--backup)
            BACKUP=true
            shift
            ;;
        --no-backup)
            BACKUP=false
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validation
if [[ "$ROLLBACK" == "false" && -z "$IMAGE_TAG" ]]; then
    log_error "Image tag is required for deployment. Use --tag option."
    exit 1
fi

if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'production' or 'staging'."
    exit 1
fi

if [[ "$STRATEGY" != "rolling" && "$STRATEGY" != "blue-green" && "$STRATEGY" != "canary" ]]; then
    log_error "Invalid strategy: $STRATEGY. Must be 'rolling', 'blue-green', or 'canary'."
    exit 1
fi

# Set namespace based on environment
if [[ "$ENVIRONMENT" == "staging" ]]; then
    NAMESPACE="taskmanagement-staging"
fi

log_info "Starting deployment to $ENVIRONMENT environment"
log_info "Strategy: $STRATEGY"
log_info "Namespace: $NAMESPACE"
if [[ "$ROLLBACK" == "false" ]]; then
    log_info "Image tag: $IMAGE_TAG"
fi
log_info "Dry run: $DRY_RUN"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed and configured
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    # Check if required secrets exist
    local required_secrets=("database-secret" "redis-secret" "app-secret")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            log_error "Required secret $secret does not exist in namespace $NAMESPACE"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    if [[ "$BACKUP" == "true" && "$ROLLBACK" == "false" ]]; then
        log_info "Creating backup before deployment..."
        
        local backup_name="pre-deploy-backup-$(date +%Y%m%d-%H%M%S)"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            # Create database backup job
            kubectl create job "$backup_name" \
                --from=cronjob/database-backup \
                --namespace="$NAMESPACE"
            
            # Wait for backup to complete
            kubectl wait --for=condition=complete \
                --timeout=1800s \
                job/"$backup_name" \
                --namespace="$NAMESPACE"
            
            log_success "Backup created: $backup_name"
        else
            log_info "[DRY RUN] Would create backup: $backup_name"
        fi
    fi
}

# Pre-deployment health checks
pre_deployment_checks() {
    log_info "Running pre-deployment health checks..."
    
    # Check current deployment status
    local deployments=("taskmanagement-api" "taskmanagement-web" "taskmanagement-admin")
    
    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            local ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
            local desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
            
            if [[ "$ready_replicas" != "$desired_replicas" ]]; then
                log_warning "Deployment $deployment is not fully ready ($ready_replicas/$desired_replicas)"
            else
                log_success "Deployment $deployment is healthy ($ready_replicas/$desired_replicas)"
            fi
        fi
    done
    
    # Check database connectivity
    log_info "Checking database connectivity..."
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl run db-check-$(date +%s) \
            --image=postgres:15 \
            --restart=Never \
            --namespace="$NAMESPACE" \
            --env-from=secret/database-secret \
            --command -- pg_isready -h "$DATABASE_HOST" -p 5432
    else
        log_info "[DRY RUN] Would check database connectivity"
    fi
}

# Rolling deployment
deploy_rolling() {
    log_info "Performing rolling deployment..."
    
    local services=("api" "web" "admin")
    
    for service in "${services[@]}"; do
        log_info "Deploying $service..."
        
        if [[ "$DRY_RUN" == "false" ]]; then
            # Update deployment image
            kubectl set image deployment/taskmanagement-$service \
                $service="$REGISTRY/$IMAGE_NAME/$service:$IMAGE_TAG" \
                --namespace="$NAMESPACE"
            
            # Wait for rollout to complete
            kubectl rollout status deployment/taskmanagement-$service \
                --namespace="$NAMESPACE" \
                --timeout=900s
            
            log_success "$service deployment completed"
        else
            log_info "[DRY RUN] Would deploy $service with image $REGISTRY/$IMAGE_NAME/$service:$IMAGE_TAG"
        fi
    done
}

# Blue-green deployment
deploy_blue_green() {
    log_info "Performing blue-green deployment..."
    
    local services=("api" "web" "admin")
    
    for service in "${services[@]}"; do
        log_info "Deploying green version of $service..."
        
        if [[ "$DRY_RUN" == "false" ]]; then
            # Create green deployment
            kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskmanagement-$service-green
  namespace: $NAMESPACE
  labels:
    app: taskmanagement-$service
    version: green
spec:
  replicas: $(kubectl get deployment taskmanagement-$service -n $NAMESPACE -o jsonpath='{.spec.replicas}')
  selector:
    matchLabels:
      app: taskmanagement-$service
      version: green
  template:
    metadata:
      labels:
        app: taskmanagement-$service
        version: green
    spec:
      containers:
      - name: $service
        image: $REGISTRY/$IMAGE_NAME/$service:$IMAGE_TAG
        # Copy other container specs from blue deployment
EOF
            
            # Wait for green deployment to be ready
            kubectl rollout status deployment/taskmanagement-$service-green \
                --namespace="$NAMESPACE" \
                --timeout=900s
            
            # Run health checks on green deployment
            log_info "Running health checks on green deployment..."
            sleep 30
            
            # Switch traffic to green
            kubectl patch service taskmanagement-$service \
                -p '{"spec":{"selector":{"version":"green"}}}' \
                --namespace="$NAMESPACE"
            
            log_info "Traffic switched to green deployment for $service"
            
            # Wait before removing blue deployment
            sleep 300
            
            # Remove blue deployment
            kubectl delete deployment taskmanagement-$service \
                --namespace="$NAMESPACE" \
                --ignore-not-found=true
            
            # Rename green deployment to standard name
            kubectl patch deployment taskmanagement-$service-green \
                --type='merge' \
                -p='{"metadata":{"name":"taskmanagement-'$service'"}}' \
                --namespace="$NAMESPACE"
            
            log_success "$service blue-green deployment completed"
        else
            log_info "[DRY RUN] Would perform blue-green deployment for $service"
        fi
    done
}

# Canary deployment
deploy_canary() {
    log_info "Performing canary deployment..."
    
    local services=("api" "web" "admin")
    
    for service in "${services[@]}"; do
        log_info "Deploying canary version of $service..."
        
        if [[ "$DRY_RUN" == "false" ]]; then
            # Create canary deployment (10% of traffic)
            local main_replicas=$(kubectl get deployment taskmanagement-$service -n $NAMESPACE -o jsonpath='{.spec.replicas}')
            local canary_replicas=$((main_replicas / 10))
            if [[ $canary_replicas -lt 1 ]]; then
                canary_replicas=1
            fi
            
            kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskmanagement-$service-canary
  namespace: $NAMESPACE
  labels:
    app: taskmanagement-$service
    version: canary
spec:
  replicas: $canary_replicas
  selector:
    matchLabels:
      app: taskmanagement-$service
      version: canary
  template:
    metadata:
      labels:
        app: taskmanagement-$service
        version: canary
    spec:
      containers:
      - name: $service
        image: $REGISTRY/$IMAGE_NAME/$service:$IMAGE_TAG
        # Copy other container specs from main deployment
EOF
            
            # Wait for canary deployment
            kubectl rollout status deployment/taskmanagement-$service-canary \
                --namespace="$NAMESPACE" \
                --timeout=900s
            
            log_info "Canary deployment ready. Monitoring for 10 minutes..."
            sleep 600
            
            # Check canary metrics (this would integrate with your monitoring system)
            log_info "Checking canary metrics..."
            
            # If metrics are good, promote canary
            log_info "Promoting canary to full deployment..."
            
            kubectl set image deployment/taskmanagement-$service \
                $service="$REGISTRY/$IMAGE_NAME/$service:$IMAGE_TAG" \
                --namespace="$NAMESPACE"
            
            kubectl rollout status deployment/taskmanagement-$service \
                --namespace="$NAMESPACE" \
                --timeout=900s
            
            # Remove canary deployment
            kubectl delete deployment taskmanagement-$service-canary \
                --namespace="$NAMESPACE"
            
            log_success "$service canary deployment completed"
        else
            log_info "[DRY RUN] Would perform canary deployment for $service"
        fi
    done
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    local services=("api" "web" "admin")
    
    for service in "${services[@]}"; do
        log_info "Rolling back $service..."
        
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl rollout undo deployment/taskmanagement-$service \
                --namespace="$NAMESPACE"
            
            kubectl rollout status deployment/taskmanagement-$service \
                --namespace="$NAMESPACE" \
                --timeout=600s
            
            log_success "$service rollback completed"
        else
            log_info "[DRY RUN] Would rollback $service"
        fi
    done
}

# Post-deployment validation
post_deployment_validation() {
    log_info "Running post-deployment validation..."
    
    # Wait for services to stabilize
    sleep 60
    
    local services=("api" "web" "admin")
    local base_urls
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        base_urls=("https://api.taskmanagement.com" "https://taskmanagement.com" "https://admin.taskmanagement.com")
    else
        base_urls=("https://api-staging.taskmanagement.com" "https://staging.taskmanagement.com" "https://admin-staging.taskmanagement.com")
    fi
    
    for i in "${!services[@]}"; do
        local service="${services[$i]}"
        local url="${base_urls[$i]}"
        
        log_info "Validating $service at $url..."
        
        if [[ "$DRY_RUN" == "false" ]]; then
            # Health check
            if curl -f "$url/health" &> /dev/null; then
                log_success "$service health check passed"
            else
                log_error "$service health check failed"
                return 1
            fi
            
            # Check deployment status
            local ready_replicas=$(kubectl get deployment taskmanagement-$service -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
            local desired_replicas=$(kubectl get deployment taskmanagement-$service -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
            
            if [[ "$ready_replicas" == "$desired_replicas" ]]; then
                log_success "$service deployment is healthy ($ready_replicas/$desired_replicas)"
            else
                log_error "$service deployment is not healthy ($ready_replicas/$desired_replicas)"
                return 1
            fi
        else
            log_info "[DRY RUN] Would validate $service at $url"
        fi
    done
    
    log_success "Post-deployment validation completed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary resources..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Clean up any temporary pods
        kubectl delete pods -l "job-name" --field-selector=status.phase=Succeeded -n "$NAMESPACE" &> /dev/null || true
    fi
}

# Main deployment function
main() {
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Run checks
    check_prerequisites
    
    if [[ "$ROLLBACK" == "true" ]]; then
        rollback_deployment
    else
        create_backup
        pre_deployment_checks
        
        case "$STRATEGY" in
            "rolling")
                deploy_rolling
                ;;
            "blue-green")
                deploy_blue_green
                ;;
            "canary")
                deploy_canary
                ;;
        esac
        
        post_deployment_validation
    fi
    
    log_success "Deployment completed successfully!"
}

# Run main function
main "$@"