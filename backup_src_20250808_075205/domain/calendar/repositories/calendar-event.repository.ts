import { CalendarEvent } from '../entities/calendar-event.entity';
import { CalendarEventId } from '../value-objects/calendar-event-id.vo';
import { UserId } from '../../shared/value-objects/user-id.vo';
import { WorkspaceId } from '../../shared/value-objects/workspace-id.vo';
import { ProjectId } from '../../shared/value-objects/project-id.vo';
import { TaskId } from '../../shared/value-objects/task-id.vo';
import { TeamId } from '../../shared/value-objects/team-id.vo';
import { EventType } from '../entities/calendar-event.entity';

export interface CalendarEventFilters {
  userId?: UserId;
  workspaceId?: WorkspaceId;
  teamId?: TeamId;
  projectId?: ProjectId;
  taskId?: TaskId;
  type?: EventType;
  startDate?: Date;
  endDate?: Date;
  isRecurring?: boolean;
  search?: string;
}

export interface CalendarEventPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'startDate' | 'endDate' | 'title' | 'type' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CalendarEventPaginatedResult {
  data: CalendarEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CalendarEventConflict {
  eventId: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  conflictType: 'overlap' | 'double_booking';
  severity: 'low' | 'medium' | 'high';
}

export interface ICalendarEventRepository {
  /**
   * Save a calendar event
   */
  save(calendarEvent: CalendarEvent): Promise<void>;

  /**
   * Find a calendar event by ID
   */
  findById(id: CalendarEventId): Promise<CalendarEvent | null>;

  /**
   * Find calendar events with filters and pagination
   */
  findMany(
    filters: CalendarEventFilters,
    options?: CalendarEventPaginationOptions
  ): Promise<CalendarEventPaginatedResult>;

  /**
   * Find upcoming events for a user within a time range
   */
  findUpcomingEvents(
    userId: UserId,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]>;

  /**
   * Find events that conflict with a given time range for a user
   */
  findConflictingEvents(
    userId: UserId,
    startDate: Date,
    endDate: Date,
    excludeEventId?: CalendarEventId
  ): Promise<CalendarEvent[]>;

  /**
   * Find events by external calendar and event IDs
   */
  findByExternalIds(
    externalCalendarId: string,
    externalEventId: string
  ): Promise<CalendarEvent | null>;

  /**
   * Find events that need reminders sent
   */
  findEventsNeedingReminders(
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]>;

  /**
   * Find recurring events that need instance generation
   */
  findRecurringEventsForGeneration(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]>;

  /**
   * Delete a calendar event
   */
  delete(id: CalendarEventId): Promise<void>;

  /**
   * Check if a calendar event exists
   */
  exists(id: CalendarEventId): Promise<boolean>;

  /**
   * Count calendar events with filters
   */
  count(filters: CalendarEventFilters): Promise<number>;

  /**
   * Get calendar event statistics for a user
   */
  getStatistics(
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
  }>;
}
