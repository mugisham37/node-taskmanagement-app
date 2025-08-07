import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { metricsService } from './metrics.service';
import { logSystem, logError } from '../../config/logger';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  timestamp: Date;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export interface IHealthCheck {
  name: string;
  check(): Promise<HealthCheckResult>;
}

export class DatabaseHealthCheck implements IHealthCheck {
  name = 'database';

  constructor(private readonly prisma: PrismaClient) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1 as test`;

      // Test connection pool status
      const connectionInfo = await this.getConnectionInfo();

      const responseTime = Date.now() - startTime;

      // Determine status based on response time and connection pool
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message = 'Database connection is healthy';

      if (responseTime > 5000) {
        status = 'unhealthy';
        message = 'Database response time is critically slow';
      } else if (responseTime > 1000) {
        status = 'degraded';
        message = 'Database response time is slow';
      }

      if (connectionInfo.utilization > 90) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        message += '. Connection pool utilization is high';
      }

      return {
        name: this.name,
        status,
        message,
        timestamp: new Date(),
        responseTime,
        metadata: {
          ...connectionInfo,
          queryTime: responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logError(error as Error, 'Database health check failed');

      return {
        name: this.name,
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
        timestamp: new Date(),
        responseTime,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  private async getConnectionInfo() {
    try {
      // This would need to be implemented based on your connection pool
      // For now, return mock data
      return {
        activeConnections: 5,
        idleConnections: 10,
        maxConnections: 20,
        utilization: 25,
      };
    } catch (error) {
      return {
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: 0,
        utilization: 0,
      };
    }
  }
}

export class RedisHealthCheck implements IHealthCheck {
  name = 'redis';

  constructor(private readonly redis: Redis) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Test basic connectivity with ping
      const pong = await this.redis.ping();

      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Test read/write operations
      const testKey = `health_check_${Date.now()}`;
      await this.redis.set(testKey, 'test', 'EX', 10);
      const testValue = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (testValue !== 'test') {
        throw new Error('Redis read/write test failed');
      }

      const responseTime = Date.now() - startTime;

      // Get Redis info
      const info = await this.getRedisInfo();

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message = 'Redis connection is healthy';

      if (responseTime > 1000) {
        status = 'degraded';
        message = 'Redis response time is slow';
      }

      if (info.memoryUsage > 90) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        message += '. Memory usage is high';
      }

      return {
        name: this.name,
        status,
        message,
        timestamp: new Date(),
        responseTime,
        metadata: {
          ...info,
          pingTime: responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logError(error as Error, 'Redis health check failed');

      return {
        name: this.name,
        status: 'unhealthy',
        message: `Redis connection failed: ${(error as Error).message}`,
        timestamp: new Date(),
        responseTime,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  private async getRedisInfo() {
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\r\n');
      const memoryInfo: Record<string, string> = {};

      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          memoryInfo[key] = value;
        }
      });

      const usedMemory = parseInt(memoryInfo.used_memory || '0');
      const maxMemory = parseInt(memoryInfo.maxmemory || '0');
      const memoryUsage = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

      return {
        usedMemory,
        maxMemory,
        memoryUsage,
        connectedClients: parseInt(memoryInfo.connected_clients || '0'),
      };
    } catch (error) {
      return {
        usedMemory: 0,
        maxMemory: 0,
        memoryUsage: 0,
        connectedClients: 0,
      };
    }
  }
}

export class SystemHealthCheck implements IHealthCheck {
  name = 'system';

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const os = require('os');

      // Get system metrics
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;
      const cpuUsage = Math.min(100, (loadAvg[0] / cpus.length) * 100);

      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message = 'System resources are healthy';

      if (cpuUsage > 90 || memoryUsage > 95) {
        status = 'unhealthy';
        message = 'System resources are critically high';
      } else if (cpuUsage > 70 || memoryUsage > 80) {
        status = 'degraded';
        message = 'System resources are elevated';
      }

      return {
        name: this.name,
        status,
        message,
        timestamp: new Date(),
        responseTime,
        metadata: {
          cpuUsage: Math.round(cpuUsage * 100) / 100,
          memoryUsage: Math.round(memoryUsage * 100) / 100,
          totalMemory: totalMem,
          freeMemory: freeMem,
          loadAverage: loadAvg,
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch(),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logError(error as Error, 'System health check failed');

      return {
        name: this.name,
        status: 'unhealthy',
        message: `System health check failed: ${(error as Error).message}`,
        timestamp: new Date(),
        responseTime,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }
}

export class ApplicationHealthCheck implements IHealthCheck {
  name = 'application';

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check application-specific metrics
      const processMemory = process.memoryUsage();
      const uptime = process.uptime();

      // Get recent error rate from metrics
      const errorRate = await this.getRecentErrorRate();

      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message = 'Application is healthy';

      if (errorRate > 10) {
        status = 'unhealthy';
        message = 'Application error rate is critically high';
      } else if (errorRate > 5) {
        status = 'degraded';
        message = 'Application error rate is elevated';
      }

      const heapUsedMB = processMemory.heapUsed / 1024 / 1024;
      if (heapUsedMB > 1000) {
        // 1GB
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        message += '. Memory usage is high';
      }

      return {
        name: this.name,
        status,
        message,
        timestamp: new Date(),
        responseTime,
        metadata: {
          uptime,
          errorRate,
          memory: {
            heapUsed: Math.round(heapUsedMB * 100) / 100,
            heapTotal:
              Math.round((processMemory.heapTotal / 1024 / 1024) * 100) / 100,
            external:
              Math.round((processMemory.external / 1024 / 1024) * 100) / 100,
            rss: Math.round((processMemory.rss / 1024 / 1024) * 100) / 100,
          },
          version: process.version,
          pid: process.pid,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logError(error as Error, 'Application health check failed');

      return {
        name: this.name,
        status: 'unhealthy',
        message: `Application health check failed: ${(error as Error).message}`,
        timestamp: new Date(),
        responseTime,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  private async getRecentErrorRate(): Promise<number> {
    try {
      // This would integrate with your metrics system
      // For now, return a mock value
      return 0;
    } catch (error) {
      return 0;
    }
  }
}

export class HealthMonitor extends EventEmitter {
  private readonly checks = new Map<string, IHealthCheck>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly checkHistory: HealthStatus[] = [];
  private readonly MAX_HISTORY = 100;

  constructor() {
    super();
  }

  registerCheck(check: IHealthCheck): void {
    this.checks.set(check.name, check);
    logSystem(`Health check registered: ${check.name}`);
  }

  unregisterCheck(name: string): void {
    this.checks.delete(name);
    logSystem(`Health check unregistered: ${name}`);
  }

  async runAllChecks(): Promise<HealthStatus> {
    const timestamp = new Date();
    const checkPromises = Array.from(this.checks.values()).map(check =>
      this.runSingleCheck(check)
    );

    const results = await Promise.all(checkPromises);

    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp,
      checks: results,
      summary,
    };

    // Store in history
    this.checkHistory.push(healthStatus);
    if (this.checkHistory.length > this.MAX_HISTORY) {
      this.checkHistory.shift();
    }

    // Record metrics
    metricsService.recordSystemEvent('health_check_completed', {
      status: overallStatus,
      healthy_count: summary.healthy.toString(),
      unhealthy_count: summary.unhealthy.toString(),
      degraded_count: summary.degraded.toString(),
    });

    // Emit event
    this.emit('health_check', healthStatus);

    // Log if unhealthy
    if (overallStatus !== 'healthy') {
      logSystem(`System health check: ${overallStatus}`, 'warn', {
        summary,
        unhealthyChecks: results
          .filter(r => r.status === 'unhealthy')
          .map(r => r.name),
        degradedChecks: results
          .filter(r => r.status === 'degraded')
          .map(r => r.name),
      });
    }

    return healthStatus;
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    return this.runSingleCheck(check);
  }

  private async runSingleCheck(
    check: IHealthCheck
  ): Promise<HealthCheckResult> {
    try {
      const result = await check.check();

      // Record metrics for individual check
      metricsService.recordSystemEvent('health_check_individual', {
        check_name: check.name,
        status: result.status,
        response_time: result.responseTime?.toString() || '0',
      });

      return result;
    } catch (error) {
      logError(error as Error, `Health check failed: ${check.name}`);

      return {
        name: check.name,
        status: 'unhealthy',
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date(),
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        logError(error as Error, 'Health monitoring cycle failed');
      }
    }, intervalMs);

    logSystem(`Health monitoring started with ${intervalMs}ms interval`);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logSystem('Health monitoring stopped');
    }
  }

  getHistory(limit?: number): HealthStatus[] {
    const history = [...this.checkHistory];
    return limit ? history.slice(-limit) : history;
  }

  getLatestStatus(): HealthStatus | null {
    return this.checkHistory.length > 0
      ? this.checkHistory[this.checkHistory.length - 1]
      : null;
  }

  isHealthy(): boolean {
    const latest = this.getLatestStatus();
    return latest ? latest.status === 'healthy' : false;
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();
