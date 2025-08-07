import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/status', async (request, reply) => {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
      },
    };
  });

  fastify.get('/readiness', async (request, reply) => {
    // TODO: Add database and Redis connectivity checks
    return {
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy', // Placeholder
          redis: 'healthy', // Placeholder
          external_services: 'healthy', // Placeholder
        },
      },
    };
  });

  fastify.get('/liveness', async (request, reply) => {
    return {
      success: true,
      data: {
        status: 'alive',
        timestamp: new Date().toISOString(),
      },
    };
  });
}