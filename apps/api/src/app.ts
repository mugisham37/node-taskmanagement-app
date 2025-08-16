import { ConfigLoader } from '@taskmanagement/config';
import { IDatabaseConnection } from '@taskmanagement/database';
import fastify, { FastifyInstance } from 'fastify';
import { ICacheService } from './infrastructure/caching/cache-service-interface';
import { HealthService } from './infrastructure/monitoring/health-service';
import { LoggingService } from './infrastructure/monitoring/logging-service';
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

  constructor() {
    this.config = ConfigLoader.validateAllConfigs();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
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

  private getLogger(): LoggingService {
    try {
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
