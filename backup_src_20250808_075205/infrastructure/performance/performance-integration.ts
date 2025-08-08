import { Express } from 'express';
import { logger } from '../logging/logger';
import { performanceOptimizationService } from './performance-optimization-service';
import { performanceMonitor } from '../monitoring/performance-monitor';
import { connectionPoolManager } from '../database/connection-pool-manager';
import { apiOptimizer } from './api-optimizer';

/**
 * Performance Integration Module
 * Integrates all performance optimization components with the Express application
 */

export interface PerformanceIntegrationConfig {
  enableAutoOptimization: boolean;
  autoOptimizationInterval: number; // hours
  enablePerformanceMonitoring: boolean;
  monitoringInterval: number; // milliseconds
  enableApiOptimization: boolean;
  enableDatabaseOptimization: boolean;
  enableEmergencyOptimization: boolean;
}

export class PerformanceIntegration {
  private app: Express;
  private config: PerformanceIntegrationConfig;
  private autoOptimizationTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(
    app: Express,
    config: Partial<PerformanceIntegrationConfig> = {}
  ) {
    this.app = app;
    this.config = {
      enableAutoOptimization: true,
      autoOptimizationInterval: 24, // 24 hours
      enablePerformanceMonitoring: true,
      monitoringInterval: 30000, // 30 seconds
      enableApiOptimization: true,
      enableDatabaseOptimization: true,
      enableEmergencyOptimization: true,
      ...config,
    };
  }

  /**
   * Initialize all performance optimization components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Performance integration already initialized');
      return;
    }

    logger.info('Initializing performance optimization integration', {
      config: this.config,
    });

    try {
      // Initialize API optimization middleware
      if (this.config.enableApiOptimization) {
        await this.initializeApiOptimization();
      }

      // Initialize database optimization
      if (this.config.enableDatabaseOptimization) {
        await this.initializeDatabaseOptimization();
      }

      // Initialize performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        await this.initializePerformanceMonitoring();
      }

      // Setup automatic optimization
      if (this.config.enableAutoOptimization) {
        this.setupAutoOptimization();
      }

      // Setup emergency optimization
      if (this.config.enableEmergencyOptimization) {
        this.setupEmergencyOptimization();
      }

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.isInitialized = true;
      logger.info(
        'Performance optimization integration initialized successfully'
      );

      // Run initial optimization after startup
      setTimeout(async () => {
        try {
          logger.info('Running initial performance optimization');
          await performanceOptimizationService.runFullOptimization();
        } catch (error) {
          logger.error('Initial performance optimization failed', { error });
        }
      }, 10000); // Wait 10 seconds after startup
    } catch (error) {
      logger.error(
        'Failed to initialize performance optimization integration',
        { error }
      );
      throw error;
    }
  }

  /**
   * Initialize API optimization middleware
   */
  private async initializeApiOptimization(): Promise<void> {
    logger.info('Initializing API optimization middleware');

    // Add compression middleware
    this.app.use(apiOptimizer.getCompressionMiddleware());
    logger.debug('Compression middleware added');

    // Add caching middleware
    this.app.use(apiOptimizer.getCachingMiddleware());
    logger.debug('Caching middleware added');

    // Add pagination middleware
    this.app.use(apiOptimizer.getPaginationMiddleware());
    logger.debug('Pagination middleware added');

    // Add bulk operations middleware
    this.app.use(apiOptimizer.getBulkOperationsMiddleware());
    logger.debug('Bulk operations middleware added');

    logger.info('API optimization middleware initialized');
  }

  /**
   * Initialize database optimization
   */
  private async initializeDatabaseOptimization(): Promise<void> {
    logger.info('Initializing database optimization');

    // Start connection pool monitoring
    connectionPoolManager.startMetricsCollection(
      this.config.monitoringInterval
    );
    logger.debug('Database connection pool monitoring started');

    // Check database health
    const health = await connectionPoolManager.checkConnectionHealth();
    if (!health.healthy) {
      logger.warn('Database health issues detected', { issues: health.issues });
    }

    logger.info('Database optimization initialized');
  }

  /**
   * Initialize performance monitoring
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    logger.info('Initializing performance monitoring');

    // Start performance monitoring
    performanceMonitor.startMonitoring(this.config.monitoringInterval);
    logger.debug('Performance monitoring started');

    // Setup alert handlers
    performanceMonitor.on('alert', alert => {
      logger.warn('Performance alert triggered', {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
      });

      // Could integrate with external alerting systems here
      if (alert.severity === 'critical') {
        this.handleCriticalAlert(alert);
      }
    });

    logger.info('Performance monitoring initialized');
  }

  /**
   * Setup automatic optimization
   */
  private setupAutoOptimization(): void {
    logger.info('Setting up automatic performance optimization', {
      interval: `${this.config.autoOptimizationInterval} hours`,
    });

    this.autoOptimizationTimer =
      performanceOptimizationService.scheduleOptimization(
        this.config.autoOptimizationInterval
      );
  }

  /**
   * Setup emergency optimization for critical alerts
   */
  private setupEmergencyOptimization(): void {
    logger.info('Setting up emergency optimization for critical alerts');

    performanceMonitor.on('alert', async alert => {
      if (alert.severity === 'critical') {
        logger.warn(
          'Critical alert detected - triggering emergency optimization',
          {
            alert,
          }
        );

        try {
          await this.runEmergencyOptimization(alert);
        } catch (error) {
          logger.error('Emergency optimization failed', { error, alert });
        }
      }
    });
  }

  /**
   * Handle critical performance alerts
   */
  private async handleCriticalAlert(alert: any): Promise<void> {
    logger.error('Critical performance alert requires immediate attention', {
      alert,
      timestamp: new Date(),
    });

    // Could integrate with:
    // - PagerDuty
    // - Slack notifications
    // - Email alerts
    // - SMS notifications

    // For now, just log the critical alert
    // In production, you would implement actual alerting mechanisms
  }

  /**
   * Run emergency optimization for specific alert types
   */
  private async runEmergencyOptimization(alert: any): Promise<void> {
    logger.info('Running emergency optimization', { alertType: alert.type });

    try {
      switch (alert.type) {
        case 'cpu':
          // CPU optimization
          if (global.gc) {
            global.gc();
            logger.info(
              'Manual garbage collection triggered for CPU optimization'
            );
          }
          break;

        case 'memory':
          // Memory optimization
          if (global.gc) {
            global.gc();
            logger.info(
              'Manual garbage collection triggered for memory optimization'
            );
          }
          // Could also clear caches, reduce connection pools, etc.
          break;

        case 'database':
          // Database optimization
          const poolOptimization =
            await connectionPoolManager.optimizePoolSize();
          logger.info('Emergency database pool optimization completed', {
            recommendations: poolOptimization.recommendations,
          });
          break;

        case 'api':
          // API optimization
          apiOptimizer.configurePagination({
            defaultLimit: 10, // Reduce default page size
            maxLimit: 25, // Reduce max page size
          });
          logger.info('Emergency API pagination optimization applied');
          break;

        default:
          logger.warn('No emergency optimization available for alert type', {
            alertType: alert.type,
          });
      }
    } catch (error) {
      logger.error('Emergency optimization failed', { error, alert });
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(
        `Received ${signal}, shutting down performance optimization gracefully`
      );

      try {
        // Stop automatic optimization
        if (this.autoOptimizationTimer) {
          clearInterval(this.autoOptimizationTimer);
          logger.info('Automatic optimization stopped');
        }

        // Stop performance monitoring
        performanceMonitor.stopMonitoring();
        logger.info('Performance monitoring stopped');

        // Stop database monitoring
        connectionPoolManager.stopMetricsCollection();
        logger.info('Database monitoring stopped');

        // Disconnect database connections
        await connectionPoolManager.disconnect();
        logger.info('Database connections closed');

        logger.info('Performance optimization shutdown completed');
      } catch (error) {
        logger.error('Error during performance optimization shutdown', {
          error,
        });
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get current performance status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    monitoring: boolean;
    autoOptimization: boolean;
    lastOptimization: Date | null;
    currentScore: number;
    activeAlerts: number;
    criticalAlerts: number;
  }> {
    const status =
      await performanceOptimizationService.getCurrentPerformanceStatus();
    const activeAlerts = performanceMonitor.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    return {
      initialized: this.isInitialized,
      monitoring: performanceMonitor.listenerCount('metrics') > 0,
      autoOptimization: this.autoOptimizationTimer !== undefined,
      lastOptimization: status.lastOptimization,
      currentScore: status.score,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<PerformanceIntegrationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info('Performance integration configuration updated', {
      oldConfig,
      newConfig: this.config,
    });

    // Restart components if necessary
    if (oldConfig.monitoringInterval !== this.config.monitoringInterval) {
      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.stopMonitoring();
        performanceMonitor.startMonitoring(this.config.monitoringInterval);
        logger.info('Performance monitoring restarted with new interval');
      }
    }

    if (
      oldConfig.autoOptimizationInterval !==
      this.config.autoOptimizationInterval
    ) {
      if (this.autoOptimizationTimer) {
        clearInterval(this.autoOptimizationTimer);
        this.setupAutoOptimization();
        logger.info('Automatic optimization rescheduled with new interval');
      }
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): PerformanceIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Force run optimization
   */
  async runOptimization(): Promise<any> {
    return await performanceOptimizationService.runFullOptimization();
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      current: performanceMonitor.getCurrentMetrics(),
      summary: performanceMonitor.getPerformanceSummary(),
      api: Object.fromEntries(apiOptimizer.getPerformanceMetrics()),
      database: connectionPoolManager.getConnectionMetrics(),
    };
  }
}

/**
 * Initialize performance optimization for Express app
 */
export async function initializePerformanceOptimization(
  app: Express,
  config?: Partial<PerformanceIntegrationConfig>
): Promise<PerformanceIntegration> {
  const integration = new PerformanceIntegration(app, config);
  await integration.initialize();
  return integration;
}

export default PerformanceIntegration;
