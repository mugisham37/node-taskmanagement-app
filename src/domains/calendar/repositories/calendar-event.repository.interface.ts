import { CalendarEventAggregate } from '../aggregates/calendar-event.aggregate';
import { CalendarEventId } from '../value-objects/calendar-event-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';

export interface ICalendarEventRepository {
  /**
   * Finds a calendar event by its unique identifier
   */
  findById(id: CalendarEventId): Promise<CalendarEventAggregate | null>;

  /**
   * Finds events by workspace ID
   */
  findByWorkspaceId(
    workspaceId: WorkspaceId
  ): Promise<CalendarEventAggregate[]>;

  /**
   * Finds events for a specific user (as organizer or attendee)
   */
  findByUserId(userId: UserId): Promise<CalendarEventAggregate[]>;

  /**
   * Finds events in a date range
   */
  findByDateRange(
    workspaceId: WorkspaceId,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEventAggregate[]>;

  /**
   * Saves a calendar event aggregate
   */
  save(event: CalendarEventAggregate): Promise<void>;

  /**
   * Deletes a calendar event (soft delete)
   */
  delete(id: CalendarEventId): Promise<void>;
}
