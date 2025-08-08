# Domain-Driven Architecture Migration - Master Script
# Generated: $(Get-Date)
# Purpose: Orchestrate the complete migration from layered to domain-driven architecture

param(
    [switch]$SkipBackup,
    [switch]$SkipConfirmation,
    [switch]$DryRun
)

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "    DOMAIN-DRIVEN ARCHITECTURE MIGRATION MASTER SCRIPT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will migrate your TypeScript project from a layered" -ForegroundColor Yellow
Write-Host "architecture to a clean domain-driven architecture." -ForegroundColor Yellow
Write-Host ""

# Display current project analysis
Write-Host "📊 PROJECT ANALYSIS:" -ForegroundColor Green
Write-Host "  • 11 business domains identified" -ForegroundColor White
Write-Host "  • ~150+ files to migrate" -ForegroundColor White
Write-Host "  • Shared resources to centralize" -ForegroundColor White
Write-Host "  • Import statements to update" -ForegroundColor White
Write-Host ""

# Safety checks
if (-not $SkipConfirmation -and -not $DryRun) {
    Write-Host "⚠️  IMPORTANT SAFETY INFORMATION:" -ForegroundColor Red
    Write-Host "  • This script will modify your entire src/ directory structure" -ForegroundColor Yellow
    Write-Host "  • A backup will be created automatically (unless -SkipBackup is used)" -ForegroundColor Yellow
    Write-Host "  • The migration process is designed to be safe but irreversible without backup" -ForegroundColor Yellow
    Write-Host ""
    
    $confirmation = Read-Host "Do you want to proceed with the migration? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "Migration cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Cyan
    Write-Host ""
}

# Migration phases
$phases = @(
    @{
        Name = "Directory Structure Creation"
        Script = "01-create-directory-structure.ps1"
        Description = "Create shared and domain directory structures"
    },
    @{
        Name = "Shared Resources Migration"
        Script = "02-migrate-shared-resources.ps1"
        Description = "Move shared utilities, middleware, and configuration"
    },
    @{
        Name = "Domain Files Migration"
        Script = "03-migrate-domain-files.ps1"
        Description = "Migrate domain-specific files to their respective domains"
    },
    @{
        Name = "Import Statement Updates"
        Script = "04-update-import-statements.ps1"
        Description = "Update all import statements to reflect new file locations"
    },
    @{
        Name = "Cleanup and Verification"
        Script = "05-cleanup-and-verify.ps1"
        Description = "Clean up empty directories and verify migration success"
    }
)

$startTime = Get-Date
$migrationLog = @()

# Function to log migration steps
function Write-MigrationLog {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    $script:migrationLog += $logEntry
    
    switch ($Level) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARNING" { Write-Host $logEntry -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
        default { Write-Host $logEntry -ForegroundColor White }
    }
}

# Create backup (unless skipped)
if (-not $SkipBackup -and -not $DryRun) {
    Write-Host "📦 CREATING BACKUP..." -ForegroundColor Cyan
    try {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupName = "backup_src_$timestamp"
        
        if (Test-Path "src") {
            Copy-Item -Path "src" -Destination $backupName -Recurse -Force
            $fileCount = (Get-ChildItem $backupName -Recurse -File).Count
            Write-MigrationLog "Backup created: $backupName ($fileCount files)" "SUCCESS"
        } else {
            Write-MigrationLog "Source directory 'src' not found!" "ERROR"
            exit 1
        }
    } catch {
        Write-MigrationLog "Failed to create backup: $($_.Exception.Message)" "ERROR"
        exit 1
    }
} elseif ($SkipBackup) {
    Write-MigrationLog "Backup skipped by user request" "WARNING"
}

# Execute migration phases
Write-Host "`n🚀 STARTING MIGRATION PHASES..." -ForegroundColor Cyan
$phaseNumber = 1
$totalPhases = $phases.Count

foreach ($phase in $phases) {
    Write-Host "`n" + "="*60 -ForegroundColor Gray
    Write-Host "PHASE $phaseNumber/$totalPhases : $($phase.Name)" -ForegroundColor Cyan
    Write-Host $phase.Description -ForegroundColor White
    Write-Host "="*60 -ForegroundColor Gray
    
    $phaseStartTime = Get-Date
    Write-MigrationLog "Starting Phase $phaseNumber : $($phase.Name)"
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] Would execute: $($phase.Script)" -ForegroundColor Cyan
        Start-Sleep -Seconds 1
        Write-MigrationLog "Phase $phaseNumber completed (dry run)" "SUCCESS"
    } else {
        $scriptPath = "migration-scripts\$($phase.Script)"
        
        if (Test-Path $scriptPath) {
            try {
                & $scriptPath
                $phaseEndTime = Get-Date
                $phaseDuration = $phaseEndTime - $phaseStartTime
                Write-MigrationLog "Phase $phaseNumber completed in $($phaseDuration.TotalSeconds) seconds" "SUCCESS"
            } catch {
                Write-MigrationLog "Phase $phaseNumber failed: $($_.Exception.Message)" "ERROR"
                Write-Host "`n❌ MIGRATION FAILED at Phase $phaseNumber" -ForegroundColor Red
                Write-Host "Check the error above and consider restoring from backup." -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-MigrationLog "Script not found: $scriptPath" "ERROR"
            exit 1
        }
    }
    
    $phaseNumber++
}

$endTime = Get-Date
$totalDuration = $endTime - $startTime

# Generate final migration log
$logPath = "migration-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$migrationLog | Out-File $logPath -Encoding UTF8

# Final summary
Write-Host "`n" + "="*60 -ForegroundColor Green
Write-Host "🎉 MIGRATION COMPLETED!" -ForegroundColor Green
Write-Host "="*60 -ForegroundColor Green

if (-not $DryRun) {
    Write-Host "`n📊 MIGRATION SUMMARY:" -ForegroundColor Cyan
    Write-Host "  • Total duration: $($totalDuration.TotalMinutes.ToString('F1')) minutes" -ForegroundColor White
    Write-Host "  • Phases completed: $totalPhases/$totalPhases" -ForegroundColor White
    Write-Host "  • Migration log: $logPath" -ForegroundColor White
    
    if (-not $SkipBackup) {
        Write-Host "  • Backup created: $backupName" -ForegroundColor White
    }
    
    Write-Host "`n🏗️  NEW PROJECT STRUCTURE:" -ForegroundColor Cyan
    Write-Host "  src/" -ForegroundColor White
    Write-Host "  ├── shared/           # Cross-domain utilities" -ForegroundColor Gray
    Write-Host "  ├── domains/          # Business domains" -ForegroundColor Gray
    Write-Host "  │   ├── analytics/" -ForegroundColor Gray
    Write-Host "  │   ├── authentication/" -ForegroundColor Gray
    Write-Host "  │   ├── calendar/" -ForegroundColor Gray
    Write-Host "  │   ├── collaboration/" -ForegroundColor Gray
    Write-Host "  │   ├── file-management/" -ForegroundColor Gray
    Write-Host "  │   ├── notification/" -ForegroundColor Gray
    Write-Host "  │   ├── search/" -ForegroundColor Gray
    Write-Host "  │   ├── task-management/" -ForegroundColor Gray
    Write-Host "  │   ├── webhook/" -ForegroundColor Gray
    Write-Host "  │   ├── system-monitoring/" -ForegroundColor Gray
    Write-Host "  │   └── audit/" -ForegroundColor Gray
    Write-Host "  └── infrastructure/   # Technical infrastructure only" -ForegroundColor Gray
    
    Write-Host "`n📋 NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "  1. Review the verification report: migration-verification-report.md" -ForegroundColor White
    Write-Host "  2. Test your application to ensure everything works correctly" -ForegroundColor White
    Write-Host "  3. Update your team documentation and development guidelines" -ForegroundColor White
    Write-Host "  4. Consider updating CI/CD pipelines if needed" -ForegroundColor White
    
    Write-Host "`n🔄 ROLLBACK (if needed):" -ForegroundColor Yellow
    if (-not $SkipBackup) {
        Write-Host "  Remove-Item src -Recurse -Force" -ForegroundColor Gray
        Write-Host "  Copy-Item $backupName src -Recurse -Force" -ForegroundColor Gray
    } else {
        Write-Host "  No backup was created - rollback not available" -ForegroundColor Red
    }
} else {
    Write-Host "`n✅ DRY RUN COMPLETED" -ForegroundColor Green
    Write-Host "No changes were made to your project." -ForegroundColor White
    Write-Host "Run without -DryRun to execute the actual migration." -ForegroundColor White
}

Write-Host "`n🎯 Your project is now organized with domain-driven architecture!" -ForegroundColor Green
Write-Host "Each business domain is self-contained with clear boundaries." -ForegroundColor White
Write-Host ""