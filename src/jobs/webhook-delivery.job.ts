import { Injectable } from '../application/decorators/injectable';
import { WebhookDeliveryService } from '../domains/webhook/services/webhook-delivery.service';
import { Logger } from '../infrastructure/logging/logger';

export interface WebhookDeliveryJobConfig {
  batchSize: number;
  maxProcessingTime: number; // milliseconds
  retryInterval: number; // milliseconds
  enabled: boolean;
}

@Injectable()
export class WebhookDeliveryJob {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly logger: Logger,
    private readonly config: WebhookDeliveryJobConfig = {
      batchSize: 50,
      maxProcessingTime: 30000, // 30 seconds
      retryInterval: 5000, // 5 seconds
      enabled: true,
    }
  ) {}

  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting webhook delivery job', {
      batchSize: this.config.batchSize,
      retryInterval: this.config.retryInterval,
    });

    this.intervalId = setInterval(
      () => this.processDeliveries(),
      this.config.retryInterval
    );
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.logger.info('Stopped webhook delivery job');
  }

  async processDeliveries(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.debug('Processing webhook deliveries', {
        batchSize: this.config.batchSize,
      });

      const startTime = Date.now();

      // Process pending deliveries
      const pendingResult =
        await this.webhookDeliveryService.processPendingDeliveries(
          this.config.batchSize,
          this.config.maxProcessingTime
        );

      // Process retry queue
      const retryResult = await this.webhookDeliveryService.processRetryQueue(
        this.config.batchSize
      );

      // Process scheduled deliveries
      const scheduledResult =
        await this.webhookDeliveryService.processScheduledDeliveries(
          this.config.batchSize
        );

      const processingTime = Date.now() - startTime;

      const totalProcessed =
        pendingResult.processed +
        retryResult.processed +
        scheduledResult.processed;

      const totalSuccessful =
        pendingResult.successful +
        retryResult.successful +
        scheduledResult.successful;

      const totalFailed =
        pendingResult.failed + retryResult.failed + scheduledResult.failed;

      if (totalProcessed > 0) {
        this.logger.info('Webhook delivery job completed', {
          totalProcessed,
          totalSuccessful,
          totalFailed,
          processingTime,
          pending: pendingResult,
          retry: retryResult,
          scheduled: scheduledResult,
        });
      } else {
        this.logger.debug('No webhook deliveries to process');
      }

      // Update job metrics
      this.updateMetrics({
        totalProcessed,
        totalSuccessful,
        totalFailed,
        processingTime,
      });
    } catch (error) {
      this.logger.error('Webhook delivery job failed', {
        error: error.message,
        stack: error.stack,
      });

      // Implement exponential backoff on errors
      await this.handleJobError(error);
    }
  }

  async processSpecificWebhook(webhookId: string): Promise<void> {
    try {
      this.logger.info('Processing deliveries for specific webhook', {
        webhookId,
      });

      // This would require additional methods in the delivery service
      // For now, we'll process all pending deliveries
      const result = await this.webhookDeliveryService.processPendingDeliveries(
        this.config.batchSize
      );

      this.logger.info('Specific webhook processing completed', {
        webhookId,
        result,
      });
    } catch (error) {
      this.logger.error('Failed to process specific webhook', {
        webhookId,
        error: error.message,
      });
      throw error;
    }
  }

  async getJobStatus(): Promise<{
    isRunning: boolean;
    config: WebhookDeliveryJobConfig;
    metrics: {
      totalProcessed: number;
      totalSuccessful: number;
      totalFailed: number;
      averageProcessingTime: number;
      lastRunAt?: Date;
      nextRunAt?: Date;
    };
    queueStatus: {
      pendingDeliveries: number;
      scheduledDeliveries: number;
      failedDeliveries: number;
      oldestPendingDelivery?: Date;
      averageProcessingTime: number;
      queueHealth: 'healthy' | 'degraded' | 'critical';
    };
  }> {
    const queueStatus = await this.webhookDeliveryService.getQueueStatus();

    return {
      isRunning: this.isRunning,
      config: this.config,
      metrics: {
        totalProcessed: this.metrics.totalProcessed,
        totalSuccessful: this.metrics.totalSuccessful,
        totalFailed: this.metrics.totalFailed,
        averageProcessingTime: this.metrics.averageProcessingTime,
        lastRunAt: this.metrics.lastRunAt,
        nextRunAt: this.getNextRunTime(),
      },
      queueStatus,
    };
  }

  updateConfig(updates: Partial<WebhookDeliveryJobConfig>): void {
    Object.assign(this.config, updates);

    this.logger.info('Updated webhook delivery job config', {
      updates,
      newConfig: this.config,
    });

    // Restart job if interval changed
    if (updates.retryInterval && this.isRunning) {
      this.stop();
      this.start();
    }
  }

  // Health check for monitoring
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if job is running when it should be
      if (this.config.enabled && !this.isRunning) {
        issues.push('Job is enabled but not running');
        recommendations.push('Start the webhook delivery job');
      }

      // Check queue status
      const queueStatus = await this.webhookDeliveryService.getQueueStatus();

      if (queueStatus.queueHealth === 'critical') {
        issues.push('Webhook delivery queue is in critical state');
        recommendations.push(
          'Investigate queue issues and increase processing capacity'
        );
      } else if (queueStatus.queueHealth === 'degraded') {
        issues.push('Webhook delivery queue is degraded');
        recommendations.push(
          'Monitor queue performance and consider optimization'
        );
      }

      // Check for old pending deliveries
      if (queueStatus.oldestPendingDelivery) {
        const age = Date.now() - queueStatus.oldestPendingDelivery.getTime();
        const maxAge = 60 * 60 * 1000; // 1 hour

        if (age > maxAge) {
          issues.push('Old pending deliveries detected');
          recommendations.push('Investigate delivery processing delays');
        }
      }

      // Check processing performance
      if (queueStatus.averageProcessingTime > this.config.maxProcessingTime) {
        issues.push('Processing time exceeds configured maximum');
        recommendations.push(
          'Optimize delivery processing or increase timeout'
        );
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error.message}`],
        recommendations: ['Investigate webhook delivery service issues'],
      };
    }
  }

  // Private methods
  private metrics = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    lastRunAt: undefined as Date | undefined,
    runCount: 0,
    totalProcessingTime: 0,
  };

  private updateMetrics(result: {
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    processingTime: number;
  }): void {
    this.metrics.totalProcessed += result.totalProcessed;
    this.metrics.totalSuccessful += result.totalSuccessful;
    this.metrics.totalFailed += result.totalFailed;
    this.metrics.lastRunAt = new Date();
    this.metrics.runCount += 1;
    this.metrics.totalProcessingTime += result.processingTime;
    this.metrics.averageProcessingTime =
      this.metrics.totalProcessingTime / this.metrics.runCount;
  }

  private getNextRunTime(): Date | undefined {
    if (!this.isRunning) {
      return undefined;
    }

    return new Date(Date.now() + this.config.retryInterval);
  }

  private async handleJobError(error: Error): Promise<void> {
    // Implement exponential backoff
    const backoffDelay = Math.min(
      this.config.retryInterval * 2,
      60000 // Max 1 minute
    );

    this.logger.warn('Implementing backoff due to job error', {
      backoffDelay,
      error: error.message,
    });

    // Temporarily increase retry interval
    const originalInterval = this.config.retryInterval;
    this.config.retryInterval = backoffDelay;

    // Reset after some time
    setTimeout(() => {
      this.config.retryInterval = originalInterval;
      this.logger.info('Reset retry interval after backoff', {
        interval: originalInterval,
      });
    }, backoffDelay * 3);
  }
}

// Job factory for dependency injection
@Injectable()
export class WebhookDeliveryJobFactory {
  constructor(
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly logger: Logger
  ) {}

  create(config?: Partial<WebhookDeliveryJobConfig>): WebhookDeliveryJob {
    return new WebhookDeliveryJob(
      this.webhookDeliveryService,
      this.logger,
      config
    );
  }
}

// Job manager for multiple job instances
@Injectable()
export class WebhookDeliveryJobManager {
  private jobs = new Map<string, WebhookDeliveryJob>();

  constructor(
    private readonly jobFactory: WebhookDeliveryJobFactory,
    private readonly logger: Logger
  ) {}

  startJob(
    jobId: string = 'default',
    config?: Partial<WebhookDeliveryJobConfig>
  ): void {
    if (this.jobs.has(jobId)) {
      this.logger.warn('Job already exists', { jobId });
      return;
    }

    const job = this.jobFactory.create(config);
    this.jobs.set(jobId, job);
    job.start();

    this.logger.info('Started webhook delivery job', { jobId });
  }

  stopJob(jobId: string = 'default'): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.logger.warn('Job not found', { jobId });
      return;
    }

    job.stop();
    this.jobs.delete(jobId);

    this.logger.info('Stopped webhook delivery job', { jobId });
  }

  stopAllJobs(): void {
    for (const [jobId, job] of this.jobs.entries()) {
      job.stop();
      this.logger.info('Stopped webhook delivery job', { jobId });
    }
    this.jobs.clear();
  }

  getJob(jobId: string = 'default'): WebhookDeliveryJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): Map<string, WebhookDeliveryJob> {
    return new Map(this.jobs);
  }

  async getJobStatuses(): Promise<Record<string, any>> {
    const statuses: Record<string, any> = {};

    for (const [jobId, job] of this.jobs.entries()) {
      try {
        statuses[jobId] = await job.getJobStatus();
      } catch (error) {
        statuses[jobId] = {
          error: error.message,
          healthy: false,
        };
      }
    }

    return statuses;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    jobCount: number;
    healthyJobs: number;
    unhealthyJobs: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let healthyJobs = 0;
    let unhealthyJobs = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      try {
        const health = await job.healthCheck();
        if (health.healthy) {
          healthyJobs++;
        } else {
          unhealthyJobs++;
          issues.push(`Job ${jobId}: ${health.issues.join(', ')}`);
        }
      } catch (error) {
        unhealthyJobs++;
        issues.push(`Job ${jobId}: Health check failed - ${error.message}`);
      }
    }

    return {
      healthy: unhealthyJobs === 0,
      jobCount: this.jobs.size,
      healthyJobs,
      unhealthyJobs,
      issues,
    };
  }
}
