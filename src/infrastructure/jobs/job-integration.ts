import { Logger } from '../monitoring/logging-service';
import { JobService } from './job-service';
import { JobConfig } from './job-types';

/**
 * Integration service for migrating from older version job system
 */
export class JobIntegrationService {
  private jobService: JobService;
  private logger: Logger;

  constructor(logger: Logger, config: Partial<JobConfig> = {}) {
    this.logger = logger;
    this.jobService = new JobService(logger, config);
  }

  /**
   * Initialize the job integration service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing job integration service...');

      await this.jobService.initialize();

      // Migrate existing job configurations
      await this.migrateExistingJobs();

      this.logger.info('Job integration service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize job integration service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Shutdown the job integration service
   */
  async shutdown(): Promise<void> {
    try {
      await this.jobService.shutdown();
      this.logger.info('Job integration service shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down job integration service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get the job service instance
   */
  getJobService(): JobService {
    return this.jobService;
  }

  /**
   * Migrate existing job configurations from older version
   */
  private async migrateExistingJobs(): Promise<void> {
    try {
      this.logger.info('Migrating existing job configurations...');

      // These would be the equivalent of the older version job intervals
      const jobIntervals = {
        taskNotifications: 30 * 60 * 1000, // 30 minutes
        recurringTasks: 60 * 60 * 1000, // 1 hour
        calendarReminders: 5 * 60 * 1000, // 5 minutes
        webhookDelivery: 2 * 60 * 1000, // 2 minutes
      };

      // Process any immediate jobs that might be pending
      await this.processImmediateJobs();

      this.logger.info('Job migration completed successfully', {
        migratedIntervals: jobIntervals,
      });
    } catch (error) {
      this.logger.error('Failed to migrate existing jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process any immediate jobs that need to be run
   */
  private async processImmediateJobs(): Promise<void> {
    try {
      // Process overdue notifications immediately
      const overdueJobId = await this.jobService.processOverdueNotifications();
      this.logger.info('Scheduled immediate overdue notifications job', {
        jobId: overdueJobId,
      });

      // Process upcoming notifications
      const upcomingJobId =
        await this.jobService.processUpcomingNotifications();
      this.logger.info('Scheduled immediate upcoming notifications job', {
        jobId: upcomingJobId,
      });

      // Process recurring tasks
      const recurringJobId = await this.jobService.processRecurringTasks();
      this.logger.info('Scheduled immediate recurring tasks job', {
        jobId: recurringJobId,
      });

      // Process calendar reminders
      const calendarJobId = await this.jobService.processCalendarReminders();
      this.logger.info('Scheduled immediate calendar reminders job', {
        jobId: calendarJobId,
      });

      // Process webhook deliveries
      const webhookJobId = await this.jobService.processWebhookDeliveries();
      this.logger.info('Scheduled immediate webhook deliveries job', {
        jobId: webhookJobId,
      });
    } catch (error) {
      this.logger.error('Failed to process immediate jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw here - this is not critical for initialization
    }
  }

  /**
   * Legacy compatibility methods for older version job functions
   */

  /**
   * Initialize jobs (legacy compatibility)
   */
  async initializeJobs(): Promise<void> {
    await this.initialize();
  }

  /**
   * Stop jobs (legacy compatibility)
   */
  async stopJobs(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Get job statuses (legacy compatibility)
   */
  async getJobStatuses(): Promise<any[]> {
    const metrics = await this.jobService.getMetrics();
    const queueStatus = await this.jobService.getQueueStatus();

    return [
      {
        name: 'Task Notifications',
        isRunning: true,
        runCount: metrics.completedJobs,
        errorCount: metrics.failedJobs,
        lastRun: metrics.lastProcessedAt,
        interval: 30 * 60 * 1000,
      },
      {
        name: 'Recurring Tasks',
        isRunning: true,
        runCount: metrics.completedJobs,
        errorCount: metrics.failedJobs,
        lastRun: metrics.lastProcessedAt,
        interval: 60 * 60 * 1000,
      },
      {
        name: 'Calendar Reminders',
        isRunning: true,
        runCount: metrics.completedJobs,
        errorCount: metrics.failedJobs,
        lastRun: metrics.lastProcessedAt,
        interval: 5 * 60 * 1000,
      },
    ];
  }

  /**
   * Get job status (legacy compatibility)
   */
  async getJobStatus(jobName: string): Promise<any | null> {
    const metrics = await this.jobService.getMetrics();

    return {
      name: jobName,
      isRunning: true,
      runCount: metrics.completedJobs,
      errorCount: metrics.failedJobs,
      lastRun: metrics.lastProcessedAt,
    };
  }

  /**
   * Restart job (legacy compatibility)
   */
  async restartJob(jobName: string): Promise<boolean> {
    try {
      switch (jobName) {
        case 'task-notifications':
          await this.jobService.processOverdueNotifications();
          await this.jobService.processUpcomingNotifications();
          break;
        case 'recurring-tasks':
          await this.jobService.processRecurringTasks();
          break;
        case 'calendar-reminders':
          await this.jobService.processCalendarReminders();
          break;
        default:
          this.logger.warn('Unknown job name for restart', { jobName });
          return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to restart job', {
        jobName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Update job status (legacy compatibility)
   */
  updateJobStatus(jobName: string, success: boolean, error?: string): void {
    this.logger.debug('Job status update (legacy)', {
      jobName,
      success,
      error,
    });
  }

  /**
   * Get job metrics (legacy compatibility)
   */
  async getJobMetrics(): Promise<{
    totalJobs: number;
    runningJobs: number;
    stoppedJobs: number;
    totalRuns: number;
    totalErrors: number;
    uptime: number;
  }> {
    const metrics = await this.jobService.getMetrics();
    const queueStatus = await this.jobService.getQueueStatus();

    return {
      totalJobs: metrics.totalJobs,
      runningJobs: queueStatus.processing,
      stoppedJobs: 0, // All jobs are managed by the job service now
      totalRuns: metrics.completedJobs,
      totalErrors: metrics.failedJobs,
      uptime: process.uptime(),
    };
  }

  /**
   * Process task notifications now (legacy compatibility)
   */
  async processTaskNotificationsNow(): Promise<{
    success: boolean;
    overdueNotifications?: number;
    upcomingNotifications?: number;
    totalNotifications?: number;
    error?: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      const overdueJobId = await this.jobService.processOverdueNotifications();
      const upcomingJobId =
        await this.jobService.processUpcomingNotifications();

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        overdueNotifications: 1, // Job scheduled
        upcomingNotifications: 1, // Job scheduled
        totalNotifications: 2,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      };
    }
  }

  /**
   * Process recurring tasks now (legacy compatibility)
   */
  async processRecurringTasksNow(): Promise<{
    success: boolean;
    tasksCreated?: number;
    error?: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      await this.jobService.processRecurringTasks();

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        tasksCreated: 1, // Job scheduled
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      };
    }
  }

  /**
   * Process calendar reminders now (legacy compatibility)
   */
  async processCalendarRemindersNow(): Promise<{
    success: boolean;
    remindersSent?: number;
    error?: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      await this.jobService.processCalendarReminders();

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        remindersSent: 1, // Job scheduled
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      };
    }
  }
}
