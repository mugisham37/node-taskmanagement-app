import { FastifyInstance } from 'fastify';
import { DIContainer } from '../shared/container';
import { LoggingService } from '../infrastructure/monitoring/logging-service';
import { ComprehensiveValidationMiddleware } from './middleware/comprehensive-validation-middleware';
import { StandardizedResponseMiddleware } from './middleware/standardized-response-middleware';
import { setupAPIDocumentation } from './documentation/setup-api-docs';

/**
 * Setup Phase 7 API completeness features
 */
export async function setupPhase7API(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  const logger = container.resolve('LOGGING_SERVICE') as LoggingService;

  logger.info('Setting up Phase 7 API completeness features...');

  // 1. Setup comprehensive validation middleware
  await setupComprehensiveValidation(app, container, logger);

  // 2. Setup standardized response middleware
  await setupStandardizedResponses(app, container, logger);

  // 3. Setup comprehensive API documentation
  await setupAPIDocumentation(app, logger);

  // 4. Setup additional API features
  await setupAdditionalAPIFeatures(app, container, logger);

  // 5. Setup API versioning
  await setupAPIVersioning(app, logger);

  // 6. Setup API monitoring and analytics
  await setupAPIMonitoring(app, container, logger);

  logger.info('Phase 7 API completeness features setup completed');
}

/**
 * Setup comprehensive validation middleware
 */
async function setupComprehensiveValidation(
  app: FastifyInstance,
  _container: DIContainer,
  logger: LoggingService
): Promise<void> {
  const validationMiddleware = new ComprehensiveValidationMiddleware(logger);

  // Register validation middleware globally
  app.addHook('preHandler', async (request, reply) => {
    // Add validation helpers to request
    (request as any).validate = {
      body: (schema: any, options?: any) =>
        validationMiddleware.validateBody(schema, options)(request, reply),
      query: (schema: any, options?: any) =>
        validationMiddleware.validateQuery(schema, options)(request, reply),
      params: (schema: any, options?: any) =>
        validationMiddleware.validateParams(schema, options)(request, reply),
      headers: (schema: any, options?: any) =>
        validationMiddleware.validateHeaders(schema, options)(request, reply),
      request: (schemas: any, options?: any) =>
        validationMiddleware.validateRequest(schemas, options)(request, reply),
      fileUpload: (options?: any) =>
        validationMiddleware.validateFileUpload(options)(request, reply),
      businessRules: (rules: any[]) =>
        validationMiddleware.validateBusinessRules(rules)(request, reply),
    };
  });

  logger.info('Comprehensive validation middleware setup completed');
}

/**
 * Setup standardized response middleware
 */
async function setupStandardizedResponses(
  app: FastifyInstance,
  _container: DIContainer,
  logger: LoggingService
): Promise<void> {
  const responseMiddleware = new StandardizedResponseMiddleware(logger);

  // Initialize response standardization
  app.addHook('onRequest', responseMiddleware.initialize());

  // Add CORS headers
  app.addHook('onRequest', responseMiddleware.addCorsHeaders());

  // Add security headers
  app.addHook('onRequest', responseMiddleware.addSecurityHeaders());

  // Add performance headers
  app.addHook('onSend', responseMiddleware.addPerformanceHeaders());

  // Setup global error handler
  app.setErrorHandler(responseMiddleware.createGlobalErrorHandler());

  // Setup response transformation
  app.addHook('onSend', responseMiddleware.createResponseTransformHook());

  logger.info('Standardized response middleware setup completed');
}

/**
 * Setup additional API features
 */
async function setupAdditionalAPIFeatures(
  app: FastifyInstance,
  _container: DIContainer,
  logger: LoggingService
): Promise<void> {
  // Setup request/response compression
  await app.register(require('@fastify/compress'), {
    global: true,
    threshold: 1024,
    encodings: ['gzip', 'deflate'],
  });

  // Setup multipart form data handling
  await app.register(require('@fastify/multipart'), {
    limits: {
      fieldNameSize: 100,
      fieldSize: 100,
      fields: 10,
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
      headerPairs: 2000,
    },
  });

  // Setup cookie support
  await app.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || 'default-secret-key',
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  });

  // Setup session support
  await app.register(require('@fastify/session'), {
    secret: process.env.SESSION_SECRET || 'default-session-secret',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });

  // Setup static file serving
  await app.register(require('@fastify/static'), {
    root: process.env.STATIC_FILES_PATH || './public',
    prefix: '/static/',
  });

  // Setup health check endpoint
  app.get('/health', async (_request, reply) => {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      checks: {
        database: 'healthy', // TODO: Implement actual health checks
        cache: 'healthy',
        externalServices: 'healthy',
      },
    };

    return reply.send(healthCheck);
  });

  // Setup metrics endpoint
  app.get('/metrics', async (_request, reply) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      // TODO: Add more detailed metrics
    };

    return reply.send(metrics);
  });

  logger.info('Additional API features setup completed');
}

/**
 * Setup API versioning
 */
async function setupAPIVersioning(
  app: FastifyInstance,
  logger: LoggingService
): Promise<void> {
  // Add version header to all responses
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('API-Version', process.env.API_VERSION || '1.0.0');
    return payload;
  });

  // Handle version negotiation
  app.addHook('preHandler', async (request, _reply) => {
    const acceptVersion = request.headers['accept-version'];
    const currentVersion = process.env.API_VERSION || '1.0.0';

    if (acceptVersion && acceptVersion !== currentVersion) {
      // Log version mismatch for monitoring
      logger.warn('API version mismatch', {
        requested: acceptVersion,
        current: currentVersion,
        path: request.url,
        userAgent: request.headers['user-agent'],
      });

      // For now, continue with current version
      // In the future, implement version-specific routing
    }

    (request as any).apiVersion = currentVersion;
  });

  // Add deprecation warnings for old endpoints
  const deprecatedEndpoints: string[] = [
    // Add deprecated endpoints here
  ];

  app.addHook('preHandler', async (request, reply) => {
    const isDeprecated = deprecatedEndpoints.some(endpoint =>
      request.url.startsWith(endpoint)
    );

    if (isDeprecated) {
      reply.header('Deprecation', 'true');
      reply.header(
        'Sunset',
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      );

      logger.warn('Deprecated endpoint accessed', {
        path: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
      });
    }
  });

  logger.info('API versioning setup completed');
}

/**
 * Setup API monitoring and analytics
 */
async function setupAPIMonitoring(
  app: FastifyInstance,
  _container: DIContainer,
  logger: LoggingService
): Promise<void> {
  // Request/response logging
  app.addHook('onRequest', async (request, _reply) => {
    (request as any).startTime = Date.now();

    logger.info('API request started', {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      requestId: (request as any).requestId,
    });
  });

  app.addHook('onResponse', async (request, reply) => {
    const responseTime =
      Date.now() - ((request as any).startTime || Date.now());

    logger.info('API request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
      requestId: (request as any).requestId,
    });
  });

  // Error tracking
  app.addHook('onError', async (request, _reply, error) => {
    logger.error('API request error', error, {
      url: request.url,
      method: request.method,
      requestId: (request as any).requestId,
    });
  });

  // Rate limiting monitoring
  app.addHook('preHandler', async (request, reply) => {
    const rateLimitInfo = reply.getHeader('x-ratelimit-remaining');

    if (rateLimitInfo && parseInt(rateLimitInfo as string) < 10) {
      logger.warn('Rate limit approaching', {
        remaining: rateLimitInfo,
        path: request.url,
        ip: request.ip,
      });
    }
  });

  // Performance monitoring
  app.addHook('onSend', async (request, _reply, payload) => {
    const responseTime =
      Date.now() - ((request as any).startTime || Date.now());

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow API request detected', {
        method: request.method,
        url: request.url,
        responseTime,
        requestId: (request as any).requestId,
      });
    }

    // Track response sizes
    const responseSize = Buffer.isBuffer(payload)
      ? payload.length
      : JSON.stringify(payload).length;

    if (responseSize > 1024 * 1024) {
      // 1MB
      logger.warn('Large API response detected', {
        method: request.method,
        url: request.url,
        responseSize,
        requestId: (request as any).requestId,
      });
    }

    return payload;
  });

  logger.info('API monitoring and analytics setup completed');
}

/**
 * Setup API security enhancements
 */
export async function setupAPISecurityEnhancements(
  app: FastifyInstance,
  _container: DIContainer,
  logger: LoggingService
): Promise<void> {
  // Setup helmet for security headers
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // Setup request ID tracking
  app.addHook('onRequest', async (request, reply) => {
    const requestId =
      request.headers['x-request-id'] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    (request as any).requestId = requestId;
    reply.header('X-Request-ID', requestId);
  });

  // Setup IP whitelisting for admin endpoints
  const adminEndpoints = ['/api/v1/admin', '/api/v1/monitoring'];
  const allowedIPs = process.env['ADMIN_ALLOWED_IPS']?.split(',') || [];

  if (allowedIPs.length > 0) {
    app.addHook('preHandler', async (request, reply) => {
      const isAdminEndpoint = adminEndpoints.some(endpoint =>
        request.url.startsWith(endpoint)
      );

      if (isAdminEndpoint && !allowedIPs.includes(request.ip)) {
        logger.warn('Unauthorized admin access attempt', {
          ip: request.ip,
          path: request.url,
          userAgent: request.headers['user-agent'],
        });

        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied from this IP address',
          },
        });
      }
    });
  }

  logger.info('API security enhancements setup completed');
}
