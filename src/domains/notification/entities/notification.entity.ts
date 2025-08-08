import { Entity } from '../../../shared/domain/entity';
import { NotificationId } from '../value-objects/notification-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationPriority } from '../value-objects/notification-priority';
import { NotificationStatus } from '../value-objects/notification-status';
import { DomainEvent } from '../../../shared/domain/domain-event';

export interface NotificationProps {
  id: NotificationId;
  userId: UserId;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  actionUrl?: string;
  expiresAt?: Date;
  scheduledFor?: Date;
  deliveryAttempts: number;
  lastDeliveryAttempt?: Date;
  deliveryResults: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationEntity extends Entity<NotificationProps> {
  private constructor(props: NotificationProps) {
    super(props);
  }

  public static create(
    userId: UserId,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, any> = {},
    channels: NotificationChannel[] = [NotificationChannel.IN_APP],
    priority: NotificationPriority = NotificationPriority.NORMAL,
    options: {
      actionUrl?: string;
      expiresAt?: Date;
      scheduledFor?: Date;
    } = {}
  ): NotificationEntity {
    const id = NotificationId.generate();
    const now = new Date();

    const notification = new NotificationEntity({
      id,
      userId,
      type,
      title,
      message,
      data,
      channels,
      priority,
      status: options.scheduledFor
        ? NotificationStatus.SCHEDULED
        : NotificationStatus.PENDING,
      actionUrl: options.actionUrl,
      expiresAt: options.expiresAt,
      scheduledFor: options.scheduledFor,
      deliveryAttempts: 0,
      deliveryResults: {},
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });

    notification.addDomainEvent(new NotificationCreatedEvent(notification));
    return notification;
  }

  public static fromPersistence(props: NotificationProps): NotificationEntity {
    return new NotificationEntity(props);
  }

  // Getters
  public get id(): NotificationId {
    return this.props.id;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get type(): NotificationType {
    return this.props.type;
  }

  public get title(): string {
    return this.props.title;
  }

  public get message(): string {
    return this.props.message;
  }

  public get data(): Record<string, any> {
    return this.props.data;
  }

  public get channels(): NotificationChannel[] {
    return this.props.channels;
  }

  public get priority(): NotificationPriority {
    return this.props.priority;
  }

  public get status(): NotificationStatus {
    return this.props.status;
  }

  public get actionUrl(): string | undefined {
    return this.props.actionUrl;
  }

  public get expiresAt(): Date | undefined {
    return this.props.expiresAt;
  }

  public get scheduledFor(): Date | undefined {
    return this.props.scheduledFor;
  }

  public get deliveryAttempts(): number {
    return this.props.deliveryAttempts;
  }

  public get lastDeliveryAttempt(): Date | undefined {
    return this.props.lastDeliveryAttempt;
  }

  public get deliveryResults(): Record<string, any> {
    return this.props.deliveryResults;
  }

  public get isRead(): boolean {
    return this.props.isRead;
  }

  public get readAt(): Date | undefined {
    return this.props.readAt;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public markAsRead(): void {
    if (this.props.isRead) {
      return;
    }

    this.props.isRead = true;
    this.props.readAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationReadEvent(this));
  }

  public markAsDelivered(channel: NotificationChannel, result: any): void {
    this.props.deliveryResults[channel.value] = {
      success: true,
      result,
      timestamp: new Date(),
    };
    this.props.lastDeliveryAttempt = new Date();
    this.props.updatedAt = new Date();

    // Check if all channels have been delivered
    const allChannelsDelivered = this.props.channels.every(
      ch => this.props.deliveryResults[ch.value]?.success
    );

    if (allChannelsDelivered) {
      this.props.status = NotificationStatus.DELIVERED;
      this.addDomainEvent(new NotificationDeliveredEvent(this));
    }
  }

  public markAsDeliveryFailed(channel: NotificationChannel, error: any): void {
    this.props.deliveryAttempts += 1;
    this.props.deliveryResults[channel.value] = {
      success: false,
      error: error.message || error,
      timestamp: new Date(),
    };
    this.props.lastDeliveryAttempt = new Date();
    this.props.updatedAt = new Date();

    // Check if we should mark as failed (after max attempts)
    if (this.props.deliveryAttempts >= 3) {
      this.props.status = NotificationStatus.FAILED;
      this.addDomainEvent(new NotificationDeliveryFailedEvent(this));
    }
  }

  public isExpired(): boolean {
    return this.props.expiresAt ? new Date() > this.props.expiresAt : false;
  }

  public isScheduled(): boolean {
    return this.props.status === NotificationStatus.SCHEDULED;
  }

  public isReadyForDelivery(): boolean {
    if (this.isExpired()) {
      return false;
    }

    if (this.props.scheduledFor && new Date() < this.props.scheduledFor) {
      return false;
    }

    return (
      this.props.status === NotificationStatus.PENDING ||
      this.props.status === NotificationStatus.SCHEDULED
    );
  }

  public canRetryDelivery(): boolean {
    return (
      this.props.deliveryAttempts < 3 &&
      this.props.status !== NotificationStatus.DELIVERED &&
      !this.isExpired()
    );
  }

  public updateData(newData: Record<string, any>): void {
    this.props.data = { ...this.props.data, ...newData };
    this.props.updatedAt = new Date();
  }

  public addChannel(channel: NotificationChannel): void {
    if (!this.props.channels.some(ch => ch.equals(channel))) {
      this.props.channels.push(channel);
      this.props.updatedAt = new Date();
    }
  }

  public removeChannel(channel: NotificationChannel): void {
    this.props.channels = this.props.channels.filter(ch => !ch.equals(channel));
    this.props.updatedAt = new Date();
  }
}

// Domain Events
export class NotificationCreatedEvent extends DomainEvent {
  constructor(public readonly notification: NotificationEntity) {
    super('notification.created', notification.id.value);
  }
}

export class NotificationReadEvent extends DomainEvent {
  constructor(public readonly notification: NotificationEntity) {
    super('notification.read', notification.id.value);
  }
}

export class NotificationDeliveredEvent extends DomainEvent {
  constructor(public readonly notification: NotificationEntity) {
    super('notification.delivered', notification.id.value);
  }
}

export class NotificationDeliveryFailedEvent extends DomainEvent {
  constructor(public readonly notification: NotificationEntity) {
    super('notification.delivery_failed', notification.id.value);
  }
}
