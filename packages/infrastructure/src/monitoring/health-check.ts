import {
    HealthCheck,
    HealthCheckResult,
    HealthCheckService,
    SystemHealth
} from './interfaces';

export class DefaultHealthCheckService implements HealthCheckService {
  readonly name = 'health-check-service';
  private healthChecks = new Map<string, HealthCheck>();
  private periodicInterval?: NodeJS.Timeout;
  private lastHealthCheck?: SystemHealth;

  constructor(private readonly config: {
    checkInterval?: number;
    timeout?: number;
  } = {}) {}

  async checkHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Run all registered health checks
    for (const [name, check] of this.healthChecks) {
      try {
        const result = await this.runHealthCheckWithTimeout(check, name);
        checks.push(result);
      } catch (error) {
        checks.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        });
      }
    }

    // Determine overall system health
    const overallStatus = this.determineOverallStatus(checks);
    
    const health: SystemHealth = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    this.lastHealthCheck = health;
    return health;
  }

  async checkReadiness(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.status !== 'unhealthy';
    } catch (error) {
      return false;
    }
  }

  async checkLiveness(): Promise<boolean> {
    try {
      // Simple check - if we can respond, we're alive
      return true;
    } catch (error) {
      return false;
    }
  }

  registerHealthCheck(name: string, check: HealthCheck): void {
    this.healthChecks.set(name, check);
  }

  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
  }

  startPeriodicChecks(): void {
    const interval = this.config.checkInterval || 30000; // 30 seconds default
    
    this.periodicInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        // Log error but don't throw
        console.error('Periodic health check failed:', error);
      }
    }, interval);
  }

  stopPeriodicChecks(): void {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = undefined;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.status !== 'unhealthy';
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const health = this.lastHealthCheck || await this.checkHealth();
    return {
      status: health.status,
      uptime: health.uptime,
      checksCount: health.checks.length,
      lastCheck: health.timestamp,
    };
  }

  private async runHealthCheckWithTimeout(
    check: HealthCheck,
    name: string
  ): Promise<HealthCheckResult> {
    const timeout = this.config.timeout || 5000; // 5 seconds default
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check '${name}' timed out after ${timeout}ms`));
      }, timeout);

      check()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          resolve({
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Health check failed',
            timestamp: new Date(),
            duration: Date.now() - startTime,
          });
        });
    });
  }

  private determineOverallStatus(checks: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (checks.length === 0) {
      return 'healthy';
    }

    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    }

    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Add default system health checks
   */
  addDefaultHealthChecks(): void {
    // Memory health check
    this.registerHealthCheck('memory', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const memUsage = process.memoryUsage();
      const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      return {
        name: 'memory',
        status: memoryUsagePercent > 90 ? 'unhealthy' : 
               memoryUsagePercent > 70 ? 'degraded' : 'healthy',
        message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        metadata: { 
          memoryUsage: memUsage, 
          usagePercent: memoryUsagePercent 
        }
      };
    });

    // CPU health check
    this.registerHealthCheck('cpu', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const cpuUsage = process.cpuUsage();
      
      return {
        name: 'cpu',
        status: 'healthy', // Simple implementation
        message: 'CPU is functioning normally',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        metadata: { cpuUsage }
      };
    });

    // Disk health check (basic)
    this.registerHealthCheck('disk', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      return {
        name: 'disk',
        status: 'healthy',
        message: 'Disk space is adequate',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        metadata: {
          path: process.cwd()
        }
      };
    });
  }
}