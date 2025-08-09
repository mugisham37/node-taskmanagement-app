import { FastifyInstance } from 'fastify';
import { HealthCheckService } from '../../infrastructure/monitoring/health-check-service';
import { RateLimitMiddleware } from '../middleware';

export async function healthRoutes(
  fastify: FastifyInstance,
  healthCheckService: HealthCheckService,
  rateLimitMiddleware: RateLimitMiddleware
): Promise<void> {
  // Health check endpoint - no authentication required
  fastify.get('/health', {
    preHandler: [
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: async (request, reply) => {
      try {
        const health = await healthCheckService.checkHealth();

        const statusCode = health.status === 'healthy' ? 200 : 503;

        await reply.status(statusCode).send({
          status: health.status,
          timestamp: health.timestamp,
          uptime: health.uptime,
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          checks: health.checks,
        });
      } catch (error) {
        await reply.status(503).send({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed',
        });
      }
    },
  });

  // Readiness probe
  fastify.get('/ready', {
    preHandler: [
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: async (request, reply) => {
      try {
        const isReady = await healthCheckService.checkReadiness();

        if (isReady) {
          await reply.status(200).send({ status: 'ready' });
        } else {
          await reply.status(503).send({ status: 'not ready' });
        }
      } catch (error) {
        await reply
          .status(503)
          .send({ status: 'not ready', error: 'Readiness check failed' });
      }
    },
  });

  // Liveness probe
  fastify.get('/live', {
    preHandler: [
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: async (request, reply) => {
      // Simple liveness check - if we can respond, we're alive
      await reply.status(200).send({ status: 'alive' });
    },
  });

  // Metrics endpoint (basic)
  fastify.get('/metrics', {
    preHandler: [
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
    ],
    handler: async (request, reply) => {
      try {
        const metrics = await healthCheckService.getMetrics();

        await reply.status(200).send(metrics);
      } catch (error) {
        await reply.status(500).send({ error: 'Failed to retrieve metrics' });
      }
    },
  });
}
