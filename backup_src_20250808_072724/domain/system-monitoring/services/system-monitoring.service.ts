import os from 'os';
import { EventEmitter } from 'events';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { db } from '../db/connection';
import { checkDatabaseHealth, getDatabaseMetrics } from '../db/health';
import { sql } from 'drizzle-orm';

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAvg: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
    available: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  };
  process: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    pid: number;
    version: string;
  };
  database: {
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    connectionCount: number;
    activeConnections: number;
    slowQueries: number;
    averageQueryTime: number;
    poolUtilization: number;
  };
  application: {
    uptime: number;
    version: string;
    environment: string;
    activeConnections: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}

export interface SystemAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'database' | 'application' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface SystemThresholds {
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  disk: {
    warning: number;
    critical: number;
  };
  database: {
    connectionWarning: number;
    connectionCritical: number;
    queryTimeWarning: number;
    queryTimeCritical: number;
  };
  application: {
    errorRateWarning: number;
    errorRateCritical: number;
  };
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    averageCpuUsage: number;
    averageMemoryUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    uptime: number;
  };
  trends: {
    cpuTrend: Array<{ timestamp: number; value: number }>;
    memoryTrend: Array<{ timestamp: number; value: number }>;
    requestTrend: Array<{ timestamp: number; value: number }>;
    errorTrend: Array<{ timestamp: number; value: number }>;
  };
  alerts: SystemAlert[];
  recommendations: string[];
}

export class SystemMonitoringService extends BaseService {
  private readonly eventEmitter: EventEmitter;
  private readonly metricsHistory: SystemMetrics[] = [];
  private readonly alertsHistory: SystemAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MAX_HISTORY_LENGTH = 1440; // 24 hours at 1-minute intervals
  private readonly MAX_ALERTS_HISTORY = 1000;
  
  private readonly defaultThresholds: SystemThresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    disk: { warning: 85, critical: 95 },
    database: {
      connectionWarning: 80,
      connectionCritical: 95,
      queryTimeWarning: 1000,
      queryTimeCritical: 5000
    },
    application: {
      errorRateWarning: 5,
      errorRateCritical: 10
    }
  };

  private currentThresholds: SystemThresholds;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private responseTimeCount = 0;

  constructor() {
    super('SystemMonitoringService', {
      enableCache: false,
      enableAudit: true,
      enableMetrics: true
    });

    this.eventEmitter = new EventEmitter();
    this.currentThresholds = { ...this.defaultThresholds };
  }

  // Core Monitoring Operations
  async startMonitoring(intervalMs: number = 60000, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('startMonitoring', ctx, { intervalMs });

    try {
      if (this.monitoringInterval) {
        throw new ValidationError('Monitoring is already running');
      }

      // Collect initial metrics
      const initialMetrics = await this.collectMetrics();
      this.addMetricsToHistory(initialMetrics);

      // Start monitoring interval
      this.monitoringInterval = setInterval(async () => {
        try {
          const metrics = await this.collectMetrics();
          this.addMetricsToHistory(metrics);
          
          // Check for alerts
          const alerts = this.checkThresholds(metrics);
          alerts.forEach(alert => this.addAlert(alert));

          // Emit metrics event
          this.eventEmitter.emit('metrics', metrics);
          
          // Emit alerts if any
          if (alerts.length > 0) {
            this.eventEmitter.emit('alerts', alerts);
          }
        } catch (error) {
          console.error('Error during monitoring cycle:', error);
        }
      }, intervalMs);

      await this.recordMetric('system.monitoring.started', 1, {
        interval: intervalMs.toString()
      });

      console.log(`System monitoring started with ${intervalMs}ms interval`);
    } catch (error) {
      this.handleError(error, 'startMonitoring', ctx);
    }
  }

  async stopMonitoring(context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('stopMonitoring', ctx);

    try {
      if (!this.monitoringInterval) {
        throw new ValidationError('Monitoring is not running');
      }

      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;

      await this.recordMetric('system.monitoring.stopped', 1);

      console.log('System monitoring stopped');
    } catch (error) {
      this.handleError(error, 'stopMonitoring', ctx);
    }
  }

  async getCurrentMetrics(context?: ServiceContext): Promise<SystemMetrics> {
    const ctx = this.createContext(context);
    this.logOperation('getCurrentMetrics', ctx);

    try {
      return await this.collectMetrics();
    } catch (error) {
      this.handleError(error, 'getCurrentMetrics', ctx);
    }
  }

  async getMetricsHistory(
    startTime?: Date,
    endTime?: Date,
    context?: ServiceContext
  ): Promise<SystemMetrics[]> {
    const ctx = this.createContext(context);
    this.logOperation('getMetricsHistory', ctx, { startTime, endTime });

    try {
      let filteredMetrics = [...this.metricsHistory];

      if (startTime) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startTime.getTime());
      }

      if (endTime) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endTime.getTime());
      }

      return filteredMetrics;
    } catch (error) {
      this.handleError(error, 'getMetricsHistory', ctx);
    }
  }

  // Alert Management
  async getActiveAlerts(context?: ServiceContext): Promise<SystemAlert[]> {
    const ctx = this.createContext(context);
    this.logOperation('getActiveAlerts', ctx);

    try {
      return this.alertsHistory.filter(alert => !alert.resolved);
    } catch (error) {
      this.handleError(error, 'getActiveAlerts', ctx);
    }
  }

  async getAlertsHistory(
    startTime?: Date,
    endTime?: Date,
    context?: ServiceContext
  ): Promise<SystemAlert[]> {
    const ctx = this.createContext(context);
    this.logOperation('getAlertsHistory', ctx, { startTime, endTime });

    try {
      let filteredAlerts = [...this.alertsHistory];

      if (startTime) {
        filteredAlerts = filteredAlerts.filter(a => a.timestamp >= startTime);
      }

      if (endTime) {
        filteredAlerts = filteredAlerts.filter(a => a.timestamp <= endTime);
      }

      return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      this.handleError(error, 'getAlertsHistory', ctx);
    }
  }

  async resolveAlert(alertId: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('resolveAlert', ctx, { alertId });

    try {
      const alert = this.alertsHistory.find(a => a.id === alertId);
      if (!alert) {
        throw new NotFoundError('Alert', alertId);
      }

      if (alert.resolved) {
        throw new ValidationError('Alert is already resolved');
      }

      alert.resolved = true;
      alert.resolvedAt = new Date();

      await this.recordMetric('system.alert.resolved', 1, {
        type: alert.type,
        severity: alert.severity
      });
    } catch (error) {
      this.handleError(error, 'resolveAlert', ctx);
    }
  }

  // Threshold Management
  async updateThresholds(thresholds: Partial<SystemThresholds>, context?: ServiceContext): Promise<SystemThresholds> {
    const ctx = this.createContext(context);
    this.logOperation('updateThresholds', ctx, thresholds);

    try {
      // Only admins can update thresholds
      if (ctx.userRole !== 'admin') {
        throw new ForbiddenError('Only administrators can update system thresholds');
      }

      // Merge with current thresholds
      this.currentThresholds = {
        ...this.currentThresholds,
        ...thresholds
      };

      await this.recordMetric('system.thresholds.updated', 1);

      return this.currentThresholds;
    } catch (error) {
      this.handleError(error, 'updateThresholds', ctx);
    }
  }

  async getThresholds(context?: ServiceContext): Promise<SystemThresholds> {
    const ctx = this.createContext(context);
    this.logOperation('getThresholds', ctx);

    try {
      return { ...this.currentThresholds };
    } catch (error) {
      this.handleError(error, 'getThresholds', ctx);
    }
  }

  async resetThresholds(context?: ServiceContext): Promise<SystemThresholds> {
    const ctx = this.createContext(context);
    this.logOperation('resetThresholds', ctx);

    try {
      // Only admins can reset thresholds
      if (ctx.userRole !== 'admin') {
        throw new ForbiddenError('Only administrators can reset system thresholds');
      }

      this.currentThresholds = { ...this.defaultThresholds };

      await this.recordMetric('system.thresholds.reset', 1);

      return this.currentThresholds;
    } catch (error) {
      this.handleError(error, 'resetThresholds', ctx);
    }
  }

  // Performance Reports
  async generatePerformanceReport(
    startTime: Date,
    endTime: Date,
    context?: ServiceContext
  ): Promise<PerformanceReport> {
    const ctx = this.createContext(context);
    this.logOperation('generatePerformanceReport', ctx, { startTime, endTime });

    try {
      // Only admins can generate performance reports
      if (ctx.userRole !== 'admin') {
        throw new ForbiddenError('Only administrators can generate performance reports');
      }

      const metricsInPeriod = this.metricsHistory.filter(
        m => m.timestamp >= startTime.getTime() && m.timestamp <= endTime.getTime()
      );

      const alertsInPeriod = this.alertsHistory.filter(
        a => a.timestamp >= startTime && a.timestamp <= endTime
      );

      if (metricsInPeriod.length === 0) {
        throw new ValidationError('No metrics data available for the specified period');
      }

      // Calculate summary statistics
      const cpuUsages = metricsInPeriod.map(m => m.cpu.usage);
      const memoryUsages = metricsInPeriod.map(m => m.memory.usedPercent);
      const requests = metricsInPeriod.map(m => m.application.requestsPerMinute);
      const errors = metricsInPeriod.map(m => m.application.errorRate);

      const summary = {
        averageCpuUsage: this.calculateAverage(cpuUsages),
        averageMemoryUsage: this.calculateAverage(memoryUsages),
        peakCpuUsage: Math.max(...cpuUsages),
        peakMemoryUsage: Math.max(...memoryUsages),
        totalRequests: requests.reduce((sum, r) => sum + r, 0),
        totalErrors: errors.reduce((sum, e) => sum + e, 0),
        averageResponseTime: this.responseTimeCount > 0 ? this.responseTimeSum / this.responseTimeCount : 0,
        uptime: process.uptime()
      };

      // Generate trends
      const trends = {
        cpuTrend: metricsInPeriod.map(m => ({ timestamp: m.timestamp, value: m.cpu.usage })),
        memoryTrend: metricsInPeriod.map(m => ({ timestamp: m.timestamp, value: m.memory.usedPercent })),
        requestTrend: metricsInPeriod.map(m => ({ timestamp: m.timestamp, value: m.application.requestsPerMinute })),
        errorTrend: metricsInPeriod.map(m => ({ timestamp: m.timestamp, value: m.application.errorRate }))
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations(summary, alertsInPeriod);

      const report: PerformanceReport = {
        period: { start: startTime, end: endTime },
        summary,
        trends,
        alerts: alertsInPeriod,
        recommendations
      };

      await this.recordMetric('system.performance_report.generated', 1);

      return report;
    } catch (error) {
      this.handleError(error, 'generatePerformanceReport', ctx);
    }
  }

  // Event Subscription
  onMetrics(callback: (metrics: SystemMetrics) => void): void {
    this.eventEmitter.on('metrics', callback);
  }

  onAlerts(callback: (alerts: SystemAlert[]) => void): void {
    this.eventEmitter.on('alerts', callback);
  }

  offMetrics(callback: (metrics: SystemMetrics) => void): void {
    this.eventEmitter.off('metrics', callback);
  }

  offAlerts(callback: (alerts: SystemAlert[]) => void): void {
    this.eventEmitter.off('alerts', callback);
  }

  // Application Metrics Tracking
  recordRequest(): void {
    this.requestCount++;
  }

  recordError(): void {
    this.errorCount++;
  }

  recordResponseTime(timeMs: number): void {
    this.responseTimeSum += timeMs;
    this.responseTimeCount++;
  }

  // Private Helper Methods
  private async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = Date.now();

    // CPU metrics
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage (simplified)
    const cpuUsage = Math.min(100, (loadAvg[0] / cpus.length) * 100);

    // Memory metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMemPercent = (usedMem / totalMem) * 100;

    // Process metrics
    const processMemory = process.memoryUsage();

    // Database metrics
    let databaseMetrics;
    try {
      const dbHealth = await checkDatabaseHealth();
      databaseMetrics = {
        status: dbHealth.isConnected ? 'connected' as const : 'disconnected' as const,
        connectionCount: dbHealth.connectionCount,
        activeConnections: dbHealth.activeConnections,
        slowQueries: dbHealth.slowQueries,
        averageQueryTime: dbHealth.averageQueryTime,
        poolUtilization: dbHealth.maxConnections > 0 ? (dbHealth.connectionCount / dbHealth.maxConnections) * 100 : 0
      };
    } catch (error) {
      databaseMetrics = {
        status: 'error' as const,
        connectionCount: 0,
        activeConnections: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        poolUtilization: 0
      };
    }

    // Application metrics
    const currentMinute = Math.floor(timestamp / 60000);
    const requestsPerMinute = this.requestCount; // Reset counter after reading
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    // Reset counters
    this.requestCount = 0;
    this.errorCount = 0;

    const metrics: SystemMetrics = {
      timestamp,
      cpu: {
        usage: cpuUsage,
        loadAvg,
        cores: cpus.length
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usedPercent: usedMemPercent,
        available: freeMem
      },
      disk: {
        total: 0, // Would need additional library for disk metrics
        free: 0,
        used: 0,
        usedPercent: 0
      },
      network: {
        bytesReceived: 0, // Would need additional library for network metrics
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0
      },
      process: {
        memory: processMemory,
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version
      },
      database: databaseMetrics,
      application: {
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        activeConnections: 0, // Would need WebSocket connection tracking
        requestsPerMinute,
        errorRate
      }
    };

    return metrics;
  }

  private addMetricsToHistory(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Maintain history size
    if (this.metricsHistory.length > this.MAX_HISTORY_LENGTH) {
      this.metricsHistory.shift();
    }
  }

  private checkThresholds(metrics: SystemMetrics): SystemAlert[] {
    const alerts: SystemAlert[] = [];
    const timestamp = new Date();

    // CPU alerts
    if (metrics.cpu.usage >= this.currentThresholds.cpu.critical) {
      alerts.push(this.createAlert('cpu', 'critical', `CPU usage is critically high: ${metrics.cpu.usage.toFixed(1)}%`, metrics.cpu.usage, this.currentThresholds.cpu.critical, timestamp));
    } else if (metrics.cpu.usage >= this.currentThresholds.cpu.warning) {
      alerts.push(this.createAlert('cpu', 'medium', `CPU usage is high: ${metrics.cpu.usage.toFixed(1)}%`, metrics.cpu.usage, this.currentThresholds.cpu.warning, timestamp));
    }

    // Memory alerts
    if (metrics.memory.usedPercent >= this.currentThresholds.memory.critical) {
      alerts.push(this.createAlert('memory', 'critical', `Memory usage is critically high: ${metrics.memory.usedPercent.toFixed(1)}%`, metrics.memory.usedPercent, this.currentThresholds.memory.critical, timestamp));
    } else if (metrics.memory.usedPercent >= this.currentThresholds.memory.warning) {
      alerts.push(this.createAlert('memory', 'medium', `Memory usage is high: ${metrics.memory.usedPercent.toFixed(1)}%`, metrics.memory.usedPercent, this.currentThresholds.memory.warning, timestamp));
    }

    // Database alerts
    if (metrics.database.poolUtilization >= this.currentThresholds.database.connectionCritical) {
      alerts.push(this.createAlert('database', 'critical', `Database connection pool utilization is critically high: ${metrics.database.poolUtilization.toFixed(1)}%`, metrics.database.poolUtilization, this.currentThresholds.database.connectionCritical, timestamp));
    } else if (metrics.database.poolUtilization >= this.currentThresholds.database.connectionWarning) {
      alerts.push(this.createAlert('database', 'medium', `Database connection pool utilization is high: ${metrics.database.poolUtilization.toFixed(1)}%`, metrics.database.poolUtilization, this.currentThresholds.database.connectionWarning, timestamp));
    }

    if (metrics.database.averageQueryTime >= this.currentThresholds.database.queryTimeCritical) {
      alerts.push(this.createAlert('database', 'critical', `Database query time is critically slow: ${metrics.database.averageQueryTime}ms`, metrics.database.averageQueryTime, this.currentThresholds.database.queryTimeCritical, timestamp));
    } else if (metrics.database.averageQueryTime >= this.currentThresholds.database.queryTimeWarning) {
      alerts.push(this.createAlert('database', 'medium', `Database query time is slow: ${metrics.database.averageQueryTime}ms`, metrics.database.averageQueryTime, this.currentThresholds.database.queryTimeWarning, timestamp));
    }

    // Application alerts
    if (metrics.application.errorRate >= this.currentThresholds.application.errorRateCritical) {
      alerts.push(this.createAlert('application', 'critical', `Application error rate is critically high: ${metrics.application.errorRate.toFixed(1)}%`, metrics.application.errorRate, this.currentThresholds.application.errorRateCritical, timestamp));
    } else if (metrics.application.errorRate >= this.currentThresholds.application.errorRateWarning) {
      alerts.push(this.createAlert('application', 'medium', `Application error rate is high: ${metrics.application.errorRate.toFixed(1)}%`, metrics.application.errorRate, this.currentThresholds.application.errorRateWarning, timestamp));
    }

    return alerts;
  }

  private createAlert(
    type: SystemAlert['type'],
    severity: SystemAlert['severity'],
    message: string,
    value: number,
    threshold: number,
    timestamp: Date
  ): SystemAlert {
    return {
      id: `${type}_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp,
      resolved: false
    };
  }

  private addAlert(alert: SystemAlert): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alertsHistory.find(a => 
      a.type === alert.type && 
      a.severity === alert.severity && 
      !a.resolved &&
      (alert.timestamp.getTime() - a.timestamp.getTime()) < 300000 // Within 5 minutes
    );

    if (!existingAlert) {
      this.alertsHistory.push(alert);
      
      // Maintain alerts history size
      if (this.alertsHistory.length > this.MAX_ALERTS_HISTORY) {
        this.alertsHistory.shift();
      }

      console.warn(`[SYSTEM ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private generateRecommendations(summary: PerformanceReport['summary'], alerts: SystemAlert[]): string[] {
    const recommendations: string[] = [];

    // CPU recommendations
    if (summary.averageCpuUsage > 70) {
      recommendations.push('Consider scaling up CPU resources or optimizing CPU-intensive operations');
    }

    // Memory recommendations
    if (summary.averageMemoryUsage > 80) {
      recommendations.push('Consider increasing memory allocation or optimizing memory usage');
    }

    // Error rate recommendations
    if (summary.totalErrors > 0) {
      const errorRate = (summary.totalErrors / summary.totalRequests) * 100;
      if (errorRate > 5) {
        recommendations.push('High error rate detected. Review application logs and fix recurring errors');
      }
    }

    // Database recommendations
    const dbAlerts = alerts.filter(a => a.type === 'database');
    if (dbAlerts.length > 0) {
      recommendations.push('Database performance issues detected. Consider optimizing queries or scaling database resources');
    }

    // General recommendations
    if (alerts.filter(a => a.severity === 'critical').length > 0) {
      recommendations.push('Critical alerts detected. Immediate attention required to prevent service degradation');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within normal parameters');
    }

    return recommendations;
  }
}

// Export singleton instance
export const systemMonitoringService = new SystemMonitoringService();
