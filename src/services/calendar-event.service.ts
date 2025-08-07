import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray, between, ne } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError, ConflictError } from './base.service';
import { 
  calendarEventRepository, 
  userRepository, 
  workspaceRepository, 
  teamRepository,
  taskRepository,
  projectRepository,
  notificationRepository
} from '../db/repositories';
import { CalendarEvent, NewCalendarEvent, EventType } from '../db/schema/calendar-events';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import { notificationService, NotificationType } from './notification.service';
import { activityService } from './activity.service';

export interface CalendarEventFilters {
  type?: EventType | EventType[];
  startDate?: Date;
  endDate?: Date;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  isRecurring?: boolean;
  search?: string;
}

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
  isRecurring?: boolean;
  recurrenceRule?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  attendeeIds?: string[];
  reminderMinutes?: number[];
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
  isRecurring?: boolean;
  recurrenceRule?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface CalendarEventConflict {
  eventId: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  conflictType: 'overlap' | 'double_booking';
  severity: 'low' | 'medium' | 'high';
}

export interface CalendarEventStats {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  eventsByType: Record<string, number>;
  averageDuration: number;
  busyHours: Array<{ hour: number; eventCount: number }>;
}

export class CalendarEventService extends BaseService {
  constructor() {
    super('CalendarEventService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache for calendar events
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createCalendarEvent(data: CalendarEventCreateData, context?: ServiceContext): Promise<CalendarEvent> {
    const ctx = this.createContext(context);
    this.logOperation('createCalendarEvent', ctx, { 
      title: data.title, 
      type: data.type,
      startDate: data.startDate,
      attendeeCount: data.attendeeIds?.length || 0
    });

    try {
      // Validate input
      this.validateCalendarEventData(data);

      // Check for scheduling conflicts
      const conflicts = await this.checkSchedulingConflicts(data, ctx.userId!);
      if (conflicts.length > 0) {
        const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
        if (highSeverityConflicts.length > 0) {
          throw new ConflictError('High severity scheduling conflicts detected');
        }
      }

      // Verify workspace access if specified
      if (data.workspaceId) {
        await this.verifyWorkspaceAccess(data.workspaceId, ctx.userId!);
      }

      // Verify team access if specified
      if (data.teamId) {
        await this.verifyTeamAccess(data.teamId, ctx.userId!);
      }

      // Verify project access if specified
      if (data.projectId) {
        await this.verifyProjectAccess(data.projectId, ctx.userId!);
      }

      // Verify task access if specified
      if (data.taskId) {
        await this.verifyTaskAccess(data.taskId, ctx.userId!);
      }

      // Validate attendees
      if (data.attendeeIds) {
        await this.validateAttendees(data.attendeeIds);
      }

      // Create calendar event
      const newEvent: NewCalendarEvent = {
        title: data.title,
        description: data.description,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay || false,
        location: data.location,
        url: data.url,
        color: data.color || '#4f46e5',
        userId: ctx.userId!,
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        projectId: data.projectId,
        taskId: data.taskId,
        isRecurring: data.isRecurring || false,
        recurrenceRule: data.recurrenceRule,
        metadata: data.metadata || {}
      };

      const event = await calendarEventRepository.create(newEvent);

      // Add attendees if specified
      if (data.attendeeIds && data.attendeeIds.length > 0) {
        await this.addEventAttendees(event.id, data.attendeeIds);
      }

      // Add reminders if specified
      if (data.reminderMinutes && data.reminderMinutes.length > 0) {
        await this.addEventReminders(event.id, ctx.userId!, data.reminderMinutes);
      }

      // Send invitations to attendees
      if (data.attendeeIds && data.attendeeIds.length > 0) {
        await this.sendEventInvitations(event, data.attendeeIds);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'task_created', // Using closest available type
        data: {
          action: 'calendar_event_created',
          eventTitle: event.title,
          eventType: event.type,
          attendeeCount: data.attendeeIds?.length || 0
        },
        metadata: {
          eventId: event.id,
          startDate: event.startDate.toISOString()
        }
      }, ctx);

      await this.recordMetric('calendar_event.created', 1, { 
        type: event.type,
        hasAttendees: data.attendeeIds && data.attendeeIds.length > 0 ? 'true' : 'false',
        isRecurring: event.isRecurring ? 'true' : 'false',
        hasReminders: data.reminderMinutes && data.reminderMinutes.length > 0 ? 'true' : 'false'
      });

      return event;
    } catch (error) {
      this.handleError(error, 'createCalendarEvent', ctx);
    }
  }

  async getCalendarEventById(id: string, context?: ServiceContext): Promise<CalendarEvent> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarEventById', ctx, { eventId: id });

    try {
      const event = await calendarEventRepository.findById(id);
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
    filters: CalendarEventFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<CalendarEvent>> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarEvents', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildEventWhereConditions(filters, ctx.userId!);
      
      const result = await calendarEventRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'startDate',
        sortOrder: 'asc' // Upcoming events first
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getCalendarEvents', ctx);
    }
  }

  async updateCalendarEvent(id: string, data: CalendarEventUpdateData, context?: ServiceContext): Promise<CalendarEvent> {
    const ctx = this.createContext(context);
    this.logOperation('updateCalendarEvent', ctx, { eventId: id, updates: Object.keys(data) });

    try {
      const existingEvent = await calendarEventRepository.findById(id);
      if (!existingEvent) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Check permissions - only creator can update
      if (existingEvent.userId !== ctx.userId) {
        throw new ForbiddenError('Only the event creator can update this event');
      }

      // Validate updates
      this.validateCalendarEventUpdateData(data);

      // Check for scheduling conflicts if dates are being changed
      if (data.startDate || data.endDate) {
        const eventData = {
          ...existingEvent,
          ...data,
          startDate: data.startDate || existingEvent.startDate,
          endDate: data.endDate || existingEvent.endDate
        };
        
        const conflicts = await this.checkSchedulingConflicts(eventData as any, ctx.userId!, id);
        if (conflicts.length > 0) {
          const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
          if (highSeverityConflicts.length > 0) {
            throw new ConflictError('High severity scheduling conflicts detected');
          }
        }
      }

      // Track changes for notifications
      const isDateChanged = data.startDate || data.endDate;

      const updatedEvent = await calendarEventRepository.update(id, {
        ...data,
        updatedAt: new Date()
      });

      if (!updatedEvent) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Send update notifications to attendees
      if (isDateChanged) {
        await this.sendEventUpdateNotifications(updatedEvent);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'task_updated', // Using closest available type
        data: {
          action: 'calendar_event_updated',
          eventTitle: updatedEvent.title,
          changes: Object.keys(data),
          dateChanged: isDateChanged
        },
        metadata: {
          eventId: updatedEvent.id
        }
      }, ctx);

      await this.recordMetric('calendar_event.updated', 1, { 
        dateChanged: isDateChanged ? 'true' : 'false'
      });

      return updatedEvent;
    } catch (error) {
      this.handleError(error, 'updateCalendarEvent', ctx);
    }
  }

  async deleteCalendarEvent(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteCalendarEvent', ctx, { eventId: id });

    try {
      const event = await calendarEventRepository.findById(id);
      if (!event) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Check permissions - only creator can delete
      if (event.userId !== ctx.userId) {
        throw new ForbiddenError('Only the event creator can delete this event');
      }

      // Send cancellation notifications to attendees
      await this.sendEventCancellationNotifications(event);

      const success = await calendarEventRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Calendar Event', id);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'calendar_event_deleted',
        data: {
          eventTitle: event.title,
          eventType: event.type
        },
        metadata: {
          eventId: id
        }
      }, ctx);

      await this.recordMetric('calendar_event.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteCalendarEvent', ctx);
    }
  }

  // Conflict Detection
  async checkSchedulingConflicts(
    eventData: CalendarEventCreateData | CalendarEventUpdateData,
    userId: string,
    excludeEventId?: string
  ): Promise<CalendarEventConflict[]> {
    try {
      const conflicts: CalendarEventConflict[] = [];

      if (!eventData.startDate) {
        return conflicts;
      }

      // Build conditions for overlapping events
      const conditions = [
        eq(calendarEventRepository['table']?.userId, userId),
        gte(calendarEventRepository['table']?.startDate, eventData.startDate)
      ];

      if (eventData.endDate) {
        conditions.push(lte(calendarEventRepository['table']?.startDate, eventData.endDate));
      }

      if (excludeEventId) {
        conditions.push(ne(calendarEventRepository['table']?.id, excludeEventId));
      }

      // Get user's events in the time range
      const userEvents = await calendarEventRepository.findMany({
        where: and(...conditions),
        limit: 1000
      });

      for (const existingEvent of userEvents.data) {
        const conflict = this.detectEventConflict(eventData, existingEvent);
        if (conflict) {
          conflicts.push(conflict);
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking scheduling conflicts:', error);
      return [];
    }
  }

  // Analytics and Statistics
  async getCalendarEventStats(
    userId?: string,
    dateRange?: { startDate: Date; endDate: Date },
    context?: ServiceContext
  ): Promise<CalendarEventStats> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarEventStats', ctx, { userId, dateRange });

    try {
      // Set default date range (last 30 days)
      const range = dateRange || {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      // Build query conditions
      const conditions = [];
      
      if (userId) {
        // Verify user access
        if (userId !== ctx.userId && ctx.userRole !== 'admin') {
          throw new ForbiddenError('You can only view your own calendar statistics');
        }
        conditions.push(eq(calendarEventRepository['table']?.userId, userId));
      }

      conditions.push(gte(calendarEventRepository['table']?.startDate, range.startDate));
      conditions.push(lte(calendarEventRepository['table']?.startDate, range.endDate));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get all events for analysis
      const allEvents = await calendarEventRepository.findMany({
        where: whereClause,
        limit: 10000 // Large limit for comprehensive stats
      });

      const events = allEvents.data;
      const now = new Date();

      // Calculate statistics
      const stats: CalendarEventStats = {
        totalEvents: events.length,
        upcomingEvents: events.filter(e => new Date(e.startDate) > now).length,
        pastEvents: events.filter(e => new Date(e.startDate) <= now).length,
        eventsByType: this.groupEventsByType(events),
        averageDuration: this.calculateAverageDuration(events),
        busyHours: this.calculateBusyHours(events)
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getCalendarEventStats', ctx);
    }
  }

  // Reminder System
  async processEventReminders(): Promise<{ processed: number; sent: number; failed: number }> {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Get upcoming events with reminders
      const upcomingEvents = await calendarEventRepository.findMany({
        where: and(
          gte(calendarEventRepository['table']?.startDate, now),
          lte(calendarEventRepository['table']?.startDate, oneHourFromNow)
        ),
        limit: 1000
      });

      let processed = 0;
      let sent = 0;
      let failed = 0;

      for (const event of upcomingEvents.data) {
        try {
          processed++;
          const remindersSent = await this.processEventReminder(event);
          sent += remindersSent;
        } catch (error) {
          failed++;
          console.error(`Failed to process reminders for event ${event.id}:`, error);
        }
      }

      await this.recordMetric('calendar_event.reminders.processed', processed);
      await this.recordMetric('calendar_event.reminders.sent', sent);
      await this.recordMetric('calendar_event.reminders.failed', failed);

      return { processed, sent, failed };
    } catch (error) {
      console.error('Error processing event reminders:', error);
      return { processed: 0, sent: 0, failed: 0 };
    }
  }

  // Private Helper Methods
  private async verifyEventAccess(event: CalendarEvent, userId: string): Promise<void> {
    // User can access event if they are:
    // 1. The creator
    // 2. Have access to the workspace/team/project
    // 3. Admin
    
    if (event.userId === userId) {
      return;
    }

    // Check workspace/team/project access
    if (event.workspaceId && await this.hasWorkspaceAccess(userId, event.workspaceId)) {
      return;
    }

    if (event.teamId && await this.hasTeamAccess(userId, event.teamId)) {
      return;
    }

    if (event.projectId && await this.hasProjectAccess(userId, event.projectId)) {
      return;
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this calendar event');
  }

  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }
    // Add workspace member check logic here
  }

  private async verifyTeamAccess(teamId: string, userId: string): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }
    // Add team member check logic here
  }

  private async verifyProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    // Add project access check logic here
  }

  private async verifyTaskAccess(taskId: string, userId: string): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    // Add task access check logic here
  }

  private async hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) return false;
    // Add workspace member check logic here
    return true; // Placeholder
  }

  private async hasTeamAccess(userId: string, teamId: string): Promise<boolean> {
    const team = await teamRepository.findById(teamId);
    if (!team) return false;
    // Add team member check logic here
    return true; // Placeholder
  }

  private async hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const project = await projectRepository.findById(projectId);
    if (!project) return false;
    // Add project access check logic here
    return true; // Placeholder
  }

  private buildEventWhereConditions(filters: CalendarEventFilters, userId: string): any {
    const conditions = [eq(calendarEventRepository['table']?.userId, userId)];

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        conditions.push(inArray(calendarEventRepository['table']?.type, filters.type));
      } else {
        conditions.push(eq(calendarEventRepository['table']?.type, filters.type));
      }
    }

    if (filters.startDate) {
      conditions.push(gte(calendarEventRepository['table']?.startDate, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(calendarEventRepository['table']?.startDate, filters.endDate));
    }

    if (filters.workspaceId) {
      conditions.push(eq(calendarEventRepository['table']?.workspaceId, filters.workspaceId));
    }

    if (filters.teamId) {
      conditions.push(eq(calendarEventRepository['table']?.teamId, filters.teamId));
    }

    if (filters.projectId) {
      conditions.push(eq(calendarEventRepository['table']?.projectId, filters.projectId));
    }

    if (filters.taskId) {
      conditions.push(eq(calendarEventRepository['table']?.taskId, filters.taskId));
    }

    if (filters.isRecurring !== undefined) {
      conditions.push(eq(calendarEventRepository['table']?.isRecurring, filters.isRecurring));
    }

    if (filters.search) {
      conditions.push(ilike(calendarEventRepository['table']?.title, `%${filters.search}%`));
    }

    return and(...conditions);
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
      throw new ValidationError('Event description must be less than 1000 characters');
    }

    if (data.location && data.location.length > 500) {
      throw new ValidationError('Event location must be less than 500 characters');
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
        throw new ValidationError('Event title must be less than 200 characters');
      }
    }

    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      throw new ValidationError('End date must be after start date');
    }

    if (data.description !== undefined && data.description && data.description.length > 1000) {
      throw new ValidationError('Event description must be less than 1000 characters');
    }

    if (data.location !== undefined && data.location && data.location.length > 500) {
      throw new ValidationError('Event location must be less than 500 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Event color must be a valid hex color code');
    }
  }

  private async validateAttendees(attendeeIds: string[]): Promise<void> {
    for (const attendeeId of attendeeIds) {
      const user = await userRepository.findById(attendeeId);
      if (!user) {
        throw new NotFoundError('User', attendeeId);
      }
    }
  }

  private detectEventConflict(
    eventData: CalendarEventCreateData | CalendarEventUpdateData,
    existingEvent: CalendarEvent
  ): CalendarEventConflict | null {
    if (!eventData.startDate) return null;

    const newStart = new Date(eventData.startDate);
    const newEnd = eventData.endDate ? new Date(eventData.endDate) : new Date(newStart.getTime() + 60 * 60 * 1000); // Default 1 hour
    const existingStart = new Date(existingEvent.startDate);
    const existingEnd = existingEvent.endDate ? new Date(existingEvent.endDate) : new Date(existingStart.getTime() + 60 * 60 * 1000);

    // Check for overlap
    const hasOverlap = newStart < existingEnd && newEnd > existingStart;

    if (hasOverlap) {
      return {
        eventId: existingEvent.id,
        title: existingEvent.title,
        startDate: existingEvent.startDate,
        endDate: existingEvent.endDate,
        conflictType: 'overlap',
        severity: 'medium'
      };
    }

    return null;
  }

  private groupEventsByType(events: CalendarEvent[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    events.forEach(event => {
      grouped[event.type] = (grouped[event.type] || 0) + 1;
    });
    return grouped;
  }

  private calculateAverageDuration(events: CalendarEvent[]): number {
    const eventsWithDuration = events.filter(e => e.endDate);
    
    if (eventsWithDuration.length === 0) return 0;
    
    const totalDuration = eventsWithDuration.reduce((sum, event) => {
      const start = new Date(event.startDate).getTime();
      const end = new Date(event.endDate!).getTime();
      return sum + (end - start);
    }, 0);
    
    return totalDuration / eventsWithDuration.length / (1000 * 60 * 60); // Convert to hours
  }

  private calculateBusyHours(events: CalendarEvent[]): Array<{ hour: number; eventCount: number }> {
    const hourCounts: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = new Date(event.startDate).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return Object.entries(hourCounts).map(([hour, count]) => ({
      hour: parseInt(hour),
      eventCount: count
    })).sort((a, b) => a.hour - b.hour);
  }

  private async addEventAttendees(eventId: string, attendeeIds: string[]): Promise<void> {
    // This would typically use a separate attendees repository
    // For now, we'll just log the operation
    console.log(`Adding attendees ${attendeeIds.join(', ')} to event ${eventId}`);
  }

  private async addEventReminders(eventId: string, userId: string, reminderMinutes: number[]): Promise<void> {
    // This would typically use a separate reminders repository
    // For now, we'll just log the operation
    console.log(`Adding reminders ${reminderMinutes.join(', ')} minutes for event ${eventId}`);
  }

  private async sendEventInvitations(event: CalendarEvent, attendeeIds: string[]): Promise<void> {
    for (const attendeeId of attendeeIds) {
      try {
        await notificationService.createNotification({
          userId: attendeeId,
          type: NotificationType.CALENDAR_REMINDER,
          title: 'Event Invitation',
          message: `You have been invited to "${event.title}" on ${event.startDate.toLocaleDateString()}`,
          data: {
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.startDate.toISOString()
          }
        });
      } catch (error) {
        console.error(`Failed to send invitation to ${attendeeId}:`, error);
      }
    }
  }

  private async sendEventUpdateNotifications(event: CalendarEvent): Promise<void> {
    // This would typically get attendees from the attendees table
    // For now, we'll just log the operation
    console.log(`Sending update notifications for event ${event.id}: ${event.title}`);
  }

  private async sendEventCancellationNotifications(event: CalendarEvent): Promise<void> {
    // This would typically get attendees from the attendees table
    // For now, we'll just log the operation
    console.log(`Sending cancellation notifications for event ${event.id}: ${event.title}`);
  }

  private async processEventReminder(event: CalendarEvent): Promise<number> {
    // This would typically process reminders from the reminders table
    // For now, we'll just log and return 0
    console.log(`Processing reminders for event ${event.id}: ${event.title}`);
    return 0;
  }
}

// Export singleton instance
export const calendarEventService = new CalendarEventService();
