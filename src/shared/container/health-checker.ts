import { Container } from './types';

/**
 * Health status for services
 */
export interface ServiceHealth {
  token: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  lastChecked: Date;
  dependencies: string[];
}

/**
 * Health checker for container services
 */
export class ContainerHealthChecker {
  constructor(private container: Container) {}

  /**
   * Check health of all registered services
   */
  async checkAllServices(): Promise<ServiceHealth[]> {
    const services = this.container.getRegisteredServices();
    const healthChecks = await Promise.allSettled(
      services.map(token => this.checkService(token))
    );

    return healthChecks.map((result, index) => {
      const token = services[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          token,
          status: 'unhealthy' as const,
          message: result.reason?.message || 'Unknown error',
          lastChecked: new Date(),
          dependencies: this.getServiceDependencies(token),
        };
      }
    });
  }

  /**
   * Check health of specific service
   */
  async checkService(token: string): Promise<ServiceHealth> {
    try {
      const descriptor = this.container.getDescriptor(token);
      if (!descriptor) {
        return {
          token,
          status: 'unhealthy',
          message: 'Service not registered',
          lastChecked: new Date(),
          dependencies: [],
        };
      }

      // Try to resolve the service
      const service = this.container.resolve(token);

      // Check if service has health check method
      if (service && typeof service.healthCheck === 'function') {
        const isHealthy = await service.healthCheck();
        return {
          token,
          status: isHealthy ? 'healthy' : 'unhealthy',
          message: isHealthy
            ? 'Service is healthy'
            : 'Service health check failed',
          lastChecked: new Date(),
          dependencies: descriptor.dependencies,
        };
      }

      return {
        token,
        status: 'healthy',
        message: 'Service resolved successfully',
        lastChecked: new Date(),
        dependencies: descriptor.dependencies,
      };
    } catch (error) {
      return {
        token,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
        dependencies: this.getServiceDependencies(token),
      };
    }
  }

  /**
   * Get overall health status
   */
  async getOverallHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealth[];
    summary: {
      total: number;
      healthy: number;
      unhealthy: number;
      unknown: number;
    };
  }> {
    const services = await this.checkAllServices();

    const summary = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      unknown: services.filter(s => s.status === 'unknown').length,
    };

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.unhealthy === 0) {
      status = 'healthy';
    } else if (summary.healthy > summary.unhealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services,
      summary,
    };
  }

  private getServiceDependencies(token: string): string[] {
    const descriptor = this.container.getDescriptor(token);
    return descriptor?.dependencies || [];
  }
}
