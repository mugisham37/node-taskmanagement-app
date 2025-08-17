import { FastifyInstance } from 'fastify';
import { RateLimitMiddleware } from '../middleware';

export async function analyticsRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const analyticsController = container.resolve('ANALYTICS_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All analytics routes require authentication
  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  const exportPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
  ];

  // Dashboard analytics
  fastify.get('/dashboard', {
    preHandler: readPreHandlers,
    handler: analyticsController.getDashboardAnalytics,
  });

  // Task analytics
  fastify.get('/tasks', {
    preHandler: readPreHandlers,
    handler: analyticsController.getTaskAnalytics,
  });

  // Project analytics
  fastify.get('/projects', {
    preHandler: readPreHandlers,
    handler: analyticsController.getProjectAnalytics,
  });

  // User productivity analytics
  fastify.get('/productivity', {
    preHandler: readPreHandlers,
    handler: analyticsController.getUserProductivityAnalytics,
  });

  // Activity analytics
  fastify.get('/activity', {
    preHandler: readPreHandlers,
    handler: analyticsController.getActivityAnalytics,
  });

  // Export analytics
  fastify.post('/export', {
    preHandler: exportPreHandlers,
    handler: analyticsController.exportAnalytics,
  });
}

