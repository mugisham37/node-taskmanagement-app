import { DomainEvent } from './domain-event';

/**
 * Calendar Event Created Event
 */
export class CalendarEventCreatedEvent extends DomainEvent {
  constructor(
    public override readonly eventId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly startDate: Date,
    public readonly type: string
  ) {
    super();
  }

  getEventName(): string {
    return 'CalendarEventCreated';
  }

  getAggregateId(): string {
    return this.eventId;
  }

  protected getPayload(): Record<string, any> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      title: this.title,
      startDate: this.startDate.toISOString(),
      type: this.type,
    };
  }
}

/**
 * Calendar Event Updated Event
 */
export class CalendarEventUpdatedEvent extends DomainEvent {
  constructor(
    public override readonly eventId: string,
    public readonly userId: string,
    public readonly changes: string[]
  ) {
    super();
  }

  getEventName(): string {
    return 'CalendarEventUpdated';
  }

  getAggregateId(): string {
    return this.eventId;
  }

  protected getPayload(): Record<string, any> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      changes: this.changes,
    };
  }
}

/**
 * Calendar Event Deleted Event
 */
export class CalendarEventDeletedEvent extends DomainEvent {
  constructor(
    public override readonly eventId: string,
    public readonly userId: string,
    public readonly title: string
  ) {
    super();
  }

  getEventName(): string {
    return 'CalendarEventDeleted';
  }

  getAggregateId(): string {
    return this.eventId;
  }

  protected getPayload(): Record<string, any> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      title: this.title,
    };
  }
}

/**
 * Calendar Event Attendee Added Event
 */
export class CalendarEventAttendeeAddedEvent extends DomainEvent {
  constructor(
    public override readonly eventId: string,
    public readonly attendeeUserId: string,
    public readonly organizerUserId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'CalendarEventAttendeeAdded';
  }

  getAggregateId(): string {
    return this.eventId;
  }

  protected getPayload(): Record<string, any> {
    return {
      eventId: this.eventId,
      attendeeUserId: this.attendeeUserId,
      organizerUserId: this.organizerUserId,
    };
  }
}

/**
 * Calendar Event Reminder Triggered Event
 */
export class CalendarEventReminderTriggeredEvent extends DomainEvent {
  constructor(
    public override readonly eventId: string,
    public readonly userId: string,
    public readonly reminderId: string,
    public readonly minutesBefore: number
  ) {
    super();
  }

  getEventName(): string {
    return 'CalendarEventReminderTriggered';
  }

  getAggregateId(): string {
    return this.eventId;
  }

  protected getPayload(): Record<string, any> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      reminderId: this.reminderId,
      minutesBefore: this.minutesBefore,
    };
  }
}
