# Domain-Driven Architecture Migration Scripts

This directory contains PowerShell scripts to automatically migrate your TypeScript project from a traditional layered architecture to a clean domain-driven architecture.

## 🎯 Migration Overview

The migration transforms your project structure from:

```
src/
├── presentation/     # Controllers, routes, validators
├── application/      # Application services
├── domain/          # Domain logic scattered by domain
├── infrastructure/  # All infrastructure including domain-specific
└── utils/           # Shared utilities
```

To:

```
src/
├── shared/          # Cross-domain shared resources
├── domains/         # Self-contained business domains
│   ├── analytics/
│   ├── authentication/
│   ├── calendar/
│   ├── collaboration/
│   ├── file-management/
│   ├── notification/
│   ├── search/
│   ├── task-management/
│   ├── webhook/
│   ├── system-monitoring/
│   └── audit/
└── infrastructure/ # Technical infrastructure only
```

## 📋 Prerequisites

- **PowerShell 5.1+** (Windows) or **PowerShell Core 6+** (Cross-platform)
- **Node.js and npm** installed
- **TypeScript** installed (`npm install -g typescript`)
- **Backup your project** (scripts create automatic backups, but manual backup recommended)

## 🚀 Quick Start

### Option 1: Run Complete Migration (Recommended)

```powershell
# Navigate to your project root
cd your-project-directory

# Run the master migration script
.\migration-scripts\00-master-migration.ps1
```

### Option 2: Dry Run First

```powershell
# See what would happen without making changes
.\migration-scripts\00-master-migration.ps1 -DryRun
```

### Option 3: Skip Backup (Not Recommended)

```powershell
# Skip automatic backup creation
.\migration-scripts\00-master-migration.ps1 -SkipBackup
```

## 📁 Script Files

| Script                              | Purpose                 | Description                                     |
| ----------------------------------- | ----------------------- | ----------------------------------------------- |
| `00-master-migration.ps1`           | **Master Orchestrator** | Runs all migration phases in sequence           |
| `01-create-directory-structure.ps1` | **Directory Creation**  | Creates shared and domain directory structures  |
| `02-migrate-shared-resources.ps1`   | **Shared Resources**    | Moves shared utilities, middleware, config      |
| `03-migrate-domain-files.ps1`       | **Domain Migration**    | Migrates domain-specific files to their domains |
| `04-update-import-statements.ps1`   | **Import Updates**      | Updates all import statements for new paths     |
| `05-cleanup-and-verify.ps1`         | **Cleanup & Verify**    | Removes empty dirs and verifies migration       |

## 🔧 Individual Script Usage

You can run individual scripts if needed:

```powershell
# Create directory structure only
.\migration-scripts\01-create-directory-structure.ps1

# Migrate shared resources only
.\migration-scripts\02-migrate-shared-resources.ps1

# And so on...
```

## 📊 Migration Details

### Identified Domains

The migration handles these 11 business domains:

1. **Analytics** - Activity tracking, dashboard, analytics
2. **Authentication** - User auth, authorization, user management
3. **Calendar** - Calendar events and integrations
4. **Collaboration** - Comments and presence functionality
5. **File Management** - File uploads, attachments, storage
6. **Notification** - User notifications and messaging
7. **Search** - Search functionality and saved searches
8. **Task Management** - Tasks, projects, workspaces, teams, templates
9. **Webhook** - Webhook management and delivery
10. **System Monitoring** - Health checks, performance, metrics
11. **Audit** - Audit logging and compliance

### Files Migrated

- **~25 Controllers** from `src/presentation/controllers/`
- **~27 Routes** from `src/presentation/routes/`
- **~17 Validators** from `src/presentation/validators/`
- **~16 Schemas** from `src/infrastructure/database/drizzle/schema/`
- **~15 Repositories** from various infrastructure locations
- **~26 Middleware files** to shared location
- **~9 Configuration files** to shared location
- **~8 Utility files** to shared location

### Domain Structure Template

Each domain follows this consistent structure:

```
domains/[domain-name]/
├── controllers/     # HTTP request handlers
├── routes/         # Route definitions
├── validators/     # Input validation schemas
├── services/       # Business logic services
├── entities/       # Domain entities
├── repositories/   # Data access interfaces and implementations
├── schemas/        # Database schemas
├── events/         # Domain events
├── value-objects/  # Value objects
└── specifications/ # Business rules and specifications
```

## 🛡️ Safety Features

### Automatic Backup

- Creates timestamped backup of entire `src/` directory
- Format: `backup_src_YYYYMMDD_HHMMSS`
- Contains complete copy of original structure

### Rollback Instructions

If you need to rollback:

```powershell
# Stop all processes using the codebase
# Delete current src directory
Remove-Item src -Recurse -Force

# Restore from backup (replace with your backup name)
Copy-Item backup_src_20250808_075205 src -Recurse -Force
```

### Verification

- TypeScript compilation check
- Directory structure verification
- File count validation
- Import statement validation
- Test suite execution (if available)

## 📈 Migration Process

### Phase 1: Directory Structure Creation

- Creates `src/shared/` with subdirectories
- Creates `src/domains/[domain]/` for each business domain
- Each domain gets complete subdirectory structure

### Phase 2: Shared Resources Migration

- Moves `src/domain/shared/*` → `src/shared/domain/`
- Moves `src/presentation/middleware/*` → `src/shared/middleware/`
- Moves `src/infrastructure/config/*` → `src/shared/config/`
- Moves `src/utils/*` → `src/shared/utils/`

### Phase 3: Domain Files Migration

- Migrates controllers, routes, validators by domain
- Consolidates services from application and domain layers
- Moves repositories from infrastructure to domains
- Moves database schemas to domain schemas directories
- Handles special cases (feedback, export-import)

### Phase 4: Import Statement Updates

- Updates all TypeScript files with new import paths
- Handles relative path adjustments within domains
- Updates cross-domain references
- Updates main application files
- Updates TypeScript configuration

### Phase 5: Cleanup and Verification

- Removes empty directories from old structure
- Verifies new directory structure
- Runs TypeScript compilation check
- Executes test suite
- Generates verification report

## 📋 Generated Reports

### Migration Log

- **File**: `migration-log-YYYYMMDD-HHMMSS.txt`
- **Contains**: Timestamped log of all migration steps
- **Use**: Troubleshooting and audit trail

### Verification Report

- **File**: `migration-verification-report.md`
- **Contains**: Complete migration status and verification results
- **Use**: Confirm migration success and next steps

## ⚠️ Common Issues and Solutions

### TypeScript Compilation Errors

**Issue**: Import path errors after migration

**Solutions**:

1. Check that all files were moved correctly
2. Verify import paths are using correct relative paths
3. Update `tsconfig.json` path mappings if needed
4. Re-run import update script: `.\migration-scripts\04-update-import-statements.ps1`

### Missing Files

**Issue**: Some files not found in expected locations

**Solutions**:

1. Check the migration log for any errors
2. Verify files exist in backup
3. Manually move missing files to correct domain
4. Update imports for manually moved files

### Test Failures

**Issue**: Tests fail after migration

**Solutions**:

1. Update test imports to use new paths
2. Update test configuration files
3. Verify test data and mocks are still accessible
4. Check for hardcoded paths in test files

## 🔍 Troubleshooting

### Enable Verbose Logging

```powershell
# Run with verbose output
$VerbosePreference = "Continue"
.\migration-scripts\00-master-migration.ps1
```

### Check Individual Phases

```powershell
# Test directory creation only
.\migration-scripts\01-create-directory-structure.ps1

# Check TypeScript compilation
npx tsc --noEmit
```

### Manual Verification

```powershell
# Count files in each domain
Get-ChildItem "src\domains" -Directory | ForEach-Object {
    $fileCount = (Get-ChildItem $_.FullName -File -Recurse).Count
    Write-Host "$($_.Name): $fileCount files"
}
```

## 📞 Support

If you encounter issues:

1. **Check the migration log** for specific error messages
2. **Review the verification report** for detailed status
3. **Verify prerequisites** are installed and accessible
4. **Check file permissions** if on restricted systems
5. **Consider manual migration** for complex edge cases

## 🎯 Post-Migration Best Practices

### Development Guidelines

1. **Domain Boundaries**: Keep domain logic within domain directories
2. **Shared Resources**: Use `src/shared/` for cross-domain utilities
3. **Import Paths**: Use relative paths within domains, absolute for cross-domain
4. **New Features**: Add to appropriate domain following established structure

### Team Onboarding

1. **Update Documentation**: Reflect new architecture in project docs
2. **Code Reviews**: Ensure new code follows domain boundaries
3. **IDE Configuration**: Update IDE settings for new structure
4. **Build Scripts**: Update any build or deployment scripts

---

**Generated by**: Domain-Driven Architecture Migration System  
**Version**: 1.0  
**Date**: $(Get-Date -Format "yyyy-MM-dd")
