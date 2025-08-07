import { scheduleTaskNotificationsJob } from './task-notifications.job';
import { scheduleRecurringTasksJob } from './recurring-tasks.job';
import { scheduleCalendarRemindersJob } from './calendar-reminders.job';
import { WebhookDeliveryJobManager } from './webhook-delivery.job';
import config from '../config/environment';
import logger from '../config/logger';

// Array to store job intervals for cleanup
const jobIntervals: NodeJS.Timeout[] = [];

// Job status tracking
interface JobStatus {
  name: string;
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  interval: number;
  runCount: number;
  errorCount: number;
  lastError?: string;
}

const jobStatuses: Map<string, JobStatus> = new Map();

/**
 * Initialize and schedule all jobs
 */
export function initializeJobs(): void {
  if (config.enableJobs !== 'true') {
    logger.info('Job scheduling is disabled. Set ENABLE_JOBS=true to enable.', {
      enableJobs: config.enableJobs,
      nodeEnv: config.nodeEnv,
    });
    return;
  }

  logger.info('Initializing scheduled jobs...', {
    nodeEnv: config.nodeEnv,
    jobIntervals: config.jobIntervals,
  });

  try {
    // Schedule task notifications job
    const taskNotificationsInterval = scheduleTaskNotificationsJob(
      config.jobIntervals.taskNotifications
    );
    jobIntervals.push(taskNotificationsInterval);

    jobStatuses.set('task-notifications', {
      name: 'Task Notifications',
      isRunning: true,
      interval: config.jobIntervals.taskNotifications,
      runCount: 0,
      errorCount: 0,
      nextRun: new Date(Date.now() + config.jobIntervals.taskNotifications),
    });

    // Schedule recurring tasks job
    const recurringTasksInterval = scheduleRecurringTasksJob(
      config.jobIntervals.recurringTasks
    );
    jobIntervals.push(recurringTasksInterval);

    jobStatuses.set('recurring-tasks', {
      name: 'Recurring Tasks',
      isRunning: true,
      interval: config.jobIntervals.recurringTasks,
      runCount: 0,
      errorCount: 0,
      nextRun: new Date(Date.now() + config.jobIntervals.recurringTasks),
    });

    // Schedule calendar reminders job
    const calendarRemindersInterval = scheduleCalendarRemindersJob(
      config.jobIntervals.calendarReminders
    );
    jobIntervals.push(calendarRemindersInterval);

    jobStatuses.set('calendar-reminders', {
      name: 'Calendar Reminders',
      isRunning: true,
      interval: config.jobIntervals.calendarReminders,
      runCount: 0,
      errorCount: 0,
      nextRun: new Date(Date.now() + config.jobIntervals.calendarReminders),
    });

    logger.info('All jobs scheduled successfully', {
      totalJobs: jobIntervals.length,
      jobs: Array.from(jobStatuses.keys()),
      intervals: {
        taskNotifications: config.jobIntervals.taskNotifications / 1000,
        recurringTasks: config.jobIntervals.recurringTasks / 1000,
        calendarReminders: config.jobIntervals.calendarReminders / 1000,
      },
    });

    // Set up job monitoring
    setupJobMonitoring();
  } catch (error) {
    logger.error('Error initializing jobs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Clean up any partially initialized jobs
    stopJobs();
    throw error;
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopJobs(): void {
  logger.info('Stopping all scheduled jobs...', {
    activeJobs: jobIntervals.length,
    jobNames: Array.from(jobStatuses.keys()),
  });

  try {
    // Clear all intervals
    jobIntervals.forEach((interval, index) => {
      try {
        clearInterval(interval);
        logger.debug(`Cleared job interval ${index}`);
      } catch (error) {
        logger.error(`Error clearing job interval ${index}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Clear the array
    jobIntervals.length = 0;

    // Update job statuses
    jobStatuses.forEach((status, name) => {
      status.isRunning = false;
      status.nextRun = undefined;
    });

    logger.info('All jobs stopped successfully', {
      stoppedJobs: Array.from(jobStatuses.keys()),
    });
  } catch (error) {
    logger.error('Error stopping jobs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Get status of all jobs
 */
export function getJobStatuses(): JobStatus[] {
  return Array.from(jobStatuses.values()).map(status => ({
    ...status,
    // Calculate next run time based on current time and interval
    nextRun: status.isRunning
      ? new Date(Date.now() + status.interval)
      : undefined,
  }));
}

/**
 * Get status of a specific job
 */
export function getJobStatus(jobName: string): JobStatus | null {
  return jobStatuses.get(jobName) || null;
}

/**
 * Restart a specific job
 */
export function restartJob(jobName: string): boolean {
  try {
    const status = jobStatuses.get(jobName);
    if (!status) {
      logger.warn(`Job ${jobName} not found for restart`);
      return false;
    }

    logger.info(`Restarting job: ${jobName}`, {
      jobName,
      previousRunCount: status.runCount,
      previousErrorCount: status.errorCount,
    });

    // Stop the specific job (this is a simplified approach)
    // In a more sophisticated implementation, you'd track individual intervals

    // Restart based on job type
    let newInterval: NodeJS.Timeout;

    switch (jobName) {
      case 'task-notifications':
        newInterval = scheduleTaskNotificationsJob(
          config.jobIntervals.taskNotifications
        );
        break;
      case 'recurring-tasks':
        newInterval = scheduleRecurringTasksJob(
          config.jobIntervals.recurringTasks
        );
        break;
      case 'calendar-reminders':
        newInterval = scheduleCalendarRemindersJob(
          config.jobIntervals.calendarReminders
        );
        break;
      default:
        logger.error(`Unknown job name for restart: ${jobName}`);
        return false;
    }

    // Update status
    status.isRunning = true;
    status.nextRun = new Date(Date.now() + status.interval);
    status.lastError = undefined;

    logger.info(`Job ${jobName} restarted successfully`);
    return true;
  } catch (error) {
    logger.error(`Error restarting job ${jobName}`, {
      jobName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Setup job monitoring and health checks
 */
function setupJobMonitoring(): void {
  // Set up a monitoring interval to check job health
  const monitoringInterval = setInterval(
    () => {
      try {
        const now = new Date();
        let healthyJobs = 0;
        let unhealthyJobs = 0;

        jobStatuses.forEach((status, name) => {
          if (status.isRunning) {
            healthyJobs++;

            // Update next run time
            status.nextRun = new Date(now.getTime() + status.interval);

            // Log job health periodically (every hour)
            if (status.runCount > 0 && status.runCount % 12 === 0) {
              // Assuming 5-minute intervals
              logger.debug(`Job health check: ${name}`, {
                jobName: name,
                runCount: status.runCount,
                errorCount: status.errorCount,
                errorRate: status.errorCount / status.runCount,
                lastRun: status.lastRun,
                nextRun: status.nextRun,
              });
            }
          } else {
            unhealthyJobs++;
          }
        });

        // Log overall job health every 30 minutes
        const totalJobs = healthyJobs + unhealthyJobs;
        if (totalJobs > 0) {
          logger.debug('Job system health check', {
            totalJobs,
            healthyJobs,
            unhealthyJobs,
            healthPercentage: Math.round((healthyJobs / totalJobs) * 100),
            timestamp: now.toISOString(),
          });
        }
      } catch (error) {
        logger.error('Error in job monitoring', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    5 * 60 * 1000
  ); // Run monitoring every 5 minutes

  // Store monitoring interval for cleanup
  jobIntervals.push(monitoringInterval);
}

/**
 * Update job status after execution
 */
export function updateJobStatus(
  jobName: string,
  success: boolean,
  error?: string
): void {
  const status = jobStatuses.get(jobName);
  if (status) {
    status.lastRun = new Date();
    status.runCount++;

    if (!success) {
      status.errorCount++;
      status.lastError = error;
    }

    logger.debug(`Updated job status: ${jobName}`, {
      jobName,
      success,
      runCount: status.runCount,
      errorCount: status.errorCount,
      lastError: error,
    });
  }
}

/**
 * Get job system metrics
 */
export function getJobMetrics(): {
  totalJobs: number;
  runningJobs: number;
  stoppedJobs: number;
  totalRuns: number;
  totalErrors: number;
  uptime: number;
} {
  const statuses = Array.from(jobStatuses.values());

  return {
    totalJobs: statuses.length,
    runningJobs: statuses.filter(s => s.isRunning).length,
    stoppedJobs: statuses.filter(s => !s.isRunning).length,
    totalRuns: statuses.reduce((sum, s) => sum + s.runCount, 0),
    totalErrors: statuses.reduce((sum, s) => sum + s.errorCount, 0),
    uptime: process.uptime(),
  };
}

// Export job control functions
export {
  scheduleTaskNotificationsJob,
  scheduleRecurringTasksJob,
  scheduleCalendarRemindersJob,
};

// Export types
export type { JobStatus };
