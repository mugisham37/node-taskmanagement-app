import { ConfigLoader } from '@taskmanagement/config';
import { IDatabaseConnection } from '@taskmanagement/database';
import { HealthService, LoggingService } from '@taskmanagement/observability';
import fastify, { FastifyInstance } from 'fastify';
import { ICacheService } from './infrastructure/caching/cache-service-interface';
import { setupMiddleware } from './presentation/middleware';
import { setupRoutes } from './presentation/routes';
import { setupWebSocket } from './presentation/websocket';
import { containerInitializationService } from './shared/container/container-initialization-service';
import { Container, SERVICE_TOKENS } from './shared/container/types';

/**
 * Application class that manages the entire system lifecycle
 */
export class Application {
  private app: FastifyInstance | null = null;
  private container: Container | null = null;
  private config: ReturnType<typeof ConfigLoader.validateAllConfigs>;
  private isShuttingDown = false;

  // Monitoring services
  private structuredLogger: StructuredLogger | null = null;
  private applicationMonitoring: ApplicationMonitoringService | null = null;
  private performanceMonitoring: PerformanceMonitoringService | null = null;
  private businessMetrics: BusinessMetricsService | null = null;
  private distributedTracing: DistributedTracingService | null = null;
  private healthCheckRegistry: HealthCheckRegistry | null = null;
  private webSocketMonitoring: WebSocketMonitoringService | null = null;

  constructor() {
    this.config = ConfigLoader.validateAllConfigs();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      // Initialize monitoring services first
      await this.initializeMonitoring();

      // Initialize dependency injection container
      this.container = await containerInitializationService.initialize();

      // Create Fastify instance
      this.app = fastify({
        logger: false, // We'll use our own logging service
        requestTimeout: this.config.app.requestTimeout,
        bodyLimit: this.config.app.bodyLimit,
      });

      // Setup application components
      await this.setupInfrastructure();
      await this.setupMonitoringIntegration();
      await this.setupMiddleware();
      await this.setupRoutes();
      await this.setupWebSocket();
      await this.setupGracefulShutdown();

      // Validate system health
      await this.validateSystemHealth();
    } catch (error) {
      const logger = this.getLogger();
      logger.error('Failed to initialize application', error as Error);
      throw error;
    }
  }

  /**
   * Start the application server
   */
  async start(): Promise<void> {
    if (!this.app) {
      throw new Error('Application not initialized. Call initialize() first.');
    }

    try {
      const logger = this.getLogger();

      await this.app.listen({
        port: this.config.app.port,
        host: this.config.app.host,
      });

      logger.info('Application started successfully', {
        port: this.config.app.port,
        host: this.config.app.host,
        environment: this.config.app.nodeEnv,
      });

      // Start health monitoring
      if (this.config.app.enableMetrics) {
        await this.startHealthMonitoring();
      }
    } catch (error) {
      const logger = this.getLogger();
      logger.error('Failed to start application', error as Error);
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    const logger = this.getLogger();

    try {
      logger.info('Shutting down application gracefully...');

      // Stop accepting new connections
      if (this.app) {
        await this.app.close();
      }

      // Close infrastructure connections
      await this.closeInfrastructure();

      // Shutdown monitoring services
      await this.shutdownMonitoring();

      // Shutdown container
      await containerInitializationService.shutdown();

      logger.info('Application shutdown completed');
    } catch (error) {
      logger.error('Error during application shutdown', error as Error);
      throw error;
    }
  }

  /**
   * Get the Fastify instance
   */
  getApp(): FastifyInstance {
    if (!this.app) {
      throw new Error('Application not initialized');
    }
    return this.app;
  }

  /**
   * Get the DI container
   */
  getContainer(): Container {
    if (!this.container) {
      throw new Error('Container not initialized');
    }
    return this.container;
  }

  /**
   * Get application configuration
   */
  getConfig(): ReturnType<typeof ConfigLoader.validateAllConfigs> {
    return this.config;
  }

  private async setupInfrastructure(): Promise<void> {
    if (!this.container) return;

    const logger = this.getLogger();
    logger.info('Setting up infrastructure services...');

    // Initialize database connection
    const dbConnection = this.container.resolve<IDatabaseConnection>(
      SERVICE_TOKENS.DATABASE_CONNECTION
    );
    await dbConnection.initialize();

    // Initialize cache service
    const cacheService = this.container.resolve<ICacheService>(SERVICE_TOKENS.CACHE_SERVICE);
    await cacheService.connect();

    // Initialize other infrastructure services
    const healthService = this.container.resolve<HealthService>(SERVICE_TOKENS.HEALTH_SERVICE);
    await healthService.initialize();

    logger.info('Infrastructure services initialized successfully');
  }

  private async setupMiddleware(): Promise<void> {
    if (!this.app || !this.container) return;

    const logger = this.getLogger();
    logger.info('Setting up middleware...');

    // Make container available to all routes
    this.app.decorate('container', this.container);
    this.app.decorate('config', this.config);

    await setupMiddleware(this.app, this.container, this.config);

    logger.info('Middleware setup completed');
  }

  private async setupRoutes(): Promise<void> {
    if (!this.app || !this.container) return;

    const logger = this.getLogger();
    logger.info('Setting up routes...');

    await setupRoutes(this.app, this.container);

    logger.info('Routes setup completed');
  }

  private async setupWebSocket(): Promise<void> {
    if (!this.app || !this.container || !this.config.app.enableWebSocket) return;

    const logger = this.getLogger();
    logger.info('Setting up WebSocket...');

    await setupWebSocket(this.app, this.container);

    logger.info('WebSocket setup completed');
  }

  private async setupGracefulShutdown(): Promise<void> {
    const logger = this.getLogger();

    // Handle process signals
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);

        setTimeout(() => {
          logger.error('Graceful shutdown timeout, forcing exit');
          process.exit(1);
        }, this.config.app.gracefulShutdownTimeout);

        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', error as Error);
          process.exit(1);
        }
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', new Error(String(reason)));
      process.exit(1);
    });
  }

  private async validateSystemHealth(): Promise<void> {
    if (!this.container) return;

    const logger = this.getLogger();
    logger.info('Validating system health...');

    const healthService = this.container.resolve<HealthService>(SERVICE_TOKENS.HEALTH_SERVICE);
    const health = await healthService.getOverallHealth();

    if (health.status === 'unhealthy') {
      const unhealthyServices = health.services
        .filter((s: any) => s.status === 'unhealthy')
        .map((s: any) => s.name);

      throw new Error(
        `System health check failed. Unhealthy services: ${unhealthyServices.join(', ')}`
      );
    }

    logger.info('System health validation passed', {
      status: health.status,
      healthyServices: health.services.filter((s: any) => s.status === 'healthy').length,
      totalServices: health.services.length,
    });
  }

  private async startHealthMonitoring(): Promise<void> {
    if (!this.container) return;

    const logger = this.getLogger();
    const healthService = this.container.resolve<HealthService>(SERVICE_TOKENS.HEALTH_SERVICE);

    // Start periodic health checks
    setInterval(async () => {
      try {
        const health = await healthService.getOverallHealth();

        if (health.status === 'unhealthy') {
          logger.warn('System health degraded', {
            status: health.status,
            unhealthyServices: health.services
              .filter((s: any) => s.status === 'unhealthy')
              .map((s: any) => s.name),
          });
        }
      } catch (error) {
        logger.error('Health check failed', error as Error);
      }
    }, this.config.app.healthCheckInterval);

    logger.info('Health monitoring started');
  }

  private async closeInfrastructure(): Promise<void> {
    if (!this.container) return;

    const logger = this.getLogger();

    try {
      // Close database connection
      const dbConnection = this.container.resolve<IDatabaseConnection>(
        SERVICE_TOKENS.DATABASE_CONNECTION
      );
      await dbConnection.close();

      // Close cache service
      const cacheService = this.container.resolve<ICacheService>(SERVICE_TOKENS.CACHE_SERVICE);
      await cacheService.disconnect();

      logger.info('Infrastructure services closed successfully');
    } catch (error) {
      logger.error('Error closing infrastructure services', error as Error);
    }
  }

  private async shutdownMonitoring(): Promise<void> {
    const logger = this.getLogger();

    try {
      logger.info('Shutting down monitoring services...');

      // Shutdown distributed tracing
      if (this.distributedTracing) {
        await this.distributedTracing.shutdown();
      }

      // Destroy monitoring services
      if (this.applicationMonitoring) {
        this.applicationMonitoring.destroy();
      }

      if (this.performanceMonitoring) {
        this.performanceMonitoring.destroy();
      }

      if (this.businessMetrics) {
        this.businessMetrics.destroy();
      }

      if (this.healthCheckRegistry) {
        this.healthCheckRegistry.destroy();
      }

      // Close structured logger
      if (this.structuredLogger) {
        await this.structuredLogger.close();
      }

      logger.info('Monitoring services shutdown completed');
    } catch (error) {
      logger.error('Error shutting down monitoring services', error as Error);
    }
  }

  private async initializeMonitoring(): Promise<void> {
    console.log('🔧 Initializing monitoring services...');

    // Initialize structured logger
    this.structuredLogger = new StructuredLogger({
      service: 'taskmanagement-api',
      version: this.config.app.version || '1.0.0',
      environment: this.config.app.nodeEnv,
      level: this.config.app.logLevel || 'info',
      enableConsole: true,
      enableFile: true,
      logDirectory: './logs',
    });

    // Initialize distributed tracing
    this.distributedTracing = new DistributedTracingService(
      {
        serviceName: 'taskmanagement-api',
        serviceVersion: this.config.app.version || '1.0.0',
        environment: this.config.app.nodeEnv,
        jaegerEndpoint: process.env.JAEGER_ENDPOINT,
        enableJaegerExporter: process.env.NODE_ENV !== 'test',
        enableConsoleExporter: process.env.NODE_ENV === 'development',
      },
      this.structuredLogger.getLogger()
    );

    // Initialize performance monitoring
    this.performanceMonitoring = new PerformanceMonitoringService(
      { getLogger: () => this.structuredLogger!.getLogger() } as any,
      {
        enabled: true,
        prefix: 'taskmanagement_api',
        alertThresholds: {
          httpResponseTime: 1000,
          databaseQueryTime: 500,
          memoryUsage: 0.85,
          cpuUsage: 0.8,
          errorRate: 0.05,
        },
      }
    );

    // Initialize business metrics
    this.businessMetrics = new BusinessMetricsService(
      { getLogger: () => this.structuredLogger!.getLogger() } as any,
      {
        enabled: true,
        prefix: 'taskmanagement_business',
      }
    );

    // Initialize application monitoring
    this.applicationMonitoring = new ApplicationMonitoringService(
      { getLogger: () => this.structuredLogger!.getLogger() } as any,
      this.businessMetrics,
      this.performanceMonitoring,
      {
        enabled: true,
        applicationName: 'taskmanagement-api',
        version: this.config.app.version || '1.0.0',
        environment: this.config.app.nodeEnv,
        healthCheckInterval: 30000,
        errorThreshold: 0.05,
        dependencies: ['database', 'cache', 'external-api'],
      }
    );

    // Initialize health check registry
    this.healthCheckRegistry = new HealthCheckRegistry(
      {
        version: this.config.app.version || '1.0.0',
        environment: this.config.app.nodeEnv,
        defaultTimeout: 5000,
      },
      this.structuredLogger.getLogger()
    );

    // Initialize WebSocket monitoring
    this.webSocketMonitoring = new WebSocketMonitoringService(
      { getLogger: () => this.structuredLogger!.getLogger() } as any,
      this.applicationMonitoring,
      this.businessMetrics
    );

    // Inject monitoring services for decorators
    injectMonitoringServices({
      applicationMonitoring: this.applicationMonitoring,
      performanceMonitoring: this.performanceMonitoring,
      businessMetrics: this.businessMetrics,
      logger: this.structuredLogger.getLogger(),
    });

    console.log('✅ Monitoring services initialized');
  }

  private async setupMonitoringIntegration(): Promise<void> {
    if (!this.app || !this.container) return;

    const logger = this.getLogger();
    logger.info('Setting up monitoring integration...');

    // Register Fastify monitoring plugin
    if (this.performanceMonitoring && this.applicationMonitoring && this.businessMetrics) {
      const fastifyMonitoring = new FastifyMonitoringPlugin(
        { getLogger: () => this.structuredLogger!.getLogger() } as any,
        this.applicationMonitoring,
        this.performanceMonitoring,
        this.businessMetrics
      );

      await this.app.register(fastifyMonitoring.plugin());
    }

    // Setup health checks
    await this.setupHealthChecks();

    // Setup metrics endpoint
    this.app.get('/metrics', async (request, reply) => {
      const register = require('prom-client').register;
      reply.type('text/plain');
      return register.metrics();
    });

    // Setup health endpoint
    this.app.get('/health', async (request, reply) => {
      if (!this.healthCheckRegistry) {
        return reply
          .code(503)
          .send({ status: 'unhealthy', message: 'Health checks not initialized' });
      }

      const health = await this.healthCheckRegistry.getSystemHealth();
      const statusCode =
        health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      return reply.code(statusCode).send(health);
    });

    // Setup readiness endpoint
    this.app.get('/ready', async (request, reply) => {
      if (!this.healthCheckRegistry) {
        return reply
          .code(503)
          .send({ status: 'not ready', message: 'Health checks not initialized' });
      }

      const criticalChecks = this.healthCheckRegistry.getCriticalChecks();
      const results = await Promise.all(
        criticalChecks.map((check) => this.healthCheckRegistry!.runSingleCheck(check.name))
      );

      const allPassing = results.every((result) => result.status === 'pass');
      const statusCode = allPassing ? 200 : 503;

      return reply.code(statusCode).send({
        status: allPassing ? 'ready' : 'not ready',
        checks: results.reduce(
          (acc, result, index) => {
            acc[criticalChecks[index].name] = result;
            return acc;
          },
          {} as Record<string, any>
        ),
      });
    });

    logger.info('Monitoring integration setup completed');
  }

  private async setupHealthChecks(): Promise<void> {
    if (!this.healthCheckRegistry || !this.container) return;

    const logger = this.getLogger();
    logger.info('Setting up health checks...');

    // Database health check
    const dbConnection = this.container.resolve<IDatabaseConnection>(
      SERVICE_TOKENS.DATABASE_CONNECTION
    );
    this.healthCheckRegistry.register(
      HealthCheckFactory.createDatabaseCheck(
        'database',
        async () => {
          try {
            // This would be a simple query to check database connectivity
            await dbConnection.query('SELECT 1');
            return true;
          } catch {
            return false;
          }
        },
        { interval: 30000 }
      )
    );

    // Cache health check
    const cacheService = this.container.resolve<ICacheService>(SERVICE_TOKENS.CACHE_SERVICE);
    this.healthCheckRegistry.register(
      HealthCheckFactory.createCacheCheck(
        'cache',
        async () => {
          try {
            await cacheService.ping();
            return true;
          } catch {
            return false;
          }
        },
        { interval: 30000 }
      )
    );

    // Memory health check
    this.healthCheckRegistry.register(
      HealthCheckFactory.createMemoryCheck(
        'memory',
        { warning: 0.8, critical: 0.9 },
        { interval: 60000 }
      )
    );

    logger.info('Health checks setup completed');
  }

  private getLogger(): LoggingService {
    try {
      if (this.structuredLogger) {
        return {
          info: (message: string, meta?: any) => this.structuredLogger!.info(message, meta),
          error: (message: string, meta?: any) => this.structuredLogger!.error(message, meta),
          warn: (message: string, meta?: any) => this.structuredLogger!.warn(message, meta),
          debug: (message: string, meta?: any) => this.structuredLogger!.debug(message, meta),
        } as LoggingService;
      }

      if (this.container) {
        return this.container.resolve<LoggingService>(SERVICE_TOKENS.LOGGING_SERVICE);
      }
      throw new Error('Container not available');
    } catch {
      // Fallback to console if logging service is not available
      return {
        info: (message: string, meta?: any) => console.log(message, meta),
        error: (message: string, meta?: any) => console.error(message, meta),
        warn: (message: string, meta?: any) => console.warn(message, meta),
        debug: (message: string, meta?: any) => console.debug(message, meta),
      } as LoggingService;
    }
  }
}

/**
 * Create and initialize the application
 */
export async function createApp(): Promise<Application> {
  const app = new Application();
  await app.initialize();
  return app;
}
