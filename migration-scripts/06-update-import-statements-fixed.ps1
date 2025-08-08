# PowerShell Script: Update Import Statements Throughout Codebase
# This script comprehensively updates all import statements to reflect the new domain-driven architecture

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

Write-Host "🔄 Starting comprehensive import statement updates..." -ForegroundColor Cyan

# Define comprehensive import mappings
$importMappings = @{
    # Shared resources mappings
    '@/domain/shared' = '@/shared/domain'
    '@/utils' = '@/shared/utils'
    '@/infrastructure/config' = '@/shared/config'
    '@/presentation/middleware' = '@/shared/middleware'
    
    # Legacy relative path mappings for shared resources
    '../domain/shared' = '../shared/domain'
    '../../domain/shared' = '../../shared/domain'
    '../../../domain/shared' = '../../../shared/domain'
    '../utils' = '../shared/utils'
    '../../utils' = '../../shared/utils'
    '../../../utils' = '../../../shared/utils'
    '../infrastructure/config' = '../shared/config'
    '../../infrastructure/config' = '../../shared/config'
    '../presentation/middleware' = '../shared/middleware'
    '../../presentation/middleware' = '../../shared/middleware'
    
    # Domain service mappings
    '@/domain/analytics/services' = '@/domains/analytics/services'
    '@/domain/authentication/services' = '@/domains/authentication/services'
    '@/domain/calendar/services' = '@/domains/calendar/services'
    '@/domain/collaboration/services' = '@/domains/collaboration/services'
    '@/domain/file-management/services' = '@/domains/file-management/services'
    '@/domain/notification/services' = '@/domains/notification/services'
    '@/domain/search/services' = '@/domains/search/services'
    '@/domain/task-management/services' = '@/domains/task-management/services'
    '@/domain/webhook/services' = '@/domains/webhook/services'
    '@/domain/system-monitoring/services' = '@/domains/system-monitoring/services'
    '@/domain/audit/services' = '@/domains/audit/services'
    
    # Domain entity mappings
    '@/domain/analytics/entities' = '@/domains/analytics/entities'
    '@/domain/authentication/entities' = '@/domains/authentication/entities'
    '@/domain/calendar/entities' = '@/domains/calendar/entities'
    '@/domain/collaboration/entities' = '@/domains/collaboration/entities'
    '@/domain/file-management/entities' = '@/domains/file-management/entities'
    '@/domain/notification/entities' = '@/domains/notification/entities'
    '@/domain/search/entities' = '@/domains/search/entities'
    '@/domain/task-management/entities' = '@/domains/task-management/entities'
    '@/domain/webhook/entities' = '@/domains/webhook/entities'
    '@/domain/system-monitoring/entities' = '@/domains/system-monitoring/entities'
    '@/domain/audit/entities' = '@/domains/audit/entities'
    
    # Domain repository mappings
    '@/domain/analytics/repositories' = '@/domains/analytics/repositories'
    '@/domain/authentication/repositories' = '@/domains/authentication/repositories'
    '@/domain/calendar/repositories' = '@/domains/calendar/repositories'
    '@/domain/collaboration/repositories' = '@/domains/collaboration/repositories'
    '@/domain/file-management/repositories' = '@/domains/file-management/repositories'
    '@/domain/notification/repositories' = '@/domains/notification/repositories'
    '@/domain/search/repositories' = '@/domains/search/repositories'
    '@/domain/task-management/repositories' = '@/domains/task-management/repositories'
    '@/domain/webhook/repositories' = '@/domains/webhook/repositories'
    '@/domain/system-monitoring/repositories' = '@/domains/system-monitoring/repositories'
    '@/domain/audit/repositories' = '@/domains/audit/repositories'
    
    # Schema mappings
    '@/infrastructure/database/drizzle/schema/activities' = '@/domains/analytics/schemas/activities'
    '@/infrastructure/database/drizzle/schema/users' = '@/domains/authentication/schemas/users'
    '@/infrastructure/database/drizzle/schema/calendar-events' = '@/domains/calendar/schemas/calendar-events'
    '@/infrastructure/database/drizzle/schema/calendar-integrations' = '@/domains/calendar/schemas/calendar-integrations'
    '@/infrastructure/database/drizzle/schema/comments' = '@/domains/collaboration/schemas/comments'
    '@/infrastructure/database/drizzle/schema/notifications' = '@/domains/notification/schemas/notifications'
    '@/infrastructure/database/drizzle/schema/tasks' = '@/domains/task-management/schemas/tasks'
    '@/infrastructure/database/drizzle/schema/projects' = '@/domains/task-management/schemas/projects'
    '@/infrastructure/database/drizzle/schema/workspaces' = '@/domains/task-management/schemas/workspaces'
    '@/infrastructure/database/drizzle/schema/teams' = '@/domains/task-management/schemas/teams'
    '@/infrastructure/database/drizzle/schema/invitations' = '@/domains/task-management/schemas/invitations'
    '@/infrastructure/database/drizzle/schema/task-templates' = '@/domains/task-management/schemas/task-templates'
    '@/infrastructure/database/drizzle/schema/recurring-tasks' = '@/domains/task-management/schemas/recurring-tasks'
    '@/infrastructure/database/drizzle/schema/audit-logs' = '@/domains/audit/schemas/audit-logs'
    
    # Domain event mappings
    '@/domain/analytics/events' = '@/domains/analytics/events'
    '@/domain/authentication/events' = '@/domains/authentication/events'
    '@/domain/calendar/events' = '@/domains/calendar/events'
    '@/domain/collaboration/events' = '@/domains/collaboration/events'
    '@/domain/file-management/events' = '@/domains/file-management/events'
    '@/domain/notification/events' = '@/domains/notification/events'
    '@/domain/search/events' = '@/domains/search/events'
    '@/domain/task-management/events' = '@/domains/task-management/events'
    '@/domain/webhook/events' = '@/domains/webhook/events'
    '@/domain/system-monitoring/events' = '@/domains/system-monitoring/events'
    '@/domain/audit/events' = '@/domains/audit/events'
    
    # Domain value object mappings
    '@/domain/analytics/value-objects' = '@/domains/analytics/value-objects'
    '@/domain/authentication/value-objects' = '@/domains/authentication/value-objects'
    '@/domain/calendar/value-objects' = '@/domains/calendar/value-objects'
    '@/domain/collaboration/value-objects' = '@/domains/collaboration/value-objects'
    '@/domain/file-management/value-objects' = '@/domains/file-management/value-objects'
    '@/domain/notification/value-objects' = '@/domains/notification/value-objects'
    '@/domain/search/value-objects' = '@/domains/search/value-objects'
    '@/domain/task-management/value-objects' = '@/domains/task-management/value-objects'
    '@/domain/webhook/value-objects' = '@/domains/webhook/value-objects'
    '@/domain/system-monitoring/value-objects' = '@/domains/system-monitoring/value-objects'
    '@/domain/audit/value-objects' = '@/domains/audit/value-objects'
    
    # Domain specification mappings
    '@/domain/task-management/specifications' = '@/domains/task-management/specifications'
    
    # Application service mappings (consolidation)
    '@/application/services/calendar-integration.service' = '@/domains/calendar/services/calendar-integration.service'
    '@/application/services/calendar-sync.service' = '@/domains/calendar/services/calendar-sync.service'
    '@/application/services/email.service' = '@/domains/notification/services/email.service'
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
            Write-Host "⚠️  File not found: $FilePath" -ForegroundColor Yellow
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
                    Write-Host "  📝 Updated: $oldPath → $newPath" -ForegroundColor Green
                }
            }
        }
        
        # Write changes if any were made
        if ($changesCount -gt 0) {
            if (-not $DryRun) {
                Set-Content $FilePath $content -NoNewline -ErrorAction Stop
            }
            
            Write-Host "✅ Updated $FilePath ($changesCount changes)" -ForegroundColor Green
            return $true
        } else {
            if ($Verbose) {
                Write-Host "ℹ️  No changes needed: $FilePath" -ForegroundColor Gray
            }
            return $false
        }
    } catch {
        Write-Host "❌ Error processing $FilePath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main execution
try {
    $startTime = Get-Date
    
    if ($DryRun) {
        Write-Host "🔍 Running in DRY RUN mode - no files will be modified" -ForegroundColor Yellow
    }
    
    # Get all TypeScript files in the src directory
    Write-Host "📁 Scanning for TypeScript files..." -ForegroundColor Cyan
    $tsFiles = Get-ChildItem "src" -Filter "*.ts" -Recurse | Where-Object { $_.Name -notmatch "\.d\.ts$" }
    Write-Host "📊 Found $($tsFiles.Count) TypeScript files to process" -ForegroundColor Cyan
    
    $processedFiles = 0
    $updatedFiles = 0
    
    # Process each TypeScript file
    foreach ($file in $tsFiles) {
        $processedFiles++
        
        if ($Verbose) {
            Write-Host "🔄 Processing ($processedFiles/$($tsFiles.Count)): $($file.FullName)" -ForegroundColor Gray
        }
        
        $wasUpdated = Update-FileImports -FilePath $file.FullName -Mappings $importMappings -DryRun:$DryRun -Verbose:$Verbose
        
        if ($wasUpdated) {
            $updatedFiles++
        }
        
        # Show progress every 10 files
        if ($processedFiles % 10 -eq 0) {
            Write-Host "📈 Progress: $processedFiles/$($tsFiles.Count) files processed, $updatedFiles updated" -ForegroundColor Cyan
        }
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host "`n✅ Import statement update completed!" -ForegroundColor Green
    Write-Host "📊 Summary:" -ForegroundColor Cyan
    Write-Host "   • Files processed: $processedFiles" -ForegroundColor White
    Write-Host "   • Files updated: $updatedFiles" -ForegroundColor White
    Write-Host "   • Duration: $($duration.TotalSeconds) seconds" -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "ℹ️  This was a dry run. To apply changes, run without -DryRun flag" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Script execution failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}