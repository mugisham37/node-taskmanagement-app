import { Logger } from 'winston';

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  timeout: number;
  interval?: number;
  critical: boolean;
  tags: string[];
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthCheckResult>;
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
}

export class HealthCheckRegistry {
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private logger?: Logger;
  private startTime: Date;

  constructor(
    private config: {
      version: string;
      environment: string;
      defaultTimeout: number;
    },
    logger?: Logger
  ) {
    this.logger = logger;
    this.startTime = new Date();
  }

  // Register health checks
  register(check: HealthCheck): void {
    this.checks.set(check.name, check);
    
    // Set up periodic checking if interval is specified
    if (check.interval && check.interval > 0) {
      const interval = setInterval(async () => {
        await this.runSingleCheck(check.name);
      }, check.interval);
      
      this.intervals.set(check.name, interval);
    }

    this.logger?.info('Health check registered', {
      name: check.name,
      critical: check.critical,
      timeout: check.timeout,
      interval: check.interval,
      tags: check.tags,
    });
  }

  // Unregister health checks
  unregister(name: string): void {
    this.checks.delete(name);
    this.results.delete(name);
    
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }

    this.logger?.info('Health check unregistered', { name });
  }

  // Run a single health check
  async runSingleCheck(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Run check with timeout
      const checkPromise = check.check();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const checkResult = await Promise.race([checkPromise, timeoutPromise]);
      
      result = {
        ...checkResult,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      result = {
        status: 'fail',
        duration: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.stack : 'Unknown error',
        },
      };
    }

    // Store result
    this.results.set(name, result);

    // Log result
    const logLevel = result.status === 'fail' ? 'error' : 
                     result.status === 'warn' ? 'warn' : 'debug';
    
    this.logger?.[logLevel]('Health check completed', {
      name,
      status: result.status,
      duration: result.duration,
      message: result.message,
      critical: check.critical,
    });

    return result;
  }

  // Run all health checks
  async runAllChecks(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    const checkPromises: Promise<void>[] = [];

    for (const [name] of this.checks) {
      checkPromises.push(
        this.runSingleCheck(name)
          .then(result => {
            results[name] = result;
          })
          .catch(error => {
            results[name] = {
              status: 'fail',
              duration: 0,
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            };
          })
      );
    }

    await Promise.all(checkPromises);
    return results;
  }

  // Get system health status
  async getSystemHealth(): Promise<SystemHealth> {
    const checks = await this.runAllChecks();
    
    // Determine overall status
    const criticalChecks = Array.from(this.checks.values()).filter(check => check.critical);
    const criticalResults = criticalChecks.map(check => checks[check.name]).filter(Boolean);
    
    const failedCritical = criticalResults.filter(result => result.status === 'fail');
    const warnCritical = criticalResults.filter(result => result.status === 'warn');
    const failedAny = Object.values(checks).filter(result => result.status === 'fail');
    const warnAny = Object.values(checks).filter(result => result.status === 'warn');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (failedCritical.length > 0) {
      status = 'unhealthy';
    } else if (failedAny.length > 0 || warnCritical.length > 0) {
      status = 'degraded';
    } else if (warnAny.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      checks,
      timestamp: new Date(),
      uptime: (Date.now() - this.startTime.getTime()) / 1000,
      version: this.config.version,
      environment: this.config.environment,
    };
  }

  // Get cached results
  getCachedResults(): Record<string, HealthCheckResult> {
    const results: Record<string, HealthCheckResult> = {};
    for (const [name, result] of this.results) {
      results[name] = result;
    }
    return results;
  }

  // Get specific check result
  getCheckResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  // List all registered checks
  listChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  // Filter checks by tags
  getChecksByTags(tags: string[]): HealthCheck[] {
    return Array.from(this.checks.values()).filter(check =>
      tags.some(tag => check.tags.includes(tag))
    );
  }

  // Get checks by criticality
  getCriticalChecks(): HealthCheck[] {
    return Array.from(this.checks.values()).filter(check => check.critical);
  }

  getNonCriticalChecks(): HealthCheck[] {
    return Array.from(this.checks.values()).filter(check => !check.critical);
  }

  // Health check statistics
  getStatistics(): {
    totalChecks: number;
    criticalChecks: number;
    passingChecks: number;
    failingChecks: number;
    warningChecks: number;
    averageDuration: number;
  } {
    const results = Array.from(this.results.values());
    const totalChecks = this.checks.size;
    const criticalChecks = this.getCriticalChecks().length;
    const passingChecks = results.filter(r => r.status === 'pass').length;
    const failingChecks = results.filter(r => r.status === 'fail').length;
    const warningChecks = results.filter(r => r.status === 'warn').length;
    const averageDuration = results.length > 0 
      ? results.reduce((sum, r) => sum + r.duration, 0) / results.length 
      : 0;

    return {
      totalChecks,
      criticalChecks,
      passingChecks,
      failingChecks,
      warningChecks,
      averageDuration,
    };
  }

  // Cleanup
  destroy(): void {
    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    
    this.intervals.clear();
    this.checks.clear();
    this.results.clear();

    this.logger?.info('Health check registry destroyed');
  }
}

// Predefined health check factories
export class HealthCheckFactory {
  static createDatabaseCheck(
    name: string,
    checkFn: () => Promise<boolean>,
    options: Partial<HealthCheck> = {}
  ): HealthCheck {
    return {
      name,
      check: async () => {
        const startTime = Date.now();
        try {
          const isHealthy = await checkFn();
          return {
            status: isHealthy ? 'pass' : 'fail',
            duration: Date.now() - startTime,
            message: isHealthy ? 'Database connection healthy' : 'Database connection failed',
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            status: 'fail',
            duration: Date.now() - startTime,
            message: error instanceof Error ? error.message : 'Database check failed',
            timestamp: new Date(),
            details: { error: error instanceof Error ? error.stack : 'Unknown error' },
          };
        }
      },
      timeout: 5000,
      critical: true,
      tags: ['database', 'infrastructure'],
      ...options,
    };
  }

  static createCacheCheck(
    name: string,
    checkFn: () => Promise<boolean>,
    options: Partial<HealthCheck> = {}
  ): HealthCheck {
    return {
      name,
      check: async () => {
        const startTime = Date.now();
        try {
          const isHealthy = await checkFn();
          return {
            status: isHealthy ? 'pass' : 'warn', // Cache is not critical
            duration: Date.now() - startTime,
            message: isHealthy ? 'Cache connection healthy' : 'Cache connection degraded',
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            status: 'warn',
            duration: Date.now() - startTime,
            message: error instanceof Error ? error.message : 'Cache check failed',
            timestamp: new Date(),
            details: { error: error instanceof Error ? error.stack : 'Unknown error' },
          };
        }
      },
      timeout: 3000,
      critical: false,
      tags: ['cache', 'infrastructure'],
      ...options,
    };
  }

  static createMemoryCheck(
    name: string,
    thresholds: { warning: number; critical: number } = { warning: 0.8, critical: 0.9 },
    options: Partial<HealthCheck> = {}
  ): HealthCheck {
    return {
      name,
      check: async () => {
        const memUsage = process.memoryUsage();
        const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal;
        
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = 'Memory usage normal';

        if (heapUsedPercent > thresholds.critical) {
          status = 'fail';
          message = 'Memory usage critical';
        } else if (heapUsedPercent > thresholds.warning) {
          status = 'warn';
          message = 'Memory usage high';
        }

        return {
          status,
          duration: 1,
          message,
          timestamp: new Date(),
          details: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            heapUsedPercent: Math.round(heapUsedPercent * 100),
            rss: memUsage.rss,
            external: memUsage.external,
          },
        };
      },
      timeout: 1000,
      critical: true,
      tags: ['memory', 'system'],
      ...options,
    };
  }

  static createExternalServiceCheck(
    name: string,
    url: string,
    options: Partial<HealthCheck> = {}
  ): HealthCheck {
    return {
      name,
      check: async () => {
        const startTime = Date.now();
        try {
          // This would use your HTTP client to check the service
          // For now, we'll simulate the check
          const response = await fetch(url, { 
            method: 'GET',
            timeout: 5000,
          });
          
          const isHealthy = response.ok;
          return {
            status: isHealthy ? 'pass' : 'fail',
            duration: Date.now() - startTime,
            message: isHealthy ? 'External service healthy' : `External service returned ${response.status}`,
            timestamp: new Date(),
            details: {
              url,
              statusCode: response.status,
              statusText: response.statusText,
            },
          };
        } catch (error) {
          return {
            status: 'fail',
            duration: Date.now() - startTime,
            message: error instanceof Error ? error.message : 'External service check failed',
            timestamp: new Date(),
            details: { 
              url,
              error: error instanceof Error ? error.stack : 'Unknown error',
            },
          };
        }
      },
      timeout: 10000,
      critical: false,
      tags: ['external', 'service'],
      ...options,
    };
  }
}

export default HealthCheckRegistry;