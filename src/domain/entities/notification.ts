import { BaseEntity } from './base-entity';

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  COMMENT_ADDED = 'comment_added',
  MENTION = 'mention',
  WORKSPACE_INVITATION = 'workspace_invitation',
  SYSTEM_ALERT = 'system_alert',
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
  SMS = 'sms',
  WEBHOOK = 'webhook',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export interface NotificationProps {
  id: string;
  userId: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  status: NotificationStatus;
  readAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  scheduledFor?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Notification extends BaseEntity<NotificationProps> {
  constructor(props: NotificationProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get userId(): string {
    return this.props.userId;
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get projectId(): string | undefined {
    return this.props.projectId;
  }

  get taskId(): string | undefined {
    return this.props.taskId;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  get title(): string {
    return this.props.title;
  }

  get message(): string {
    return this.props.message;
  }

  get data(): Record<string, any> | undefined {
    return this.props.data;
  }

  get channels(): NotificationChannel[] {
    return this.props.channels;
  }

  get status(): NotificationStatus {
    return this.props.status;
  }

  get readAt(): Date | undefined {
    return this.props.readAt;
  }

  get sentAt(): Date | undefined {
    return this.props.sentAt;
  }

  get deliveredAt(): Date | undefined {
    return this.props.deliveredAt;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
  }

  get retryCount(): number {
    return this.props.retryCount;
  }

  get maxRetries(): number {
    return this.props.maxRetries;
  }

  get scheduledFor(): Date | undefined {
    return this.props.scheduledFor;
  }

  get expiresAt(): Date | undefined {
    return this.props.expiresAt;
  }

  // Business methods
  public markAsRead(): void {
    if (this.props.status === NotificationStatus.READ) {
      return;
    }

    this.props.status = NotificationStatus.READ;
    this.props.readAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsSent(): void {
    this.props.status = NotificationStatus.SENT;
    this.props.sentAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsDelivered(): void {
    this.props.status = NotificationStatus.DELIVERED;
    this.props.deliveredAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsFailed(reason: string): void {
    this.props.status = NotificationStatus.FAILED;
    this.props.failureReason = reason;
    this.props.updatedAt = new Date();
  }

  public incrementRetryCount(): void {
    this.props.retryCount++;
    this.props.updatedAt = new Date();
  }

  public canRetry(): boolean {
    return (
      this.props.retryCount < this.props.maxRetries &&
      this.props.status === NotificationStatus.FAILED
    );
  }

  public isExpired(): boolean {
    if (!this.props.expiresAt) return false;
    return new Date() > this.props.expiresAt;
  }

  public isScheduled(): boolean {
    if (!this.props.scheduledFor) return false;
    return new Date() < this.props.scheduledFor;
  }

  public isReadyToSend(): boolean {
    if (this.isExpired()) return false;
    if (this.props.status !== NotificationStatus.PENDING) return false;
    if (this.isScheduled()) return false;
    return true;
  }

  public isRead(): boolean {
    return this.props.status === NotificationStatus.READ;
  }

  public hasChannel(channel: NotificationChannel): boolean {
    return this.props.channels.includes(channel);
  }

  public addChannel(channel: NotificationChannel): void {
    if (!this.hasChannel(channel)) {
      this.props.channels.push(channel);
      this.props.updatedAt = new Date();
    }
  }

  public removeChannel(channel: NotificationChannel): void {
    const index = this.props.channels.indexOf(channel);
    if (index > -1) {
      this.props.channels.splice(index, 1);
      this.props.updatedAt = new Date();
    }
  }

  public updateData(data: Record<string, any>): void {
    this.props.data = { ...this.props.data, ...data };
    this.props.updatedAt = new Date();
  }

  public static create(
    props: Omit<
      NotificationProps,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'
    >
  ): Notification {
    const now = new Date();
    return new Notification({
      ...props,
      id: crypto.randomUUID(),
      status: NotificationStatus.PENDING,
      retryCount: 0,
      maxRetries: props.maxRetries || 3,
      createdAt: now,
      updatedAt: now,
    });
  }

  protected validate(): void {
    if (!this.props.userId) {
      throw new Error('User ID is required');
    }
    if (!this.props.title) {
      throw new Error('Title is required');
    }
    if (!this.props.message) {
      throw new Error('Message is required');
    }
    if (this.props.channels.length === 0) {
      throw new Error('At least one notification channel is required');
    }
  }
}

export interface NotificationPreferencesProps {
  id: string;
  userId: string;
  workspaceId?: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  webhookEnabled: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  typePreferences: Record<
    NotificationType,
    {
      enabled: boolean;
      channels: NotificationChannel[];
    }
  >;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationPreferences extends BaseEntity<NotificationPreferencesProps> {
  constructor(props: NotificationPreferencesProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get userId(): string {
    return this.props.userId;
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get emailEnabled(): boolean {
    return this.props.emailEnabled;
  }

  get pushEnabled(): boolean {
    return this.props.pushEnabled;
  }

  get inAppEnabled(): boolean {
    return this.props.inAppEnabled;
  }

  get smsEnabled(): boolean {
    return this.props.smsEnabled;
  }

  get webhookEnabled(): boolean {
    return this.props.webhookEnabled;
  }

  get quietHours(): NotificationPreferencesProps['quietHours'] {
    return this.props.quietHours;
  }

  get typePreferences(): NotificationPreferencesProps['typePreferences'] {
    return this.props.typePreferences;
  }

  public isChannelEnabled(channel: NotificationChannel): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.props.emailEnabled;
      case NotificationChannel.PUSH:
        return this.props.pushEnabled;
      case NotificationChannel.IN_APP:
        return this.props.inAppEnabled;
      case NotificationChannel.SMS:
        return this.props.smsEnabled;
      case NotificationChannel.WEBHOOK:
        return this.props.webhookEnabled;
      default:
        return false;
    }
  }

  public isTypeEnabled(type: NotificationType): boolean {
    return this.props.typePreferences[type]?.enabled ?? true;
  }

  public getEnabledChannelsForType(
    type: NotificationType
  ): NotificationChannel[] {
    const typePrefs = this.props.typePreferences[type];
    if (!typePrefs || !typePrefs.enabled) {
      return [];
    }

    return typePrefs.channels.filter(channel => this.isChannelEnabled(channel));
  }

  public isInQuietHours(date: Date = new Date()): boolean {
    if (!this.props.quietHours.enabled) {
      return false;
    }

    // This is a simplified implementation
    // In a real application, you'd need proper timezone handling
    const timeString = date.toTimeString().substring(0, 5);
    return (
      timeString >= this.props.quietHours.startTime &&
      timeString <= this.props.quietHours.endTime
    );
  }

  public updateChannelPreference(
    channel: NotificationChannel,
    enabled: boolean
  ): void {
    switch (channel) {
      case NotificationChannel.EMAIL:
        this.props.emailEnabled = enabled;
        break;
      case NotificationChannel.PUSH:
        this.props.pushEnabled = enabled;
        break;
      case NotificationChannel.IN_APP:
        this.props.inAppEnabled = enabled;
        break;
      case NotificationChannel.SMS:
        this.props.smsEnabled = enabled;
        break;
      case NotificationChannel.WEBHOOK:
        this.props.webhookEnabled = enabled;
        break;
    }
    this.props.updatedAt = new Date();
  }

  public updateTypePreference(
    type: NotificationType,
    enabled: boolean,
    channels?: NotificationChannel[]
  ): void {
    if (!this.props.typePreferences[type]) {
      this.props.typePreferences[type] = {
        enabled,
        channels: channels || Object.values(NotificationChannel),
      };
    } else {
      this.props.typePreferences[type].enabled = enabled;
      if (channels) {
        this.props.typePreferences[type].channels = channels;
      }
    }
    this.props.updatedAt = new Date();
  }

  public static create(
    props: Omit<NotificationPreferencesProps, 'id' | 'createdAt' | 'updatedAt'>
  ): NotificationPreferences {
    const now = new Date();
    return new NotificationPreferences({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  protected validate(): void {
    if (!this.props.userId) {
      throw new Error('User ID is required');
    }
  }
}
