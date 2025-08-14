#!/bin/bash

# Task Management System Deployment Script
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}

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

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        development|staging|production)
            log_info "Deploying to $ENVIRONMENT environment"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]]; then
        log_error "Environment file .env.$ENVIRONMENT not found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Load environment variables
load_environment() {
    log_info "Loading environment variables for $ENVIRONMENT..."
    
    # Copy environment file
    cp "$PROJECT_ROOT/.env.$ENVIRONMENT" "$PROJECT_ROOT/.env"
    
    # Source environment variables
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
    
    log_success "Environment variables loaded"
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Build Docker image
    docker build -t "task-management-system:$VERSION" .
    
    # Tag as latest for the environment
    docker tag "task-management-system:$VERSION" "task-management-system:$ENVIRONMENT-latest"
    
    log_success "Application built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Check if database is accessible
    if ! docker-compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        log_warning "Database not ready, starting database services..."
        docker-compose up -d postgres redis
        
        # Wait for database to be ready
        local retries=30
        while ! docker-compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null && [ $retries -gt 0 ]; do
            log_info "Waiting for database... ($retries retries left)"
            sleep 2
            retries=$((retries - 1))
        done
        
        if [ $retries -eq 0 ]; then
            log_error "Database failed to start"
            exit 1
        fi
    fi
    
    # Run migrations
    npm run db:migrate
    
    log_success "Database migrations completed"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    
    cd "$PROJECT_ROOT"
    
    # Choose the appropriate docker-compose file
    local compose_file="docker-compose.yml"
    if [[ "$ENVIRONMENT" == "development" ]]; then
        compose_file="docker-compose.dev.yml"
    fi
    
    # Stop existing services
    docker-compose -f "$compose_file" down
    
    # Start services
    docker-compose -f "$compose_file" up -d
    
    log_success "Services deployed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:${PORT:-3000}/health" > /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old versions (keep last 3)
    docker images "task-management-system" --format "table {{.Tag}}\t{{.ID}}" | \
        grep -v "latest\|$VERSION" | \
        tail -n +4 | \
        awk '{print $2}' | \
        xargs -r docker rmi
    
    log_success "Cleanup completed"
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop current services
    docker-compose down
    
    # Start with previous version
    docker-compose up -d
    
    log_info "Rollback completed"
}

# Main deployment function
main() {
    log_info "Starting deployment of Task Management System"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    
    # Trap errors for rollback
    trap 'log_error "Deployment failed"; rollback; exit 1' ERR
    
    validate_environment
    check_prerequisites
    load_environment
    build_application
    run_migrations
    deploy_services
    
    # Wait a bit for services to start
    sleep 10
    
    if health_check; then
        cleanup
        log_success "Deployment completed successfully!"
        log_info "Application is running at http://localhost:${PORT:-3000}"
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            log_info "Monitoring dashboard: http://localhost:3001"
            log_info "Metrics endpoint: http://localhost:9090"
        fi
    else
        log_error "Deployment failed health check"
        rollback
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [environment] [version]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (development|staging|production) [default: production]"
    echo "  version        Application version tag [default: latest]"
    echo ""
    echo "Examples:"
    echo "  $0 production v1.0.0"
    echo "  $0 staging"
    echo "  $0 development"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    *)
        main
        ;;
esac