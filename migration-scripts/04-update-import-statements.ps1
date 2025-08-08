# Domain-Driven Architecture Migration Script - Import Statement Updates
# Generated: $(Get-Date)
# Purpose: Update all import statements to reflect new file locations

Write-Host "=== Domain-Driven Architecture Migration - Import Updates ===" -ForegroundColor Cyan
Write-Host "Starting import statement updates..." -ForegroundColor Yellow

$totalFilesProcessed = 0
$totalImportsUpdated = 0
$errors = @()

# Function to update imports in a file
function Update-FileImports {
    param(
        [string]$FilePath,
        [hashtable]$ImportMappings
    )
    
    try {
        if (!(Test-Path $FilePath)) {
            return @{ Updated = $false; ImportCount = 0; Error = "File not found" }
        }
        
        $content = Get-Content $FilePath -Raw -Encoding UTF8
        $originalContent = $content
        $importCount = 0
        
        # Apply each import mapping
        foreach ($oldPath in $ImportMappings.Keys) {
            $newPath = $ImportMappings[$oldPath]
            
            # Handle different import patterns
            $patterns = @(
                "from ['""]$([regex]::Escape($oldPath))['""]",
                "import.*from ['""]$([regex]::Escape($oldPath))['""]",
                "import ['""]$([regex]::Escape($oldPath))['""]"
            )
            
            foreach ($pattern in $patterns) {
                $matches = [regex]::Matches($content, $pattern)
                if ($matches.Count -gt 0) {
                    $content = $content -replace [regex]::Escape($oldPath), $newPath
                    $importCount += $matches.Count
                }
            }
        }
        
        # Only write if content changed
        if ($content -ne $originalContent) {
            Set-Content $FilePath $content -Encoding UTF8 -NoNewline
            return @{ Updated = $true; ImportCount = $importCount; Error = $null }
        } else {
            return @{ Updated = $false; ImportCount = 0; Error = $null }
        }
        
    } catch {
        return @{ Updated = $false; ImportCount = 0; Error = $_.Exception.Message }
    }
}

# Define comprehensive import mappings
$importMappings = @{
    # Shared resources mappings
    "src/domain/shared" = "../../shared/domain"
    "src/utils" = "../../shared/utils"
    "src/infrastructure/config" = "../../shared/config"
    "src/presentation/middleware" = "../../shared/middleware"
    
    # Domain-specific mappings (from old structure to new)
    "src/presentation/controllers" = "../controllers"
    "src/presentation/routes" = "../routes"
    "src/presentation/validators" = "../validators"
    "src/application/services" = "../services"
    "src/infrastructure/database/drizzle/schema" = "../schemas"
    "src/infrastructure/database/drizzle/repositories" = "../repositories"
    "src/infrastructure/repositories" = "../repositories"
    "src/infrastructure/search" = "../repositories"
    "src/infrastructure/webhook" = "../repositories"
    
    # Cross-domain references (absolute paths from src)
    "src/domain/analytics" = "src/domains/analytics"
    "src/domain/authentication" = "src/domains/authentication"
    "src/domain/calendar" = "src/domains/calendar"
    "src/domain/collaboration" = "src/domains/collaboration"
    "src/domain/file-management" = "src/domains/file-management"
    "src/domain/notification" = "src/domains/notification"
    "src/domain/search" = "src/domains/search"
    "src/domain/task-management" = "src/domains/task-management"
    "src/domain/webhook" = "src/domains/webhook"
    "src/domain/system-monitoring" = "src/domains/system-monitoring"
    "src/domain/audit" = "src/domains/audit"
}

# Additional context-specific mappings for files within domains
$domainSpecificMappings = @{
    # Within domain directories, use relative paths
    "../../../domain/shared" = "../../shared/domain"
    "../../domain/shared" = "../../shared/domain"
    "../../../utils" = "../../shared/utils"
    "../../utils" = "../../shared/utils"
    "../../../infrastructure/config" = "../../shared/config"
    "../../infrastructure/config" = "../../shared/config"
    "../../../presentation/middleware" = "../../shared/middleware"
    "../../presentation/middleware" = "../../shared/middleware"
}

# Combine all mappings
$allMappings = $importMappings + $domainSpecificMappings

Write-Host "Processing TypeScript files..." -ForegroundColor Yellow

# Get all TypeScript files in the project
$tsFiles = Get-ChildItem "src" -Filter "*.ts" -Recurse | Where-Object { 
    $_.FullName -notlike "*node_modules*" -and 
    $_.FullName -notlike "*backup_*" -and
    $_.FullName -notlike "*.d.ts"
}

Write-Host "Found $($tsFiles.Count) TypeScript files to process" -ForegroundColor Cyan

# Process each file
foreach ($file in $tsFiles) {
    $relativePath = $file.FullName.Replace((Get-Location).Path, "").TrimStart('\')
    Write-Host "Processing: $relativePath" -ForegroundColor Gray
    
    $result = Update-FileImports $file.FullName $allMappings
    $totalFilesProcessed++
    
    if ($result.Error) {
        $errors += "Error processing $relativePath : $($result.Error)"
        Write-Host "  ✗ Error: $($result.Error)" -ForegroundColor Red
    } elseif ($result.Updated) {
        $totalImportsUpdated += $result.ImportCount
        Write-Host "  ✓ Updated $($result.ImportCount) imports" -ForegroundColor Green
    } else {
        Write-Host "  - No imports to update" -ForegroundColor Gray
    }
}

# Update TypeScript configuration
Write-Host "`nUpdating TypeScript configuration..." -ForegroundColor Yellow

$tsconfigPath = "tsconfig.json"
if (Test-Path $tsconfigPath) {
    try {
        $tsconfigContent = Get-Content $tsconfigPath -Raw -Encoding UTF8
        $tsconfig = $tsconfigContent | ConvertFrom-Json
        
        # Update path mappings if they exist
        if ($tsconfig.compilerOptions -and $tsconfig.compilerOptions.paths) {
            $pathsUpdated = $false
            
            # Add new path mappings for domains
            $newPaths = @{
                "@shared/*" = @("src/shared/*")
                "@domains/*" = @("src/domains/*")
                "@analytics/*" = @("src/domains/analytics/*")
                "@auth/*" = @("src/domains/authentication/*")
                "@calendar/*" = @("src/domains/calendar/*")
                "@collaboration/*" = @("src/domains/collaboration/*")
                "@file-management/*" = @("src/domains/file-management/*")
                "@notification/*" = @("src/domains/notification/*")
                "@search/*" = @("src/domains/search/*")
                "@task-management/*" = @("src/domains/task-management/*")
                "@webhook/*" = @("src/domains/webhook/*")
                "@monitoring/*" = @("src/domains/system-monitoring/*")
                "@audit/*" = @("src/domains/audit/*")
            }
            
            foreach ($pathKey in $newPaths.Keys) {
                if (-not $tsconfig.compilerOptions.paths.$pathKey) {
                    $tsconfig.compilerOptions.paths | Add-Member -MemberType NoteProperty -Name $pathKey -Value $newPaths[$pathKey]
                    $pathsUpdated = $true
                }
            }
            
            if ($pathsUpdated) {
                $updatedTsconfig = $tsconfig | ConvertTo-Json -Depth 10
                Set-Content $tsconfigPath $updatedTsconfig -Encoding UTF8
                Write-Host "✓ Updated tsconfig.json with new path mappings" -ForegroundColor Green
            } else {
                Write-Host "- tsconfig.json already has path mappings" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠ tsconfig.json doesn't have path mappings section" -ForegroundColor Yellow
        }
    } catch {
        $errors += "Failed to update tsconfig.json: $($_.Exception.Message)"
        Write-Host "✗ Failed to update tsconfig.json: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ tsconfig.json not found" -ForegroundColor Yellow
}

# Update main application files
Write-Host "`nUpdating main application files..." -ForegroundColor Yellow

$mainFiles = @("src/app.ts", "src/index.ts", "src/server.ts")
foreach ($mainFile in $mainFiles) {
    if (Test-Path $mainFile) {
        $result = Update-FileImports $mainFile $allMappings
        if ($result.Updated) {
            Write-Host "✓ Updated imports in $mainFile" -ForegroundColor Green
        } else {
            Write-Host "- No updates needed in $mainFile" -ForegroundColor Gray
        }
    }
}

# Update route index file
$routeIndexPath = "src/presentation/routes/index.ts"
if (Test-Path $routeIndexPath) {
    Write-Host "`nUpdating route index file..." -ForegroundColor Yellow
    
    # Special handling for route index - update to import from new domain locations
    $routeIndexMappings = @{
        "./analytics.routes" = "../../domains/analytics/routes/analytics.routes"
        "./activity.routes" = "../../domains/analytics/routes/activity.routes"
        "./dashboard.routes" = "../../domains/analytics/routes/dashboard.routes"
        "./auth.routes" = "../../domains/authentication/routes/auth.routes"
        "./user.routes" = "../../domains/authentication/routes/user.routes"
        "./unified-auth.routes" = "../../domains/authentication/routes/unified-auth.routes"
        "./calendar.routes" = "../../domains/calendar/routes/calendar.routes"
        "./comment.routes" = "../../domains/collaboration/routes/comment.routes"
        "./presence.routes" = "../../domains/collaboration/routes/presence.routes"
        "./file-management.routes" = "../../domains/file-management/routes/file-management.routes"
        "./notification.routes" = "../../domains/notification/routes/notification.routes"
        "./search.routes" = "../../domains/search/routes/search.routes"
        "./task.routes" = "../../domains/task-management/routes/task.routes"
        "./project.routes" = "../../domains/task-management/routes/project.routes"
        "./workspace.routes" = "../../domains/task-management/routes/workspace.routes"
        "./team.routes" = "../../domains/task-management/routes/team.routes"
        "./webhook.routes" = "../../domains/webhook/routes/webhook.routes"
        "./monitoring.routes" = "../../domains/system-monitoring/routes/monitoring.routes"
        "./health.routes" = "../../domains/system-monitoring/routes/health.routes"
        "./performance.routes" = "../../domains/system-monitoring/routes/performance.routes"
        "./metrics.routes" = "../../domains/system-monitoring/routes/metrics.routes"
    }
    
    $result = Update-FileImports $routeIndexPath $routeIndexMappings
    if ($result.Updated) {
        Write-Host "✓ Updated route index file" -ForegroundColor Green
    } else {
        Write-Host "- No updates needed in route index file" -ForegroundColor Gray
    }
}

# Summary
Write-Host "`n=== Import Statement Updates Summary ===" -ForegroundColor Cyan
Write-Host "Total files processed: $totalFilesProcessed" -ForegroundColor Green
Write-Host "Total imports updated: $totalImportsUpdated" -ForegroundColor Green

if ($errors.Count -gt 0) {
    Write-Host "`nErrors encountered:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  ✗ $error" -ForegroundColor Red
    }
} else {
    Write-Host "✓ All import statements updated successfully!" -ForegroundColor Green
}

# Verify TypeScript compilation
Write-Host "`nVerifying TypeScript compilation..." -ForegroundColor Yellow
try {
    $compileResult = & npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ TypeScript compilation successful!" -ForegroundColor Green
    } else {
        Write-Host "✗ TypeScript compilation failed:" -ForegroundColor Red
        Write-Host $compileResult -ForegroundColor Red
    }
} catch {
    Write-Host "⚠ Could not run TypeScript compiler: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nImport statement updates completed!" -ForegroundColor Green