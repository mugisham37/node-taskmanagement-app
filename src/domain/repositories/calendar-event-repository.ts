import {
  CalendarEvent,
} from '../entities/calendar-event';
import { CalendarEventId } from '../value-objects/calendar-event-id';
import { UserId } from '../value-objects/user-id';
import { ProjectId } from '../value-objects/project-id';

export interface CalendarStatistics {
  totalEvents: number;
  upcomingEvents: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  recurringEvents: number;
  eventsByProject: { projectId: string; projectName: string; count: number }[];
  attendanceRate: number;
}

export interface ICalendarEventRepository {
  save(event: CalendarEvent): Promise<CalendarEvent>;
  findById(id: CalendarEventId): Promise<CalendarEvent | null>;
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
  findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: UserId,
    projectId?: ProjectId
  ): Promise<CalendarEvent[]>;
  findByTimeRange(
    startDate: Date,
    endDate: Date,
    userId: UserId,
    projectId?: ProjectId
  ): Promise<CalendarEvent[]>;
  findConflictingEvents(
    userId: UserId,
    startDate: Date,
    endDate: Date,
    excludeEventId?: CalendarEventId
  ): Promise<CalendarEvent[]>;
  getCalendarStatistics(
    userId: UserId,
    projectId?: ProjectId
  ): Promise<CalendarStatistics>;
  findUpcoming(userId: string, limit?: number): Promise<CalendarEvent[]>;
  findPast(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<CalendarEvent[]>;
  findRecurring(userId: string): Promise<CalendarEvent[]>;
  delete(id: CalendarEventId): Promise<void>;
}
