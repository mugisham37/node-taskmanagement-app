import {
  CalendarEvent,
  EventType,
  AttendeeStatus,
  CalendarEventProps,
} from '../entities/calendar-event';
import { ICalendarEventRepository } from '../repositories/calendar-event-repository';
import { UserId, CalendarEventId } from '../value-objects';

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
      UserId.create(userId),
      startDate,
      endDate,
      excludeEventId ? CalendarEventId.create(excludeEventId) : undefined
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
    const calendarEventProps: CalendarEventProps = {
      title: eventData.title,
      description: eventData.description,
      type: eventData.type,
      startDate: eventData.startDate,
      startTime: eventData.startDate,
      endDate: eventData.endDate,
      endTime: eventData.endDate || eventData.startDate,
      allDay: eventData.allDay || false,
      location: eventData.location,
      url: eventData.url,
      color: eventData.color,
      userId: eventData.userId,
      workspaceId: eventData.workspaceId,
      projectId: eventData.projectId,
      createdBy: eventData.userId,
      attendees: [],
      isAllDay: eventData.allDay || false,
      recurrenceRule: eventData.recurrenceRule,
      reminders: [],
      visibility: 'private',
      ...(eventData.metadata && { metadata: eventData.metadata })
    };
    const event = CalendarEvent.create(calendarEventProps);
    await this.calendarEventRepository.save(event);

    return { event, conflicts };
  }

  async getUpcomingEvents(
    userId: string,
    days: number = 7
  ): Promise<CalendarEvent[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.calendarEventRepository.findByDateRange(
      startDate,
      endDate,
      new UserId(userId)
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
    const event = await this.calendarEventRepository.findById(new CalendarEventId(eventId));
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
    userId: string
  ): Promise<void> {
    const event = await this.calendarEventRepository.findById(new CalendarEventId(eventId));
    if (!event) {
      throw new Error('Event not found');
    }

    event.addAttendee(new UserId(userId));
    await this.calendarEventRepository.save(event);
  }

  async updateAttendeeStatus(
    eventId: string,
    userId: string,
    status: AttendeeStatus
  ): Promise<void> {
    const event = await this.calendarEventRepository.findById(new CalendarEventId(eventId));
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
    return this.calendarEventRepository.findByAttendee(new UserId(userId), status);
  }

  async getEventsRequiringReminders(
    beforeMinutes: number = 30
  ): Promise<CalendarEvent[]> {
    const beforeDate = new Date();
    beforeDate.setMinutes(beforeDate.getMinutes() + beforeMinutes);

    return this.calendarEventRepository.findWithReminders(beforeDate);
  }

  async markReminderSent(eventId: string, reminderId: string): Promise<void> {
    const event = await this.calendarEventRepository.findById(new CalendarEventId(eventId));
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
    // Calculate busy hours
    const events = await this.calendarEventRepository.findByDateRange(
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate || new Date(),
      new UserId(userId)
    );

    const busyHours = events.reduce((total, event) => {
      return total + event.getDuration() / (1000 * 60 * 60); // Convert milliseconds to hours
    }, 0);

    // Calculate statistics
    const now = new Date();
    const upcomingEvents = events.filter(e => e.startTime > now).length;
    const completedEvents = events.filter(e => e.endTime < now).length;
    
    // Group by type
    const byType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<EventType, number>);

    // Calculate average duration
    const averageDuration = events.length > 0 
      ? events.reduce((total, event) => total + event.getDuration(), 0) / events.length / (1000 * 60) // in minutes
      : 0;

    return {
      totalEvents: events.length,
      upcomingEvents,
      completedEvents,
      byType,
      averageDuration,
      busyHours
    };
  }

  async deleteEventAndCleanup(eventId: string): Promise<void> {
    const event = await this.calendarEventRepository.findById(new CalendarEventId(eventId));
    if (!event) {
      throw new Error('Event not found');
    }

    // Perform any cleanup logic here (e.g., notify attendees, cancel reminders)

    await this.calendarEventRepository.delete(new CalendarEventId(eventId));
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
