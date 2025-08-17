# PowerShell Deployment Script for TaskManagement Infrastructure

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("terraform", "kubernetes", "helm", "all")]
    [string]$Component = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$AutoApprove,
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "",
    
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

# Validation functions
function Test-Prerequisites {
    Write-Log "Checking prerequisites..." "INFO"
    
    $tools = @(
        @{Name="terraform"; Command="terraform version"},
        @{Name="kubectl"; Command="kubectl version --client"},
        @{Name="helm"; Command="helm version"},
        @{Name="docker"; Command="docker version"}
    )
    
    foreach ($tool in $tools) {
        try {
            $null = Invoke-Expression $tool.Command 2>$null
            Write-Log "$($tool.Name) is available" "SUCCESS"
        }
        catch {
            Write-Log "$($tool.Name) is not available or not in PATH" "ERROR"
            throw "Missing prerequisite: $($tool.Name)"
        }
    }
}

function Test-EnvironmentConfig {
    param([string]$Env)
    
    Write-Log "Validating environment configuration for $Env..." "INFO"
    
    $configPath = "$RootDir/terraform/environments/$Env"
    if (-not (Test-Path $configPath)) {
        throw "Environment configuration not found: $configPath"
    }
    
    $requiredFiles = @("main.tf", "variables.tf", "terraform.tfvars")
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $configPath $file
        if (-not (Test-Path $filePath)) {
            Write-Log "Missing required file: $filePath" "WARN"
        }
    }
    
    Write-Log "Environment configuration validated" "SUCCESS"
}

# Terraform deployment functions
function Deploy-Terraform {
    param([string]$Env)
    
    Write-Log "Deploying Terraform infrastructure for $Env..." "INFO"
    
    $terraformDir = "$RootDir/terraform/environments/$Env"
    Push-Location $terraformDir
    
    try {
        # Initialize Terraform
        Write-Log "Initializing Terraform..." "INFO"
        terraform init -upgrade
        
        if ($LASTEXITCODE -ne 0) {
            throw "Terraform init failed"
        }
        
        # Validate configuration
        Write-Log "Validating Terraform configuration..." "INFO"
        terraform validate
        
        if ($LASTEXITCODE -ne 0) {
            throw "Terraform validation failed"
        }
        
        # Plan deployment
        Write-Log "Planning Terraform deployment..." "INFO"
        $planArgs = @("plan", "-detailed-exitcode")
        if ($DryRun) {
            $planArgs += "-out=tfplan"
        }
        
        terraform @planArgs
        $planExitCode = $LASTEXITCODE
        
        if ($planExitCode -eq 1) {
            throw "Terraform plan failed"
        }
        elseif ($planExitCode -eq 2) {
            Write-Log "Changes detected in Terraform plan" "INFO"
            
            if (-not $DryRun) {
                # Apply changes
                Write-Log "Applying Terraform changes..." "INFO"
                $applyArgs = @("apply")
                if ($AutoApprove) {
                    $applyArgs += "-auto-approve"
                }
                
                terraform @applyArgs
                
                if ($LASTEXITCODE -ne 0) {
                    throw "Terraform apply failed"
                }
                
                Write-Log "Terraform deployment completed successfully" "SUCCESS"
            }
            else {
                Write-Log "Dry run completed - no changes applied" "INFO"
            }
        }
        else {
            Write-Log "No changes detected in Terraform plan" "INFO"
        }
    }
    finally {
        Pop-Location
    }
}

# Kubernetes deployment functions
function Deploy-Kubernetes {
    param([string]$Env)
    
    Write-Log "Deploying Kubernetes manifests for $Env..." "INFO"
    
    $kubernetesDir = "$RootDir/kubernetes/overlays/$Env"
    
    if (-not (Test-Path $kubernetesDir)) {
        throw "Kubernetes overlay not found: $kubernetesDir"
    }
    
    # Check kubectl context
    $currentContext = kubectl config current-context 2>$null
    Write-Log "Current kubectl context: $currentContext" "INFO"
    
    if ($DryRun) {
        Write-Log "Performing dry run of Kubernetes deployment..." "INFO"
        kubectl apply -k $kubernetesDir --dry-run=client
    }
    else {
        Write-Log "Applying Kubernetes manifests..." "INFO"
        kubectl apply -k $kubernetesDir
        
        if ($LASTEXITCODE -ne 0) {
            throw "Kubernetes deployment failed"
        }
        
        # Wait for deployments to be ready
        Write-Log "Waiting for deployments to be ready..." "INFO"
        kubectl wait --for=condition=available --timeout=300s deployment -l app.kubernetes.io/name=taskmanagement -n taskmanagement
        
        Write-Log "Kubernetes deployment completed successfully" "SUCCESS"
    }
}

# Helm deployment functions
function Deploy-Helm {
    param([string]$Env)
    
    Write-Log "Deploying Helm chart for $Env..." "INFO"
    
    $helmDir = "$RootDir/helm/taskmanagement"
    $valuesFile = "$helmDir/values-$Env.yaml"
    
    if (-not (Test-Path $valuesFile)) {
        $valuesFile = "$helmDir/values.yaml"
        Write-Log "Environment-specific values file not found, using default values.yaml" "WARN"
    }
    
    # Check if release exists
    $releaseExists = $false
    try {
        helm status "taskmanagement-$Env" -n taskmanagement 2>$null
        $releaseExists = $LASTEXITCODE -eq 0
    }
    catch {
        $releaseExists = $false
    }
    
    if ($DryRun) {
        Write-Log "Performing dry run of Helm deployment..." "INFO"
        if ($releaseExists) {
            helm upgrade "taskmanagement-$Env" $helmDir -f $valuesFile -n taskmanagement --dry-run
        }
        else {
            helm install "taskmanagement-$Env" $helmDir -f $valuesFile -n taskmanagement --create-namespace --dry-run
        }
    }
    else {
        if ($releaseExists) {
            Write-Log "Upgrading existing Helm release..." "INFO"
            helm upgrade "taskmanagement-$Env" $helmDir -f $valuesFile -n taskmanagement --wait --timeout=10m
        }
        else {
            Write-Log "Installing new Helm release..." "INFO"
            helm install "taskmanagement-$Env" $helmDir -f $valuesFile -n taskmanagement --create-namespace --wait --timeout=10m
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "Helm deployment failed"
        }
        
        Write-Log "Helm deployment completed successfully" "SUCCESS"
    }
}

# Health check functions
function Test-Deployment {
    param([string]$Env)
    
    Write-Log "Running deployment health checks..." "INFO"
    
    # Check pod status
    Write-Log "Checking pod status..." "INFO"
    kubectl get pods -n taskmanagement -l app.kubernetes.io/name=taskmanagement
    
    # Check service endpoints
    Write-Log "Checking service endpoints..." "INFO"
    kubectl get endpoints -n taskmanagement
    
    # Check ingress
    Write-Log "Checking ingress..." "INFO"
    kubectl get ingress -n taskmanagement
    
    Write-Log "Health checks completed" "SUCCESS"
}

# Rollback functions
function Invoke-Rollback {
    param(
        [string]$Env,
        [string]$Component
    )
    
    Write-Log "Rolling back $Component for $Env..." "WARN"
    
    switch ($Component) {
        "helm" {
            helm rollback "taskmanagement-$Env" -n taskmanagement
        }
        "kubernetes" {
            Write-Log "Kubernetes rollback requires manual intervention" "WARN"
        }
        "terraform" {
            Write-Log "Terraform rollback requires manual intervention" "WARN"
        }
    }
}

# Main deployment function
function Start-Deployment {
    param(
        [string]$Env,
        [string]$Component
    )
    
    try {
        Write-Log "Starting deployment of $Component to $Env environment..." "INFO"
        
        # Run prerequisites check
        Test-Prerequisites
        
        # Validate environment configuration
        Test-EnvironmentConfig -Env $Env
        
        # Deploy components based on selection
        switch ($Component) {
            "terraform" {
                Deploy-Terraform -Env $Env
            }
            "kubernetes" {
                Deploy-Kubernetes -Env $Env
            }
            "helm" {
                Deploy-Helm -Env $Env
            }
            "all" {
                Deploy-Terraform -Env $Env
                Deploy-Kubernetes -Env $Env
                Deploy-Helm -Env $Env
            }
        }
        
        # Run health checks if not dry run
        if (-not $DryRun -and $Component -in @("kubernetes", "helm", "all")) {
            Test-Deployment -Env $Env
        }
        
        Write-Log "Deployment completed successfully!" "SUCCESS"
    }
    catch {
        Write-Log "Deployment failed: $($_.Exception.Message)" "ERROR"
        
        # Offer rollback for non-terraform components
        if ($Component -in @("kubernetes", "helm") -and -not $DryRun) {
            $rollback = Read-Host "Would you like to rollback? (y/N)"
            if ($rollback -eq "y" -or $rollback -eq "Y") {
                Invoke-Rollback -Env $Env -Component $Component
            }
        }
        
        exit 1
    }
}

# Script entry point
Write-Log "TaskManagement Infrastructure Deployment Script" "INFO"
Write-Log "Environment: $Environment" "INFO"
Write-Log "Component: $Component" "INFO"
Write-Log "Dry Run: $DryRun" "INFO"

# Load configuration file if provided
if ($ConfigFile -and (Test-Path $ConfigFile)) {
    Write-Log "Loading configuration from $ConfigFile..." "INFO"
    . $ConfigFile
}

# Start deployment
Start-Deployment -Env $Environment -Component $Component

Write-Log "Script execution completed" "INFO"