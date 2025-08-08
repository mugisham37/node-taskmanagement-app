import * as calendarService from '../services/calendar.service';
import logger from '../../shared/config/logger';

/**
 * Schedule job to process calendar event reminders
 * @param interval Interval in milliseconds
 */
export function scheduleCalendarRemindersJob(interval: number): NodeJS.Timeout {
  logger.info(
    `Scheduling calendar reminders job to run every ${interval / 1000} seconds`,
    {
      jobType: 'calendar-reminders',
      intervalMs: interval,
      intervalSeconds: interval / 1000,
    }
  );

  // Run the job immediately on startup
  processCalendarReminders();

  // Schedule the job to run at the specified interval
  return setInterval(processCalendarReminders, interval);
}

/**
 * Process calendar event reminders
 * Sends reminder notifications for upcoming calendar events
 */
async function processCalendarReminders(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Starting calendar event reminders processing...', {
      jobType: 'calendar-reminders',
      timestamp: new Date().toISOString(),
    });

    // Process event reminders using the calendar service
    const remindersSent =
      await calendarService.calendarService.processEventReminders({
        userId: 'system', // System context for job processing
        timestamp: new Date(),
      });

    const processingTime = Date.now() - startTime;

    logger.info('Calendar event reminders processing completed successfully', {
      jobType: 'calendar-reminders',
      remindersSent,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Error processing calendar event reminders', {
      jobType: 'calendar-reminders',
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
 * Process calendar reminders immediately (for manual triggering)
 * @returns Promise with processing results
 */
export async function processCalendarRemindersNow(): Promise<{
  success: boolean;
  remindersSent?: number;
  error?: string;
  processingTime: number;
}> {
  const startTime = Date.now();

  try {
    logger.info('Manual calendar reminders processing triggered', {
      jobType: 'calendar-reminders-manual',
      timestamp: new Date().toISOString(),
    });

    const remindersSent =
      await calendarService.calendarService.processEventReminders({
        userId: 'system',
        timestamp: new Date(),
      });

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      remindersSent,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error in manual calendar reminders processing', {
      jobType: 'calendar-reminders-manual',
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
