import {
  AlertingConfig,
  AlertingService,
  LoggingService,
  MetricsService,
} from '@taskmanagement/observability';
import { FastifyInstance } from 'fastify';
import { DIContainer } from '../shared/container';
import { setupMigrationModule } from '../migration/migration.module';

/**
 * Integration example showing how to use the fixed migration and alerting services
 */
export async function setupInfrastructureIntegration(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  // Setup migration module
  await setupMigrationModule(app, container);

  // Setup alerting service
  const alertingConfig: AlertingConfig = {
    enabled: true,
    evaluationInterval: 30000, // 30 seconds
    maxActiveAlerts: 100,
    retentionPeriod: 7, // days
    defaultCooldownPeriod: 300000, // 5 minutes
    enableAutoResolution: true,
    autoResolutionTimeout: 3600000, // 1 hour
  };

  const loggingService = container.resolve<LoggingService>('LoggingService');
  const metricsService = container.resolve<MetricsService>('MetricsService');

  const alertingService = new AlertingService(alertingConfig, loggingService, metricsService);

  // Register alerting service in container
  container.registerInstance('AlertingService', alertingService);

  // Setup alerting endpoints
  app.get('/api/monitoring/alerts', async (_, reply) => {
    try {
      const alerts = alertingService.getActiveAlerts();
      return {
        success: true,
        alerts: Array.from(alerts.values()),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  app.post('/api/monitoring/alerts/:alertId/acknowledge', async (request, reply) => {
    try {
      const { alertId } = request.params as { alertId: string };
      const { acknowledgedBy } = request.body as { acknowledgedBy: string };

      if (!acknowledgedBy) {
        return reply.status(400).send({
          success: false,
          error: 'acknowledgedBy is required',
        });
      }

      alertingService.acknowledgeAlert(alertId, acknowledgedBy);

      return {
        success: true,
        message: 'Alert acknowledged successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  app.post('/api/monitoring/alerts/:alertId/resolve', async (request, reply) => {
    try {
      const { alertId } = request.params as { alertId: string };
      const { resolvedBy } = request.body as { resolvedBy?: string };

      alertingService.resolveAlert(alertId, resolvedBy);

      return {
        success: true,
        message: 'Alert resolved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Add custom alert rules
  alertingService.addRule({
    name: 'Migration Failure Rate',
    description: 'Alert when migration failure rate exceeds threshold',
    condition: {
      type: 'threshold',
      metric: 'migration_failure_rate',
      operator: '>',
      value: 0.1, // 10% failure rate
      timeWindow: 300000, // 5 minutes
      aggregation: 'avg',
    },
    severity: 'HIGH',
    enabled: true,
    cooldownPeriod: 600000, // 10 minutes
    actions: [
      {
        type: 'log',
        config: { level: 'error' },
        enabled: true,
      },
    ],
    tags: {
      service: 'migration',
      category: 'reliability',
    },
  });

  // Setup health check endpoint
  app.get('/api/health', async (_, reply) => {
    try {
      const alertingStats = {
        activeAlerts: alertingService.getActiveAlerts().length,
        totalRules: alertingService.getRules().length,
      };

      return {
        success: true,
        status: 'healthy',
        services: {
          migration: 'available',
          alerting: 'available',
        },
        stats: {
          alerting: alertingStats,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(503).send({
        success: false,
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  });

  console.log('Infrastructure integration setup completed successfully');
}

/**
 * Example usage in main application
 */
export async function exampleApplicationSetup(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  try {
    // Setup infrastructure
    await setupInfrastructureIntegration(app, container);

    // Start monitoring metrics for migration
    const alertingService = container.resolve<AlertingService>('AlertingService');

    // Example: Record migration metrics
    alertingService.recordMetric('migration_attempts_total', 1, {
      environment: 'development',
      type: 'file_migration',
    });

    alertingService.recordMetric('migration_success_total', 1, {
      environment: 'development',
      type: 'file_migration',
    });

    alertingService.recordMetric('migration_duration_seconds', 2.5, {
      environment: 'development',
      type: 'file_migration',
    });

    console.log('Application setup with monitoring completed');
  } catch (error) {
    console.error('Failed to setup application:', error);
    throw error;
  }
}
