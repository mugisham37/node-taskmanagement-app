import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { LoggingService } from '@taskmanagement/observability';
import Fastify, { FastifyInstance } from 'fastify';
import { ErrorHandlerMiddleware } from './middleware';
import { registerRoutes, RoutesDependencies } from './routes';
import { WebSocketHandler } from './websocket';

export interface ServerConfig {
  host: string;
  port: number;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  security: {
    contentSecurityPolicy: string | false;
    hsts: boolean;
  };
  rateLimit: {
    global: {
      max: number;
      timeWindow: string;
    };
  };
  websocket: {
    enabled: boolean;
  };
}

export class ServerSetup {
  private fastify: FastifyInstance;

  constructor(
    private readonly config: ServerConfig,
    private readonly logger: LoggingService
  ) {
    this.fastify = Fastify({
      logger: false, // We use our own logger
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'requestId',
      genReqId: () => this.generateRequestId(),
    });
  }

  async setupServer(dependencies: RoutesDependencies): Promise<FastifyInstance> {
    try {
      // Setup middleware
      await this.setupMiddleware(dependencies);

      // Setup WebSocket if enabled
      if (this.config.websocket.enabled) {
        await this.setupWebSocket(dependencies);
      }

      // Register routes
      await registerRoutes(this.fastify, dependencies);

      // Setup error handling
      await this.setupErrorHandling(dependencies);

      this.logger.info('Server setup completed successfully');

      return this.fastify;
    } catch (error) {
      this.logger.error('Failed to setup server', error as Error);
      throw error;
    }
  }

  private async setupMiddleware(_dependencies: RoutesDependencies): Promise<void> {
    // CORS middleware
    await this.fastify.register(cors, {
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
      ],
    });

    // Security headers middleware
    await this.fastify.register(helmet, {
      contentSecurityPolicy:
        this.config.security.contentSecurityPolicy !== false
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                fontSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
                frameSrc: ["'none'"],
              },
            }
          : false,
      hsts: this.config.security.hsts
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    });

    // Global rate limiting
    await this.fastify.register(rateLimit, {
      global: true,
      max: this.config.rateLimit.global.max,
      timeWindow: this.config.rateLimit.global.timeWindow,
      redis: undefined, // We'll use our custom rate limiting
    });

    // Request logging middleware
    this.fastify.addHook('onRequest', async (request, _reply) => {
      this.logger.info('Incoming request', {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    });

    // Response logging middleware
    this.fastify.addHook('onResponse', async (request, reply) => {
      this.logger.info('Request completed', {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.getResponseTime(),
      });
    });

    this.logger.info('Middleware setup completed');
  }

  private async setupWebSocket(_dependencies: RoutesDependencies): Promise<void> {
    // Create a simplified WebSocket handler with required dependencies
    const webSocketHandler = new WebSocketHandler(
      this.logger,
      {} as any, // JWTService - will be properly injected later
      {} as any, // WebSocketService - will be properly injected later
      {} as any // RealtimeEventService - will be properly injected later
    );

    await this.fastify.register(websocket);

    this.fastify.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection: any, request: any) => {
        try {
          // Use the simplified connection handler
          (webSocketHandler as any).handleSimpleConnection(connection, request);
        } catch (error) {
          this.logger.error('WebSocket connection error', error as Error);
        }
      });
    });

    this.logger.info('WebSocket setup completed');
  }

  private async setupErrorHandling(_dependencies: RoutesDependencies): Promise<void> {
    const errorHandler = new ErrorHandlerMiddleware(this.logger);

    // Global error handler
    this.fastify.setErrorHandler(errorHandler.handle);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully`);

      try {
        await this.fastify.close();
        this.logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    this.logger.info('Error handling setup completed');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async start(): Promise<void> {
    try {
      await this.fastify.listen({
        host: this.config.host,
        port: this.config.port,
      });

      this.logger.info('Server started successfully', {
        host: this.config.host,
        port: this.config.port,
        environment: process.env.NODE_ENV || 'development',
      });
    } catch (error) {
      this.logger.error('Failed to start server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      this.logger.info('Server stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping server', error as Error);
      throw error;
    }
  }

  getFastifyInstance(): FastifyInstance {
    return this.fastify;
  }
}
