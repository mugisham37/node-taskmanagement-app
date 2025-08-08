import {
  CalendarEvent,
  CreateCalendarEventProps,
  UpdateCalendarEventProps,
  EventType,
} from '../entities/calendar-event.entity';
import { CalendarEventId } from '../value-objects/calendar-event-id.vo';
import { UserId } from '../../shared/value-objects/user-id.vo';
import { WorkspaceId } from '../../shared/value-objects/workspace-id.vo';
import {
  ICalendarEventRepository,
  CalendarEventFilters,
  CalendarEventPaginationOptions,
  CalendarEventPaginatedResult,
  CalendarEventConflict,
} from '../repositories/calendar-event.repository';
import { DomainService } from '../../shared/services/domain-service';

export interface ConflictDetectionOptions {
  severity: 'low' | 'medium' | 'high';
  allowOverlap: boolean;
  maxConflicts: number;
}

export interface EventSchedulingResult {
  success: boolean;
  conflicts: CalendarEventConflict[];
  warnings: string[];
}

export class CalendarEventDomainService extends DomainService {
  constructor(
    private readonly calendarEventRepository: ICalendarEventRepository
  ) {
    super();
  }

  /**
   * Create a new calendar event with conflict detection
   */
  async createCalendarEvent(
    props: CreateCalendarEventProps,
    options?: { skipConflictCheck?: boolean }
  ): Promise<{ event: CalendarEvent; conflicts: CalendarEventConflict[] }> {
    // Create the calendar event entity
    const calendarEvent = CalendarEvent.create(props);

    // Check for scheduling conflicts unless skipped
    let conflicts: CalendarEventConflict[] = [];
    if (!options?.skipConflictCheck) {
      conflicts = await this.detectSchedulingConflicts(
        UserId.create(props.userId),
        props.startDate,
        props.endDate || new Date(props.startDate.getTime() + 60 * 60 * 1000)
      );
    }

    // Save the event
    await this.calendarEventRepository.save(calendarEvent);

    return { event: calendarEvent, conflicts };
  }

  /**
   * Update a calendar event with conflict detection
   */
  async updateCalendarEvent(
    eventId: CalendarEventId,
    props: UpdateCalendarEventProps,
    options?: { skipConflictCheck?: boolean }
  ): Promise<{ event: CalendarEvent; conflicts: CalendarEventConflict[] }> {
    // Find the existing event
    const existingEvent = await this.calendarEventRepository.findById(eventId);
    if (!existingEvent) {
      throw new Error('Calendar event not found');
    }

    // Check for scheduling conflicts if dates are being changed
    let conflicts: CalendarEventConflict[] = [];
    if (!options?.skipConflictCheck && (props.startDate || props.endDate)) {
      const newStartDate = props.startDate || existingEvent.startDate.value;
      const newEndDate =
        props.endDate ||
        existingEvent.endDate?.value ||
        new Date(newStartDate.getTime() + 60 * 60 * 1000);

      conflicts = await this.detectSchedulingConflicts(
        existingEvent.userId,
        newStartDate,
        newEndDate,
        eventId
      );
    }

    // Update the event
    existingEvent.update(props);

    // Save the updated event
    await this.calendarEventRepository.save(existingEvent);

    return { event: existingEvent, conflicts };
  }

  /**
   * Delete a calendar event
   */
  async deleteCalendarEvent(eventId: CalendarEventId): Promise<void> {
    const calendarEvent = await this.calendarEventRepository.findById(eventId);
    if (!calendarEvent) {
      throw new Error('Calendar event not found');
    }

    // Mark as deleted (triggers domain event)
    calendarEvent.delete();

    // Delete from repository
    await this.calendarEventRepository.delete(eventId);
  }

  /**
   * Find calendar events with advanced filtering
   */
  async findCalendarEvents(
    filters: CalendarEventFilters,
    options?: CalendarEventPaginationOptions
  ): Promise<CalendarEventPaginatedResult> {
    return await this.calendarEventRepository.findMany(filters, options);
  }

  /**
   * Get calendar event by ID
   */
  async getCalendarEventById(
    eventId: CalendarEventId
  ): Promise<CalendarEvent | null> {
    return await this.calendarEventRepository.findById(eventId);
  }

  /**
   * Detect scheduling conflicts for a user
   */
  async detectSchedulingConflicts(
    userId: UserId,
    startDate: Date,
    endDate: Date,
    excludeEventId?: CalendarEventId
  ): Promise<CalendarEventConflict[]> {
    const conflictingEvents =
      await this.calendarEventRepository.findConflictingEvents(
        userId,
        startDate,
        endDate,
        excludeEventId
      );

    return conflictingEvents.map(event => ({
      eventId: event.id.value,
      title: event.title.value,
      startDate: event.startDate.value,
      endDate: event.endDate?.value || null,
      conflictType: this.determineConflictType(startDate, endDate, event),
      severity: this.determineConflictSeverity(startDate, endDate, event),
    }));
  }

  /**
   * Schedule an event with intelligent conflict resolution
   */
  async scheduleEventWithConflictResolution(
    props: CreateCalendarEventProps,
    options: ConflictDetectionOptions
  ): Promise<EventSchedulingResult> {
    const conflicts = await this.detectSchedulingConflicts(
      UserId.create(props.userId),
      props.startDate,
      props.endDate || new Date(props.startDate.getTime() + 60 * 60 * 1000)
    );

    const warnings: string[] = [];
    let success = true;

    // Check conflict severity
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    if (highSeverityConflicts.length > 0 && !options.allowOverlap) {
      success = false;
      warnings.push(
        `${highSeverityConflicts.length} high severity conflicts detected`
      );
    }

    // Check maximum conflicts
    if (conflicts.length > options.maxConflicts) {
      success = false;
      warnings.push(
        `Too many conflicts: ${conflicts.length} > ${options.maxConflicts}`
      );
    }

    // If successful, create the event
    if (success) {
      const { event } = await this.createCalendarEvent(props, {
        skipConflictCheck: true,
      });
    }

    return {
      success,
      conflicts,
      warnings,
    };
  }

  /**
   * Find optimal time slots for scheduling
   */
  async findOptimalTimeSlots(
    userId: UserId,
    duration: number, // in minutes
    startDate: Date,
    endDate: Date,
    workingHours?: { start: number; end: number } // hours in 24h format
  ): Promise<Array<{ startTime: Date; endTime: Date; score: number }>> {
    const existingEvents = await this.calendarEventRepository.findMany({
      userId,
      startDate,
      endDate,
    });

    const slots: Array<{ startTime: Date; endTime: Date; score: number }> = [];
    const workingStart = workingHours?.start || 9; // 9 AM
    const workingEnd = workingHours?.end || 17; // 5 PM

    // Generate potential time slots
    const current = new Date(startDate);
    while (current < endDate) {
      const hour = current.getHours();

      // Skip non-working hours
      if (hour < workingStart || hour >= workingEnd) {
        current.setHours(current.getHours() + 1);
        continue;
      }

      const slotEnd = new Date(current.getTime() + duration * 60 * 1000);

      // Check for conflicts
      const hasConflict = existingEvents.data.some(event => {
        const eventStart = event.startDate.value;
        const eventEnd =
          event.endDate?.value ||
          new Date(eventStart.getTime() + 60 * 60 * 1000);
        return current < eventEnd && slotEnd > eventStart;
      });

      if (!hasConflict) {
        // Calculate score based on time of day preference
        const score = this.calculateTimeSlotScore(
          current,
          workingStart,
          workingEnd
        );
        slots.push({
          startTime: new Date(current),
          endTime: new Date(slotEnd),
          score,
        });
      }

      // Move to next 30-minute slot
      current.setMinutes(current.getMinutes() + 30);
    }

    // Sort by score (highest first)
    return slots.sort((a, b) => b.score - a.score).slice(0, 10); // Return top 10 slots
  }

  /**
   * Get calendar statistics for a user
   */
  async getCalendarStatistics(
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
    conflictRate: number;
    utilizationRate: number;
  }> {
    const baseStats = await this.calendarEventRepository.getStatistics(
      userId,
      startDate,
      endDate
    );

    // Calculate additional metrics
    const events = await this.calendarEventRepository.findMany({ userId });
    const conflictRate = await this.calculateConflictRate(events.data);
    const utilizationRate = await this.calculateUtilizationRate(
      events.data,
      startDate,
      endDate
    );

    return {
      ...baseStats,
      conflictRate,
      utilizationRate,
    };
  }

  /**
   * Process recurring events and generate instances
   */
  async processRecurringEvents(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const recurringEvents =
      await this.calendarEventRepository.findRecurringEventsForGeneration(
        startDate,
        endDate
      );

    const generatedEvents: CalendarEvent[] = [];

    for (const recurringEvent of recurringEvents) {
      if (recurringEvent.recurrenceRule) {
        const instances = this.generateRecurrenceInstances(
          recurringEvent,
          startDate,
          endDate
        );

        for (const instance of instances) {
          await this.calendarEventRepository.save(instance);
          generatedEvents.push(instance);
        }
      }
    }

    return generatedEvents;
  }

  private determineConflictType(
    newStart: Date,
    newEnd: Date,
    existingEvent: CalendarEvent
  ): 'overlap' | 'double_booking' {
    const existingStart = existingEvent.startDate.value;
    const existingEnd =
      existingEvent.endDate?.value ||
      new Date(existingStart.getTime() + 60 * 60 * 1000);

    // Complete overlap
    if (newStart <= existingStart && newEnd >= existingEnd) {
      return 'double_booking';
    }

    // Partial overlap
    return 'overlap';
  }

  private determineConflictSeverity(
    newStart: Date,
    newEnd: Date,
    existingEvent: CalendarEvent
  ): 'low' | 'medium' | 'high' {
    const existingStart = existingEvent.startDate.value;
    const existingEnd =
      existingEvent.endDate?.value ||
      new Date(existingStart.getTime() + 60 * 60 * 1000);

    const overlapMinutes =
      Math.min(newEnd.getTime(), existingEnd.getTime()) -
      Math.max(newStart.getTime(), existingStart.getTime());
    const overlapHours = overlapMinutes / (1000 * 60 * 60);

    // High severity for meetings and important events
    if (existingEvent.type === EventType.MEETING || overlapHours >= 2) {
      return 'high';
    }

    // Medium severity for significant overlaps
    if (overlapHours >= 0.5) {
      return 'medium';
    }

    return 'low';
  }

  private calculateTimeSlotScore(
    time: Date,
    workingStart: number,
    workingEnd: number
  ): number {
    const hour = time.getHours();
    const minute = time.getMinutes();

    // Prefer mid-morning and mid-afternoon slots
    const hourScore = Math.max(
      0,
      100 - Math.abs(hour - 10) * 10 - Math.abs(hour - 14) * 5
    );

    // Prefer on-the-hour and half-hour slots
    const minuteScore = minute === 0 ? 20 : minute === 30 ? 10 : 0;

    return hourScore + minuteScore;
  }

  private async calculateConflictRate(
    events: CalendarEvent[]
  ): Promise<number> {
    if (events.length === 0) return 0;

    let conflictCount = 0;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (events[i].checkSchedulingConflict(events[j])) {
          conflictCount++;
        }
      }
    }

    return (conflictCount / events.length) * 100;
  }

  private async calculateUtilizationRate(
    events: CalendarEvent[],
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    if (!startDate || !endDate) return 0;

    const totalPeriodHours =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const totalEventHours = events.reduce(
      (sum, event) => sum + event.getDuration() / 60,
      0
    );

    return Math.min((totalEventHours / totalPeriodHours) * 100, 100);
  }

  private generateRecurrenceInstances(
    recurringEvent: CalendarEvent,
    startDate: Date,
    endDate: Date
  ): CalendarEvent[] {
    // This is a simplified implementation
    // In a real system, you would use a proper RRULE parser like 'rrule' library
    const instances: CalendarEvent[] = [];

    if (!recurringEvent.recurrenceRule) {
      return instances;
    }

    // Basic daily recurrence example
    if (recurringEvent.recurrenceRule.value.includes('FREQ=DAILY')) {
      const current = new Date(recurringEvent.startDate.value);
      const duration = recurringEvent.getDuration();

      while (current <= endDate) {
        if (current >= startDate) {
          const instanceEndDate = new Date(
            current.getTime() + duration * 60 * 1000
          );

          const instance = CalendarEvent.create({
            title: recurringEvent.title.value,
            description: recurringEvent.description?.value,
            type: recurringEvent.type,
            startDate: new Date(current),
            endDate: instanceEndDate,
            allDay: recurringEvent.allDay,
            location: recurringEvent.location?.value,
            url: recurringEvent.url,
            color: recurringEvent.color.value,
            userId: recurringEvent.userId.value,
            workspaceId: recurringEvent.workspaceId?.value,
            teamId: recurringEvent.teamId?.value,
            projectId: recurringEvent.projectId?.value,
            taskId: recurringEvent.taskId?.value,
            isRecurring: false, // Instances are not recurring themselves
            metadata: {
              ...recurringEvent.metadata,
              parentEventId: recurringEvent.id.value,
              instanceDate: current.toISOString(),
            },
          });

          instances.push(instance);
        }

        current.setDate(current.getDate() + 1);
      }
    }

    return instances;
  }
}
