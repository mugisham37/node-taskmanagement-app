# TaskManagement Monitoring Stack Setup Script (PowerShell)
# This script sets up the complete monitoring infrastructure

param(
    [string]$Environment = "development",
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "🔧 $Message" $Blue
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✅ $Message" $Green
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "⚠️  $Message" $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "❌ $Message" $Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Step "Checking prerequisites..."
    
    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker found: $dockerVersion"
    }
    catch {
        Write-Error "Docker is not installed or not in PATH"
        exit 1
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version
        Write-Success "Docker Compose found: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose is not installed or not in PATH"
        exit 1
    }
    
    # Check available memory
    $memory = Get-CimInstance -ClassName Win32_ComputerSystem | Select-Object -ExpandProperty TotalPhysicalMemory
    $memoryGB = [math]::Round($memory / 1GB, 2)
    
    if ($memoryGB -lt 4) {
        Write-Warning "Available memory is ${memoryGB}GB. Monitoring stack requires at least 4GB for optimal performance."
    } else {
        Write-Success "Available memory: ${memoryGB}GB"
    }
}

# Create environment file
function New-EnvironmentFile {
    Write-Step "Creating environment configuration..."
    
    $envFile = ".env"
    $envContent = @"
# TaskManagement Monitoring Environment Configuration
ENVIRONMENT=$Environment

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_SECRET_KEY=SW2YcwTIb9zpOOhoPsMm

# Database Configuration
POSTGRES_DB=taskmanagement
POSTGRES_USER=taskmanagement
POSTGRES_PASSWORD=password
DATABASE_URL=postgresql://taskmanagement:password@postgres:5432/taskmanagement

# Redis Configuration
REDIS_PASSWORD=
REDIS_URL=redis://redis:6379

# SMTP Configuration (Update with your settings)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Alert Email Configuration
ALERT_EMAIL_FROM=alerts@taskmanagement.com
DEFAULT_EMAIL_TO=admin@taskmanagement.com
CRITICAL_EMAIL_TO=critical@taskmanagement.com
WARNING_EMAIL_TO=warnings@taskmanagement.com
DATABASE_TEAM_EMAIL=database@taskmanagement.com
SECURITY_TEAM_EMAIL=security@taskmanagement.com
PRODUCT_TEAM_EMAIL=product@taskmanagement.com

# Slack Configuration (Update with your webhook URLs)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CRITICAL_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK
SLACK_WARNING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WARNING/WEBHOOK

# PagerDuty Configuration (Update with your routing keys)
PAGERDUTY_ROUTING_KEY=your-pagerduty-routing-key
PAGERDUTY_SECURITY_ROUTING_KEY=your-security-routing-key

# Application Configuration
NODE_ENV=$Environment
"@
    
    if (Test-Path $envFile) {
        Write-Warning "Environment file already exists. Backing up..."
        Copy-Item $envFile "$envFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    }
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8
    Write-Success "Environment file created: $envFile"
    Write-Warning "Please update the email and notification settings in $envFile"
}

# Create necessary directories
function New-MonitoringDirectories {
    Write-Step "Creating monitoring directories..."
    
    $directories = @(
        "monitoring/data/prometheus",
        "monitoring/data/grafana",
        "monitoring/data/alertmanager",
        "monitoring/data/jaeger",
        "monitoring/data/uptime-kuma",
        "monitoring/logs"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
    }
}

# Set proper permissions (Windows equivalent)
function Set-MonitoringPermissions {
    Write-Step "Setting directory permissions..."
    
    # On Windows, we'll ensure the directories are accessible
    $directories = @(
        "monitoring/data",
        "monitoring/logs"
    )
    
    foreach ($dir in $directories) {
        if (Test-Path $dir) {
            # Grant full control to current user
            $acl = Get-Acl $dir
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
                "FullControl",
                "ContainerInherit,ObjectInherit",
                "None",
                "Allow"
            )
            $acl.SetAccessRule($accessRule)
            Set-Acl -Path $dir -AclObject $acl
            Write-Success "Set permissions for: $dir"
        }
    }
}

# Pull Docker images
function Get-DockerImages {
    if ($SkipBuild) {
        Write-Warning "Skipping Docker image pull (--SkipBuild specified)"
        return
    }
    
    Write-Step "Pulling Docker images..."
    
    $images = @(
        "prom/prometheus:v2.45.0",
        "grafana/grafana:10.0.0",
        "prom/alertmanager:v0.25.0",
        "jaegertracing/all-in-one:1.47",
        "prom/node-exporter:v1.6.0",
        "prometheuscommunity/postgres-exporter:v0.13.2",
        "oliver006/redis_exporter:v1.52.0",
        "prom/blackbox-exporter:v0.24.0",
        "nginx/nginx-prometheus-exporter:0.11.0",
        "louislam/uptime-kuma:1.23.0",
        "postgres:15-alpine",
        "redis:7-alpine",
        "nginx:alpine"
    )
    
    foreach ($image in $images) {
        Write-Step "Pulling $image..."
        docker pull $image
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Pulled: $image"
        } else {
            Write-Error "Failed to pull: $image"
        }
    }
}

# Start monitoring stack
function Start-MonitoringStack {
    Write-Step "Starting monitoring stack..."
    
    # Change to monitoring directory
    Push-Location monitoring
    
    try {
        # Start the stack
        docker-compose up -d
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Monitoring stack started successfully!"
        } else {
            Write-Error "Failed to start monitoring stack"
            exit 1
        }
        
        # Wait for services to be ready
        Write-Step "Waiting for services to be ready..."
        Start-Sleep -Seconds 30
        
        # Check service health
        Test-ServiceHealth
        
    } finally {
        Pop-Location
    }
}

# Test service health
function Test-ServiceHealth {
    Write-Step "Checking service health..."
    
    $services = @(
        @{ Name = "Prometheus"; Url = "http://localhost:9090/-/healthy"; Port = 9090 },
        @{ Name = "Grafana"; Url = "http://localhost:3000/api/health"; Port = 3000 },
        @{ Name = "AlertManager"; Url = "http://localhost:9093/-/healthy"; Port = 9093 },
        @{ Name = "Jaeger"; Url = "http://localhost:16686"; Port = 16686 }
    )
    
    foreach ($service in $services) {
        Write-Step "Checking $($service.Name)..."
        
        # Check if port is listening
        $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue
        
        if ($connection.TcpTestSucceeded) {
            Write-Success "$($service.Name) is running on port $($service.Port)"
        } else {
            Write-Warning "$($service.Name) is not responding on port $($service.Port)"
        }
    }
}

# Display access information
function Show-AccessInformation {
    Write-Step "Monitoring stack is ready!"
    Write-Host ""
    Write-ColorOutput "📊 Access URLs:" $Blue
    Write-Host "  Grafana:      http://localhost:3000 (admin / admin123)"
    Write-Host "  Prometheus:   http://localhost:9090"
    Write-Host "  AlertManager: http://localhost:9093"
    Write-Host "  Jaeger:       http://localhost:16686"
    Write-Host "  Uptime Kuma:  http://localhost:3001"
    Write-Host ""
    Write-ColorOutput "📝 Next Steps:" $Yellow
    Write-Host "  1. Update notification settings in .env file"
    Write-Host "  2. Configure Uptime Kuma monitors"
    Write-Host "  3. Import additional Grafana dashboards if needed"
    Write-Host "  4. Test alert notifications"
    Write-Host ""
    Write-ColorOutput "🔧 Management Commands:" $Blue
    Write-Host "  Stop:    docker-compose -f monitoring/docker-compose.yml down"
    Write-Host "  Restart: docker-compose -f monitoring/docker-compose.yml restart"
    Write-Host "  Logs:    docker-compose -f monitoring/docker-compose.yml logs -f [service]"
    Write-Host ""
}

# Main execution
function Main {
    Write-ColorOutput "🚀 TaskManagement Monitoring Stack Setup" $Blue
    Write-Host "Environment: $Environment"
    Write-Host ""
    
    try {
        Test-Prerequisites
        New-EnvironmentFile
        New-MonitoringDirectories
        Set-MonitoringPermissions
        Get-DockerImages
        Start-MonitoringStack
        Show-AccessInformation
        
        Write-Success "Monitoring stack setup completed successfully!"
        
    } catch {
        Write-Error "Setup failed: $($_.Exception.Message)"
        Write-Host "Stack trace: $($_.ScriptStackTrace)"
        exit 1
    }
}

# Run main function
Main