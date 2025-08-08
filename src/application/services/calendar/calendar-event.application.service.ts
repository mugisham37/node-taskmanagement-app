import {
  BaseService,
  ServiceContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '../../services/base.service';
import { CalendarEventDomainService } from '../../domain/calendar/services/calendar-event-domain.service';
import {
  CalendarEvent,
  CreateCalendarEventProps,
  UpdateCalendarEventProps,
  EventType,
  AttendeeStatus,
} from '../../domain/calendar/entities/calendar-event.entity';
import { CalendarEventId } from '../../domain/calendar/value-objects/calendar-event-id.vo';
import { UserId } from '../../../shared/domain/value-objects/user-id.vo';
import { WorkspaceId } from '../../../shared/domain/value-objects/workspace-id.vo';
import { ProjectId } from '../../../shared/domain/value-objects/project-id.vo';
import { TaskId } from '../../../shared/domain/value-objects/task-id.vo';
import { TeamId } from '../../../shared/domain/value-objects/team-id.vo';
import {
  CalendarEventFilters,
  CalendarEventPaginationOptions,
  CalendarEventPaginatedResult,
  CalendarEventConflict,
} from '../../domain/calendar/repositories/calendar-event.repository';
import {
  notificationService,
  NotificationType,
} from '../../services/notification.service';
import { activityService } from '../../services/activity.service';
import { DomainEventBus } from '../../../shared/domain/events/domain-event-bus';

export interface CalendarEventCreateData {
  title: string;
  description?: string;
  type: EventType;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  url?: string;
  color?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  attendees?: Array<{ userId: string; status?: AttendeeStatus }>;
  reminders?: Array<{
    minutesBefore: number;
    method?: 'notification' | 'email' | 'sms';
  }>;
  metadata?: Record<string, any>;
}

export interface CalendarEventUpdateData {
  title?: string;
  description?: string;
  type?: EventType;
  startDate?: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  url?: string;
  color?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  metadata?: Record<string, any>;
}

export interface CalendarEventStats {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  eventsByType: Record<string, number>;
  averageDuration: number;
  busyHours: Array<{ hour: number; eventCount: number }>;
  conflictRate: number;
  utilizationRate: number;
}

export interface EventSchedulingOptions {
  skipConflictCheck?: boolean;
  allowOverlap?: boolean;
  maxConflicts?: number;
  severity?: 'low' | 'medium' | 'high';
}

export interface OptimalTimeSlot {
  startTime: Date;
  endTime: Date;
  score: number;
}

export class CalendarEventApplicationService extends BaseService {
  constructor(
    private readonly calendarEventDomainService: CalendarEventDomainService,
    private readonly domainEventBus: DomainEventBus
  ) {
    super('CalendarEventApplicationService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache for calendar events
      enableAudit: true,
      enableMetrics: true,
    });
  }

  // Core CRUD Operations
  async createCalendarEvent(
    data: CalendarEventCreateData,
    context?: ServiceContext
  ): Promise<{ event: CalendarEvent; conflicts: CalendarEventConflict[] }> {
    const ctx = this.createContext(context);
    this.logOperation('createCalendarEvent', ctx, {
      title: data.title,
      type: data.type,
      startDate: data.startDate,
      attendeeCount: data.attendees?.length || 0,
    });

    try {
      // Validate input
      this.validateCalendarEventData(data);

      // Verify access permissions
      await this.verifyCreatePermissions(data, ctx.userId!);

      // Create domain props
      const createProps: CreateCalendarEventProps = {
        ...data,
        userId: ctx.userId!,
      };

      // Create event using domain service
      const result =
        await this.calendarEventDomainService.createCalendarEvent(createProps);

      // Publish domain events
      await this.publishDomainEvents(result.event);

      // Send notifications to attendees
      if (data.attendees && data.attendees.length > 0) {
        await this.sendEventInvitations(
          result.event,
          data.attendees.map(a => a.userId)
        );
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_created', // Using closest available type
          data: {
            action: 'calendar_event_created',
            eventTitle: result.event.title.value,
            eventType: result.event.type,
            attendeeCount: data.attendees?.length || 0,
          },
          metadata: {
            eventId: result.event.id.value,
            startDate: result.event.startDate.value.toISOString(),
          },
        },
        ctx
      );

      await this.recordMetric('calendar_event.created', 1, {
        type: result.event.type,
        hasAttendees:
          data.attendees && data.attendees.length > 0 ? 'true' : 'false',
        isRecurring: result.event.isRecurring ? 'true' : 'false',
        hasReminders:
          data.reminders && data.reminders.length > 0 ? 'true' : 'false',
      });

      return result;
    } catch (error) {
      this.handleError(error, 'createCalendarEvent', ctx);
    }
  }

  async getCalendarEventById(
    id: string,
    context?: ServiceContext
  ): Promise<CalendarEvent> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarEventById', ctx, { eventId: id });

    try {
      const eventId = CalendarEventId.create(id);
      const event =
        await this.calendarEventDomainService.getCalendarEventById(eventId);

      if (!event) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Check access permissions
      await this.verifyEventAccess(event, ctx.userId!);

      return event;
    } catch (error) {
      this.handleError(error, 'getCalendarEventById', ctx);
    }
  }

  async getCalendarEvents(
    filters: Partial<CalendarEventFilters> = {},
    options: CalendarEventPaginationOptions = {},
    context?: ServiceContext
  ): Promise<CalendarEventPaginatedResult> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarEvents', ctx, { filters, options });

    try {
      // Add user context to filters
      const domainFilters: CalendarEventFilters = {
        ...filters,
        userId: UserId.create(ctx.userId!),
      };

      // Convert string IDs to value objects
      if (filters.workspaceId) {
        domainFilters.workspaceId = WorkspaceId.create(filters.workspaceId);
      }
      if (filters.teamId) {
        domainFilters.teamId = TeamId.create(filters.teamId);
      }
      if (filters.projectId) {
        domainFilters.projectId = ProjectId.create(filters.projectId);
      }
      if (filters.taskId) {
        domainFilters.taskId = TaskId.create(filters.taskId);
      }

      const result = await this.calendarEventDomainService.findCalendarEvents(
        domainFilters,
        options
      );

      return result;
    } catch (error) {
      this.handleError(error, 'getCalendarEvents', ctx);
    }
  }

  async updateCalendarEvent(
    id: string,
    data: CalendarEventUpdateData,
    context?: ServiceContext
  ): Promise<{ event: CalendarEvent; conflicts: CalendarEventConflict[] }> {
    const ctx = this.createContext(context);
    this.logOperation('updateCalendarEvent', ctx, {
      eventId: id,
      updates: Object.keys(data),
    });

    try {
      const eventId = CalendarEventId.create(id);
      const existingEvent =
        await this.calendarEventDomainService.getCalendarEventById(eventId);

      if (!existingEvent) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Check permissions - only creator can update
      if (existingEvent.userId.value !== ctx.userId) {
        throw new ForbiddenError(
          'Only the event creator can update this event'
        );
      }

      // Validate updates
      this.validateCalendarEventUpdateData(data);

      // Update using domain service
      const result = await this.calendarEventDomainService.updateCalendarEvent(
        eventId,
        data
      );

      // Publish domain events
      await this.publishDomainEvents(result.event);

      // Send update notifications to attendees if dates changed
      const isDateChanged = data.startDate || data.endDate;
      if (isDateChanged) {
        await this.sendEventUpdateNotifications(result.event);
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_updated', // Using closest available type
          data: {
            action: 'calendar_event_updated',
            eventTitle: result.event.title.value,
            changes: Object.keys(data),
            dateChanged: isDateChanged,
          },
          metadata: {
            eventId: result.event.id.value,
          },
        },
        ctx
      );

      await this.recordMetric('calendar_event.updated', 1, {
        dateChanged: isDateChanged ? 'true' : 'false',
      });

      return result;
    } catch (error) {
      this.handleError(error, 'updateCalendarEvent', ctx);
    }
  }

  async deleteCalendarEvent(
    id: string,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteCalendarEvent', ctx, { eventId: id });

    try {
      const eventId = CalendarEventId.create(id);
      const event =
        await this.calendarEventDomainService.getCalendarEventById(eventId);

      if (!event) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Check permissions - only creator can delete
      if (event.userId.value !== ctx.userId) {
        throw new ForbiddenError(
          'Only the event creator can delete this event'
        );
      }

      // Send cancellation notifications to attendees
      await this.sendEventCancellationNotifications(event);

      // Delete using domain service
      await this.calendarEventDomainService.deleteCalendarEvent(eventId);

      // Publish domain events
      await this.publishDomainEvents(event);

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'calendar_event_deleted',
          data: {
            eventTitle: event.title.value,
            eventType: event.type,
          },
          metadata: {
            eventId: id,
          },
        },
        ctx
      );

      await this.recordMetric('calendar_event.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteCalendarEvent', ctx);
    }
  }

  // Advanced Features
  async scheduleEventWithConflictResolution(
    data: CalendarEventCreateData,
    options: EventSchedulingOptions = {},
    context?: ServiceContext
  ): Promise<{
    success: boolean;
    event?: CalendarEvent;
    conflicts: CalendarEventConflict[];
    warnings: string[];
  }> {
    const ctx = this.createContext(context);
    this.logOperation('scheduleEventWithConflictResolution', ctx, {
      title: data.title,
      options,
    });

    try {
      // Validate input
      this.validateCalendarEventData(data);

      // Verify access permissions
      await this.verifyCreatePermissions(data, ctx.userId!);

      // Use domain service for intelligent scheduling
      const result =
        await this.calendarEventDomainService.scheduleEventWithConflictResolution(
          { ...data, userId: ctx.userId! },
          {
            severity: options.severity || 'medium',
            allowOverlap: options.allowOverlap || false,
            maxConflicts: options.maxConflicts || 3,
          }
        );

      let event: CalendarEvent | undefined;
      if (result.success) {
        // Get the created event
        const events = await this.calendarEventDomainService.findCalendarEvents(
          {
            userId: UserId.create(ctx.userId!),
            startDate: data.startDate,
            endDate: data.endDate,
          },
          { limit: 1, sortBy: 'createdAt', sortOrder: 'desc' }
        );

        event = events.data[0];

        if (event) {
          await this.publishDomainEvents(event);
        }
      }

      return {
        success: result.success,
        event,
        conflicts: result.conflicts,
        warnings: result.warnings,
      };
    } catch (error) {
      this.handleError(error, 'scheduleEventWithConflictResolution', ctx);
    }
  }

  async findOptimalTimeSlots(
    duration: number,
    startDate: Date,
    endDate: Date,
    workingHours?: { start: number; end: number },
    context?: ServiceContext
  ): Promise<OptimalTimeSlot[]> {
    const ctx = this.createContext(context);
    this.logOperation('findOptimalTimeSlots', ctx, {
      duration,
      startDate,
      endDate,
    });

    try {
      const userId = UserId.create(ctx.userId!);
      const slots = await this.calendarEventDomainService.findOptimalTimeSlots(
        userId,
        duration,
        startDate,
        endDate,
        workingHours
      );

      return slots;
    } catch (error) {
      this.handleError(error, 'findOptimalTimeSlots', ctx);
    }
  }

  async getCalendarEventStats(
    startDate?: Date,
    endDate?: Date,
    context?: ServiceContext
  ): Promise<CalendarEventStats> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarEventStats', ctx, { startDate, endDate });

    try {
      const userId = UserId.create(ctx.userId!);
      const stats = await this.calendarEventDomainService.getCalendarStatistics(
        userId,
        startDate,
        endDate
      );

      return stats;
    } catch (error) {
      this.handleError(error, 'getCalendarEventStats', ctx);
    }
  }

  // Attendee Management
  async addEventAttendees(
    eventId: string,
    attendees: Array<{ userId: string; status?: AttendeeStatus }>,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('addEventAttendees', ctx, {
      eventId,
      attendeeCount: attendees.length,
    });

    try {
      const event = await this.getCalendarEventById(eventId, ctx);

      // Check permissions - only creator can add attendees
      if (event.userId.value !== ctx.userId) {
        throw new ForbiddenError('Only the event creator can add attendees');
      }

      // Add attendees to the event
      for (const attendee of attendees) {
        event.addAttendee(
          attendee.userId,
          attendee.status || AttendeeStatus.PENDING
        );
      }

      // Save the updated event
      await this.calendarEventDomainService.updateCalendarEvent(
        CalendarEventId.create(eventId),
        {} // No direct updates, just trigger save
      );

      // Send invitations
      await this.sendEventInvitations(
        event,
        attendees.map(a => a.userId)
      );

      await this.recordMetric(
        'calendar_event.attendees.added',
        attendees.length
      );
    } catch (error) {
      this.handleError(error, 'addEventAttendees', ctx);
    }
  }

  async removeEventAttendees(
    eventId: string,
    attendeeIds: string[],
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('removeEventAttendees', ctx, {
      eventId,
      attendeeCount: attendeeIds.length,
    });

    try {
      const event = await this.getCalendarEventById(eventId, ctx);

      // Check permissions - only creator can remove attendees
      if (event.userId.value !== ctx.userId) {
        throw new ForbiddenError('Only the event creator can remove attendees');
      }

      // Remove attendees from the event
      for (const attendeeId of attendeeIds) {
        event.removeAttendee(attendeeId);
      }

      // Save the updated event
      await this.calendarEventDomainService.updateCalendarEvent(
        CalendarEventId.create(eventId),
        {} // No direct updates, just trigger save
      );

      await this.recordMetric(
        'calendar_event.attendees.removed',
        attendeeIds.length
      );
    } catch (error) {
      this.handleError(error, 'removeEventAttendees', ctx);
    }
  }

  async respondToEventInvitation(
    eventId: string,
    status: AttendeeStatus,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('respondToEventInvitation', ctx, { eventId, status });

    try {
      const event = await this.getCalendarEventById(eventId, ctx);

      // Update attendee status
      event.updateAttendeeStatus(ctx.userId!, status);

      // Save the updated event
      await this.calendarEventDomainService.updateCalendarEvent(
        CalendarEventId.create(eventId),
        {} // No direct updates, just trigger save
      );

      // Notify event creator
      await this.sendAttendeeResponseNotification(event, ctx.userId!, status);

      await this.recordMetric('calendar_event.invitation.responded', 1, {
        status,
      });
    } catch (error) {
      this.handleError(error, 'respondToEventInvitation', ctx);
    }
  }

  // Reminder Management
  async addEventReminders(
    eventId: string,
    reminders: Array<{
      minutesBefore: number;
      method?: 'notification' | 'email' | 'sms';
    }>,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('addEventReminders', ctx, {
      eventId,
      reminderCount: reminders.length,
    });

    try {
      const event = await this.getCalendarEventById(eventId, ctx);

      // Check permissions - only creator and attendees can add reminders
      if (
        event.userId.value !== ctx.userId &&
        !this.isEventAttendee(event, ctx.userId!)
      ) {
        throw new ForbiddenError(
          'Only the event creator and attendees can add reminders'
        );
      }

      // Add reminders to the event
      for (const reminder of reminders) {
        event.addReminder(
          reminder.minutesBefore,
          reminder.method || 'notification'
        );
      }

      // Save the updated event
      await this.calendarEventDomainService.updateCalendarEvent(
        CalendarEventId.create(eventId),
        {} // No direct updates, just trigger save
      );

      await this.recordMetric(
        'calendar_event.reminders.added',
        reminders.length
      );
    } catch (error) {
      this.handleError(error, 'addEventReminders', ctx);
    }
  }

  async removeEventReminders(
    eventId: string,
    reminderIds: string[],
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('removeEventReminders', ctx, {
      eventId,
      reminderCount: reminderIds.length,
    });

    try {
      const event = await this.getCalendarEventById(eventId, ctx);

      // Check permissions - only creator and attendees can remove reminders
      if (
        event.userId.value !== ctx.userId &&
        !this.isEventAttendee(event, ctx.userId!)
      ) {
        throw new ForbiddenError(
          'Only the event creator and attendees can remove reminders'
        );
      }

      // Remove reminders from the event
      for (const reminderId of reminderIds) {
        event.removeReminder(reminderId);
      }

      // Save the updated event
      await this.calendarEventDomainService.updateCalendarEvent(
        CalendarEventId.create(eventId),
        {} // No direct updates, just trigger save
      );

      await this.recordMetric(
        'calendar_event.reminders.removed',
        reminderIds.length
      );
    } catch (error) {
      this.handleError(error, 'removeEventReminders', ctx);
    }
  }

  // Recurring Events
  async processRecurringEvents(
    startDate: Date,
    endDate: Date,
    context?: ServiceContext
  ): Promise<CalendarEvent[]> {
    const ctx = this.createContext(context);
    this.logOperation('processRecurringEvents', ctx, { startDate, endDate });

    try {
      const generatedEvents =
        await this.calendarEventDomainService.processRecurringEvents(
          startDate,
          endDate
        );

      // Publish domain events for generated events
      for (const event of generatedEvents) {
        await this.publishDomainEvents(event);
      }

      await this.recordMetric(
        'calendar_event.recurring.processed',
        generatedEvents.length
      );

      return generatedEvents;
    } catch (error) {
      this.handleError(error, 'processRecurringEvents', ctx);
    }
  }

  // Private Helper Methods
  private async verifyEventAccess(
    event: CalendarEvent,
    userId: string
  ): Promise<void> {
    // User can access event if they are:
    // 1. The creator
    // 2. An attendee
    // 3. Have access to the workspace/team/project

    if (event.userId.value === userId) {
      return;
    }

    // Check if user is an attendee
    if (this.isEventAttendee(event, userId)) {
      return;
    }

    // Check workspace/team/project access
    if (
      event.workspaceId &&
      (await this.hasWorkspaceAccess(userId, event.workspaceId.value))
    ) {
      return;
    }

    if (
      event.teamId &&
      (await this.hasTeamAccess(userId, event.teamId.value))
    ) {
      return;
    }

    if (
      event.projectId &&
      (await this.hasProjectAccess(userId, event.projectId.value))
    ) {
      return;
    }

    throw new ForbiddenError('You do not have access to this calendar event');
  }

  private async verifyCreatePermissions(
    data: CalendarEventCreateData,
    userId: string
  ): Promise<void> {
    // Verify workspace access if specified
    if (
      data.workspaceId &&
      !(await this.hasWorkspaceAccess(userId, data.workspaceId))
    ) {
      throw new ForbiddenError('You do not have access to this workspace');
    }

    // Verify team access if specified
    if (data.teamId && !(await this.hasTeamAccess(userId, data.teamId))) {
      throw new ForbiddenError('You do not have access to this team');
    }

    // Verify project access if specified
    if (
      data.projectId &&
      !(await this.hasProjectAccess(userId, data.projectId))
    ) {
      throw new ForbiddenError('You do not have access to this project');
    }

    // Verify task access if specified
    if (data.taskId && !(await this.hasTaskAccess(userId, data.taskId))) {
      throw new ForbiddenError('You do not have access to this task');
    }
  }

  private isEventAttendee(event: CalendarEvent, userId: string): boolean {
    return event.attendees.some(attendee => attendee.userId.value === userId);
  }

  private async hasWorkspaceAccess(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    // Implementation would check workspace membership
    return true; // Placeholder
  }

  private async hasTeamAccess(
    userId: string,
    teamId: string
  ): Promise<boolean> {
    // Implementation would check team membership
    return true; // Placeholder
  }

  private async hasProjectAccess(
    userId: string,
    projectId: string
  ): Promise<boolean> {
    // Implementation would check project access
    return true; // Placeholder
  }

  private async hasTaskAccess(
    userId: string,
    taskId: string
  ): Promise<boolean> {
    // Implementation would check task access
    return true; // Placeholder
  }

  private validateCalendarEventData(data: CalendarEventCreateData): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Event title is required');
    }

    if (data.title.length > 200) {
      throw new ValidationError('Event title must be less than 200 characters');
    }

    if (!data.startDate) {
      throw new ValidationError('Start date is required');
    }

    if (data.endDate && data.endDate <= data.startDate) {
      throw new ValidationError('End date must be after start date');
    }

    if (data.description && data.description.length > 1000) {
      throw new ValidationError(
        'Event description must be less than 1000 characters'
      );
    }

    if (data.location && data.location.length > 500) {
      throw new ValidationError(
        'Event location must be less than 500 characters'
      );
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Event color must be a valid hex color code');
    }
  }

  private validateCalendarEventUpdateData(data: CalendarEventUpdateData): void {
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new ValidationError('Event title is required');
      }
      if (data.title.length > 200) {
        throw new ValidationError(
          'Event title must be less than 200 characters'
        );
      }
    }

    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      throw new ValidationError('End date must be after start date');
    }

    if (
      data.description !== undefined &&
      data.description &&
      data.description.length > 1000
    ) {
      throw new ValidationError(
        'Event description must be less than 1000 characters'
      );
    }

    if (
      data.location !== undefined &&
      data.location &&
      data.location.length > 500
    ) {
      throw new ValidationError(
        'Event location must be less than 500 characters'
      );
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Event color must be a valid hex color code');
    }
  }

  private async publishDomainEvents(event: CalendarEvent): Promise<void> {
    const domainEvents = event.getDomainEvents();
    for (const domainEvent of domainEvents) {
      await this.domainEventBus.publish(domainEvent);
    }
    event.clearDomainEvents();
  }

  private async sendEventInvitations(
    event: CalendarEvent,
    attendeeIds: string[]
  ): Promise<void> {
    for (const attendeeId of attendeeIds) {
      try {
        await notificationService.createNotification({
          userId: attendeeId,
          type: NotificationType.CALENDAR_REMINDER,
          title: 'Event Invitation',
          message: `You have been invited to "${event.title.value}" on ${event.startDate.value.toLocaleDateString()}`,
          data: {
            eventId: event.id.value,
            eventTitle: event.title.value,
            eventDate: event.startDate.value.toISOString(),
          },
        });
      } catch (error) {
        console.error(`Failed to send invitation to ${attendeeId}:`, error);
      }
    }
  }

  private async sendEventUpdateNotifications(
    event: CalendarEvent
  ): Promise<void> {
    const attendeeIds = event.attendees.map(a => a.userId.value);

    for (const attendeeId of attendeeIds) {
      try {
        await notificationService.createNotification({
          userId: attendeeId,
          type: NotificationType.CALENDAR_REMINDER,
          title: 'Event Updated',
          message: `"${event.title.value}" has been updated`,
          data: {
            eventId: event.id.value,
            eventTitle: event.title.value,
            eventDate: event.startDate.value.toISOString(),
          },
        });
      } catch (error) {
        console.error(
          `Failed to send update notification to ${attendeeId}:`,
          error
        );
      }
    }
  }

  private async sendEventCancellationNotifications(
    event: CalendarEvent
  ): Promise<void> {
    const attendeeIds = event.attendees.map(a => a.userId.value);

    for (const attendeeId of attendeeIds) {
      try {
        await notificationService.createNotification({
          userId: attendeeId,
          type: NotificationType.CALENDAR_REMINDER,
          title: 'Event Cancelled',
          message: `"${event.title.value}" has been cancelled`,
          data: {
            eventId: event.id.value,
            eventTitle: event.title.value,
            eventDate: event.startDate.value.toISOString(),
          },
        });
      } catch (error) {
        console.error(
          `Failed to send cancellation notification to ${attendeeId}:`,
          error
        );
      }
    }
  }

  private async sendAttendeeResponseNotification(
    event: CalendarEvent,
    attendeeId: string,
    status: AttendeeStatus
  ): Promise<void> {
    try {
      await notificationService.createNotification({
        userId: event.userId.value,
        type: NotificationType.CALENDAR_REMINDER,
        title: 'Event Response',
        message: `An attendee has ${status} your event "${event.title.value}"`,
        data: {
          eventId: event.id.value,
          eventTitle: event.title.value,
          attendeeId,
          response: status,
        },
      });
    } catch (error) {
      console.error(`Failed to send response notification:`, error);
    }
  }
}
