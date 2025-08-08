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
    
    # Domain-specific controller mappings
    '@/presentation/controllers/analytics.controller' = '@/domains/analytics/controllers/analytics.controller'
    '@/presentation/controllers/activity.controller' = '@/domains/analytics/controllers/activity.controller'
    '@/presentation/controllers/dashboard.controller' = '@/domains/analytics/controllers/dashboard.controller'
    '@/presentation/controllers/auth.controller' = '@/domains/authentication/controllers/auth.controller'
    '@/presentation/controllers/user.controller' = '@/domains/authentication/controllers/user.controller'
    '@/presentation/controllers/calendar.controller' = '@/domains/calendar/controllers/calendar.controller'
    '@/presentation/controllers/comment.controller' = '@/domains/collaboration/controllers/comment.controller'
    '@/presentation/controllers/presence.controller' = '@/domains/collaboration/controllers/presence.controller'
    '@/presentation/controllers/file-management.controller' = '@/domains/file-management/controllers/file-management.controller'
    '@/presentation/controllers/attachment.controller' = '@/domains/file-management/controllers/attachment.controller'
    '@/presentation/controllers/notification.controller' = '@/domains/notification/controllers/notification.controller'
    '@/presentation/controllers/search.controller' = '@/domains/search/controllers/search.controller'
    '@/presentation/controllers/task.controller' = '@/domains/task-management/controllers/task.controller'
    '@/presentation/controllers/enhanced-task.controller' = '@/domains/task-management/controllers/enhanced-task.controller'
    '@/presentation/controllers/project.controller' = '@/domains/task-management/controllers/project.controller'
    '@/presentation/controllers/workspace.controller' = '@/domains/task-management/controllers/workspace.controller'
    '@/presentation/controllers/team.controller' = '@/domains/task-management/controllers/team.controller'
    '@/presentation/controllers/task-template.controller' = '@/domains/task-management/controllers/task-template.controller'
    '@/presentation/controllers/recurring-task.controller' = '@/domains/task-management/controllers/recurring-task.controller'
    '@/presentation/controllers/invitation.controller' = '@/domains/task-management/controllers/invitation.controller'
    '@/presentation/controllers/webhook.controller' = '@/domains/webhook/controllers/webhook.controller'
    '@/presentation/controllers/monitoring.controller' = '@/domains/system-monitoring/controllers/monitoring.controller'
    '@/presentation/controllers/health.controller' = '@/domains/system-monitoring/controllers/health.controller'
    '@/presentation/controllers/performance.controller' = '@/domains/system-monitoring/controllers/performance.controller'
    
    # Domain-specific route mappings
    '@/presentation/routes/analytics.routes' = '@/domains/analytics/routes/analytics.routes'
    '@/presentation/routes/activity.routes' = '@/domains/analytics/routes/activity.routes'
    '@/presentation/routes/dashboard.routes' = '@/domains/analytics/routes/dashboard.routes'
    '@/presentation/routes/auth.routes' = '@/domains/authentication/routes/auth.routes'
    '@/presentation/routes/user.routes' = '@/domains/authentication/routes/user.routes'
    '@/presentation/routes/unified-auth.routes' = '@/domains/authentication/routes/unified-auth.routes'
    '@/presentation/routes/calendar.routes' = '@/domains/calendar/routes/calendar.routes'
    '@/presentation/routes/comment.routes' = '@/domains/collaboration/routes/comment.routes'
    '@/presentation/routes/presence.routes' = '@/domains/collaboration/routes/presence.routes'
    '@/presentation/routes/file-management.routes' = '@/domains/file-management/routes/file-management.routes'
    '@/presentation/routes/notification.routes' = '@/domains/notification/routes/notification.routes'
    '@/presentation/routes/search.routes' = '@/domains/search/routes/search.routes'
    '@/presentation/routes/task.routes' = '@/domains/task-management/routes/task.routes'
    '@/presentation/routes/enhanced-task.routes' = '@/domains/task-management/routes/enhanced-task.routes'
    '@/presentation/routes/project.routes' = '@/domains/task-management/routes/project.routes'
    '@/presentation/routes/workspace.routes' = '@/domains/task-management/routes/workspace.routes'
    '@/presentation/routes/team.routes' = '@/domains/task-management/routes/team.routes'
    '@/presentation/routes/task-template.routes' = '@/domains/task-management/routes/task-template.routes'
    '@/presentation/routes/recurring-task.routes' = '@/domains/task-management/routes/recurring-task.routes'
    '@/presentation/routes/invitation.routes' = '@/domains/task-management/routes/invitation.routes'
    '@/presentation/routes/webhook.routes' = '@/domains/webhook/routes/webhook.routes'
    '@/presentation/routes/monitoring.routes' = '@/domains/system-monitoring/routes/monitoring.routes'
    '@/presentation/routes/health.routes' = '@/domains/system-monitoring/routes/health.routes'
    '@/presentation/routes/performance.routes' = '@/domains/system-monitoring/routes/performance.routes'
    '@/presentation/routes/metrics.routes' = '@/domains/system-monitoring/routes/metrics.routes'
    
    # Domain-specific validator mappings
    '@/presentation/validators/activity.validator' = '@/domains/analytics/validators/activity.validator'
    '@/presentation/validators/auth.validator' = '@/domains/authentication/validators/auth.validator'
    '@/presentation/validators/unified-auth.validators' = '@/domains/authentication/validators/unified-auth.validators'
    '@/presentation/validators/calendar.validator' = '@/domains/calendar/validators/calendar.validator'
    '@/presentation/validators/calendar-event.validator' = '@/domains/calendar/validators/calendar-event.validator'
    '@/presentation/validators/comment.validator' = '@/domains/collaboration/validators/comment.validator'
    '@/presentation/validators/notification.validator' = '@/domains/notification/validators/notification.validator'
    '@/presentation/validators/search.validator' = '@/domains/search/validators/search.validator'
    '@/presentation/validators/task.validator' = '@/domains/task-management/validators/task.validator'
    '@/presentation/validators/project.validator' = '@/domains/task-management/validators/project.validator'
    '@/presentation/validators/workspace.validator' = '@/domains/task-management/validators/workspace.validator'
    '@/presentation/validators/team.validator' = '@/domains/task-management/validators/team.validator'
    '@/presentation/validators/task-template.validator' = '@/domains/task-management/validators/task-template.validator'
    '@/presentation/validators/recurring-task.validator' = '@/domains/task-management/validators/recurring-task.validator'
    '@/presentation/validators/invitation.validator' = '@/domains/task-management/validators/invitation.validator'
    '@/presentation/validators/webhook.validator' = '@/domains/webhook/validators/webhook.validator'
    
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
    
    # Infrastructure repository mappings
    '@/infrastructure/repositories/task.repository.impl' = '@/domains/task-management/repositories/task.repository.impl'
    '@/infrastructure/repositories/project.repository.impl' = '@/domains/task-management/repositories/project.repository.impl'
    '@/infrastructure/repositories/calendar-event.repository.impl' = '@/domains/calendar/repositories/calendar-event.repository.impl'
    '@/infrastructure/repositories/prisma-file.repository' = '@/domains/file-management/repositories/prisma-file.repository'
    '@/infrastructure/search/postgresql-search.repository' = '@/domains/search/repositories/postgresql-search.repository'
    '@/infrastructure/webhook/webhook.repository.impl' = '@/domains/webhook/repositories/webhook.repository.impl'
    '@/infrastructure/webhook/webhook-delivery.repository.impl' = '@/domains/webhook/repositories/webhook-delivery.repository.impl'
    
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
            
            # Handle different import statement formats
            $patterns = @(
                "import\s+.*\s+from\s+['""]$([regex]::Escape($oldPath))['""]",
                "import\s*\(\s*['""]$([regex]::Escape($oldPath))['""]",
                "require\s*\(\s*['""]$([regex]::Escape($oldPath))['""]"
            )
            
            foreach ($pattern in $patterns) {
                $matches = [regex]::Matches($content, $pattern)
                if ($matches.Count -gt 0) {
                    $content = $content -replace [regex]::Escape($oldPath), $newPath
                    $changesCount += $matches.Count
                    
                    if ($Verbose) {
                        Write-Host "  📝 Updated $($matches.Count) occurrences: $oldPath → $newPath" -ForegroundColor Green
                    }
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

# Function to update relative imports within domain directories
function Update-DomainRelativeImports {
    param(
        [string]$DomainPath,
        [switch]$DryRun,
        [switch]$Verbose
    )
    
    if (-not (Test-Path $DomainPath)) {
        return
    }
    
    $domainName = Split-Path $DomainPath -Leaf
    Write-Host "🔧 Updating relative imports in domain: $domainName" -ForegroundColor Cyan
    
    # Get all TypeScript files in the domain
    $tsFiles = Get-ChildItem $DomainPath -Filter "*.ts" -Recurse
    
    foreach ($file in $tsFiles) {
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content
        $changesCount = 0
        
        # Update relative imports within the domain
        $relativeMappings = @{
            # Within domain relative imports
            '../controllers/' = './controllers/'
            '../routes/' = './routes/'
            '../validators/' = './validators/'
            '../services/' = './services/'
            '../entities/' = './entities/'
            '../repositories/' = './repositories/'
            '../schemas/' = './schemas/'
            '../events/' = './events/'
            '../value-objects/' = './value-objects/'
            '../specifications/' = './specifications/'
            
            # Cross-subdirectory imports
            '../../controllers/' = '../controllers/'
            '../../routes/' = '../routes/'
            '../../validators/' = '../validators/'
            '../../services/' = '../services/'
            '../../entities/' = '../entities/'
            '../../repositories/' = '../repositories/'
            '../../schemas/' = '../schemas/'
            '../../events/' = '../events/'
            '../../value-objects/' = '../value-objects/'
            '../../specifications/' = '../specifications/'
        }
        
        foreach ($oldPath in $relativeMappings.Keys) {
            $newPath = $relativeMappings[$oldPath]
            if ($content -match [regex]::Escape($oldPath)) {
                $content = $content -replace [regex]::Escape($oldPath), $newPath
                $changesCount++
            }
        }
        
        if ($changesCount -gt 0) {
            if (-not $DryRun) {
                Set-Content $file.FullName $content -NoNewline
            }
            
            if ($Verbose) {
                Write-Host "  ✅ Updated relative imports in $($file.Name) ($changesCount changes)" -ForegroundColor Green
            }
        }
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
    
    # Update relative imports within each domain
    Write-Host "🔧 Updating relative imports within domains..." -ForegroundColor Cyan
    $domainDirs = Get-ChildItem "src\domains" -Directory
    
    foreach ($domainDir in $domainDirs) {
        Update-DomainRelativeImports -DomainPath $domainDir.FullName -DryRun:$DryRun -Verbose:$Verbose
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host "`n✅ Import statement update completed!" -ForegroundColor Green
    Write-Host "📊 Summary:" -ForegroundColor Cyan
    Write-Host "   • Files processed: $processedFiles" -ForegroundColor White
    Write-Host "   • Files updated: $updatedFiles" -ForegroundColor White
    Write-Host "   • Duration: $($duration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "ℹ️  This was a dry run. To apply changes, run without -DryRun flag" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Script execution failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}