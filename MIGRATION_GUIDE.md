# Monorepo Migration Guide

This guide provides step-by-step instructions for migrating your existing server application to the new monolithic full-stack architecture while preserving all existing data and functionality.

## Overview

The migration transforms your current project structure from separate client and server directories into a unified monorepo with shared packages, maintaining all existing backend capabilities while adding powerful frontend integration.

## Pre-Migration Checklist

Before starting the migration, ensure you have:

- [ ] **Database backup**: Current database is backed up
- [ ] **Code backup**: All code is committed to version control
- [ ] **Environment setup**: All required environment variables are configured
- [ ] **Dependencies**: All current functionality is working properly
- [ ] **Testing**: All existing tests are passing

## Migration Process

### Step 1: Pre-Migration Validation

Run the data integrity check to ensure your database is in a consistent state:

```bash
npm run check:integrity
```

This will:
- Verify data existence and referential integrity
- Check business logic consistency
- Validate data quality and constraints
- Generate a detailed integrity report

**⚠️ IMPORTANT**: Do not proceed if critical integrity issues are found. Fix all critical issues before continuing.

### Step 2: Run the Migration

Execute the migration script:

```bash
npm run migrate:monorepo
```

The migration will:
- Create a complete backup of your current setup
- Migrate database schema to the packages/database structure
- Move shared code to appropriate packages
- Update configuration files for monorepo structure
- Preserve all existing data
- Update package dependencies

### Step 3: Post-Migration Validation

After migration, validate the integrity:

```bash
npm run validate:migration
```

This will:
- Test database connectivity and schema
- Validate package structure and dependencies
- Check TypeScript compilation
- Verify application functionality
- Generate a validation report

### Step 4: Install Dependencies

Install all dependencies for the new monorepo structure:

```bash
npm install
```

### Step 5: Build and Test

Build all packages and applications:

```bash
npm run build
```

Run tests to ensure everything works:

```bash
npm run test
```

### Step 6: Start the Application

Start the development environment:

```bash
npm run dev
```

Verify that:
- Server starts without errors
- Database connections work
- All existing API endpoints function
- Authentication systems work
- Real-time features operate correctly

## Migration Scripts

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run check:integrity` | Check data integrity before migration |
| `npm run migrate:monorepo` | Execute the full migration |
| `npm run validate:migration` | Validate migration success |
| `npm run migrate:rollback` | Rollback migration if needed |

### Script Options

#### Migration Script Options
```bash
npm run migrate:monorepo [options]

Options:
  --no-preserve-data    Skip data preservation steps
  --no-backup          Skip backup creation
  --no-validate        Skip migration validation
  --help               Show help message
```

#### Rollback Script
```bash
npm run migrate:rollback [backup-directory]

# Use specific backup
npm run migrate:rollback migration-backup/2024-01-15

# Use latest backup (default)
npm run migrate:rollback
```

## What Gets Migrated

### Database
- ✅ All existing data preserved
- ✅ Schema moved to `packages/database`
- ✅ Migrations moved to `packages/database/src/migrations`
- ✅ Backup tables created for safety

### Configuration
- ✅ Environment variables preserved
- ✅ Database configuration updated
- ✅ TypeScript configuration updated
- ✅ Package dependencies updated

### Code Structure
- ✅ Shared types moved to `packages/shared`
- ✅ Database schema moved to `packages/database`
- ✅ UI components moved to `packages/ui`
- ✅ Configuration moved to `packages/config`

### Existing Features
- ✅ All backend functionality preserved
- ✅ Authentication systems maintained
- ✅ API endpoints continue working
- ✅ WebSocket functionality preserved
- ✅ Caching and performance optimizations maintained

## Rollback Process

If you need to rollback the migration:

### Automatic Rollback
```bash
npm run migrate:rollback
```

### Manual Rollback
1. Stop all running processes
2. Restore database from backup
3. Restore configuration files from backup
4. Remove monorepo-specific changes
5. Run `npm install` to restore dependencies

## Post-Migration Tasks

### Immediate Tasks
1. **Verify Functionality**: Test all existing features
2. **Update CI/CD**: Update build and deployment scripts
3. **Update Documentation**: Update any references to old structure
4. **Team Communication**: Inform team of new structure

### Optional Enhancements
1. **Frontend Development**: Start building the Next.js client
2. **Shared Components**: Move common UI components to packages/ui
3. **Type Safety**: Implement end-to-end type safety with tRPC
4. **Real-time Features**: Enhance WebSocket integration

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database configuration
cat packages/database/drizzle.config.ts

# Test database connection
npm run db:studio --dry-run
```

#### Package Dependency Issues
```bash
# Clean and reinstall
npm run clean:all

# Check workspace dependencies
npm list --depth=0
```

#### TypeScript Compilation Issues
```bash
# Check TypeScript configuration
npm run type-check

# Build packages in order
npm run build:packages
npm run build:apps
```

#### Import Path Issues
- Update any remaining relative imports to use workspace packages
- Check for circular dependencies between packages
- Ensure proper package exports in package.json files

### Getting Help

If you encounter issues:

1. **Check Reports**: Review generated reports for detailed information
2. **Check Logs**: Look at migration logs for specific error messages
3. **Validate Setup**: Run validation scripts to identify issues
4. **Rollback if Needed**: Use rollback script if migration fails

## Migration Reports

The migration process generates several reports:

### Data Integrity Report (`data-integrity-report.md`)
- Pre-migration data validation results
- Critical and non-critical issues
- Recommendations for fixes

### Migration Report (`migration-report.md`)
- Complete migration log
- Steps completed successfully
- Post-migration instructions

### Validation Report (`validation-report.md`)
- Post-migration validation results
- System functionality verification
- Recommendations for fixes

### Rollback Report (`rollback-report.md`)
- Rollback process log (if rollback was performed)
- Steps completed during rollback
- Post-rollback verification steps

## Best Practices

### Before Migration
- Ensure all tests pass
- Create manual database backup
- Document any custom configurations
- Notify team members of migration schedule

### During Migration
- Don't interrupt the migration process
- Monitor for error messages
- Keep backup locations safe
- Document any manual interventions

### After Migration
- Thoroughly test all functionality
- Update development workflows
- Update deployment processes
- Train team on new structure

## Support

For additional support:
- Review the generated reports for detailed information
- Check the troubleshooting section above
- Ensure all prerequisites are met
- Consider running migration in a test environment first

---

**Remember**: The migration process is designed to be safe and reversible. All your existing data and functionality will be preserved throughout the process.