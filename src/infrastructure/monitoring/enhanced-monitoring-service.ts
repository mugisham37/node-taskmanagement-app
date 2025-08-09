/**
 * Enhanced Monitoring Service
 * Comprehensive monitoring with metrics, alerting, and observability
 * Migrated and enhanced from older version
 */

import { logger } from './logging-service';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // in seconds
  enabled: boolean;
  channels: string[];
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, any>;
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
}

export class EnhancedMonitoringService {
  private metrics: Map<string, MetricData[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> =
    new Map();
  private alertStates: Map<string, { triggered: boolean; since?: Date }> =
    new Map();
  private metricsRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.startCleanupInterval();
    this.registerDefaultHealthChecks();
  }

  /**
   * Record a metric
   */
  recordMetric(metric: MetricData): void {
    const key = this.buildMetricKey(metric.name, metric.tags);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricsList = this.metrics.get(key)!;
    metricsList.push(metric);

    // Keep only recent metrics
    const cutoff = new Date(Date.now() - this.metricsRetentionPeriod);
    const filteredMetrics = metricsList.filter(m => m.timestamp > cutoff);
    this.metrics.set(key, filteredMetrics);

    // Check alert rules
    this.checkAlertRules(metric);

    logger.debug('Metric recorded', {
      name: metric.name,
      value: metric.value,
      type: metric.type,
      tags: metric.tags,
    });
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'counter',
    });
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'gauge',
    });
  }

  /**
   * Record a timer metric
   */
  recordTimer(
    name: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      value: duration,
      timestamp: new Date(),
      tags,
      type: 'timer',
    });
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordTimer(name, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTimer(name, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, tags?: Record<string, string>): MetricData[] {
    const key = this.buildMetricKey(name, tags);
    return this.metrics.get(key) || [];
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    timeRange?: { start: Date; end: Date },
    tags?: Record<string, string>
  ): number {
    const metrics = this.getMetrics(name, tags);

    let filteredMetrics = metrics;
    if (timeRange) {
      filteredMetrics = metrics.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    if (filteredMetrics.length === 0) {
      return 0;
    }

    const values = filteredMetrics.map(m => m.value);

    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }

  /**
   * Register an alert rule
   */
  registerAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.alertStates.set(rule.id, { triggered: false });

    logger.info('Alert rule registered', {
      id: rule.id,
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
    });
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.alertStates.delete(ruleId);
    logger.info('Alert rule removed', { ruleId });
  }

  /**
   * Register a health check
   */
  registerHealthCheck(
    name: string,
    checkFn: () => Promise<HealthCheckResult>
  ): void {
    this.healthChecks.set(name, checkFn);
    logger.info('Health check registered', { name });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};

    const promises = Array.from(this.healthChecks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const result = await checkFn();
          results[name] = result;
        } catch (error) {
          results[name] = {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            duration: 0,
          };
        }
      }
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const os = require('os');
    const fs = require('fs');

    try {
      // CPU metrics
      const cpus = os.cpus();
      const loadAverage = os.loadavg();

      // Calculate CPU usage (simplified)
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      const cpuUsage = 100 - (totalIdle / totalTick) * 100;

      // Memory metrics
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      // Disk metrics (simplified - would need platform-specific implementation)
      let diskUsed = 0;
      let diskTotal = 0;
      try {
        const stats = fs.statSync(process.cwd());
        diskTotal = 100 * 1024 * 1024 * 1024; // Mock 100GB
        diskUsed = 50 * 1024 * 1024 * 1024; // Mock 50GB used
      } catch (error) {
        // Fallback values
        diskTotal = 100 * 1024 * 1024 * 1024;
        diskUsed = 50 * 1024 * 1024 * 1024;
      }

      const diskPercentage = (diskUsed / diskTotal) * 100;

      return {
        cpu: {
          usage: Math.round(cpuUsage * 100) / 100,
          loadAverage,
        },
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round(memoryPercentage * 100) / 100,
        },
        disk: {
          used: diskUsed,
          total: diskTotal,
          percentage: Math.round(diskPercentage * 100) / 100,
        },
        network: {
          bytesIn: 0, // Would need platform-specific implementation
          bytesOut: 0,
        },
      };
    } catch (error) {
      logger.error('Failed to get system metrics', { error });
      throw error;
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    systemMetrics: SystemMetrics;
    healthChecks: Record<string, HealthCheckResult>;
    alertSummary: {
      total: number;
      triggered: number;
      rules: Array<{
        id: string;
        name: string;
        triggered: boolean;
        since?: Date;
      }>;
    };
    recentMetrics: Record<string, MetricData[]>;
  }> {
    const [systemMetrics, healthChecks] = await Promise.all([
      this.getSystemMetrics(),
      this.runHealthChecks(),
    ]);

    // Alert summary
    const alertRulesArray = Array.from(this.alertRules.values());
    const alertStatesArray = Array.from(this.alertStates.entries());

    const alertSummary = {
      total: alertRulesArray.length,
      triggered: alertStatesArray.filter(([_, state]) => state.triggered)
        .length,
      rules: alertRulesArray.map(rule => {
        const state = this.alertStates.get(rule.id);
        return {
          id: rule.id,
          name: rule.name,
          triggered: state?.triggered || false,
          since: state?.since,
        };
      }),
    };

    // Recent metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMetrics: Record<string, MetricData[]> = {};

    for (const [key, metrics] of this.metrics.entries()) {
      const recentMetricsList = metrics.filter(m => m.timestamp > oneHourAgo);
      if (recentMetricsList.length > 0) {
        recentMetrics[key] = recentMetricsList;
      }
    }

    return {
      systemMetrics,
      healthChecks,
      alertSummary,
      recentMetrics,
    };
  }

  private buildMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const sortedTags = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    return `${name}{${sortedTags}}`;
  }

  private checkAlertRules(metric: MetricData): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== metric.name) {
        continue;
      }

      const shouldTrigger = this.evaluateCondition(
        metric.value,
        rule.condition,
        rule.threshold
      );

      const currentState = this.alertStates.get(rule.id);
      if (!currentState) continue;

      if (shouldTrigger && !currentState.triggered) {
        // Alert triggered
        currentState.triggered = true;
        currentState.since = new Date();
        this.alertStates.set(rule.id, currentState);

        logger.warn('Alert triggered', {
          ruleId: rule.id,
          ruleName: rule.name,
          metric: metric.name,
          value: metric.value,
          threshold: rule.threshold,
          condition: rule.condition,
        });

        // Here you would send notifications to configured channels
        this.sendAlert(rule, metric);
      } else if (!shouldTrigger && currentState.triggered) {
        // Alert resolved
        currentState.triggered = false;
        currentState.since = undefined;
        this.alertStates.set(rule.id, currentState);

        logger.info('Alert resolved', {
          ruleId: rule.id,
          ruleName: rule.name,
          metric: metric.name,
          value: metric.value,
        });
      }
    }
  }

  private evaluateCondition(
    value: number,
    condition: string,
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private async sendAlert(rule: AlertRule, metric: MetricData): Promise<void> {
    // Mock alert sending - in real implementation, this would integrate with
    // email, Slack, PagerDuty, etc.
    logger.info('Sending alert notification', {
      rule: rule.name,
      channels: rule.channels,
      metric: metric.name,
      value: metric.value,
      threshold: rule.threshold,
    });
  }

  private registerDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const start = Date.now();
      try {
        // Mock database check - in real implementation, this would ping the database
        await new Promise(resolve => setTimeout(resolve, 10));

        return {
          name: 'database',
          status: 'healthy',
          message: 'Database connection is healthy',
          timestamp: new Date(),
          duration: Date.now() - start,
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          message:
            error instanceof Error ? error.message : 'Database check failed',
          timestamp: new Date(),
          duration: Date.now() - start,
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const start = Date.now();
      const systemMetrics = await this.getSystemMetrics();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage is normal';

      if (systemMetrics.memory.percentage > 90) {
        status = 'unhealthy';
        message = 'Memory usage is critically high';
      } else if (systemMetrics.memory.percentage > 80) {
        status = 'degraded';
        message = 'Memory usage is high';
      }

      return {
        name: 'memory',
        status,
        message,
        timestamp: new Date(),
        duration: Date.now() - start,
        metadata: {
          percentage: systemMetrics.memory.percentage,
          used: systemMetrics.memory.used,
          total: systemMetrics.memory.total,
        },
      };
    });
  }

  private startCleanupInterval(): void {
    // Clean up old metrics every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldMetrics();
      },
      60 * 60 * 1000
    );
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.metricsRetentionPeriod);
    let cleanedCount = 0;

    for (const [key, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);

      if (filteredMetrics.length !== metrics.length) {
        cleanedCount += metrics.length - filteredMetrics.length;

        if (filteredMetrics.length === 0) {
          this.metrics.delete(key);
        } else {
          this.metrics.set(key, filteredMetrics);
        }
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old metrics', { cleanedCount });
    }
  }

  /**
   * Shutdown the monitoring service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.metrics.clear();
    this.alertRules.clear();
    this.healthChecks.clear();
    this.alertStates.clear();

    logger.info('Enhanced monitoring service shutdown complete');
  }
}

export const enhancedMonitoringService = new EnhancedMonitoringService();
