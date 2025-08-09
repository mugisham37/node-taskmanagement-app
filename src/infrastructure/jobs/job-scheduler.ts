import { EventEmitter } from 'events';
import { CronJob } from 'cron';
import { Logger } from '../monitoring/logging-service';
import { JobDefinition, JobSchedule, JobConfig } from './job-types';
import { JobType } from '../../shared/enums/common.enums';

export class JobScheduler extends EventEmitter {
  private schedules = new Map<string, JobSchedule>();
  private cronJobs = new Map<string, CronJob>();
  private isRunning = false;

  constructor(
    private logger: Logger,
    private config: JobConfig
  ) {
    super();
  }

  /**
   * Start the job scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Job scheduler is already running');
      return;
    }

    this.logger.info('Starting job scheduler');
    this.isRunning = true;

    // Start all existing cron jobs
    for (const [scheduleId, cronJob] of this.cronJobs.entries()) {
      try {
        cronJob.start();
        this.logger.debug('Started cron job', { scheduleId });
      } catch (error) {
        this.logger.error('Failed to start cron job', {
          scheduleId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Stop the job scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Job scheduler is not running');
      return;
    }

    this.logger.info('Stopping job scheduler');
    this.isRunning = false;

    // Stop all cron jobs
    for (const [scheduleId, cronJob] of this.cronJobs.entries()) {
      try {
        cronJob.stop();
        this.logger.debug('Stopped cron job', { scheduleId });
      } catch (error) {
        this.logger.error('Failed to stop cron job', {
          scheduleId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Schedule a recurring job
   */
  async schedule(
    job: JobDefinition,
    cronExpression: string,
    timezone?: string
  ): Promise<string> {
    const scheduleId = this.generateScheduleId();

    try {
      // Validate cron expression
      this.validateCronExpression(cronExpression);

      const schedule: JobSchedule = {
        jobId: job.id,
        cronExpression,
        enabled: true,
        timezone: timezone || 'UTC',
      };

      // Calculate next run time
      schedule.nextRun = this.calculateNextRun(cronExpression, timezone);

      // Create cron job
      const cronJob = new CronJob(
        cronExpression,
        () => this.executeScheduledJob(scheduleId, job),
        null, // onComplete
        false, // start immediately
        timezone || 'UTC'
      );

      // Store schedule and cron job
      this.schedules.set(scheduleId, schedule);
      this.cronJobs.set(scheduleId, cronJob);

      // Start the cron job if scheduler is running
      if (this.isRunning) {
        cronJob.start();
      }

      this.logger.info('Job scheduled successfully', {
        scheduleId,
        jobId: job.id,
        jobName: job.name,
        cronExpression,
        nextRun: schedule.nextRun,
        timezone: schedule.timezone,
      });

      return scheduleId;
    } catch (error) {
      this.logger.error('Failed to schedule job', {
        jobId: job.id,
        jobName: job.name,
        cronExpression,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Unschedule a job
   */
  async unschedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    const cronJob = this.cronJobs.get(scheduleId);

    if (!schedule || !cronJob) {
      this.logger.warn('Schedule not found', { scheduleId });
      return false;
    }

    try {
      // Stop and remove cron job
      cronJob.stop();
      this.cronJobs.delete(scheduleId);
      this.schedules.delete(scheduleId);

      this.logger.info('Job unscheduled successfully', {
        scheduleId,
        jobId: schedule.jobId,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to unschedule job', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Enable a scheduled job
   */
  async enable(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    const cronJob = this.cronJobs.get(scheduleId);

    if (!schedule || !cronJob) {
      this.logger.warn('Schedule not found', { scheduleId });
      return false;
    }

    if (schedule.enabled) {
      this.logger.warn('Schedule is already enabled', { scheduleId });
      return true;
    }

    try {
      schedule.enabled = true;

      if (this.isRunning) {
        cronJob.start();
      }

      this.logger.info('Schedule enabled', {
        scheduleId,
        jobId: schedule.jobId,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to enable schedule', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Disable a scheduled job
   */
  async disable(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    const cronJob = this.cronJobs.get(scheduleId);

    if (!schedule || !cronJob) {
      this.logger.warn('Schedule not found', { scheduleId });
      return false;
    }

    if (!schedule.enabled) {
      this.logger.warn('Schedule is already disabled', { scheduleId });
      return true;
    }

    try {
      schedule.enabled = false;
      cronJob.stop();

      this.logger.info('Schedule disabled', {
        scheduleId,
        jobId: schedule.jobId,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to disable schedule', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get schedule information
   */
  getSchedule(scheduleId: string): JobSchedule | null {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return null;
    }

    // Update next run time
    schedule.nextRun = this.calculateNextRun(
      schedule.cronExpression,
      schedule.timezone
    );

    return { ...schedule };
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): JobSchedule[] {
    return Array.from(this.schedules.values()).map(schedule => ({
      ...schedule,
      nextRun: this.calculateNextRun(
        schedule.cronExpression,
        schedule.timezone
      ),
    }));
  }

  /**
   * Update schedule cron expression
   */
  async updateSchedule(
    scheduleId: string,
    cronExpression: string,
    timezone?: string
  ): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    const cronJob = this.cronJobs.get(scheduleId);

    if (!schedule || !cronJob) {
      this.logger.warn('Schedule not found', { scheduleId });
      return false;
    }

    try {
      // Validate new cron expression
      this.validateCronExpression(cronExpression);

      // Stop existing cron job
      cronJob.stop();

      // Update schedule
      schedule.cronExpression = cronExpression;
      if (timezone) {
        schedule.timezone = timezone;
      }
      schedule.nextRun = this.calculateNextRun(
        cronExpression,
        schedule.timezone
      );

      // Create new cron job with updated expression
      const newCronJob = new CronJob(
        cronExpression,
        () =>
          this.executeScheduledJob(scheduleId, {
            id: schedule.jobId,
          } as JobDefinition),
        null,
        schedule.enabled && this.isRunning,
        schedule.timezone
      );

      // Replace cron job
      this.cronJobs.set(scheduleId, newCronJob);

      this.logger.info('Schedule updated successfully', {
        scheduleId,
        jobId: schedule.jobId,
        cronExpression,
        nextRun: schedule.nextRun,
        timezone: schedule.timezone,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update schedule', {
        scheduleId,
        cronExpression,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    totalSchedules: number;
    enabledSchedules: number;
    disabledSchedules: number;
    runningJobs: number;
  } {
    const schedules = Array.from(this.schedules.values());

    return {
      totalSchedules: schedules.length,
      enabledSchedules: schedules.filter(s => s.enabled).length,
      disabledSchedules: schedules.filter(s => !s.enabled).length,
      runningJobs: this.cronJobs.size,
    };
  }

  /**
   * Execute a scheduled job
   */
  private async executeScheduledJob(
    scheduleId: string,
    job: JobDefinition
  ): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return;
    }

    try {
      // Update last run time
      schedule.lastRun = new Date();
      schedule.nextRun = this.calculateNextRun(
        schedule.cronExpression,
        schedule.timezone
      );

      // Create job instance for execution
      const jobInstance: JobDefinition = {
        ...job,
        id: `${job.id}_${Date.now()}`,
        type: JobType.SCHEDULED,
      };

      // Emit event to trigger job execution
      this.emit('job.scheduled', jobInstance);

      this.logger.debug('Scheduled job triggered', {
        scheduleId,
        jobId: job.id,
        instanceId: jobInstance.id,
        lastRun: schedule.lastRun,
        nextRun: schedule.nextRun,
      });
    } catch (error) {
      this.logger.error('Error executing scheduled job', {
        scheduleId,
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validate cron expression
   */
  private validateCronExpression(cronExpression: string): void {
    try {
      // Basic validation - CronJob constructor will throw if invalid
      new CronJob(cronExpression, () => {}, null, false);
    } catch (error) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
  }

  /**
   * Calculate next run time for cron expression
   */
  private calculateNextRun(cronExpression: string, timezone?: string): Date {
    try {
      const cronJob = new CronJob(
        cronExpression,
        () => {},
        null,
        false,
        timezone
      );
      return cronJob.nextDate().toDate();
    } catch (error) {
      this.logger.error('Failed to calculate next run time', {
        cronExpression,
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return new Date(Date.now() + 60000); // Default to 1 minute from now
    }
  }

  /**
   * Generate unique schedule ID
   */
  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
