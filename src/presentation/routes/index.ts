import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { SERVICE_TOKENS } from '../../shared/container/types';
import { authRoutes } from './auth-routes';
import { taskRoutes } from './task-routes';
import { projectRoutes } from './project-routes';
import { workspaceRoutes } from './workspace-routes';
import { userRoutes } from './user-routes';
import { healthRoutes } from './health-routes';

/**
 * Setup all routes for the Fastify application using dependency injection
 */
export async function setupRoutes(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  // API version prefix
  const apiPrefix = '/api/v1';

  // Health routes (no prefix, no auth required)
  await app.register(async fastify => {
    await healthRoutes(fastify, container);
  });

  // API routes with version prefix
  await app.register(async fastify => {
    // Authentication routes
    await fastify.register(
      async fastify => {
        await authRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/auth` }
    );

    // Task routes
    await fastify.register(
      async fastify => {
        await taskRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/tasks` }
    );

    // Project routes
    await fastify.register(
      async fastify => {
        await projectRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/projects` }
    );

    // Workspace routes
    await fastify.register(
      async fastify => {
        await workspaceRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/workspaces` }
    );

    // User routes
    await fastify.register(
      async fastify => {
        await userRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/users` }
    );
  });

  // Add API root endpoint
  app.get(`${apiPrefix}`, async (request, reply) => {
    return {
      message: 'Task Management API',
      version: '1.0.0',
      documentation: '/docs',
      endpoints: {
        auth: `${apiPrefix}/auth`,
        tasks: `${apiPrefix}/tasks`,
        projects: `${apiPrefix}/projects`,
        workspaces: `${apiPrefix}/workspaces`,
        users: `${apiPrefix}/users`,
        health: '/health',
        metrics: '/metrics',
      },
    };
  });

  // 404 handler for API routes
  app.setNotFoundHandler(async (request, reply) => {
    const loggingService = container.resolve(SERVICE_TOKENS.LOGGING_SERVICE);

    loggingService.warn('Route not found', {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
    });

    if (request.url.startsWith(apiPrefix)) {
      await reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'API endpoint not found',
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      });
    } else {
      await reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      });
    }
  });
}

export * from './auth-routes';
export * from './task-routes';
export * from './project-routes';
export * from './workspace-routes';
export * from './user-routes';
export * from './health-routes';
