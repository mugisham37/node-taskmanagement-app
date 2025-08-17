import { FastifyInstance } from 'fastify';
import { RateLimitMiddleware } from '../middleware';

export async function monitoringRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const monitoringController = container.resolve('MONITORING_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // Most monitoring routes require admin access
  const adminPreHandlers = [
    authMiddleware.authenticate,
    authMiddleware.requireRole('admin'),
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // System health and status
  fastify.get('/health', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getSystemHealth,
  });

  fastify.get('/health/detailed', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getDetailedHealth,
  });

  fastify.get('/status', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getSystemStatus,
  });

  // Performance metrics
  fastify.get('/metrics', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getMetrics,
  });

  fastify.get('/metrics/performance', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getPerformanceMetrics,
  });

  fastify.get('/metrics/business', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getBusinessMetrics,
  });

  fastify.get('/metrics/infrastructure', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getInfrastructureMetrics,
  });

  // Error tracking and logging
  fastify.get('/errors', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getErrors,
  });

  fastify.get('/errors/:id', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getError,
  });

  fastify.post('/errors/:id/resolve', {
    preHandler: adminPreHandlers,
    handler: monitoringController.resolveError,
  });

  fastify.get('/logs', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getLogs,
  });

  fastify.get('/logs/search', {
    preHandler: adminPreHandlers,
    handler: monitoringController.searchLogs,
  });

  // Alerts and notifications
  fastify.get('/alerts', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getAlerts,
  });

  fastify.post('/alerts', {
    preHandler: adminPreHandlers,
    handler: monitoringController.createAlert,
  });

  fastify.put('/alerts/:id', {
    preHandler: adminPreHandlers,
    handler: monitoringController.updateAlert,
  });

  fastify.delete('/alerts/:id', {
    preHandler: adminPreHandlers,
    handler: monitoringController.deleteAlert,
  });

  fastify.post('/alerts/:id/acknowledge', {
    preHandler: adminPreHandlers,
    handler: monitoringController.acknowledgeAlert,
  });

  // System diagnostics
  fastify.get('/diagnostics', {
    preHandler: adminPreHandlers,
    handler: monitoringController.runDiagnostics,
  });

  fastify.get('/diagnostics/database', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getDatabaseDiagnostics,
  });

  fastify.get('/diagnostics/cache', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getCacheDiagnostics,
  });

  fastify.get('/diagnostics/external-services', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getExternalServicesDiagnostics,
  });

  // Performance profiling
  fastify.post('/profiling/start', {
    preHandler: adminPreHandlers,
    handler: monitoringController.startProfiling,
  });

  fastify.post('/profiling/stop', {
    preHandler: adminPreHandlers,
    handler: monitoringController.stopProfiling,
  });

  fastify.get('/profiling/results', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getProfilingResults,
  });

  // User-accessible monitoring
  fastify.get('/my/activity', {
    preHandler: readPreHandlers,
    handler: monitoringController.getMyActivity,
  });

  fastify.get('/my/performance', {
    preHandler: readPreHandlers,
    handler: monitoringController.getMyPerformance,
  });

  // Audit logs
  fastify.get('/audit', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getAuditLogs,
  });

  fastify.get('/audit/user/:userId', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getUserAuditLogs,
  });

  fastify.get('/audit/entity/:entityType/:entityId', {
    preHandler: adminPreHandlers,
    handler: monitoringController.getEntityAuditLogs,
  });

  // System maintenance
  fastify.post('/maintenance/start', {
    preHandler: adminPreHandlers,
    handler: monitoringController.startMaintenance,
  });

  fastify.post('/maintenance/stop', {
    preHandler: adminPreHandlers,
    handler: monitoringController.stopMaintenance,
  });

  fastify.get('/maintenance/status', {
    preHandler: readPreHandlers,
    handler: monitoringController.getMaintenanceStatus,
  });
}

