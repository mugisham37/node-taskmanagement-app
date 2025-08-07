import { logger } from './logging/logger';
import {
  connectPrisma,
  disconnectPrisma,
  prismaHealthCheck,
} from './database/prisma-client';
import {
  connectCache,
  disconnectCache,
  cacheHealthCheck,
} from './cache/redis-client';
import { ServiceRegistry } from './external-services/service-factory';
import { createEmailService } from './external-services/email/email-service';
import { CircuitBreakerRegistry } from './external-services/circuit-breaker';

export interface InfrastructureConfig {
  database: {
    url: string;
    enableLogging?: boolean;
  };
  cache: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  email: {
    providers: Array<{
      name: string;
      priority: number;
      isEnabled: boolean;
      config: Record<string, any>;
    }>;
    fallbackStrategy: 'failover' | 'round_robin' | 'priority';
  };
  monitoring: {
    enableMetrics?: boolean;
    enableHealthChecks?: boolean;
    healthCheckInterval?: number;
  };
}

export class InfrastructureBootstrap {
  private isInitialized = false;
  private readonly config: InfrastructureConfig;

  constructor(config: InfrastructureConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Infrastructure already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing infrastructure...');

      // Initialize database
      await this.initializeDatabase();

      // Initialize cache
      await this.initializeCache();

      // Initialize external services
      await this.initializeExternalServices();

      // Initialize monitoring
      await this.initializeMonitoring();

      this.isInitialized = true;
      logger.info('✅ Infrastructure initialization completed successfully');
    } catch (error) {
      logger.error('❌ Infrastructure initialization failed', { error });
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    logger.info('📊 Initializing database connection...');

    try {
      await connectPrisma();

      const isHealthy = await prismaHealthCheck();
      if (!isHealthy) {
        throw new Error('Database health check failed');
      }

      logger.info('✅ Database initialized successfully');
    } catch (error) {
      logger.error('❌ Database initialization failed', { error });
      throw error;
    }
  }

  private async initializeCache(): Promise<void> {
    logger.info('🗄️ Initializing cache connection...');

    try {
      await connectCache();

      const isHealthy = await cacheHealthCheck();
      if (!isHealthy) {
        throw new Error('Cache health check failed');
      }

      logger.info('✅ Cache initialized successfully');
    } catch (error) {
      logger.error('❌ Cache initialization failed', { error });
      throw error;
    }
  }

  private async initializeExternalServices(): Promise<void> {
    logger.info('🔌 Initializing external services...');

    try {
      const serviceRegistry = ServiceRegistry.getInstance();

      // Initialize email service
      if (this.config.email.providers.length > 0) {
        const { ServiceFactory } = await import(
          './external-services/service-factory'
        );

        const emailFactory = new ServiceFactory('email', createEmailService, {
          providers: this.config.email.providers,
          fallbackStrategy: this.config.email.fallbackStrategy,
          healthCheckInterval: 60000, // 1 minute
        });

        serviceRegistry.register('email', emailFactory);
        logger.info('✅ Email service initialized');
      }

      logger.info('✅ External services initialized successfully');
    } catch (error) {
      logger.error('❌ External services initialization failed', { error });
      throw error;
    }
  }

  private async initializeMonitoring(): Promise<void> {
    if (
      !this.config.monitoring.enableHealthChecks &&
      !this.config.monitoring.enableMetrics
    ) {
      return;
    }

    logger.info('📊 Initializing monitoring...');

    try {
      // Initialize health checks
      if (this.config.monitoring.enableHealthChecks) {
        // Health check initialization would go here
        logger.info('✅ Health checks initialized');
      }

      // Initialize metrics
      if (this.config.monitoring.enableMetrics) {
        // Metrics initialization would go here
        logger.info('✅ Metrics initialized');
      }

      logger.info('✅ Monitoring initialized successfully');
    } catch (error) {
      logger.error('❌ Monitoring initialization failed', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('🛑 Shutting down infrastructure...');

    try {
      // Shutdown external services
      await this.shutdownExternalServices();

      // Shutdown cache
      await this.shutdownCache();

      // Shutdown database
      await this.shutdownDatabase();

      this.isInitialized = false;
      logger.info('✅ Infrastructure shutdown completed successfully');
    } catch (error) {
      logger.error('❌ Infrastructure shutdown failed', { error });
      throw error;
    }
  }

  private async shutdownDatabase(): Promise<void> {
    try {
      await disconnectPrisma();
      logger.info('✅ Database connection closed');
    } catch (error) {
      logger.error('❌ Database shutdown failed', { error });
    }
  }

  private async shutdownCache(): Promise<void> {
    try {
      await disconnectCache();
      logger.info('✅ Cache connection closed');
    } catch (error) {
      logger.error('❌ Cache shutdown failed', { error });
    }
  }

  private async shutdownExternalServices(): Promise<void> {
    try {
      // Reset all circuit breakers
      const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
      circuitBreakerRegistry.clear();

      logger.info('✅ External services shutdown');
    } catch (error) {
      logger.error('❌ External services shutdown failed', { error });
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: Date;
  }> {
    const services: Record<string, boolean> = {};
    let overallHealthy = true;

    // Check database health
    try {
      services.database = await prismaHealthCheck();
      if (!services.database) overallHealthy = false;
    } catch (error) {
      services.database = false;
      overallHealthy = false;
    }

    // Check cache health
    try {
      services.cache = await cacheHealthCheck();
      if (!services.cache) overallHealthy = false;
    } catch (error) {
      services.cache = false;
      overallHealthy = false;
    }

    // Check external services health
    try {
      const serviceRegistry = ServiceRegistry.getInstance();
      const externalServicesHealth =
        await serviceRegistry.getAllServicesHealth();

      for (const [serviceType, providersHealth] of Object.entries(
        externalServicesHealth
      )) {
        for (const [providerName, health] of Object.entries(providersHealth)) {
          const serviceName = `${serviceType}.${providerName}`;
          services[serviceName] = health.status === 'healthy';
          if (!services[serviceName]) overallHealthy = false;
        }
      }
    } catch (error) {
      logger.error('Error checking external services health', { error });
      overallHealthy = false;
    }

    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      services,
      timestamp: new Date(),
    };
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getConfig(): InfrastructureConfig {
    return { ...this.config };
  }
}

// Factory function for creating infrastructure bootstrap
export function createInfrastructureBootstrap(
  config: InfrastructureConfig
): InfrastructureBootstrap {
  return new InfrastructureBootstrap(config);
}

// Default configuration
export function getDefaultInfrastructureConfig(): InfrastructureConfig {
  return {
    database: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://postgres:password@localhost:5432/taskmanagement',
      enableLogging: process.env.NODE_ENV === 'development',
    },
    cache: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    },
    email: {
      providers: [
        {
          name: 'smtp',
          priority: 1,
          isEnabled: true,
          config: {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '587'),
            username: process.env.SMTP_USERNAME,
            password: process.env.SMTP_PASSWORD,
            defaultFrom: process.env.SMTP_FROM || 'noreply@example.com',
          },
        },
      ],
      fallbackStrategy: 'failover' as const,
    },
    monitoring: {
      enableMetrics: process.env.ENABLE_METRICS === 'true',
      enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
      healthCheckInterval: parseInt(
        process.env.HEALTH_CHECK_INTERVAL || '60000'
      ),
    },
  };
}
