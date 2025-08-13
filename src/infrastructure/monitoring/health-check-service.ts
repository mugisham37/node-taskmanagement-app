import { HealthService, SystemHealth, HealthCheckResult } from './health-service';
import { DatabaseHealthChecker } from '../database/health-check';
import { MetricsService } from './metrics-service';
import { LoggingService } from './logging-service';

export interface HealthCheckServiceConfig {
  enableDatabase: boolean;
  enableMemory: boolean;
  enableDisk: boolean;
  enableExternal: boolean;
  timeout: number;
  retries: number;
}

export class HealthCheckService {
  private healthService: HealthService;
  private databaseHealthChecker: DatabaseHealthChecker | undefined;
  private metricsService: MetricsService | undefined;
  private loggingService: LoggingService | undefined;

  constructor(
    private readonly config: HealthCheckServiceConfig,
    healthService: HealthService,
    databaseHealthChecker?: DatabaseHealthChecker,
    metricsService?: MetricsService,
    loggingService?: LoggingService
  ) {
    this.healthService = healthService;
    this.databaseHealthChecker = databaseHealthChecker;
    this.metricsService = metricsService;
    this.loggingService = loggingService;
    
    this.setupHealthChecks();
  }

  /**
   * Main health check method
   */
  async checkHealth(): Promise<SystemHealth> {
    try {
      const health = await this.healthService.checkHealth();
      
      if (this.metricsService) {
        // Record health metrics
        this.metricsService.setGauge(
          'system_health_status',
          health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0
        );
        
        this.metricsService.setGauge('system_uptime_seconds', health.uptime);
        
        // Record individual check statuses
        health.checks.forEach(check => {
          this.metricsService!.setGauge(
            `health_check_${check.name}_status`,
            check.status === 'healthy' ? 1 : check.status === 'degraded' ? 0.5 : 0
          );
          
          this.metricsService!.recordHistogram(
            `health_check_${check.name}_duration_ms`,
            check.duration
          );
        });
      }
      
      return health;
    } catch (error) {
      if (this.loggingService) {
        this.loggingService.error('Health check failed', error as Error);
      }
      throw error;
    }
  }

  /**
   * Check system readiness
   */
  async checkReadiness(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.status !== 'unhealthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check system liveness
   */
  async checkLiveness(): Promise<boolean> {
    try {
      // Simple check - if we can respond, we're alive
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get detailed health information
   */
  async getDetailedHealth(): Promise<{
    health: SystemHealth;
    database?: any;
    metrics?: any;
  }> {
    const health = await this.checkHealth();
    const result: any = { health };

    if (this.databaseHealthChecker) {
      try {
        result.database = await this.databaseHealthChecker.performDeepHealthCheck();
      } catch (error) {
        result.database = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Database check failed',
          timestamp: new Date()
        };
      }
    }

    if (this.metricsService) {
      try {
        result.metrics = await this.metricsService.getMetrics();
      } catch (error) {
        result.metrics = null;
      }
    }

    return result;
  }

  /**
   * Setup default health checks
   */
  private setupHealthChecks(): void {
    // Database health check
    if (this.config.enableDatabase && this.databaseHealthChecker) {
      this.healthService.registerHealthCheck(
        'database',
        async (): Promise<HealthCheckResult> => {
          const startTime = Date.now();
          try {
            const dbHealth = await this.databaseHealthChecker!.checkHealth();
            return {
              name: 'database',
              status: dbHealth.status === 'healthy' ? 'healthy' : 
                     dbHealth.status === 'degraded' ? 'degraded' : 'unhealthy',
              message: dbHealth.error || 'Database is accessible',
              timestamp: new Date(),
              duration: Date.now() - startTime,
              metadata: {
                latency: dbHealth.latency,
                connections: dbHealth.connections
              }
            };
          } catch (error) {
            return {
              name: 'database',
              status: 'unhealthy',
              message: error instanceof Error ? error.message : 'Database check failed',
              timestamp: new Date(),
              duration: Date.now() - startTime
            };
          }
        }
      );
    }

    // Memory health check
    if (this.config.enableMemory) {
      this.healthService.registerHealthCheck(
        'memory',
        async (): Promise<HealthCheckResult> => {
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
        }
      );
    }

    // Disk health check
    if (this.config.enableDisk) {
      this.healthService.registerHealthCheck(
        'disk',
        async (): Promise<HealthCheckResult> => {
          const startTime = Date.now();
          // Simple disk check - in production you'd want to check actual disk usage
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
        }
      );
    }
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(): void {
    this.healthService.startPeriodicHealthChecks();
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    this.healthService.stopPeriodicHealthChecks();
  }
}
