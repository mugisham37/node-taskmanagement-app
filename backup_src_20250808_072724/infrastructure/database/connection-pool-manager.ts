import { PrismaClient } from '@prisma/client';
import { logger } from '../logging/logger';

/**
 * Connection Pool Manager
 * Manages database connection pooling and optimization
 */

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  connectionUtilization: number;
}

export interface ConnectionMetrics {
  averageConnectionTime: number;
  totalQueries: number;
  queriesPerSecond: number;
  slowQueries: number;
  failedConnections: number;
  poolEfficiency: number;
}

export class ConnectionPoolManager {
  private prisma: PrismaClient;
  private connectionMetrics: ConnectionMetrics = {
    averageConnectionTime: 0,
    totalQueries: 0,
    queriesPerSecond: 0,
    slowQueries: 0,
    failedConnections: 0,
    poolEfficiency: 0,
  };
  private metricsInterval?: NodeJS.Timeout;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    this.setupEventListeners();
  }

  /**
   * Setup Prisma event listeners for metrics collection
   */
  private setupEventListeners(): void {
    this.prisma.$on('query', e => {
      this.connectionMetrics.totalQueries++;

      if (e.duration > 1000) {
        // Queries taking more than 1 second
        this.connectionMetrics.slowQueries++;
        logger.warn('Slow query detected', {
          query: e.query,
          duration: e.duration,
          params: e.params,
        });
      }
    });

    this.prisma.$on('error', e => {
      this.connectionMetrics.failedConnections++;
      logger.error('Database connection error', { error: e });
    });
  }

  /**
   * Get current connection pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    try {
      const connectionStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as waiting_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const maxConnectionsResult = await this.prisma.$queryRaw<any[]>`
        SELECT setting::int as max_connections 
        FROM pg_settings 
        WHERE name = 'max_connections'
      `;

      const stats = connectionStats[0];
      const maxConnections = maxConnectionsResult[0].max_connections;

      return {
        totalConnections: parseInt(stats.total_connections),
        activeConnections: parseInt(stats.active_connections),
        idleConnections: parseInt(stats.idle_connections),
        waitingConnections: parseInt(stats.waiting_connections),
        maxConnections,
        connectionUtilization:
          (parseInt(stats.total_connections) / maxConnections) * 100,
      };
    } catch (error) {
      logger.error('Failed to get pool stats', { error });
      throw error;
    }
  }

  /**
   * Get connection performance metrics
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  /**
   * Optimize connection pool based on current usage
   */
  async optimizePoolSize(): Promise<{
    currentStats: PoolStats;
    recommendations: string[];
    optimizedSettings: Record<string, any>;
  }> {
    const stats = await this.getPoolStats();
    const recommendations: string[] = [];
    const optimizedSettings: Record<string, any> = {};

    // Analyze connection utilization
    if (stats.connectionUtilization > 80) {
      recommendations.push(
        'High connection utilization detected. Consider increasing max_connections.'
      );
      optimizedSettings.max_connections = Math.ceil(stats.maxConnections * 1.2);
    } else if (stats.connectionUtilization < 20) {
      recommendations.push(
        'Low connection utilization. Consider reducing max_connections to save resources.'
      );
      optimizedSettings.max_connections = Math.max(
        10,
        Math.ceil(stats.maxConnections * 0.8)
      );
    }

    // Analyze idle connections
    if (stats.idleConnections > stats.activeConnections * 2) {
      recommendations.push(
        'Too many idle connections. Consider reducing connection timeout.'
      );
      optimizedSettings.idle_in_transaction_session_timeout = '30s';
    }

    // Analyze waiting connections
    if (stats.waitingConnections > 5) {
      recommendations.push(
        'High number of waiting connections. Consider optimizing queries or increasing pool size.'
      );
    }

    // Memory optimization recommendations
    const memoryStats = await this.getMemoryUsage();
    if (memoryStats.shared_buffers_mb < 256) {
      recommendations.push(
        'Shared buffers too low. Consider increasing to 25% of available RAM.'
      );
      optimizedSettings.shared_buffers = '256MB';
    }

    return {
      currentStats: stats,
      recommendations,
      optimizedSettings,
    };
  }

  /**
   * Get database memory usage statistics
   */
  private async getMemoryUsage(): Promise<{
    shared_buffers_mb: number;
    effective_cache_size_mb: number;
    work_mem_mb: number;
  }> {
    try {
      const memorySettings = await this.prisma.$queryRaw<any[]>`
        SELECT 
          name,
          setting,
          unit
        FROM pg_settings 
        WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem')
      `;

      const settings = memorySettings.reduce((acc, setting) => {
        let value = parseInt(setting.setting);

        // Convert to MB based on unit
        if (setting.unit === '8kB') {
          value = (value * 8) / 1024; // Convert 8kB blocks to MB
        } else if (setting.unit === 'kB') {
          value = value / 1024; // Convert kB to MB
        }

        acc[setting.name + '_mb'] = value;
        return acc;
      }, {} as any);

      return settings;
    } catch (error) {
      logger.error('Failed to get memory usage', { error });
      return {
        shared_buffers_mb: 0,
        effective_cache_size_mb: 0,
        work_mem_mb: 0,
      };
    }
  }

  /**
   * Monitor connection health
   */
  async checkConnectionHealth(): Promise<{
    healthy: boolean;
    latency: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const startTime = Date.now();

    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      // Check for connection issues
      const stats = await this.getPoolStats();

      if (stats.connectionUtilization > 90) {
        issues.push('Connection pool near capacity');
      }

      if (stats.waitingConnections > 10) {
        issues.push('High number of waiting connections');
      }

      if (latency > 100) {
        issues.push('High database latency detected');
      }

      // Check for long-running transactions
      const longTransactions = await this.prisma.$queryRaw<any[]>`
        SELECT 
          pid,
          state,
          query_start,
          state_change,
          query
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '30 seconds'
        AND datname = current_database()
      `;

      if (longTransactions.length > 0) {
        issues.push(
          `${longTransactions.length} long-running transactions detected`
        );
      }

      return {
        healthy: issues.length === 0,
        latency,
        issues,
      };
    } catch (error) {
      logger.error('Connection health check failed', { error });
      return {
        healthy: false,
        latency: Date.now() - startTime,
        issues: ['Database connection failed'],
      };
    }
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection(intervalMs: number = 30000): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      try {
        const stats = await this.getPoolStats();
        const health = await this.checkConnectionHealth();

        // Calculate queries per second
        const currentTime = Date.now();
        this.connectionMetrics.queriesPerSecond =
          this.connectionMetrics.totalQueries / (currentTime / 1000);

        // Calculate pool efficiency
        this.connectionMetrics.poolEfficiency =
          (stats.activeConnections / stats.totalConnections) * 100;

        logger.debug('Connection pool metrics', {
          stats,
          health,
          metrics: this.connectionMetrics,
        });
      } catch (error) {
        logger.error('Failed to collect connection metrics', { error });
      }
    }, intervalMs);
  }

  /**
   * Stop metrics collection
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Execute query with connection monitoring
   */
  async executeWithMonitoring<T>(
    query: () => Promise<T>,
    queryName: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await query();
      const duration = Date.now() - startTime;

      this.connectionMetrics.averageConnectionTime =
        (this.connectionMetrics.averageConnectionTime + duration) / 2;

      if (duration > 1000) {
        logger.warn('Slow query execution', {
          queryName,
          duration,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error) {
      this.connectionMetrics.failedConnections++;
      logger.error('Query execution failed', {
        queryName,
        duration: Date.now() - startTime,
        error,
      });
      throw error;
    }
  }

  /**
   * Get connection pool recommendations
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    const stats = await this.getPoolStats();
    const health = await this.checkConnectionHealth();
    const recommendations: string[] = [];

    // Connection pool size recommendations
    if (stats.connectionUtilization > 85) {
      recommendations.push('Consider increasing connection pool size');
    } else if (stats.connectionUtilization < 15) {
      recommendations.push(
        'Consider decreasing connection pool size to save resources'
      );
    }

    // Performance recommendations
    if (health.latency > 50) {
      recommendations.push(
        'High database latency - check network and query performance'
      );
    }

    if (
      this.connectionMetrics.slowQueries >
      this.connectionMetrics.totalQueries * 0.1
    ) {
      recommendations.push(
        'High percentage of slow queries - review and optimize queries'
      );
    }

    // Connection management recommendations
    if (stats.waitingConnections > 0) {
      recommendations.push(
        'Connections are waiting - consider query optimization or pool tuning'
      );
    }

    if (stats.idleConnections > stats.activeConnections * 3) {
      recommendations.push(
        'Too many idle connections - consider reducing connection timeout'
      );
    }

    return recommendations;
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    this.stopMetricsCollection();
    await this.prisma.$disconnect();
    logger.info('Connection pool manager disconnected');
  }
}

export const connectionPoolManager = new ConnectionPoolManager();
