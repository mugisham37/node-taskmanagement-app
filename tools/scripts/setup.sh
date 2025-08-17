#!/bin/bash

# Task Management App - Development Environment Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Task Management App development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Check if pnpm is installed
check_pnpm() {
    print_status "Checking pnpm installation..."
    if ! command -v pnpm &> /dev/null; then
        print_warning "pnpm is not installed. Installing pnpm..."
        npm install -g pnpm
    fi
    print_success "pnpm $(pnpm --version) is available"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Some features may not work."
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        print_warning "Docker daemon is not running. Please start Docker."
        return 1
    fi
    
    print_success "Docker is installed and running"
    return 0
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    pnpm install
    print_success "Dependencies installed successfully"
}

# Setup environment files
setup_env_files() {
    print_status "Setting up environment files..."
    
    # Root environment file
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Created root .env file"
    else
        print_warning "Root .env file already exists"
    fi
    
    # API environment file
    if [ ! -f "apps/api/.env" ]; then
        cp apps/api/.env.example apps/api/.env 2>/dev/null || echo "# API Environment Variables" > apps/api/.env
        print_success "Created API .env file"
    else
        print_warning "API .env file already exists"
    fi
    
    # Web environment file
    if [ ! -f "apps/web/.env.local" ]; then
        echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > apps/web/.env.local
        echo "NEXT_PUBLIC_WS_URL=ws://localhost:4000" >> apps/web/.env.local
        print_success "Created Web .env.local file"
    else
        print_warning "Web .env.local file already exists"
    fi
    
    # Admin environment file
    if [ ! -f "apps/admin/.env.local" ]; then
        echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > apps/admin/.env.local
        echo "NEXT_PUBLIC_WS_URL=ws://localhost:4000" >> apps/admin/.env.local
        print_success "Created Admin .env.local file"
    else
        print_warning "Admin .env.local file already exists"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    if check_docker; then
        # Start PostgreSQL container
        docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d postgres redis
        
        # Wait for database to be ready
        print_status "Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        pnpm --filter @taskmanagement/database run migrate
        
        # Seed database
        pnpm --filter @taskmanagement/database run seed
        
        print_success "Database setup completed"
    else
        print_warning "Docker not available. Please setup database manually."
        print_warning "Database URL should be: postgresql://taskmanagement:password@localhost:5432/taskmanagement"
    fi
}

# Build packages
build_packages() {
    print_status "Building shared packages..."
    pnpm run build:packages
    print_success "Shared packages built successfully"
}

# Setup Git hooks
setup_git_hooks() {
    print_status "Setting up Git hooks..."
    
    if [ -d ".git" ]; then
        pnpm exec husky install
        pnpm exec husky add .husky/pre-commit "pnpm exec lint-staged"
        pnpm exec husky add .husky/commit-msg "pnpm exec commitlint --edit \$1"
        print_success "Git hooks setup completed"
    else
        print_warning "Not a Git repository. Skipping Git hooks setup."
    fi
}

# Verify setup
verify_setup() {
    print_status "Verifying setup..."
    
    # Check if packages build successfully
    if pnpm run type-check; then
        print_success "TypeScript compilation successful"
    else
        print_error "TypeScript compilation failed"
        return 1
    fi
    
    # Check if linting passes
    if pnpm run lint; then
        print_success "Linting passed"
    else
        print_warning "Linting issues found. Run 'pnpm run lint:fix' to fix them."
    fi
    
    # Check if tests pass
    if pnpm run test:unit; then
        print_success "Unit tests passed"
    else
        print_warning "Some unit tests failed"
    fi
}

# Main setup function
main() {
    echo "=========================================="
    echo "  Task Management App Setup"
    echo "=========================================="
    
    check_node
    check_pnpm
    install_dependencies
    setup_env_files
    build_packages
    setup_database
    setup_git_hooks
    verify_setup
    
    echo ""
    echo "=========================================="
    print_success "Setup completed successfully! 🎉"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Start the development servers:"
    echo "   pnpm run dev"
    echo ""
    echo "2. Open the applications:"
    echo "   - API: http://localhost:4000"
    echo "   - Web: http://localhost:3000"
    echo "   - Admin: http://localhost:3001"
    echo ""
    echo "3. View documentation:"
    echo "   - API Docs: http://localhost:4000/docs"
    echo "   - Storybook: pnpm run storybook"
    echo ""
    echo "Happy coding! 🚀"
}

# Run main function
main "$@"