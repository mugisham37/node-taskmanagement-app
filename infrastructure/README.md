# TaskManagement Infrastructure

This directory contains the complete Infrastructure as Code (IaC) setup for the TaskManagement application, including Terraform modules, Kubernetes manifests, Docker configurations, Helm charts, and deployment scripts.

## Directory Structure

```
infrastructure/
├── terraform/           # Terraform Infrastructure as Code
│   ├── modules/        # Reusable Terraform modules
│   │   ├── database/   # PostgreSQL and Redis
│   │   ├── compute/    # ECS, EC2, Lambda
│   │   ├── networking/ # VPC, Load Balancers, CDN
│   │   ├── storage/    # S3, EFS
│   │   ├── monitoring/ # CloudWatch, Prometheus
│   │   └── security/   # IAM, Security Groups, WAF
│   └── environments/   # Environment-specific configurations
│       ├── dev/        # Development environment
│       ├── staging/    # Staging environment
│       └── production/ # Production environment
├── kubernetes/         # Kubernetes manifests
│   ├── base/          # Base Kubernetes resources
│   └── overlays/      # Environment-specific overlays
│       ├── dev/       # Development overlay
│       ├── staging/   # Staging overlay
│       └── production/ # Production overlay
├── docker/            # Docker configurations
│   ├── Dockerfile.api    # API application
│   ├── Dockerfile.web    # Web application
│   ├── Dockerfile.admin  # Admin application
│   ├── docker-compose.yml     # Production compose
│   └── docker-compose.dev.yml # Development compose
├── helm/              # Helm charts
│   └── taskmanagement/   # Main application chart
│       ├── charts/       # Dependency charts
│       ├── templates/    # Kubernetes templates
│       ├── Chart.yaml    # Chart metadata
│       └── values.yaml   # Default values
└── scripts/           # Deployment and maintenance scripts
    ├── deploy.ps1     # Deployment script
  