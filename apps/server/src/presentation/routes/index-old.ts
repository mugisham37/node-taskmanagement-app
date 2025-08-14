import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { SERVICE_TOKENS } from '../../shared/container/types';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { authRoutes } from './auth-routes';
import { taskRoutes } from './task-routes';
import { projectRoutes } from './project-routes';
import { workspaceRoutes } from './workspace-routes';
import { userRoutes } from './user-routes';
import { healthRoutes } from './health-routes';
import { notificationRoutes } from './notification-routes';
import { webhookRoutes } from './webhook-routes';
import { analyticsRoutes } from './analytics-routes';
import { calendarRoutes } from './calendar-routes';
import { fileManagementRoutes } from './file-management-routes';
import { searchRoutes } from './search-routes';
import { collaborationRoutes } from './collaboration-routes';
import { monitoringRoutes } from './monitoring-routes';
import { bulkOperationsRoutes } from './bulk-operations-routes';
import { setupMigrationRoutes } from '../../infrastructure/migration/migration-routes';

/**
 * Setup all routes for the Fastify application using dependency injection
 */
export async function setupRoutes(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  // API version prefix
  const apiPrefix = '/api/v1';

  // Get required services from container
  const loggingService = container.resolve('LOGGING_SERVICE') as LoggingService;
  const healthCheckService = container.resolve('HEALTH_CHECK_SERVICE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const taskController = container.resolve('TASK_CONTROLLER');
  const projectController = container.resolve('PROJECT_CONTROLLER');
  const workspaceController = container.resolve('WORKSPACE_CONTROLLER');
  const userController = container.resolve('USER_CONTROLLER');

  // Health routes (no prefix, no auth required)
  await app.register(async fastify => {
    await healthRoutes(fastify, healthCheckService, rateLimitMiddleware);
  });

  // API routes with version prefix
  await app.register(async fastify => {
    // Authentication routes
    await fastify.register(
      async fastify => {
        const authController = container.resolve('AUTH_CONTROLLER');
        await authRoutes(fastify, authController, authMiddleware, rateLimitMiddleware);
      },
      { prefix: `${apiPrefix}/auth` }
    );

    // Task routes
    await fastify.register(
      async fastify => {
        await taskRoutes(fastify, taskController, authMiddleware, rateLimitMiddleware);
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

    // Notification routes
    await fastify.register(
      async fastify => {
        await notificationRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/notifications` }
    );

    // Webhook routes
    await fastify.register(
      async fastify => {
        await webhookRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/webhooks` }
    );

    // Analytics routes
    await fastify.register(
      async fastify => {
        await analyticsRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/analytics` }
    );

    // Calendar routes
    await fastify.register(
      async fastify => {
        await calendarRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/calendar` }
    );

    // File management routes
    await fastify.register(
      async fastify => {
        await fileManagementRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/files` }
    );

    // Search routes
    await fastify.register(
      async fastify => {
        await searchRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/search` }
    );

    // Collaboration routes
    await fastify.register(
      async fastify => {
        await collaborationRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/collaboration` }
    );

    // Monitoring routes
    await fastify.register(
      async fastify => {
        await monitoringRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/monitoring` }
    );

    // Bulk operations routes
    await fastify.register(
      async fastify => {
        await bulkOperationsRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}/bulk` }
    );

    // Migration routes
    await fastify.register(
      async fastify => {
        await setupMigrationRoutes(fastify, container);
      },
      { prefix: `${apiPrefix}` }
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
        notifications: `${apiPrefix}/notifications`,
        webhooks: `${apiPrefix}/webhooks`,
        analytics: `${apiPrefix}/analytics`,
        calendar: `${apiPrefix}/calendar`,
        files: `${apiPrefix}/files`,
        search: `${apiPrefix}/search`,
        collaboration: `${apiPrefix}/collaboration`,
        monitoring: `${apiPrefix}/monitoring`,
        bulk: `${apiPrefix}/bulk`,
        migration: `${apiPrefix}/migration`,
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

// Export interfaces and functions needed by server-setup
export interface RoutesDependencies {
  container: DIContainer;
}

export async function registerRoutes(
  app: FastifyInstance,
  dependencies: RoutesDependencies
): Promise<void> {
  await setupRoutes(app, dependencies.container);
}

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
