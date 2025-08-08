import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { NotificationId } from '../value-objects/notification-id';
import { UserId } from '../../authentication/value-objects/user-id';

export interface NotificationProps {
  id: NotificationId;
  recipientId: UserId;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationCreatedEvent extends BaseDomainEvent {
  constructor(notificationId: NotificationId, recipientId: UserId) {
    super(notificationId.value, 'NotificationCreated', {
      notificationId: notificationId.value,
      recipientId: recipientId.value,
    });
  }
}

export class NotificationAggregate extends AggregateRoot<NotificationProps> {
  private constructor(props: NotificationProps) {
    super(props, props.id.value, props.createdAt, props.updatedAt);
  }

  public static create(
    props: Omit<NotificationProps, 'id' | 'isRead' | 'createdAt' | 'updatedAt'>
  ): NotificationAggregate {
    const notification = new NotificationAggregate({
      ...props,
      id: NotificationId.generate(),
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    notification.addDomainEvent(
      new NotificationCreatedEvent(notification.id, notification.recipientId)
    );

    return notification;
  }

  public static fromPersistence(
    props: NotificationProps
  ): NotificationAggregate {
    return new NotificationAggregate(props);
  }

  get id(): NotificationId {
    return this.props.id;
  }

  get recipientId(): UserId {
    return this.props.recipientId;
  }

  get isRead(): boolean {
    return this.props.isRead;
  }

  public markAsRead(): void {
    if (!this.props.isRead) {
      this.props.isRead = true;
      this.props.readAt = new Date();
      this.markAsModified();
    }
  }

  protected validate(): void {
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new Error('Notification title cannot be empty');
    }
  }

  protected applyBusinessRules(): void {
    this.props.updatedAt = new Date();
  }
}
