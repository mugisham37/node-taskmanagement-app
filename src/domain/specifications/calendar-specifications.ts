import { Specification } from './task-specifications';
import { CalendarEvent, EventType } from '../entities/calendar-event';

export class CalendarEventIsUpcomingSpecification extends Specification<CalendarEvent> {
  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.isUpcoming();
  }
}

export class CalendarEventIsPastSpecification extends Specification<CalendarEvent> {
  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.isPast();
  }
}

export class CalendarEventByTypeSpecification extends Specification<CalendarEvent> {
  constructor(private readonly type: EventType) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.type === this.type;
  }
}

export class CalendarEventByUserSpecification extends Specification<CalendarEvent> {
  constructor(private readonly userId: string) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.userId === this.userId;
  }
}

export class CalendarEventByWorkspaceSpecification extends Specification<CalendarEvent> {
  constructor(private readonly workspaceId: string) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.workspaceId === this.workspaceId;
  }
}

export class CalendarEventByProjectSpecification extends Specification<CalendarEvent> {
  constructor(private readonly projectId: string) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.projectId === this.projectId;
  }
}

export class CalendarEventByTaskSpecification extends Specification<CalendarEvent> {
  constructor(private readonly taskId: string) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.taskId === this.taskId;
  }
}

export class CalendarEventIsAllDaySpecification extends Specification<CalendarEvent> {
  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.allDay;
  }
}

export class CalendarEventIsRecurringSpecification extends Specification<CalendarEvent> {
  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.isRecurring;
  }
}

export class CalendarEventHasAttendeesSpecification extends Specification<CalendarEvent> {
  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.attendees.length > 0;
  }
}

export class CalendarEventHasRemindersSpecification extends Specification<CalendarEvent> {
  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.reminders.length > 0;
  }
}

export class CalendarEventInDateRangeSpecification extends Specification<CalendarEvent> {
  constructor(
    private readonly startDate: Date,
    private readonly endDate: Date
  ) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    const eventStart = event.startDate;
    const eventEnd = event.endDate || event.startDate;

    // Check if event overlaps with the date range
    return eventStart <= this.endDate && eventEnd >= this.startDate;
  }
}

export class CalendarEventDurationSpecification extends Specification<CalendarEvent> {
  constructor(
    private readonly minDuration: number, // in minutes
    private readonly maxDuration?: number // in minutes
  ) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    const duration = event.getDuration();

    if (this.maxDuration) {
      return duration >= this.minDuration && duration <= this.maxDuration;
    }

    return duration >= this.minDuration;
  }
}

export class CalendarEventConflictSpecification extends Specification<CalendarEvent> {
  constructor(private readonly otherEvent: CalendarEvent) {
    super();
  }

  isSatisfiedBy(event: CalendarEvent): boolean {
    return event.checkSchedulingConflict(this.otherEvent);
  }
}
