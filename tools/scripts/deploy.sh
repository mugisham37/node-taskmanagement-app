#!/bin/bash

# Deployment script for Task Management App

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
print_header() { echo -e "${CYAN}[DEPLOY]${NC} $1"; }

# Configuration
ENVIRONMENTS=("development" "staging" "production")
APPLICATIONS=("api" "web" "admin")
DOCKER_REGISTRY="taskmanagement"
KUBECTL_TIMEOUT="300s"

show_help() {
    echo "Deployment Script for Task Management App"
    echo ""
    echo "Usage: $0 [COMMAND] [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build           Build Docker images"
    echo "  push            Push images to registry"
    echo "  deploy          Deploy to Kubernetes"
    echo "  rollback        Rollback to previous version"
    echo "  status          Show deployment status"
    echo "  logs            Show application logs"
    echo "  scale           Scale application replicas"
    echo "  restart         Restart deployments"
    echo "  health          Check deployment health"
    echo ""
    echo "Environments:"
    echo "  development     Development environment"
    echo "  staging         Staging environment"
    echo "  production      Production environment"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -v, --verbose   Verbose output"
    echo "  --app APP       Deploy specific application (api|web|admin)"
    echo "  --tag TAG       Use specific image tag"
    echo "  --dry-run       Show what would be deployed without executing"
    echo "  --force         Force deployment without confirmation"
    echo ""
    echo "Examples:"
    echo "  $0 build staging                    # Build images for staging"
    echo "  $0 deploy production --app api      # Deploy only API to production"
    echo "  $0 rollback staging                 # Rollback staging deployment"
    echo "  $0 scale production --replicas 5    # Scale production to 5 replicas"
}

validate_environment() {
    local env="$1"
    
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${env} " ]]; then
        print_error "Invalid environment: $env"
        echo "Valid environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi
}

validate_application() {
    local app="$1"
    
    if [[ ! " ${APPLICATIONS[@]} " =~ " ${app} " ]]; then
        print_error "Invalid application: $app"
        echo "Valid applications: ${APPLICATIONS[*]}"
        exit 1
    fi
}

check_prerequisites() {
    local env="$1"
    
    print_status "Checking prerequisites for $env deployment..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check Helm (if using Helm)
    if ! command -v helm &> /dev/null; then
        print_warning "Helm is not installed. Some features may not work."
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace
    local namespace="taskmanagement-$env"
    if ! kubectl get namespace "$namespace" &> /dev/null; then
        print_warning "Namespace $namespace does not exist. Creating it..."
        kubectl create namespace "$namespace"
    fi
    
    print_success "Prerequisites check passed"
}

get_git_info() {
    local git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    local git_tag=$(git describe --tags --exact-match 2>/dev/null || echo "")
    
    echo "$git_commit $git_branch $git_tag"
}

build_images() {
    local env="$1"
    local app_filter="$2"
    local tag="${3:-$(git rev-parse --short HEAD)}"
    
    print_header "Building Docker images for $env environment"
    
    local git_info=($(get_git_info))
    local git_commit="${git_info[0]}"
    local git_branch="${git_info[1]}"
    
    local apps_to_build=("${APPLICATIONS[@]}")
    if [[ -n "$app_filter" ]]; then
        apps_to_build=("$app_filter")
    fi
    
    for app in "${apps_to_build[@]}"; do
        print_status "Building $app image..."
        
        local image_name="$DOCKER_REGISTRY/$app"
        local dockerfile="apps/$app/Dockerfile"
        
        if [[ ! -f "$dockerfile" ]]; then
            print_error "Dockerfile not found: $dockerfile"
            continue
        fi
        
        # Build image with multiple tags
        docker build \
            --file "$dockerfile" \
            --tag "$image_name:$tag" \
            --tag "$image_name:$git_commit" \
            --tag "$image_name:$git_branch" \
            --build-arg BUILD_ENV="$env" \
            --build-arg GIT_COMMIT="$git_commit" \
            --build-arg GIT_BRANCH="$git_branch" \
            --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            .
        
        print_success "Built $app image: $image_name:$tag"
    done
    
    print_success "All images built successfully"
}

push_images() {
    local env="$1"
    local app_filter="$2"
    local tag="${3:-$(git rev-parse --short HEAD)}"
    
    print_header "Pushing Docker images to registry"
    
    local apps_to_push=("${APPLICATIONS[@]}")
    if [[ -n "$app_filter" ]]; then
        apps_to_push=("$app_filter")
    fi
    
    for app in "${apps_to_push[@]}"; do
        print_status "Pushing $app image..."
        
        local image_name="$DOCKER_REGISTRY/$app"
        
        # Push all tags
        docker push "$image_name:$tag"
        docker push "$image_name:$(git rev-parse --short HEAD)"
        docker push "$image_name:$(git rev-parse --abbrev-ref HEAD)"
        
        print_success "Pushed $app image: $image_name:$tag"
    done
    
    print_success "All images pushed successfully"
}

deploy_to_kubernetes() {
    local env="$1"
    local app_filter="$2"
    local tag="${3:-$(git rev-parse --short HEAD)}"
    local dry_run="$4"
    
    print_header "Deploying to $env environment"
    
    local namespace="taskmanagement-$env"
    local apps_to_deploy=("${APPLICATIONS[@]}")
    if [[ -n "$app_filter" ]]; then
        apps_to_deploy=("$app_filter")
    fi
    
    # Apply common resources first
    print_status "Applying common Kubernetes resources..."
    
    local common_manifests="infrastructure/kubernetes/base"
    if [[ -d "$common_manifests" ]]; then
        if [[ "$dry_run" == "true" ]]; then
            kubectl apply --dry-run=client -k "$common_manifests" -n "$namespace"
        else
            kubectl apply -k "$common_manifests" -n "$namespace"
        fi
    fi
    
    # Deploy applications
    for app in "${apps_to_deploy[@]}"; do
        print_status "Deploying $app..."
        
        local manifest_dir="infrastructure/kubernetes/overlays/$env"
        local deployment_name="taskmanagement-$app"
        local image_name="$DOCKER_REGISTRY/$app:$tag"
        
        if [[ -d "$manifest_dir" ]]; then
            # Use Kustomize
            if [[ "$dry_run" == "true" ]]; then
                kubectl apply --dry-run=client -k "$manifest_dir" -n "$namespace"
            else
                kubectl apply -k "$manifest_dir" -n "$namespace"
                kubectl set image "deployment/$deployment_name" "$app=$image_name" -n "$namespace"
            fi
        else
            # Use Helm if available
            if command -v helm &> /dev/null && [[ -d "infrastructure/helm/$app" ]]; then
                local helm_args=(
                    "upgrade" "--install" "$deployment_name"
                    "infrastructure/helm/$app"
                    "--namespace" "$namespace"
                    "--set" "image.tag=$tag"
                    "--set" "environment=$env"
                    "--timeout" "$KUBECTL_TIMEOUT"
                )
                
                if [[ "$dry_run" == "true" ]]; then
                    helm_args+=("--dry-run")
                fi
                
                helm "${helm_args[@]}"
            else
                print_warning "No deployment manifests found for $app in $env"
                continue
            fi
        fi
        
        if [[ "$dry_run" != "true" ]]; then
            # Wait for rollout to complete
            print_status "Waiting for $app rollout to complete..."
            kubectl rollout status "deployment/$deployment_name" -n "$namespace" --timeout="$KUBECTL_TIMEOUT"
        fi
        
        print_success "Deployed $app successfully"
    done
    
    if [[ "$dry_run" != "true" ]]; then
        print_success "Deployment to $env completed successfully"
        
        # Show deployment status
        show_deployment_status "$env"
    else
        print_success "Dry run completed successfully"
    fi
}

rollback_deployment() {
    local env="$1"
    local app_filter="$2"
    
    print_header "Rolling back $env deployment"
    
    local namespace="taskmanagement-$env"
    local apps_to_rollback=("${APPLICATIONS[@]}")
    if [[ -n "$app_filter" ]]; then
        apps_to_rollback=("$app_filter")
    fi
    
    for app in "${apps_to_rollback[@]}"; do
        print_status "Rolling back $app..."
        
        local deployment_name="taskmanagement-$app"
        
        # Rollback to previous revision
        kubectl rollout undo "deployment/$deployment_name" -n "$namespace"
        
        # Wait for rollback to complete
        kubectl rollout status "deployment/$deployment_name" -n "$namespace" --timeout="$KUBECTL_TIMEOUT"
        
        print_success "Rolled back $app successfully"
    done
    
    print_success "Rollback completed successfully"
}

show_deployment_status() {
    local env="$1"
    local app_filter="$2"
    
    print_header "Deployment status for $env environment"
    
    local namespace="taskmanagement-$env"
    
    echo ""
    print_status "Deployments:"
    kubectl get deployments -n "$namespace" -o wide
    
    echo ""
    print_status "Pods:"
    kubectl get pods -n "$namespace" -o wide
    
    echo ""
    print_status "Services:"
    kubectl get services -n "$namespace" -o wide
    
    if command -v helm &> /dev/null; then
        echo ""
        print_status "Helm releases:"
        helm list -n "$namespace"
    fi
}

show_logs() {
    local env="$1"
    local app="$2"
    local lines="${3:-100}"
    
    print_header "Showing logs for $app in $env environment"
    
    local namespace="taskmanagement-$env"
    local deployment_name="taskmanagement-$app"
    
    kubectl logs -f "deployment/$deployment_name" -n "$namespace" --tail="$lines"
}

scale_deployment() {
    local env="$1"
    local app="$2"
    local replicas="$3"
    
    print_header "Scaling $app in $env environment to $replicas replicas"
    
    local namespace="taskmanagement-$env"
    local deployment_name="taskmanagement-$app"
    
    kubectl scale "deployment/$deployment_name" --replicas="$replicas" -n "$namespace"
    
    # Wait for scaling to complete
    kubectl rollout status "deployment/$deployment_name" -n "$namespace" --timeout="$KUBECTL_TIMEOUT"
    
    print_success "Scaled $app to $replicas replicas"
}

restart_deployment() {
    local env="$1"
    local app_filter="$2"
    
    print_header "Restarting deployments in $env environment"
    
    local namespace="taskmanagement-$env"
    local apps_to_restart=("${APPLICATIONS[@]}")
    if [[ -n "$app_filter" ]]; then
        apps_to_restart=("$app_filter")
    fi
    
    for app in "${apps_to_restart[@]}"; do
        print_status "Restarting $app..."
        
        local deployment_name="taskmanagement-$app"
        
        kubectl rollout restart "deployment/$deployment_name" -n "$namespace"
        kubectl rollout status "deployment/$deployment_name" -n "$namespace" --timeout="$KUBECTL_TIMEOUT"
        
        print_success "Restarted $app successfully"
    done
    
    print_success "All deployments restarted successfully"
}

check_deployment_health() {
    local env="$1"
    
    print_header "Checking deployment health for $env environment"
    
    local namespace="taskmanagement-$env"
    local healthy=true
    
    for app in "${APPLICATIONS[@]}"; do
        print_status "Checking $app health..."
        
        local deployment_name="taskmanagement-$app"
        
        # Check if deployment exists
        if ! kubectl get "deployment/$deployment_name" -n "$namespace" &> /dev/null; then
            print_warning "$app deployment not found"
            continue
        fi
        
        # Check deployment status
        local ready_replicas=$(kubectl get "deployment/$deployment_name" -n "$namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired_replicas=$(kubectl get "deployment/$deployment_name" -n "$namespace" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$ready_replicas" -gt 0 ]]; then
            print_success "$app is healthy ($ready_replicas/$desired_replicas replicas ready)"
        else
            print_error "$app is unhealthy ($ready_replicas/$desired_replicas replicas ready)"
            healthy=false
        fi
    done
    
    if [[ "$healthy" == "true" ]]; then
        print_success "All deployments are healthy"
        return 0
    else
        print_error "Some deployments are unhealthy"
        return 1
    fi
}

# Parse command line arguments
parse_args() {
    local command=""
    local environment=""
    local app_filter=""
    local tag=""
    local dry_run="false"
    local force="false"
    local replicas=""
    local lines="100"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            build|push|deploy|rollback|status|logs|scale|restart|health)
                command="$1"
                shift
                ;;
            development|staging|production)
                environment="$1"
                shift
                ;;
            --app)
                app_filter="$2"
                validate_application "$app_filter"
                shift 2
                ;;
            --tag)
                tag="$2"
                shift 2
                ;;
            --replicas)
                replicas="$2"
                shift 2
                ;;
            --lines)
                lines="$2"
                shift 2
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --force)
                force="true"
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
    
    if [[ -z "$environment" ]] && [[ "$command" != "build" ]]; then
        print_error "Environment is required for $command command"
        show_help
        exit 1
    fi
    
    if [[ -n "$environment" ]]; then
        validate_environment "$environment"
    fi
    
    # Execute command
    case "$command" in
        "build")
            build_images "$environment" "$app_filter" "$tag"
            ;;
        "push")
            check_prerequisites "$environment"
            push_images "$environment" "$app_filter" "$tag"
            ;;
        "deploy")
            check_prerequisites "$environment"
            
            if [[ "$environment" == "production" ]] && [[ "$force" != "true" ]]; then
                print_warning "You are about to deploy to PRODUCTION!"
                read -p "Are you sure? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    print_status "Deployment cancelled"
                    exit 0
                fi
            fi
            
            deploy_to_kubernetes "$environment" "$app_filter" "$tag" "$dry_run"
            ;;
        "rollback")
            check_prerequisites "$environment"
            
            if [[ "$environment" == "production" ]] && [[ "$force" != "true" ]]; then
                print_warning "You are about to rollback PRODUCTION!"
                read -p "Are you sure? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    print_status "Rollback cancelled"
                    exit 0
                fi
            fi
            
            rollback_deployment "$environment" "$app_filter"
            ;;
        "status")
            check_prerequisites "$environment"
            show_deployment_status "$environment" "$app_filter"
            ;;
        "logs")
            check_prerequisites "$environment"
            
            if [[ -z "$app_filter" ]]; then
                print_error "Application is required for logs command"
                echo "Use --app option to specify application"
                exit 1
            fi
            
            show_logs "$environment" "$app_filter" "$lines"
            ;;
        "scale")
            check_prerequisites "$environment"
            
            if [[ -z "$app_filter" ]]; then
                print_error "Application is required for scale command"
                echo "Use --app option to specify application"
                exit 1
            fi
            
            if [[ -z "$replicas" ]]; then
                print_error "Replicas count is required for scale command"
                echo "Use --replicas option to specify replica count"
                exit 1
            fi
            
            scale_deployment "$environment" "$app_filter" "$replicas"
            ;;
        "restart")
            check_prerequisites "$environment"
            restart_deployment "$environment" "$app_filter"
            ;;
        "health")
            check_prerequisites "$environment"
            check_deployment_health "$environment"
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