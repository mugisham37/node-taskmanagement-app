import * as recurringTaskService from '../services/recurring-task.service';
import logger from '../../shared/config/logger';

/**
 * Schedule job to process recurring tasks
 * @param interval Interval in milliseconds
 */
export function scheduleRecurringTasksJob(interval: number): NodeJS.Timeout {
  logger.info(
    `Scheduling recurring tasks job to run every ${interval / 1000} seconds`,
    {
      jobType: 'recurring-tasks',
      intervalMs: interval,
      intervalSeconds: interval / 1000,
    }
  );

  // Run the job immediately on startup
  processRecurringTasks();

  // Schedule the job to run at the specified interval
  return setInterval(processRecurringTasks, interval);
}

/**
 * Process recurring tasks
 * Creates new task instances from active recurring tasks that are due
 */
async function processRecurringTasks(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Starting recurring tasks processing...', {
      jobType: 'recurring-tasks',
      timestamp: new Date().toISOString(),
    });

    // Process recurring tasks using the recurring task service
    const result =
      await recurringTaskService.recurringTaskService.processRecurringTasks({
        userId: 'system', // System context for job processing
        timestamp: new Date(),
      });

    const processingTime = Date.now() - startTime;

    logger.info('Recurring tasks processing completed successfully', {
      jobType: 'recurring-tasks',
      tasksCreated: result.tasksCreated,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Error processing recurring tasks', {
      jobType: 'recurring-tasks',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });

    // Don't throw the error to prevent the job from stopping
    // Log it and continue with the next scheduled run
  }
}

/**
 * Process recurring tasks immediately (for manual triggering)
 * @returns Promise with processing results
 */
export async function processRecurringTasksNow(): Promise<{
  success: boolean;
  tasksCreated?: number;
  error?: string;
  processingTime: number;
}> {
  const startTime = Date.now();

  try {
    logger.info('Manual recurring tasks processing triggered', {
      jobType: 'recurring-tasks-manual',
      timestamp: new Date().toISOString(),
    });

    const result =
      await recurringTaskService.recurringTaskService.processRecurringTasks({
        userId: 'system',
        timestamp: new Date(),
      });

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      tasksCreated: result.tasksCreated,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error in manual recurring tasks processing', {
      jobType: 'recurring-tasks-manual',
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });

    return {
      success: false,
      error: errorMessage,
      processingTime,
    };
  }
}

/**
 * Get recurring tasks processing statistics
 * @returns Promise with statistics
 */
export async function getRecurringTasksStats(): Promise<{
  success: boolean;
  stats?: any;
  error?: string;
}> {
  try {
    logger.debug('Fetching recurring tasks statistics', {
      jobType: 'recurring-tasks-stats',
    });

    const stats =
      await recurringTaskService.recurringTaskService.getRecurringTaskStats(
        {},
        {
          userId: 'system',
          timestamp: new Date(),
        }
      );

    return {
      success: true,
      stats,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error fetching recurring tasks statistics', {
      jobType: 'recurring-tasks-stats',
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
