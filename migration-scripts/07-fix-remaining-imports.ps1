# PowerShell Script: Fix Remaining Import Issues
param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

Write-Host "Starting additional import fixes..." -ForegroundColor Cyan

# Additional import mappings for edge cases
$additionalMappings = @{
    # Fix relative imports that might be broken
    '../middleware/error.middleware' = '../shared/middleware/error.middleware'
    '../../middleware/error.middleware' = '../../shared/middleware/error.middleware'
    '../middleware/auth' = '../shared/middleware/auth'
    '../../middleware/auth' = '../../shared/middleware/auth'
    '../utils/async-handler' = '../shared/utils/async-handler'
    '../../utils/async-handler' = '../../shared/utils/async-handler'
    '../utils/response-formatter' = '../shared/utils/response-formatter'
    '../../utils/response-formatter' = '../../shared/utils/response-formatter'
    '../services' = '../services'
    
    # Fix presentation layer imports that reference moved files
    './activity.routes' = '../../domains/analytics/routes/activity.routes'
    './analytics.routes' = '../../domains/analytics/routes/analytics.routes'
    './dashboard.routes' = '../../domains/analytics/routes/dashboard.routes'
    './auth.routes' = '../../domains/authentication/routes/auth.routes'
    './user.routes' = '../../domains/authentication/routes/user.routes'
    './unified-auth.routes' = '../../domains/authentication/routes/unified-auth.routes'
    './comment.routes' = '../../domains/collaboration/routes/comment.routes'
    './presence.routes' = '../../domains/collaboration/routes/presence.routes'
    './notification.routes' = '../../domains/notification/routes/notification.routes'
    './search.routes' = '../../domains/search/routes/search.routes'
    './task.routes' = '../../domains/task-management/routes/task.routes'
    './project.routes' = '../../domains/task-management/routes/project.routes'
    './workspace.routes' = '../../domains/task-management/routes/workspace.routes'
    './team.routes' = '../../domains/task-management/routes/team.routes'
    './task-template.routes' = '../../domains/task-management/routes/task-template.routes'
    './recurring-task.routes' = '../../domains/task-management/routes/recurring-task.routes'
    './invitation.routes' = '../../domains/task-management/routes/invitation.routes'
    './webhook.routes' = '../../domains/webhook/routes/webhook.routes'
    './monitoring.routes' = '../../domains/system-monitoring/routes/monitoring.routes'
    './health.routes' = '../../domains/system-monitoring/routes/health.routes'
    './performance.routes' = '../../domains/system-monitoring/routes/performance.routes'
    './metrics.routes' = '../../domains/system-monitoring/routes/metrics.routes'
}

# Function to update imports in a file
function Update-FileImports {
    param(
        [string]$FilePath,
        [hashtable]$Mappings,
        [switch]$DryRun,
        [switch]$Verbose
    )
    
    if (-not (Test-Path $FilePath)) {
        if ($Verbose) {
            Write-Host "File not found: $FilePath" -ForegroundColor Yellow
        }
        return $false
    }
    
    try {
        $content = Get-Content $FilePath -Raw -ErrorAction Stop
        $originalContent = $content
        $changesCount = 0
        
        # Process each mapping
        foreach ($oldPath in $Mappings.Keys) {
            $newPath = $Mappings[$oldPath]
            
            # Simple string replacement for import paths
            if ($content.Contains($oldPath)) {
                $content = $content.Replace($oldPath, $newPath)
                $changesCount++
                
                if ($Verbose) {
                    Write-Host "  Updated: $oldPath -> $newPath" -ForegroundColor Green
                }
            }
        }
        
        # Write changes if any were made
        if ($changesCount -gt 0) {
            if (-not $DryRun) {
                Set-Content $FilePath $content -NoNewline -ErrorAction Stop
            }
            
            Write-Host "Updated $FilePath ($changesCount changes)" -ForegroundColor Green
            return $true
        } else {
            if ($Verbose) {
                Write-Host "No changes needed: $FilePath" -ForegroundColor Gray
            }
            return $false
        }
    } catch {
        Write-Host "Error processing $FilePath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main execution
try {
    $startTime = Get-Date
    
    if ($DryRun) {
        Write-Host "Running in DRY RUN mode - no files will be modified" -ForegroundColor Yellow
    }
    
    # Focus on specific files that are likely to have import issues
    $targetFiles = @(
        "src/app.ts",
        "src/index.ts",
        "src/presentation/routes/index.ts"
    )
    
    # Add all TypeScript files in presentation layer
    $presentationFiles = Get-ChildItem "src/presentation" -Filter "*.ts" -Recurse
    $targetFiles += $presentationFiles | ForEach-Object { $_.FullName }
    
    Write-Host "Found $($targetFiles.Count) files to process" -ForegroundColor Cyan
    
    $processedFiles = 0
    $updatedFiles = 0
    
    # Process each file
    foreach ($file in $targetFiles) {
        $processedFiles++
        
        if ($Verbose) {
            Write-Host "Processing ($processedFiles/$($targetFiles.Count)): $file" -ForegroundColor Gray
        }
        
        $wasUpdated = Update-FileImports -FilePath $file -Mappings $additionalMappings -DryRun:$DryRun -Verbose:$Verbose
        
        if ($wasUpdated) {
            $updatedFiles++
        }
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-Host "Additional import fixes completed!" -ForegroundColor Green
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "   Files processed: $processedFiles" -ForegroundColor White
    Write-Host "   Files updated: $updatedFiles" -ForegroundColor White
    Write-Host "   Duration: $($duration.TotalSeconds) seconds" -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "This was a dry run. To apply changes, run without -DryRun flag" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Script execution failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}