import { z } from 'zod';
import { environmentLoader } from '../environment/environment-loader';

/**
 * Database connection configuration schema
 */
const DatabaseConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(false),
});

/**
 * Database pool configuration schema
 */
const DatabasePoolSchema = z.object({
  maxConnections: z.number().min(1).max(100).default(20),
  minConnections: z.number().min(0).max(50).default(5),
  connectionTimeout: z.number().min(1000).default(5000),
  idleTimeout: z.number().min(1000).default(30000),
  acquireTimeout: z.number().min(1000).default(60000),
  createTimeout: z.number().min(1000).default(30000),
  destroyTimeout: z.number().min(1000).default(5000),
  reapInterval: z.number().min(1000).default(1000),
  createRetryInterval: z.number().min(100).default(200),
});

/**
 * Database migration configuration schema
 */
const DatabaseMigrationSchema = z.object({
  migrationsPath: z.string().default('./migrations'),
  seedsPath: z.string().default('./seeds'),
  tableName: z.string().default('migrations'),
  schemaName: z.string().optional(),
  disableTransactions: z.boolean().default(false),
  allowExtensions: z.array(z.string()).default([]),
});

/**
 * Database performance configuration schema
 */
const DatabasePerformanceSchema = z.object({
  queryTimeout: z.number().min(1000).default(30000),
  statementTimeout: z.number().min(1000).default(60000),
  lockTimeout: z.number().min(1000).default(10000),
  idleInTransactionSessionTimeout: z.number().min(1000).default(60000),
  enableQueryLogging: z.boolean().default(false),
  slowQueryThreshold: z.number().min(100).default(1000),
  enableExplainAnalyze: z.boolean().default(false),
});

/**
 * Database backup configuration schema
 */
const DatabaseBackupSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string().default('0 2 * * *'), // Daily at 2 AM
  retentionDays: z.number().min(1).default(30),
  compressionLevel: z.number().min(0).max(9).default(6),
  backupPath: z.string().default('./backups'),
  includeData: z.boolean().default(true),
  includeSchema: z.boolean().default(true),
  excludeTables: z.array(z.string()).default([]),
});

/**
 * Complete database configuration schema
 */
const DatabaseConfigSchema = z.object({
  connection: DatabaseConnectionSchema,
  pool: DatabasePoolSchema,
  migration: DatabaseMigrationSchema,
  performance: DatabasePerformanceSchema,
  backup: DatabaseBackupSchema,
});

export type DatabaseConnection = z.infer<typeof DatabaseConnectionSchema>;
export type DatabasePool = z.infer<typeof DatabasePoolSchema>;
export type DatabaseMigration = z.infer<typeof DatabaseMigrationSchema>;
export type DatabasePerformance = z.infer<typeof DatabasePerformanceSchema>;
export type DatabaseBackup = z.infer<typeof DatabaseBackupSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * Database configuration loader
 */
export class DatabaseConfigLoader {
  /**
   * Load complete database configuration
   */
  static load(): DatabaseConfig {
    const env = environmentLoader.getEnv();
    const environment = environmentLoader.getEnvironment();

    const config = {
      connection: {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        username: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL || environment === 'production',
      },
      pool: this.getPoolConfig(environment),
      migration: this.getMigrationConfig(environment),
      performance: this.getPerformanceConfig(environment),
      backup: this.getBackupConfig(environment),
    };

    return DatabaseConfigSchema.parse(config);
  }

  /**
   * Get environment-specific pool configuration
   */
  private static getPoolConfig(environment: string): DatabasePool {
    const baseConfig = {
      maxConnections: 20,
      minConnections: 5,
      connectionTimeout: 5000,
      idleTimeout: 30000,
      acquireTimeout: 60000,
      createTimeout: 30000,
      destroyTimeout: 5000,
      reapInterval: 1000,
      createRetryInterval: 200,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          maxConnections: 50,
          minConnections: 10,
          connectionTimeout: 10000,
          idleTimeout: 60000,
        };
      
      case 'staging':
        return {
          ...baseConfig,
          maxConnections: 30,
          minConnections: 8,
        };
      
      case 'test':
        return {
          ...baseConfig,
          maxConnections: 5,
          minConnections: 1,
          connectionTimeout: 2000,
          idleTimeout: 10000,
        };
      
      case 'development':
      default:
        return baseConfig;
    }
  }

  /**
   * Get environment-specific migration configuration
   */
  private static getMigrationConfig(environment: string): DatabaseMigration {
    const baseConfig = {
      migrationsPath: './src/infrastructure/database/migrations',
      seedsPath: './src/infrastructure/database/seeds',
      tableName: 'migrations',
      disableTransactions: false,
      allowExtensions: ['uuid-ossp', 'pgcrypto'],
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          disableTransactions: false, // Keep transactions in production
        };
      
      case 'test':
        return {
          ...baseConfig,
          tableName: 'test_migrations',
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get environment-specific performance configuration
   */
  private static getPerformanceConfig(environment: string): DatabasePerformance {
    const baseConfig = {
      queryTimeout: 30000,
      statementTimeout: 60000,
      lockTimeout: 10000,
      idleInTransactionSessionTimeout: 60000,
      enableQueryLogging: false,
      slowQueryThreshold: 1000,
      enableExplainAnalyze: false,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          queryTimeout: 15000,
          statementTimeout: 30000,
          enableQueryLogging: false,
          slowQueryThreshold: 500,
        };
      
      case 'development':
        return {
          ...baseConfig,
          enableQueryLogging: true,
          enableExplainAnalyze: true,
          slowQueryThreshold: 2000,
        };
      
      case 'test':
        return {
          ...baseConfig,
          queryTimeout: 5000,
          statementTimeout: 10000,
          enableQueryLogging: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get environment-specific backup configuration
   */
  private static getBackupConfig(environment: string): DatabaseBackup {
    const baseConfig = {
      enabled: true,
      schedule: '0 2 * * *',
      retentionDays: 30,
      compressionLevel: 6,
      backupPath: './backups',
      includeData: true,
      includeSchema: true,
      excludeTables: ['sessions', 'audit_logs_temp'],
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          schedule: '0 1 * * *', // 1 AM in production
          retentionDays: 90,
          compressionLevel: 9,
          backupPath: '/var/backups/database',
        };
      
      case 'staging':
        return {
          ...baseConfig,
          retentionDays: 14,
          schedule: '0 3 * * *',
        };
      
      case 'test':
        return {
          ...baseConfig,
          enabled: false,
        };
      
      case 'development':
      default:
        return {
          ...baseConfig,
          retentionDays: 7,
          enabled: false, // Disable backups in development
        };
    }
  }

  /**
   * Get database connection URL
   */
  static getConnectionUrl(): string {
    const config = this.load();
    const { connection } = config;
    
    const protocol = connection.ssl ? 'postgresql' : 'postgres';
    const sslParam = connection.ssl ? '?sslmode=require' : '';
    
    return `${protocol}://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${connection.database}${sslParam}`;
  }

  /**
   * Validate database configuration
   */
  static validate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = this.load();
      const environment = environmentLoader.getEnvironment();

      // Validate connection parameters
      if (!config.connection.host) {
        errors.push('Database host is required');
      }

      if (!config.connection.database) {
        errors.push('Database name is required');
      }

      if (!config.connection.username) {
        errors.push('Database username is required');
      }

      if (!config.connection.password) {
        errors.push('Database password is required');
      }

      // Environment-specific validations
      if (environment === 'production') {
        if (!config.connection.ssl) {
          warnings.push('SSL is disabled in production environment');
        }

        if (config.performance.enableQueryLogging) {
          warnings.push('Query logging is enabled in production (performance impact)');
        }

        if (config.pool.maxConnections < 20) {
          warnings.push('Low connection pool size for production environment');
        }
      }

      if (environment === 'development') {
        if (config.connection.ssl) {
          warnings.push('SSL is enabled in development (may cause connection issues)');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }
}