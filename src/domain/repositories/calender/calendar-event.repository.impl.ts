import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  ilike,
  gte,
  lte,
  inArray,
  ne,
  sql,
} from 'drizzle-orm';
import { CalendarEvent } from '../../domain/calendar/entities/calendar-event.entity';
import { CalendarEventId } from '../../domain/calendar/value-objects/calendar-event-id.vo';
import { UserId } from '../../../shared/domain/value-objects/user-id.vo';
import { WorkspaceId } from '../../../shared/domain/value-objects/workspace-id.vo';
import { ProjectId } from '../../../shared/domain/value-objects/project-id.vo';
import { TaskId } from '../../../shared/domain/value-objects/task-id.vo';
import { TeamId } from '../../../shared/domain/value-objects/team-id.vo';
import {
  ICalendarEventRepository,
  CalendarEventFilters,
  CalendarEventPaginationOptions,
  CalendarEventPaginatedResult,
} from '../../domain/calendar/repositories/calendar-event.repository';
import {
  calendarEvents,
  calendarEventAttendees,
  calendarEventReminders,
} from '../database/drizzle/schema/calendar-events';
import { db } from '../database/drizzle/connection';
import { EventTitle } from '../../domain/calendar/value-objects/event-title.vo';
import { EventDescription } from '../../domain/calendar/value-objects/event-description.vo';
import { EventDateTime } from '../../domain/calendar/value-objects/event-datetime.vo';
import { EventLocation } from '../../domain/calendar/value-objects/event-location.vo';
import { EventColor } from '../../domain/calendar/value-objects/event-color.vo';
import { RecurrenceRule } from '../../domain/calendar/value-objects/recurrence-rule.vo';
import {
  EventType,
  AttendeeStatus,
} from '../../domain/calendar/entities/calendar-event.entity';

export class CalendarEventRepositoryImpl implements ICalendarEventRepository {
  async save(calendarEvent: CalendarEvent): Promise<void> {
    const eventData = {
      id: calendarEvent.id.value,
      title: calendarEvent.title.value,
      description: calendarEvent.description?.value,
      type: calendarEvent.type,
      startDate: calendarEvent.startDate.value,
      endDate: calendarEvent.endDate?.value,
      allDay: calendarEvent.allDay,
      location: calendarEvent.location?.value,
      url: calendarEvent.url,
      color: calendarEvent.color.value,
      userId: calendarEvent.userId.value,
      workspaceId: calendarEvent.workspaceId?.value,
      teamId: calendarEvent.teamId?.value,
      projectId: calendarEvent.projectId?.value,
      taskId: calendarEvent.taskId?.value,
      isRecurring: calendarEvent.isRecurring,
      recurrenceRule: calendarEvent.recurrenceRule?.value,
      metadata: calendarEvent.metadata,
      createdAt: calendarEvent.createdAt,
      updatedAt: calendarEvent.updatedAt,
    };

    // Use upsert to handle both create and update
    await db
      .insert(calendarEvents)
      .values(eventData)
      .onConflictDoUpdate({
        target: calendarEvents.id,
        set: {
          title: eventData.title,
          description: eventData.description,
          type: eventData.type,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          allDay: eventData.allDay,
          location: eventData.location,
          url: eventData.url,
          color: eventData.color,
          workspaceId: eventData.workspaceId,
          teamId: eventData.teamId,
          projectId: eventData.projectId,
          taskId: eventData.taskId,
          isRecurring: eventData.isRecurring,
          recurrenceRule: eventData.recurrenceRule,
          metadata: eventData.metadata,
          updatedAt: eventData.updatedAt,
        },
      });

    // Save attendees
    await this.saveAttendees(calendarEvent);

    // Save reminders
    await this.saveReminders(calendarEvent);
  }

  async findById(id: CalendarEventId): Promise<CalendarEvent | null> {
    const result = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const eventData = result[0];
    const attendees = await this.getEventAttendees(id.value);
    const reminders = await this.getEventReminders(id.value);

    return this.toDomainEntity(eventData, attendees, reminders);
  }

  async findMany(
    filters: CalendarEventFilters,
    options: CalendarEventPaginationOptions = {}
  ): Promise<CalendarEventPaginatedResult> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = options;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = this.buildWhereConditions(filters);

    // Build sort condition
    const sortColumn = this.getSortColumn(sortBy);
    const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(calendarEvents)
      .where(whereConditions);
    const total = totalResult[0].count;

    // Get paginated results
    const results = await db
      .select()
      .from(calendarEvents)
      .where(whereConditions)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Convert to domain entities
    const events: CalendarEvent[] = [];
    for (const eventData of results) {
      const attendees = await this.getEventAttendees(eventData.id);
      const reminders = await this.getEventReminders(eventData.id);
      events.push(this.toDomainEntity(eventData, attendees, reminders));
    }

    return {
      data: events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findUpcomingEvents(
    userId: UserId,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]> {
    const results = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, userId.value),
          gte(calendarEvents.startDate, startTime),
          lte(calendarEvents.startDate, endTime)
        )
      )
      .orderBy(asc(calendarEvents.startDate));

    const events: CalendarEvent[] = [];
    for (const eventData of results) {
      const attendees = await this.getEventAttendees(eventData.id);
      const reminders = await this.getEventReminders(eventData.id);
      events.push(this.toDomainEntity(eventData, attendees, reminders));
    }

    return events;
  }

  async findConflictingEvents(
    userId: UserId,
    startDate: Date,
    endDate: Date,
    excludeEventId?: CalendarEventId
  ): Promise<CalendarEvent[]> {
    const conditions = [
      eq(calendarEvents.userId, userId.value),
      or(
        and(
          lte(calendarEvents.startDate, startDate),
          or(
            gte(calendarEvents.endDate, startDate),
            and(
              eq(calendarEvents.endDate, null),
              gte(
                sql`${calendarEvents.startDate} + interval '1 hour'`,
                startDate
              )
            )
          )
        ),
        and(
          gte(calendarEvents.startDate, startDate),
          lte(calendarEvents.startDate, endDate)
        )
      ),
    ];

    if (excludeEventId) {
      conditions.push(ne(calendarEvents.id, excludeEventId.value));
    }

    const results = await db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startDate));

    const events: CalendarEvent[] = [];
    for (const eventData of results) {
      const attendees = await this.getEventAttendees(eventData.id);
      const reminders = await this.getEventReminders(eventData.id);
      events.push(this.toDomainEntity(eventData, attendees, reminders));
    }

    return events;
  }

  async findByExternalIds(
    externalCalendarId: string,
    externalEventId: string
  ): Promise<CalendarEvent | null> {
    const result = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.externalCalendarId, externalCalendarId),
          eq(calendarEvents.externalEventId, externalEventId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const eventData = result[0];
    const attendees = await this.getEventAttendees(eventData.id);
    const reminders = await this.getEventReminders(eventData.id);

    return this.toDomainEntity(eventData, attendees, reminders);
  }

  async findEventsNeedingReminders(
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]> {
    // Find events that have reminders and are within the time window
    const results = await db
      .select()
      .from(calendarEvents)
      .innerJoin(
        calendarEventReminders,
        eq(calendarEvents.id, calendarEventReminders.eventId)
      )
      .where(
        and(
          gte(calendarEvents.startDate, startTime),
          lte(calendarEvents.startDate, endTime),
          eq(calendarEventReminders.sent, false)
        )
      )
      .orderBy(asc(calendarEvents.startDate));

    const eventIds = [...new Set(results.map(r => r.calendar_events.id))];
    const events: CalendarEvent[] = [];

    for (const eventId of eventIds) {
      const event = await this.findById(CalendarEventId.create(eventId));
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  async findRecurringEventsForGeneration(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const results = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.isRecurring, true),
          lte(calendarEvents.startDate, endDate)
        )
      )
      .orderBy(asc(calendarEvents.startDate));

    const events: CalendarEvent[] = [];
    for (const eventData of results) {
      const attendees = await this.getEventAttendees(eventData.id);
      const reminders = await this.getEventReminders(eventData.id);
      events.push(this.toDomainEntity(eventData, attendees, reminders));
    }

    return events;
  }

  async delete(id: CalendarEventId): Promise<void> {
    // Delete attendees and reminders first (cascade should handle this, but being explicit)
    await db
      .delete(calendarEventAttendees)
      .where(eq(calendarEventAttendees.eventId, id.value));

    await db
      .delete(calendarEventReminders)
      .where(eq(calendarEventReminders.eventId, id.value));

    // Delete the event
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id.value));
  }

  async exists(id: CalendarEventId): Promise<boolean> {
    const result = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async count(filters: CalendarEventFilters): Promise<number> {
    const whereConditions = this.buildWhereConditions(filters);

    const result = await db
      .select({ count: count() })
      .from(calendarEvents)
      .where(whereConditions);

    return result[0].count;
  }

  async getStatistics(
    userId: UserId,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    pastEvents: number;
    eventsByType: Record<string, number>;
    averageDuration: number;
    busyHours: Array<{ hour: number; eventCount: number }>;
  }> {
    const now = new Date();
    const conditions = [eq(calendarEvents.userId, userId.value)];

    if (startDate) {
      conditions.push(gte(calendarEvents.startDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(calendarEvents.startDate, endDate));
    }

    const events = await db
      .select()
      .from(calendarEvents)
      .where(and(...conditions));

    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => e.startDate > now).length;
    const pastEvents = events.filter(e => e.startDate <= now).length;

    // Group by type
    const eventsByType: Record<string, number> = {};
    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    // Calculate average duration
    const eventsWithDuration = events.filter(e => e.endDate);
    const averageDuration =
      eventsWithDuration.length > 0
        ? eventsWithDuration.reduce((sum, event) => {
            const duration =
              event.endDate!.getTime() - event.startDate.getTime();
            return sum + duration;
          }, 0) /
          eventsWithDuration.length /
          (1000 * 60 * 60) // Convert to hours
        : 0;

    // Calculate busy hours
    const hourCounts: Record<number, number> = {};
    events.forEach(event => {
      const hour = event.startDate.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const busyHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        eventCount: count,
      }))
      .sort((a, b) => a.hour - b.hour);

    return {
      totalEvents,
      upcomingEvents,
      pastEvents,
      eventsByType,
      averageDuration,
      busyHours,
    };
  }

  private async saveAttendees(calendarEvent: CalendarEvent): Promise<void> {
    // Delete existing attendees
    await db
      .delete(calendarEventAttendees)
      .where(eq(calendarEventAttendees.eventId, calendarEvent.id.value));

    // Insert new attendees
    if (calendarEvent.attendees.length > 0) {
      const attendeeData = calendarEvent.attendees.map(attendee => ({
        eventId: calendarEvent.id.value,
        userId: attendee.userId.value,
        status: attendee.status,
        responseAt: attendee.responseAt,
        createdAt: new Date(),
      }));

      await db.insert(calendarEventAttendees).values(attendeeData);
    }
  }

  private async saveReminders(calendarEvent: CalendarEvent): Promise<void> {
    // Delete existing reminders
    await db
      .delete(calendarEventReminders)
      .where(eq(calendarEventReminders.eventId, calendarEvent.id.value));

    // Insert new reminders
    if (calendarEvent.reminders.length > 0) {
      const reminderData = calendarEvent.reminders.map(reminder => ({
        id: reminder.id,
        eventId: calendarEvent.id.value,
        userId: calendarEvent.userId.value,
        minutesBefore: reminder.minutesBefore,
        method: reminder.method,
        sent: reminder.sent,
        sentAt: reminder.sentAt,
        createdAt: new Date(),
      }));

      await db.insert(calendarEventReminders).values(reminderData);
    }
  }

  private async getEventAttendees(eventId: string): Promise<any[]> {
    return await db
      .select()
      .from(calendarEventAttendees)
      .where(eq(calendarEventAttendees.eventId, eventId));
  }

  private async getEventReminders(eventId: string): Promise<any[]> {
    return await db
      .select()
      .from(calendarEventReminders)
      .where(eq(calendarEventReminders.eventId, eventId));
  }

  private toDomainEntity(
    eventData: any,
    attendees: any[],
    reminders: any[]
  ): CalendarEvent {
    const props = {
      id: CalendarEventId.create(eventData.id),
      title: EventTitle.create(eventData.title),
      description: eventData.description
        ? EventDescription.create(eventData.description)
        : undefined,
      type: eventData.type as EventType,
      startDate: EventDateTime.create(eventData.startDate),
      endDate: eventData.endDate
        ? EventDateTime.create(eventData.endDate)
        : undefined,
      allDay: eventData.allDay,
      location: eventData.location
        ? EventLocation.create(eventData.location)
        : undefined,
      url: eventData.url,
      color: EventColor.create(eventData.color),
      userId: UserId.create(eventData.userId),
      workspaceId: eventData.workspaceId
        ? WorkspaceId.create(eventData.workspaceId)
        : undefined,
      teamId: eventData.teamId ? TeamId.create(eventData.teamId) : undefined,
      projectId: eventData.projectId
        ? ProjectId.create(eventData.projectId)
        : undefined,
      taskId: eventData.taskId ? TaskId.create(eventData.taskId) : undefined,
      isRecurring: eventData.isRecurring,
      recurrenceRule: eventData.recurrenceRule
        ? RecurrenceRule.create(eventData.recurrenceRule)
        : undefined,
      attendees: attendees.map(a => ({
        userId: UserId.create(a.userId),
        status: a.status as AttendeeStatus,
        responseAt: a.responseAt,
      })),
      reminders: reminders.map(r => ({
        id: r.id,
        minutesBefore: r.minutesBefore,
        method: r.method as 'notification' | 'email' | 'sms',
        sent: r.sent,
        sentAt: r.sentAt,
      })),
      externalCalendarId: eventData.externalCalendarId,
      externalEventId: eventData.externalEventId,
      metadata: eventData.metadata || {},
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt,
    };

    return CalendarEvent.reconstitute(props);
  }

  private buildWhereConditions(filters: CalendarEventFilters): any {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(calendarEvents.userId, filters.userId.value));
    }

    if (filters.workspaceId) {
      conditions.push(
        eq(calendarEvents.workspaceId, filters.workspaceId.value)
      );
    }

    if (filters.teamId) {
      conditions.push(eq(calendarEvents.teamId, filters.teamId.value));
    }

    if (filters.projectId) {
      conditions.push(eq(calendarEvents.projectId, filters.projectId.value));
    }

    if (filters.taskId) {
      conditions.push(eq(calendarEvents.taskId, filters.taskId.value));
    }

    if (filters.type) {
      conditions.push(eq(calendarEvents.type, filters.type));
    }

    if (filters.startDate) {
      conditions.push(gte(calendarEvents.startDate, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(calendarEvents.startDate, filters.endDate));
    }

    if (filters.isRecurring !== undefined) {
      conditions.push(eq(calendarEvents.isRecurring, filters.isRecurring));
    }

    if (filters.search) {
      conditions.push(ilike(calendarEvents.title, `%${filters.search}%`));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private getSortColumn(sortBy: string): any {
    switch (sortBy) {
      case 'startDate':
        return calendarEvents.startDate;
      case 'endDate':
        return calendarEvents.endDate;
      case 'title':
        return calendarEvents.title;
      case 'type':
        return calendarEvents.type;
      case 'createdAt':
        return calendarEvents.createdAt;
      default:
        return calendarEvents.startDate;
    }
  }
}
