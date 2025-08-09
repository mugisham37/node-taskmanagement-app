import {
  CalendarEvent,
  EventType,
  AttendeeStatus,
} from '../entities/calendar-event';
import { ICalendarEventRepository } from '../repositories/calendar-event-repository';

export class CalendarDomainService {
  constructor(
    private readonly calendarEventRepository: ICalendarEventRepository
  ) {}

  async checkForConflicts(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.findConflicts(
      userId,
      startDate,
      endDate,
      excludeEventId
    );
  }

  async hasSchedulingConflict(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<boolean> {
    const conflicts = await this.checkForConflicts(
      userId,
      startDate,
      endDate,
      excludeEventId
    );
    return conflicts.length > 0;
  }

  async createEventWithConflictCheck(
    eventData: {
      title: string;
      description?: string;
      type: EventType;
      startDate: Date;
      endDate?: Date;
      allDay?: boolean;
      location?: string;
      url?: string;
      color?: string;
      userId: string;
      workspaceId?: string;
      teamId?: string;
      projectId?: string;
      taskId?: string;
      isRecurring?: boolean;
      recurrenceRule?: string;
      metadata?: Record<string, any>;
    },
    allowConflicts: boolean = false
  ): Promise<{ event: CalendarEvent; conflicts: CalendarEvent[] }> {
    // Check for conflicts
    const conflicts = await this.checkForConflicts(
      eventData.userId,
      eventData.startDate,
      eventData.endDate || eventData.startDate
    );

    if (!allowConflicts && conflicts.length > 0) {
      throw new Error(
        `Scheduling conflict detected with ${conflicts.length} existing event(s)`
      );
    }

    // Create the event
    const event = CalendarEvent.create(eventData);
    await this.calendarEventRepository.save(event);

    return { event, conflicts };
  }

  async getUpcomingEvents(
    userId: string,
    days: number = 7,
    limit: number = 50
  ): Promise<CalendarEvent[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.calendarEventRepository.findByDateRange(
      startDate,
      endDate,
      userId
    );
  }

  async getEventsForProject(projectId: string): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.findByProjectId(projectId);
  }

  async getEventsForTask(taskId: string): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.findByTaskId(taskId);
  }

  async updateEventWithConflictCheck(
    eventId: string,
    updates: {
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
    },
    allowConflicts: boolean = false
  ): Promise<{ event: CalendarEvent; conflicts: CalendarEvent[] }> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // If dates are being updated, check for conflicts
    let conflicts: CalendarEvent[] = [];
    if (updates.startDate || updates.endDate) {
      const newStartDate = updates.startDate || event.startDate;
      const newEndDate = updates.endDate || event.endDate || newStartDate;

      conflicts = await this.checkForConflicts(
        event.userId,
        newStartDate,
        newEndDate,
        eventId
      );

      if (!allowConflicts && conflicts.length > 0) {
        throw new Error(
          `Scheduling conflict detected with ${conflicts.length} existing event(s)`
        );
      }
    }

    // Update the event
    event.update(updates);
    await this.calendarEventRepository.save(event);

    return { event, conflicts };
  }

  async addAttendeeToEvent(
    eventId: string,
    userId: string,
    status: AttendeeStatus = AttendeeStatus.PENDING
  ): Promise<void> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    event.addAttendee(userId, status);
    await this.calendarEventRepository.save(event);
  }

  async updateAttendeeStatus(
    eventId: string,
    userId: string,
    status: AttendeeStatus
  ): Promise<void> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    event.updateAttendeeStatus(userId, status);
    await this.calendarEventRepository.save(event);
  }

  async getEventsByAttendee(
    userId: string,
    status?: AttendeeStatus
  ): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.findByAttendee(userId, status);
  }

  async getEventsRequiringReminders(
    beforeMinutes: number = 30
  ): Promise<CalendarEvent[]> {
    const beforeDate = new Date();
    beforeDate.setMinutes(beforeDate.getMinutes() + beforeMinutes);

    return this.calendarEventRepository.findWithReminders(beforeDate);
  }

  async markReminderSent(eventId: string, reminderId: string): Promise<void> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    event.markReminderSent(reminderId);
    await this.calendarEventRepository.save(event);
  }

  async getCalendarSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    completedEvents: number;
    byType: Record<EventType, number>;
    averageDuration: number;
    busyHours: number;
  }> {
    const stats = await this.calendarEventRepository.getEventStats(
      userId,
      startDate,
      endDate
    );

    // Calculate busy hours
    const events = await this.calendarEventRepository.findByDateRange(
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate || new Date(),
      userId
    );

    const busyHours = events.reduce((total, event) => {
      return total + event.getDuration() / 60; // Convert minutes to hours
    }, 0);

    return {
      ...stats,
      busyHours,
    };
  }

  async deleteEventAndCleanup(eventId: string): Promise<void> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Perform any cleanup logic here (e.g., notify attendees, cancel reminders)

    await this.calendarEventRepository.delete(eventId);
  }

  async bulkUpdateEventsForProject(
    projectId: string,
    updates: {
      color?: string;
      workspaceId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<number> {
    const events =
      await this.calendarEventRepository.findByProjectId(projectId);
    let updatedCount = 0;

    for (const event of events) {
      event.update(updates);
      await this.calendarEventRepository.save(event);
      updatedCount++;
    }

    return updatedCount;
  }

  async bulkUpdateEventsForTask(
    taskId: string,
    updates: {
      color?: string;
      projectId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<number> {
    const events = await this.calendarEventRepository.findByTaskId(taskId);
    let updatedCount = 0;

    for (const event of events) {
      event.update(updates);
      await this.calendarEventRepository.save(event);
      updatedCount++;
    }

    return updatedCount;
  }
}
