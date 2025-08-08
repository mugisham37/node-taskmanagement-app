# Domain-Driven Architecture Migration Script - Domain Files Migration
# Generated: $(Get-Date)
# Purpose: Migrate all domain-specific files to their respective domain directories

Write-Host "=== Domain-Driven Architecture Migration - Domain Files ===" -ForegroundColor Cyan
Write-Host "Starting domain-specific file migration..." -ForegroundColor Yellow

$totalMigratedFiles = 0
$errors = @()

# Function to safely move files
function Move-FileSafely {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description
    )
    
    try {
        if (Test-Path $Source) {
            # Ensure destination directory exists
            $destDir = Split-Path $Destination -Parent
            if (!(Test-Path $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            
            Move-Item -Path $Source -Destination $Destination -Force
            Write-Host "  ✓ Moved: $Description" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ⚠ Source not found: $Source" -ForegroundColor Yellow
            return $false
        }
    } catch {
        $script:errors += "Failed to move $Source to $Destination : $($_.Exception.Message)"
        Write-Host "  ✗ Failed: $Description - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Domain migration configurations
$domainMigrations = @{
    "analytics" = @{
        "controllers" = @("analytics.controller.ts", "activity.controller.ts", "dashboard.controller.ts")
        "routes" = @("analytics.routes.ts", "activity.routes.ts", "dashboard.routes.ts")
        "validators" = @("activity.validator.ts")
        "schemas" = @("activities.ts")
        "repositories" = @("activity.repository.ts")
    }
    "authentication" = @{
        "controllers" = @("auth.controller.ts", "user.controller.ts")
        "routes" = @("auth.routes.ts", "user.routes.ts", "unified-auth.routes.ts")
        "validators" = @("auth.validator.ts", "unified-auth.validators.ts")
        "schemas" = @("users.ts")
        "repositories" = @("user.repository.ts")
    }
    "calendar" = @{
        "controllers" = @("calendar.controller.ts")
        "routes" = @("calendar.routes.ts")
        "validators" = @("calendar.validator.ts", "calendar-event.validator.ts")
        "schemas" = @("calendar-events.ts", "calendar-integrations.ts")
        "repositories" = @("calendar-event.repository.ts", "calendar-integration.repository.ts")
        "application_services" = @("calendar-event.application.service.ts", "calendar-integration.application.service.ts")
        "infrastructure_repos" = @("calendar-event.repository.impl.ts")
    }
    "collaboration" = @{
        "controllers" = @("comment.controller.ts", "presence.controller.ts")
        "routes" = @("comment.routes.ts", "presence.routes.ts")
        "validators" = @("comment.validator.ts")
        "schemas" = @("comments.ts")
        "repositories" = @("comment.repository.ts")
    }
    "file-management" = @{
        "controllers" = @("file-management.controller.ts", "attachment.controller.ts")
        "routes" = @("file-management.routes.ts")
        "infrastructure_repos" = @("prisma-file.repository.ts")
    }
    "notification" = @{
        "controllers" = @("notification.controller.ts")
        "routes" = @("notification.routes.ts")
        "validators" = @("notification.validator.ts")
        "schemas" = @("notifications.ts")
        "repositories" = @("notification.repository.ts")
        "application_services" = @("email.service.ts")
    }
    "search" = @{
        "controllers" = @("search.controller.ts")
        "routes" = @("search.routes.ts")
        "validators" = @("search.validator.ts")
        "infrastructure_search" = @("postgresql-saved-search.repository.ts", "postgresql-search-index.repository.ts")
    }
    "task-management" = @{
        "controllers" = @("task.controller.ts", "enhanced-task.controller.ts", "project.controller.ts", "workspace.controller.ts", "team.controller.ts", "task-template.controller.ts", "recurring-task.controller.ts", "invitation.controller.ts")
        "routes" = @("task.routes.ts", "enhanced-task.routes.ts", "project.routes.ts", "workspace.routes.ts", "team.routes.ts", "task-template.routes.ts", "recurring-task.routes.ts", "invitation.routes.ts")
        "validators" = @("task.validator.ts", "project.validator.ts", "workspace.validator.ts", "team.validator.ts", "task-template.validator.ts", "recurring-task.validator.ts", "invitation.validator.ts")
        "schemas" = @("tasks.ts", "projects.ts", "workspaces.ts", "teams.ts", "task-templates.ts", "recurring-tasks.ts", "invitations.ts")
        "repositories" = @("task.repository.ts", "project.repository.ts", "workspace.repository.ts", "team.repository.ts", "task-template.repository.ts", "recurring-task.repository.ts", "invitation.repository.ts")
        "infrastructure_repos" = @("task.repository.impl.ts", "project.repository.impl.ts")
    }
    "webhook" = @{
        "controllers" = @("webhook.controller.ts")
        "routes" = @("webhook.routes.ts")
        "validators" = @("webhook.validator.ts")
        "infrastructure_webhook" = @("webhook.repository.impl.ts", "webhook-delivery.repository.impl.ts")
    }
    "system-monitoring" = @{
        "controllers" = @("monitoring.controller.ts", "health.controller.ts", "performance.controller.ts")
        "routes" = @("monitoring.routes.ts", "health.routes.ts", "performance.routes.ts", "metrics.routes.ts")
    }
    "audit" = @{
        "schemas" = @("audit-logs.ts")
        "repositories" = @("audit.repository.ts")
    }
}

# Additional files that need special handling
$specialFiles = @{
    "feedback" = @{
        "controllers" = @("feedback.controller.ts")
        "routes" = @("feedback.routes.ts")
        "validators" = @("feedback.validator.ts")
        "schemas" = @("feedback.ts")
        "repositories" = @("feedback.repository.ts")
        "application_services" = @("feedback.service.ts")
        "target_domain" = "system-monitoring"  # Assign to system-monitoring domain
    }
    "export-import" = @{
        "controllers" = @("export-import.controller.ts")
        "routes" = @("export-import.routes.ts")
        "application_services" = @("data-import-export.service.ts")
        "target_domain" = "task-management"  # Assign to task-management domain
    }
}

# Migrate each domain
foreach ($domain in $domainMigrations.Keys) {
    Write-Host "`nMigrating domain: $domain" -ForegroundColor Cyan
    $domainConfig = $domainMigrations[$domain]
    $domainMigratedFiles = 0
    
    # Migrate controllers
    if ($domainConfig.ContainsKey("controllers")) {
        Write-Host "  Migrating controllers..." -ForegroundColor Yellow
        foreach ($controller in $domainConfig["controllers"]) {
            $source = "src\presentation\controllers\$controller"
            $destination = "src\domains\$domain\controllers\$controller"
            if (Move-FileSafely $source $destination "Controller: $controller") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate routes
    if ($domainConfig.ContainsKey("routes")) {
        Write-Host "  Migrating routes..." -ForegroundColor Yellow
        foreach ($route in $domainConfig["routes"]) {
            $source = "src\presentation\routes\$route"
            $destination = "src\domains\$domain\routes\$route"
            if (Move-FileSafely $source $destination "Route: $route") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate validators
    if ($domainConfig.ContainsKey("validators")) {
        Write-Host "  Migrating validators..." -ForegroundColor Yellow
        foreach ($validator in $domainConfig["validators"]) {
            $source = "src\presentation\validators\$validator"
            $destination = "src\domains\$domain\validators\$validator"
            if (Move-FileSafely $source $destination "Validator: $validator") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate schemas
    if ($domainConfig.ContainsKey("schemas")) {
        Write-Host "  Migrating schemas..." -ForegroundColor Yellow
        foreach ($schema in $domainConfig["schemas"]) {
            $source = "src\infrastructure\database\drizzle\schema\$schema"
            $destination = "src\domains\$domain\schemas\$schema"
            if (Move-FileSafely $source $destination "Schema: $schema") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate drizzle repositories
    if ($domainConfig.ContainsKey("repositories")) {
        Write-Host "  Migrating drizzle repositories..." -ForegroundColor Yellow
        foreach ($repo in $domainConfig["repositories"]) {
            $source = "src\infrastructure\database\drizzle\repositories\$repo"
            $destination = "src\domains\$domain\repositories\$repo"
            if (Move-FileSafely $source $destination "Repository: $repo") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate infrastructure repositories
    if ($domainConfig.ContainsKey("infrastructure_repos")) {
        Write-Host "  Migrating infrastructure repositories..." -ForegroundColor Yellow
        foreach ($repo in $domainConfig["infrastructure_repos"]) {
            $source = "src\infrastructure\repositories\$repo"
            $destination = "src\domains\$domain\repositories\$repo"
            if (Move-FileSafely $source $destination "Infrastructure Repository: $repo") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate application services
    if ($domainConfig.ContainsKey("application_services")) {
        Write-Host "  Migrating application services..." -ForegroundColor Yellow
        foreach ($service in $domainConfig["application_services"]) {
            $source = "src\application\services\$service"
            $destination = "src\domains\$domain\services\$service"
            if (Move-FileSafely $source $destination "Application Service: $service") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate search infrastructure (special case for search domain)
    if ($domainConfig.ContainsKey("infrastructure_search")) {
        Write-Host "  Migrating search infrastructure..." -ForegroundColor Yellow
        foreach ($searchFile in $domainConfig["infrastructure_search"]) {
            $source = "src\infrastructure\search\$searchFile"
            $destination = "src\domains\$domain\repositories\$searchFile"
            if (Move-FileSafely $source $destination "Search Infrastructure: $searchFile") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate webhook infrastructure (special case for webhook domain)
    if ($domainConfig.ContainsKey("infrastructure_webhook")) {
        Write-Host "  Migrating webhook infrastructure..." -ForegroundColor Yellow
        foreach ($webhookFile in $domainConfig["infrastructure_webhook"]) {
            $source = "src\infrastructure\webhook\$webhookFile"
            $destination = "src\domains\$domain\repositories\$webhookFile"
            if (Move-FileSafely $source $destination "Webhook Infrastructure: $webhookFile") {
                $domainMigratedFiles++
            }
        }
    }
    
    # Migrate existing domain files (services, entities, repositories, etc.)
    Write-Host "  Migrating existing domain files..." -ForegroundColor Yellow
    $existingDomainPath = "src\domain\$domain"
    if (Test-Path $existingDomainPath) {
        $subDirs = @("services", "entities", "repositories", "events", "value-objects", "specifications")
        foreach ($subDir in $subDirs) {
            $sourcePath = "$existingDomainPath\$subDir"
            if (Test-Path $sourcePath) {
                $files = Get-ChildItem $sourcePath -File -Filter "*.ts"
                foreach ($file in $files) {
                    $destination = "src\domains\$domain\$subDir\$($file.Name)"
                    if (Move-FileSafely $file.FullName $destination "Domain $subDir : $($file.Name)") {
                        $domainMigratedFiles++
                    }
                }
            }
        }
        
        # Remove empty domain directory
        try {
            Remove-Item $existingDomainPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Removed empty domain directory: $existingDomainPath" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ Could not remove domain directory: $existingDomainPath" -ForegroundColor Yellow
        }
    }
    
    Write-Host "  Domain '$domain' migration completed: $domainMigratedFiles files" -ForegroundColor Cyan
    $totalMigratedFiles += $domainMigratedFiles
}

# Handle special files (feedback, export-import)
Write-Host "`nMigrating special files..." -ForegroundColor Cyan
foreach ($specialKey in $specialFiles.Keys) {
    $specialConfig = $specialFiles[$specialKey]
    $targetDomain = $specialConfig["target_domain"]
    
    Write-Host "  Migrating $specialKey files to $targetDomain domain..." -ForegroundColor Yellow
    
    # Migrate each type of file
    foreach ($fileType in $specialConfig.Keys) {
        if ($fileType -eq "target_domain") { continue }
        
        foreach ($fileName in $specialConfig[$fileType]) {
            $source = ""
            $destination = ""
            
            switch ($fileType) {
                "controllers" { 
                    $source = "src\presentation\controllers\$fileName"
                    $destination = "src\domains\$targetDomain\controllers\$fileName"
                }
                "routes" { 
                    $source = "src\presentation\routes\$fileName"
                    $destination = "src\domains\$targetDomain\routes\$fileName"
                }
                "validators" { 
                    $source = "src\presentation\validators\$fileName"
                    $destination = "src\domains\$targetDomain\validators\$fileName"
                }
                "schemas" { 
                    $source = "src\infrastructure\database\drizzle\schema\$fileName"
                    $destination = "src\domains\$targetDomain\schemas\$fileName"
                }
                "repositories" { 
                    $source = "src\infrastructure\database\drizzle\repositories\$fileName"
                    $destination = "src\domains\$targetDomain\repositories\$fileName"
                }
                "application_services" { 
                    $source = "src\application\services\$fileName"
                    $destination = "src\domains\$targetDomain\services\$fileName"
                }
            }
            
            if (Move-FileSafely $source $destination "$specialKey $fileType : $fileName") {
                $totalMigratedFiles++
            }
        }
    }
}

# Summary
Write-Host "`n=== Domain Files Migration Summary ===" -ForegroundColor Cyan
Write-Host "Total files migrated: $totalMigratedFiles" -ForegroundColor Green

if ($errors.Count -gt 0) {
    Write-Host "`nErrors encountered:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  ✗ $error" -ForegroundColor Red
    }
} else {
    Write-Host "✓ All domain files migrated successfully!" -ForegroundColor Green
}

# Verify domain structure
Write-Host "`nVerifying domain structure..." -ForegroundColor Yellow
$domains = @("analytics", "authentication", "calendar", "collaboration", "file-management", "notification", "search", "task-management", "webhook", "system-monitoring", "audit")

foreach ($domain in $domains) {
    $domainPath = "src\domains\$domain"
    if (Test-Path $domainPath) {
        $fileCount = (Get-ChildItem $domainPath -File -Recurse).Count
        Write-Host "✓ $domain : $fileCount files" -ForegroundColor Cyan
    } else {
        Write-Host "✗ $domain : Domain directory missing" -ForegroundColor Red
    }
}

Write-Host "`nDomain files migration completed!" -ForegroundColor Green