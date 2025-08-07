import { Request, Response } from 'express';
import { performanceOptimizationService } from '../../infrastructure/performance/performance-optimization-service';
import { performanceMonitor } from '../../infrastructure/monitoring/performance-monitor';
import { queryOptimizer } from '../../infrastructure/database/query-optimizer';
import { connectionPoolManager } from '../../infrastructure/database/connection-pool-manager';
import { apiOptimizer } from '../../infrastructure/performance/api-optimizer';
import { logger } from '../../infrastructure/logging/logger';
import {
  formatSuccessResponse,
  formatErrorResponse,
} from '../../utils/response-formatter';

/**
 * Performance Controller
 * Handles performance optimization and monitoring endpoints
 */

export class PerformanceController {
  /**
   * Get current performance status
   */
  async getPerformanceStatus(req: Request, res: Response): Promise<void> {
    try {
      const status =
        await performanceOptimizationService.getCurrentPerformanceStatus();
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const activeAlerts = performanceMonitor.getActiveAlerts();

      const response = {
        status,
        currentMetrics,
        activeAlerts: activeAlerts.length,
        criticalAlerts: activeAlerts.filter(a => a.severity === 'critical')
          .length,
        timestamp: new Date(),
      };

      formatSuccessResponse(
        res,
        response,
        'Performance status retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get performance status', { error });
      formatErrorResponse(res, 'Failed to retrieve performance status', 500);
    }
  }

  /**
   * Run full performance optimization
   */
  async runOptimization(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Performance optimization requested', {
        userId: (req as any).user?.id,
        timestamp: new Date(),
      });

      const report = await performanceOptimizationService.runFullOptimization();

      formatSuccessResponse(
        res,
        report,
        'Performance optimization completed successfully'
      );
    } catch (error) {
      logger.error('Performance optimization failed', { error });

      if (
        error instanceof Error &&
        error.message.includes('already in progress')
      ) {
        formatErrorResponse(res, 'Optimization already in progress', 409);
      } else {
        formatErrorResponse(res, 'Performance optimization failed', 500);
      }
    }
  }

  /**
   * Get optimization history
   */
  async getOptimizationHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const history =
        performanceOptimizationService.getOptimizationHistory(limit);

      formatSuccessResponse(
        res,
        {
          history,
          total: history.length,
          limit,
        },
        'Optimization history retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get optimization history', { error });
      formatErrorResponse(res, 'Failed to retrieve optimization history', 500);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const format = (req.query.format as string) || 'json';

      if (format === 'prometheus') {
        const prometheusMetrics =
          performanceMonitor.exportMetrics('prometheus');
        res.setHeader('Content-Type', 'text/plain');
        res.send(prometheusMetrics);
        return;
      }

      const metricsHistory = performanceMonitor.getMetricsHistory(limit);
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const summary = performanceMonitor.getPerformanceSummary();

      formatSuccessResponse(
        res,
        {
          current: currentMetrics,
          history: metricsHistory,
          summary,
          total: metricsHistory.length,
        },
        'Performance metrics retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get performance metrics', { error });
      formatErrorResponse(res, 'Failed to retrieve performance metrics', 500);
    }
  }

  /**
   * Get performance alerts
   */
  async getPerformanceAlerts(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activeOnly = req.query.active === 'true';

      const alerts = activeOnly
        ? performanceMonitor.getActiveAlerts()
        : performanceMonitor.getAllAlerts(limit);

      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const highAlerts = alerts.filter(a => a.severity === 'high');

      formatSuccessResponse(
        res,
        {
          alerts,
          summary: {
            total: alerts.length,
            critical: criticalAlerts.length,
            high: highAlerts.length,
            active: alerts.filter(a => !a.resolved).length,
          },
        },
        'Performance alerts retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get performance alerts', { error });
      formatErrorResponse(res, 'Failed to retrieve performance alerts', 500);
    }
  }

  /**
   * Resolve performance alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;

      if (!alertId) {
        formatErrorResponse(res, 'Alert ID is required', 400);
        return;
      }

      const resolved = performanceMonitor.resolveAlert(alertId);

      if (resolved) {
        logger.info('Performance alert resolved', {
          alertId,
          userId: (req as any).user?.id,
        });
        formatSuccessResponse(
          res,
          { alertId, resolved: true },
          'Alert resolved successfully'
        );
      } else {
        formatErrorResponse(res, 'Alert not found', 404);
      }
    } catch (error) {
      logger.error('Failed to resolve alert', { error });
      formatErrorResponse(res, 'Failed to resolve alert', 500);
    }
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics(req: Request, res: Response): Promise<void> {
    try {
      const poolStats = await connectionPoolManager.getPoolStats();
      const connectionMetrics = connectionPoolManager.getConnectionMetrics();
      const connectionHealth =
        await connectionPoolManager.checkConnectionHealth();
      const dbMetrics = await queryOptimizer.getDatabaseMetrics();
      const slowQueries = await queryOptimizer.getSlowQueries(1000);

      formatSuccessResponse(
        res,
        {
          poolStats,
          connectionMetrics,
          connectionHealth,
          databaseMetrics: dbMetrics,
          slowQueries: slowQueries.slice(0, 10), // Limit to top 10
          timestamp: new Date(),
        },
        'Database performance metrics retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get database metrics', { error });
      formatErrorResponse(res, 'Failed to retrieve database metrics', 500);
    }
  }

  /**
   * Get API performance metrics
   */
  async getApiMetrics(req: Request, res: Response): Promise<void> {
    try {
      const performanceMetrics = apiOptimizer.getPerformanceMetrics();
      const recommendations = apiOptimizer.getOptimizationRecommendations();

      // Convert Map to Object for JSON serialization
      const metricsObject = Object.fromEntries(performanceMetrics);

      formatSuccessResponse(
        res,
        {
          metrics: metricsObject,
          recommendations,
          summary: {
            totalEndpoints: performanceMetrics.size,
            highPriorityIssues: recommendations.filter(
              r => r.priority === 'high'
            ).length,
            mediumPriorityIssues: recommendations.filter(
              r => r.priority === 'medium'
            ).length,
          },
          timestamp: new Date(),
        },
        'API performance metrics retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get API metrics', { error });
      formatErrorResponse(res, 'Failed to retrieve API metrics', 500);
    }
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(req: Request, res: Response): Promise<void> {
    try {
      const { tables, createIndexes, optimizeQueries, maintainTables } =
        req.body;

      const results = {
        indexesCreated: 0,
        tablesOptimized: 0,
        queriesAnalyzed: 0,
        recommendations: [] as string[],
      };

      // Create indexes if requested
      if (createIndexes) {
        const tablesToOptimize = tables || [
          'tasks',
          'users',
          'projects',
          'activities',
        ];

        for (const table of tablesToOptimize) {
          try {
            await queryOptimizer.createRecommendedIndexes(table);
            const analysis = await queryOptimizer.analyzeTableIndexes(table);
            results.indexesCreated += analysis.suggestedIndexes.length;
          } catch (error) {
            logger.warn(`Failed to create indexes for table ${table}`, {
              error,
            });
          }
        }
      }

      // Optimize table maintenance if requested
      if (maintainTables) {
        const tablesToMaintain = tables || [];

        if (tablesToMaintain.length > 0) {
          for (const table of tablesToMaintain) {
            await queryOptimizer.optimizeTableMaintenance(table);
            results.tablesOptimized++;
          }
        } else {
          await queryOptimizer.optimizeTableMaintenance();
          results.tablesOptimized = 1; // All tables
        }
      }

      // Analyze slow queries if requested
      if (optimizeQueries) {
        const slowQueries = await queryOptimizer.getSlowQueries(500);
        results.queriesAnalyzed = slowQueries.length;

        for (const query of slowQueries.slice(0, 5)) {
          // Analyze top 5
          const optimization = await queryOptimizer.optimizeQuery(query.query);
          results.recommendations.push(...optimization.recommendations);
        }
      }

      // Get connection pool recommendations
      const poolRecommendations =
        await connectionPoolManager.getOptimizationRecommendations();
      results.recommendations.push(...poolRecommendations);

      logger.info('Database optimization completed', {
        results,
        userId: (req as any).user?.id,
      });

      formatSuccessResponse(
        res,
        results,
        'Database optimization completed successfully'
      );
    } catch (error) {
      logger.error('Database optimization failed', { error });
      formatErrorResponse(res, 'Database optimization failed', 500);
    }
  }

  /**
   * Update performance thresholds
   */
  async updateThresholds(req: Request, res: Response): Promise<void> {
    try {
      const { thresholds } = req.body;

      if (!thresholds || typeof thresholds !== 'object') {
        formatErrorResponse(res, 'Valid thresholds object is required', 400);
        return;
      }

      performanceMonitor.updateThresholds(thresholds);

      logger.info('Performance thresholds updated', {
        thresholds,
        userId: (req as any).user?.id,
      });

      formatSuccessResponse(
        res,
        {
          thresholds,
          updated: true,
        },
        'Performance thresholds updated successfully'
      );
    } catch (error) {
      logger.error('Failed to update thresholds', { error });
      formatErrorResponse(res, 'Failed to update performance thresholds', 500);
    }
  }

  /**
   * Get performance recommendations
   */
  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const apiRecommendations = apiOptimizer.getOptimizationRecommendations();
      const dbRecommendations =
        await connectionPoolManager.getOptimizationRecommendations();
      const performanceSummary = performanceMonitor.getPerformanceSummary();

      const allRecommendations = [
        ...apiRecommendations.map(r => ({
          category: 'API',
          priority: r.priority,
          endpoint: r.endpoint,
          issues: r.issues,
          recommendations: r.recommendations,
        })),
        ...dbRecommendations.map(r => ({
          category: 'Database',
          priority: 'medium' as const,
          recommendation: r,
        })),
        ...performanceSummary.recommendations.map(r => ({
          category: 'System',
          priority: 'high' as const,
          recommendation: r,
        })),
      ];

      // Sort by priority
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      allRecommendations.sort((a, b) => {
        const aPriority =
          priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        const bPriority =
          priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        return bPriority - aPriority;
      });

      formatSuccessResponse(
        res,
        {
          recommendations: allRecommendations,
          summary: {
            total: allRecommendations.length,
            critical: allRecommendations.filter(r => r.priority === 'critical')
              .length,
            high: allRecommendations.filter(r => r.priority === 'high').length,
            medium: allRecommendations.filter(r => r.priority === 'medium')
              .length,
            low: allRecommendations.filter(r => r.priority === 'low').length,
          },
        },
        'Performance recommendations retrieved successfully'
      );
    } catch (error) {
      logger.error('Failed to get recommendations', { error });
      formatErrorResponse(
        res,
        'Failed to retrieve performance recommendations',
        500
      );
    }
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const { interval } = req.body;
      const intervalMs = interval || 30000;

      performanceMonitor.startMonitoring(intervalMs);

      logger.info('Performance monitoring started', {
        intervalMs,
        userId: (req as any).user?.id,
      });

      formatSuccessResponse(
        res,
        {
          monitoring: true,
          interval: intervalMs,
          startedAt: new Date(),
        },
        'Performance monitoring started successfully'
      );
    } catch (error) {
      logger.error('Failed to start monitoring', { error });
      formatErrorResponse(res, 'Failed to start performance monitoring', 500);
    }
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring(req: Request, res: Response): Promise<void> {
    try {
      performanceMonitor.stopMonitoring();

      logger.info('Performance monitoring stopped', {
        userId: (req as any).user?.id,
      });

      formatSuccessResponse(
        res,
        {
          monitoring: false,
          stoppedAt: new Date(),
        },
        'Performance monitoring stopped successfully'
      );
    } catch (error) {
      logger.error('Failed to stop monitoring', { error });
      formatErrorResponse(res, 'Failed to stop performance monitoring', 500);
    }
  }
}

export const performanceController = new PerformanceController();
