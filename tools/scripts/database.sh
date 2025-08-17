#!/bin/bash

# Database management script for Task Management App

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
DB_CONTAINER="taskmanagement-postgres"
REDIS_CONTAINER="taskmanagement-redis"
DB_NAME="taskmanagement"
DB_USER="taskmanagement"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

# Database URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

show_help() {
    echo "Database Management Script for Task Management App"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start           Start database containers"
    echo "  stop            Stop database containers"
    echo "  restart         Restart database containers"
    echo "  status          Show database container status"
    echo "  logs            Show database logs"
    echo "  migrate         Run database migrations"
    echo "  migrate:reset   Reset and re-run all migrations"
    echo "  migrate:rollback Rollback last migration"
    echo "  seed            Seed database with sample data"
    echo "  seed:reset      Reset and re-seed database"
    echo "  backup          Create database backup"
    echo "  restore         Restore database from backup"
    echo "  shell           Open database shell"
    echo "  clean           Clean database (drop all tables)"
    echo "  reset           Full reset (clean + migrate + seed)"
    echo "  health          Check database health"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -v, --verbose   Verbose output"
    echo "  --prod          Use production database"
    echo "  --staging       Use staging database"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start database containers"
    echo "  $0 migrate                  # Run migrations"
    echo "  $0 backup --prod           # Backup production database"
    echo "  $0 restore backup.sql      # Restore from backup file"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
}

start_containers() {
    print_status "Starting database containers..."
    
    # Check if containers are already running
    if docker ps | grep -q $DB_CONTAINER; then
        print_warning "PostgreSQL container is already running"
    else
        docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d postgres
        print_success "PostgreSQL container started"
    fi
    
    if docker ps | grep -q $REDIS_CONTAINER; then
        print_warning "Redis container is already running"
    else
        docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d redis
        print_success "Redis container started"
    fi
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker exec $DB_CONTAINER pg_isready -U $DB_USER -d $DB_NAME &> /dev/null; then
            print_success "Database is ready"
            return 0
        fi
        sleep 1
    done
    
    print_error "Database failed to start within 30 seconds"
    exit 1
}

stop_containers() {
    print_status "Stopping database containers..."
    docker-compose -f infrastructure/docker/docker-compose.dev.yml stop postgres redis
    print_success "Database containers stopped"
}

restart_containers() {
    print_status "Restarting database containers..."
    stop_containers
    start_containers
}

show_status() {
    print_status "Database container status:"
    echo ""
    docker ps -a --filter "name=$DB_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    docker ps -a --filter "name=$REDIS_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

show_logs() {
    print_status "Database logs:"
    docker logs -f $DB_CONTAINER
}

run_migrations() {
    print_status "Running database migrations..."
    
    # Ensure database is running
    if ! docker ps | grep -q $DB_CONTAINER; then
        print_warning "Database container is not running. Starting it..."
        start_containers
    fi
    
    # Run migrations using the database package
    cd packages/database
    pnpm run migrate
    cd ../..
    
    print_success "Migrations completed"
}

reset_migrations() {
    print_status "Resetting and re-running migrations..."
    
    # Drop all tables
    docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME << 'EOF'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO taskmanagement;
GRANT ALL ON SCHEMA public TO public;
EOF
    
    # Run migrations
    run_migrations
    
    print_success "Migration reset completed"
}

rollback_migration() {
    print_status "Rolling back last migration..."
    
    cd packages/database
    pnpm run migrate:rollback
    cd ../..
    
    print_success "Migration rollback completed"
}

seed_database() {
    print_status "Seeding database with sample data..."
    
    cd packages/database
    pnpm run seed
    cd ../..
    
    print_success "Database seeding completed"
}

reset_seed() {
    print_status "Resetting and re-seeding database..."
    
    # Clear existing data (keep schema)
    docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME << 'EOF'
TRUNCATE TABLE tasks, projects, workspaces, users CASCADE;
EOF
    
    # Seed database
    seed_database
    
    print_success "Database seed reset completed"
}

backup_database() {
    local backup_file="${1:-backup_$(date +%Y%m%d_%H%M%S).sql}"
    
    print_status "Creating database backup: $backup_file"
    
    docker exec $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME > "$backup_file"
    
    print_success "Database backup created: $backup_file"
}

restore_database() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Backup file not specified"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_status "Restoring database from: $backup_file"
    
    # Drop and recreate database
    docker exec -i $DB_CONTAINER psql -U $DB_USER -d postgres << EOF
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
EOF
    
    # Restore from backup
    docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < "$backup_file"
    
    print_success "Database restored from: $backup_file"
}

open_shell() {
    print_status "Opening database shell..."
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
}

clean_database() {
    print_warning "This will delete all data in the database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning database..."
        
        docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME << 'EOF'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO taskmanagement;
GRANT ALL ON SCHEMA public TO public;
EOF
        
        print_success "Database cleaned"
    else
        print_status "Operation cancelled"
    fi
}

reset_database() {
    print_warning "This will completely reset the database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting database..."
        clean_database
        run_migrations
        seed_database
        print_success "Database reset completed"
    else
        print_status "Operation cancelled"
    fi
}

check_health() {
    print_status "Checking database health..."
    
    # Check PostgreSQL
    if docker exec $DB_CONTAINER pg_isready -U $DB_USER -d $DB_NAME &> /dev/null; then
        print_success "PostgreSQL is healthy"
    else
        print_error "PostgreSQL is not responding"
        return 1
    fi
    
    # Check Redis
    if docker exec $REDIS_CONTAINER redis-cli ping | grep -q "PONG"; then
        print_success "Redis is healthy"
    else
        print_error "Redis is not responding"
        return 1
    fi
    
    # Check database connection from app
    if cd packages/database && pnpm run health-check; then
        print_success "Application can connect to database"
    else
        print_error "Application cannot connect to database"
        return 1
    fi
    
    print_success "All database services are healthy"
}

# Main script logic
main() {
    local command="$1"
    shift || true
    
    case "$command" in
        "start")
            check_docker
            start_containers
            ;;
        "stop")
            check_docker
            stop_containers
            ;;
        "restart")
            check_docker
            restart_containers
            ;;
        "status")
            check_docker
            show_status
            ;;
        "logs")
            check_docker
            show_logs
            ;;
        "migrate")
            check_docker
            run_migrations
            ;;
        "migrate:reset")
            check_docker
            reset_migrations
            ;;
        "migrate:rollback")
            check_docker
            rollback_migration
            ;;
        "seed")
            check_docker
            seed_database
            ;;
        "seed:reset")
            check_docker
            reset_seed
            ;;
        "backup")
            check_docker
            backup_database "$@"
            ;;
        "restore")
            check_docker
            restore_database "$@"
            ;;
        "shell")
            check_docker
            open_shell
            ;;
        "clean")
            check_docker
            clean_database
            ;;
        "reset")
            check_docker
            reset_database
            ;;
        "health")
            check_docker
            check_health
            ;;
        "-h"|"--help"|"help"|"")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"