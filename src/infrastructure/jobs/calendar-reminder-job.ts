import { Logger } from '../monitoring/logging-service';
import { JobHandler } from './job-types';

export interface CalendarReminderJobPayload {
  type: 'process_all' | 'process_event' | 'process_user';
  eventId?: string;
  userId?: string;
  reminderType?: 'immediate' | 'scheduled';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  userId: string;
  attendees?: string[];
  reminders: CalendarReminder[];
  isAllDay: boolean;
  recurrenceRule?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarReminder {
  id: string;
  eventId: string;
  type: 'email' | 'notification' | 'sms';
  minutesBefore: number;
  sent: boolean;
  sentAt?: Date;
  scheduledFor: Date;
}

export class CalendarReminderJobHandler implements JobHandler {
  name = 'calendar-reminder-job';

  constructor(
    private logger: Logger,
    private calendarService: any, // Will be injected
    private notificationService: any, // Will be injected
    private emailService: any // Will be injected
  ) {}

  /**
   * Execute calendar reminder job
   */
  async execute(payload: CalendarReminderJobPayload): Promise<any> {
    this.logger.info('Processing calendar reminder job', {
      type: payload.type,
      eventId: payload.eventId,
      userId: payload.userId,
      reminderType: payload.reminderType,
    });

    switch (payload.type) {
      case 'process_all':
        return await this.processAllReminders();
      case 'process_event':
        if (!payload.eventId) {
          throw new Error('eventId is required for process_event type');
        }
        return await this.processEventReminders(payload.eventId);
      case 'process_user':
        if (!payload.userId) {
          throw new Error('userId is required for process_user type');
        }
        return await this.processUserReminders(payload.userId);
      default:
        throw new Error(`Unknown calendar reminder job type: ${payload.type}`);
    }
  }

  /**
   * Validate calendar reminder job payload
   */
  validate(payload: CalendarReminderJobPayload): boolean {
    if (!payload.type) {
      return false;
    }

    const validTypes = ['process_all', 'process_event', 'process_user'];
    if (!validTypes.includes(payload.type)) {
      return false;
    }

    if (payload.type === 'process_event' && !payload.eventId) {
      return false;
    }

    if (payload.type === 'process_user' && !payload.userId) {
      return false;
    }

    return true;
  }

  /**
   * Handle successful reminder processing
   */
  async onSuccess(result: any): Promise<void> {
    this.logger.info('Calendar reminder job completed successfully', {
      remindersSent: result.remindersSent,
      eventsProcessed: result.eventsProcessed,
    });
  }

  /**
   * Handle reminder processing failure
   */
  async onFailure(error: Error): Promise<void> {
    this.logger.error('Calendar reminder job failed', {
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Handle reminder job retry
   */
  async onRetry(attempt: number): Promise<void> {
    this.logger.warn('Retrying calendar reminder job', {
      attempt,
      maxRetries: 3,
    });
  }

  /**
   * Process all pending reminders
   */
  private async processAllReminders(): Promise<any> {
    const startTime = Date.now();
    let remindersSent = 0;
    let eventsProcessed = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing all calendar reminders');

      // Get all events with pending reminders
      const events = await this.getEventsWithPendingReminders();

      for (const event of events) {
        try {
          const sent = await this.processEventRemindersInternal(event);
          remindersSent += sent;
          eventsProcessed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Event ${event.id}: ${errorMessage}`);

          this.logger.error('Failed to process event reminders', {
            eventId: event.id,
            error: errorMessage,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'process_all',
        remindersSent,
        eventsProcessed,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing all calendar reminders', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process reminders for a specific event
   */
  private async processEventReminders(eventId: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing reminders for specific event', {
        eventId,
      });

      const event = await this.getCalendarEvent(eventId);
      if (!event) {
        throw new Error(`Calendar event not found: ${eventId}`);
      }

      const remindersSent = await this.processEventRemindersInternal(event);
      const processingTime = Date.now() - startTime;

      return {
        type: 'process_event',
        eventId,
        remindersSent,
        eventsProcessed: 1,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing event reminders', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process reminders for a specific user
   */
  private async processUserReminders(userId: string): Promise<any> {
    const startTime = Date.now();
    let remindersSent = 0;
    let eventsProcessed = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing reminders for specific user', {
        userId,
      });

      const events = await this.getUserEventsWithPendingReminders(userId);

      for (const event of events) {
        try {
          const sent = await this.processEventRemindersInternal(event);
          remindersSent += sent;
          eventsProcessed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Event ${event.id}: ${errorMessage}`);

          this.logger.error('Failed to process user event reminders', {
            eventId: event.id,
            userId,
            error: errorMessage,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'process_user',
        userId,
        remindersSent,
        eventsProcessed,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing user reminders', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process reminders for a single event
   */
  private async processEventRemindersInternal(
    event: CalendarEvent
  ): Promise<number> {
    let remindersSent = 0;
    const now = new Date();

    try {
      // Get pending reminders for this event
      const pendingReminders = event.reminders.filter(
        reminder => !reminder.sent && reminder.scheduledFor <= now
      );

      for (const reminder of pendingReminders) {
        try {
          await this.sendReminder(event, reminder);
          await this.markReminderAsSent(reminder.id);
          remindersSent++;

          this.logger.debug('Reminder sent successfully', {
            eventId: event.id,
            reminderId: reminder.id,
            type: reminder.type,
            minutesBefore: reminder.minutesBefore,
          });
        } catch (error) {
          this.logger.error('Failed to send reminder', {
            eventId: event.id,
            reminderId: reminder.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return remindersSent;
    } catch (error) {
      this.logger.error('Error processing event reminders', {
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send a reminder notification
   */
  private async sendReminder(
    event: CalendarEvent,
    reminder: CalendarReminder
  ): Promise<void> {
    const reminderData = {
      eventTitle: event.title,
      eventDescription: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      minutesBefore: reminder.minutesBefore,
      isAllDay: event.isAllDay,
    };

    switch (reminder.type) {
      case 'notification':
        await this.sendNotificationReminder(event, reminder, reminderData);
        break;
      case 'email':
        await this.sendEmailReminder(event, reminder, reminderData);
        break;
      case 'sms':
        await this.sendSMSReminder(event, reminder, reminderData);
        break;
      default:
        throw new Error(`Unknown reminder type: ${reminder.type}`);
    }
  }

  /**
   * Send in-app notification reminder
   */
  private async sendNotificationReminder(
    event: CalendarEvent,
    reminder: CalendarReminder,
    data: any
  ): Promise<void> {
    const timeText = this.formatTimeUntilEvent(reminder.minutesBefore);

    await this.notificationService.createNotification({
      type: 'calendar_reminder',
      title: 'Calendar Reminder',
      message: `"${event.title}" ${timeText}`,
      userId: event.userId,
      data: {
        ...data,
        eventId: event.id,
        reminderId: reminder.id,
      },
      channels: ['inApp'],
      priority: 'medium',
    });

    // Also notify attendees if any
    if (event.attendees && event.attendees.length > 0) {
      for (const attendeeId of event.attendees) {
        await this.notificationService.createNotification({
          type: 'calendar_reminder',
          title: 'Calendar Reminder',
          message: `"${event.title}" ${timeText}`,
          userId: attendeeId,
          data: {
            ...data,
            eventId: event.id,
            reminderId: reminder.id,
            isAttendee: true,
          },
          channels: ['inApp'],
          priority: 'medium',
        });
      }
    }
  }

  /**
   * Send email reminder
   */
  private async sendEmailReminder(
    event: CalendarEvent,
    reminder: CalendarReminder,
    data: any
  ): Promise<void> {
    const timeText = this.formatTimeUntilEvent(reminder.minutesBefore);

    // Send to event owner
    await this.emailService.sendEmail({
      to: event.userId, // This would need to be resolved to email address
      subject: `Calendar Reminder: ${event.title}`,
      template: 'calendar_reminder',
      data: {
        ...data,
        timeText,
        recipientType: 'owner',
      },
    });

    // Send to attendees if any
    if (event.attendees && event.attendees.length > 0) {
      for (const attendeeId of event.attendees) {
        await this.emailService.sendEmail({
          to: attendeeId, // This would need to be resolved to email address
          subject: `Calendar Reminder: ${event.title}`,
          template: 'calendar_reminder',
          data: {
            ...data,
            timeText,
            recipientType: 'attendee',
          },
        });
      }
    }
  }

  /**
   * Send SMS reminder
   */
  private async sendSMSReminder(
    event: CalendarEvent,
    reminder: CalendarReminder,
    data: any
  ): Promise<void> {
    const timeText = this.formatTimeUntilEvent(reminder.minutesBefore);
    const message = `Calendar Reminder: "${event.title}" ${timeText}`;

    // This would require SMS service integration
    this.logger.info('SMS reminder would be sent', {
      eventId: event.id,
      userId: event.userId,
      message,
    });
  }

  /**
   * Mark reminder as sent
   */
  private async markReminderAsSent(reminderId: string): Promise<void> {
    // This would update the reminder in the database
    await this.calendarService.updateReminder(reminderId, {
      sent: true,
      sentAt: new Date(),
    });
  }

  /**
   * Format time until event text
   */
  private formatTimeUntilEvent(minutesBefore: number): string {
    if (minutesBefore === 0) {
      return 'is starting now';
    } else if (minutesBefore < 60) {
      return `starts in ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}`;
    } else if (minutesBefore < 1440) {
      // Less than 24 hours
      const hours = Math.floor(minutesBefore / 60);
      const minutes = minutesBefore % 60;
      let text = `starts in ${hours} hour${hours === 1 ? '' : 's'}`;
      if (minutes > 0) {
        text += ` and ${minutes} minute${minutes === 1 ? '' : 's'}`;
      }
      return text;
    } else {
      const days = Math.floor(minutesBefore / 1440);
      const hours = Math.floor((minutesBefore % 1440) / 60);
      let text = `starts in ${days} day${days === 1 ? '' : 's'}`;
      if (hours > 0) {
        text += ` and ${hours} hour${hours === 1 ? '' : 's'}`;
      }
      return text;
    }
  }

  /**
   * Get all events with pending reminders
   */
  private async getEventsWithPendingReminders(): Promise<CalendarEvent[]> {
    // This would be implemented to fetch from database
    // For now, return empty array
    return [];
  }

  /**
   * Get user events with pending reminders
   */
  private async getUserEventsWithPendingReminders(
    userId: string
  ): Promise<CalendarEvent[]> {
    // This would be implemented to fetch from database
    // For now, return empty array
    return [];
  }

  /**
   * Get specific calendar event
   */
  private async getCalendarEvent(
    eventId: string
  ): Promise<CalendarEvent | null> {
    // This would be implemented to fetch from database
    // For now, return null
    return null;
  }
}
