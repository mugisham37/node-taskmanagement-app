import { APIPerformanceMonitor } from './api-performance-monitor';
import { MetricsService } from './metrics-service';
import { HealthService } from './health-service';
import { LoggingService } from './logging-service';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: ServiceHealthStatus[];
  metrics: SystemMetrics;
  alerts: Alert[];
}

export interface ServiceHealthStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: Date;
  details?: any;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  application: {
    uptime: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'PERFORMANCE' | 'ERROR' | 'RESOURCE' | 'SECURITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: any;
}

export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsCollectionInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    responseTime: number;
    errorRate: number;
  };
  enableDistributedTracing: boolean;
  enableBusinessMetrics: boolean;
  retentionPeriod: number; // days
}

export class ComprehensiveMonitoring {
  private alerts: Alert[] = [];
  private healthChecks: Map<string, ServiceHealthStatus> = new Map();
  private systemMetrics: SystemMetrics | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly apiMonitor: APIPerformanceMonitor,
    private readonly metricsService: MetricsService,
    private readonly healthService: HealthService,
    private readonly loggingService: LoggingService,
    private readonly config: MonitoringConfig
  ) {
    this.startMonitoring();
  }

  /**
   * Start comprehensive monitoring
   */
  startMonitoring(): void {
    console.log('Starting comprehensive monitoring...');

    // Start periodic health checks
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
        await this.collectSystemMetrics();
        await this.checkAlertConditions();
      } catch (error) {
        console.error('Error during monitoring cycle:', error);
      }
    }, this.config.healthCheckInterval);

    // Start metrics collection
    setInterval(async () => {
      try {
        await this.collectBusinessMetrics();
      } catch (error) {
        console.error('Error collecting business metrics:', error);
      }
    }, this.config.metricsCollectionInterval);

    console.log('Comprehensive monitoring started successfully');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('Comprehensive monitoring stopped');
  }

  /**
   * Perform health checks on all services
   */
  async performHealthChecks(): Promise<void> {
    const services = [
      'database',
      'redis',
      'email-service',
      'websocket-service',
      'external-apis',
    ];

    for (const serviceName of services) {
      try {
        const startTime = Date.now();
        const isHealthy = await this.checkServiceHealth(serviceName);
        const responseTime = Date.now() - startTime;

        const status: ServiceHealthStatus = {
          name: serviceName,
          status: isHealthy ? 'up' : 'down',
          responseTime,
          lastCheck: new Date(),
          details: await this.getServiceDetails(serviceName),
        };

        this.healthChecks.set(serviceName, status);

        // Create alert if service is down
        if (!isHealthy) {
          this.createAlert({
            type: 'ERROR',
            severity: 'HIGH',
            message: `Service ${serviceName} is down`,
            source: serviceName,
            metadata: { responseTime, lastCheck: status.lastCheck },
          });
        }
      } catch (error) {
        console.error(`Health check failed for ${serviceName}:`, error);

        this.healthChecks.set(serviceName, {
          name: serviceName,
          status: 'down',
          lastCheck: new Date(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAverage = require('os').loadavg();

      // Get application metrics from API monitor
      const appMetrics = this.apiMonitor.getSystemMetrics();

      this.systemMetrics = {
        cpu: {
          usage: this.calculateCPUUsage(cpuUsage),
          loadAverage,
        },
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        },
        disk: {
          used: 0, // Would be implemented with actual disk usage check
          total: 0,
          percentage: 0,
        },
        network: {
          bytesIn: 0, // Would be implemented with actual network monitoring
          bytesOut: 0,
        },
        application: {
          uptime: process.uptime(),
          requestsPerSecond: appMetrics.throughput,
          averageResponseTime: appMetrics.averageResponseTime,
          errorRate: appMetrics.errorRate,
        },
      };

      // Record metrics
      await this.metricsService.recordMetric(
        'system.cpu.usage',
        this.systemMetrics.cpu.usage
      );
      await this.metricsService.recordMetric(
        'system.memory.percentage',
        this.systemMetrics.memory.percentage
      );
      await this.metricsService.recordMetric(
        'application.response_time',
        this.systemMetrics.application.averageResponseTime
      );
      await this.metricsService.recordMetric(
        'application.error_rate',
        this.systemMetrics.application.errorRate
      );
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Check alert conditions
   */
  async checkAlertConditions(): Promise<void> {
    if (!this.systemMetrics) return;

    const thresholds = this.config.alertThresholds;

    // Check CPU usage
    if (this.systemMetrics.cpu.usage > thresholds.cpuUsage) {
      this.createAlert({
        type: 'RESOURCE',
        severity:
          this.systemMetrics.cpu.usage > thresholds.cpuUsage * 1.5
            ? 'CRITICAL'
            : 'HIGH',
        message: `High CPU usage: ${this.systemMetrics.cpu.usage.toFixed(2)}%`,
        source: 'system',
        metadata: { cpuUsage: this.systemMetrics.cpu.usage },
      });
    }

    // Check memory usage
    if (this.systemMetrics.memory.percentage > thresholds.memoryUsage) {
      this.createAlert({
        type: 'RESOURCE',
        severity:
          this.systemMetrics.memory.percentage > thresholds.memoryUsage * 1.5
            ? 'CRITICAL'
            : 'HIGH',
        message: `High memory usage: ${this.systemMetrics.memory.percentage.toFixed(2)}%`,
        source: 'system',
        metadata: { memoryUsage: this.systemMetrics.memory.percentage },
      });
    }

    // Check response time
    if (
      this.systemMetrics.application.averageResponseTime >
      thresholds.responseTime
    ) {
      this.createAlert({
        type: 'PERFORMANCE',
        severity: 'MEDIUM',
        message: `High average response time: ${this.systemMetrics.application.averageResponseTime.toFixed(2)}ms`,
        source: 'application',
        metadata: {
          responseTime: this.systemMetrics.application.averageResponseTime,
        },
      });
    }

    // Check error rate
    if (this.systemMetrics.application.errorRate > thresholds.errorRate) {
      this.createAlert({
        type: 'ERROR',
        severity:
          this.systemMetrics.application.errorRate > thresholds.errorRate * 2
            ? 'CRITICAL'
            : 'HIGH',
        message: `High error rate: ${(this.systemMetrics.application.errorRate * 100).toFixed(2)}%`,
        source: 'application',
        metadata: { errorRate: this.systemMetrics.application.errorRate },
      });
    }
  }

  /**
   * Collect business metrics
   */
  async collectBusinessMetrics(): Promise<void> {
    if (!this.config.enableBusinessMetrics) return;

    try {
      // These would be implemented with actual database queries
      const businessMetrics = {
        activeUsers: await this.getActiveUsersCount(),
        tasksCreated: await this.getTasksCreatedToday(),
        tasksCompleted: await this.getTasksCompletedToday(),
        projectsCreated: await this.getProjectsCreatedToday(),
        userRegistrations: await this.getUserRegistrationsToday(),
      };

      // Record business metrics
      for (const [metric, value] of Object.entries(businessMetrics)) {
        await this.metricsService.recordMetric(`business.${metric}`, value);
      }
    } catch (error) {
      console.error('Failed to collect business metrics:', error);
    }
  }

  /**
   * Create a new alert
   */
  createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Log alert
    this.loggingService.warn(`ALERT [${alert.severity}]: ${alert.message}`, {
      alertId: alert.id,
      type: alert.type,
      source: alert.source,
      metadata: alert.metadata,
    });

    // Keep alerts array manageable
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      this.loggingService.info(`Alert resolved: ${alert.message}`, {
        alertId: alert.id,
        resolvedAt: alert.resolvedAt,
      });

      return true;
    }
    return false;
  }

  /**
   * Get current system health status
   */
  getSystemHealthStatus(): SystemHealthStatus {
    const services = Array.from(this.healthChecks.values());
    const activeAlerts = this.alerts.filter(a => !a.resolved);

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Determine overall status
    const downServices = services.filter(s => s.status === 'down');
    const degradedServices = services.filter(s => s.status === 'degraded');
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL');

    if (downServices.length > 0 || criticalAlerts.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0 || activeAlerts.length > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      services,
      metrics: this.systemMetrics || this.getDefaultMetrics(),
      alerts: activeAlerts,
    };
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData(): {
    healthStatus: SystemHealthStatus;
    performanceReport: any;
    recentAlerts: Alert[];
    systemTrends: any;
  } {
    return {
      healthStatus: this.getSystemHealthStatus(),
      performanceReport: this.apiMonitor.generatePerformanceReport(),
      recentAlerts: this.alerts
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20),
      systemTrends: this.getSystemTrends(),
    };
  }

  /**
   * Export monitoring data for external systems
   */
  exportMonitoringData(): {
    timestamp: Date;
    healthStatus: SystemHealthStatus;
    metrics: SystemMetrics | null;
    alerts: Alert[];
    performance: any;
  } {
    return {
      timestamp: new Date(),
      healthStatus: this.getSystemHealthStatus(),
      metrics: this.systemMetrics,
      alerts: this.alerts.filter(a => !a.resolved),
      performance: this.apiMonitor.generatePerformanceReport(),
    };
  }

  private async checkServiceHealth(serviceName: string): Promise<boolean> {
    // Mock implementation - would check actual service health
    switch (serviceName) {
      case 'database':
        return await this.healthService.checkDatabase();
      case 'redis':
        return await this.healthService.checkRedis();
      case 'email-service':
        return true; // Mock
      case 'websocket-service':
        return true; // Mock
      case 'external-apis':
        return true; // Mock
      default:
        return false;
    }
  }

  private async getServiceDetails(serviceName: string): Promise<any> {
    // Mock implementation - would return actual service details
    return {
      version: '1.0.0',
      lastRestart: new Date(),
      connections: Math.floor(Math.random() * 100),
    };
  }

  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Mock implementation - would calculate actual CPU usage
    return Math.random() * 100;
  }

  private async getActiveUsersCount(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 1000);
  }

  private async getTasksCreatedToday(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 100);
  }

  private async getTasksCompletedToday(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 80);
  }

  private async getProjectsCreatedToday(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 10);
  }

  private async getUserRegistrationsToday(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 20);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultMetrics(): SystemMetrics {
    return {
      cpu: { usage: 0, loadAverage: [0, 0, 0] },
      memory: { used: 0, total: 0, percentage: 0 },
      disk: { used: 0, total: 0, percentage: 0 },
      network: { bytesIn: 0, bytesOut: 0 },
      application: {
        uptime: 0,
        requestsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 0,
      },
    };
  }

  private getSystemTrends(): any {
    // Mock implementation - would return actual trend data
    return {
      cpuTrend: 'stable',
      memoryTrend: 'increasing',
      responseTrend: 'improving',
      errorTrend: 'stable',
    };
  }
}

export function createComprehensiveMonitoring(
  apiMonitor: APIPerformanceMonitor,
  metricsService: MetricsService,
  healthService: HealthService,
  loggingService: LoggingService,
  config: MonitoringConfig
): ComprehensiveMonitoring {
  return new ComprehensiveMonitoring(
    apiMonitor,
    metricsService,
    healthService,
    loggingService,
    config
  );
}
