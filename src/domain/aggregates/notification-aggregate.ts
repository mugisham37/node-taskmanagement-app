import { AggregateRoot } from './aggregate-root';
import {
  Notification,
  NotificationPreferences,
  NotificationType,
  NotificationChannel,
} from '../entities/notification';
import {
  NotificationCreatedEvent,
  NotificationSentEvent,
  NotificationReadEvent,
} from '../events/notification-events';

export interface NotificationAggregateProps {
  id: string;
  notification: Notification;
  preferences?: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationAggregate extends AggregateRoot<NotificationAggregateProps> {
  private constructor(props: NotificationAggregateProps) {
    super(props);
  }

  public static create(
    notification: Notification,
    preferences?: NotificationPreferences
  ): NotificationAggregate {
    const now = new Date();
    const aggregate = new NotificationAggregate({
      id: notification.id,
      notification,
      preferences,
      createdAt: now,
      updatedAt: now,
    });

    aggregate.addDomainEvent(
      new NotificationCreatedEvent(
        notification.id,
        notification.userId,
        notification.type,
        notification.title
      )
    );

    return aggregate;
  }

  public static fromPersistence(
    props: NotificationAggregateProps
  ): NotificationAggregate {
    return new NotificationAggregate(props);
  }

  get notification(): Notification {
    return this.props.notification;
  }

  get preferences(): NotificationPreferences | undefined {
    return this.props.preferences;
  }

  public canSend(): boolean {
    if (!this.props.preferences) {
      return true; // Default to allowing if no preferences
    }

    // Check if notification type is enabled
    if (!this.props.preferences.isTypeEnabled(this.props.notification.type)) {
      return false;
    }

    // Check quiet hours
    if (this.props.preferences.isInQuietHours()) {
      return false;
    }

    return this.props.notification.isReadyToSend();
  }

  public getEnabledChannels(): NotificationChannel[] {
    if (!this.props.preferences) {
      return this.props.notification.channels;
    }

    return this.props.preferences.getEnabledChannelsForType(
      this.props.notification.type
    );
  }

  public send(): void {
    if (!this.canSend()) {
      throw new Error(
        'Notification cannot be sent due to user preferences or state'
      );
    }

    const enabledChannels = this.getEnabledChannels();
    if (enabledChannels.length === 0) {
      throw new Error('No enabled channels for this notification');
    }

    this.props.notification.markAsSent();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new NotificationSentEvent(
        this.props.notification.id,
        this.props.notification.userId,
        enabledChannels
      )
    );
  }

  public markAsRead(): void {
    this.props.notification.markAsRead();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new NotificationReadEvent(
        this.props.notification.id,
        this.props.notification.userId,
        new Date()
      )
    );
  }

  public updatePreferences(preferences: NotificationPreferences): void {
    this.props.preferences = preferences;
    this.props.updatedAt = new Date();
  }

  public retry(): void {
    if (!this.props.notification.canRetry()) {
      throw new Error('Notification cannot be retried');
    }

    this.props.notification.incrementRetryCount();
    this.props.updatedAt = new Date();
  }

  public fail(reason: string): void {
    this.props.notification.markAsFailed(reason);
    this.props.updatedAt = new Date();
  }

  protected validate(): void {
    if (!this.props.notification) {
      throw new Error('Notification is required');
    }
  }
}
