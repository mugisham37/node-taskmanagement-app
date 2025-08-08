import { testConnection, closeConnection } from './connection';
import { migrationRunner } from './migrations/migration-runner';
import { checkDatabaseHealth, getDatabaseMetrics } from './health';
import { auditRepository } from './repositories/audit.repository';

export interface DatabaseSetupOptions {
  runMigrations?: boolean;
  seedData?: boolean;
  validateHealth?: boolean;
  logSetup?: boolean;
}

export interface DatabaseSetupResult {
  success: boolean;
  connectionStatus: boolean;
  migrationsRun: number;
  healthStatus?: any;
  errors: string[];
  warnings: string[];
}

export class DatabaseSetup {
  private options: Required<DatabaseSetupOptions>;

  constructor(options: DatabaseSetupOptions = {}) {
    this.options = {
      runMigrations: true,
      seedData: false,
      validateHealth: true,
      logSetup: true,
      ...options
    };
  }

  async initialize(): Promise<DatabaseSetupResult> {
    const result: DatabaseSetupResult = {
      success: true,
      connectionStatus: false,
      migrationsRun: 0,
      errors: [],
      warnings: []
    };

    try {
      if (this.options.logSetup) {
        console.log('🚀 Initializing database setup...');
      }

      // Step 1: Test database connection
      if (this.options.logSetup) {
        console.log('📡 Testing database connection...');
      }
      
      result.connectionStatus = await testConnection();
      if (!result.connectionStatus) {
        result.success = false;
        result.errors.push('Database connection failed');
        return result;
      }

      if (this.options.logSetup) {
        console.log('✅ Database connection successful');
      }

      // Step 2: Run migrations if requested
      if (this.options.runMigrations) {
        if (this.options.logSetup) {
          console.log('🔄 Running database migrations...');
        }

        const migrationResult = await migrationRunner.runMigrations();
        result.migrationsRun = migrationResult.executed.length;

        if (!migrationResult.success) {
          result.success = false;
          result.errors.push(...migrationResult.errors);
          return result;
        }

        if (this.options.logSetup) {
          console.log(`✅ Successfully ran ${result.migrationsRun} migrations`);
        }
      }

      // Step 3: Validate database health
      if (this.options.validateHealth) {
        if (this.options.logSetup) {
          console.log('🏥 Checking database health...');
        }

        try {
          result.healthStatus = await checkDatabaseHealth();
          
          if (!result.healthStatus.isConnected) {
            result.warnings.push('Database health check indicates connection issues');
          }

          if (this.options.logSetup) {
            console.log('✅ Database health check completed');
          }
        } catch (error) {
          result.warnings.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Step 4: Seed initial data if requested
      if (this.options.seedData) {
        if (this.options.logSetup) {
          console.log('🌱 Seeding initial data...');
        }

        try {
          await this.seedInitialData();
          if (this.options.logSetup) {
            console.log('✅ Initial data seeded successfully');
          }
        } catch (error) {
          result.warnings.push(`Data seeding failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (this.options.logSetup) {
        console.log('🎉 Database setup completed successfully!');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
      
      if (this.options.logSetup) {
        console.error('❌ Database setup failed:', error);
      }
    }

    return result;
  }

  private async seedInitialData(): Promise<void> {
    // Log the setup process
    await auditRepository.logActivity({
      entityType: 'system',
      entityId: 'database-setup',
      action: 'CREATE',
      metadata: {
        event: 'database_initialized',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });

    // Add any other initial data seeding here
    // For example: default admin user, system settings, etc.
  }

  async validateSetup(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check connection
      const isConnected = await testConnection();
      if (!isConnected) {
        issues.push('Database connection failed');
      }

      // Check migrations
      const migrationStatus = await migrationRunner.getMigrationStatus();
      if (migrationStatus.pending.length > 0) {
        issues.push(`${migrationStatus.pending.length} pending migrations found`);
        recommendations.push('Run pending migrations before starting the application');
      }

      // Validate migration integrity
      const migrationValidation = await migrationRunner.validateMigrations();
      if (!migrationValidation.valid) {
        issues.push(...migrationValidation.issues);
      }

      // Check database health
      try {
        const health = await checkDatabaseHealth();
        
        if (health.slowQueries > 10) {
          recommendations.push('Consider optimizing slow queries');
        }
        
        if (health.connectionCount > health.maxConnections * 0.8) {
          recommendations.push('Connection pool usage is high - consider increasing pool size');
        }
      } catch (error) {
        issues.push('Health check failed');
      }

      // Check for required tables/indexes
      try {
        const metrics = await getDatabaseMetrics();
        
        if (metrics.tableSizes.length === 0) {
          issues.push('No tables found - database may not be properly initialized');
        }

        // Check for unused indexes
        const unusedIndexes = metrics.indexUsage.filter(idx => idx.usage === 'Never used');
        if (unusedIndexes.length > 0) {
          recommendations.push(`Consider removing ${unusedIndexes.length} unused indexes`);
        }
      } catch (error) {
        // Metrics might not be available in all environments
        console.warn('Could not retrieve database metrics:', error);
      }

    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  async generateSetupReport(): Promise<string> {
    const validation = await this.validateSetup();
    const health = await checkDatabaseHealth();
    const migrationStatus = await migrationRunner.getMigrationStatus();

    let report = '# Database Setup Report\n\n';
    
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    // Connection Status
    report += '## Connection Status\n';
    report += `- **Connected:** ${health.isConnected ? '✅ Yes' : '❌ No'}\n`;
    report += `- **Database Size:** ${health.databaseSize}\n`;
    report += `- **Version:** ${health.version}\n`;
    report += `- **Uptime:** ${health.uptime}\n\n`;
    
    // Migration Status
    report += '## Migration Status\n';
    report += `- **Total Migrations:** ${migrationStatus.total}\n`;
    report += `- **Executed:** ${migrationStatus.executed.length}\n`;
    report += `- **Pending:** ${migrationStatus.pending.length}\n\n`;
    
    if (migrationStatus.pending.length > 0) {
      report += '### Pending Migrations\n';
      migrationStatus.pending.forEach(migration => {
        report += `- ${migration.id}: ${migration.name}\n`;
      });
      report += '\n';
    }
    
    // Performance Metrics
    report += '## Performance Metrics\n';
    report += `- **Connection Pool:** ${health.activeConnections}/${health.maxConnections} active\n`;
    report += `- **Query Count:** ${health.queryCount}\n`;
    report += `- **Slow Queries:** ${health.slowQueries}\n`;
    report += `- **Average Query Time:** ${health.averageQueryTime}ms\n\n`;
    
    // Validation Results
    report += '## Validation Results\n';
    report += `- **Status:** ${validation.valid ? '✅ Valid' : '❌ Issues Found'}\n\n`;
    
    if (validation.issues.length > 0) {
      report += '### Issues\n';
      validation.issues.forEach(issue => {
        report += `- ❌ ${issue}\n`;
      });
      report += '\n';
    }
    
    if (validation.recommendations.length > 0) {
      report += '### Recommendations\n';
      validation.recommendations.forEach(rec => {
        report += `- 💡 ${rec}\n`;
      });
      report += '\n';
    }
    
    return report;
  }

  async cleanup(): Promise<void> {
    try {
      await closeConnection();
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

// Convenience functions
export async function initializeDatabase(options?: DatabaseSetupOptions): Promise<DatabaseSetupResult> {
  const setup = new DatabaseSetup(options);
  return setup.initialize();
}

export async function validateDatabase(): Promise<boolean> {
  const setup = new DatabaseSetup();
  const validation = await setup.validateSetup();
  
  if (!validation.valid) {
    console.error('❌ Database validation failed:');
    validation.issues.forEach(issue => console.error(`  - ${issue}`));
    
    if (validation.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      validation.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    
    return false;
  }
  
  console.log('✅ Database validation passed');
  if (validation.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    validation.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  return true;
}

export async function generateDatabaseReport(): Promise<void> {
  const setup = new DatabaseSetup();
  const report = await setup.generateSetupReport();
  console.log(report);
}

// DatabaseSetup class is already exported above
