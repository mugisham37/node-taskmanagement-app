import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { ConfigLoader } from '../../shared/config';
import { SERVICE_TOKENS } from '../../shared/container/types';

// Import middleware
import { RateLimitMiddleware } from './rate-limit-middleware';
import { ErrorHandlerMiddleware } from './error-handler-middleware';
import { CorsMiddleware } from './cors-middleware';
import { SecurityMiddleware } from './security-middleware';

/**
 * Setup all middleware for the Fastify application
 */
export async function setupMiddleware(
  app: FastifyInstance,
  container: DIContainer,
  config: ReturnType<typeof ConfigLoader.validateAllConfigs>
): Promise<void> {
  // Register CORS middleware
  const corsMiddleware = container.resolve<CorsMiddleware>('CorsMiddleware');
  app.addHook('preHandler', corsMiddleware.handle);

  // Register security middleware (helmet, etc.)
  const securityMiddleware = container.resolve<SecurityMiddleware>('SecurityMiddleware');
  app.addHook('preHandler', securityMiddleware.handle);

  // Register rate limiting middleware
  const rateLimitMiddleware = container.resolve<RateLimitMiddleware>('RateLimitMiddleware');
  app.addHook('preHandler', rateLimitMiddleware.globalRateLimit());

  // Register validation middleware
  // ValidationMiddleware is typically added per route, not globally

  // Register authentication middleware  
  // AuthMiddleware is typically added per route, not globally

  // Register error handler middleware (should be last)
  const errorHandlerMiddleware = container.resolve<ErrorHandlerMiddleware>('ErrorHandlerMiddleware');
  app.setErrorHandler(errorHandlerMiddleware.handle);

  // Add container and config to request context
  app.addHook('onRequest', async request => {
    (request as any).container = container;
    (request as any).config = config;
  });

  // Add health check endpoint
  app.get('/health', async () => {
    const healthService = container.resolve(SERVICE_TOKENS.HEALTH_SERVICE) as any;
    const health = await healthService.getOverallHealth();

    return {
      status: health.status,
      timestamp: new Date().toISOString(),
      services: health.services.map((s: any) => ({
        name: s.name,
        status: s.status,
        lastChecked: s.lastChecked,
      })),
    };
  });

  // Add metrics endpoint if enabled
  if (config.app.enableMetrics) {
    app.get('/metrics', async () => {
      const metricsService = container.resolve(SERVICE_TOKENS.METRICS_SERVICE) as any;
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
