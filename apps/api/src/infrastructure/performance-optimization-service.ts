import { PerformanceCacheStrategies } from '@taskmanagement/cache';
import { DatabasePerformanceOptimizer } from '@taskmanagement/database';
import { InfrastructureError } from '../shared/errors/infrastructure-error';
import { APIPerformanceMonitor } from './monitoring/api-performance-monitor';
import { ComprehensiveMonitoring } from './monitoring/comprehensive-monitoring';
import { LoggingService } from './monitoring/logging-service';
import { MetricsService } from './monitoring/metrics-service';

export interface PerformanceOptimizationConfig {
  caching: {
    enabled: boolean;
    strategies: string[];
    optimizationInterval: number;
  };
  database: {
    enabled: boolean;
    connectionPoolOptimization: boolean;
    indexOptimization: boolean;
    queryOptimization: boolean;
    maintenanceInterval: number;
  };
  api: {
    enabled: boolean;
    responseTimeThreshold: number;
    errorRateThreshold: number;
    throughputThreshold: number;
    compressionEnabled: boolean;
  };
  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
    metricsCollectionInterval: number;
    alertingEnabled: boolean;
  };
  automation: {
    enabled: boolean;
    autoOptimization: boolean;
    maintenanceSchedule: string; // cron expression
  };
}

export interface PerformanceReport {
  timestamp: Date;
  overallScore: number;
  caching: {
    hitRate: number;
    memoryUsage: number;
    optimizationStatus: string;
  };
  database: {
    connectionPoolHealth: number;
    queryPerformance: number;
    indexEfficiency: number;
  };
  api: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    healthStatus: string;
  };
  recommendations: string[];
}

export class PerformanceOptimizationService {
  private optimizationInterval: NodeJS.Timeout | null = null;
  private maintenanceInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: PerformanceOptimizationConfig,
    private readonly cachingStrategies: PerformanceCacheStrategies,
    private readonly dbOptimizer: DatabasePerformanceOptimizer,
    private readonly apiMonitor: APIPerformanceMonitor,
    private readonly monitoring: ComprehensiveMonitoring,
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService
  ) {
    this.initialize();
  }

  /**
   * Initialize the performance optimization service
   */
  private initialize(): void {
    this.loggingService.info('Initializing Performance Optimization Service');

    if (this.config.automation.enabled) {
      this.startAutomatedOptimization();
    }

    if (this.config.database.enabled) {
      this.startDatabaseMaintenance();
    }

    this.loggingService.info('Performance Optimization Service initialized successfully');
  }

  /**
   * Start automated performance optimization
   */
  startAutomatedOptimization(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    this.optimizationInterval = setInterval(async () => {
      try {
        await this.runOptimizationCycle();
      } catch (error) {
        this.loggingService.error(
          'Automated optimization cycle failed',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }, this.config.caching.optimizationInterval);

    this.loggingService.info('Automated performance optimization started');
  }

  /**
   * Start database maintenance
   */
  startDatabaseMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    this.maintenanceInterval = setInterval(async () => {
      try {
        await this.runDatabaseMaintenance();
      } catch (error) {
        this.loggingService.error(
          'Database maintenance failed',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }, this.config.database.maintenanceInterval);

    this.loggingService.info('Database maintenance started');
  }

  /**
   * Run a complete optimization cycle
   */
  async runOptimizationCycle(): Promise<void> {
    this.loggingService.info('Starting performance optimization cycle');

    try {
      // Optimize caching
      if (this.config.caching.enabled) {
        await this.optimizeCaching();
      }

      // Optimize database
      if (this.config.database.enabled) {
        await this.optimizeDatabase();
      }

      // Optimize API performance
      if (this.config.api.enabled) {
        await this.optimizeAPI();
      }

      // Generate and log performance report
      const report = await this.generatePerformanceReport();
      this.loggingService.info('Performance optimization cycle completed', {
        overallScore: report.overallScore,
        recommendations: report.recommendations.length,
      });

      // Record metrics
      await this.metricsService.recordMetric('performance.overall_score', report.overallScore);
      await this.metricsService.recordMetric('performance.cache_hit_rate', report.caching.hitRate);
      await this.metricsService.recordMetric(
        'performance.api_response_time',
        report.api.averageResponseTime
      );
    } catch (error) {
      this.loggingService.error(
        'Performance optimization cycle failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw new InfrastructureError(
        `Optimization cycle failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Optimize caching performance
   */
  async optimizeCaching(): Promise<void> {
    this.loggingService.debug('Optimizing caching performance');

    try {
      // Execute caching strategies
      if (this.config.caching.strategies.length > 0) {
        for (const strategy of this.config.caching.strategies) {
          await this.cachingStrategies.executeStrategy(strategy);
        }
      } else {
        await this.cachingStrategies.executeAllStrategies();
      }

      // Optimize cache performance
      await this.cachingStrategies.optimizeCache();

      this.loggingService.debug('Caching optimization completed');
    } catch (error) {
      this.loggingService.error(
        'Caching optimization failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(): Promise<void> {
    this.loggingService.debug('Optimizing database performance');

    try {
      if (this.config.database.connectionPoolOptimization) {
        await this.dbOptimizer.optimizeConnectionPool();
      }

      if (this.config.database.indexOptimization) {
        await this.dbOptimizer.createOptimizedIndexes();
        await this.dbOptimizer.removeUnusedIndexes();
      }

      if (this.config.database.queryOptimization) {
        await this.dbOptimizer.optimizeQueryPlans();
      }

      this.loggingService.debug('Database optimization completed');
    } catch (error) {
      this.loggingService.error(
        'Database optimization failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Optimize API performance
   */
  async optimizeAPI(): Promise<void> {
    this.loggingService.debug('Optimizing API performance');

    try {
      // Get current performance metrics
      const systemMetrics = this.apiMonitor.getSystemMetrics();

      // Check if optimization is needed
      if (systemMetrics.averageResponseTime > this.config.api.responseTimeThreshold) {
        this.loggingService.warn('High API response time detected, applying optimizations');

        // Apply API optimizations (would be implemented based on specific needs)
        await this.applyAPIOptimizations();
      }

      if (systemMetrics.errorRate > this.config.api.errorRateThreshold) {
        this.loggingService.warn('High API error rate detected, investigating issues');

        // Analyze and address error patterns
        await this.analyzeAPIErrors();
      }

      this.loggingService.debug('API optimization completed');
    } catch (error) {
      this.loggingService.error(
        'API optimization failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Run database maintenance tasks
   */
  async runDatabaseMaintenance(): Promise<void> {
    this.loggingService.info('Running database maintenance');

    try {
      await this.dbOptimizer.runPerformanceMaintenance();
      this.loggingService.info('Database maintenance completed successfully');
    } catch (error) {
      this.loggingService.error(
        'Database maintenance failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(): Promise<PerformanceReport> {
    const timestamp = new Date();

    // Get caching metrics
    const cacheMetrics = await this.cachingStrategies.getPerformanceMetrics();

    // Get database metrics
    const dbMetrics = await this.dbOptimizer.getConnectionPoolMetrics();

    // Get API metrics
    const apiMetrics = this.apiMonitor.getSystemMetrics();

    // Get system health
    const systemHealth = await this.monitoring.getSystemHealth();

    // Calculate overall performance score (0-100)
    const overallScore = this.calculateOverallScore({
      cacheHitRate: cacheMetrics.hitRate,
      apiResponseTime: apiMetrics.averageResponseTime,
      errorRate: apiMetrics.errorRate,
      systemHealth: systemHealth.status,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      cacheMetrics,
      apiMetrics,
      systemHealth,
    });

    return {
      timestamp,
      overallScore,
      caching: {
        hitRate: cacheMetrics.hitRate,
        memoryUsage: cacheMetrics.memoryUsage,
        optimizationStatus: cacheMetrics.hitRate > 0.8 ? 'Good' : 'Needs Improvement',
      },
      database: {
        connectionPoolHealth:
          dbMetrics.totalConnections > 0
            ? (dbMetrics.activeConnections / dbMetrics.totalConnections) * 100
            : 100,
        queryPerformance: 85, // Mock value - would be calculated from actual metrics
        indexEfficiency: 90, // Mock value - would be calculated from index analysis
      },
      api: {
        averageResponseTime: apiMetrics.averageResponseTime,
        errorRate: apiMetrics.errorRate,
        throughput: apiMetrics.throughput,
      },
      system: {
        cpuUsage: systemHealth.metadata.cpu.user || 0,
        memoryUsage:
          (systemHealth.metadata.memory.heapUsed / systemHealth.metadata.memory.heapTotal) * 100,
        healthStatus: systemHealth.status,
      },
      recommendations,
    };
  }

  /**
   * Get current performance status
   */
  async getPerformanceStatus(): Promise<{
    status: 'optimal' | 'good' | 'degraded' | 'poor';
    score: number;
    issues: string[];
    lastOptimization: Date | null;
  }> {
    const report = await this.generatePerformanceReport();

    let status: 'optimal' | 'good' | 'degraded' | 'poor';
    if (report.overallScore >= 90) status = 'optimal';
    else if (report.overallScore >= 75) status = 'good';
    else if (report.overallScore >= 60) status = 'degraded';
    else status = 'poor';

    const issues: string[] = [];

    if (report.caching.hitRate < 0.7) {
      issues.push('Low cache hit rate');
    }

    if (report.api.averageResponseTime > this.config.api.responseTimeThreshold) {
      issues.push('High API response time');
    }

    if (report.api.errorRate > this.config.api.errorRateThreshold) {
      issues.push('High API error rate');
    }

    if (report.system.cpuUsage > 80) {
      issues.push('High CPU usage');
    }

    if (report.system.memoryUsage > 80) {
      issues.push('High memory usage');
    }

    return {
      status,
      score: report.overallScore,
      issues,
      lastOptimization: null, // Would track actual last optimization time
    };
  }

  /**
   * Stop all optimization processes
   */
  stop(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    this.loggingService.info('Performance Optimization Service stopped');
  }

  private calculateOverallScore(metrics: {
    cacheHitRate: number;
    apiResponseTime: number;
    errorRate: number;
    systemHealth: string;
  }): number {
    let score = 100;

    // Cache performance (25% weight)
    const cacheScore = metrics.cacheHitRate * 100;
    score = score * 0.75 + cacheScore * 0.25;

    // API performance (35% weight)
    const responseTimeScore = Math.max(0, 100 - metrics.apiResponseTime / 10);
    const errorRateScore = Math.max(0, 100 - metrics.errorRate * 1000);
    const apiScore = (responseTimeScore + errorRateScore) / 2;
    score = score * 0.65 + apiScore * 0.35;

    // System health (40% weight)
    const healthScore =
      metrics.systemHealth === 'healthy' ? 100 : metrics.systemHealth === 'degraded' ? 70 : 30;
    score = score * 0.6 + healthScore * 0.4;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private generateRecommendations(data: {
    cacheMetrics: any;
    apiMetrics: any;
    systemHealth: any;
  }): string[] {
    const recommendations: string[] = [];

    if (data.cacheMetrics.hitRate < 0.7) {
      recommendations.push('Increase cache TTL for frequently accessed data');
      recommendations.push('Implement cache warming strategies for critical data');
    }

    if (data.apiMetrics.averageResponseTime > this.config.api.responseTimeThreshold) {
      recommendations.push('Optimize database queries and add missing indexes');
      recommendations.push('Implement response compression');
      recommendations.push('Consider implementing pagination for large datasets');
    }

    if (data.apiMetrics.errorRate > this.config.api.errorRateThreshold) {
      recommendations.push('Review and fix error-prone endpoints');
      recommendations.push('Implement better input validation');
      recommendations.push('Add circuit breakers for external service calls');
    }

    if (data.systemHealth.status !== 'healthy') {
      recommendations.push('Investigate system health issues');
      recommendations.push('Scale resources if needed');
      recommendations.push('Review application logs for errors');
    }

    return recommendations;
  }

  private async applyAPIOptimizations(): Promise<void> {
    this.loggingService.debug('Applying API optimizations');

    try {
      // Enable response compression if not already enabled
      if (this.config.api.compressionEnabled) {
        this.loggingService.debug('Response compression is enabled');
      }

      // Optimize database connection pooling
      if (this.config.database.connectionPoolOptimization) {
        await this.dbOptimizer.optimizeConnectionPool();
        this.loggingService.debug('Database connection pool optimized');
      }

      // Implement request/response caching optimizations
      if (this.config.caching.enabled) {
        await this.cachingStrategies.optimizeCache();
        this.loggingService.debug('Cache optimization applied');
      }

      // Record optimization metrics
      this.metricsService.incrementCounter('api_optimizations_applied_total', {
        compression: this.config.api.compressionEnabled.toString(),
        caching: this.config.caching.enabled.toString(),
      });

      this.loggingService.debug('API optimizations applied successfully');
    } catch (error) {
      this.loggingService.error('Failed to apply API optimizations', error as Error);
      throw error;
    }
  }

  private async analyzeAPIErrors(): Promise<void> {
    // Implementation would include:
    // - Analyze error patterns
    // - Identify problematic endpoints
    // - Check for resource constraints
    // - Review recent deployments
    this.loggingService.debug('Analyzing API errors');
  }
}

export function createPerformanceOptimizationService(
  config: PerformanceOptimizationConfig,
  dependencies: {
    cachingStrategies: PerformanceCacheStrategies;
    dbOptimizer: DatabasePerformanceOptimizer;
    apiMonitor: APIPerformanceMonitor;
    monitoring: ComprehensiveMonitoring;
    metricsService: MetricsService;
    loggingService: LoggingService;
  }
): PerformanceOptimizationService {
  return new PerformanceOptimizationService(
    config,
    dependencies.cachingStrategies,
    dependencies.dbOptimizer,
    dependencies.apiMonitor,
    dependencies.monitoring,
    dependencies.metricsService,
    dependencies.loggingService
  );
}
