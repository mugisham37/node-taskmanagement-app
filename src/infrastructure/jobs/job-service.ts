import { Logger } from '../monitoring/logging-service';
import { JobManager } from './job-manager';
import { JobFactory } from './job-factory';
import { JobDefinition, JobResult, JobMetrics, JobConfig } from './job-types';
import { JobType } from '../../shared/enums/common.enums';

export class JobService {
  private jobManager: JobManager;
  private logger: Logger;
  private isInitialized = false;

  constructor(logger: Logger, config: Partial<JobConfig> = {}) {
    this.logger = logger;
    this.jobManager = JobFactory.getInstance().createJobManager(logger, config);
  }

  /**
   * Initialize the job service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Job service is already initialized');
      return;
    }

    try {
      await this.jobManager.start();
      this.isInitialized = true;

      // Schedule default recurring jobs
      await this.scheduleDefaultJobs();

      this.logger.info('Job service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize job service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Shutdown the job service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.jobManager.stop();
      this.isInitialized = false;
      this.logger.info('Job service shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down job service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Schedule notification processing job
   */
  async scheduleNotificationJob(
    type: 'overdue' | 'upcoming' | 'reminder' | 'digest',
    options: {
      userId?: string;
      taskId?: string;
      data?: Record<string, any>;
      delay?: number;
      priority?: number;
    } = {}
  ): Promise<string> {
    const job: JobDefinition = {
      id: `notification_${type}_${Date.now()}`,
      name: 'notification-job',
      type: options.delay ? JobType.SCHEDULED : JobType.IMMEDIATE,
      payload: {
        type,
        userId: options.userId,
        taskId: options.taskId,
        data: options.data,
      },
      priority: options.priority || 5,
      delay: options.delay,
    };

    return await this.jobManager.addJob(job);
  }

  /**
   * Schedule recurring task processing job
   */
  async scheduleRecurringTaskJob(
    type: 'process_all' | 'process_specific',
    options: {
      recurringTaskId?: string;
      userId?: string;
      delay?: number;
      priority?: number;
    } = {}
  ): Promise<string> {
    const job: JobDefinition = {
      id: `recurring_task_${type}_${Date.now()}`,
      name: 'recurring-task-job',
      type: options.delay ? JobType.SCHEDULED : JobType.IMMEDIATE,
      payload: {
        type,
        recurringTaskId: options.recurringTaskId,
        userId: options.userId,
      },
      priority: options.priority || 5,
      delay: options.delay,
    };

    return await this.jobManager.addJob(job);
  }

  /**
   * Schedule calendar reminder job
   */
  async scheduleCalendarReminderJob(
    type: 'process_all' | 'process_event' | 'process_user',
    options: {
      eventId?: string;
      userId?: string;
      reminderType?: 'immediate' | 'scheduled';
      delay?: number;
      priority?: number;
    } = {}
  ): Promise<string> {
    const job: JobDefinition = {
      id: `calendar_reminder_${type}_${Date.now()}`,
      name: 'calendar-reminder-job',
      type: options.delay ? JobType.SCHEDULED : JobType.IMMEDIATE,
      payload: {
        type,
        eventId: options.eventId,
        userId: options.userId,
        reminderType: options.reminderType,
      },
      priority: options.priority || 5,
      delay: options.delay,
    };

    return await this.jobManager.addJob(job);
  }

  /**
   * Schedule webhook delivery job
   */
  async scheduleWebhookDeliveryJob(
    type:
      | 'process_pending'
      | 'process_retries'
      | 'process_scheduled'
      | 'deliver_specific',
    options: {
      webhookDeliveryId?: string;
      batchSize?: number;
      maxProcessingTime?: number;
      delay?: number;
      priority?: number;
    } = {}
  ): Promise<string> {
    const job: JobDefinition = {
      id: `webhook_delivery_${type}_${Date.now()}`,
      name: 'webhook-delivery-job',
      type: options.delay ? JobType.SCHEDULED : JobType.IMMEDIATE,
      payload: {
        type,
        webhookDeliveryId: options.webhookDeliveryId,
        batchSize: options.batchSize,
        maxProcessingTime: options.maxProcessingTime,
      },
      priority: options.priority || 5,
      delay: options.delay,
    };

    return await this.jobManager.addJob(job);
  }

  /**
   * Schedule recurring jobs with cron expressions
   */
  async scheduleRecurringJobs(): Promise<void> {
    try {
      // Schedule notification jobs
      await this.jobManager.scheduleJob(
        {
          id: 'overdue_notifications',
          name: 'notification-job',
          type: JobType.RECURRING,
          payload: { type: 'overdue' },
        },
        '0 */30 * * * *' // Every 30 minutes
      );

      await this.jobManager.scheduleJob(
        {
          id: 'upcoming_notifications',
          name: 'notification-job',
          type: JobType.RECURRING,
          payload: { type: 'upcoming' },
        },
        '0 0 */6 * * *' // Every 6 hours
      );

      await this.jobManager.scheduleJob(
        {
          id: 'daily_digest',
          name: 'notification-job',
          type: JobType.RECURRING,
          payload: { type: 'digest' },
        },
        '0 0 8 * * *' // Daily at 8 AM
      );

      // Schedule recurring task processing
      await this.jobManager.scheduleJob(
        {
          id: 'process_recurring_tasks',
          name: 'recurring-task-job',
          type: JobType.RECURRING,
          payload: { type: 'process_all' },
        },
        '0 0 * * * *' // Every hour
      );

      // Schedule calendar reminders
      await this.jobManager.scheduleJob(
        {
          id: 'calendar_reminders',
          name: 'calendar-reminder-job',
          type: JobType.RECURRING,
          payload: { type: 'process_all' },
        },
        '0 */5 * * * *' // Every 5 minutes
      );

      // Schedule webhook delivery processing
      await this.jobManager.scheduleJob(
        {
          id: 'webhook_pending',
          name: 'webhook-delivery-job',
          type: JobType.RECURRING,
          payload: { type: 'process_pending', batchSize: 50 },
        },
        '0 */2 * * * *' // Every 2 minutes
      );

      await this.jobManager.scheduleJob(
        {
          id: 'webhook_retries',
          name: 'webhook-delivery-job',
          type: JobType.RECURRING,
          payload: { type: 'process_retries', batchSize: 25 },
        },
        '0 */5 * * * *' // Every 5 minutes
      );

      this.logger.info('Recurring jobs scheduled successfully');
    } catch (error) {
      this.logger.error('Failed to schedule recurring jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobResult | null> {
    return await this.jobManager.getJobStatus(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return await this.jobManager.cancelJob(jobId);
  }

  /**
   * Get job metrics
   */
  async getMetrics(): Promise<JobMetrics> {
    return await this.jobManager.getMetrics();
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
    return await this.jobManager.getQueueStatus();
  }

  /**
   * Pause job processing
   */
  async pauseJobs(): Promise<void> {
    await this.jobManager.pause();
  }

  /**
   * Resume job processing
   */
  async resumeJobs(): Promise<void> {
    await this.jobManager.resume();
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(): Promise<number> {
    return await this.jobManager.cleanup();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: JobMetrics;
  }> {
    return await this.jobManager.healthCheck();
  }

  /**
   * Schedule default jobs on initialization
   */
  private async scheduleDefaultJobs(): Promise<void> {
    try {
      await this.scheduleRecurringJobs();

      this.logger.info('Default jobs scheduled successfully');
    } catch (error) {
      this.logger.error('Failed to schedule default jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw here - service can still work without scheduled jobs
    }
  }

  /**
   * Process overdue task notifications immediately
   */
  async processOverdueNotifications(): Promise<string> {
    return await this.scheduleNotificationJob('overdue', { priority: 1 });
  }

  /**
   * Process upcoming task notifications immediately
   */
  async processUpcomingNotifications(): Promise<string> {
    return await this.scheduleNotificationJob('upcoming', { priority: 1 });
  }

  /**
   * Process recurring tasks immediately
   */
  async processRecurringTasks(): Promise<string> {
    return await this.scheduleRecurringTaskJob('process_all', { priority: 1 });
  }

  /**
   * Process calendar reminders immediately
   */
  async processCalendarReminders(): Promise<string> {
    return await this.scheduleCalendarReminderJob('process_all', {
      priority: 1,
    });
  }

  /**
   * Process webhook deliveries immediately
   */
  async processWebhookDeliveries(): Promise<string> {
    return await this.scheduleWebhookDeliveryJob('process_pending', {
      batchSize: 100,
      priority: 1,
    });
  }
}
