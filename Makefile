# Task Management Monolith - Development Makefile

.PHONY: help install dev build test clean docker-up docker-down setup-env

# Default target
help: ## Show this help message
	@echo "Task Management Monolith - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Setup
install: ## Install all dependencies
	@echo "Installing dependencies..."
	npm install
	@echo "Setting up git hooks..."
	npm run prepare

setup-env: ## Set up environment files
	@echo "Setting up environment files..."
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "Created .env.local from .env.example"; \
		echo "Please edit .env.local with your configuration"; \
	else \
		echo ".env.local already exists"; \
	fi

setup: install setup-env docker-up ## Complete development setup
	@echo "Waiting for services to be ready..."
	sleep 10
	@echo "Running database migrations..."
	npm run db:migrate
	@echo "Seeding database..."
	npm run db:seed
	@echo ""
	@echo "🎉 Setup complete! You can now run 'make dev' to start development"

# Development
dev: ## Start development servers
	@echo "Starting development servers..."
	npm run dev

build: ## Build all applications and packages
	@echo "Building all applications and packages..."
	npm run build

clean: ## Clean build artifacts and node_modules
	@echo "Cleaning build artifacts..."
	npm run clean

# Testing
test: ## Run all tests
	@echo "Running all tests..."
	npm run test

test-unit: ## Run unit tests
	@echo "Running unit tests..."
	npm run test:unit

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	npm run test:integration

test-e2e: ## Run end-to-end tests
	@echo "Running end-to-end tests..."
	npm run test:e2e

test-coverage: ## Generate test coverage report
	@echo "Generating test coverage report..."
	npm run test:coverage

# Code Quality
lint: ## Run linting
	@echo "Running ESLint..."
	npm run lint

lint-fix: ## Fix linting issues
	@echo "Fixing ESLint issues..."
	npm run lint:fix

format: ## Format code with Prettier
	@echo "Formatting code with Prettier..."
	npm run format

format-check: ## Check code formatting
	@echo "Checking code formatting..."
	npm run format:check

type-check: ## Run TypeScript type checking
	@echo "Running TypeScript type checking..."
	npm run type-check

# Database
db-generate: ## Generate database schema
	@echo "Generating database schema..."
	npm run db:generate

db-migrate: ## Run database migrations
	@echo "Running database migrations..."
	npm run db:migrate

db-seed: ## Seed database with sample data
	@echo "Seeding database..."
	npm run db:seed

db-reset: ## Reset database (drop and recreate)
	@echo "Resetting database..."
	npm run db:reset

# Docker Services
docker-up: ## Start Docker services (database, redis, etc.)
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5

docker-down: ## Stop Docker services
	@echo "Stopping Docker services..."
	docker-compose down

docker-logs: ## Show Docker service logs
	@echo "Showing Docker service logs..."
	docker-compose logs -f

docker-clean: ## Clean Docker containers and volumes
	@echo "Cleaning Docker containers and volumes..."
	docker-compose down -v
	docker system prune -f

# Infrastructure
k8s-deploy: ## Deploy to Kubernetes
	@echo "Deploying to Kubernetes..."
	npm run k8s:deploy

monitoring-up: ## Start monitoring stack
	@echo "Starting monitoring stack..."
	npm run monitoring:up

# Documentation
docs-build: ## Build documentation
	@echo "Building documentation..."
	npm run docs:build

docs-dev: ## Start documentation development server
	@echo "Starting documentation development server..."
	npm run docs:dev

# Release
release: ## Create a new release
	@echo "Creating a new release..."
	npm run changeset
	npm run version-packages
	npm run release

# Health Checks
health-check: ## Check service health
	@echo "Checking service health..."
	@echo "Database:"
	@docker-compose exec postgres pg_isready -U taskmanagement -d taskmanagement || echo "❌ Database not ready"
	@echo "Redis:"
	@docker-compose exec redis redis-cli ping || echo "❌ Redis not ready"
	@echo "MinIO:"
	@curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1 && echo "✅ MinIO ready" || echo "❌ MinIO not ready"

# Utilities
logs: ## Show application logs
	@echo "Showing application logs..."
	@if [ -f logs/app.log ]; then tail -f logs/app.log; else echo "No log file found"; fi

ps: ## Show running processes
	@echo "Docker services:"
	@docker-compose ps
	@echo ""
	@echo "Node processes:"
	@ps aux | grep node | grep -v grep || echo "No Node processes found"

# Security
security-audit: ## Run security audit
	@echo "Running security audit..."
	npm audit
	@echo "Running dependency check..."
	npm run security:check || echo "Security check not configured yet"

# Performance
perf-test: ## Run performance tests
	@echo "Running performance tests..."
	npm run test:performance || echo "Performance tests not configured yet"

# Backup
backup-db: ## Backup database
	@echo "Backing up database..."
	@mkdir -p backups
	@docker-compose exec postgres pg_dump -U taskmanagement taskmanagement > backups/db-backup-$(shell date +%Y%m%d-%H%M%S).sql
	@echo "Database backup created in backups/"

restore-db: ## Restore database from backup (usage: make restore-db BACKUP=filename)
	@echo "Restoring database from backup..."
	@if [ -z "$(BACKUP)" ]; then echo "Usage: make restore-db BACKUP=filename"; exit 1; fi
	@docker-compose exec -T postgres psql -U taskmanagement -d taskmanagement < backups/$(BACKUP)
	@echo "Database restored from $(BACKUP)"