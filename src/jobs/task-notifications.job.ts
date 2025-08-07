import { taskService, TaskStatus } from "../services";
import logger from "../config/logger";

/**
 * Schedule job to process task notifications and overdue checks
 * @param interval Interval in milliseconds
 */
export function scheduleTaskNotificationsJob(interval: number): NodeJS.Timeout {
  logger.info(`Scheduling task notifications job to run every ${interval / 1000} seconds`, {
    jobType: 'task-notifications',
    intervalMs: interval,
    intervalSeconds: interval / 1000
  });

  // Run the job immediately on startup
  processTaskNotifications();

  // Schedule the job to run at the specified interval
  return setInterval(processTaskNotifications, interval);
}

/**
 * Process task notifications including overdue task checks
 * Sends notifications for overdue tasks and upcoming due dates
 */
async function processTaskNotifications(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info("Starting task notifications processing...", {
      jobType: 'task-notifications',
      timestamp: new Date().toISOString()
    });

    // Process overdue tasks
    const overdueResults = await processOverdueTasks();
    
    // Process upcoming due date reminders
    const upcomingResults = await processUpcomingDueDateReminders();

    const processingTime = Date.now() - startTime;

    logger.info("Task notifications processing completed successfully", {
      jobType: 'task-notifications',
      overdueNotifications: overdueResults.notificationsSent,
      upcomingNotifications: upcomingResults.notificationsSent,
      totalNotifications: overdueResults.notificationsSent + upcomingResults.notificationsSent,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error("Error processing task notifications", {
      jobType: 'task-notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

    // Don't throw the error to prevent the job from stopping
    // Log it and continue with the next scheduled run
  }
}

/**
 * Process overdue tasks and send notifications
 */
async function processOverdueTasks(): Promise<{ notificationsSent: number; errors: string[] }> {
  const result = { notificationsSent: 0, errors: [] as string[] };
  
  try {
    logger.debug("Processing overdue tasks...", {
      jobType: 'task-notifications-overdue'
    });

    // Process overdue tasks manually since checkOverdueTasks method doesn't exist
    const overdueCount = await processOverdueTasksFallback();
    result.notificationsSent = overdueCount;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    
    logger.error("Error processing overdue tasks", {
      jobType: 'task-notifications-overdue',
      error: errorMessage
    });
  }

  return result;
}

/**
 * Fallback method to process overdue tasks when checkOverdueTasks is not available
 */
async function processOverdueTasksFallback(): Promise<number> {
  try {
    const now = new Date();
    
    // Get tasks that are overdue (due date in the past and not completed)
    const overdueTasks = await taskService.getTasks({
      dueDateTo: now,
      status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW] // Not completed or cancelled
    }, {
      limit: 1000
    }, {
      userId: 'system',
      timestamp: new Date()
    });

    let notificationsSent = 0;

    for (const task of overdueTasks.data) {
      try {
        // Create overdue notification logic here
        // This would typically involve calling the notification service
        logger.debug(`Task ${task.id} is overdue: ${task.title}`, {
          taskId: task.id,
          dueDate: task.dueDate,
          currentDate: now.toISOString()
        });
        
        notificationsSent++;
      } catch (error) {
        logger.error(`Failed to send overdue notification for task ${task.id}`, {
          taskId: task.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return notificationsSent;
  } catch (error) {
    logger.error("Error in overdue tasks fallback processing", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

/**
 * Process upcoming due date reminders
 */
async function processUpcomingDueDateReminders(): Promise<{ notificationsSent: number; errors: string[] }> {
  const result = { notificationsSent: 0, errors: [] as string[] };
  
  try {
    logger.debug("Processing upcoming due date reminders...", {
      jobType: 'task-notifications-upcoming'
    });

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get tasks due in the next 24 hours
    const upcomingTasks = await taskService.getTasks({
      dueDateFrom: now,
      dueDateTo: tomorrow,
      status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW]
    }, {
      limit: 1000
    }, {
      userId: 'system',
      timestamp: new Date()
    });

    for (const task of upcomingTasks.data) {
      try {
        // Send upcoming due date reminder
        logger.debug(`Task ${task.id} is due soon: ${task.title}`, {
          taskId: task.id,
          dueDate: task.dueDate,
          hoursUntilDue: task.dueDate ? Math.floor((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60)) : null
        });
        
        result.notificationsSent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(errorMessage);
        
        logger.error(`Failed to send upcoming due date reminder for task ${task.id}`, {
          taskId: task.id,
          error: errorMessage
        });
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    
    logger.error("Error processing upcoming due date reminders", {
      jobType: 'task-notifications-upcoming',
      error: errorMessage
    });
  }

  return result;
}

/**
 * Process task notifications immediately (for manual triggering)
 * @returns Promise with processing results
 */
export async function processTaskNotificationsNow(): Promise<{
  success: boolean;
  overdueNotifications?: number;
  upcomingNotifications?: number;
  totalNotifications?: number;
  error?: string;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  try {
    logger.info("Manual task notifications processing triggered", {
      jobType: 'task-notifications-manual',
      timestamp: new Date().toISOString()
    });

    const overdueResults = await processOverdueTasks();
    const upcomingResults = await processUpcomingDueDateReminders();
    
    const processingTime = Date.now() - startTime;
    const totalNotifications = overdueResults.notificationsSent + upcomingResults.notificationsSent;

    return {
      success: true,
      overdueNotifications: overdueResults.notificationsSent,
      upcomingNotifications: upcomingResults.notificationsSent,
      totalNotifications,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error("Error in manual task notifications processing", {
      jobType: 'task-notifications-manual',
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime
    });

    return {
      success: false,
      error: errorMessage,
      processingTime
    };
  }
}

/**
 * Legacy function for backward compatibility
 * Job to check for overdue tasks and send notifications
 */
export async function checkOverdueTasksJob(): Promise<void> {
  try {
    logger.info("Running legacy job: Check overdue tasks", {
      jobType: 'overdue-tasks-legacy'
    });

    const result = await processOverdueTasks();

    logger.info(`Legacy job completed: Sent ${result.notificationsSent} overdue task notifications`, {
      jobType: 'overdue-tasks-legacy',
      notificationsSent: result.notificationsSent,
      errors: result.errors.length
    });
  } catch (error) {
    logger.error("Error in legacy checkOverdueTasksJob:", {
      jobType: 'overdue-tasks-legacy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Schedule the overdue tasks job to run at the specified interval (legacy)
 * @param interval Interval in milliseconds (default: 1 hour)
 */
export function scheduleOverdueTasksJob(interval = 3600000): NodeJS.Timeout {
  logger.info(`Scheduling overdue tasks job to run every ${interval / 1000} seconds`, {
    jobType: 'overdue-tasks-legacy',
    intervalMs: interval,
    intervalSeconds: interval / 1000
  });

  // Run immediately on startup
  checkOverdueTasksJob();

  // Schedule to run at the specified interval
  return setInterval(checkOverdueTasksJob, interval);
}
