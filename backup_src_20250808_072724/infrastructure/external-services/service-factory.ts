import { logger } from '../logging/logger';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';

export interface IExternalService {
  name: string;
  isHealthy(): Promise<boolean>;
  getHealthDetails(): Promise<ServiceHealthDetails>;
}

export interface ServiceHealthDetails {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServiceProvider {
  name: string;
  priority: number;
  isEnabled: boolean;
  config: Record<string, any>;
}

export interface ServiceFactoryOptions {
  providers: ServiceProvider[];
  fallbackStrategy: 'failover' | 'round_robin' | 'priority';
  healthCheckInterval: number;
  circuitBreakerOptions?: any;
}

export abstract class BaseExternalService implements IExternalService {
  protected circuitBreaker: CircuitBreaker;
  protected lastHealthCheck?: Date;
  protected healthStatus: ServiceHealthDetails;

  constructor(
    public readonly name: string,
    protected readonly config: Record<string, any> = {}
  ) {
    const registry = CircuitBreakerRegistry.getInstance();
    this.circuitBreaker = registry.getOrCreate(name, {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000,
      monitoringPeriod: config.monitoringPeriod || 300000,
    });

    this.healthStatus = {
      status: 'healthy',
      lastChecked: new Date(),
    };

    // Start periodic health checks
    if (config.healthCheckInterval) {
      setInterval(() => {
        this.performHealthCheck();
      }, config.healthCheckInterval);
    }
  }

  public abstract isHealthy(): Promise<boolean>;

  public async getHealthDetails(): Promise<ServiceHealthDetails> {
    if (
      !this.lastHealthCheck ||
      Date.now() - this.lastHealthCheck.getTime() > 30000
    ) {
      // 30 seconds
      await this.performHealthCheck();
    }
    return this.healthStatus;
  }

  protected async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.isHealthy();
      const responseTime = Date.now() - startTime;

      this.healthStatus = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastChecked: new Date(),
      };

      this.lastHealthCheck = new Date();
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.healthStatus = {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };

      this.lastHealthCheck = new Date();
      logger.error(`Health check failed for service ${this.name}`, { error });
    }
  }

  protected async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.circuitBreaker.execute(operation);
  }
}

export class ServiceFactory<T extends IExternalService> {
  private providers: ServiceProvider[] = [];
  private services = new Map<string, T>();
  private currentProviderIndex = 0;
  private readonly options: ServiceFactoryOptions;

  constructor(
    private readonly serviceType: string,
    private readonly createService: (provider: ServiceProvider) => T,
    options: Partial<ServiceFactoryOptions> = {}
  ) {
    this.options = {
      providers: [],
      fallbackStrategy: 'failover',
      healthCheckInterval: 60000, // 1 minute
      ...options,
    };

    this.providers = this.options.providers.filter(p => p.isEnabled);
    this.initializeServices();
  }

  private initializeServices(): void {
    for (const provider of this.providers) {
      try {
        const service = this.createService(provider);
        this.services.set(provider.name, service);
        logger.info(
          `Initialized ${this.serviceType} service: ${provider.name}`
        );
      } catch (error) {
        logger.error(
          `Failed to initialize ${this.serviceType} service: ${provider.name}`,
          {
            error,
          }
        );
      }
    }
  }

  public async getService(): Promise<T> {
    if (this.services.size === 0) {
      throw new Error(`No ${this.serviceType} services available`);
    }

    switch (this.options.fallbackStrategy) {
      case 'failover':
        return await this.getServiceWithFailover();
      case 'round_robin':
        return await this.getServiceWithRoundRobin();
      case 'priority':
        return await this.getServiceWithPriority();
      default:
        throw new Error(
          `Unknown fallback strategy: ${this.options.fallbackStrategy}`
        );
    }
  }

  private async getServiceWithFailover(): Promise<T> {
    const sortedProviders = [...this.providers].sort(
      (a, b) => b.priority - a.priority
    );

    for (const provider of sortedProviders) {
      const service = this.services.get(provider.name);
      if (!service) continue;

      try {
        const isHealthy = await service.isHealthy();
        if (isHealthy) {
          return service;
        }
      } catch (error) {
        logger.warn(`Service ${provider.name} health check failed`, { error });
        continue;
      }
    }

    // If no healthy service found, return the highest priority one
    const highestPriorityProvider = sortedProviders[0];
    const service = this.services.get(highestPriorityProvider.name);
    if (!service) {
      throw new Error(`No ${this.serviceType} services available`);
    }

    logger.warn(
      `Using potentially unhealthy service: ${highestPriorityProvider.name}`
    );
    return service;
  }

  private async getServiceWithRoundRobin(): Promise<T> {
    const healthyServices: T[] = [];

    // Check health of all services
    for (const provider of this.providers) {
      const service = this.services.get(provider.name);
      if (!service) continue;

      try {
        const isHealthy = await service.isHealthy();
        if (isHealthy) {
          healthyServices.push(service);
        }
      } catch (error) {
        logger.warn(`Service ${provider.name} health check failed`, { error });
      }
    }

    if (healthyServices.length === 0) {
      // Fallback to any available service
      const anyService = Array.from(this.services.values())[0];
      if (!anyService) {
        throw new Error(`No ${this.serviceType} services available`);
      }
      return anyService;
    }

    // Round robin through healthy services
    const service =
      healthyServices[this.currentProviderIndex % healthyServices.length];
    this.currentProviderIndex++;

    return service;
  }

  private async getServiceWithPriority(): Promise<T> {
    const sortedProviders = [...this.providers].sort(
      (a, b) => b.priority - a.priority
    );

    // Always return the highest priority service, regardless of health
    const highestPriorityProvider = sortedProviders[0];
    const service = this.services.get(highestPriorityProvider.name);

    if (!service) {
      throw new Error(`No ${this.serviceType} services available`);
    }

    return service;
  }

  public async getAllServicesHealth(): Promise<
    Record<string, ServiceHealthDetails>
  > {
    const health: Record<string, ServiceHealthDetails> = {};

    for (const [name, service] of this.services) {
      try {
        health[name] = await service.getHealthDetails();
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return health;
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.services.keys());
  }

  public getService(providerName: string): T | undefined {
    return this.services.get(providerName);
  }

  public addProvider(provider: ServiceProvider): void {
    if (!provider.isEnabled) {
      return;
    }

    try {
      const service = this.createService(provider);
      this.services.set(provider.name, service);
      this.providers.push(provider);

      logger.info(
        `Added ${this.serviceType} service provider: ${provider.name}`
      );
    } catch (error) {
      logger.error(
        `Failed to add ${this.serviceType} service provider: ${provider.name}`,
        {
          error,
        }
      );
    }
  }

  public removeProvider(providerName: string): boolean {
    const removed = this.services.delete(providerName);
    this.providers = this.providers.filter(p => p.name !== providerName);

    if (removed) {
      logger.info(
        `Removed ${this.serviceType} service provider: ${providerName}`
      );
    }

    return removed;
  }

  public updateProviderConfig(
    providerName: string,
    config: Record<string, any>
  ): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    provider.config = { ...provider.config, ...config };

    // Recreate the service with new config
    try {
      const service = this.createService(provider);
      this.services.set(providerName, service);

      logger.info(
        `Updated ${this.serviceType} service provider config: ${providerName}`
      );
    } catch (error) {
      logger.error(
        `Failed to update ${this.serviceType} service provider config: ${providerName}`,
        {
          error,
        }
      );
    }
  }
}

// Service registry for managing multiple service factories
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private factories = new Map<string, ServiceFactory<any>>();

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  public register<T extends IExternalService>(
    serviceType: string,
    factory: ServiceFactory<T>
  ): void {
    this.factories.set(serviceType, factory);
    logger.info(`Registered service factory: ${serviceType}`);
  }

  public get<T extends IExternalService>(
    serviceType: string
  ): ServiceFactory<T> | undefined {
    return this.factories.get(serviceType);
  }

  public async getService<T extends IExternalService>(
    serviceType: string
  ): Promise<T> {
    const factory = this.get<T>(serviceType);
    if (!factory) {
      throw new Error(`Service factory not found: ${serviceType}`);
    }
    return await factory.getService();
  }

  public async getAllServicesHealth(): Promise<
    Record<string, Record<string, ServiceHealthDetails>>
  > {
    const health: Record<string, Record<string, ServiceHealthDetails>> = {};

    for (const [serviceType, factory] of this.factories) {
      health[serviceType] = await factory.getAllServicesHealth();
    }

    return health;
  }

  public getRegisteredServices(): string[] {
    return Array.from(this.factories.keys());
  }
}
