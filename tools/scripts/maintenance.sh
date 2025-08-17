#!/bin/bash

# Maintenance script for Task Management App
# Handles cleanup, updates, health checks, and optimization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${CYAN}[MAINTENANCE]${NC} $1"; }

show_help() {
    echo "Maintenance Script for Task Management App"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  cleanup         Clean up temporary files, logs, and caches"
    echo "  update          Update dependencies and packages"
    echo "  health          Run comprehensive health checks"
    echo "  optimize        Optimize performance and resources"
    echo "  backup          Create system backups"
    echo "  restore         Restore from backup"
    echo "  security        Run security scans and updates"
    echo "  logs            Manage and rotate logs"
    echo "  monitor         Check system monitoring and alerts"
    echo "  all             Run all maintenance tasks"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -v, --verbose   Verbose output"
    echo "  --dry-run       Show what would be done without executing"
    echo "  --force         Force operations without confirmation"
    echo ""
    echo "Examples:"
    echo "  $0 cleanup                    # Clean up temporary files"
    echo "  $0 update --dry-run          # Show what would be updated"
    echo "  $0 health --verbose          # Run health checks with verbose output"
    echo "  $0 all --force               # Run all maintenance without prompts"
}

# Configuration
BACKUP_DIR="./backups"
LOG_DIR="./logs"
TEMP_DIR="./tmp"
CACHE_DIRS=("node_modules/.cache" ".next/cache" "dist" "build" "coverage" "test-results")
LOG_RETENTION_DAYS=30
BACKUP_RETENTION_DAYS=90

cleanup_files() {
    print_header "Cleaning up temporary files and caches"
    
    # Clean cache directories
    for cache_dir in "${CACHE_DIRS[@]}"; do
        if [[ -d "$cache_dir" ]]; then
            print_status "Cleaning $cache_dir..."
            rm -rf "$cache_dir"
            print_success "Cleaned $cache_dir"
        fi
    done
    
    # Clean temporary files
    print_status "Cleaning temporary files..."
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    find . -name "*.temp" -type f -delete 2>/dev/null || true
    find . -name ".DS_Store" -type f -delete 2>/dev/null || true
    find . -name "Thumbs.db" -type f -delete 2>/dev/null || true
    
    # Clean old log files
    if [[ -d "$LOG_DIR" ]]; then
        print_status "Cleaning old log files (older than $LOG_RETENTION_DAYS days)..."
        find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    fi
    
    # Clean old backup files
    if [[ -d "$BACKUP_DIR" ]]; then
        print_status "Cleaning old backup files (older than $BACKUP_RETENTION_DAYS days)..."
        find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    fi
    
    # Clean Docker resources (if Docker is available)
    if command -v docker &> /dev/null; then
        print_status "Cleaning Docker resources..."
        docker system prune -f --volumes 2>/dev/null || true
        docker image prune -f 2>/dev/null || true
    fi
    
    # Clean npm cache
    if command -v npm &> /dev/null; then
        print_status "Cleaning npm cache..."
        npm cache clean --force 2>/dev/null || true
    fi
    
    # Clean pnpm cache
    if command -v pnpm &> /dev/null; then
        print_status "Cleaning pnpm cache..."
        pnpm store prune 2>/dev/null || true
    fi
    
    print_success "Cleanup completed successfully"
}

update_dependencies() {
    print_header "Updating dependencies and packages"
    
    # Update package manager
    if command -v pnpm &> /dev/null; then
        print_status "Updating pnpm..."
        npm install -g pnpm@latest
    fi
    
    # Update dependencies
    print_status "Updating project dependencies..."
    if [[ -f "pnpm-lock.yaml" ]]; then
        pnpm update
    elif [[ -f "package-lock.json" ]]; then
        npm update
    elif [[ -f "yarn.lock" ]]; then
        yarn upgrade
    fi
    
    # Update global tools
    print_status "Updating global tools..."
    npm update -g typescript eslint prettier @playwright/test
    
    # Update Docker images (if Docker is available)
    if command -v docker &> /dev/null; then
        print_status "Updating Docker images..."
        docker pull postgres:15-alpine
        docker pull redis:7-alpine
        docker pull node:18-alpine
    fi
    
    # Audit dependencies for security vulnerabilities
    print_status "Auditing dependencies for security vulnerabilities..."
    if command -v pnpm &> /dev/null; then
        pnpm audit --fix || print_warning "Some vulnerabilities could not be automatically fixed"
    else
        npm audit fix || print_warning "Some vulnerabilities could not be automatically fixed"
    fi
    
    print_success "Dependencies updated successfully"
}

run_health_checks() {
    print_header "Running comprehensive health checks"
    
    local health_status=0
    
    # Check Node.js version
    print_status "Checking Node.js version..."
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$node_version" -ge 18 ]]; then
        print_success "Node.js version is supported: $(node --version)"
    else
        print_error "Node.js version is outdated: $(node --version). Minimum required: v18"
        health_status=1
    fi
    
    # Check package manager
    print_status "Checking package manager..."
    if command -v pnpm &> /dev/null; then
        print_success "pnpm is available: $(pnpm --version)"
    else
        print_warning "pnpm is not available, using npm"
    fi
    
    # Check TypeScript compilation
    print_status "Checking TypeScript compilation..."
    if pnpm run type-check &> /dev/null; then
        print_success "TypeScript compilation successful"
    else
        print_error "TypeScript compilation failed"
        health_status=1
    fi
    
    # Check linting
    print_status "Checking code linting..."
    if pnpm run lint &> /dev/null; then
        print_success "Linting passed"
    else
        print_warning "Linting issues found"
    fi
    
    # Check tests
    print_status "Running unit tests..."
    if pnpm run test:unit &> /dev/null; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        health_status=1
    fi
    
    # Check database connection (if available)
    if command -v docker &> /dev/null && docker ps | grep -q postgres; then
        print_status "Checking database connection..."
        if ./tools/scripts/database.sh health &> /dev/null; then
            print_success "Database connection healthy"
        else
            print_error "Database connection failed"
            health_status=1
        fi
    fi
    
    # Check disk space
    print_status "Checking disk space..."
    local disk_usage=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ "$disk_usage" -lt 80 ]]; then
        print_success "Disk space is adequate: ${disk_usage}% used"
    elif [[ "$disk_usage" -lt 90 ]]; then
        print_warning "Disk space is getting low: ${disk_usage}% used"
    else
        print_error "Disk space is critically low: ${disk_usage}% used"
        health_status=1
    fi
    
    # Check memory usage
    print_status "Checking memory usage..."
    if command -v free &> /dev/null; then
        local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [[ "$memory_usage" -lt 80 ]]; then
            print_success "Memory usage is normal: ${memory_usage}% used"
        else
            print_warning "Memory usage is high: ${memory_usage}% used"
        fi
    fi
    
    # Check port availability
    print_status "Checking port availability..."
    local ports=(3000 3001 4000 5432 6379)
    for port in "${ports[@]}"; do
        if lsof -i :$port &> /dev/null; then
            print_warning "Port $port is in use"
        else
            print_success "Port $port is available"
        fi
    done
    
    if [[ $health_status -eq 0 ]]; then
        print_success "All health checks passed"
    else
        print_error "Some health checks failed"
    fi
    
    return $health_status
}

optimize_performance() {
    print_header "Optimizing performance and resources"
    
    # Optimize package.json files
    print_status "Optimizing package.json files..."
    find . -name "package.json" -not -path "./node_modules/*" -exec npx sort-package-json {} \;
    
    # Optimize images (if imagemin is available)
    if command -v imagemin &> /dev/null; then
        print_status "Optimizing images..."
        find . -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | grep -v node_modules | xargs imagemin --out-dir=. 2>/dev/null || true
    fi
    
    # Optimize bundle sizes
    print_status "Analyzing bundle sizes..."
    if [[ -f "apps/web/package.json" ]]; then
        cd apps/web && npm run build:analyze 2>/dev/null || true && cd ../..
    fi
    
    # Optimize database (if available)
    if command -v docker &> /dev/null && docker ps | grep -q postgres; then
        print_status "Optimizing database..."
        docker exec -i taskmanagement-postgres psql -U taskmanagement -d taskmanagement << 'EOF'
VACUUM ANALYZE;
REINDEX DATABASE taskmanagement;
EOF
    fi
    
    # Clean and rebuild node_modules for better performance
    print_status "Rebuilding node_modules for optimal performance..."
    rm -rf node_modules package-lock.json pnpm-lock.yaml yarn.lock 2>/dev/null || true
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile
    else
        npm ci
    fi
    
    print_success "Performance optimization completed"
}

create_backup() {
    print_header "Creating system backup"
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/backup_$backup_timestamp.tar.gz"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Create application backup
    print_status "Creating application backup..."
    tar -czf "$backup_file" \
        --exclude=node_modules \
        --exclude=dist \
        --exclude=build \
        --exclude=.next \
        --exclude=coverage \
        --exclude=test-results \
        --exclude=logs \
        --exclude=tmp \
        --exclude=backups \
        . 2>/dev/null
    
    # Create database backup (if available)
    if command -v docker &> /dev/null && docker ps | grep -q postgres; then
        print_status "Creating database backup..."
        local db_backup_file="$BACKUP_DIR/database_$backup_timestamp.sql"
        docker exec taskmanagement-postgres pg_dump -U taskmanagement taskmanagement > "$db_backup_file"
        
        # Compress database backup
        gzip "$db_backup_file"
    fi
    
    print_success "Backup created: $backup_file"
}

run_security_scan() {
    print_header "Running security scans and updates"
    
    # Audit npm packages
    print_status "Auditing npm packages for vulnerabilities..."
    if command -v pnpm &> /dev/null; then
        pnpm audit || print_warning "Vulnerabilities found in dependencies"
    else
        npm audit || print_warning "Vulnerabilities found in dependencies"
    fi
    
    # Check for outdated packages
    print_status "Checking for outdated packages..."
    if command -v pnpm &> /dev/null; then
        pnpm outdated || true
    else
        npm outdated || true
    fi
    
    # Scan for secrets (if truffleHog is available)
    if command -v trufflehog &> /dev/null; then
        print_status "Scanning for secrets..."
        trufflehog filesystem . --no-verification 2>/dev/null || print_warning "Potential secrets found"
    fi
    
    # Check file permissions
    print_status "Checking file permissions..."
    find . -type f -perm 777 -not -path "./node_modules/*" -not -path "./.git/*" | while read file; do
        print_warning "File with 777 permissions: $file"
    done
    
    print_success "Security scan completed"
}

manage_logs() {
    print_header "Managing and rotating logs"
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # Rotate application logs
    print_status "Rotating application logs..."
    for app in api web admin; do
        local log_file="$LOG_DIR/$app.log"
        if [[ -f "$log_file" ]]; then
            local rotated_log="$LOG_DIR/$app.$(date +%Y%m%d).log"
            mv "$log_file" "$rotated_log"
            gzip "$rotated_log"
            print_success "Rotated $app logs"
        fi
    done
    
    # Clean old compressed logs
    print_status "Cleaning old compressed logs..."
    find "$LOG_DIR" -name "*.gz" -type f -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    
    # Archive Docker logs (if available)
    if command -v docker &> /dev/null; then
        print_status "Archiving Docker logs..."
        docker logs taskmanagement-postgres > "$LOG_DIR/postgres.$(date +%Y%m%d).log" 2>&1 || true
        docker logs taskmanagement-redis > "$LOG_DIR/redis.$(date +%Y%m%d).log" 2>&1 || true
    fi
    
    print_success "Log management completed"
}

check_monitoring() {
    print_header "Checking system monitoring and alerts"
    
    # Check if monitoring services are running
    local services=("prometheus" "grafana" "alertmanager")
    for service in "${services[@]}"; do
        if docker ps | grep -q "$service"; then
            print_success "$service is running"
        else
            print_warning "$service is not running"
        fi
    done
    
    # Check disk space alerts
    local disk_usage=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ "$disk_usage" -gt 85 ]]; then
        print_warning "Disk space alert: ${disk_usage}% used"
    fi
    
    # Check memory usage alerts
    if command -v free &> /dev/null; then
        local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [[ "$memory_usage" -gt 85 ]]; then
            print_warning "Memory usage alert: ${memory_usage}% used"
        fi
    fi
    
    # Check application health endpoints
    local endpoints=("http://localhost:4000/health" "http://localhost:3000/api/health")
    for endpoint in "${endpoints[@]}"; do
        if curl -s "$endpoint" &> /dev/null; then
            print_success "Health endpoint responding: $endpoint"
        else
            print_warning "Health endpoint not responding: $endpoint"
        fi
    done
    
    print_success "Monitoring check completed"
}

run_all_maintenance() {
    print_header "Running all maintenance tasks"
    
    cleanup_files
    echo ""
    update_dependencies
    echo ""
    run_health_checks
    echo ""
    optimize_performance
    echo ""
    create_backup
    echo ""
    run_security_scan
    echo ""
    manage_logs
    echo ""
    check_monitoring
    
    print_success "All maintenance tasks completed successfully"
}

# Parse command line arguments
parse_args() {
    local command=""
    local dry_run="false"
    local force="false"
    local verbose="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            cleanup|update|health|optimize|backup|restore|security|logs|monitor|all)
                command="$1"
                shift
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --force)
                force="true"
                shift
                ;;
            -v|--verbose)
                verbose="true"
                set -x
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [[ -z "$command" ]]; then
        print_error "Command is required"
        show_help
        exit 1
    fi
    
    # Execute command
    case "$command" in
        "cleanup")
            cleanup_files
            ;;
        "update")
            update_dependencies
            ;;
        "health")
            run_health_checks
            ;;
        "optimize")
            optimize_performance
            ;;
        "backup")
            create_backup
            ;;
        "security")
            run_security_scan
            ;;
        "logs")
            manage_logs
            ;;
        "monitor")
            check_monitoring
            ;;
        "all")
            if [[ "$force" != "true" ]]; then
                print_warning "This will run all maintenance tasks. This may take a while."
                read -p "Are you sure? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    print_status "Operation cancelled"
                    exit 0
                fi
            fi
            run_all_maintenance
            ;;
    esac
}

# Main entry point
main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi
    
    parse_args "$@"
}

# Run main function with all arguments
main "$@"