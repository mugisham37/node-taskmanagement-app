# TaskManagement Monitoring Maintenance Script (PowerShell)
# This script performs routine maintenance on the monitoring stack

param(
    [switch]$CleanLogs = $true,
    [switch]$CleanMetrics = $false,
    [switch]$UpdateImages = $false,
    [switch]$RestartServices = $false,
    [int]$LogRetentionDays = 7,
    [int]$MetricRetentionHours = 168
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

# Check service status
function Test-ServiceStatus {
    Write-Step "Checking monitoring service status..."
    
    $services = @(
        @{ Name = "Prometheus"; Container = "taskmanagement-prometheus"; Port = 9090 },
        @{ Name = "Grafana"; Container = "taskmanagement-grafana"; Port = 3000 },
        @{ Name = "AlertManager"; Container = "taskmanagement-alertmanager"; Port = 9093 },
        @{ Name = "Jaeger"; Container = "taskmanagement-jaeger"; Port = 16686 }
    )
    
    $allHealthy = $true
    
    foreach ($service in $services) {
        # Check container status
        $containerStatus = docker ps --filter "name=$($service.Container)" --format "{{.Status}}"
        
        if ($containerStatus -like "*Up*") {
            # Check port connectivity
            $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue
            
            if ($connection.TcpTestSucceeded) {
                Write-Success "$($service.Name) is healthy"
            } else {
                Write-Warning "$($service.Name) container is up but port $($service.Port) is not responding"
                $allHealthy = $false
            }
        } else {
            Write-Warning "$($service.Name) container is not running"
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

# Clean old logs
function Clear-OldLogs {
    if (-not $CleanLogs) {
        Write-Warning "Skipping log cleanup (CleanLogs is false)"
        return
    }
    
    Write-Step "Cleaning old logs..."
    
    $cutoffDate = (Get-Date).AddDays(-$LogRetentionDays)
    $logPaths = @(
        "monitoring/logs",
        "monitoring/data/grafana/log",
        "monitoring/data/prometheus/log"
    )
    
    $totalCleaned = 0
    
    foreach ($logPath in $logPaths) {
        if (Test-Path $logPath) {
            $oldLogs = Get-ChildItem -Path $logPath -Recurse -File | Where-Object { $_.LastWriteTime -lt $cutoffDate }
            
            foreach ($log in $oldLogs) {
                $size = $log.Length
                Remove-Item $log.FullName -Force
                $totalCleaned += $size
                Write-Success "Removed old log: $($log.Name)"
            }
        }
    }
    
    # Clean Docker logs
    Write-Step "Cleaning Docker container logs..."
    $containers = docker ps --filter "name=taskmanagement-" --format "{{.Names}}"
    
    foreach ($container in $containers) {
        if ($container) {
            $logSize = docker logs --details $container 2>&1 | Measure-Object -Line | Select-Object -ExpandProperty Lines
            if ($logSize -gt 1000) {
                Write-Step "Truncating logs for container: $container"
                docker exec $container sh -c "truncate -s 0 /proc/1/fd/1 2>/dev/null || true"
                docker exec $container sh -c "truncate -s 0 /proc/1/fd/2 2>/dev/null || true"
            }
        }
    }
    
    $totalCleanedMB = [math]::Round($totalCleaned / 1MB, 2)
    Write-Success "Cleaned $totalCleanedMB MB of old logs"
}

# Clean old metrics
function Clear-OldMetrics {
    if (-not $CleanMetrics) {
        Write-Warning "Skipping metrics cleanup (CleanMetrics is false)"
        return
    }
    
    Write-Step "Cleaning old metrics data..."
    
    # Clean Prometheus data
    Write-Step "Cleaning Prometheus metrics older than $MetricRetentionHours hours..."
    
    # This would typically be handled by Prometheus retention settings
    # But we can clean up any temporary files or WAL files
    
    $prometheusDataPath = "monitoring/data/prometheus"
    if (Test-Path $prometheusDataPath) {
        # Clean WAL files older than retention period
        $walPath = Join-Path $prometheusDataPath "wal"
        if (Test-Path $walPath) {
            $cutoffDate = (Get-Date).AddHours(-$MetricRetentionHours)
            $oldWalFiles = Get-ChildItem -Path $walPath -File | Where-Object { $_.LastWriteTime -lt $cutoffDate }
            
            foreach ($file in $oldWalFiles) {
                Remove-Item $file.FullName -Force
                Write-Success "Removed old WAL file: $($file.Name)"
            }
        }
    }
    
    # Clean Jaeger traces
    Write-Step "Cleaning old Jaeger traces..."
    
    # Jaeger in-memory storage doesn't need cleanup, but if using persistent storage:
    $jaegerDataPath = "monitoring/data/jaeger"
    if (Test-Path $jaegerDataPath) {
        $cutoffDate = (Get-Date).AddHours(-$MetricRetentionHours)
        $oldTraces = Get-ChildItem -Path $jaegerDataPath -Recurse -File | Where-Object { $_.LastWriteTime -lt $cutoffDate }
        
        foreach ($file in $oldTraces) {
            Remove-Item $file.FullName -Force
            Write-Success "Removed old trace file: $($file.Name)"
        }
    }
}

# Update Docker images
function Update-DockerImages {
    if (-not $UpdateImages) {
        Write-Warning "Skipping image updates (UpdateImages is false)"
        return
    }
    
    Write-Step "Updating Docker images..."
    
    # Get current images
    $currentImages = docker-compose -f monitoring/docker-compose.yml config --services | ForEach-Object {
        docker-compose -f monitoring/docker-compose.yml images $_
    }
    
    # Pull latest images
    docker-compose -f monitoring/docker-compose.yml pull
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker images updated successfully"
        
        # Check if restart is needed
        $needsRestart = $false
        
        # Compare image IDs to see if any changed
        $newImages = docker-compose -f monitoring/docker-compose.yml config --services | ForEach-Object {
            docker-compose -f monitoring/docker-compose.yml images $_
        }
        
        # Simple comparison - in production you'd want more sophisticated checking
        if ($currentImages -ne $newImages) {
            $needsRestart = $true
            Write-Warning "Image updates detected. Services may need restart."
        }
        
        if ($needsRestart -and $RestartServices) {
            Restart-MonitoringServices
        }
    } else {
        Write-Error "Failed to update Docker images"
    }
}

# Restart monitoring services
function Restart-MonitoringServices {
    Write-Step "Restarting monitoring services..."
    
    Push-Location monitoring
    
    try {
        # Graceful restart
        docker-compose restart
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Services restarted successfully"
            
            # Wait for services to be ready
            Start-Sleep -Seconds 30
            
            # Verify health
            $healthy = Test-ServiceStatus
            if ($healthy) {
                Write-Success "All services are healthy after restart"
            } else {
                Write-Warning "Some services may not be fully ready yet"
            }
        } else {
            Write-Error "Failed to restart services"
        }
    } finally {
        Pop-Location
    }
}

# Optimize Prometheus
function Optimize-Prometheus {
    Write-Step "Optimizing Prometheus performance..."
    
    # Check Prometheus metrics about itself
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:9090/api/v1/query?query=prometheus_tsdb_head_series" -TimeoutSec 10
        
        if ($response.status -eq "success") {
            $seriesCount = [int]$response.data.result[0].value[1]
            Write-Success "Prometheus is tracking $seriesCount time series"
            
            if ($seriesCount -gt 1000000) {
                Write-Warning "High number of time series detected. Consider reviewing metric retention and cardinality."
            }
        }
    } catch {
        Write-Warning "Could not retrieve Prometheus metrics: $($_.Exception.Message)"
    }
    
    # Check disk usage
    $prometheusDataPath = "monitoring/data/prometheus"
    if (Test-Path $prometheusDataPath) {
        $size = (Get-ChildItem -Path $prometheusDataPath -Recurse | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Success "Prometheus data size: $sizeMB MB"
        
        if ($sizeMB -gt 10000) {  # 10GB
            Write-Warning "Prometheus data size is large. Consider adjusting retention settings."
        }
    }
}

# Check alert rules
function Test-AlertRules {
    Write-Step "Validating alert rules..."
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:9090/api/v1/rules" -TimeoutSec 10
        
        if ($response.status -eq "success") {
            $totalRules = 0
            $firingAlerts = 0
            
            foreach ($group in $response.data.groups) {
                $totalRules += $group.rules.Count
                
                foreach ($rule in $group.rules) {
                    if ($rule.alerts) {
                        foreach ($alert in $rule.alerts) {
                            if ($alert.state -eq "firing") {
                                $firingAlerts++
                            }
                        }
                    }
                }
            }
            
            Write-Success "Alert rules loaded: $totalRules rules"
            
            if ($firingAlerts -gt 0) {
                Write-Warning "$firingAlerts alerts are currently firing"
            } else {
                Write-Success "No alerts currently firing"
            }
        }
    } catch {
        Write-Warning "Could not validate alert rules: $($_.Exception.Message)"
    }
}

# Generate maintenance report
function New-MaintenanceReport {
    Write-Step "Generating maintenance report..."
    
    $reportPath = "monitoring/logs/maintenance-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    $report = @"
TaskManagement Monitoring Maintenance Report
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')
Hostname: $env:COMPUTERNAME
User: $env:USERNAME

=== Service Status ===
$(docker-compose -f monitoring/docker-compose.yml ps)

=== Disk Usage ===
$(Get-ChildItem -Path "monitoring/data" -Recurse | Measure-Object -Property Length -Sum | ForEach-Object { "Total: $([math]::Round($_.Sum / 1MB, 2)) MB" })

=== Container Resource Usage ===
$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}")

=== Recent Logs (Last 50 lines) ===
$(docker-compose -f monitoring/docker-compose.yml logs --tail=50)

=== Maintenance Actions Performed ===
- Log cleanup: $CleanLogs
- Metrics cleanup: $CleanMetrics
- Image updates: $UpdateImages
- Service restart: $RestartServices
- Log retention: $LogRetentionDays days
- Metric retention: $MetricRetentionHours hours

Report generated by maintenance script.
"@
    
    # Ensure logs directory exists
    $logsDir = Split-Path $reportPath -Parent
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    }
    
    $report | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Success "Maintenance report saved: $reportPath"
}

# Main execution
function Main {
    Write-ColorOutput "🔧 TaskManagement Monitoring Maintenance" $Blue
    Write-Host "Clean Logs: $CleanLogs (Retention: $LogRetentionDays days)"
    Write-Host "Clean Metrics: $CleanMetrics (Retention: $MetricRetentionHours hours)"
    Write-Host "Update Images: $UpdateImages"
    Write-Host "Restart Services: $RestartServices"
    Write-Host ""
    
    try {
        $initialHealth = Test-ServiceStatus
        
        if (-not $initialHealth) {
            Write-Warning "Some services are not healthy. Proceeding with maintenance anyway."
        }
        
        Clear-OldLogs
        Clear-OldMetrics
        Update-DockerImages
        
        if ($RestartServices -and -not $UpdateImages) {
            Restart-MonitoringServices
        }
        
        Optimize-Prometheus
        Test-AlertRules
        New-MaintenanceReport
        
        Write-Success "Maintenance completed successfully!"
        
        # Final health check
        $finalHealth = Test-ServiceStatus
        if ($finalHealth) {
            Write-Success "All services are healthy after maintenance"
        } else {
            Write-Warning "Some services may need attention after maintenance"
        }
        
    } catch {
        Write-Error "Maintenance failed: $($_.Exception.Message)"
        Write-Host "Stack trace: $($_.ScriptStackTrace)"
        exit 1
    }
}

# Run main function
Main