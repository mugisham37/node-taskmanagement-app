# Domain-Driven Architecture Migration Script - Directory Creation
# Generated: $(Get-Date)
# Purpose: Create the complete directory structure for domain-driven architecture

Write-Host "=== Domain-Driven Architecture Migration - Directory Creation ===" -ForegroundColor Cyan
Write-Host "Starting directory structure creation..." -ForegroundColor Yellow

# Create shared directories
Write-Host "`nCreating shared directories..." -ForegroundColor Green
$sharedDirs = @(
    "src\shared\domain",
    "src\shared\middleware", 
    "src\shared\config",
    "src\shared\utils",
    "src\shared\types"
)

foreach ($dir in $sharedDirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "✓ Created: $dir" -ForegroundColor Green
}

# Define all business domains
$domains = @(
    "analytics",
    "authentication", 
    "calendar",
    "collaboration",
    "file-management",
    "notification",
    "search", 
    "task-management",
    "webhook",
    "system-monitoring",
    "audit"
)

# Create domain directory structure
Write-Host "`nCreating domain directories..." -ForegroundColor Green
foreach ($domain in $domains) {
    Write-Host "Creating domain: $domain" -ForegroundColor Yellow
    
    $domainDirs = @(
        "src\domains\$domain\controllers",
        "src\domains\$domain\routes", 
        "src\domains\$domain\validators",
        "src\domains\$domain\services",
        "src\domains\$domain\entities",
        "src\domains\$domain\repositories",
        "src\domains\$domain\schemas",
        "src\domains\$domain\events",
        "src\domains\$domain\value-objects",
        "src\domains\$domain\specifications"
    )
    
    foreach ($dir in $domainDirs) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "  ✓ Created: $dir" -ForegroundColor Green
    }
}

# Clean infrastructure directories (keep only technical infrastructure)
Write-Host "`nPreparing infrastructure directories..." -ForegroundColor Green
$infraDirs = @(
    "src\infrastructure\database",
    "src\infrastructure\cache", 
    "src\infrastructure\external-services",
    "src\infrastructure\monitoring",
    "src\infrastructure\storage",
    "src\infrastructure\websocket",
    "src\infrastructure\logging",
    "src\infrastructure\security",
    "src\infrastructure\server"
)

foreach ($dir in $infraDirs) {
    if (Test-Path $dir) {
        Write-Host "✓ Infrastructure directory exists: $dir" -ForegroundColor Green
    } else {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "✓ Created infrastructure directory: $dir" -ForegroundColor Green
    }
}

# Verify directory creation
Write-Host "`nVerifying directory structure..." -ForegroundColor Yellow
$totalDirs = 0

# Count shared directories
$sharedCount = (Get-ChildItem "src\shared" -Directory -Recurse).Count
$totalDirs += $sharedCount
Write-Host "Shared directories: $sharedCount" -ForegroundColor Cyan

# Count domain directories  
foreach ($domain in $domains) {
    if (Test-Path "src\domains\$domain") {
        $domainCount = (Get-ChildItem "src\domains\$domain" -Directory -Recurse).Count
        $totalDirs += $domainCount
        Write-Host "Domain '$domain' directories: $domainCount" -ForegroundColor Cyan
    }
}

Write-Host "`nDirectory creation completed successfully!" -ForegroundColor Green
Write-Host "Total directories created/verified: $totalDirs" -ForegroundColor Cyan
Write-Host "Ready for file migration phase." -ForegroundColor Yellow