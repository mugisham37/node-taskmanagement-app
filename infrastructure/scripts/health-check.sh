#!/bin/bash

# Production Health Check Script
# Comprehensive health monitoring for all services

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
Production Health Check Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV       Target environment (production|staging) [default: production]
    -s, --service SERVICE       Specific service to check (api|web|admin|all) [default: all]
    -d, --detailed             Show detailed health information
    -c, --continuous           Run continuous monitoring (Ctrl+C to stop)
    -i, --interval SECONDS     Interval for continuous monitoring [default: 30]
    -o, --output FORMAT        Output format (text|json|prometheus) [default: text]
    -f, --file FILE            Output results to file
    -q, --quiet                Suppress non-error output
    -h, --help                 Show this help message

EXAMPLES:
    $0                                          # Check all services
    $0 --service api --detailed                # Detailed check for API only
    $0 --continuous --interval 60              # Continuous monitoring every 60 seconds
    $0 --output json --file health-report.json # JSON output to file

EOF
}

# Parse command line arguments
ENVIRONMENT="production"
SERVICE="all"
DETAILED=false
CONTINUOUS=false
INTERVAL=30
OUTPUT_FORMAT="text"
OUTPUT_FILE=""
QUIET=false

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
        -d|--detailed)
            DETAILED=true
            shift
            ;;
        -c|--continuous)
            CONTINUOUS=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -f|--file)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
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

if [[ "$OUTPUT_FORMAT" != "text" && "$OUTPUT_FORMAT" != "json" && "$OUTPUT_FORMAT" != "prometheus" ]]; then
    log_error "Invalid output format: $OUTPUT_FORMAT. Must be 'text', 'json', or 'prometheus'."
    exit 1
fi

# Global variables for health status
declare -A HEALTH_STATUS
declare -A HEALTH_DETAILS
OVERALL_HEALTH="healthy"

# Quiet logging
log_quiet() {
    if [[ "$QUIET" == "false" ]]; then
        log_info "$1"
    fi
}

# Check Kubernetes cluster connectivity
check_cluster_connectivity() {
    log_quiet "Checking Kubernetes cluster connectivity..."
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        OVERALL_HEALTH="unhealthy"
        return 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        OVERALL_HEALTH="unhealthy"
        return 1
    fi
    
    log_quiet "Cluster connectivity: OK"
    return 0
}

# Check service deployment health
check_deployment_health() {
    local service_name="$1"
    local deployment_name="taskmanagement-$service_name"
    
    log_quiet "Checking deployment health for $service_name..."
    
    if ! kubectl get deployment "$deployment_name" -n "$NAMESPACE" &> /dev/null; then
        HEALTH_STATUS["$service_name"]="not_found"
        HEALTH_DETAILS["$service_name"]="Deployment not found"
        log_error "$service_name deployment not found"
        OVERALL_HEALTH="unhealthy"
        return 1
    fi
    
    local ready_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
    local available_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")
    
    if [[ "$ready_replicas" == "$desired_replicas" && "$available_replicas" == "$desired_replicas" ]]; then
        HEALTH_STATUS["$service_name"]="healthy"
        HEALTH_DETAILS["$service_name"]="$ready_replicas/$desired_replicas replicas ready"
        log_success "$service_name deployment: $ready_replicas/$desired_replicas replicas ready"
    else
        HEALTH_STATUS["$service_name"]="unhealthy"
        HEALTH_DETAILS["$service_name"]="$ready_replicas/$desired_replicas replicas ready, $available_replicas available"
        log_error "$service_name deployment: $ready_replicas/$desired_replicas replicas ready, $available_replicas available"
        OVERALL_HEALTH="unhealthy"
        return 1
    fi
    
    return 0
}

# Check service HTTP health endpoints
check_http_health() {
    local service_name="$1"
    local health_url
    
    case "$service_name" in
        "api")
            if [[ "$ENVIRONMENT" == "production" ]]; then
                health_url="https://api.taskmanagement.com/health"
            else
                health_url="https://api-staging.taskmanagement.com/health"
            fi
            ;;
        "web")
            if [[ "$ENVIRONMENT" == "production" ]]; then
                health_url="https://taskmanagement.com/api/health"
            else
                health_url="https://staging.taskmanagement.com/api/health"
            fi
            ;;
        "admin")
            if [[ "$ENVIRONMENT" == "production" ]]; then
                health_url="https://admin.taskmanagement.com/api/health"
            else
                health_url="https://admin-staging.taskmanagement.com/api/health"
            fi
            ;;
    esac
    
    log_quiet "Checking HTTP health for $service_name at $health_url..."
    
    local response_code
    local response_time
    
    # Get response code and time
    if response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$health_url" 2>/dev/null); then
        response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$health_url" 2>/dev/null)
        
        if [[ "$response_code" == "200" ]]; then
            HEALTH_STATUS["${service_name}_http"]="healthy"
            HEALTH_DETAILS["${service_name}_http"]="HTTP 200, ${response_time}s response time"
            log_success "$service_name HTTP health: OK (${response_time}s)"
        else
            HEALTH_STATUS["${service_name}_http"]="unhealthy"
            HEALTH_DETAILS["${service_name}_http"]="HTTP $response_code, ${response_time}s response time"
            log_error "$service_name HTTP health: HTTP $response_code (${response_time}s)"
            OVERALL_HEALTH="unhealthy"
            return 1
        fi
    else
        HEALTH_STATUS["${service_name}_http"]="unhealthy"
        HEALTH_DETAILS["${service_name}_http"]="Connection failed or timeout"
        log_error "$service_name HTTP health: Connection failed or timeout"
        OVERALL_HEALTH="unhealthy"
        return 1
    fi
    
    return 0
}

# Check database connectivity
check_database_health() {
    log_quiet "Checking database connectivity..."
    
    # Create a temporary pod to test database connection
    local test_pod_name="db-health-check-$(date +%s)"
    
    kubectl run "$test_pod_name" \
        --image=postgres:15 \
        --restart=Never \
        --namespace="$NAMESPACE" \
        --env-from=secret/database-secret \
        --command -- sleep 60 &> /dev/null
    
    # Wait for pod to be ready
    kubectl wait --for=condition=Ready pod/"$test_pod_name" --namespace="$NAMESPACE" --timeout=30s &> /dev/null
    
    # Test database connection
    if kubectl exec "$test_pod_name" --namespace="$NAMESPACE" -- pg_isready -h "$DATABASE_HOST" -p 5432 &> /dev/null; then
        HEALTH_STATUS["database"]="healthy"
        HEALTH_DETAILS["database"]="Connection successful"
        log_success "Database health: OK"
    else
        HEALTH_STATUS["database"]="unhealthy"
        HEALTH_DETAILS["database"]="Connection failed"
        log_error "Database health: Connection failed"
        OVERALL_HEALTH="unhealthy"
    fi
    
    # Cleanup test pod
    kubectl delete pod "$test_pod_name" --namespace="$NAMESPACE" &> /dev/null || true
}

# Check Redis connectivity
check_redis_health() {
    log_quiet "Checking Redis connectivity..."
    
    # Create a temporary pod to test Redis connection
    local test_pod_name="redis-health-check-$(date +%s)"
    
    kubectl run "$test_pod_name" \
        --image=redis:7 \
        --restart=Never \
        --namespace="$NAMESPACE" \
        --env-from=secret/redis-secret \
        --command -- sleep 60 &> /dev/null
    
    # Wait for pod to be ready
    kubectl wait --for=condition=Ready pod/"$test_pod_name" --namespace="$NAMESPACE" --timeout=30s &> /dev/null
    
    # Test Redis connection
    if kubectl exec "$test_pod_name" --namespace="$NAMESPACE" -- redis-cli -h "$REDIS_HOST" -p 6379 ping &> /dev/null; then
        HEALTH_STATUS["redis"]="healthy"
        HEALTH_DETAILS["redis"]="Connection successful"
        log_success "Redis health: OK"
    else
        HEALTH_STATUS["redis"]="unhealthy"
        HEALTH_DETAILS["redis"]="Connection failed"
        log_error "Redis health: Connection failed"
        OVERALL_HEALTH="unhealthy"
    fi
    
    # Cleanup test pod
    kubectl delete pod "$test_pod_name" --namespace="$NAMESPACE" &> /dev/null || true
}

# Check resource usage
check_resource_usage() {
    local service_name="$1"
    local deployment_name="taskmanagement-$service_name"
    
    log_quiet "Checking resource usage for $service_name..."
    
    # Get pod metrics (requires metrics-server)
    local pods=$(kubectl get pods -n "$NAMESPACE" -l app="$deployment_name" -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -n "$pods" ]]; then
        local total_cpu=0
        local total_memory=0
        local pod_count=0
        
        for pod in $pods; do
            if kubectl top pod "$pod" -n "$NAMESPACE" &> /dev/null; then
                local cpu=$(kubectl top pod "$pod" -n "$NAMESPACE" --no-headers | awk '{print $2}' | sed 's/m//')
                local memory=$(kubectl top pod "$pod" -n "$NAMESPACE" --no-headers | awk '{print $3}' | sed 's/Mi//')
                
                total_cpu=$((total_cpu + cpu))
                total_memory=$((total_memory + memory))
                pod_count=$((pod_count + 1))
            fi
        done
        
        if [[ $pod_count -gt 0 ]]; then
            local avg_cpu=$((total_cpu / pod_count))
            local avg_memory=$((total_memory / pod_count))
            
            HEALTH_DETAILS["${service_name}_resources"]="Avg CPU: ${avg_cpu}m, Avg Memory: ${avg_memory}Mi"
            
            # Check if resource usage is within acceptable limits
            if [[ $avg_cpu -lt 800 && $avg_memory -lt 800 ]]; then
                log_success "$service_name resources: CPU ${avg_cpu}m, Memory ${avg_memory}Mi"
            else
                log_warning "$service_name resources: High usage - CPU ${avg_cpu}m, Memory ${avg_memory}Mi"
            fi
        fi
    fi
}

# Check detailed service information
check_detailed_info() {
    local service_name="$1"
    local deployment_name="taskmanagement-$service_name"
    
    if [[ "$DETAILED" == "true" ]]; then
        log_info "=== Detailed information for $service_name ==="
        
        # Deployment status
        kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o wide
        
        # Pod status
        kubectl get pods -n "$NAMESPACE" -l app="$deployment_name" -o wide
        
        # Recent events
        log_info "Recent events:"
        kubectl get events -n "$NAMESPACE" --field-selector involvedObject.name="$deployment_name" --sort-by='.lastTimestamp' | tail -5
        
        # Resource usage
        check_resource_usage "$service_name"
        
        echo
    fi
}

# Generate output in different formats
generate_output() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    case "$OUTPUT_FORMAT" in
        "json")
            cat << EOF
{
  "timestamp": "$timestamp",
  "environment": "$ENVIRONMENT",
  "overall_health": "$OVERALL_HEALTH",
  "services": {
EOF
            local first=true
            for service in "${!HEALTH_STATUS[@]}"; do
                if [[ "$first" == "true" ]]; then
                    first=false
                else
                    echo ","
                fi
                echo -n "    \"$service\": {
      \"status\": \"${HEALTH_STATUS[$service]}\",
      \"details\": \"${HEALTH_DETAILS[$service]}\"
    }"
            done
            echo
            echo "  }"
            echo "}"
            ;;
        "prometheus")
            echo "# HELP taskmanagement_service_health Service health status (1=healthy, 0=unhealthy)"
            echo "# TYPE taskmanagement_service_health gauge"
            for service in "${!HEALTH_STATUS[@]}"; do
                local value
                if [[ "${HEALTH_STATUS[$service]}" == "healthy" ]]; then
                    value=1
                else
                    value=0
                fi
                echo "taskmanagement_service_health{environment=\"$ENVIRONMENT\",service=\"$service\"} $value"
            done
            echo "# HELP taskmanagement_overall_health Overall system health (1=healthy, 0=unhealthy)"
            echo "# TYPE taskmanagement_overall_health gauge"
            local overall_value
            if [[ "$OVERALL_HEALTH" == "healthy" ]]; then
                overall_value=1
            else
                overall_value=0
            fi
            echo "taskmanagement_overall_health{environment=\"$ENVIRONMENT\"} $overall_value"
            ;;
        "text")
            echo "=== Health Check Report ==="
            echo "Timestamp: $timestamp"
            echo "Environment: $ENVIRONMENT"
            echo "Overall Health: $OVERALL_HEALTH"
            echo
            echo "Service Status:"
            for service in "${!HEALTH_STATUS[@]}"; do
                local status_icon
                if [[ "${HEALTH_STATUS[$service]}" == "healthy" ]]; then
                    status_icon="✅"
                else
                    status_icon="❌"
                fi
                echo "  $status_icon $service: ${HEALTH_STATUS[$service]} - ${HEALTH_DETAILS[$service]}"
            done
            ;;
    esac
}

# Write output to file if specified
write_output() {
    local output=$(generate_output)
    
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$output" > "$OUTPUT_FILE"
        log_quiet "Results written to $OUTPUT_FILE"
    else
        echo "$output"
    fi
}

# Perform health checks for a single service
check_service_health() {
    local service_name="$1"
    
    # Reset health status for this service
    HEALTH_STATUS["$service_name"]="unknown"
    HEALTH_DETAILS["$service_name"]="Not checked"
    
    # Check deployment health
    check_deployment_health "$service_name"
    
    # Check HTTP health
    check_http_health "$service_name"
    
    # Check detailed info if requested
    check_detailed_info "$service_name"
}

# Main health check function
perform_health_check() {
    local check_timestamp=$(date)
    
    if [[ "$QUIET" == "false" ]]; then
        log_info "Starting health check at $check_timestamp"
        log_info "Environment: $ENVIRONMENT"
        log_info "Service: $SERVICE"
    fi
    
    # Reset overall health status
    OVERALL_HEALTH="healthy"
    
    # Check cluster connectivity
    check_cluster_connectivity
    
    # Check infrastructure services
    if [[ "$SERVICE" == "all" ]]; then
        check_database_health
        check_redis_health
    fi
    
    # Check application services
    if [[ "$SERVICE" == "all" ]]; then
        local services=("api" "web" "admin")
        for service in "${services[@]}"; do
            check_service_health "$service"
        done
    else
        check_service_health "$SERVICE"
    fi
    
    # Generate and output results
    write_output
    
    # Return appropriate exit code
    if [[ "$OVERALL_HEALTH" == "healthy" ]]; then
        return 0
    else
        return 1
    fi
}

# Continuous monitoring mode
continuous_monitoring() {
    log_info "Starting continuous monitoring (interval: ${INTERVAL}s)"
    log_info "Press Ctrl+C to stop"
    
    while true; do
        perform_health_check
        sleep "$INTERVAL"
        echo "---"
    done
}

# Signal handler for graceful shutdown
cleanup() {
    log_info "Stopping health check monitoring..."
    exit 0
}

# Main function
main() {
    # Set up signal handler
    trap cleanup SIGINT SIGTERM
    
    if [[ "$CONTINUOUS" == "true" ]]; then
        continuous_monitoring
    else
        perform_health_check
    fi
}

# Run main function
main "$@"