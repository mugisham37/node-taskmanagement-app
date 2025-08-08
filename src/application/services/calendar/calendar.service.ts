import { eq, and, gte, lte } from 'drizzle-orm';
import {
  BaseService,
  ServiceContext,
  NotFoundError,
} from '../../../shared/services/base.service';
import {
  calendarEventRepository,
  notificationRepository,
  userRepository,
} from '../../../infrastructure/database/drizzle/repositories';
import { CalendarEvent } from '../schemas/calendar-events';
import {
  notificationService,
  NotificationType,
} from '../../../domains/notification/services/notification.service';
import { CalendarEventApplicationService } from './calendar-event.application.service';
import logger from '../../../shared/config/logger';

export interface EventReminderResult {
  eventId: string;
  title: string;
  remindersSent: number;
  errors: string[];
}

export interface ReminderProcessingResult {
  totalProcessed: number;
  remindersSent: number;
  errors: string[];
  events: EventReminderResult[];
}

export class CalendarService extends BaseService {
  constructor(
    private readonly calendarEventApplicationService?: CalendarEventApplicationService
  ) {
    super('CalendarService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache
      enableAudit: true,
      enableMetrics: true,
    });
  }

  /**
   * Process event reminders for upcoming calendar events
   * This method is called by the calendar reminders job
   */
  async processEventReminders(context?: ServiceContext): Promise<number> {
    const ctx = this.createContext(context);
    this.logOperation('processEventReminders', ctx);

    try {
      const now = new Date();
      const reminderWindow = new Date(now.getTime() + 60 * 60 * 1000); // Next 1 hour

      logger.info('Processing calendar event reminders', {
        currentTime: now.toISOString(),
        reminderWindow: reminderWindow.toISOString(),
      });

      // Find events that need reminders sent
      const upcomingEvents = await this.getUpcomingEventsForReminders(
        now,
        reminderWindow
      );

      let totalRemindersSent = 0;
      const processingResults: EventReminderResult[] = [];

      for (const event of upcomingEvents) {
        try {
          const result = await this.processEventReminder(event, ctx);
          processingResults.push(result);
          totalRemindersSent += result.remindersSent;
        } catch (error) {
          logger.error(`Failed to process reminders for event ${event.id}`, {
            eventId: event.id,
            eventTitle: event.title,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          processingResults.push({
            eventId: event.id,
            title: event.title,
            remindersSent: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }
      }

      // Log summary
      logger.info('Calendar event reminders processing completed', {
        totalEvents: upcomingEvents.length,
        totalRemindersSent,
        successfulEvents: processingResults.filter(r => r.errors.length === 0)
          .length,
        failedEvents: processingResults.filter(r => r.errors.length > 0).length,
      });

      await this.recordMetric(
        'calendar.reminders.processed',
        upcomingEvents.length
      );
      await this.recordMetric('calendar.reminders.sent', totalRemindersSent);

      return totalRemindersSent;
    } catch (error) {
      this.handleError(error, 'processEventReminders', ctx);
    }
  }

  /**
   * Get upcoming events that need reminder notifications
   */
  private async getUpcomingEventsForReminders(
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]> {
    try {
      const events = await calendarEventRepository.findMany({
        where: and(
          gte(calendarEventRepository['table']?.startDate, startTime),
          lte(calendarEventRepository['table']?.startDate, endTime)
        ),
        limit: 1000,
        sortBy: 'startDate',
        sortOrder: 'asc',
      });

      return events.data;
    } catch (error) {
      logger.error('Failed to fetch upcoming events for reminders', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Process reminder for a single event
   */
  private async processEventReminder(
    event: CalendarEvent,
    context: ServiceContext
  ): Promise<EventReminderResult> {
    const result: EventReminderResult = {
      eventId: event.id,
      title: event.title,
      remindersSent: 0,
      errors: [],
    };

    try {
      // Calculate time until event
      const now = new Date();
      const eventTime = new Date(event.startDate);
      const minutesUntilEvent = Math.floor(
        (eventTime.getTime() - now.getTime()) / (1000 * 60)
      );

      // Determine if we should send a reminder based on time
      const shouldSendReminder = this.shouldSendReminder(minutesUntilEvent);

      if (!shouldSendReminder) {
        logger.debug(
          `Skipping reminder for event ${event.id} - not in reminder window`,
          {
            eventId: event.id,
            minutesUntilEvent,
          }
        );
        return result;
      }

      // Send reminder to event creator
      await this.sendEventReminder(
        event,
        event.userId,
        minutesUntilEvent,
        'creator'
      );
      result.remindersSent++;

      // Send reminders to attendees (if any)
      // Note: In a full implementation, you would fetch attendees from an attendees table
      // For now, we'll just send to the creator

      logger.info(`Sent reminder for event: ${event.title}`, {
        eventId: event.id,
        eventTitle: event.title,
        eventTime: eventTime.toISOString(),
        minutesUntilEvent,
        remindersSent: result.remindersSent,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);

      logger.error(`Failed to process reminder for event ${event.id}`, {
        eventId: event.id,
        eventTitle: event.title,
        error: errorMessage,
      });
    }

    return result;
  }

  /**
   * Determine if a reminder should be sent based on minutes until event
   */
  private shouldSendReminder(minutesUntilEvent: number): boolean {
    // Send reminders at specific intervals: 60 minutes, 30 minutes, 15 minutes, 5 minutes
    const reminderIntervals = [60, 30, 15, 5];

    // Allow a 2-minute window for each reminder interval
    return reminderIntervals.some(
      interval =>
        minutesUntilEvent <= interval && minutesUntilEvent > interval - 2
    );
  }

  /**
   * Send a reminder notification for an event
   */
  private async sendEventReminder(
    event: CalendarEvent,
    userId: string,
    minutesUntilEvent: number,
    recipientType: 'creator' | 'attendee'
  ): Promise<void> {
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Format the reminder message
      const timeText = this.formatTimeUntilEvent(minutesUntilEvent);
      const message = `Reminder: "${event.title}" starts ${timeText}`;

      // Add location if available
      const fullMessage = event.location
        ? `${message} at ${event.location}`
        : message;

      // Create notification
      await notificationService.createNotification({
        userId,
        type: NotificationType.CALENDAR_REMINDER,
        title: 'Event Reminder',
        message: fullMessage,
        data: {
          eventId: event.id,
          eventTitle: event.title,
          eventStartDate: event.startDate.toISOString(),
          eventLocation: event.location,
          minutesUntilEvent,
          recipientType,
        },
      });

      logger.debug(`Sent event reminder notification`, {
        eventId: event.id,
        userId,
        recipientType,
        minutesUntilEvent,
      });
    } catch (error) {
      logger.error(`Failed to send event reminder notification`, {
        eventId: event.id,
        userId,
        recipientType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Format time until event for human-readable display
   */
  private formatTimeUntilEvent(minutes: number): string {
    if (minutes <= 0) {
      return 'now';
    } else if (minutes < 60) {
      return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;

      if (remainingMinutes === 0) {
        return `in ${hours} hour${hours === 1 ? '' : 's'}`;
      } else {
        return `in ${hours} hour${hours === 1 ? '' : 's'} and ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
      }
    }
  }
}

// Export singleton instance
export const calendarService = new CalendarService();
