#!/bin/bash

# Production Rollback Script
# This script handles emergency rollback procedures

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NAMESPACE="taskmanagement-production"

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
Production Rollback Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV       Target environment (production|staging) [default: production]
    -s, --service SERVICE       Specific service to rollback (api|web|admin|all) [default: all]
    -r, --revision REVISION     Specific revision to rollback to (optional)
    -d, --dry-run              Perform a dry run without actual rollback
    -f, --force                Force rollback without confirmation
    -b, --restore-backup       Restore database from backup
    --backup-timestamp TS       Specific backup timestamp to restore
    -h, --help                 Show this help message

EXAMPLES:
    $0                                          # Rollback all services to previous version
    $0 --service api                           # Rollback only API service
    $0 --revision 3                            # Rollback to specific revision
    $0 --restore-backup --backup-timestamp 20231201-120000
    $0 --force                                 # Skip confirmation prompts

EOF
}

# Parse command line arguments
ENVIRONMENT="production"
SERVICE="all"
REVISION=""
DRY_RUN=false
FORCE=false
RESTORE_BACKUP=false
BACKUP_TIMESTAMP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        -r|--revision)
            REVISION="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -b|--restore-backup)
            RESTORE_BACKUP=true
            shift
            ;;
        --backup-timestamp)
            BACKUP_TIMESTAMP="$2"
            shift 2
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

# Set namespace based on environment
if [[ "$ENVIRONMENT" == "staging" ]]; then
    NAMESPACE="taskmanagement-staging"
fi

# Validation
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'production' or 'staging'."
    exit 1
fi

if [[ "$SERVICE" != "all" && "$SERVICE" != "api" && "$SERVICE" != "web" && "$SERVICE" != "admin" ]]; then
    log_error "Invalid service: $SERVICE. Must be 'all', 'api', 'web', or 'admin'."
    exit 1
fi

log_warning "=== EMERGENCY ROLLBACK PROCEDURE ==="
log_info "Environment: $ENVIRONMENT"
log_info "Namespace: $NAMESPACE"
log_info "Service: $SERVICE"
log_info "Dry run: $DRY_RUN"
log_info "Restore backup: $RESTORE_BACKUP"

# Confirmation prompt
if [[ "$FORCE" == "false" && "$DRY_RUN" == "false" ]]; then
    echo
    log_warning "This will rollback the $SERVICE service(s) in $ENVIRONMENT environment."
    if [[ "$RESTORE_BACKUP" == "true" ]]; then
        log_warning "This will also restore the database from backup."
    fi
    echo
    read -p "Are you sure you want to proceed? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled."
        exit 0
    fi
fi

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
    
    log_success "Prerequisites check passed"
}

# Get current deployment status
get_deployment_status() {
    local service_name="$1"
    local deployment_name="taskmanagement-$service_name"
    
    if kubectl get deployment "$deployment_name" -n "$NAMESPACE" &> /dev/null; then
        local current_image=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
        local ready_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        local revision=$(kubectl rollout history deployment/"$deployment_name" -n "$NAMESPACE" --revision=0 | tail -n 1 | awk '{print $1}')
        
        log_info "$service_name status:"
        log_info "  Current image: $current_image"
        log_info "  Replicas: $ready_replicas/$desired_replicas"
        log_info "  Current revision: $revision"
        
        # Show rollout history
        log_info "  Rollout history:"
        kubectl rollout history deployment/"$deployment_name" -n "$NAMESPACE" | tail -n +2 | while read -r line; do
            log_info "    $line"
        done
    else
        log_error "Deployment $deployment_name not found"
        return 1
    fi
}

# Rollback service
rollback_service() {
    local service_name="$1"
    local deployment_name="taskmanagement-$service_name"
    
    log_info "Rolling back $service_name..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Check if deployment exists
        if ! kubectl get deployment "$deployment_name" -n "$NAMESPACE" &> /dev/null; then
            log_error "Deployment $deployment_name not found"
            return 1
        fi
        
        # Perform rollback
        if [[ -n "$REVISION" ]]; then
            log_info "Rolling back to revision $REVISION..."
            kubectl rollout undo deployment/"$deployment_name" \
                --to-revision="$REVISION" \
                --namespace="$NAMESPACE"
        else
            log_info "Rolling back to previous revision..."
            kubectl rollout undo deployment/"$deployment_name" \
                --namespace="$NAMESPACE"
        fi
        
        # Wait for rollback to complete
        log_info "Waiting for rollback to complete..."
        kubectl rollout status deployment/"$deployment_name" \
            --namespace="$NAMESPACE" \
            --timeout=600s
        
        # Verify rollback
        local new_image=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
        log_success "$service_name rolled back to: $new_image"
        
        # Health check
        sleep 30
        local ready_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        
        if [[ "$ready_replicas" == "$desired_replicas" ]]; then
            log_success "$service_name rollback completed successfully ($ready_replicas/$desired_replicas replicas ready)"
        else
            log_error "$service_name rollback may have issues ($ready_replicas/$desired_replicas replicas ready)"
            return 1
        fi
    else
        log_info "[DRY RUN] Would rollback $service_name"
        if [[ -n "$REVISION" ]]; then
            log_info "[DRY RUN] Would rollback to revision $REVISION"
        else
            log_info "[DRY RUN] Would rollback to previous revision"
        fi
    fi
}

# Restore database from backup
restore_database() {
    log_warning "Restoring database from backup..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Put applications in maintenance mode
        log_info "Putting applications in maintenance mode..."
        kubectl scale deployment taskmanagement-api --replicas=0 -n "$NAMESPACE"
        kubectl scale deployment taskmanagement-web --replicas=0 -n "$NAMESPACE"
        kubectl scale deployment taskmanagement-admin --replicas=0 -n "$NAMESPACE"
        
        # Wait for pods to terminate
        sleep 60
        
        # Determine backup to restore
        local backup_to_restore
        if [[ -n "$BACKUP_TIMESTAMP" ]]; then
            backup_to_restore="db-backup-$ENVIRONMENT-$BACKUP_TIMESTAMP"
        else
            # Get latest backup
            backup_to_restore=$(kubectl get jobs -n "$NAMESPACE" -l app=database-backup --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')
        fi
        
        log_info "Restoring from backup: $backup_to_restore"
        
        # Create restore job
        kubectl create job "db-restore-$(date +%s)" \
            --from=cronjob/database-restore \
            --namespace="$NAMESPACE" \
            --dry-run=client -o yaml | \
            sed "s/BACKUP_NAME_PLACEHOLDER/$backup_to_restore/" | \
            kubectl apply -f -
        
        # Wait for restore to complete
        kubectl wait --for=condition=complete \
            --timeout=3600s \
            job/"db-restore-$(date +%s)" \
            --namespace="$NAMESPACE"
        
        # Validate restored data
        log_info "Validating restored data..."
        kubectl run data-validation-$(date +%s) \
            --image=postgres:15 \
            --restart=Never \
            --namespace="$NAMESPACE" \
            --command -- /scripts/validate-restored-data.sh
        
        # Restore application replicas
        log_info "Restoring application services..."
        kubectl scale deployment taskmanagement-api --replicas=3 -n "$NAMESPACE"
        kubectl scale deployment taskmanagement-web --replicas=2 -n "$NAMESPACE"
        kubectl scale deployment taskmanagement-admin --replicas=2 -n "$NAMESPACE"
        
        # Wait for services to be ready
        kubectl rollout status deployment/taskmanagement-api --namespace="$NAMESPACE" --timeout=600s
        kubectl rollout status deployment/taskmanagement-web --namespace="$NAMESPACE" --timeout=600s
        kubectl rollout status deployment/taskmanagement-admin --namespace="$NAMESPACE" --timeout=600s
        
        log_success "Database restore completed"
    else
        log_info "[DRY RUN] Would restore database from backup: $backup_to_restore"
    fi
}

# Run health checks
run_health_checks() {
    log_info "Running post-rollback health checks..."
    
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
        
        # Skip if we only rolled back a specific service
        if [[ "$SERVICE" != "all" && "$SERVICE" != "$service" ]]; then
            continue
        fi
        
        log_info "Health checking $service at $url..."
        
        if [[ "$DRY_RUN" == "false" ]]; then
            local retries=0
            local max_retries=10
            
            while [[ $retries -lt $max_retries ]]; do
                if curl -f -s "$url/health" &> /dev/null; then
                    log_success "$service health check passed"
                    break
                else
                    retries=$((retries + 1))
                    log_warning "$service health check failed (attempt $retries/$max_retries)"
                    sleep 30
                fi
            done
            
            if [[ $retries -eq $max_retries ]]; then
                log_error "$service health check failed after $max_retries attempts"
                return 1
            fi
        else
            log_info "[DRY RUN] Would check health of $service at $url"
        fi
    done
    
    log_success "All health checks passed"
}

# Send notifications
send_notifications() {
    local status="$1"
    local message="$2"
    
    log_info "Sending notifications..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Send Slack notification (if webhook is configured)
        if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
            curl -X POST "$SLACK_WEBHOOK_URL" \
                -H 'Content-type: application/json' \
                --data "{
                    \"text\": \"🔄 Rollback $status\",
                    \"attachments\": [{
                        \"color\": \"$([ "$status" == "completed" ] && echo "good" || echo "danger")\",
                        \"fields\": [{
                            \"title\": \"Environment\",
                            \"value\": \"$ENVIRONMENT\",
                            \"short\": true
                        }, {
                            \"title\": \"Service\",
                            \"value\": \"$SERVICE\",
                            \"short\": true
                        }, {
                            \"title\": \"Message\",
                            \"value\": \"$message\",
                            \"short\": false
                        }]
                    }]
                }" &> /dev/null || log_warning "Failed to send Slack notification"
        fi
        
        # Send email notification (if configured)
        if command -v mail &> /dev/null && [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
            echo "$message" | mail -s "Rollback $status - $ENVIRONMENT" "$NOTIFICATION_EMAIL" || log_warning "Failed to send email notification"
        fi
    else
        log_info "[DRY RUN] Would send notifications about rollback $status"
    fi
}

# Main rollback function
main() {
    local start_time=$(date)
    
    # Check prerequisites
    check_prerequisites
    
    # Show current status
    if [[ "$SERVICE" == "all" ]]; then
        local services=("api" "web" "admin")
        for service in "${services[@]}"; do
            get_deployment_status "$service"
        done
    else
        get_deployment_status "$SERVICE"
    fi
    
    # Restore database if requested
    if [[ "$RESTORE_BACKUP" == "true" ]]; then
        restore_database
    fi
    
    # Perform rollback
    if [[ "$SERVICE" == "all" ]]; then
        local services=("api" "web" "admin")
        for service in "${services[@]}"; do
            rollback_service "$service"
        done
    else
        rollback_service "$SERVICE"
    fi
    
    # Run health checks
    run_health_checks
    
    local end_time=$(date)
    local success_message="Rollback completed successfully at $end_time (started at $start_time)"
    
    log_success "$success_message"
    send_notifications "completed" "$success_message"
}

# Error handling
handle_error() {
    local exit_code=$?
    local error_message="Rollback failed with exit code $exit_code"
    
    log_error "$error_message"
    send_notifications "failed" "$error_message"
    
    exit $exit_code
}

# Set up error handling
trap handle_error ERR

# Run main function
main "$@"