# Domain-Driven Architecture Migration Script - Shared Resources Migration
# Generated: $(Get-Date)
# Purpose: Migrate shared resources to centralized locations

Write-Host "=== Domain-Driven Architecture Migration - Shared Resources ===" -ForegroundColor Cyan
Write-Host "Starting shared resources migration..." -ForegroundColor Yellow

$migratedFiles = 0
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
            Write-Host "✓ Moved: $Description" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠ Source not found: $Source" -ForegroundColor Yellow
            return $false
        }
    } catch {
        $script:errors += "Failed to move $Source to $Destination : $($_.Exception.Message)"
        Write-Host "✗ Failed: $Description - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 1. Migrate shared domain files
Write-Host "`n1. Migrating shared domain files..." -ForegroundColor Green
if (Test-Path "src\domain\shared") {
    $sharedDomainFiles = Get-ChildItem "src\domain\shared" -Recurse -File
    foreach ($file in $sharedDomainFiles) {
        $relativePath = $file.FullName.Replace((Resolve-Path "src\domain\shared").Path, "").TrimStart('\')
        $destination = "src\shared\domain\$relativePath"
        
        if (Move-FileSafely $file.FullName $destination "Shared domain: $relativePath") {
            $migratedFiles++
        }
    }
    
    # Remove empty shared domain directory structure
    try {
        Remove-Item "src\domain\shared" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Removed empty src\domain\shared directory" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Could not remove src\domain\shared directory" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ src\domain\shared directory not found" -ForegroundColor Yellow
}

# 2. Migrate middleware files
Write-Host "`n2. Migrating middleware files..." -ForegroundColor Green
if (Test-Path "src\presentation\middleware") {
    $middlewareFiles = Get-ChildItem "src\presentation\middleware" -File -Filter "*.ts"
    foreach ($file in $middlewareFiles) {
        $destination = "src\shared\middleware\$($file.Name)"
        if (Move-FileSafely $file.FullName $destination "Middleware: $($file.Name)") {
            $migratedFiles++
        }
    }
} else {
    Write-Host "⚠ src\presentation\middleware directory not found" -ForegroundColor Yellow
}

# 3. Migrate configuration files
Write-Host "`n3. Migrating configuration files..." -ForegroundColor Green
if (Test-Path "src\infrastructure\config") {
    $configFiles = Get-ChildItem "src\infrastructure\config" -File -Filter "*.ts"
    foreach ($file in $configFiles) {
        $destination = "src\shared\config\$($file.Name)"
        if (Move-FileSafely $file.FullName $destination "Config: $($file.Name)") {
            $migratedFiles++
        }
    }
    
    # Remove empty config directory
    try {
        Remove-Item "src\infrastructure\config" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Removed empty src\infrastructure\config directory" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Could not remove src\infrastructure\config directory" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ src\infrastructure\config directory not found" -ForegroundColor Yellow
}

# 4. Migrate utility files
Write-Host "`n4. Migrating utility files..." -ForegroundColor Green
if (Test-Path "src\utils") {
    $utilFiles = Get-ChildItem "src\utils" -File -Filter "*.ts"
    foreach ($file in $utilFiles) {
        $destination = "src\shared\utils\$($file.Name)"
        if (Move-FileSafely $file.FullName $destination "Utils: $($file.Name)") {
            $migratedFiles++
        }
    }
    
    # Remove empty utils directory
    try {
        Remove-Item "src\utils" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Removed empty src\utils directory" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Could not remove src\utils directory" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ src\utils directory not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Shared Resources Migration Summary ===" -ForegroundColor Cyan
Write-Host "Total files migrated: $migratedFiles" -ForegroundColor Green

if ($errors.Count -gt 0) {
    Write-Host "`nErrors encountered:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  ✗ $error" -ForegroundColor Red
    }
} else {
    Write-Host "✓ All shared resources migrated successfully!" -ForegroundColor Green
}

# Verify shared structure
Write-Host "`nVerifying shared structure..." -ForegroundColor Yellow
$sharedDirs = @("src\shared\domain", "src\shared\middleware", "src\shared\config", "src\shared\utils")
foreach ($dir in $sharedDirs) {
    if (Test-Path $dir) {
        $fileCount = (Get-ChildItem $dir -File -Recurse).Count
        Write-Host "✓ $dir : $fileCount files" -ForegroundColor Cyan
    } else {
        Write-Host "✗ $dir : Directory missing" -ForegroundColor Red
    }
}

Write-Host "`nShared resources migration completed!" -ForegroundColor Green