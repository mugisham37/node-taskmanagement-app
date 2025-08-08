import { CalendarEventAggregate } from '../aggregates/calendar-event.aggregate';
import { UserId } from '../../authentication/value-objects/user-id';
import { ICalendarEventRepository } from '../repositories/calendar-event.repository.interface';

/**
 * Calendar Domain Service
 * Contains business logic for calendar operations
 */
export class CalendarDomainService {
  constructor(
    private readonly calendarEventRepository: ICalendarEventRepository
  ) {}

  /**
   * Checks if a user has conflicts with a new event
   */
  async hasScheduleConflict(
    userId: UserId,
    startDate: Date,
    endDate: Date,
    excludeEventId?: string
  ): Promise<{
    hasConflict: boolean;
    conflictingEvents: CalendarEventAggregate[];
  }> {
    const userEvents = await this.calendarEventRepository.findByUserId(userId);

    const conflictingEvents = userEvents.filter(event => {
      if (excludeEventId && event.id.value === excludeEventId) {
        return false;
      }

      if (event.isDeleted) {
        return false;
      }

      // Check for time overlap
      return (
        (startDate >= event.startDate && startDate < event.endDate) ||
        (endDate > event.startDate && endDate <= event.endDate) ||
        (startDate <= event.startDate && endDate >= event.endDate)
      );
    });

    return {
      hasConflict: conflictingEvents.length > 0,
      conflictingEvents,
    };
  }

  /**
   * Finds the best available time slot for a meeting
   */
  async findAvailableTimeSlot(
    attendeeIds: UserId[],
    duration: number, // in minutes
    preferredDate: Date,
    workingHours: { start: string; end: string } = {
      start: '09:00',
      end: '17:00',
    }
  ): Promise<{
    suggestedSlots: Array<{
      startDate: Date;
      endDate: Date;
      availableAttendees: number;
    }>;
  }> {
    // This is a simplified implementation
    // In a real system, this would be more sophisticated
    const suggestedSlots: Array<{
      startDate: Date;
      endDate: Date;
      availableAttendees: number;
    }> = [];

    // Generate time slots for the preferred date
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);

    const dayStart = new Date(preferredDate);
    dayStart.setHours(startHour, startMinute, 0, 0);

    const dayEnd = new Date(preferredDate);
    dayEnd.setHours(endHour, endMinute, 0, 0);

    // Check 30-minute intervals
    const intervalMinutes = 30;
    let currentTime = new Date(dayStart);

    while (currentTime.getTime() + duration * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);

      let availableCount = 0;
      for (const attendeeId of attendeeIds) {
        const conflict = await this.hasScheduleConflict(
          attendeeId,
          currentTime,
          slotEnd
        );
        if (!conflict.hasConflict) {
          availableCount++;
        }
      }

      if (availableCount > 0) {
        suggestedSlots.push({
          startDate: new Date(currentTime),
          endDate: new Date(slotEnd),
          availableAttendees: availableCount,
        });
      }

      currentTime = new Date(currentTime.getTime() + intervalMinutes * 60000);
    }

    // Sort by most available attendees
    suggestedSlots.sort((a, b) => b.availableAttendees - a.availableAttendees);

    return { suggestedSlots: suggestedSlots.slice(0, 5) }; // Return top 5 suggestions
  }
}
