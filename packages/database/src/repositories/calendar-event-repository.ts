import {
  AttendeeStatus,
  CalendarEvent,
  EventType,
  ICalendarEventRepository,
} from '@taskmanagement/domain';
import { and, asc, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { logger } from '../../monitoring/logging-service';
import { calendarEvents } from '../schema/calendar-events';
import { BaseDrizzleRepository } from './base-drizzle-repository';

interface CalendarEventDrizzleModel {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  startDate: Date;
  endDate: Date | null;
  allDay: boolean;
  location: string | null;
  url: string | null;
  color: string;
  userId: string;
  workspaceId: string | null;
  teamId: string | null;
  projectId: string | null;
  taskId: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  attendees: Array<{
    userId: string;
    status: string;
    responseAt?: string;
  }>;
  reminders: Array<{
    id: string;
    minutesBefore: number;
    method: string;
    sent: boolean;
    sentAt?: string;
  }>;
  externalCalendarId: string | null;
  externalEventId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class CalendarEventRepository
  extends BaseDrizzleRepository<
    CalendarEvent,
    string,
    CalendarEventDrizzleModel,
    typeof calendarEvents
  >
  implements ICalendarEventRepository
{
  constructor() {
    super(calendarEvents, 'CalendarEvent');
  }

  protected toDomain(drizzleModel: CalendarEventDrizzleModel): CalendarEvent {
    return CalendarEvent.fromPersistence({
      id: drizzleModel.id,
      title: drizzleModel.title,
      description: drizzleModel.description || undefined,
      type: drizzleModel.type,
      startDate: drizzleModel.startDate,
      endDate: drizzleModel.endDate || undefined,
      allDay: drizzleModel.allDay,
      location: drizzleModel.location || undefined,
      url: drizzleModel.url || undefined,
      color: drizzleModel.color,
      userId: drizzleModel.userId,
      workspaceId: drizzleModel.workspaceId || undefined,
      teamId: drizzleModel.teamId || undefined,
      projectId: drizzleModel.projectId || undefined,
      taskId: drizzleModel.taskId || undefined,
      isRecurring: drizzleModel.isRecurring,
      recurrenceRule: drizzleModel.recurrenceRule || undefined,
      attendees: drizzleModel.attendees.map((a) => ({
        userId: a.userId,
        status: a.status as AttendeeStatus,
        ...(a.responseAt && { responseAt: new Date(a.responseAt) }),
      })),
      reminders: drizzleModel.reminders.map((r) => ({
        id: r.id,
        minutesBefore: r.minutesBefore,
        method: r.method as 'notification' | 'email' | 'sms',
        sent: r.sent,
        ...(r.sentAt && { sentAt: new Date(r.sentAt) }),
      })),
      externalCalendarId: drizzleModel.externalCalendarId || undefined,
      externalEventId: drizzleModel.externalEventId || undefined,
      metadata: drizzleModel.metadata,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
    });
  }

  protected toDrizzle(entity: CalendarEvent): Partial<CalendarEventDrizzleModel> {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description || null,
      type: entity.type,
      startDate: entity.startDate,
      endDate: entity.endDate || null,
      allDay: entity.allDay,
      location: entity.location || null,
      url: entity.url || null,
      color: entity.color,
      userId: entity.userId,
      workspaceId: entity.workspaceId || null,
      teamId: entity.teamId || null,
      projectId: entity.projectId || null,
      taskId: entity.taskId || null,
      isRecurring: entity.isRecurring,
      recurrenceRule: entity.recurrenceRule || null,
      attendees: entity.attendees.map((a) => ({
        userId: a.userId,
        status: a.status,
        ...(a.responseAt && { responseAt: a.responseAt.toISOString() }),
      })),
      reminders: entity.reminders.map((r) => ({
        id: r.id,
        minutesBefore: r.minutesBefore,
        method: r.method,
        sent: r.sent,
        ...(r.sentAt && { sentAt: r.sentAt.toISOString() }),
      })),
      externalCalendarId: entity.externalCalendarId || null,
      externalEventId: entity.externalEventId || null,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  protected buildWhereClause(_specification: any): any {
    // Implementation for specifications if needed
    return undefined;
  }

  // Base class save method is inherited - returns Promise<CalendarEvent>

  async findByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.userId, userId))
        .orderBy(desc(calendarEvents.startDate))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by user ID', error as Error, {
        userId,
      });
      throw error;
    }
  }

  async findByWorkspaceId(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.workspaceId, workspaceId))
        .orderBy(desc(calendarEvents.startDate))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by workspace ID', error as Error, {
        workspaceId,
      });
      throw error;
    }
  }

  async findByProjectId(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.projectId, projectId))
        .orderBy(desc(calendarEvents.startDate))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by project ID', error as Error, {
        projectId,
      });
      throw error;
    }
  }

  async findByTaskId(
    taskId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.taskId, taskId))
        .orderBy(desc(calendarEvents.startDate))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by task ID', error as Error, {
        taskId,
      });
      throw error;
    }
  }

  async findByType(
    type: EventType,
    limit: number = 50,
    offset: number = 0
  ): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.type, type))
        .orderBy(desc(calendarEvents.startDate))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by type', error as Error, { type });
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date, userId?: string): Promise<CalendarEvent[]> {
    try {
      let whereClause = and(
        gte(calendarEvents.startDate, startDate),
        lte(calendarEvents.startDate, endDate)
      );

      if (userId) {
        whereClause = and(whereClause, eq(calendarEvents.userId, userId));
      }

      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(whereClause)
        .orderBy(asc(calendarEvents.startDate));

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by date range', error as Error, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(userId && { userId }),
      });
      throw error;
    }
  }

  async findUpcoming(userId: string, limit: number = 10): Promise<CalendarEvent[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.startDate, now)))
        .orderBy(asc(calendarEvents.startDate))
        .limit(limit);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding upcoming calendar events', error as Error, { userId });
      throw error;
    }
  }

  async findPast(userId: string, limit: number = 50, offset: number = 0): Promise<CalendarEvent[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), lte(calendarEvents.startDate, now)))
        .orderBy(desc(calendarEvents.startDate))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding past calendar events', error as Error, { userId });
      throw error;
    }
  }

  async findRecurring(userId: string): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.isRecurring, true)))
        .orderBy(asc(calendarEvents.startDate));

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding recurring calendar events', error as Error, {
        userId,
      });
      throw error;
    }
  }

  async findConflicts(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]> {
    try {
      let whereClause = and(
        eq(calendarEvents.userId, userId),
        or(
          and(gte(calendarEvents.startDate, startDate), lte(calendarEvents.startDate, endDate)),
          and(gte(calendarEvents.endDate, startDate), lte(calendarEvents.endDate, endDate)),
          and(lte(calendarEvents.startDate, startDate), gte(calendarEvents.endDate, endDate))
        )
      );

      if (excludeEventId) {
        whereClause = and(whereClause, sql`${calendarEvents.id} != ${excludeEventId}`);
      }

      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(whereClause)
        .orderBy(asc(calendarEvents.startDate));

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar event conflicts', error as Error, {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      throw error;
    }
  }

  async findByAttendee(userId: string, status?: AttendeeStatus): Promise<CalendarEvent[]> {
    try {
      let whereClause;
      if (status) {
        whereClause = sql`JSON_EXTRACT(${calendarEvents.attendees}, '$[*].userId') LIKE '%${userId}%' AND JSON_EXTRACT(${calendarEvents.attendees}, '$[*].status') LIKE '%${status}%'`;
      } else {
        whereClause = sql`JSON_EXTRACT(${calendarEvents.attendees}, '$[*].userId') LIKE '%${userId}%'`;
      }

      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(whereClause)
        .orderBy(asc(calendarEvents.startDate));

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by attendee', error as Error, {
        userId,
        status,
      });
      throw error;
    }
  }

  async findWithReminders(beforeDate: Date): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(
          and(
            gte(calendarEvents.startDate, beforeDate),
            sql`JSON_LENGTH(${calendarEvents.reminders}) > 0`
          )
        )
        .orderBy(asc(calendarEvents.startDate));

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events with reminders', error as Error, {
        beforeDate: beforeDate.toISOString(),
      });
      throw error;
    }
  }

  async findByExternalCalendar(externalCalendarId: string): Promise<CalendarEvent[]> {
    try {
      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.externalCalendarId, externalCalendarId))
        .orderBy(asc(calendarEvents.startDate));

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error finding calendar events by external calendar', error as Error, {
        externalCalendarId,
      });
      throw error;
    }
  }

  async getEventStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    completedEvents: number;
    byType: Record<EventType, number>;
    averageDuration: number;
  }> {
    try {
      let whereClause = eq(calendarEvents.userId, userId);

      if (startDate && endDate) {
        whereClause = and(
          whereClause,
          gte(calendarEvents.startDate, startDate),
          lte(calendarEvents.startDate, endDate)
        )!;
      }

      const results = await this.database.select().from(calendarEvents).where(whereClause);

      const events = results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
      const now = new Date();

      const stats = {
        totalEvents: events.length,
        upcomingEvents: events.filter((e) => e.startDate > now).length,
        completedEvents: events.filter((e) => e.isPast()).length,
        byType: {} as Record<EventType, number>,
        averageDuration: 0,
      };

      // Initialize type counts
      Object.values(EventType).forEach((type) => {
        stats.byType[type] = 0;
      });

      // Calculate type distribution and average duration
      let totalDuration = 0;
      events.forEach((event) => {
        stats.byType[event.type]++;
        totalDuration += event.getDuration();
      });

      stats.averageDuration = events.length > 0 ? totalDuration / events.length : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting calendar event stats', error as Error, { userId });
      throw error;
    }
  }

  async searchEvents(query: {
    userId?: string;
    workspaceId?: string;
    title?: string;
    description?: string;
    type?: EventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<CalendarEvent[]> {
    try {
      const conditions = [];

      if (query.userId) {
        conditions.push(eq(calendarEvents.userId, query.userId));
      }
      if (query.workspaceId) {
        conditions.push(eq(calendarEvents.workspaceId, query.workspaceId));
      }
      if (query.title) {
        conditions.push(sql`${calendarEvents.title} ILIKE '%${query.title}%'`);
      }
      if (query.description) {
        conditions.push(sql`${calendarEvents.description} ILIKE '%${query.description}%'`);
      }
      if (query.type) {
        conditions.push(eq(calendarEvents.type, query.type));
      }
      if (query.startDate) {
        conditions.push(gte(calendarEvents.startDate, query.startDate));
      }
      if (query.endDate) {
        conditions.push(lte(calendarEvents.startDate, query.endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await this.database
        .select()
        .from(calendarEvents)
        .where(whereClause)
        .orderBy(desc(calendarEvents.startDate))
        .limit(query.limit || 50)
        .offset(query.offset || 0);

      return results.map((result) => this.toDomain(result as CalendarEventDrizzleModel));
    } catch (error) {
      logger.error('Error searching calendar events', error as Error, {
        queryParams: JSON.stringify(query),
      });
      throw error;
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.database.delete(calendarEvents).where(eq(calendarEvents.userId, userId));
    } catch (error) {
      logger.error('Error deleting calendar events by user ID', error as Error, {
        userId,
      });
      throw error;
    }
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    try {
      await this.database.delete(calendarEvents).where(eq(calendarEvents.projectId, projectId));
    } catch (error) {
      logger.error('Error deleting calendar events by project ID', error as Error, {
        projectId,
      });
      throw error;
    }
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    try {
      await this.database.delete(calendarEvents).where(eq(calendarEvents.taskId, taskId));
    } catch (error) {
      logger.error('Error deleting calendar events by task ID', error as Error, {
        taskId,
      });
      throw error;
    }
  }
}
