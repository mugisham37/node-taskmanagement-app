import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { CalendarEventId } from '../value-objects/calendar-event-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';

export interface CalendarEventProps {
  id: CalendarEventId;
  workspaceId: WorkspaceId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  location?: string;
  organizerId: UserId;
  attendees: UserId[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class CalendarEventCreatedEvent extends BaseDomainEvent {
  constructor(eventId: CalendarEventId, title: string, organizerId: UserId) {
    super(eventId.value, 'CalendarEventCreated', {
      eventId: eventId.value,
      title,
      organizerId: organizerId.value,
    });
  }
}

export class CalendarEventAggregate extends AggregateRoot<CalendarEventProps> {
  private constructor(props: CalendarEventProps) {
    super(props, props.id.value, props.createdAt, props.updatedAt);
  }

  public static create(
    props: Omit<CalendarEventProps, 'id' | 'createdAt' | 'updatedAt'>
  ): CalendarEventAggregate {
    const event = new CalendarEventAggregate({
      ...props,
      id: CalendarEventId.generate(),
      attendees: props.attendees || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    event.addDomainEvent(
      new CalendarEventCreatedEvent(event.id, event.title, event.organizerId)
    );

    return event;
  }

  public static fromPersistence(
    props: CalendarEventProps
  ): CalendarEventAggregate {
    return new CalendarEventAggregate(props);
  }

  // Getters
  get id(): CalendarEventId {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get title(): string {
    return this.props.title;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get organizerId(): UserId {
    return this.props.organizerId;
  }

  get attendees(): UserId[] {
    return [...this.props.attendees];
  }

  get isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  // Business methods
  public isOrganizer(userId: UserId): boolean {
    return this.props.organizerId.equals(userId);
  }

  public isAttendee(userId: UserId): boolean {
    return this.props.attendees.some(attendee => attendee.equals(userId));
  }

  // Aggregate root implementation
  protected validate(): void {
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new Error('Calendar event title cannot be empty');
    }

    if (this.props.startDate >= this.props.endDate) {
      throw new Error('Start date must be before end date');
    }
  }

  protected applyBusinessRules(): void {
    // Ensure organizer is always an attendee
    if (!this.props.attendees.some(a => a.equals(this.props.organizerId))) {
      this.props.attendees.push(this.props.organizerId);
    }

    this.props.updatedAt = new Date();
  }
}
