import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
  gracefulShutdownTimeout: number;
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  metadata: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    pid: number;
  };
}

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

export class HealthService {
  private healthChecks: Map<string, HealthCheckFunction> = new Map();
  private lastHealthCheck: SystemHealth | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: HealthCheckConfig,
    private readonly appVersion: string,
    private readonly environment: string
  ) {}

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, checkFn: HealthCheckFunction): void {
    if (this.healthChecks.has(name)) {
      throw new InfrastructureError(
        `Health check '${name}' already registered`
      );
    }

    this.healthChecks.set(name, checkFn);
  }

  /**
   * Unregister a health check
   */
  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    // Run all registered health checks
    for (const [name, checkFn] of this.healthChecks) {
      try {
        const result = await this.runHealthCheckWithTimeout(name, checkFn);
        checks.push(result);
      } catch (error) {
        checks.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        });
      }
    }

    // Determine overall system health
    const overallStatus = this.determineOverallStatus(checks);

    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: this.appVersion,
      environment: this.environment,
      checks,
      metadata: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid,
      },
    };

    this.lastHealthCheck = systemHealth;
    return systemHealth;
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): SystemHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Check if the system is healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status === 'healthy';
  }

  /**
   * Start periodic health checks
   */
  startPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('Periodic health check failed:', error);
      }
    }, this.config.interval);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Create a database health check
   */
  createDatabaseHealthCheck(
    name: string,
    checkFn: () => Promise<boolean>
  ): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      try {
        const isHealthy = await checkFn();
        const duration = Date.now() - startTime;

        return {
          name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          message: isHealthy
            ? 'Database connection successful'
            : 'Database connection failed',
          timestamp: new Date(),
          duration,
          metadata: {
            type: 'database',
            responseTime: duration,
          },
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          message:
            error instanceof Error ? error.message : 'Database check failed',
          timestamp: new Date(),
          duration: Date.now() - startTime,
          metadata: {
            type: 'database',
            error: error instanceof Error ? error.name : 'Unknown',
          },
        };
      }
    };
  }

  /**
   * Create a Redis health check
   */
  createRedisHealthCheck(
    name: string,
    checkFn: () => Promise<boolean>
  ): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      try {
        const isHealthy = await checkFn();
        const duration = Date.now() - startTime;

        return {
          name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          message: isHealthy
            ? 'Redis connection successful'
            : 'Redis connection failed',
          timestamp: new Date(),
          duration,
          metadata: {
            type: 'cache',
            responseTime: duration,
          },
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          message:
            error instanceof Error ? error.message : 'Redis check failed',
          timestamp: new Date(),
          duration: Date.now() - startTime,
          metadata: {
            type: 'cache',
            error: error instanceof Error ? error.name : 'Unknown',
          },
        };
      }
    };
  }

  /**
   * Create an external service health check
   */
  createExternalServiceHealthCheck(
    name: string,
    url: string,
    timeout: number = 5000
  ): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        const isHealthy = response.ok;
        return {
          name,
          status: isHealthy ? 'healthy' : 'degraded',
          message: `External service responded with status ${response.status}`,
          timestamp: new Date(),
          duration,
          metadata: {
            type: 'external_service',
            url,
            statusCode: response.status,
            responseTime: duration,
          },
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          message:
            error instanceof Error
              ? error.message
              : 'External service check failed',
          timestamp: new Date(),
          duration: Date.now() - startTime,
          metadata: {
            type: 'external_service',
            url,
            error: error instanceof Error ? error.name : 'Unknown',
          },
        };
      }
    };
  }

  /**
   * Create a memory usage health check
   */
  createMemoryHealthCheck(
    name: string,
    maxHeapUsedMB: number = 512
  ): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const duration = Date.now() - startTime;

      const isHealthy = heapUsedMB < maxHeapUsedMB;
      const status = isHealthy
        ? 'healthy'
        : heapUsedMB < maxHeapUsedMB * 1.2
          ? 'degraded'
          : 'unhealthy';

      return {
        name,
        status,
        message: `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${maxHeapUsedMB}MB`,
        timestamp: new Date(),
        duration,
        metadata: {
          type: 'memory',
          heapUsedMB: heapUsedMB.toFixed(2),
          heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
          maxHeapUsedMB,
          percentage: ((heapUsedMB / maxHeapUsedMB) * 100).toFixed(2),
        },
      };
    };
  }

  /**
   * Create a disk space health check
   */
  createDiskSpaceHealthCheck(
    name: string,
    path: string,
    minFreeSpaceGB: number = 1
  ): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      try {
        // This is a simplified check - in production, you'd use a proper disk space library
        const stats = await import('fs').then(fs => fs.promises.stat(path));
        const duration = Date.now() - startTime;

        return {
          name,
          status: 'healthy', // Simplified - always healthy for now
          message: 'Disk space check completed',
          timestamp: new Date(),
          duration,
          metadata: {
            type: 'disk_space',
            path,
            minFreeSpaceGB,
          },
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          message:
            error instanceof Error ? error.message : 'Disk space check failed',
          timestamp: new Date(),
          duration: Date.now() - startTime,
          metadata: {
            type: 'disk_space',
            path,
            error: error instanceof Error ? error.name : 'Unknown',
          },
        };
      }
    };
  }

  /**
   * Graceful shutdown with health check cleanup
   */
  async gracefulShutdown(): Promise<void> {
    console.log('Starting graceful shutdown...');

    // Stop periodic health checks
    this.stopPeriodicHealthChecks();

    // Wait for ongoing health checks to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Health service shutdown completed');
  }

  private async runHealthCheckWithTimeout(
    name: string,
    checkFn: HealthCheckFunction
  ): Promise<HealthCheckResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Health check '${name}' timed out after ${this.config.timeout}ms`
          )
        );
      }, this.config.timeout);

      checkFn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private determineOverallStatus(
    checks: HealthCheckResult[]
  ): 'healthy' | 'unhealthy' | 'degraded' {
    if (checks.length === 0) {
      return 'healthy';
    }

    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');

    if (hasUnhealthy) {
      return 'unhealthy';
    }

    if (hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }
}
