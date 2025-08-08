import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';

import { config } from '../shared/config/environment';
import { logger } from '@/infrastructure/logging/logger';
import { registerRoutes } from '@/presentation/routes';
import { errorHandler } from '../shared/middleware/error-handler';
import authenticationMiddleware from '../shared/middleware/authentication';
import { WebSocketServer } from '@/infrastructure/websocket';
import { webSocketBroadcastService } from '@/application/services/websocket.service';

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // We use our own logger
    trustProxy: true,
    bodyLimit: config.storage.maxFileSize,
  });

  // Register CORS
  await server.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  // Register security headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Register rate limiting
  await server.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    errorResponseBuilder: (request, context) => ({
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Rate limit exceeded',
      message: `Too many requests, please try again later.`,
      expiresIn: Math.round(context.ttl / 1000),
    }),
  });

  // Register WebSocket support
  await server.register(websocket);

  // Initialize and register WebSocket server
  const wsServer = new WebSocketServer({
    heartbeatInterval: 30000,
    connectionTimeout: 60000,
    maxConnections: 10000,
    enableCompression: true,
    enableMetrics: true,
  });

  await wsServer.register(server);

  // Initialize WebSocket broadcast service
  webSocketBroadcastService.initialize(wsServer);

  // Register Swagger documentation (only in development)
  if (config.features.apiDocs && config.app.isDevelopment) {
    await server.register(swagger, {
      swagger: {
        info: {
          title: 'Unified Enterprise Platform API',
          description:
            'Enterprise-grade authentication and task management platform',
          version: '1.0.0',
        },
        host: `${config.server.host}:${config.server.port}`,
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Enter JWT token in format: Bearer <token>',
          },
        },
      },
    });

    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }

  // Register global middleware
  server.addHook('onRequest', async (request, reply) => {
    const startTime = Date.now();
    request.startTime = startTime;

    logger.info(`📥 ${request.method} ${request.url}`, {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
  });

  server.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());

    logger.info(`📤 ${request.method} ${request.url} - ${reply.statusCode}`, {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      ip: request.ip,
    });
  });

  // Register authentication middleware
  server.register(authenticationMiddleware);

  // Register error handler
  server.setErrorHandler(errorHandler);

  // Health check endpoint
  server.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.environment,
      version: '1.0.0',
    };
  });

  // Register application routes
  await server.register(registerRoutes, { prefix: '/api/v1' });

  return server;
}

// Extend Fastify request interface
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    user?: {
      id: string;
      email: string;
      workspaceId?: string;
      roles: string[];
      permissions: string[];
    };
  }
}
