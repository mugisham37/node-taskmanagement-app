import { FastifyInstance } from 'fastify';
import { Container, SERVICE_TOKENS } from '../../shared/container';
import { LoggingService } from '@taskmanagement/observability';
import { ContainerHealthChecker } from '../../shared/container/health-checker';
// Import route modules
import { authRoutes } from './auth-routes';
import { taskRoutes } from './task-routes';
import { projectRoutes } from './project-routes';
import { workspaceRoutes } from './workspace-routes';
import { userRoutes } from './user-routes';
import { notificationRoutes } from './notification-routes';
import { webhookRoutes } from './webhook-routes';
import { calendarRoutes } from './calendar-routes';
import { setupTRPCRoutes } from './trpc';

/**
 * Setup all routes for the Fastify application using dependency injection
 */
export async function setupRoutes(
  app: FastifyInstance,
  container: Container
): Promise<void> {
  // API version prefix
  const apiPrefix = '/api/v1';
  const loggingService = container.resolve(
    SERVICE_TOKENS.LOGGING_SERVICE
  ) as LoggingService;

  try {
    // Get middleware services from container
    const authMiddleware = container.resolve(SERVICE_TOKENS.AUTH_MIDDLEWARE);
    const rateLimitMiddleware = container.resolve(
      SERVICE_TOKENS.RATE_LIMIT_MIDDLEWARE
    );

    // Health routes (no prefix, no auth required) - Use health checker from container
    await app.register(async fastify => {
      const healthChecker = new ContainerHealthChecker(container);

      fastify.get('/health', async () => {
        const healthStatus = await healthChecker.getOverallHealth();
        return {
          status: healthStatus.status,
          timestamp: new Date().toISOString(),
          summary: healthStatus.summary,
          services: healthStatus.services.map(s => ({
            token: s.token,
            status: s.status,
            message: s.message,
            lastChecked: s.lastChecked,
          })),
        };
      });

      fastify.get('/health/detailed', async () => {
        return await healthChecker.checkAllServices();
      });
    });

    // Setup tRPC routes
    await setupTRPCRoutes(app, container);

    // API routes with version prefix
    await app.register(
      async fastify => {
        // Root API information
        fastify.get('/', async () => {
          return {
            message: 'Task Management API',
            version: 'v1',
            timestamp: new Date().toISOString(),
            endpoints: {
              trpc: '/api/trpc',
              auth: `${apiPrefix}/auth`,
              tasks: `${apiPrefix}/tasks`,
              projects: `${apiPrefix}/projects`,
              workspaces: `${apiPrefix}/workspaces`,
              users: `${apiPrefix}/users`,
              notifications: `${apiPrefix}/notifications`,
              webhooks: `${apiPrefix}/webhooks`,
              calendar: `${apiPrefix}/calendar`,
            },
          };
        });

        // Authentication routes
        await fastify.register(
          async fastify => {
            const authController = container.resolve(
              SERVICE_TOKENS.AUTH_CONTROLLER
            );
            await authRoutes(
              fastify,
              authController as any,
              authMiddleware as any,
              rateLimitMiddleware as any
            );
          },
          { prefix: '/auth' }
        );

        // Task routes
        await fastify.register(
          async fastify => {
            const taskController = container.resolve(
              SERVICE_TOKENS.TASK_CONTROLLER
            );
            await taskRoutes(
              fastify,
              taskController as any,
              authMiddleware as any,
              rateLimitMiddleware as any
            );
          },
          { prefix: '/tasks' }
        );

        // Project routes
        await fastify.register(
          async fastify => {
            const projectController = container.resolve(
              SERVICE_TOKENS.PROJECT_CONTROLLER
            );
            const taskController = container.resolve(
              SERVICE_TOKENS.TASK_CONTROLLER
            );
            await projectRoutes(
              fastify,
              projectController as any,
              taskController as any,
              authMiddleware as any,
              rateLimitMiddleware as any
            );
          },
          { prefix: '/projects' }
        );

        // Workspace routes
        await fastify.register(
          async fastify => {
            const workspaceController = container.resolve(
              SERVICE_TOKENS.WORKSPACE_CONTROLLER
            );
            const projectController = container.resolve(
              SERVICE_TOKENS.PROJECT_CONTROLLER
            );
            await workspaceRoutes(
              fastify,
              workspaceController as any,
              projectController as any,
              authMiddleware as any,
              rateLimitMiddleware as any
            );
          },
          { prefix: '/workspaces' }
        );

        // User routes
        await fastify.register(
          async fastify => {
            const userController = container.resolve(
              SERVICE_TOKENS.USER_CONTROLLER
            );
            await userRoutes(
              fastify,
              userController as any,
              authMiddleware as any,
              rateLimitMiddleware as any
            );
          },
          { prefix: '/users' }
        );

        // Notification routes - Use container-based approach
        await fastify.register(
          async fastify => {
            await notificationRoutes(fastify, container);
          },
          { prefix: '/notifications' }
        );

        // Webhook routes - Use container-based approach
        await fastify.register(
          async fastify => {
            await webhookRoutes(fastify, container);
          },
          { prefix: '/webhooks' }
        );

        // Calendar routes - Use container-based approach
        await fastify.register(
          async fastify => {
            await calendarRoutes(fastify, container);
          },
          { prefix: '/calendar' }
        );
      },
      { prefix: apiPrefix }
    );
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

