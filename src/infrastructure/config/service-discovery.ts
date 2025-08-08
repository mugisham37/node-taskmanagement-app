import { getConfigurationManager } from './configuration-manager';
import type { ExternalServicesConfig } from './configuration-manager';

export interface ServiceEndpoint {
  name: string;
  url: string;
  healthCheckUrl?: string;
  timeout?: number;
  retries?: number;
  circuitBreakerThreshold?: number;
  headers?: Record<string, string>;
  authentication?: ServiceAuthentication;
}

export interface ServiceAuthentication {
  type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IServiceDiscovery {
  registerService(service: ServiceEndpoint): void;
  getService(name: string): ServiceEndpoint | undefined;
  getAllServices(): ServiceEndpoint[];
  removeService(name: string): void;
  checkHealth(serviceName?: string): Promise<ServiceHealth[]>;
  isServiceHealthy(serviceName: string): Promise<boolean>;
  getHealthyServices(): Promise<ServiceEndpoint[]>;
  refreshServices(): Promise<void>;
}

class EnterpriseServiceDiscovery implements IServiceDiscovery {
  private services: Map<string, ServiceEndpoint> = new Map();
  private healthCache: Map<string, ServiceHealth> = new Map();
  private configManager = getConfigurationManager();
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly HEALTH_CACHE_TTL = 60000; // 1 minute
  private healthCheckTimer?: NodeJS.Timeout;

  constructor() {
    this.initializeServices();
    this.startHealthChecking();
  }

  private initializeServices(): void {
    const config = this.configManager.getConfig();

    // Register core services
    this.registerCoreServices(config);

    // Register external services
    this.registerExternalServices(config.externalServices);

    // Register infrastructure services
    this.registerInfrastructureServices(config);
  }

  private registerCoreServices(config: any): void {
    // Database service
    this.registerService({
      name: 'database',
      url: config.database.url,
      healthCheckUrl: `${config.database.url}/health`,
      timeout: config.database.connectionTimeout || 30000,
      retries: 3,
      circuitBreakerThreshold: 5,
    });

    // Redis service
    if (config.redis.url || config.redis.host) {
      const redisUrl =
        config.redis.url || `redis://${config.redis.host}:${config.redis.port}`;
      this.registerService({
        name: 'redis',
        url: redisUrl,
        timeout: 5000,
        retries: 3,
        circuitBreakerThreshold: 5,
        authentication: config.redis.password
          ? {
              type: 'basic',
              credentials: { password: config.redis.password },
            }
          : { type: 'none' },
      });
    }

    // Email service
    if (config.email.smtp?.host) {
      this.registerService({
        name: 'email',
        url: `smtp://${config.email.smtp.host}:${config.email.smtp.port}`,
        timeout: 10000,
        retries: 2,
        circuitBreakerThreshold: 3,
        authentication: {
          type: 'basic',
          credentials: {
            username: config.email.smtp.user,
            password: config.email.smtp.pass,
          },
        },
      });
    }
  }

  private registerExternalServices(
    externalServices: ExternalServicesConfig
  ): void {
    // Twilio SMS service
    if (externalServices.twilio?.accountSid) {
      this.registerService({
        name: 'twilio',
        url: 'https://api.twilio.com',
        healthCheckUrl: 'https://api.twilio.com/2010-04-01/Accounts.json',
        timeout: 15000,
        retries: 2,
        circuitBreakerThreshold: 3,
        authentication: {
          type: 'basic',
          credentials: {
            username: externalServices.twilio.accountSid,
            password: externalServices.twilio.authToken,
          },
        },
      });
    }

    // Google OAuth service
    if (externalServices.google?.clientId) {
      this.registerService({
        name: 'google_oauth',
        url: 'https://oauth2.googleapis.com',
        healthCheckUrl: 'https://oauth2.googleapis.com/tokeninfo',
        timeout: 10000,
        retries: 2,
        circuitBreakerThreshold: 3,
        authentication: {
          type: 'oauth2',
          credentials: {
            clientId: externalServices.google.clientId,
            clientSecret: externalServices.google.clientSecret,
          },
        },
      });

      // Google Calendar API
      this.registerService({
        name: 'google_calendar',
        url: 'https://www.googleapis.com/calendar/v3',
        timeout: 10000,
        retries: 2,
        circuitBreakerThreshold: 3,
        authentication: {
          type: 'oauth2',
          credentials: {
            clientId: externalServices.google.clientId,
            clientSecret: externalServices.google.clientSecret,
          },
        },
      });
    }

    // GitHub OAuth service
    if (externalServices.github?.clientId) {
      this.registerService({
        name: 'github_oauth',
        url: 'https://github.com/login/oauth',
        healthCheckUrl: 'https://api.github.com',
        timeout: 10000,
        retries: 2,
        circuitBreakerThreshold: 3,
        authentication: {
          type: 'oauth2',
          credentials: {
            clientId: externalServices.github.clientId,
            clientSecret: externalServices.github.clientSecret,
          },
        },
      });
    }

    // Webhook service
    if (externalServices.webhook?.secret) {
      this.registerService({
        name: 'webhook',
        url: 'internal://webhook-service',
        timeout: externalServices.webhook.timeout || 30000,
        retries: externalServices.webhook.retries || 3,
        circuitBreakerThreshold: 5,
        authentication: {
          type: 'api_key',
          credentials: {
            apiKey: externalServices.webhook.secret,
          },
        },
      });
    }
  }

  private registerInfrastructureServices(config: any): void {
    // Monitoring services
    if (config.monitoring.prometheus.enabled) {
      this.registerService({
        name: 'prometheus',
        url: `http://localhost:${config.monitoring.prometheus.port}`,
        healthCheckUrl: `http://localhost:${config.monitoring.prometheus.port}/-/healthy`,
        timeout: 5000,
        retries: 2,
        circuitBreakerThreshold: 3,
      });
    }

    // Storage services
    if (config.storage.type === 's3' && config.storage.s3?.bucket) {
      this.registerService({
        name: 's3',
        url: `https://s3.${config.storage.s3.region}.amazonaws.com`,
        timeout: 15000,
        retries: 3,
        circuitBreakerThreshold: 5,
        authentication: {
          type: 'api_key',
          credentials: {
            apiKey: config.storage.s3.accessKeyId,
          },
        },
      });
    }

    if (
      config.storage.type === 'azure' &&
      config.storage.azure?.containerName
    ) {
      this.registerService({
        name: 'azure_storage',
        url: 'https://core.windows.net',
        timeout: 15000,
        retries: 3,
        circuitBreakerThreshold: 5,
        authentication: {
          type: 'api_key',
          credentials: {
            apiKey: config.storage.azure.connectionString,
          },
        },
      });
    }
  }

  registerService(service: ServiceEndpoint): void {
    this.services.set(service.name, service);
    console.log(`Registered service: ${service.name} at ${service.url}`);
  }

  getService(name: string): ServiceEndpoint | undefined {
    return this.services.get(name);
  }

  getAllServices(): ServiceEndpoint[] {
    return Array.from(this.services.values());
  }

  removeService(name: string): void {
    this.services.delete(name);
    this.healthCache.delete(name);
    console.log(`Removed service: ${name}`);
  }

  async checkHealth(serviceName?: string): Promise<ServiceHealth[]> {
    const servicesToCheck = serviceName
      ? ([this.services.get(serviceName)].filter(Boolean) as ServiceEndpoint[])
      : this.getAllServices();

    const healthChecks = servicesToCheck.map(service =>
      this.checkServiceHealth(service)
    );
    return Promise.all(healthChecks);
  }

  private async checkServiceHealth(
    service: ServiceEndpoint
  ): Promise<ServiceHealth> {
    const cached = this.healthCache.get(service.name);
    if (
      cached &&
      Date.now() - cached.lastCheck.getTime() < this.HEALTH_CACHE_TTL
    ) {
      return cached;
    }

    const startTime = Date.now();
    let health: ServiceHealth = {
      name: service.name,
      status: 'unknown',
      lastCheck: new Date(),
      responseTime: 0,
    };

    try {
      if (service.url.startsWith('internal://')) {
        // Internal service health check
        health = await this.checkInternalServiceHealth(service);
      } else if (service.healthCheckUrl) {
        // External service with health check endpoint
        const response = await this.makeHealthCheckRequest(service);
        health = {
          name: service.name,
          status: response.ok ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          metadata: { statusCode: response.status },
        };
      } else {
        // Basic connectivity check
        health = await this.checkBasicConnectivity(service);
      }
    } catch (error) {
      health = {
        name: service.name,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    this.healthCache.set(service.name, health);
    return health;
  }

  private async checkInternalServiceHealth(
    service: ServiceEndpoint
  ): Promise<ServiceHealth> {
    // Check internal services (like webhook service)
    switch (service.name) {
      case 'webhook':
        return {
          name: service.name,
          status: 'healthy', // Assume healthy if configured
          lastCheck: new Date(),
          responseTime: 0,
          metadata: { type: 'internal' },
        };
      default:
        return {
          name: service.name,
          status: 'unknown',
          lastCheck: new Date(),
          responseTime: 0,
          error: 'Unknown internal service',
        };
    }
  }

  private async makeHealthCheckRequest(
    service: ServiceEndpoint
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      service.timeout || 10000
    );

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'UnifiedEnterprisePlatform/1.0',
        ...service.headers,
      };

      // Add authentication headers
      if (service.authentication) {
        this.addAuthenticationHeaders(headers, service.authentication);
      }

      const response = await fetch(service.healthCheckUrl!, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async checkBasicConnectivity(
    service: ServiceEndpoint
  ): Promise<ServiceHealth> {
    // For services without health check endpoints, try basic connectivity
    try {
      const url = new URL(service.url);
      const startTime = Date.now();

      // Simple TCP connectivity check (simplified)
      const response = await fetch(`${url.protocol}//${url.host}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(service.timeout || 5000),
      });

      return {
        name: service.name,
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { statusCode: response.status, type: 'basic_connectivity' },
      };
    } catch (error) {
      return {
        name: service.name,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: 0,
        error:
          error instanceof Error ? error.message : 'Connectivity check failed',
      };
    }
  }

  private addAuthenticationHeaders(
    headers: Record<string, string>,
    auth: ServiceAuthentication
  ): void {
    switch (auth.type) {
      case 'basic':
        if (auth.credentials?.username && auth.credentials?.password) {
          const credentials = Buffer.from(
            `${auth.credentials.username}:${auth.credentials.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'bearer':
        if (auth.credentials?.token) {
          headers['Authorization'] = `Bearer ${auth.credentials.token}`;
        }
        break;

      case 'api_key':
        if (auth.credentials?.apiKey) {
          headers['X-API-Key'] = auth.credentials.apiKey;
        }
        break;

      case 'oauth2':
        // OAuth2 would require token exchange, simplified here
        if (auth.credentials?.token) {
          headers['Authorization'] = `Bearer ${auth.credentials.token}`;
        }
        break;
    }
  }

  async isServiceHealthy(serviceName: string): Promise<boolean> {
    const health = await this.checkServiceHealth(
      this.services.get(serviceName)!
    );
    return health.status === 'healthy';
  }

  async getHealthyServices(): Promise<ServiceEndpoint[]> {
    const healthChecks = await this.checkHealth();
    const healthyServiceNames = healthChecks
      .filter(health => health.status === 'healthy')
      .map(health => health.name);

    return this.getAllServices().filter(service =>
      healthyServiceNames.includes(service.name)
    );
  }

  async refreshServices(): Promise<void> {
    // Clear caches
    this.healthCache.clear();
    this.services.clear();

    // Reinitialize services
    this.initializeServices();

    // Perform initial health checks
    await this.checkHealth();

    console.log('Service discovery refreshed');
  }

  private startHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  // Utility methods
  getServicesByType(type: string): ServiceEndpoint[] {
    return this.getAllServices().filter(
      service => service.name.includes(type) || service.url.includes(type)
    );
  }

  getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.healthCache.get(serviceName);
  }

  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.healthCache.values());
  }

  // Circuit breaker functionality
  private circuitBreakerStates: Map<
    string,
    { failures: number; lastFailure: Date; isOpen: boolean }
  > = new Map();

  isCircuitBreakerOpen(serviceName: string): boolean {
    const state = this.circuitBreakerStates.get(serviceName);
    if (!state) return false;

    const service = this.services.get(serviceName);
    if (!service) return false;

    const threshold = service.circuitBreakerThreshold || 5;
    const cooldownPeriod = 60000; // 1 minute

    if (state.failures >= threshold) {
      if (Date.now() - state.lastFailure.getTime() > cooldownPeriod) {
        // Reset circuit breaker after cooldown
        state.failures = 0;
        state.isOpen = false;
        return false;
      }
      return true;
    }

    return false;
  }

  recordServiceFailure(serviceName: string): void {
    const state = this.circuitBreakerStates.get(serviceName) || {
      failures: 0,
      lastFailure: new Date(),
      isOpen: false,
    };
    state.failures++;
    state.lastFailure = new Date();

    const service = this.services.get(serviceName);
    if (service && state.failures >= (service.circuitBreakerThreshold || 5)) {
      state.isOpen = true;
      console.warn(`Circuit breaker opened for service: ${serviceName}`);
    }

    this.circuitBreakerStates.set(serviceName, state);
  }

  recordServiceSuccess(serviceName: string): void {
    const state = this.circuitBreakerStates.get(serviceName);
    if (state) {
      state.failures = Math.max(0, state.failures - 1);
      if (state.failures === 0) {
        state.isOpen = false;
      }
      this.circuitBreakerStates.set(serviceName, state);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    this.services.clear();
    this.healthCache.clear();
    this.circuitBreakerStates.clear();
  }
}

// Singleton instance
let serviceDiscovery: EnterpriseServiceDiscovery;

export function getServiceDiscovery(): EnterpriseServiceDiscovery {
  if (!serviceDiscovery) {
    serviceDiscovery = new EnterpriseServiceDiscovery();
  }
  return serviceDiscovery;
}

export { EnterpriseServiceDiscovery };
export default getServiceDiscovery();
