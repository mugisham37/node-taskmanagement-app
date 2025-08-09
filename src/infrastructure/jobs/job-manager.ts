import { EventEmitter } from 'events';
import { Logger } from '../monitoring/logging-service';
import { JobScheduler } from './job-scheduler';
import { JobQueue } from './job-queue';
import { JobProcessor } from './job-processor';
import { JobRegistry } from './job-registry';
import { JobMonitoring } from './job-monitoring';
import {
  JobDefinition,
  JobResult,
  JobConfig,
  JobMetrics,
  JobHandler,
  JobEvent,
  JobEventType,
} from './job-types';
import { JobStatus, JobType } from '../../shared/enums/common.enums';

export class JobManager extends EventEmitter {
  private scheduler: JobScheduler;
  private queue: JobQueue;
  private processor: JobProcessor;
  private registry: JobRegistry;
  private monitoring: JobMonitoring;
  private isRunning = false;
  private config: JobConfig;

  constructor(
    private logger: Logger,
    config: Partial<JobConfig> = {}
  ) {
    super();

    this.config = {
      enabled: true,
      concurrency: 5,
      retryDelay: 5000,
      maxRetries: 3,
      timeout: 30000,
      cleanupInterval: 300000, // 5 minutes
      maxJobHistory: 1000,
      ...config,
    };

    this.registry = new JobRegistry(logger);
    this.queue = new JobQueue(logger, this.config);
    this.scheduler = new JobScheduler(logger, this.config);
    this.processor = new JobProcessor(logger, this.config, this.registry);
    this.monitoring = new JobMonitoring(logger, this.config);

    this.setupEventHandlers();
  }

  /**
   * Start the job manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Job manager is already running');
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('Job manager is disabled');
      return;
    }

    try {
      this.logger.info('Starting job manager...', {
        config: this.config,
      });

      await this.queue.start();
      await this.scheduler.start();
      await this.processor.start();
      await this.monitoring.start();

      this.isRunning = true;
      this.emit('manager.started');

      this.logger.info('Job manager started successfully', {
        registeredHandlers: this.registry.getHandlerNames(),
        queueSize: await this.queue.size(),
      });

      // Start processing jobs
      this.processJobs();
    } catch (error) {
      this.logger.error('Failed to start job manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the job manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Job manager is not running');
      return;
    }

    try {
      this.logger.info('Stopping job manager...');

      this.isRunning = false;

      await this.processor.stop();
      await this.scheduler.stop();
      await this.queue.stop();
      await this.monitoring.stop();

      this.emit('manager.stopped');
      this.logger.info('Job manager stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping job manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Register a job handler
   */
  registerHandler(handler: JobHandler): void {
    this.registry.register(handler);
    this.logger.info('Job handler registered', {
      handlerName: handler.name,
    });
  }

  /**
   * Unregister a job handler
   */
  unregisterHandler(name: string): void {
    this.registry.unregister(name);
    this.logger.info('Job handler unregistered', {
      handlerName: name,
    });
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: JobDefinition): Promise<string> {
    try {
      // Validate job definition
      this.validateJobDefinition(job);

      // Check if handler exists
      if (!this.registry.hasHandler(job.name)) {
        throw new Error(`No handler registered for job type: ${job.name}`);
      }

      const jobId = await this.queue.add(job);

      this.emitJobEvent('job.created', jobId, { job });

      this.logger.info('Job added to queue', {
        jobId,
        jobName: job.name,
        jobType: job.type,
        priority: job.priority,
      });

      return jobId;
    } catch (error) {
      this.logger.error('Failed to add job', {
        jobName: job.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Schedule a recurring job
   */
  async scheduleJob(
    job: JobDefinition,
    cronExpression: string
  ): Promise<string> {
    if (!cronExpression) {
      throw new Error('Cron expression is required for scheduled jobs');
    }

    job.type = JobType.RECURRING;
    job.cronExpression = cronExpression;

    const scheduleId = await this.scheduler.schedule(job, cronExpression);

    this.logger.info('Job scheduled', {
      scheduleId,
      jobName: job.name,
      cronExpression,
    });

    return scheduleId;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const cancelled = await this.queue.cancel(jobId);

      if (cancelled) {
        this.emitJobEvent('job.cancelled', jobId);
        this.logger.info('Job cancelled', { jobId });
      }

      return cancelled;
    } catch (error) {
      this.logger.error('Failed to cancel job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobResult | null> {
    return await this.queue.getJobStatus(jobId);
  }

  /**
   * Get job metrics
   */
  async getMetrics(): Promise<JobMetrics> {
    return await this.monitoring.getMetrics();
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    size: number;
    processing: number;
    completed: number;
    failed: number;
    paused: boolean;
  }> {
    return {
      size: await this.queue.size(),
      processing: await this.queue.processing(),
      completed: await this.queue.completed(),
      failed: await this.queue.failed(),
      paused: this.queue.isPaused(),
    };
  }

  /**
   * Pause job processing
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    this.emit('queue.paused');
    this.logger.info('Job processing paused');
  }

  /**
   * Resume job processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    this.emit('queue.resumed');
    this.logger.info('Job processing resumed');
  }

  /**
   * Clean up completed jobs
   */
  async cleanup(): Promise<number> {
    const cleaned = await this.queue.cleanup(this.config.maxJobHistory);

    this.logger.info('Job cleanup completed', {
      cleanedJobs: cleaned,
      maxHistory: this.config.maxJobHistory,
    });

    return cleaned;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: JobMetrics;
  }> {
    const issues: string[] = [];

    try {
      const metrics = await this.getMetrics();
      const queueStatus = await this.getQueueStatus();

      // Check if manager is running
      if (!this.isRunning) {
        issues.push('Job manager is not running');
      }

      // Check queue size
      if (queueStatus.size > 1000) {
        issues.push('Job queue size is too large');
      }

      // Check failure rate
      if (metrics.successRate < 0.9) {
        issues.push('Job success rate is below 90%');
      }

      // Check for stuck jobs
      if (queueStatus.processing > this.config.concurrency * 2) {
        issues.push('Too many jobs in processing state');
      }

      return {
        healthy: issues.length === 0,
        issues,
        metrics,
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [
          `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        metrics: await this.getMetrics(),
      };
    }
  }

  /**
   * Process jobs from the queue
   */
  private async processJobs(): Promise<void> {
    while (this.isRunning) {
      try {
        if (this.queue.isPaused()) {
          await this.sleep(1000);
          continue;
        }

        const job = await this.queue.next();
        if (!job) {
          await this.sleep(1000);
          continue;
        }

        // Process job in background
        this.processJob(job).catch(error => {
          this.logger.error('Unhandled error in job processing', {
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      } catch (error) {
        this.logger.error('Error in job processing loop', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await this.sleep(5000); // Wait before retrying
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: any): Promise<void> {
    const startTime = Date.now();

    try {
      this.emitJobEvent('job.started', job.id);

      const result = await this.processor.process(job);

      const executionTime = Date.now() - startTime;

      await this.queue.complete(job.id, result, executionTime);

      this.emitJobEvent('job.completed', job.id, {
        result,
        executionTime,
      });

      this.logger.debug('Job completed successfully', {
        jobId: job.id,
        jobName: job.name,
        executionTime,
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.queue.fail(job.id, errorMessage, executionTime);

      this.emitJobEvent('job.failed', job.id, {
        error: errorMessage,
        executionTime,
      });

      this.logger.error('Job failed', {
        jobId: job.id,
        jobName: job.name,
        error: errorMessage,
        executionTime,
      });

      // Check if job should be retried
      if (job.retryCount < (job.maxRetries || this.config.maxRetries)) {
        const retryDelay = this.calculateRetryDelay(job.retryCount);
        await this.queue.retry(job.id, retryDelay);

        this.emitJobEvent('job.retrying', job.id, {
          retryCount: job.retryCount + 1,
          retryDelay,
        });
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    return Math.min(
      this.config.retryDelay * Math.pow(2, retryCount),
      300000 // Max 5 minutes
    );
  }

  /**
   * Validate job definition
   */
  private validateJobDefinition(job: JobDefinition): void {
    if (!job.id) {
      throw new Error('Job ID is required');
    }
    if (!job.name) {
      throw new Error('Job name is required');
    }
    if (!job.type) {
      throw new Error('Job type is required');
    }
    if (!job.payload) {
      job.payload = {};
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.queue.on('job.completed', (jobId: string, result: any) => {
      this.monitoring.recordJobCompletion(jobId, true, Date.now());
    });

    this.queue.on('job.failed', (jobId: string, error: string) => {
      this.monitoring.recordJobCompletion(jobId, false, Date.now());
    });

    this.scheduler.on('job.scheduled', (job: JobDefinition) => {
      this.addJob(job).catch(error => {
        this.logger.error('Failed to add scheduled job', {
          jobName: job.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    });
  }

  /**
   * Emit job event
   */
  private emitJobEvent(
    type: JobEventType,
    jobId: string,
    data?: Record<string, any>
  ): void {
    const event: JobEvent = {
      type,
      jobId,
      timestamp: new Date(),
      data,
    };

    this.emit(type, event);
    this.monitoring.recordEvent(event);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
