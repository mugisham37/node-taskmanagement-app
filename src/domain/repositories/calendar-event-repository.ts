import {
  CalendarEvent,
  EventType,
  AttendeeStatus,
} from '../entities/calendar-event';

export interface ICalendarEventRepository {
  save(event: CalendarEvent): Promise<CalendarEvent>;
  findById(id: string): Promise<CalendarEvent | null>;
  findByUserId(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findByWorkspaceId(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findByProjectId(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findByTaskId(
    taskId: string,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findByType(
    type: EventType,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<CalendarEvent[]>;
  findUpcoming(userId: string, limit?: number): Promise<CalendarEvent[]>;
  findPast(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findRecurring(userId: string): Promise<CalendarEvent[]>;
  findConflicts(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]>;
  findByAttendee(
    userId: string,
    status?: AttendeeStatus
  ): Promise<CalendarEvent[]>;
  findWithReminders(beforeDate: Date): Promise<CalendarEvent[]>;
  findByExternalCalendar(externalCalendarId: string): Promise<CalendarEvent[]>;
  getEventStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    completedEvents: number;
    byType: Record<EventType, number>;
    averageDuration: number;
  }>;
  searchEvents(query: {
    userId?: string;
    workspaceId?: string;
    title?: string;
    description?: string;
    type?: EventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<CalendarEvent[]>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteByProjectId(projectId: string): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
  deleteRecurringEvent(eventId: string, deleteAll: boolean): Promise<void>;
  updateAttendeeResponse(eventId: string, userId: string, response: AttendeeStatus): Promise<void>;
}
