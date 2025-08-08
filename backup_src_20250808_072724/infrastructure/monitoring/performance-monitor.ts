import { EventEmitter } from 'events';
import { logger } from '../logging/logger';
import { queryOptimizer } from '../database/query-optimizer';
import { connectionPoolManager } from '../database/connection-pool-manager';
import { apiOptimizer } from '../performance/api-optimizer';

/**
 * Comprehensive System Performance Monitor
 * Monitors system performance, collects metrics, and provides alerts
 */

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    utilization: number;
  };
  database: {
    connectionCount: number;
    activeConnections: number;
    poolUtilization: number;
    averageQueryTime: number;
    slowQueries: number;
    cacheHitRatio: number;
  };
  api: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  disk: {
    used: number;
    total: number;
    free: number;
    utilization: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'cpu' | 'memory' | 'database' | 'api' | 'disk' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceThresholds {
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  database: {
    connectionUtilization: {
      warning: number;
      critical: number;
    };
    queryTime: {
      warning: number;
      critical: number;
    };
    cacheHitRatio: {
      warning: number;
      critical: number;
    };
  };
  api: {
    responseTime: {
      warning: number;
      critical: number;
    };
    errorRate: {
      warning: number;
      critical: number;
    };
  };
  disk: {
    utilization: {
      warning: number;
      critical: number;
    };
  };
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: SystemMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private alertInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  private thresholds: PerformanceThresholds = {
    cpu: {
      warning: 70,
      critical: 90,
    },
    memory: {
      warning: 80,
      critical: 95,
    },
    database: {
      connectionUtilization: {
        warning: 80,
        critical: 95,
      },
      queryTime: {
        warning: 1000,
        critical: 5000,
      },
      cacheHitRatio: {
        warning: 80,
        critical: 60,
      },
    },
    api: {
      responseTime: {
        warning: 500,
        critical: 2000,
      },
      errorRate: {
        warning: 5,
        critical: 10,
      },
    },
    disk: {
      utilization: {
        warning: 80,
        critical: 95,
      },
    },
  };

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for performance events
   */
  private setupEventListeners(): void {
    this.on('alert', (alert: PerformanceAlert) => {
      logger.warn('Performance alert triggered', alert);

      if (alert.severity === 'critical') {
        logger.error('Critical performance alert', alert);
        // Could trigger additional actions like notifications
      }
    });

    this.on('metrics', (metrics: SystemMetrics) => {
      logger.debug('Performance metrics collected', {
        timestamp: metrics.timestamp,
        cpu: metrics.cpu.usage,
        memory: metrics.memory.utilization,
        database: metrics.database.poolUtilization,
      });
    });
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting performance monitoring', { intervalMs });

    // Collect initial metrics
    this.collectMetrics();

    // Set up periodic metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Set up alert checking (more frequent than metrics collection)
    this.alertInterval = setInterval(
      () => {
        this.checkAlerts();
      },
      Math.min(intervalMs / 2, 15000)
    );

    // Start database connection monitoring
    connectionPoolManager.startMetricsCollection(intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    logger.info('Stopping performance monitoring');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = undefined;
    }

    connectionPoolManager.stopMetricsCollection();
  }

  /**
   * Collect comprehensive system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      // CPU metrics
      const cpuUsage = await this.getCpuUsage();
      const loadAverage = this.getLoadAverage();

      // Memory metrics
      const memoryUsage = process.memoryUsage();
      const systemMemory = await this.getSystemMemory();

      // Database metrics
      const dbStats = await connectionPoolManager.getPoolStats();
      const dbMetrics = connectionPoolManager.getConnectionMetrics();
      const dbHealth = await connectionPoolManager.checkConnectionHealth();

      // API metrics
      const apiMetrics = apiOptimizer.getPerformanceMetrics();
      const apiStats = this.calculateApiStats(apiMetrics);

      // Disk metrics
      const diskUsage = await this.getDiskUsage();

      // Network metrics (basic)
      const networkStats = await this.getNetworkStats();

      const metrics: SystemMetrics = {
        timestamp,
        cpu: {
          usage: cpuUsage,
          loadAverage,
          cores: require('os').cpus().length,
        },
        memory: {
          used: systemMemory.used,
          total: systemMemory.total,
          free: systemMemory.free,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
          utilization: (systemMemory.used / systemMemory.total) * 100,
        },
        database: {
          connectionCount: dbStats.totalConnections,
          activeConnections: dbStats.activeConnections,
          poolUtilization: dbStats.connectionUtilization,
          averageQueryTime: dbMetrics.averageConnectionTime,
          slowQueries: dbMetrics.slowQueries,
          cacheHitRatio: 0, // Would need to implement cache hit ratio tracking
        },
        api: apiStats,
        disk: diskUsage,
        network: networkStats,
      };

      // Store metrics (keep last 1000 entries)
      this.metrics.push(metrics);
      if (this.metrics.length > 1000) {
        this.metrics.shift();
      }

      this.emit('metrics', metrics);
    } catch (error) {
      logger.error('Failed to collect performance metrics', { error });
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise(resolve => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);

        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000;
        const cpuTime = currentUsage.user + currentUsage.system;

        const cpuPercent = (cpuTime / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Get system load average
   */
  private getLoadAverage(): number[] {
    try {
      return require('os').loadavg();
    } catch {
      return [0, 0, 0];
    }
  }

  /**
   * Get system memory usage
   */
  private async getSystemMemory(): Promise<{
    used: number;
    total: number;
    free: number;
  }> {
    try {
      const os = require('os');
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;

      return { used, total, free };
    } catch {
      return { used: 0, total: 0, free: 0 };
    }
  }

  /**
   * Calculate API performance statistics
   */
  private calculateApiStats(apiMetrics: Map<string, any>): {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  } {
    let totalRequests = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;

    apiMetrics.forEach(metrics => {
      totalRequests += metrics.requestCount;
      totalResponseTime += metrics.averageResponseTime * metrics.requestCount;
      totalErrors += metrics.errorRate * metrics.requestCount;
    });

    return {
      requestsPerSecond: totalRequests / 60, // Approximate RPS over last minute
      averageResponseTime:
        totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      activeConnections: 0, // Would need to track active HTTP connections
    };
  }

  /**
   * Get disk usage statistics
   */
  private async getDiskUsage(): Promise<{
    used: number;
    total: number;
    free: number;
    utilization: number;
  }> {
    try {
      const fs = require('fs');
      const stats = await fs.promises.statfs(process.cwd());

      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const utilization = (used / total) * 100;

      return { used, total, free, utilization };
    } catch {
      return { used: 0, total: 0, free: 0, utilization: 0 };
    }
  }

  /**
   * Get basic network statistics
   */
  private async getNetworkStats(): Promise<{
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  }> {
    // This would typically integrate with system network monitoring
    // For now, return basic placeholder values
    return {
      bytesIn: 0,
      bytesOut: 0,
      connectionsActive: 0,
    };
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    if (this.metrics.length === 0) return;

    const latestMetrics = this.metrics[this.metrics.length - 1];
    const newAlerts: PerformanceAlert[] = [];

    // CPU alerts
    if (latestMetrics.cpu.usage > this.thresholds.cpu.critical) {
      newAlerts.push(
        this.createAlert(
          'cpu',
          'critical',
          `CPU usage is critically high: ${latestMetrics.cpu.usage.toFixed(1)}%`,
          latestMetrics.cpu.usage,
          this.thresholds.cpu.critical
        )
      );
    } else if (latestMetrics.cpu.usage > this.thresholds.cpu.warning) {
      newAlerts.push(
        this.createAlert(
          'cpu',
          'medium',
          `CPU usage is high: ${latestMetrics.cpu.usage.toFixed(1)}%`,
          latestMetrics.cpu.usage,
          this.thresholds.cpu.warning
        )
      );
    }

    // Memory alerts
    if (latestMetrics.memory.utilization > this.thresholds.memory.critical) {
      newAlerts.push(
        this.createAlert(
          'memory',
          'critical',
          `Memory utilization is critically high: ${latestMetrics.memory.utilization.toFixed(1)}%`,
          latestMetrics.memory.utilization,
          this.thresholds.memory.critical
        )
      );
    } else if (
      latestMetrics.memory.utilization > this.thresholds.memory.warning
    ) {
      newAlerts.push(
        this.createAlert(
          'memory',
          'medium',
          `Memory utilization is high: ${latestMetrics.memory.utilization.toFixed(1)}%`,
          latestMetrics.memory.utilization,
          this.thresholds.memory.warning
        )
      );
    }

    // Database alerts
    if (
      latestMetrics.database.poolUtilization >
      this.thresholds.database.connectionUtilization.critical
    ) {
      newAlerts.push(
        this.createAlert(
          'database',
          'critical',
          `Database connection pool utilization is critically high: ${latestMetrics.database.poolUtilization.toFixed(1)}%`,
          latestMetrics.database.poolUtilization,
          this.thresholds.database.connectionUtilization.critical
        )
      );
    }

    if (
      latestMetrics.database.averageQueryTime >
      this.thresholds.database.queryTime.critical
    ) {
      newAlerts.push(
        this.createAlert(
          'database',
          'critical',
          `Database query time is critically high: ${latestMetrics.database.averageQueryTime.toFixed(0)}ms`,
          latestMetrics.database.averageQueryTime,
          this.thresholds.database.queryTime.critical
        )
      );
    }

    // API alerts
    if (
      latestMetrics.api.averageResponseTime >
      this.thresholds.api.responseTime.critical
    ) {
      newAlerts.push(
        this.createAlert(
          'api',
          'critical',
          `API response time is critically high: ${latestMetrics.api.averageResponseTime.toFixed(0)}ms`,
          latestMetrics.api.averageResponseTime,
          this.thresholds.api.responseTime.critical
        )
      );
    }

    if (latestMetrics.api.errorRate > this.thresholds.api.errorRate.critical) {
      newAlerts.push(
        this.createAlert(
          'api',
          'critical',
          `API error rate is critically high: ${latestMetrics.api.errorRate.toFixed(1)}%`,
          latestMetrics.api.errorRate,
          this.thresholds.api.errorRate.critical
        )
      );
    }

    // Disk alerts
    if (
      latestMetrics.disk.utilization > this.thresholds.disk.utilization.critical
    ) {
      newAlerts.push(
        this.createAlert(
          'disk',
          'critical',
          `Disk utilization is critically high: ${latestMetrics.disk.utilization.toFixed(1)}%`,
          latestMetrics.disk.utilization,
          this.thresholds.disk.utilization.critical
        )
      );
    }

    // Add new alerts and emit events
    newAlerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert', alert);
    });

    // Clean up old alerts (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
    };
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit: number = 100): SystemMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Performance alert resolved', { alertId, alert });
      return true;
    }
    return false;
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated', {
      thresholds: this.thresholds,
    });
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: SystemMetrics | null;
    alerts: {
      active: number;
      critical: number;
      total: number;
    };
    trends: {
      cpuTrend: 'increasing' | 'decreasing' | 'stable';
      memoryTrend: 'increasing' | 'decreasing' | 'stable';
      responseTrend: 'increasing' | 'decreasing' | 'stable';
    };
    recommendations: string[];
  } {
    const current = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    // Calculate trends (simplified)
    const trends = this.calculateTrends();

    // Generate recommendations
    const recommendations = this.generateRecommendations(current, activeAlerts);

    return {
      current,
      alerts: {
        active: activeAlerts.length,
        critical: criticalAlerts.length,
        total: this.alerts.length,
      },
      trends,
      recommendations,
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): {
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    responseTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.metrics.length < 10) {
      return {
        cpuTrend: 'stable',
        memoryTrend: 'stable',
        responseTrend: 'stable',
      };
    }

    const recent = this.metrics.slice(-10);
    const older = this.metrics.slice(-20, -10);

    const avgRecentCpu =
      recent.reduce((sum, m) => sum + m.cpu.usage, 0) / recent.length;
    const avgOlderCpu =
      older.reduce((sum, m) => sum + m.cpu.usage, 0) / older.length;

    const avgRecentMemory =
      recent.reduce((sum, m) => sum + m.memory.utilization, 0) / recent.length;
    const avgOlderMemory =
      older.reduce((sum, m) => sum + m.memory.utilization, 0) / older.length;

    const avgRecentResponse =
      recent.reduce((sum, m) => sum + m.api.averageResponseTime, 0) /
      recent.length;
    const avgOlderResponse =
      older.reduce((sum, m) => sum + m.api.averageResponseTime, 0) /
      older.length;

    return {
      cpuTrend: this.getTrend(avgRecentCpu, avgOlderCpu),
      memoryTrend: this.getTrend(avgRecentMemory, avgOlderMemory),
      responseTrend: this.getTrend(avgRecentResponse, avgOlderResponse),
    };
  }

  /**
   * Determine trend direction
   */
  private getTrend(
    recent: number,
    older: number
  ): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.05; // 5% threshold for stability
    const change = (recent - older) / older;

    if (change > threshold) return 'increasing';
    if (change < -threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    current: SystemMetrics | null,
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];

    if (!current) return recommendations;

    // CPU recommendations
    if (current.cpu.usage > 80) {
      recommendations.push(
        'High CPU usage detected. Consider optimizing CPU-intensive operations or scaling horizontally.'
      );
    }

    // Memory recommendations
    if (current.memory.utilization > 85) {
      recommendations.push(
        'High memory usage detected. Consider optimizing memory usage or increasing available memory.'
      );
    }

    // Database recommendations
    if (current.database.poolUtilization > 80) {
      recommendations.push(
        'Database connection pool utilization is high. Consider optimizing queries or increasing pool size.'
      );
    }

    if (current.database.averageQueryTime > 500) {
      recommendations.push(
        'Database queries are slow. Consider adding indexes or optimizing query performance.'
      );
    }

    // API recommendations
    if (current.api.averageResponseTime > 1000) {
      recommendations.push(
        'API response times are high. Consider adding caching or optimizing endpoint performance.'
      );
    }

    if (current.api.errorRate > 5) {
      recommendations.push(
        'API error rate is high. Review error handling and input validation.'
      );
    }

    // Critical alert recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push(
        `${criticalAlerts.length} critical performance alerts require immediate attention.`
      );
    }

    return recommendations;
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    const current = this.getCurrentMetrics();
    if (!current) return '';

    if (format === 'prometheus') {
      return this.formatPrometheusMetrics(current);
    }

    return JSON.stringify(current, null, 2);
  }

  /**
   * Format metrics for Prometheus
   */
  private formatPrometheusMetrics(metrics: SystemMetrics): string {
    const timestamp = metrics.timestamp.getTime();

    return `
# HELP system_cpu_usage CPU usage percentage
# TYPE system_cpu_usage gauge
system_cpu_usage ${metrics.cpu.usage} ${timestamp}

# HELP system_memory_utilization Memory utilization percentage
# TYPE system_memory_utilization gauge
system_memory_utilization ${metrics.memory.utilization} ${timestamp}

# HELP database_pool_utilization Database connection pool utilization percentage
# TYPE database_pool_utilization gauge
database_pool_utilization ${metrics.database.poolUtilization} ${timestamp}

# HELP api_response_time_avg Average API response time in milliseconds
# TYPE api_response_time_avg gauge
api_response_time_avg ${metrics.api.averageResponseTime} ${timestamp}

# HELP api_error_rate API error rate percentage
# TYPE api_error_rate gauge
api_error_rate ${metrics.api.errorRate} ${timestamp}
    `.trim();
  }
}

export const performanceMonitor = new PerformanceMonitor();
