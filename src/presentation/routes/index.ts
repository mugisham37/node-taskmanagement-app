import { FastifyInstance } from 'fastify';
import { Container } from '../../shared/container';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

/**
 * Setup all routes for the Fastify application using dependency injection
 */
export async function setupRoutes(
  app: FastifyInstance,
  container: Container
): Promise<void> {
  // API version prefix
  const apiPrefix = '/api/v1';
  const loggingService = container.resolve('LOGGING_SERVICE') as LoggingService;

  try {
    // Health routes (no prefix, no auth required)
    await app.register(async fastify => {
      // Simple health route implementation
      fastify.get('/health', async () => {
        return { status: 'healthy', timestamp: new Date().toISOString() };
      });
    });

    // API routes with version prefix
    await app.register(async fastify => {
      // Basic routes setup - can be expanded later
      fastify.get('/', async () => {
        return {
          message: 'Task Management API',
          version: 'v1',
          timestamp: new Date().toISOString(),
        };
      });

      // Placeholder routes - implement as needed
      fastify.get('/auth/*', async () => {
        return { message: 'Auth endpoints will be implemented here' };
      });

      fastify.get('/tasks/*', async () => {
        return { message: 'Task endpoints will be implemented here' };
      });

      fastify.get('/projects/*', async () => {
        return { message: 'Project endpoints will be implemented here' };
      });

      fastify.get('/workspaces/*', async () => {
        return { message: 'Workspace endpoints will be implemented here' };
      });

      fastify.get('/users/*', async () => {
        return { message: 'User endpoints will be implemented here' };
      });
    }, { prefix: apiPrefix });

  } catch (error) {
    loggingService.error('Error setting up routes', error as Error);
    throw error;
  }

  // API documentation endpoint
  app.get(`${apiPrefix}`, async (_request, reply) => {
    return reply.send({
      message: 'Task Management API v1',
      version: '1.0.0',
      docs: '/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    });
  });

  // Catch-all for undefined routes
  app.setNotFoundHandler(async (request, reply) => {
    const isAPIRoute = request.url.startsWith('/api/');
    
    if (isAPIRoute) {
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

// Export interfaces and functions needed by server-setup
export interface RoutesDependencies {
  container: Container;
}

export async function registerRoutes(
  app: FastifyInstance,
  dependencies: RoutesDependencies
): Promise<void> {
  await setupRoutes(app, dependencies.container);
}

// Export route functions for backward compatibility
export * from './auth-routes';
export * from './task-routes';
export * from './project-routes';
export * from './workspace-routes';
export * from './user-routes';
export * from './health-routes';
export * from './notification-routes';
export * from './webhook-routes';
export * from './analytics-routes';
export * from './calendar-routes';
export * from './file-management-routes';
export * from './search-routes';
export * from './collaboration-routes';
export * from './monitoring-routes';
export * from './bulk-operations-routes';
