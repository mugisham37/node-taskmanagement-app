import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { AnalyticsEventId } from '../value-objects/analytics-event-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';

export interface AnalyticsEventProps {
  id: AnalyticsEventId;
  workspaceId: WorkspaceId;
  userId?: UserId;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AnalyticsEventRecordedEvent extends BaseDomainEvent {
  constructor(eventId: AnalyticsEventId, eventType: string) {
    super(eventId.value, 'AnalyticsEventRecorded', {
      eventId: eventId.value,
      eventType,
    });
  }
}

export class AnalyticsEventAggregate extends AggregateRoot<AnalyticsEventProps> {
  private constructor(props: AnalyticsEventProps) {
    super(props, props.id.value, props.timestamp, props.timestamp);
  }

  public static create(
    props: Omit<AnalyticsEventProps, 'id' | 'timestamp'>
  ): AnalyticsEventAggregate {
    const event = new AnalyticsEventAggregate({
      ...props,
      id: AnalyticsEventId.generate(),
      timestamp: new Date(),
    });

    event.addDomainEvent(
      new AnalyticsEventRecordedEvent(event.id, event.eventType)
    );

    return event;
  }

  public static fromPersistence(
    props: AnalyticsEventProps
  ): AnalyticsEventAggregate {
    return new AnalyticsEventAggregate(props);
  }

  get id(): AnalyticsEventId {
    return this.props.id;
  }

  get eventType(): string {
    return this.props.eventType;
  }

  get eventData(): Record<string, any> {
    return { ...this.props.eventData };
  }

  protected validate(): void {
    if (!this.props.eventType || this.props.eventType.trim().length === 0) {
      throw new Error('Analytics event type cannot be empty');
    }
  }

  protected applyBusinessRules(): void {
    // Analytics events are immutable once created
  }
}
