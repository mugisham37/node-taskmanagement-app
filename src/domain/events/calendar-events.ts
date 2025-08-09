import { DomainEvent } from './domain-event';

export class CalendarEventCreatedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly startDate: Date,
    public readonly type: string
  ) {
    super('CalendarEventCreated', {
      eventId,
      userId,
      title,
      startDate,
      type,
    });
  }
}

export class CalendarEventUpdatedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly changes: string[]
  ) {
    super('CalendarEventUpdated', {
      eventId,
      userId,
      changes,
    });
  }
}

export class CalendarEventDeletedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly title: string
  ) {
    super('CalendarEventDeleted', {
      eventId,
      userId,
      title,
    });
  }
}

export class CalendarEventAttendeeAddedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly attendeeUserId: string,
    public readonly organizerUserId: string
  ) {
    super('CalendarEventAttendeeAdded', {
      eventId,
      attendeeUserId,
      organizerUserId,
    });
  }
}

export class CalendarEventReminderTriggeredEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly reminderId: string,
    public readonly minutesBefore: number
  ) {
    super('CalendarEventReminderTriggered', {
      eventId,
      userId,
      reminderId,
      minutesBefore,
    });
  }
}
