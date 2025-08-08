/**
 * Consolidated Database Connection Manager
 * Single point of control for all database connections, health checks, and monitoring
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../logging/logger';
import {
  ConnectionPoolManager,
  PoolStats,
  ConnectionMetrics,
} from './connection-pool-manager';
import { TransactionManager } from './transaction-manager';
import {
  performDatabaseHealthCheck,
  getDatabaseMetrics,
  checkMaintenanceNeeds,
} from './health-check';
import type { DatabaseHealthStatus } from './health-check';

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  logLevel?: 'query' | 'info' | 'warn' | 'error';
  enableMetrics?: boolean;
  enableHealthChecks?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DatabaseStatus {
  isConnected: boolean;
  health: DatabaseHealthStatus;
  poolStats: PoolStats;
  metrics: ConnectionMetrics;
  lastHealthCheck: Date;
  uptime: number;
}

export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager | null = null;
  private client: PrismaClient | null = null;
  private poolManager: ConnectionPoolManager | null = null;
  private transactionManager: TransactionManager | null = null;
  private isConnected = false;
  private startTime: Date = new Date();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private lastHealthCheck: DatabaseHealthStatus | null = null;

  private constructor(private readonly config: DatabaseConfig) {}

  /**
   * Get singleton instance of DatabaseConnectionManager
   */
  public static getInstance(
    config?: DatabaseConfig
  ): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      if (!config) {
        throw new Error(
          'DatabaseConnectionManager requires configuration on first initialization'
        );
      }
      DatabaseConnectionManager.instance = new DatabaseConnectionManager(
        config
      );
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Initialize database connection and all related services
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing database connection manager', {
        url: this.config.url.replace(/\/\/.*@/, '//***@'), // Hide credentials
        maxConnections: this.config.maxConnections,
        enableMetrics: this.config.enableMetrics,
        enableHealthChecks: this.config.enableHealthChecks,
      });

      // Initialize Prisma client
      await this.initializePrismaClient();

      // Initialize connection pool manager
      this.poolManager = new ConnectionPoolManager();

      // Initialize transaction manager
      this.transactionManager = new TransactionManager(this.client!);

      // Connect to database
      await this.connect();

      // Start monitoring if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      logger.info('Database connection manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection manager', {
        error,
      });
      throw error;
    }
  }

  /**
   * Initialize Prisma client with configuration
   */
  private async initializePrismaClient(): Promise<void> {
    const logLevels: Prisma.LogLevel[] = [];

    if (this.config.logLevel) {
      logLevels.push(this.config.logLevel);
    }

    this.client = new PrismaClient({
      datasources: {
        db: {
          url: this.config.url,
        },
      },
      log: logLevels.map(level => ({ level, emit: 'event' })),
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up Prisma event listeners for logging and monitoring
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.$on('query', e => {
      if (this.config.logLevel === 'query') {
        logger.debug('Database query executed', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target,
        });
      }

      // Log slow queries
      if (e.duration > 1000) {
        logger.warn('Slow query detected', {
          query: e.query,
          duration: e.duration,
          params: e.params,
        });
      }
    });

    this.client.$on('error', e => {
      logger.error('Database error occurred', { error: e });
    });

    this.client.$on('info', e => {
      logger.info('Database info', { message: e.message, target: e.target });
    });

    this.client.$on('warn', e => {
      logger.warn('Database warning', { message: e.message, target: e.target });
    });
  }

  /**
   * Connect to database with retry logic
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('Database already connected');
      return;
    }

    const maxRetries = this.config.retryAttempts || 3;
    const retryDelay = this.config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          `Attempting to connect to database (attempt ${attempt}/${maxRetries})`
        );

        await this.client!.$connect();

        // Test connection with a simple query
        await this.client!.$queryRaw`SELECT 1`;

        this.isConnected = true;
        this.startTime = new Date();

        logger.info('Database connected successfully', {
          attempt,
          uptime: this.getUptime(),
        });

        return;
      } catch (error) {
        logger.error(`Database connection attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          maxRetries,
        });

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to connect to database after ${maxRetries} attempts: ${error}`
          );
        }

        // Wait before retrying
        await this.delay(retryDelay * attempt);
      }
    }
  }

  /**
   * Disconnect from database and cleanup resources
   */
  public async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from database');

      // Stop monitoring
      this.stopHealthChecks();
      this.stopMetricsCollection();

      // Disconnect pool manager
      if (this.poolManager) {
        await this.poolManager.disconnect();
      }

      // Disconnect Prisma client
      if (this.client && this.isConnected) {
        await this.client.$disconnect();
      }

      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error during database disconnection', { error });
      throw error;
    }
  }

  /**
   * Get Prisma client instance
   */
  public getClient(): PrismaClient {
    if (!this.client) {
      throw new Error(
        'Database client not initialized. Call initialize() first.'
      );
    }
    return this.client;
  }

  /**
   * Get transaction manager instance
   */
  public getTransactionManager(): TransactionManager {
    if (!this.transactionManager) {
      throw new Error(
        'Transaction manager not initialized. Call initialize() first.'
      );
    }
    return this.transactionManager;
  }

  /**
   * Get connection pool manager instance
   */
  public getPoolManager(): ConnectionPoolManager {
    if (!this.poolManager) {
      throw new Error('Pool manager not initialized. Call initialize() first.');
    }
    return this.poolManager;
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<DatabaseHealthStatus> {
    try {
      const healthStatus = await performDatabaseHealthCheck();
      this.lastHealthCheck = healthStatus;
      return healthStatus;
    } catch (error) {
      logger.error('Health check failed', { error });
      const failedStatus: DatabaseHealthStatus = {
        isHealthy: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
      this.lastHealthCheck = failedStatus;
      return failedStatus;
    }
  }

  /**
   * Get current database status
   */
  public async getStatus(): Promise<DatabaseStatus> {
    const health = this.lastHealthCheck || (await this.performHealthCheck());
    const poolStats = this.poolManager
      ? await this.poolManager.getPoolStats()
      : {
          totalConnections: 0,
          activeConnections: 0,
          idleConnections: 0,
          waitingConnections: 0,
          maxConnections: 0,
          connectionUtilization: 0,
        };
    const metrics = this.poolManager
      ? this.poolManager.getConnectionMetrics()
      : {
          averageConnectionTime: 0,
          totalQueries: 0,
          queriesPerSecond: 0,
          slowQueries: 0,
          failedConnections: 0,
          poolEfficiency: 0,
        };

    return {
      isConnected: this.isConnected,
      health,
      poolStats,
      metrics,
      lastHealthCheck: health.timestamp,
      uptime: this.getUptime(),
    };
  }

  /**
   * Get database metrics
   */
  public async getMetrics(): Promise<{
    connectionMetrics: ConnectionMetrics;
    poolStats: PoolStats;
    databaseMetrics: Awaited<ReturnType<typeof getDatabaseMetrics>>;
    maintenanceNeeds: Awaited<ReturnType<typeof checkMaintenanceNeeds>>;
  }> {
    const [connectionMetrics, poolStats, databaseMetrics, maintenanceNeeds] =
      await Promise.all([
        this.poolManager?.getConnectionMetrics() || {
          averageConnectionTime: 0,
          totalQueries: 0,
          queriesPerSecond: 0,
          slowQueries: 0,
          failedConnections: 0,
          poolEfficiency: 0,
        },
        this.poolManager?.getPoolStats() || {
          totalConnections: 0,
          activeConnections: 0,
          idleConnections: 0,
          waitingConnections: 0,
          maxConnections: 0,
          connectionUtilization: 0,
        },
        getDatabaseMetrics(),
        checkMaintenanceNeeds(),
      ]);

    return {
      connectionMetrics,
      poolStats,
      databaseMetrics,
      maintenanceNeeds,
    };
  }

  /**
   * Execute query with monitoring and error handling
   */
  public async executeQuery<T>(
    query: (client: PrismaClient) => Promise<T>,
    queryName: string = 'unknown'
  ): Promise<T> {
    if (!this.isConnected || !this.client) {
      throw new Error('Database not connected');
    }

    if (this.poolManager) {
      return await this.poolManager.executeWithMonitoring(
        () => query(this.client!),
        queryName
      );
    }

    return await query(this.client);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Periodic health check failed', { error });
      }
    }, intervalMs);

    logger.debug('Health checks started', { intervalMs });
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.debug('Health checks stopped');
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(intervalMs: number = 30000): void {
    if (this.poolManager) {
      this.poolManager.startMetricsCollection(intervalMs);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      try {
        const status = await this.getStatus();
        logger.debug('Database status', status);
      } catch (error) {
        logger.error('Metrics collection failed', { error });
      }
    }, intervalMs);

    logger.debug('Metrics collection started', { intervalMs });
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.poolManager) {
      this.poolManager.stopMetricsCollection();
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
      logger.debug('Metrics collection stopped');
    }
  }

  /**
   * Get uptime in milliseconds
   */
  private getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down database connection manager');

    try {
      await this.disconnect();
      DatabaseConnectionManager.instance = null;
      logger.info('Database connection manager shutdown complete');
    } catch (error) {
      logger.error('Error during database shutdown', { error });
      throw error;
    }
  }

  /**
   * Check if database is ready for operations
   */
  public async isReady(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database readiness check failed', { error });
      return false;
    }
  }

  /**
   * Get optimization recommendations
   */
  public async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Get pool recommendations
      if (this.poolManager) {
        const poolRecommendations =
          await this.poolManager.getOptimizationRecommendations();
        recommendations.push(...poolRecommendations);
      }

      // Get maintenance recommendations
      const maintenanceNeeds = await checkMaintenanceNeeds();
      if (maintenanceNeeds.needsVacuum) {
        recommendations.push('Database tables need vacuuming to reclaim space');
      }
      if (maintenanceNeeds.needsReindex) {
        recommendations.push('Some indexes are unused and should be reviewed');
      }

      // Get metrics-based recommendations
      const metrics = await this.getMetrics();
      if (metrics.databaseMetrics.cacheHitRatio < 95) {
        recommendations.push(
          'Cache hit ratio is low - consider increasing shared_buffers'
        );
      }
      if (metrics.databaseMetrics.slowQueries > 0) {
        recommendations.push(
          'Slow queries detected - review and optimize query performance'
        );
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to get optimization recommendations', { error });
      return ['Unable to generate recommendations due to error'];
    }
  }
}

// Export singleton factory function
export function createDatabaseConnectionManager(
  config: DatabaseConfig
): DatabaseConnectionManager {
  return DatabaseConnectionManager.getInstance(config);
}

// Export default instance getter
export function getDatabaseConnectionManager(): DatabaseConnectionManager {
  const instance = DatabaseConnectionManager.getInstance();
  if (!instance) {
    throw new Error(
      'DatabaseConnectionManager not initialized. Call createDatabaseConnectionManager() first.'
    );
  }
  return instance;
}
