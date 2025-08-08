/**
 * Comprehensive Observability Dashboard
 * Centralized monitoring, metrics, and observability system
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger';
import { metricsService } from './metrics.service';
import { healthMonitor } from './health-check.service';
import { performanceMonitor } from './performance-monitor';
import { alertingService } from './alerting.service';
import { getSecurityMonitor } from '../security/security-monitor';

export interface DashboardMetrics {
  timestamp: Date;
  system: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkActivity: {
      bytesIn: number;
      bytesOut: number;
    };
  };
  application: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeUsers: number;
    activeConnections: number;
  };
  database: {
    connectionCount: number;
    poolUtilization: number;
    averageQueryTime: number;
    slowQueries: number;
    cacheHitRatio: number;
  };
  security: {
    authenticationEvents: number;
    securityThreats: number;
    complianceScore: number;
    criticalAlerts: number;
  };
  business: {
    totalUsers: number;
    activeWorkspaces: number;
    tasksCreated: number;
    documentsProcessed: number;
    apiCallsToday: number;
  };
}

export interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  active: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: 'healthy' | 'degraded' | 'unhealthy';
    cache: 'healthy' | 'degraded' | 'unhealthy';
    security: 'healthy' | 'degraded' | 'unhealthy';
    performance: 'healthy' | 'degraded' | 'unhealthy';
    external_services: 'healthy' | 'degraded' | 'unhealthy';
  };
  lastChecked: Date;
}

export interface ObservabilityConfig {
  dashboard: {
    enabled: boolean;
    refreshInterval: number;
    retentionDays: number;
    maxDataPoints: number;
  };
  alerts: {
    enabled: boolean;
    emailNotifications: boolean;
    slackNotifications: boolean;
    webhookNotifications: boolean;
  };
  metrics: {
    collectSystemMetrics: boolean;
    collectApplicationMetrics: boolean;
    collectBusinessMetrics: boolean;
    collectSecurityMetrics: boolean;
  };
  performance: {
    enableProfiling: boolean;
    enableTracing: boolean;
    sampleRate: number;
  };
}

export class ObservabilityDashboard extends EventEmitter {
  private readonly config: ObservabilityConfig;
  private readonly dashboardMetrics: DashboardMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly MAX_METRICS = 10000;
  private isRunning = false;

  constructor(config: Partial<ObservabilityConfig> = {}) {
    super();

    this.config = {
      dashboard: {
        enabled: true,
        refreshInterval: 30000, // 30 seconds
        retentionDays: 7,
        maxDataPoints: 10000,
        ...config.dashboard,
      },
      alerts: {
        enabled: true,
        emailNotifications: true,
        slackNotifications: false,
        webhookNotifications: false,
        ...config.alerts,
      },
      metrics: {
        collectSystemMetrics: true,
        collectApplicationMetrics: true,
        collectBusinessMetrics: true,
        collectSecurityMetrics: true,
        ...config.metrics,
      },
      performance: {
        enableProfiling: false,
        enableTracing: false,
        sampleRate: 0.1,
        ...config.performance,
      },
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on('metricsCollected', (metrics: DashboardMetrics) => {
      this.processMetrics(metrics);
    });

    this.on('healthStatusChanged', (health: SystemHealth) => {
      this.processHealthStatus(health);
    });

    this.on('alertTriggered', (alert: any) => {
      this.processAlert(alert);
    });
  }

  /**
   * Start the observability dashboard
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Observability dashboard is already running');
      return;
    }

    if (!this.config.dashboard.enabled) {
      logger.info('Observability dashboard is disabled');
      return;
    }

    this.isRunning = true;
    logger.info('Starting observability dashboard', {
      refreshInterval: this.config.dashboard.refreshInterval,
      retentionDays: this.config.dashboard.retentionDays,
    });

    // Start metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectDashboardMetrics();
    }, this.config.dashboard.refreshInterval);

    // Start health monitoring
    this.healthCheckInterval = setInterval(
      () => {
        this.checkSystemHealth();
      },
      Math.min(this.config.dashboard.refreshInterval, 60000)
    ); // At least every minute

    // Start underlying monitoring services
    this.startMonitoringServices();

    // Initial data collection
    this.collectDashboardMetrics();
    this.checkSystemHealth();
  }

  /**
   * Stop the observability dashboard
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping observability dashboard');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Stop underlying monitoring services
    this.stopMonitoringServices();
  }

  /**
   * Start underlying monitoring services
   */
  private startMonitoringServices(): void {
    // Start performance monitoring
    performanceMonitor.startMonitoring(this.config.dashboard.refreshInterval);

    // Start health monitoring
    healthMonitor.startMonitoring(this.config.dashboard.refreshInterval);

    // Start security monitoring
    const securityMonitor = getSecurityMonitor();
    securityMonitor.startMonitoring();

    logger.info('All monitoring services started');
  }

  /**
   * Stop underlying monitoring services
   */
  private stopMonitoringServices(): void {
    // Stop performance monitoring
    performanceMonitor.stopMonitoring();

    // Stop health monitoring
    healthMonitor.stopMonitoring();

    // Stop security monitoring
    const securityMonitor = getSecurityMonitor();
    securityMonitor.stopMonitoring();

    logger.info('All monitoring services stopped');
  }

  /**
   * Collect comprehensive dashboard metrics
   */
  private async collectDashboardMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();

      // Collect application metrics
      const applicationMetrics = await this.collectApplicationMetrics();

      // Collect database metrics
      const databaseMetrics = await this.collectDatabaseMetrics();

      // Collect security metrics
      const securityMetrics = await this.collectSecurityMetrics();

      // Collect business metrics
      const businessMetrics = await this.collectBusinessMetrics();

      const dashboardMetrics: DashboardMetrics = {
        timestamp,
        system: systemMetrics,
        application: applicationMetrics,
        database: databaseMetrics,
        security: securityMetrics,
        business: businessMetrics,
      };

      // Store metrics
      this.dashboardMetrics.push(dashboardMetrics);
      if (this.dashboardMetrics.length > this.MAX_METRICS) {
        this.dashboardMetrics.shift();
      }

      // Emit metrics collected event
      this.emit('metricsCollected', dashboardMetrics);

      logger.debug('Dashboard metrics collected', {
        timestamp,
        systemCpu: systemMetrics.cpuUsage,
        systemMemory: systemMetrics.memoryUsage,
        appResponseTime: applicationMetrics.averageResponseTime,
        dbConnections: databaseMetrics.connectionCount,
      });
    } catch (error) {
      logger.error('Failed to collect dashboard metrics', { error });
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<DashboardMetrics['system']> {
    const performanceMetrics = performanceMonitor.getCurrentMetrics();

    if (performanceMetrics) {
      return {
        uptime: process.uptime(),
        cpuUsage: performanceMetrics.cpu.usage,
        memoryUsage: performanceMetrics.memory.utilization,
        diskUsage: performanceMetrics.disk.utilization,
        networkActivity: {
          bytesIn: performanceMetrics.network.bytesIn,
          bytesOut: performanceMetrics.network.bytesOut,
        },
      };
    }

    // Fallback to basic metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();

    return {
      uptime: process.uptime(),
      cpuUsage: 0, // Would need to calculate
      memoryUsage: ((totalMemory - freeMemory) / totalMemory) * 100,
      diskUsage: 0, // Would need to calculate
      networkActivity: {
        bytesIn: 0,
        bytesOut: 0,
      },
    };
  }

  /**
   * Collect application metrics
   */
  private async collectApplicationMetrics(): Promise<
    DashboardMetrics['application']
  > {
    const performanceMetrics = performanceMonitor.getCurrentMetrics();

    return {
      requestsPerSecond: performanceMetrics?.api.requestsPerSecond || 0,
      averageResponseTime: performanceMetrics?.api.averageResponseTime || 0,
      errorRate: performanceMetrics?.api.errorRate || 0,
      activeUsers: 0, // Would need to track active sessions
      activeConnections: performanceMetrics?.api.activeConnections || 0,
    };
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<
    DashboardMetrics['database']
  > {
    const performanceMetrics = performanceMonitor.getCurrentMetrics();

    return {
      connectionCount: performanceMetrics?.database.connectionCount || 0,
      poolUtilization: performanceMetrics?.database.poolUtilization || 0,
      averageQueryTime: performanceMetrics?.database.averageQueryTime || 0,
      slowQueries: performanceMetrics?.database.slowQueries || 0,
      cacheHitRatio: performanceMetrics?.database.cacheHitRatio || 0,
    };
  }

  /**
   * Collect security metrics
   */
  private async collectSecurityMetrics(): Promise<
    DashboardMetrics['security']
  > {
    if (!this.config.metrics.collectSecurityMetrics) {
      return {
        authenticationEvents: 0,
        securityThreats: 0,
        complianceScore: 100,
        criticalAlerts: 0,
      };
    }

    const securityMonitor = getSecurityMonitor();
    const securityMetrics = securityMonitor.getLatestMetrics();
    const activeThreats = securityMonitor.getThreats({ status: 'active' });
    const criticalThreats = activeThreats.filter(
      t => t.severity === 'critical'
    );

    return {
      authenticationEvents:
        securityMetrics?.authenticationEvents.successful || 0,
      securityThreats: activeThreats.length,
      complianceScore: securityMetrics?.systemSecurity.complianceScore || 100,
      criticalAlerts: criticalThreats.length,
    };
  }

  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics(): Promise<
    DashboardMetrics['business']
  > {
    if (!this.config.metrics.collectBusinessMetrics) {
      return {
        totalUsers: 0,
        activeWorkspaces: 0,
        tasksCreated: 0,
        documentsProcessed: 0,
        apiCallsToday: 0,
      };
    }

    // These would typically come from your business logic services
    // For now, return mock data
    return {
      totalUsers: 0, // Would query user count from database
      activeWorkspaces: 0, // Would query active workspace count
      tasksCreated: 0, // Would query tasks created today
      documentsProcessed: 0, // Would query documents processed today
      apiCallsToday: 0, // Would query API call count for today
    };
  }

  /**
   * Check overall system health
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const healthStatus = await healthMonitor.runAllChecks();
      const performanceMetrics = performanceMonitor.getCurrentMetrics();
      const securityMonitor = getSecurityMonitor();
      const securityThreats = securityMonitor.getThreats({
        status: 'active',
        severity: 'critical',
      });

      const systemHealth: SystemHealth = {
        overall: healthStatus.status,
        components: {
          database: this.getComponentHealth(healthStatus.checks, 'database'),
          cache: this.getComponentHealth(healthStatus.checks, 'redis'),
          security: securityThreats.length > 0 ? 'degraded' : 'healthy',
          performance: this.getPerformanceHealth(performanceMetrics),
          external_services: this.getComponentHealth(
            healthStatus.checks,
            'external'
          ),
        },
        lastChecked: new Date(),
      };

      // Emit health status event
      this.emit('healthStatusChanged', systemHealth);

      // Record health metrics
      metricsService.recordTechnicalMetric({
        name: 'system_health_score',
        value: this.calculateHealthScore(systemHealth),
        labels: { component: 'overall' },
      });

      logger.debug('System health checked', {
        overall: systemHealth.overall,
        components: systemHealth.components,
      });
    } catch (error) {
      logger.error('Failed to check system health', { error });
    }
  }

  /**
   * Get component health from health check results
   */
  private getComponentHealth(
    checks: any[],
    componentName: string
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const check = checks.find(c => c.name.includes(componentName));
    if (!check) {
      return 'healthy'; // Default to healthy if no check found
    }
    return check.status;
  }

  /**
   * Get performance health based on metrics
   */
  private getPerformanceHealth(
    metrics: any
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (!metrics) {
      return 'healthy';
    }

    // Check various performance indicators
    if (
      metrics.cpu.usage > 90 ||
      metrics.memory.utilization > 95 ||
      metrics.api.averageResponseTime > 2000 ||
      metrics.api.errorRate > 10
    ) {
      return 'unhealthy';
    }

    if (
      metrics.cpu.usage > 70 ||
      metrics.memory.utilization > 80 ||
      metrics.api.averageResponseTime > 1000 ||
      metrics.api.errorRate > 5
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(health: SystemHealth): number {
    const componentScores = {
      healthy: 100,
      degraded: 60,
      unhealthy: 20,
    };

    const components = Object.values(health.components);
    const totalScore = components.reduce(
      (sum, status) => sum + componentScores[status],
      0
    );

    return Math.round(totalScore / components.length);
  }

  /**
   * Process collected metrics
   */
  private processMetrics(metrics: DashboardMetrics): void {
    // Check for threshold violations and trigger alerts
    this.checkMetricThresholds(metrics);

    // Update real-time metrics
    this.updateRealTimeMetrics(metrics);

    // Clean up old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Process health status changes
   */
  private processHealthStatus(health: SystemHealth): void {
    // Log health status changes
    if (health.overall !== 'healthy') {
      logger.warn('System health degraded', {
        overall: health.overall,
        components: health.components,
      });
    }

    // Trigger alerts for unhealthy components
    Object.entries(health.components).forEach(([component, status]) => {
      if (status === 'unhealthy') {
        this.emit('alertTriggered', {
          type: 'health',
          severity: 'high',
          message: `Component ${component} is unhealthy`,
          component,
          status,
        });
      }
    });
  }

  /**
   * Process alerts
   */
  private processAlert(alert: any): void {
    logger.info('Processing observability alert', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    });

    // Forward to alerting service if configured
    if (this.config.alerts.enabled) {
      // This would integrate with the alerting service
      // alertingService.sendAlert(alert);
    }
  }

  /**
   * Check metric thresholds and trigger alerts
   */
  private checkMetricThresholds(metrics: DashboardMetrics): void {
    // CPU threshold
    if (metrics.system.cpuUsage > 90) {
      this.emit('alertTriggered', {
        type: 'system',
        severity: 'critical',
        message: `CPU usage is critically high: ${metrics.system.cpuUsage.toFixed(1)}%`,
        value: metrics.system.cpuUsage,
        threshold: 90,
      });
    }

    // Memory threshold
    if (metrics.system.memoryUsage > 95) {
      this.emit('alertTriggered', {
        type: 'system',
        severity: 'critical',
        message: `Memory usage is critically high: ${metrics.system.memoryUsage.toFixed(1)}%`,
        value: metrics.system.memoryUsage,
        threshold: 95,
      });
    }

    // Response time threshold
    if (metrics.application.averageResponseTime > 2000) {
      this.emit('alertTriggered', {
        type: 'application',
        severity: 'high',
        message: `Average response time is high: ${metrics.application.averageResponseTime.toFixed(0)}ms`,
        value: metrics.application.averageResponseTime,
        threshold: 2000,
      });
    }

    // Error rate threshold
    if (metrics.application.errorRate > 10) {
      this.emit('alertTriggered', {
        type: 'application',
        severity: 'high',
        message: `Error rate is high: ${metrics.application.errorRate.toFixed(1)}%`,
        value: metrics.application.errorRate,
        threshold: 10,
      });
    }

    // Database connection threshold
    if (metrics.database.poolUtilization > 90) {
      this.emit('alertTriggered', {
        type: 'database',
        severity: 'high',
        message: `Database pool utilization is high: ${metrics.database.poolUtilization.toFixed(1)}%`,
        value: metrics.database.poolUtilization,
        threshold: 90,
      });
    }

    // Security threshold
    if (metrics.security.criticalAlerts > 0) {
      this.emit('alertTriggered', {
        type: 'security',
        severity: 'critical',
        message: `${metrics.security.criticalAlerts} critical security alerts detected`,
        value: metrics.security.criticalAlerts,
        threshold: 0,
      });
    }
  }

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(metrics: DashboardMetrics): void {
    // Record metrics in the metrics service
    metricsService.recordTechnicalMetric({
      name: 'dashboard_system_cpu',
      value: metrics.system.cpuUsage,
    });

    metricsService.recordTechnicalMetric({
      name: 'dashboard_system_memory',
      value: metrics.system.memoryUsage,
    });

    metricsService.recordTechnicalMetric({
      name: 'dashboard_app_response_time',
      value: metrics.application.averageResponseTime,
    });

    metricsService.recordTechnicalMetric({
      name: 'dashboard_app_error_rate',
      value: metrics.application.errorRate,
    });

    metricsService.recordTechnicalMetric({
      name: 'dashboard_db_pool_utilization',
      value: metrics.database.poolUtilization,
    });

    metricsService.recordTechnicalMetric({
      name: 'dashboard_security_compliance',
      value: metrics.security.complianceScore,
    });
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.config.dashboard.retentionDays
    );

    const initialLength = this.dashboardMetrics.length;
    const filteredMetrics = this.dashboardMetrics.filter(
      m => m.timestamp >= cutoffDate
    );

    if (filteredMetrics.length !== initialLength) {
      this.dashboardMetrics.length = 0;
      this.dashboardMetrics.push(...filteredMetrics);

      logger.debug('Cleaned up old dashboard metrics', {
        removed: initialLength - filteredMetrics.length,
        remaining: filteredMetrics.length,
      });
    }
  }

  // Public API methods

  /**
   * Get current dashboard metrics
   */
  getCurrentMetrics(): DashboardMetrics | null {
    return this.dashboardMetrics.length > 0
      ? this.dashboardMetrics[this.dashboardMetrics.length - 1]
      : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): DashboardMetrics[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.dashboardMetrics.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Get alert summary
   */
  getAlertSummary(): AlertSummary {
    const performanceAlerts = performanceMonitor.getAllAlerts();
    const securityMonitor = getSecurityMonitor();
    const securityThreats = securityMonitor.getThreats();

    const allAlerts = [
      ...performanceAlerts.map(a => ({
        severity: a.severity,
        resolved: a.resolved,
      })),
      ...securityThreats.map(t => ({
        severity: t.severity,
        resolved: t.status === 'resolved' || t.status === 'false_positive',
      })),
    ];

    return {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      high: allAlerts.filter(a => a.severity === 'high').length,
      medium: allAlerts.filter(a => a.severity === 'medium').length,
      low: allAlerts.filter(a => a.severity === 'low').length,
      resolved: allAlerts.filter(a => a.resolved).length,
      active: allAlerts.filter(a => !a.resolved).length,
    };
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // This would return the latest health check results
    // For now, trigger a new health check
    await this.checkSystemHealth();

    // Return a basic health status
    const healthStatus = await healthMonitor.runAllChecks();
    return {
      overall: healthStatus.status,
      components: {
        database: this.getComponentHealth(healthStatus.checks, 'database'),
        cache: this.getComponentHealth(healthStatus.checks, 'redis'),
        security: 'healthy',
        performance: 'healthy',
        external_services: 'healthy',
      },
      lastChecked: new Date(),
    };
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<{
    metrics: DashboardMetrics | null;
    health: SystemHealth;
    alerts: AlertSummary;
    trends: {
      cpuTrend: number[];
      memoryTrend: number[];
      responseTimeTrend: number[];
      errorRateTrend: number[];
    };
  }> {
    const metrics = this.getCurrentMetrics();
    const health = await this.getSystemHealth();
    const alerts = this.getAlertSummary();

    // Calculate trends (last 24 data points)
    const recentMetrics = this.dashboardMetrics.slice(-24);
    const trends = {
      cpuTrend: recentMetrics.map(m => m.system.cpuUsage),
      memoryTrend: recentMetrics.map(m => m.system.memoryUsage),
      responseTimeTrend: recentMetrics.map(
        m => m.application.averageResponseTime
      ),
      errorRateTrend: recentMetrics.map(m => m.application.errorRate),
    };

    return {
      metrics,
      health,
      alerts,
      trends,
    };
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(format: 'json' | 'csv' | 'prometheus' = 'json'): string {
    const metrics = this.dashboardMetrics;

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      case 'csv':
        return this.formatMetricsAsCSV(metrics);
      case 'prometheus':
        return this.formatMetricsAsPrometheus(metrics);
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Format metrics as CSV
   */
  private formatMetricsAsCSV(metrics: DashboardMetrics[]): string {
    if (metrics.length === 0) return '';

    const headers = [
      'timestamp',
      'cpu_usage',
      'memory_usage',
      'disk_usage',
      'response_time',
      'error_rate',
      'db_connections',
      'security_score',
    ];

    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.system.cpuUsage,
      m.system.memoryUsage,
      m.system.diskUsage,
      m.application.averageResponseTime,
      m.application.errorRate,
      m.database.connectionCount,
      m.security.complianceScore,
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Format metrics as Prometheus format
   */
  private formatMetricsAsPrometheus(metrics: DashboardMetrics[]): string {
    if (metrics.length === 0) return '';

    const latest = metrics[metrics.length - 1];
    const timestamp = latest.timestamp.getTime();

    return `
# HELP dashboard_system_cpu_usage System CPU usage percentage
# TYPE dashboard_system_cpu_usage gauge
dashboard_system_cpu_usage ${latest.system.cpuUsage} ${timestamp}

# HELP dashboard_system_memory_usage System memory usage percentage
# TYPE dashboard_system_memory_usage gauge
dashboard_system_memory_usage ${latest.system.memoryUsage} ${timestamp}

# HELP dashboard_application_response_time Average application response time in milliseconds
# TYPE dashboard_application_response_time gauge
dashboard_application_response_time ${latest.application.averageResponseTime} ${timestamp}

# HELP dashboard_application_error_rate Application error rate percentage
# TYPE dashboard_application_error_rate gauge
dashboard_application_error_rate ${latest.application.errorRate} ${timestamp}

# HELP dashboard_database_connections Database connection count
# TYPE dashboard_database_connections gauge
dashboard_database_connections ${latest.database.connectionCount} ${timestamp}

# HELP dashboard_security_compliance_score Security compliance score
# TYPE dashboard_security_compliance_score gauge
dashboard_security_compliance_score ${latest.security.complianceScore} ${timestamp}
    `.trim();
  }

  /**
   * Get configuration
   */
  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ObservabilityConfig>): void {
    Object.assign(this.config, updates);
    logger.info('Observability dashboard configuration updated', updates);

    // Restart if running to apply new configuration
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get status
   */
  getStatus(): {
    isRunning: boolean;
    metricsCount: number;
    lastCollection: Date | null;
    config: ObservabilityConfig;
  } {
    return {
      isRunning: this.isRunning,
      metricsCount: this.dashboardMetrics.length,
      lastCollection:
        this.dashboardMetrics.length > 0
          ? this.dashboardMetrics[this.dashboardMetrics.length - 1].timestamp
          : null,
      config: this.config,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();
    this.dashboardMetrics.length = 0;
    this.removeAllListeners();
  }
}

// Export singleton instance
export const observabilityDashboard = new ObservabilityDashboard();
