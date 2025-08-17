# TaskManagement Monitoring Backup Script (PowerShell)
# This script backs up monitoring data and configurations

param(
    [string]$BackupPath = ".\backups",
    [switch]$IncludeData = $true,
    [switch]$Compress = $true,
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

# Colors for output
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Red = "`e[31m"
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

# Create backup directory
function New-BackupDirectory {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupDir = Join-Path $BackupPath "monitoring-backup-$timestamp"
    
    if (-not (Test-Path $BackupPath)) {
        New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
    }
    
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Success "Created backup directory: $backupDir"
    
    return $backupDir
}

# Backup configurations
function Backup-Configurations {
    param([string]$BackupDir)
    
    Write-Step "Backing up monitoring configurations..."
    
    $configDir = Join-Path $BackupDir "configs"
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    
    # Backup configuration files
    $configFiles = @(
        "monitoring/prometheus/prometheus.yml",
        "monitoring/prometheus/rules/*.yml",
        "monitoring/grafana/grafana.ini",
        "monitoring/grafana/provisioning/**/*",
        "monitoring/alertmanager/alertmanager.yml",
        "monitoring/alertmanager/templates/*.tmpl",
        "monitoring/jaeger/jaeger-config.yml",
        "monitoring/uptime/blackbox-exporter.yml",
        "monitoring/docker-compose.yml",
        ".env"
    )
    
    foreach ($pattern in $configFiles) {
        $files = Get-ChildItem -Path $pattern -Recurse -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
            $destPath = Join-Path $configDir $relativePath
            $destDir = Split-Path $destPath -Parent
            
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            
            Copy-Item $file.FullName $destPath -Force
            Write-Success "Backed up: $relativePath"
        }
    }
}

# Backup Grafana dashboards
function Backup-GrafanaDashboards {
    param([string]$BackupDir)
    
    Write-Step "Backing up Grafana dashboards..."
    
    $dashboardDir = Join-Path $BackupDir "grafana-dashboards"
    New-Item -ItemType Directory -Path $dashboardDir -Force | Out-Null
    
    # Check if Grafana is running
    $grafanaRunning = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $grafanaRunning = $true
        }
    } catch {
        # Grafana not running or not accessible
    }
    
    if ($grafanaRunning) {
        Write-Step "Exporting dashboards from Grafana API..."
        
        # Get all dashboards
        try {
            $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin123"))
            $headers = @{ Authorization = "Basic $auth" }
            
            $dashboards = Invoke-RestMethod -Uri "http://localhost:3000/api/search?type=dash-db" -Headers $headers
            
            foreach ($dashboard in $dashboards) {
                $dashboardData = Invoke-RestMethod -Uri "http://localhost:3000/api/dashboards/uid/$($dashboard.uid)" -Headers $headers
                $filename = "$($dashboard.title -replace '[^\w\-_\.]', '_').json"
                $filepath = Join-Path $dashboardDir $filename
                
                $dashboardData.dashboard | ConvertTo-Json -Depth 100 | Out-File -FilePath $filepath -Encoding UTF8
                Write-Success "Exported dashboard: $($dashboard.title)"
            }
        } catch {
            Write-Warning "Failed to export dashboards via API: $($_.Exception.Message)"
        }
    } else {
        Write-Warning "Grafana is not running. Backing up dashboard files instead..."
        
        # Backup dashboard files
        $dashboardFiles = Get-ChildItem -Path "monitoring/grafana/dashboards" -Recurse -Filter "*.json" -ErrorAction SilentlyContinue
        foreach ($file in $dashboardFiles) {
            $relativePath = $file.FullName.Replace((Get-Location).Path + "\monitoring\grafana\dashboards\", "")
            $destPath = Join-Path $dashboardDir $relativePath
            $destDir = Split-Path $destPath -Parent
            
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            
            Copy-Item $file.FullName $destPath -Force
            Write-Success "Backed up dashboard file: $relativePath"
        }
    }
}

# Backup data volumes
function Backup-DataVolumes {
    param([string]$BackupDir)
    
    if (-not $IncludeData) {
        Write-Warning "Skipping data backup (IncludeData is false)"
        return
    }
    
    Write-Step "Backing up monitoring data volumes..."
    
    $dataDir = Join-Path $BackupDir "data"
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    
    # Check if Docker containers are running
    $containers = docker ps --format "table {{.Names}}" | Select-String "taskmanagement-"
    
    if ($containers.Count -gt 0) {
        Write-Step "Stopping containers for consistent backup..."
        docker-compose -f monitoring/docker-compose.yml stop
        Start-Sleep -Seconds 10
    }
    
    try {
        # Backup Docker volumes
        $volumes = @(
            "prometheus-data",
            "grafana-data",
            "alertmanager-data"
        )
        
        foreach ($volume in $volumes) {
            Write-Step "Backing up volume: $volume"
            
            $volumeBackupDir = Join-Path $dataDir $volume
            New-Item -ItemType Directory -Path $volumeBackupDir -Force | Out-Null
            
            # Create a temporary container to access the volume
            $containerId = docker run -d --rm -v "${volume}:/data" -v "${PWD}:/backup" alpine:latest tail -f /dev/null
            
            if ($LASTEXITCODE -eq 0) {
                # Copy data from volume
                docker exec $containerId tar -czf "/backup/temp-$volume.tar.gz" -C /data .
                
                if ($LASTEXITCODE -eq 0) {
                    Move-Item "temp-$volume.tar.gz" (Join-Path $volumeBackupDir "$volume.tar.gz")
                    Write-Success "Backed up volume: $volume"
                } else {
                    Write-Warning "Failed to backup volume: $volume"
                }
                
                # Stop the temporary container
                docker stop $containerId | Out-Null
            } else {
                Write-Warning "Failed to create temporary container for volume: $volume"
            }
        }
        
    } finally {
        # Restart containers
        if ($containers.Count -gt 0) {
            Write-Step "Restarting monitoring stack..."
            docker-compose -f monitoring/docker-compose.yml start
        }
    }
}

# Create backup metadata
function New-BackupMetadata {
    param([string]$BackupDir)
    
    Write-Step "Creating backup metadata..."
    
    $metadata = @{
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
        environment = $env:ENVIRONMENT ?? "development"
        hostname = $env:COMPUTERNAME
        backup_type = if ($IncludeData) { "full" } else { "config-only" }
        retention_days = $RetentionDays
        created_by = $env:USERNAME
        docker_version = (docker --version)
        compose_version = (docker-compose --version)
    }
    
    $metadataPath = Join-Path $BackupDir "backup-metadata.json"
    $metadata | ConvertTo-Json -Depth 10 | Out-File -FilePath $metadataPath -Encoding UTF8
    
    Write-Success "Created backup metadata: backup-metadata.json"
}

# Compress backup
function Compress-Backup {
    param([string]$BackupDir)
    
    if (-not $Compress) {
        Write-Warning "Skipping compression (Compress is false)"
        return $BackupDir
    }
    
    Write-Step "Compressing backup..."
    
    $backupName = Split-Path $BackupDir -Leaf
    $archivePath = Join-Path (Split-Path $BackupDir -Parent) "$backupName.zip"
    
    # Create zip archive
    Compress-Archive -Path "$BackupDir\*" -DestinationPath $archivePath -Force
    
    if (Test-Path $archivePath) {
        # Remove uncompressed directory
        Remove-Item $BackupDir -Recurse -Force
        Write-Success "Created compressed backup: $archivePath"
        return $archivePath
    } else {
        Write-Warning "Failed to create compressed backup"
        return $BackupDir
    }
}

# Clean old backups
function Remove-OldBackups {
    Write-Step "Cleaning old backups..."
    
    $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $backupFiles = Get-ChildItem -Path $BackupPath -Filter "monitoring-backup-*" | Where-Object { $_.CreationTime -lt $cutoffDate }
    
    foreach ($file in $backupFiles) {
        Remove-Item $file.FullName -Recurse -Force
        Write-Success "Removed old backup: $($file.Name)"
    }
    
    if ($backupFiles.Count -eq 0) {
        Write-Success "No old backups to remove"
    }
}

# Main execution
function Main {
    Write-ColorOutput "💾 TaskManagement Monitoring Backup" $Blue
    Write-Host "Backup Path: $BackupPath"
    Write-Host "Include Data: $IncludeData"
    Write-Host "Compress: $Compress"
    Write-Host "Retention: $RetentionDays days"
    Write-Host ""
    
    try {
        $backupDir = New-BackupDirectory
        Backup-Configurations -BackupDir $backupDir
        Backup-GrafanaDashboards -BackupDir $backupDir
        Backup-DataVolumes -BackupDir $backupDir
        New-BackupMetadata -BackupDir $backupDir
        $finalPath = Compress-Backup -BackupDir $backupDir
        Remove-OldBackups
        
        Write-Success "Backup completed successfully!"
        Write-ColorOutput "📁 Backup location: $finalPath" $Green
        
    } catch {
        Write-Error "Backup failed: $($_.Exception.Message)"
        Write-Host "Stack trace: $($_.ScriptStackTrace)"
        exit 1
    }
}

# Run main function
Main