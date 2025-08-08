import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, gte, lte, between } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { 
  calendarEvents, 
  CalendarEvent, 
  NewCalendarEvent,
  calendarEventAttendees,
  CalendarEventAttendee,
  NewCalendarEventAttendee,
  calendarEventReminders,
  CalendarEventReminder,
  NewCalendarEventReminder
} from '../schema/calendar-events';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class CalendarEventRepository extends BaseRepository<CalendarEvent, NewCalendarEvent> {
  protected table = calendarEvents;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 180, keyPrefix: 'calendar_event' }, // Enable caching for calendar events
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Calendar Event specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.userId, userId),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByDateRange(
    startDate: Date, 
    endDate: Date, 
    userId?: string, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<CalendarEvent>> {
    try {
      let whereCondition = and(
        gte(calendarEvents.startDate, startDate),
        lte(calendarEvents.startDate, endDate)
      );

      if (userId) {
        whereCondition = and(whereCondition, eq(calendarEvents.userId, userId));
      }

      return await this.findMany({
        where: whereCondition,
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByDateRange');
    }
  }

  async findByType(type: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.type, type),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByType');
    }
  }

  async findByTask(taskId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.taskId, taskId),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByTask');
    }
  }

  async findByProject(projectId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.projectId, projectId),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByProject');
    }
  }

  async findByWorkspace(workspaceId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.workspaceId, workspaceId),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByWorkspace');
    }
  }

  async findByTeam(teamId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.teamId, teamId),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByTeam');
    }
  }

  async findUpcomingEvents(userId: string, days: number = 7, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      return await this.findMany({
        where: and(
          eq(calendarEvents.userId, userId),
          gte(calendarEvents.startDate, now),
          lte(calendarEvents.startDate, futureDate)
        ),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findUpcomingEvents');
    }
  }

  async findRecurringEvents(options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.isRecurring, true),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findRecurringEvents');
    }
  }

  async findByExternalCalendar(externalCalendarId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarEvent>> {
    try {
      return await this.findMany({
        where: eq(calendarEvents.externalCalendarId, externalCalendarId),
        ...options,
        sortBy: 'startDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByExternalCalendar');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<CalendarEvent>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'startDate', sortOrder = 'asc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(calendarEvents.title, searchPattern),
        ilike(calendarEvents.description, searchPattern),
        ilike(calendarEvents.location, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  // Attendee Management
  async addAttendee(eventId: string, userId: string, status: string = 'pending'): Promise<CalendarEventAttendee> {
    try {
      const attendeeData: NewCalendarEventAttendee = {
        eventId,
        userId,
        status
      };

      const result = await this.db
        .insert(calendarEventAttendees)
        .values(attendeeData)
        .returning();

      return result[0] as CalendarEventAttendee;
    } catch (error) {
      throw this.handleError(error, 'addAttendee');
    }
  }

  async removeAttendee(eventId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(calendarEventAttendees)
        .where(and(
          eq(calendarEventAttendees.eventId, eventId),
          eq(calendarEventAttendees.userId, userId)
        ));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      throw this.handleError(error, 'removeAttendee');
    }
  }

  async updateAttendeeStatus(eventId: string, userId: string, status: string): Promise<CalendarEventAttendee | null> {
    try {
      const result = await this.db
        .update(calendarEventAttendees)
        .set({ 
          status, 
          responseAt: new Date() 
        })
        .where(and(
          eq(calendarEventAttendees.eventId, eventId),
          eq(calendarEventAttendees.userId, userId)
        ))
        .returning();

      return (result[0] as CalendarEventAttendee) || null;
    } catch (error) {
      throw this.handleError(error, 'updateAttendeeStatus');
    }
  }

  async getEventAttendees(eventId: string): Promise<CalendarEventAttendee[]> {
    try {
      const result = await this.db
        .select()
        .from(calendarEventAttendees)
        .where(eq(calendarEventAttendees.eventId, eventId));

      return result as CalendarEventAttendee[];
    } catch (error) {
      throw this.handleError(error, 'getEventAttendees');
    }
  }

  async bulkAddAttendees(eventId: string, userIds: string[], status: string = 'pending'): Promise<CalendarEventAttendee[]> {
    try {
      const attendeeData = userIds.map(userId => ({
        eventId,
        userId,
        status
      }));

      const result = await this.db
        .insert(calendarEventAttendees)
        .values(attendeeData)
        .returning();

      return result as CalendarEventAttendee[];
    } catch (error) {
      throw this.handleError(error, 'bulkAddAttendees');
    }
  }

  // Reminder Management
  async addReminder(eventId: string, userId: string, minutesBefore: number, method: string = 'notification'): Promise<CalendarEventReminder> {
    try {
      const reminderData: NewCalendarEventReminder = {
        eventId,
        userId,
        minutesBefore,
        method
      };

      const result = await this.db
        .insert(calendarEventReminders)
        .values(reminderData)
        .returning();

      return result[0] as CalendarEventReminder;
    } catch (error) {
      throw this.handleError(error, 'addReminder');
    }
  }

  async removeReminder(reminderId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(calendarEventReminders)
        .where(eq(calendarEventReminders.id, reminderId));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      throw this.handleError(error, 'removeReminder');
    }
  }

  async getEventReminders(eventId: string): Promise<CalendarEventReminder[]> {
    try {
      const result = await this.db
        .select()
        .from(calendarEventReminders)
        .where(eq(calendarEventReminders.eventId, eventId));

      return result as CalendarEventReminder[];
    } catch (error) {
      throw this.handleError(error, 'getEventReminders');
    }
  }

  async getPendingReminders(): Promise<CalendarEventReminder[]> {
    try {
      const result = await this.db
        .select()
        .from(calendarEventReminders)
        .where(eq(calendarEventReminders.sent, false));

      return result as CalendarEventReminder[];
    } catch (error) {
      throw this.handleError(error, 'getPendingReminders');
    }
  }

  async markReminderSent(reminderId: string): Promise<CalendarEventReminder | null> {
    try {
      const result = await this.db
        .update(calendarEventReminders)
        .set({ 
          sent: true, 
          sentAt: new Date() 
        })
        .where(eq(calendarEventReminders.id, reminderId))
        .returning();

      return (result[0] as CalendarEventReminder) || null;
    } catch (error) {
      throw this.handleError(error, 'markReminderSent');
    }
  }

  // Bulk Operations
  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userEvents = await this.findByUser(userId, { limit: 1000 });
      const eventIds = userEvents.data.map(event => event.id);
      
      if (eventIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(eventIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  async bulkDeleteByTask(taskId: string): Promise<{ success: boolean; count: number }> {
    try {
      const taskEvents = await this.findByTask(taskId, { limit: 1000 });
      const eventIds = taskEvents.data.map(event => event.id);
      
      if (eventIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(eventIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByTask');
    }
  }

  async bulkDeleteByProject(projectId: string): Promise<{ success: boolean; count: number }> {
    try {
      const projectEvents = await this.findByProject(projectId, { limit: 1000 });
      const eventIds = projectEvents.data.map(event => event.id);
      
      if (eventIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(eventIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByProject');
    }
  }

  // Statistics
  async getEventStats(userId?: string): Promise<{
    total: number;
    upcoming: number;
    today: number;
    thisWeek: number;
    recurring: number;
    byType: Record<string, number>;
  }> {
    try {
      const baseWhere = userId ? eq(calendarEvents.userId, userId) : undefined;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      const [
        total,
        upcoming,
        todayCount,
        thisWeekCount,
        recurring
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, gte(calendarEvents.startDate, now)) :
            gte(calendarEvents.startDate, now)
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, gte(calendarEvents.startDate, today), lte(calendarEvents.startDate, tomorrow)) :
            and(gte(calendarEvents.startDate, today), lte(calendarEvents.startDate, tomorrow))
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, gte(calendarEvents.startDate, now), lte(calendarEvents.startDate, weekFromNow)) :
            and(gte(calendarEvents.startDate, now), lte(calendarEvents.startDate, weekFromNow))
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, eq(calendarEvents.isRecurring, true)) :
            eq(calendarEvents.isRecurring, true)
        })
      ]);

      // For byType stats, we'd need to group by type
      const byType: Record<string, number> = {}; // Placeholder

      return {
        total,
        upcoming,
        today: todayCount,
        thisWeek: thisWeekCount,
        recurring,
        byType
      };
    } catch (error) {
      throw this.handleError(error, 'getEventStats');
    }
  }

  // Override create to add validation
  async create(data: NewCalendarEvent): Promise<CalendarEvent> {
    try {
      // Add any calendar event-specific validation here
      if (!data.title || data.title.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Event title cannot be empty');
      }

      if (!data.startDate) {
        throw new RepositoryException('VALIDATION_ERROR', 'Event start date is required');
      }

      if (data.endDate && data.endDate <= data.startDate) {
        throw new RepositoryException('VALIDATION_ERROR', 'Event end date must be after start date');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }

  // Helper method to access db from base class
  private get db() {
    return (this as any).db || require('../../connection').db;
  }
}

// Export singleton instance
export const calendarEventRepository = new CalendarEventRepository();
