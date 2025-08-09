import { EventEmitter } from 'events';
import { Logger } from '../monitoring/logging-service';
import { JobDefinition, JobResult, JobExecution, JobConfig } from './job-types';
import { JobStatus, JobType } from '../../shared/enums/common.enums';

export class JobQueue extends EventEmitter {
  private jobs = new Map<string, JobExecution>();
  private queue: string[] = [];
  private processing = new Set<string>();
  private completed = new Map<string, JobResult>();
  private failed = new Map<string, JobResult>();
  private paused = false;
  private nextJobId = 1;

  constructor(
    private logger: Logger,
    private config: JobConfig
  ) {
    super();
  }

  /**
   * Start the job queue
   */
  async start(): Promise<void> {
    this.logger.info('Starting job queue');
    this.paused = false;
  }

  /**
   * Stop the job queue
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping job queue');
    this.paused = true;

    // Wait for processing jobs to complete
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processing.size > 0 && Date.now() - startTime < maxWait) {
      await this.sleep(100);
    }

    if (this.processing.size > 0) {
      this.logger.warn('Force stopping queue with jobs still processing', {
        processingJobs: this.processing.size,
      });
    }
  }

  /**
   * Add a job to the queue
   */
  async add(job: JobDefinition): Promise<string> {
    const executionId = this.generateExecutionId();

    const execution: JobExecution = {
      id: executionId,
      jobId: job.id,
      status: JobStatus.PENDING,
      startedAt: new Date(),
      retryCount: 0,
      ...job,
    };

    this.jobs.set(executionId, execution);

    // Handle different job types
    switch (job.type) {
      case JobType.IMMEDIATE:
        this.queue.unshift(executionId); // High priority
        break;
      case JobType.SCHEDULED:
        if (job.delay) {
          execution.nextRetryAt = new Date(Date.now() + job.delay);
        }
        this.insertByPriority(executionId, job.priority || 0);
        break;
      case JobType.RECURRING:
        // Recurring jobs are handled by the scheduler
        this.insertByPriority(executionId, job.priority || 0);
        break;
      default:
        this.insertByPriority(executionId, job.priority || 0);
    }

    this.logger.debug('Job added to queue', {
      executionId,
      jobId: job.id,
      jobName: job.name,
      type: job.type,
      queueSize: this.queue.length,
    });

    return executionId;
  }

  /**
   * Get the next job to process
   */
  async next(): Promise<JobExecution | null> {
    if (this.paused || this.queue.length === 0) {
      return null;
    }

    // Check for scheduled jobs that are ready
    const now = new Date();
    for (let i = 0; i < this.queue.length; i++) {
      const executionId = this.queue[i];
      const job = this.jobs.get(executionId);

      if (!job) {
        this.queue.splice(i, 1);
        i--;
        continue;
      }

      // Check if scheduled job is ready
      if (job.nextRetryAt && job.nextRetryAt > now) {
        continue;
      }

      // Remove from queue and mark as processing
      this.queue.splice(i, 1);
      this.processing.add(executionId);

      job.status = JobStatus.RUNNING;
      job.startedAt = new Date();

      return job;
    }

    return null;
  }

  /**
   * Mark job as completed
   */
  async complete(
    executionId: string,
    result: any,
    executionTime: number
  ): Promise<void> {
    const job = this.jobs.get(executionId);
    if (!job) {
      this.logger.warn('Attempted to complete non-existent job', {
        executionId,
      });
      return;
    }

    this.processing.delete(executionId);

    const jobResult: JobResult = {
      jobId: job.jobId,
      success: true,
      status: JobStatus.COMPLETED,
      result,
      executionTime,
      retryCount: job.retryCount,
      completedAt: new Date(),
    };

    this.completed.set(executionId, jobResult);
    this.jobs.delete(executionId);

    this.emit('job.completed', executionId, result);

    this.logger.debug('Job completed', {
      executionId,
      jobId: job.jobId,
      executionTime,
    });
  }

  /**
   * Mark job as failed
   */
  async fail(
    executionId: string,
    error: string,
    executionTime: number
  ): Promise<void> {
    const job = this.jobs.get(executionId);
    if (!job) {
      this.logger.warn('Attempted to fail non-existent job', { executionId });
      return;
    }

    this.processing.delete(executionId);

    const jobResult: JobResult = {
      jobId: job.jobId,
      success: false,
      status: JobStatus.FAILED,
      error,
      executionTime,
      retryCount: job.retryCount,
      completedAt: new Date(),
    };

    this.failed.set(executionId, jobResult);

    // Don't delete job yet if it can be retried
    if (job.retryCount < (job.maxRetries || this.config.maxRetries)) {
      job.status = JobStatus.PENDING;
    } else {
      this.jobs.delete(executionId);
    }

    this.emit('job.failed', executionId, error);

    this.logger.debug('Job failed', {
      executionId,
      jobId: job.jobId,
      error,
      retryCount: job.retryCount,
    });
  }

  /**
   * Retry a failed job
   */
  async retry(executionId: string, delay: number): Promise<void> {
    const job = this.jobs.get(executionId);
    if (!job) {
      this.logger.warn('Attempted to retry non-existent job', { executionId });
      return;
    }

    job.retryCount++;
    job.status = JobStatus.PENDING;
    job.nextRetryAt = new Date(Date.now() + delay);

    // Add back to queue
    this.insertByPriority(executionId, job.priority || 0);

    this.emit('job.retrying', executionId, job.retryCount);

    this.logger.debug('Job scheduled for retry', {
      executionId,
      jobId: job.jobId,
      retryCount: job.retryCount,
      retryAt: job.nextRetryAt,
    });
  }

  /**
   * Cancel a job
   */
  async cancel(executionId: string): Promise<boolean> {
    const job = this.jobs.get(executionId);
    if (!job) {
      return false;
    }

    // Remove from queue if not processing
    if (!this.processing.has(executionId)) {
      const queueIndex = this.queue.indexOf(executionId);
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1);
      }

      this.jobs.delete(executionId);

      this.emit('job.cancelled', executionId);

      this.logger.debug('Job cancelled', {
        executionId,
        jobId: job.jobId,
      });

      return true;
    }

    // Cannot cancel processing jobs
    return false;
  }

  /**
   * Get job status
   */
  async getJobStatus(executionId: string): Promise<JobResult | null> {
    // Check completed jobs
    const completed = this.completed.get(executionId);
    if (completed) {
      return completed;
    }

    // Check failed jobs
    const failed = this.failed.get(executionId);
    if (failed) {
      return failed;
    }

    // Check active jobs
    const job = this.jobs.get(executionId);
    if (job) {
      return {
        jobId: job.jobId,
        success: false,
        status: job.status,
        executionTime: job.startedAt ? Date.now() - job.startedAt.getTime() : 0,
        retryCount: job.retryCount,
        completedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    return this.queue.length;
  }

  /**
   * Get processing count
   */
  async processing(): Promise<number> {
    return this.processing.size;
  }

  /**
   * Get completed count
   */
  async completed(): Promise<number> {
    return this.completed.size;
  }

  /**
   * Get failed count
   */
  async failed(): Promise<number> {
    return this.failed.size;
  }

  /**
   * Check if queue is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    this.paused = true;
    this.logger.info('Job queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    this.paused = false;
    this.logger.info('Job queue resumed');
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(maxHistory: number): Promise<number> {
    let cleaned = 0;

    // Clean up completed jobs
    if (this.completed.size > maxHistory) {
      const toDelete = this.completed.size - maxHistory;
      const entries = Array.from(this.completed.entries());

      // Sort by completion time and delete oldest
      entries.sort(
        (a, b) => a[1].completedAt.getTime() - b[1].completedAt.getTime()
      );

      for (let i = 0; i < toDelete; i++) {
        this.completed.delete(entries[i][0]);
        cleaned++;
      }
    }

    // Clean up failed jobs
    if (this.failed.size > maxHistory) {
      const toDelete = this.failed.size - maxHistory;
      const entries = Array.from(this.failed.entries());

      entries.sort(
        (a, b) => a[1].completedAt.getTime() - b[1].completedAt.getTime()
      );

      for (let i = 0; i < toDelete; i++) {
        this.failed.delete(entries[i][0]);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned up old job records', {
        cleaned,
        completedJobs: this.completed.size,
        failedJobs: this.failed.size,
      });
    }

    return cleaned;
  }

  /**
   * Get all job statistics
   */
  getStats(): {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      total: this.jobs.size + this.completed.size + this.failed.size,
    };
  }

  /**
   * Insert job by priority
   */
  private insertByPriority(executionId: string, priority: number): void {
    let insertIndex = this.queue.length;

    // Find insertion point based on priority (higher priority = lower number)
    for (let i = 0; i < this.queue.length; i++) {
      const existingJob = this.jobs.get(this.queue[i]);
      if (existingJob && (existingJob.priority || 0) > priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, executionId);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${this.nextJobId++}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
