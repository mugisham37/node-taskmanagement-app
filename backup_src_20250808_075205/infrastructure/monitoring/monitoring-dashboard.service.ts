import { EventEmitter } from 'events';
import { metricsService } from './metrics.service';
import { healthMonitor, HealthStatus } from './health-check.service';
import { systemMonitoringService } from '../../application/services/system-monitoring.service';
import { logSystem, logError } from '../config/logger';

export interface DashboardMetrics {
  timestamp: Date;
  system: {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
  };
  application: {
    activeConnections: number;
    requestsPerMinute: number;
    errorRate: number;
    responseTime: number;
  };
  database: {
    connections: number;
    queryTime: number;
    slowQueries: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    operations: number;
  };
  business: {
    activeUsers: number;
    operationsPerMinute: number;
    workspaces: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  description?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class MonitoringDashboardService extends EventEmitter {
  private readonly alertRules = new Map<string, AlertRule>();
  private readonly activeAlerts = new Map<string, Alert>();
  private readonly alertHistory: Alert[] = [];
  private readonly metricsHistory: DashboardMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MAX_HISTORY = 1440; // 24 hours at 1-minute intervals
  private readonly MAX_ALERT_HISTORY = 1000;

  constructor() {
    super();
    this.initializeDefaultAlertRules();
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'cpu_high',
        name: 'High CPU Usage',
        metric: 'system.cpu',
        operator: 'gt',
        threshold: 80,
        severity: 'high',
        enabled: true,
        description: 'CPU usage is above 80%',
      },
      {
        id: 'cpu_critical',
        name: 'Critical CPU Usage',
        metric: 'system.cpu',
        operator: 'gt',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        description: 'CPU usage is above 95%',
      },
      {
        id: 'memory_high',
        name: 'High Memory Usage',
        metric: 'system.memory',
        operator: 'gt',
        threshold: 85,
        severity: 'high',
        enabled: true,
        description: 'Memory usage is above 85%',
      },
      {
        id: 'memory_critical',
        name: 'Critical Memory Usage',
        metric: 'system.memory',
        operator: 'gt',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        description: 'Memory usage is above 95%',
      },
      {
        id: 'error_rate_high',
        name: 'High Error Rate',
        metric: 'application.errorRate',
        operator: 'gt',
        threshold: 5,
        severity: 'medium',
        enabled: true,
        description: 'Application error rate is above 5%',
      },
      {
        id: 'error_rate_critical',
        name: 'Critical Error Rate',
        metric: 'application.errorRate',
        operator: 'gt',
        threshold: 10,
        severity: 'critical',
        enabled: true,
        description: 'Application error rate is above 10%',
      },
      {
        id: 'response_time_slow',
        name: 'Slow Response Time',
        metric: 'application.responseTime',
        operator: 'gt',
        threshold: 1000,
        severity: 'medium',
        enabled: true,
        description: 'Average response time is above 1000ms',
      },
      {
        id: 'database_slow',
        name: 'Slow Database Queries',
        metric: 'database.queryTime',
        operator: 'gt',
        threshold: 500,
        severity: 'medium',
        enabled: true,
        description: 'Average database query time is above 500ms',
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    logSystem(`Initialized ${defaultRules.length} default alert rules`);
  }

  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    // Start health monitoring
    healthMonitor.startMonitoring(30000); // Every 30 seconds

    // Start system monitoring
    await systemMonitoringService.startMonitoring(intervalMs);

    // Start dashboard monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectAndProcessMetrics();
      } catch (error) {
        logError(error as Error, 'Dashboard monitoring cycle failed');
      }
    }, intervalMs);

    logSystem(`Dashboard monitoring started with ${intervalMs}ms interval`);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    healthMonitor.stopMonitoring();
    systemMonitoringService.stopMonitoring();

    logSystem('Dashboard monitoring stopped');
  }

  private async collectAndProcessMetrics(): Promise<void> {
    try {
      // Get system metrics
      const systemMetrics = await systemMonitoringService.getCurrentMetrics();

      // Get health status
      const healthStatus = await healthMonitor.runAllChecks();

      // Aggregate dashboard metrics
      const dashboardMetrics: DashboardMetrics = {
        timestamp: new Date(),
        system: {
          cpu: systemMetrics.cpu.usage,
          memory: systemMetrics.memory.usedPercent,
          disk: systemMetrics.disk.usedPercent,
          uptime: systemMetrics.process.uptime,
        },
        application: {
          activeConnections: systemMetrics.application.activeConnections,
          requestsPerMinute: systemMetrics.application.requestsPerMinute,
          errorRate: systemMetrics.application.errorRate,
          responseTime: 0, // Would be calculated from metrics
        },
        database: {
          connections: systemMetrics.database.connectionCount,
          queryTime: systemMetrics.database.averageQueryTime,
          slowQueries: systemMetrics.database.slowQueries,
        },
        cache: {
          hitRate: 0, // Would be calculated from cache metrics
          memoryUsage: 0,
          operations: 0,
        },
        business: {
          activeUsers: 0, // Would be calculated from user sessions
          operationsPerMinute: 0,
          workspaces: 0,
        },
      };

      // Store metrics
      this.metricsHistory.push(dashboardMetrics);
      if (this.metricsHistory.length > this.MAX_HISTORY) {
        this.metricsHistory.shift();
      }

      // Check alert rules
      await this.checkAlertRules(dashboardMetrics);

      // Record Prometheus metrics
      metricsService.recordSystemMetrics(
        dashboardMetrics.system.cpu,
        dashboardMetrics.system.memory
      );

      // Emit metrics event
      this.emit('metrics', dashboardMetrics);
    } catch (error) {
      logError(error as Error, 'Failed to collect dashboard metrics');
    }
  }

  private async checkAlertRules(metrics: DashboardMetrics): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        const value = this.getMetricValue(metrics, rule.metric);
        const shouldAlert = this.evaluateRule(value, rule);

        if (shouldAlert) {
          await this.triggerAlert(rule, value);
        } else {
          // Check if we should resolve an existing alert
          await this.checkAlertResolution(rule, value);
        }
      } catch (error) {
        logError(error as Error, `Failed to check alert rule: ${rule.name}`);
      }
    }
  }

  private getMetricValue(
    metrics: DashboardMetrics,
    metricPath: string
  ): number {
    const parts = metricPath.split('.');
    let value: any = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        throw new Error(`Metric path not found: ${metricPath}`);
      }
    }

    if (typeof value !== 'number') {
      throw new Error(`Metric value is not a number: ${metricPath}`);
    }

    return value;
  }

  private evaluateRule(value: number, rule: AlertRule): boolean {
    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    // Check if alert already exists
    const existingAlert = this.activeAlerts.get(rule.id);
    if (existingAlert && !existingAlert.resolved) {
      return; // Alert already active
    }

    const alert: Alert = {
      id: `${rule.id}_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      timestamp: new Date(),
      resolved: false,
    };

    this.activeAlerts.set(rule.id, alert);
    this.alertHistory.push(alert);

    if (this.alertHistory.length > this.MAX_ALERT_HISTORY) {
      this.alertHistory.shift();
    }

    // Record metrics
    metricsService.recordError('alert_triggered', rule.severity, 'monitoring');

    // Log alert
    const logLevel =
      rule.severity === 'critical' || rule.severity === 'high'
        ? 'error'
        : 'warn';
    logSystem(`Alert triggered: ${alert.message}`, logLevel, {
      alertId: alert.id,
      ruleId: rule.id,
      severity: rule.severity,
      value,
      threshold: rule.threshold,
    });

    // Emit alert event
    this.emit('alert', alert);

    // Send alert notification
    const { alertingService } = require('./alerting.service');
    alertingService.sendAlert(alert).catch((error: Error) => {
      logError(error, 'Failed to send alert notification');
    });
  }

  private async checkAlertResolution(
    rule: AlertRule,
    value: number
  ): Promise<void> {
    const activeAlert = this.activeAlerts.get(rule.id);
    if (!activeAlert || activeAlert.resolved) {
      return;
    }

    // Check if the condition is no longer met (with some hysteresis)
    const hysteresis = rule.threshold * 0.1; // 10% hysteresis
    let shouldResolve = false;

    switch (rule.operator) {
      case 'gt':
      case 'gte':
        shouldResolve = value < rule.threshold - hysteresis;
        break;
      case 'lt':
      case 'lte':
        shouldResolve = value > rule.threshold + hysteresis;
        break;
      case 'eq':
        shouldResolve = Math.abs(value - rule.threshold) > hysteresis;
        break;
    }

    if (shouldResolve) {
      await this.resolveAlert(activeAlert.id, 'system');
    }
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    // Find alert in active alerts
    let alert: Alert | undefined;
    for (const [ruleId, activeAlert] of this.activeAlerts.entries()) {
      if (activeAlert.id === alertId) {
        alert = activeAlert;
        this.activeAlerts.delete(ruleId);
        break;
      }
    }

    // Find alert in history if not in active alerts
    if (!alert) {
      alert = this.alertHistory.find(a => a.id === alertId);
    }

    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.resolved) {
      throw new Error(`Alert already resolved: ${alertId}`);
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    // Record metrics
    metricsService.recordSystemEvent('alert_resolved', {
      alert_id: alertId,
      rule_id: alert.ruleId,
      severity: alert.severity,
      resolved_by: resolvedBy,
    });

    // Log resolution
    logSystem(`Alert resolved: ${alert.message}`, 'info', {
      alertId,
      ruleId: alert.ruleId,
      resolvedBy,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
    });

    // Emit resolution event
    this.emit('alert_resolved', alert);
  }

  // Alert Rule Management
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logSystem(`Alert rule added: ${rule.name}`);
  }

  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    Object.assign(rule, updates);
    logSystem(`Alert rule updated: ${rule.name}`);
  }

  removeAlertRule(ruleId: string): void {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.alertRules.delete(ruleId);

    // Resolve any active alerts for this rule
    const activeAlert = this.activeAlerts.get(ruleId);
    if (activeAlert && !activeAlert.resolved) {
      this.resolveAlert(activeAlert.id, 'system');
    }

    logSystem(`Alert rule removed: ${rule.name}`);
  }

  // Data Access Methods
  getMetrics(limit?: number): DashboardMetrics[] {
    const metrics = [...this.metricsHistory];
    return limit ? metrics.slice(-limit) : metrics;
  }

  getLatestMetrics(): DashboardMetrics | null {
    return this.metricsHistory.length > 0
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => !alert.resolved
    );
  }

  getAlertHistory(limit?: number): Alert[] {
    const history = [...this.alertHistory].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    return limit ? history.slice(0, limit) : history;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getAlertRule(ruleId: string): AlertRule | undefined {
    return this.alertRules.get(ruleId);
  }

  // Health Status
  async getHealthStatus(): Promise<HealthStatus> {
    return healthMonitor.runAllChecks();
  }

  getHealthHistory(limit?: number): HealthStatus[] {
    return healthMonitor.getHistory(limit);
  }

  // Performance Reports
  async generatePerformanceReport(
    startTime: Date,
    endTime: Date
  ): Promise<any> {
    const metricsInPeriod = this.metricsHistory.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (metricsInPeriod.length === 0) {
      throw new Error('No metrics data available for the specified period');
    }

    const alertsInPeriod = this.alertHistory.filter(
      a => a.timestamp >= startTime && a.timestamp <= endTime
    );

    // Calculate averages and peaks
    const cpuValues = metricsInPeriod.map(m => m.system.cpu);
    const memoryValues = metricsInPeriod.map(m => m.system.memory);
    const errorRates = metricsInPeriod.map(m => m.application.errorRate);

    const report = {
      period: { start: startTime, end: endTime },
      summary: {
        averageCpuUsage: this.calculateAverage(cpuValues),
        averageMemoryUsage: this.calculateAverage(memoryValues),
        peakCpuUsage: Math.max(...cpuValues),
        peakMemoryUsage: Math.max(...memoryValues),
        averageErrorRate: this.calculateAverage(errorRates),
        totalAlerts: alertsInPeriod.length,
        criticalAlerts: alertsInPeriod.filter(a => a.severity === 'critical')
          .length,
      },
      trends: {
        cpu: metricsInPeriod.map(m => ({
          timestamp: m.timestamp,
          value: m.system.cpu,
        })),
        memory: metricsInPeriod.map(m => ({
          timestamp: m.timestamp,
          value: m.system.memory,
        })),
        errorRate: metricsInPeriod.map(m => ({
          timestamp: m.timestamp,
          value: m.application.errorRate,
        })),
      },
      alerts: alertsInPeriod,
      recommendations: this.generateRecommendations(
        metricsInPeriod,
        alertsInPeriod
      ),
    };

    return report;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private generateRecommendations(
    metrics: DashboardMetrics[],
    alerts: Alert[]
  ): string[] {
    const recommendations: string[] = [];

    // CPU recommendations
    const avgCpu = this.calculateAverage(metrics.map(m => m.system.cpu));
    if (avgCpu > 70) {
      recommendations.push(
        'Consider scaling up CPU resources or optimizing CPU-intensive operations'
      );
    }

    // Memory recommendations
    const avgMemory = this.calculateAverage(metrics.map(m => m.system.memory));
    if (avgMemory > 80) {
      recommendations.push(
        'Consider increasing memory allocation or optimizing memory usage'
      );
    }

    // Error rate recommendations
    const avgErrorRate = this.calculateAverage(
      metrics.map(m => m.application.errorRate)
    );
    if (avgErrorRate > 5) {
      recommendations.push(
        'High error rate detected. Review application logs and fix recurring errors'
      );
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push(
        'Critical alerts detected. Immediate attention required to prevent service degradation'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within normal parameters');
    }

    return recommendations;
  }
}

// Export singleton instance
export const monitoringDashboard = new MonitoringDashboardService();
