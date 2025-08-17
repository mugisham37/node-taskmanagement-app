# PowerShell Setup Script for TaskManagement Infrastructure

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "staging", "production")]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTools,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipDocker,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Script configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $RootDir

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "INFO" { "White" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
    }
    
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

# Tool installation functions
function Install-Terraform {
    Write-Log "Installing Terraform..." "INFO"
    
    try {
        # Check if Terraform is already installed
        $terraformVersion = terraform version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Terraform is already installed: $terraformVersion" "SUCCESS"
            return
        }
    }
    catch {
        # Terraform not found, proceed with installation
    }
    
    # Install using Chocolatey if available
    try {
        choco --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Installing Terraform using Chocolatey..." "INFO"
            choco install terraform -y
            Write-Log "Terraform installed successfully" "SUCCESS"
            return
        }
    }
    catch {
        # Chocolatey not available
    }
    
    # Manual installation
    Write-Log "Installing Terraform manually..." "INFO"
    $terraformUrl = "https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_windows_amd64.zip"
    $terraformZip = "$env:TEMP\terraform.zip"
    $terraformDir = "$env:ProgramFiles\Terraform"
    
    # Download Terraform
    Invoke-WebRequest -Uri $terraformUrl -OutFile $terraformZip
    
    # Create directory and extract
    New-Item -ItemType Directory -Path $terraformDir -Force
    Expand-Archive -Path $terraformZip -DestinationPath $terraformDir -Force
    
    # Add to PATH
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    if ($currentPath -notlike "*$terraformDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$terraformDir", "Machine")
        $env:PATH += ";$terraformDir"
    }
    
    # Cleanup
    Remove-Item $terraformZip -Force
    
    Write-Log "Terraform installed successfully" "SUCCESS"
}

function Install-Kubectl {
    Write-Log "Installing kubectl..." "INFO"
    
    try {
        # Check if kubectl is already installed
        $kubectlVersion = kubectl version --client 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "kubectl is already installed" "SUCCESS"
            return
        }
    }
    catch {
        # kubectl not found, proceed with installation
    }
    
    # Install using Chocolatey if available
    try {
        choco --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Installing kubectl using Chocolatey..." "INFO"
            choco install kubernetes-cli -y
            Write-Log "kubectl installed successfully" "SUCCESS"
            return
        }
    }
    catch {
        # Chocolatey not available
    }
    
    # Manual installation
    Write-Log "Installing kubectl manually..." "INFO"
    $kubectlUrl = "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
    $kubectlDir = "$env:ProgramFiles\kubectl"
    $kubectlPath = "$kubectlDir\kubectl.exe"
    
    # Create directory and download
    New-Item -ItemType Directory -Path $kubectlDir -Force
    Invoke-WebRequest -Uri $kubectlUrl -OutFile $kubectlPath
    
    # Add to PATH
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    if ($currentPath -notlike "*$kubectlDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$kubectlDir", "Machine")
        $env:PATH += ";$kubectlDir"
    }
    
    Write-Log "kubectl installed successfully" "SUCCESS"
}

function Install-Helm {
    Write-Log "Installing Helm..." "INFO"
    
    try {
        # Check if Helm is already installed
        $helmVersion = helm version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Helm is already installed" "SUCCESS"
            return
        }
    }
    catch {
        # Helm not found, proceed with installation
    }
    
    # Install using Chocolatey if available
    try {
        choco --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Installing Helm using Chocolatey..." "INFO"
            choco install kubernetes-helm -y
            Write-Log "Helm installed successfully" "SUCCESS"
            return
        }
    }
    catch {
        # Chocolatey not available
    }
    
    # Manual installation using script
    Write-Log "Installing Helm manually..." "INFO"
    $helmScript = "$env:TEMP\get-helm-3.ps1"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3.ps1" -OutFile $helmScript
    & $helmScript
    Remove-Item $helmScript -Force
    
    Write-Log "Helm installed successfully" "SUCCESS"
}

function Install-Docker {
    Write-Log "Checking Docker installation..." "INFO"
    
    try {
        # Check if Docker is already installed
        $dockerVersion = docker version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Docker is already installed" "SUCCESS"
            return
        }
    }
    catch {
        # Docker not found
    }
    
    Write-Log "Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop" "WARN"
    Write-Log "After installing Docker Desktop, restart this script" "WARN"
}

# Environment setup functions
function Initialize-TerraformBackend {
    param([string]$Env)
    
    Write-Log "Initializing Terraform backend for $Env..." "INFO"
    
    $terraformDir = "$RootDir/terraform/environments/$Env"
    
    if (-not (Test-Path $terraformDir)) {
        Write-Log "Creating Terraform environment directory: $terraformDir" "INFO"
        New-Item -ItemType Directory -Path $terraformDir -Force
    }
    
    Push-Location $terraformDir
    
    try {
        # Initialize Terraform
        terraform init
        
        if ($LASTEXITCODE -ne 0) {
            throw "Terraform initialization failed"
        }
        
        Write-Log "Terraform backend initialized successfully" "SUCCESS"
    }
    finally {
        Pop-Location
    }
}

function Setup-KubernetesNamespace {
    param([string]$Env)
    
    Write-Log "Setting up Kubernetes namespace for $Env..." "INFO"
    
    try {
        # Check if kubectl is configured
        kubectl cluster-info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "kubectl is not configured or cluster is not accessible" "WARN"
            Write-Log "Please configure kubectl to connect to your Kubernetes cluster" "WARN"
            return
        }
        
        # Create namespace if it doesn't exist
        kubectl get namespace taskmanagement 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Creating taskmanagement namespace..." "INFO"
            kubectl create namespace taskmanagement
            
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to create namespace"
            }
        }
        
        Write-Log "Kubernetes namespace setup completed" "SUCCESS"
    }
    catch {
        Write-Log "Kubernetes namespace setup failed: $($_.Exception.Message)" "ERROR"
    }
}

function Setup-HelmRepositories {
    Write-Log "Setting up Helm repositories..." "INFO"
    
    try {
        # Add common Helm repositories
        $repositories = @(
            @{Name="stable"; Url="https://charts.helm.sh/stable"},
            @{Name="ingress-nginx"; Url="https://kubernetes.github.io/ingress-nginx"},
            @{Name="jetstack"; Url="https://charts.jetstack.io"},
            @{Name="prometheus-community"; Url="https://prometheus-community.github.io/helm-charts"}
        )
        
        foreach ($repo in $repositories) {
            Write-Log "Adding Helm repository: $($repo.Name)" "INFO"
            helm repo add $repo.Name $repo.Url 2>$null
        }
        
        # Update repositories
        Write-Log "Updating Helm repositories..." "INFO"
        helm repo update
        
        Write-Log "Helm repositories setup completed" "SUCCESS"
    }
    catch {
        Write-Log "Helm repositories setup failed: $($_.Exception.Message)" "ERROR"
    }
}

function Create-EnvironmentFiles {
    param([string]$Env)
    
    Write-Log "Creating environment configuration files for $Env..." "INFO"
    
    # Create Terraform environment files
    $terraformEnvDir = "$RootDir/terraform/environments/$Env"
    New-Item -ItemType Directory -Path $terraformEnvDir -Force
    
    # Create main.tf if it doesn't exist
    $mainTfPath = "$terraformEnvDir/main.tf"
    if (-not (Test-Path $mainTfPath)) {
        $mainTfContent = @"
# Terraform configuration for $Env environment

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    # Configure your S3 backend here
    # bucket = "your-terraform-state-bucket"
    # key    = "taskmanagement/$Env/terraform.tfstate"
    # region = "us-west-2"
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = "$Env"
      Project     = "TaskManagement"
      ManagedBy   = "Terraform"
    }
  }
}

# Module configurations
module "networking" {
  source = "../../modules/networking"
  
  environment = "$Env"
  vpc_cidr    = var.vpc_cidr
  
  common_tags = local.common_tags
}

module "database" {
  source = "../../modules/database"
  
  environment         = "$Env"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  database_password = var.database_password
  redis_auth_token  = var.redis_auth_token
  
  common_tags = local.common_tags
}

module "compute" {
  source = "../../modules/compute"
  
  environment          = "$Env"
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  private_subnet_ids  = module.networking.private_subnet_ids
  
  ssl_certificate_arn = var.ssl_certificate_arn
  domain_name        = var.domain_name
  
  database_url = "postgresql://\${module.database.postgresql_username}:\${var.database_password}@\${module.database.postgresql_endpoint}/\${module.database.postgresql_database_name}"
  redis_url    = "redis://:\${var.redis_auth_token}@\${module.database.redis_endpoint}:\${module.database.redis_port}"
  
  common_tags = local.common_tags
}

# Local values
locals {
  common_tags = {
    Environment = "$Env"
    Project     = "TaskManagement"
    ManagedBy   = "Terraform"
  }
}
"@
        Set-Content -Path $mainTfPath -Value $mainTfContent
    }
    
    # Create variables.tf if it doesn't exist
    $variablesTfPath = "$terraformEnvDir/variables.tf"
    if (-not (Test-Path $variablesTfPath)) {
        $variablesTfContent = @"
# Variables for $Env environment

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate"
  type        = string
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Redis auth token"
  type        = string
  sensitive   = true
}
"@
        Set-Content -Path $variablesTfPath -Value $variablesTfContent
    }
    
    # Create terraform.tfvars.example
    $tfvarsExamplePath = "$terraformEnvDir/terraform.tfvars.example"
    if (-not (Test-Path $tfvarsExamplePath)) {
        $tfvarsExampleContent = @"
# Example Terraform variables for $Env environment
# Copy this file to terraform.tfvars and update with your values

aws_region = "us-west-2"
vpc_cidr   = "10.0.0.0/16"

domain_name         = "taskmanagement-$Env.example.com"
ssl_certificate_arn = "arn:aws:acm:us-west-2:123456789012:certificate/12345678-1234-1234-1234-123456789012"

database_password = "your-secure-database-password"
redis_auth_token  = "your-secure-redis-token"
"@
        Set-Content -Path $tfvarsExamplePath -Value $tfvarsExampleContent
    }
    
    # Create Kubernetes overlay if it doesn't exist
    $kubernetesOverlayDir = "$RootDir/kubernetes/overlays/$Env"
    New-Item -ItemType Directory -Path $kubernetesOverlayDir -Force
    
    $kustomizationPath = "$kubernetesOverlayDir/kustomization.yaml"
    if (-not (Test-Path $kustomizationPath)) {
        $kustomizationContent = @"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: taskmanagement-$Env

namespace: taskmanagement

resources:
  - ../../base

patchesStrategicMerge:
  - deployment-patch.yaml
  - ingress-patch.yaml

images:
  - name: taskmanagement/api
    newTag: $Env-latest
  - name: taskmanagement/web
    newTag: $Env-latest
  - name: taskmanagement/admin
    newTag: $Env-latest

replicas:
  - name: taskmanagement-api
    count: $(if ($Env -eq "production") { "3" } elseif ($Env -eq "staging") { "2" } else { "1" })
  - name: taskmanagement-web
    count: $(if ($Env -eq "production") { "2" } else { "1" })
  - name: taskmanagement-admin
    count: 1
"@
        Set-Content -Path $kustomizationPath -Value $kustomizationContent
    }
    
    # Create Helm values file
    $helmValuesPath = "$RootDir/helm/taskmanagement/values-$Env.yaml"
    if (-not (Test-Path $helmValuesPath)) {
        $helmValuesContent = @"
# Helm values for $Env environment

global:
  imageRegistry: "docker.io"

app:
  environment: $Env

api:
  replicaCount: $(if ($Env -eq "production") { "3" } elseif ($Env -eq "staging") { "2" } else { "1" })
  image:
    tag: "$Env-latest"
  resources:
    requests:
      memory: "$(if ($Env -eq "production") { "512Mi" } else { "256Mi" })"
      cpu: "$(if ($Env -eq "production") { "500m" } else { "250m" })"
    limits:
      memory: "$(if ($Env -eq "production") { "1Gi" } else { "512Mi" })"
      cpu: "$(if ($Env -eq "production") { "1000m" } else { "500m" })"

web:
  replicaCount: $(if ($Env -eq "production") { "2" } else { "1" })
  image:
    tag: "$Env-latest"

admin:
  replicaCount: 1
  image:
    tag: "$Env-latest"

ingress:
  hosts:
    - host: taskmanagement-$Env.example.com
      paths:
        - path: /api
          pathType: Prefix
          service: api
        - path: /trpc
          pathType: Prefix
          service: api
        - path: /
          pathType: Prefix
          service: web
    - host: admin-$Env.example.com
      paths:
        - path: /api
          pathType: Prefix
          service: api
        - path: /trpc
          pathType: Prefix
          service: api
        - path: /
          pathType: Prefix
          service: admin
  tls:
    - secretName: taskmanagement-$Env-tls
      hosts:
        - taskmanagement-$Env.example.com
        - admin-$Env.example.com

monitoring:
  enabled: $(if ($Env -eq "dev") { "false" } else { "true" })
"@
        Set-Content -Path $helmValuesPath -Value $helmValuesContent
    }
    
    Write-Log "Environment configuration files created successfully" "SUCCESS"
}

function Show-NextSteps {
    param([string]$Env)
    
    Write-Log "Setup completed! Next steps:" "SUCCESS"
    Write-Log "" "INFO"
    Write-Log "1. Configure your cloud provider credentials (AWS CLI, kubectl, etc.)" "INFO"
    Write-Log "2. Update the terraform.tfvars file in infrastructure/terraform/environments/$Env/" "INFO"
    Write-Log "3. Update the Helm values file in infrastructure/helm/taskmanagement/values-$Env.yaml" "INFO"
    Write-Log "4. Run the deployment script:" "INFO"
    Write-Log "   .\infrastructure\scripts\deploy.ps1 -Environment $Env -Component all" "INFO"
    Write-Log "" "INFO"
    Write-Log "For development environment, you can also use Docker Compose:" "INFO"
    Write-Log "   docker-compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.dev.yml up" "INFO"
}

# Main setup function
function Start-Setup {
    try {
        Write-Log "Starting TaskManagement infrastructure setup..." "INFO"
        Write-Log "Environment: $Environment" "INFO"
        
        # Install required tools
        if (-not $SkipTools) {
            Install-Terraform
            Install-Kubectl
            Install-Helm
        }
        
        # Install Docker
        if (-not $SkipDocker) {
            Install-Docker
        }
        
        # Initialize Terraform backend
        Initialize-TerraformBackend -Env $Environment
        
        # Setup Kubernetes namespace
        Setup-KubernetesNamespace -Env $Environment
        
        # Setup Helm repositories
        Setup-HelmRepositories
        
        # Create environment configuration files
        Create-EnvironmentFiles -Env $Environment
        
        # Show next steps
        Show-NextSteps -Env $Environment
        
        Write-Log "Setup completed successfully!" "SUCCESS"
    }
    catch {
        Write-Log "Setup failed: $($_.Exception.Message)" "ERROR"
        exit 1
    }
}

# Script entry point
Write-Log "TaskManagement Infrastructure Setup Script" "INFO"

# Start setup
Start-Setup

Write-Log "Script execution completed" "INFO"