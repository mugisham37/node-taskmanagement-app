import { Container, IContainer } from './container';
import { ServiceRegistry, IServiceRegistry } from './service-registry';
import { logger } from '@/infrastructure/logging/logger';

export interface IBootstrap {
  initialize(): Promise<IContainer>;
  shutdown(): Promise<void>;
}

export class Bootstrap implements IBootstrap {
  private container: IContainer | null = null;
  private serviceRegistry: IServiceRegistry;
  private isInitialized = false;

  constructor() {
    this.serviceRegistry = new ServiceRegistry();
  }

  async initialize(): Promise<IContainer> {
    if (this.isInitialized) {
      throw new Error('Bootstrap has already been initialized');
    }

    try {
      logger.info('🚀 Starting service registration and bootstrap...');

      // Create root container
      this.container = new Container();

      // Register services in dependency order
      await this.registerServices();

      // Validate critical services
      await this.validateServices();

      // Initialize services that need startup logic
      await this.initializeServices();

      this.isInitialized = true;
      logger.info('✅ Bootstrap completed successfully');

      return this.container;
    } catch (error) {
      logger.error('❌ Bootstrap failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized || !this.container) {
      return;
    }

    try {
      logger.info('🔄 Starting graceful shutdown...');

      // Shutdown services in reverse order
      await this.shutdownServices();

      // Dispose container
      await this.container.dispose();

      this.container = null;
      this.isInitialized = false;

      logger.info('✅ Graceful shutdown completed');
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  private async registerServices(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    logger.info('📦 Registering domain services...');
    this.serviceRegistry.registerDomainServices(this.container);

    logger.info('📦 Registering infrastructure services...');
    this.serviceRegistry.registerInfrastructureServices(this.container);

    logger.info('📦 Registering application services...');
    this.serviceRegistry.registerApplicationServices(this.container);

    logger.info('📦 Registering presentation services...');
    this.serviceRegistry.registerPresentationServices(this.container);
  }

  private async validateServices(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    logger.info('🔍 Validating critical services...');

    const criticalServices = [
      'PrismaClient',
      'ILogger',
      'IConfiguration',
      'IDomainEventBus',
    ];

    for (const service of criticalServices) {
      try {
        if (!this.container.isRegistered(service)) {
          throw new Error(`Critical service '${service}' is not registered`);
        }

        // Try to resolve the service to ensure it can be instantiated
        const instance = this.container.resolve(service);
        if (!instance) {
          throw new Error(`Failed to resolve critical service '${service}'`);
        }

        logger.debug(`✅ Critical service '${service}' validated`);
      } catch (error) {
        logger.error(
          `❌ Failed to validate critical service '${service}':`,
          error
        );
        throw error;
      }
    }
  }

  private async initializeServices(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    logger.info('🔧 Initializing services...');

    try {
      // Initialize database connection
      const prisma = this.container.resolve('PrismaClient');
      if (prisma && typeof prisma.$connect === 'function') {
        await prisma.$connect();
        logger.info('✅ Database connection established');
      }

      // Initialize domain event bus
      const eventBus = this.container.resolve('IDomainEventBus');
      if (eventBus && typeof eventBus.initialize === 'function') {
        await eventBus.initialize();
        logger.info('✅ Domain event bus initialized');
      }

      // Initialize WebSocket service
      try {
        const webSocketService = this.container.resolve('IWebSocketService');
        if (
          webSocketService &&
          typeof webSocketService.initialize === 'function'
        ) {
          await webSocketService.initialize();
          logger.info('✅ WebSocket service initialized');
        }
      } catch (error) {
        logger.warn(
          '⚠️ WebSocket service initialization failed (non-critical):',
          error.message
        );
      }

      // Initialize presence service
      try {
        const presenceService = this.container.resolve('IPresenceService');
        if (
          presenceService &&
          typeof presenceService.initialize === 'function'
        ) {
          await presenceService.initialize();
          logger.info('✅ Presence service initialized');
        }
      } catch (error) {
        logger.warn(
          '⚠️ Presence service initialization failed (non-critical):',
          error.message
        );
      }

      // Initialize system monitoring
      try {
        const monitoringService = this.container.resolve(
          'ISystemMonitoringService'
        );
        if (
          monitoringService &&
          typeof monitoringService.initialize === 'function'
        ) {
          await monitoringService.initialize();
          logger.info('✅ System monitoring initialized');
        }
      } catch (error) {
        logger.warn(
          '⚠️ System monitoring initialization failed (non-critical):',
          error.message
        );
      }
    } catch (error) {
      logger.error('❌ Service initialization failed:', error);
      throw error;
    }
  }

  private async shutdownServices(): Promise<void> {
    if (!this.container) {
      return;
    }

    const shutdownOrder = [
      'ISystemMonitoringService',
      'IPresenceService',
      'IWebSocketService',
      'IDomainEventBus',
      'PrismaClient',
    ];

    for (const serviceName of shutdownOrder) {
      try {
        if (this.container.isRegistered(serviceName)) {
          const service = this.container.resolve(serviceName);

          if (service && typeof service.dispose === 'function') {
            await service.dispose();
            logger.info(`✅ Service '${serviceName}' disposed`);
          } else if (service && typeof service.$disconnect === 'function') {
            // Handle Prisma client specifically
            await service.$disconnect();
            logger.info(`✅ Service '${serviceName}' disconnected`);
          }
        }
      } catch (error) {
        logger.warn(
          `⚠️ Error disposing service '${serviceName}':`,
          error.message
        );
        // Continue with other services
      }
    }
  }

  private async cleanup(): Promise<void> {
    if (this.container) {
      try {
        await this.container.dispose();
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
      this.container = null;
    }
    this.isInitialized = false;
  }

  // Getter for container (for testing purposes)
  getContainer(): IContainer | null {
    return this.container;
  }

  // Check if bootstrap is initialized
  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Global bootstrap instance
export const bootstrap = new Bootstrap();
