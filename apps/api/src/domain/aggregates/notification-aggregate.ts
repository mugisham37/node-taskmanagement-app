import { AggregateRoot, AggregateProps } from './aggregate-root';
import {
  Notification,
  NotificationPreferences,
  NotificationChannel,
} from '../entities/notification';
import {
  NotificationCreatedEvent,
  NotificationSentEvent,
  NotificationReadEvent,
} from '../events/notification-events';

export interface NotificationAggregateProps extends AggregateProps {
  notification: Notification;
  preferences?: NotificationPreferences;
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
    const props: NotificationAggregateProps = {
      id: notification.id.value, // Convert NotificationId to string
      notification,
      createdAt: now,
      updatedAt: now,
    };
    
    if (preferences) {
      props.preferences = preferences;
    }
    
    const aggregate = new NotificationAggregate(props);

    aggregate.addDomainEvent(
      new NotificationCreatedEvent(
        notification.id.value, // Convert NotificationId to string
        notification.userId.value, // Convert UserId to string
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
        this.props.notification.id.value,
        this.props.notification.userId.value,
        enabledChannels
      )
    );
  }

  public markAsRead(): void {
    this.props.notification.markAsRead();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new NotificationReadEvent(
        this.props.notification.id.value,
        this.props.notification.userId.value,
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

  protected override validate(): void {
    if (!this.props.notification) {
      throw new Error('Notification is required');
    }
  }

  // Required abstract method implementations
  protected applyEvent(_event: any): void {
    // Handle event sourcing if needed
    // For now, we'll leave this empty as it's not being used
  }

  protected checkInvariants(): void {
    if (!this.props.notification) {
      throw new Error('Notification is required');
    }
    
    // Add other business rule validations here
    if (!this.props.notification.title || this.props.notification.title.trim() === '') {
      throw new Error('Notification title is required');
    }
  }

  createSnapshot(): Record<string, any> {
    return {
      id: this.id,
      notification: {
        id: this.props.notification.id.value,
        userId: this.props.notification.userId.value,
        type: this.props.notification.type,
        title: this.props.notification.title,
        message: this.props.notification.message,
        status: this.props.notification.status,
        channels: this.props.notification.channels,
        // Add other notification properties as needed
      },
      preferences: this.props.preferences ? {
        // Add preference properties as needed
      } : null,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  restoreFromSnapshot(_snapshot: Record<string, any>): void {
    // Implement snapshot restoration if needed for event sourcing
    // For now, we'll leave this empty as it's not being used
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    try {
      this.checkInvariants();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    
    return errors;
  }
}
