import { EventEmitter } from 'events';
import { LoggingService } from '../monitoring/logging-service';
import {
  JobMetrics,
  JobEvent,
  JobMonitoringConfig,
} from './job-types';

export class JobMonitoring extends EventEmitter {
  private metrics: JobMetrics = {
    totalJobs: 0,
    runningJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    queuedJobs: 0,
    averageExecutionTime: 0,
    successRate: 0,
  };

  private executionTimes: number[] = [];
  private events: JobEvent[] = [];
  private monitoringInterval?: NodeJS.Timeout | undefined;
  private alertThresholds: JobMonitoringConfig['alertThresholds'];

  constructor(
    private logger: LoggingService,
    private monitoringConfig: Partial<JobMonitoringConfig> = {}
  ) {
    super();

    this.alertThresholds = {
      failureRate: 0.1, // 10%
      queueSize: 1000,
      executionTime: 300000, // 5 minutes
      ...monitoringConfig.alertThresholds,
    };
  }

  /**
   * Start job monitoring
   */
  async start(): Promise<void> {
    this.logger.info('Starting job monitoring', {
      metricsInterval: this.monitoringConfig.metricsInterval || 60000,
      alertThresholds: this.alertThresholds,
    });

    // Start metrics collection interval
    this.monitoringInterval = setInterval(
      () => this.collectMetrics(),
      this.monitoringConfig.metricsInterval || 60000
    );
  }

  /**
   * Stop job monitoring
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping job monitoring');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Record job completion
   */
  recordJobCompletion(
    jobId: string,
    success: boolean,
    executionTime: number
  ): void {
    this.metrics.totalJobs++;

    if (success) {
      this.metrics.completedJobs++;
    } else {
      this.metrics.failedJobs++;
    }

    // Update execution times
    this.executionTimes.push(executionTime);

    // Keep only last 1000 execution times for average calculation
    if (this.executionTimes.length > 1000) {
      this.executionTimes = this.executionTimes.slice(-1000);
    }

    // Update average execution time
    this.metrics.averageExecutionTime =
      this.executionTimes.reduce((sum, time) => sum + time, 0) /
      this.executionTimes.length;

    // Update success rate
    this.metrics.successRate =
      this.metrics.completedJobs / this.metrics.totalJobs;

    // Check for alerts
    this.checkAlerts();

    this.logger.debug('Job completion recorded', {
      jobId,
      success,
      executionTime,
      totalJobs: this.metrics.totalJobs,
      successRate: this.metrics.successRate,
    });
  }

  /**
   * Record job event
   */
  recordEvent(event: JobEvent): void {
    this.events.push(event);

    // Keep only last 10000 events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    // Update running jobs count based on event type
    switch (event.type) {
      case 'job.started':
        this.metrics.runningJobs++;
        break;
      case 'job.completed':
      case 'job.failed':
      case 'job.cancelled':
        this.metrics.runningJobs = Math.max(0, this.metrics.runningJobs - 1);
        break;
    }

    this.emit('event.recorded', event);
  }

  /**
   * Update queued jobs count
   */
  updateQueuedJobs(count: number): void {
    this.metrics.queuedJobs = count;
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<JobMetrics> {
    const lastProcessedTime = this.getLastProcessedTime();
    const result: JobMetrics = {
      ...this.metrics,
    };
    
    if (lastProcessedTime) {
      result.lastProcessedAt = lastProcessedTime;
    }
    
    return result;
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): {
    metrics: JobMetrics;
    recentEvents: JobEvent[];
    executionTimeStats: {
      min: number;
      max: number;
      median: number;
      p95: number;
      p99: number;
    };
    hourlyStats: {
      hour: string;
      completed: number;
      failed: number;
      averageTime: number;
    }[];
  } {
    const executionTimeStats = this.calculateExecutionTimeStats();
    const hourlyStats = this.calculateHourlyStats();
    const recentEvents = this.events.slice(-100); // Last 100 events

    return {
      metrics: this.metrics,
      recentEvents,
      executionTimeStats,
      hourlyStats,
    };
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string, limit = 100): JobEvent[] {
    return this.events.filter(event => event.type === type).slice(-limit);
  }

  /**
   * Get events for specific job
   */
  getJobEvents(jobId: string, limit = 100): JobEvent[] {
    return this.events.filter(event => event.jobId === jobId).slice(-limit);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      queuedJobs: 0,
      averageExecutionTime: 0,
      successRate: 0,
    };

    this.executionTimes = [];
    this.events = [];

    this.logger.info('Job metrics reset');
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): Record<string, number> {
    return {
      'jobs.total': this.metrics.totalJobs,
      'jobs.running': this.metrics.runningJobs,
      'jobs.completed': this.metrics.completedJobs,
      'jobs.failed': this.metrics.failedJobs,
      'jobs.queued': this.metrics.queuedJobs,
      'jobs.success_rate': this.metrics.successRate,
      'jobs.average_execution_time': this.metrics.averageExecutionTime,
      'jobs.failure_rate': 1 - this.metrics.successRate,
    };
  }

  /**
   * Collect periodic metrics
   */
  private collectMetrics(): void {
    const metrics = this.exportMetrics();

    this.logger.debug('Periodic metrics collection', metrics);

    this.emit('metrics.collected', metrics);

    // Check for performance issues
    this.checkPerformanceAlerts(metrics);
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    const alerts: string[] = [];

    // Check failure rate
    if (this.metrics.successRate < 1 - this.alertThresholds.failureRate) {
      alerts.push(
        `High failure rate: ${((1 - this.metrics.successRate) * 100).toFixed(2)}%`
      );
    }

    // Check queue size
    if (this.metrics.queuedJobs > this.alertThresholds.queueSize) {
      alerts.push(`Large queue size: ${this.metrics.queuedJobs} jobs`);
    }

    // Check average execution time
    if (
      this.metrics.averageExecutionTime > this.alertThresholds.executionTime
    ) {
      alerts.push(
        `High execution time: ${(this.metrics.averageExecutionTime / 1000).toFixed(2)}s`
      );
    }

    // Emit alerts
    for (const alert of alerts) {
      this.emit('alert', {
        type: 'performance',
        message: alert,
        timestamp: new Date(),
        metrics: this.metrics,
      });

      this.logger.warn('Job performance alert', {
        alert,
        metrics: this.metrics,
      });
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: Record<string, number>): void {
    const alerts: string[] = [];

    // Check for stuck jobs (running too long)
    if (
      (metrics['jobs.running'] ?? 0) > 0 &&
      this.metrics.averageExecutionTime > 600000
    ) {
      // 10 minutes
      alerts.push('Jobs may be stuck - high average execution time');
    }

    // Check for queue backup
    if ((metrics['jobs.queued'] ?? 0) > (metrics['jobs.running'] ?? 0) * 10) {
      alerts.push(
        'Queue backup detected - jobs queuing faster than processing'
      );
    }

    // Emit performance alerts
    for (const alert of alerts) {
      this.emit('alert', {
        type: 'performance',
        message: alert,
        timestamp: new Date(),
        metrics,
      });
    }
  }

  /**
   * Calculate execution time statistics
   */
  private calculateExecutionTimeStats(): {
    min: number;
    max: number;
    median: number;
    p95: number;
    p99: number;
  } {
    if (this.executionTimes.length === 0) {
      return { min: 0, max: 0, median: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.executionTimes].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      min: sorted[0] ?? 0,
      max: sorted[len - 1] ?? 0,
      median: sorted[Math.floor(len / 2)] ?? 0,
      p95: sorted[Math.floor(len * 0.95)] ?? 0,
      p99: sorted[Math.floor(len * 0.99)] ?? 0,
    };
  }

  /**
   * Calculate hourly statistics
   */
  private calculateHourlyStats(): {
    hour: string;
    completed: number;
    failed: number;
    averageTime: number;
  }[] {
    const hourlyData = new Map<
      string,
      {
        completed: number;
        failed: number;
        totalTime: number;
        count: number;
      }
    >();

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Process events from last 24 hours
    this.events
      .filter(event => event.timestamp >= last24Hours)
      .forEach(event => {
        const hour = event.timestamp.toISOString().substr(0, 13) + ':00:00';

        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, {
            completed: 0,
            failed: 0,
            totalTime: 0,
            count: 0,
          });
        }

        const data = hourlyData.get(hour)!;

        if (event.type === 'job.completed') {
          data.completed++;
          if (event.data?.['executionTime']) {
            data.totalTime += event.data['executionTime'];
            data.count++;
          }
        } else if (event.type === 'job.failed') {
          data.failed++;
          if (event.data?.['executionTime']) {
            data.totalTime += event.data['executionTime'];
            data.count++;
          }
        }
      });

    return Array.from(hourlyData.entries()).map(([hour, data]) => ({
      hour,
      completed: data.completed,
      failed: data.failed,
      averageTime: data.count > 0 ? data.totalTime / data.count : 0,
    }));
  }

  /**
   * Get last processed time
   */
  private getLastProcessedTime(): Date | undefined {
    const lastCompletedEvent = this.events
      .filter(
        event => event.type === 'job.completed' || event.type === 'job.failed'
      )
      .slice(-1)[0];

    return lastCompletedEvent?.timestamp;
  }
}
