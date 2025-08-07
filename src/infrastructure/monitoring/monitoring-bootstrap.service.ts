import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { monitoringDashboard } from './monitoring-dashboard.service';
import {
  healthMonitor,
  DatabaseHealthCheck,
  RedisHealthCheck,
  SystemHealthCheck,
  ApplicationHealthCheck,
} from './health-check.service';
import { alertingService } from './alerting.service';
import { metricsService } from './metrics.service';
import { logSystem, logError } from '../../config/logger';

export class MonitoringBootstrapService {
  private isInitialized = false;

  async initialize(prisma: PrismaClient, redis?: Redis): Promise<void> {
    if (this.isInitialized) {
      logSystem('Monitoring system already initialized');
      return;
    }

    try {
      logSystem('Initializing monitoring system...');

      // Initialize health checks
      await this.initializeHealthChecks(prisma, redis);

      // Initialize monitoring dashboard
      await this.initializeMonitoringDashboard();

      // Initialize alerting system
      await this.initializeAlertingSystem();

      // Set up event listeners
      this.setupEventListeners();

      // Start monitoring
      await this.startMonitoring();

      this.isInitialized = true;
      logSystem('Monitoring system initialized successfully');
    } catch (error) {
      logError(error as Error, 'Failed to initialize monitoring system');
      throw error;
    }
  }

  private async initializeHealthChecks(
    prisma: PrismaClient,
    redis?: Redis
  ): Promise<void> {
    logSystem('Initializing health checks...');

    // Register database health check
    const dbHealthCheck = new DatabaseHealthCheck(prisma);
    healthMonitor.registerCheck(dbHealthCheck);

    // Register Redis health check if Redis is available
    if (redis) {
      const redisHealthCheck = new RedisHealthCheck(redis);
      healthMonitor.registerCheck(redisHealthCheck);
    }

    // Register system health check
    const systemHealthCheck = new SystemHealthCheck();
    healthMonitor.registerCheck(systemHealthCheck);

    // Register application health check
    const appHealthCheck = new ApplicationHealthCheck();
    healthMonitor.registerCheck(appHealthCheck);

    logSystem(`Registered ${healthMonitor['checks'].size} health checks`);
  }

  private async initializeMonitoringDashboard(): Promise<void> {
    logSystem('Initializing monitoring dashboard...');

    // The dashboard is already initialized with default alert rules
    // We can add any additional configuration here

    logSystem('Monitoring dashboard initialized');
  }

  private async initializeAlertingSystem(): Promise<void> {
    logSystem('Initializing alerting system...');

    // The alerting service is already initialized with default channels and runbooks
    // We can add any additional configuration here

    logSystem('Alerting system initialized');
  }

  private setupEventListeners(): void {
    logSystem('Setting up monitoring event listeners...');

    // Listen for health check events
    healthMonitor.on('health_check', healthStatus => {
      // Record health metrics
      metricsService.recordSystemEvent('health_check_completed', {
        status: healthStatus.status,
        healthy_count: healthStatus.summary.healthy.toString(),
        unhealthy_count: healthStatus.summary.unhealthy.toString(),
        degraded_count: healthStatus.summary.degraded.toString(),
      });
    });

    // Listen for alert events
    monitoringDashboard.on('alert', alert => {
      logSystem(`Alert triggered: ${alert.message}`, 'warn', {
        alertId: alert.id,
        severity: alert.severity,
        ruleId: alert.ruleId,
      });
    });

    // Listen for alert resolution events
    monitoringDashboard.on('alert_resolved', alert => {
      logSystem(`Alert resolved: ${alert.message}`, 'info', {
        alertId: alert.id,
        resolvedBy: alert.resolvedBy,
      });
    });

    // Listen for metrics events
    monitoringDashboard.on('metrics', metrics => {
      // Record system metrics in Prometheus
      metricsService.recordSystemMetrics(
        metrics.system.cpu,
        metrics.system.memory
      );

      // Record database connection metrics
      metricsService.recordDatabaseConnection(
        'active',
        metrics.database.connections
      );
    });

    logSystem('Event listeners configured');
  }

  private async startMonitoring(): Promise<void> {
    logSystem('Starting monitoring services...');

    // Start monitoring dashboard (this will also start health monitoring and system monitoring)
    await monitoringDashboard.startMonitoring(60000); // Every minute

    logSystem('Monitoring services started');
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logSystem('Shutting down monitoring system...');

      // Stop monitoring
      monitoringDashboard.stopMonitoring();

      // Cleanup alerting service
      alertingService.cleanup();

      // Clear metrics
      metricsService.clearMetrics();

      this.isInitialized = false;
      logSystem('Monitoring system shut down successfully');
    } catch (error) {
      logError(error as Error, 'Error during monitoring system shutdown');
    }
  }

  getStatus(): {
    initialized: boolean;
    healthChecks: number;
    activeAlerts: number;
    monitoringActive: boolean;
  } {
    return {
      initialized: this.isInitialized,
      healthChecks: healthMonitor['checks'].size,
      activeAlerts: monitoringDashboard.getActiveAlerts().length,
      monitoringActive: monitoringDashboard['monitoringInterval'] !== null,
    };
  }
}

// Export singleton instance
export const monitoringBootstrap = new MonitoringBootstrapService();
