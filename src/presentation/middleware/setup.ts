import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { ConfigLoader } from '../../shared/config';
import { SERVICE_TOKENS } from '../../shared/container/types';

// Import middleware
import { authMiddleware } from './auth-middleware';
import { rateLimitMiddleware } from './rate-limit-middleware';
import { errorHandlerMiddleware } from './error-handler-middleware';
import { corsMiddleware } from './cors-middleware';
import { securityMiddleware } from './security-middleware';
import { validationMiddleware } from './validation-middleware';

/**
 * Setup all middleware for the Fastify application
 */
export async function setupMiddleware(
  app: FastifyInstance,
  container: DIContainer,
  config: ReturnType<typeof ConfigLoader.validateAllConfigs>
): Promise<void> {
  // Register CORS middleware
  await app.register(corsMiddleware, {
    origins: config.app.corsOrigins,
  });

  // Register security middleware (helmet, etc.)
  await app.register(securityMiddleware);

  // Register rate limiting middleware
  const rateLimitService = container.resolve(SERVICE_TOKENS.RATE_LIMIT_SERVICE);
  await app.register(rateLimitMiddleware, {
    rateLimitService,
    max: config.app.rateLimitMax,
    timeWindow: config.app.rateLimitWindow,
  });

  // Register validation middleware
  await app.register(validationMiddleware);

  // Register authentication middleware
  const jwtService = container.resolve(SERVICE_TOKENS.JWT_SERVICE);
  await app.register(authMiddleware, {
    jwtService,
  });

  // Register error handler middleware (should be last)
  const loggingService = container.resolve(SERVICE_TOKENS.LOGGING_SERVICE);
  await app.register(errorHandlerMiddleware, {
    loggingService,
    nodeEnv: config.app.nodeEnv,
  });

  // Add container and config to request context
  app.addHook('onRequest', async request => {
    (request as any).container = container;
    (request as any).config = config;
  });

  // Add health check endpoint
  app.get('/health', async () => {
    const healthService = container.resolve(SERVICE_TOKENS.HEALTH_SERVICE);
    const health = await healthService.getOverallHealth();

    return {
      status: health.status,
      timestamp: new Date().toISOString(),
      services: health.services.map(s => ({
        name: s.name,
        status: s.status,
        lastChecked: s.lastChecked,
      })),
    };
  });

  // Add metrics endpoint if enabled
  if (config.app.enableMetrics) {
    app.get('/metrics', async () => {
      const metricsService = container.resolve(SERVICE_TOKENS.METRICS_SERVICE);
      return await metricsService.getMetrics();
    });
  }

  // Add Swagger documentation if enabled
  if (config.app.enableSwagger && config.app.nodeEnv !== 'production') {
    await app.register(require('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'Task Management API',
          description: 'Production-ready task management system API',
          version: '1.0.0',
        },
        host: `localhost:${config.app.port}`,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          {
            name: 'Authentication',
            description: 'Authentication related endpoints',
          },
          { name: 'Users', description: 'User management endpoints' },
          { name: 'Workspaces', description: 'Workspace management endpoints' },
          { name: 'Projects', description: 'Project management endpoints' },
          { name: 'Tasks', description: 'Task management endpoints' },
          { name: 'Health', description: 'System health endpoints' },
        ],
      },
    });

    await app.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }
}
