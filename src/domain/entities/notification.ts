import { BaseEntity } from './base-entity';
import {
  NotificationId,
  UserId,
  WorkspaceId,
  ProjectId,
  TaskId,
} from '../value-objects';
import { ValidationError } from '../../shared/errors';

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

export class Notification extends BaseEntity<NotificationId> {
  private _userId: UserId;
  private _workspaceId?: WorkspaceId;
  private _projectId?: ProjectId;
  private _taskId?: TaskId;
  private _type: NotificationType;
  private _title: string;
  private _message: string;
  private _data?: Record<string, any>;
  private _channels: NotificationChannel[];
  private _status: NotificationStatus;
  private _readAt?: Date;
  private _sentAt?: Date;
  private _deliveredAt?: Date;
  private _failureReason?: string;
  private _retryCount: number;
  private _maxRetries: number;
  private _scheduledFor?: Date;
  private _expiresAt?: Date;

  constructor(
    id: NotificationId,
    userId: UserId,
    type: NotificationType,
    title: string,
    message: string,
    channels: NotificationChannel[],
    workspaceId?: WorkspaceId,
    projectId?: ProjectId,
    taskId?: TaskId,
    data?: Record<string, any>,
    status: NotificationStatus = NotificationStatus.PENDING,
    maxRetries: number = 3,
    scheduledFor?: Date,
    expiresAt?: Date,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._userId = userId;
    this._workspaceId = workspaceId;
    this._projectId = projectId;
    this._taskId = taskId;
    this._type = type;
    this._title = title;
    this._message = message;
    this._data = data;
    this._channels = channels;
    this._status = status;
    this._retryCount = 0;
    this._maxRetries = maxRetries;
    this._scheduledFor = scheduledFor;
    this._expiresAt = expiresAt;
    this.validate();
  }

  get userId(): UserId {
    return this._userId;
  }

  get workspaceId(): WorkspaceId | undefined {
    return this._workspaceId;
  }

  get projectId(): ProjectId | undefined {
    return this._projectId;
  }

  get taskId(): TaskId | undefined {
    return this._taskId;
  }

  get type(): NotificationType {
    return this._type;
  }

  get title(): string {
    return this._title;
  }

  get message(): string {
    return this._message;
  }

  get data(): Record<string, any> | undefined {
    return this._data;
  }

  get channels(): NotificationChannel[] {
    return [...this._channels];
  }

  get status(): NotificationStatus {
    return this._status;
  }

  get readAt(): Date | undefined {
    return this._readAt;
  }

  get sentAt(): Date | undefined {
    return this._sentAt;
  }

  get deliveredAt(): Date | undefined {
    return this._deliveredAt;
  }

  get failureReason(): string | undefined {
    return this._failureReason;
  }

  get retryCount(): number {
    return this._retryCount;
  }

  get maxRetries(): number {
    return this._maxRetries;
  }

  get scheduledFor(): Date | undefined {
    return this._scheduledFor;
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  // Business methods
  public markAsRead(): void {
    if (this._status === NotificationStatus.READ) {
      return;
    }

    this._status = NotificationStatus.READ;
    this._readAt = new Date();
    this.markAsUpdated();
  }

  public markAsSent(): void {
    this._status = NotificationStatus.SENT;
    this._sentAt = new Date();
    this.markAsUpdated();
  }

  public markAsDelivered(): void {
    this._status = NotificationStatus.DELIVERED;
    this._deliveredAt = new Date();
    this.markAsUpdated();
  }

  public markAsFailed(reason: string): void {
    this._status = NotificationStatus.FAILED;
    this._failureReason = reason;
    this.markAsUpdated();
  }

  public incrementRetryCount(): void {
    this._retryCount++;
    this.markAsUpdated();
  }

  public canRetry(): boolean {
    return (
      this._retryCount < this._maxRetries &&
      this._status === NotificationStatus.FAILED
    );
  }

  public isExpired(): boolean {
    if (!this._expiresAt) return false;
    return new Date() > this._expiresAt;
  }

  public isScheduled(): boolean {
    if (!this._scheduledFor) return false;
    return new Date() < this._scheduledFor;
  }

  public isReadyToSend(): boolean {
    if (this.isExpired()) return false;
    if (this._status !== NotificationStatus.PENDING) return false;
    if (this.isScheduled()) return false;
    return true;
  }

  public isRead(): boolean {
    return this._status === NotificationStatus.READ;
  }

  public hasChannel(channel: NotificationChannel): boolean {
    return this._channels.includes(channel);
  }

  public addChannel(channel: NotificationChannel): void {
    if (!this.hasChannel(channel)) {
      this._channels.push(channel);
      this.markAsUpdated();
    }
  }

  public removeChannel(channel: NotificationChannel): void {
    const index = this._channels.indexOf(channel);
    if (index > -1) {
      this._channels.splice(index, 1);
      this.markAsUpdated();
    }
  }

  public updateData(data: Record<string, any>): void {
    this._data = { ...this._data, ...data };
    this.markAsUpdated();
  }

  public static create(
    id: NotificationId,
    userId: UserId,
    type: NotificationType,
    title: string,
    message: string,
    channels: NotificationChannel[],
    workspaceId?: WorkspaceId,
    projectId?: ProjectId,
    taskId?: TaskId,
    data?: Record<string, any>
  ): Notification {
    return new Notification(
      id,
      userId,
      type,
      title,
      message,
      channels,
      workspaceId,
      projectId,
      taskId,
      data
    );
  }

  protected validate(): void {
    if (!this._title || this._title.trim().length === 0) {
      throw ValidationError.forField('title', 'Title is required');
    }
    if (!this._message || this._message.trim().length === 0) {
      throw ValidationError.forField('message', 'Message is required');
    }
    if (this._channels.length === 0) {
      throw ValidationError.forField(
        'channels',
        'At least one notification channel is required'
      );
    }
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];

    try {
      this.validate();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      }
    }

    return errors;
  }
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface TypePreference {
  enabled: boolean;
  channels: NotificationChannel[];
}

export class NotificationPreferences extends BaseEntity<NotificationId> {
  private _userId: UserId;
  private _workspaceId?: WorkspaceId;
  private _emailEnabled: boolean;
  private _pushEnabled: boolean;
  private _inAppEnabled: boolean;
  private _smsEnabled: boolean;
  private _webhookEnabled: boolean;
  private _quietHours: QuietHours;
  private _typePreferences: Record<NotificationType, TypePreference>;

  constructor(
    id: NotificationId,
    userId: UserId,
    emailEnabled: boolean = true,
    pushEnabled: boolean = true,
    inAppEnabled: boolean = true,
    smsEnabled: boolean = false,
    webhookEnabled: boolean = false,
    quietHours: QuietHours = {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
    },
    typePreferences: Record<NotificationType, TypePreference> = {},
    workspaceId?: WorkspaceId,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._userId = userId;
    this._workspaceId = workspaceId;
    this._emailEnabled = emailEnabled;
    this._pushEnabled = pushEnabled;
    this._inAppEnabled = inAppEnabled;
    this._smsEnabled = smsEnabled;
    this._webhookEnabled = webhookEnabled;
    this._quietHours = quietHours;
    this._typePreferences = typePreferences;
    this.validate();
  }

  get userId(): UserId {
    return this._userId;
  }

  get workspaceId(): WorkspaceId | undefined {
    return this._workspaceId;
  }

  get emailEnabled(): boolean {
    return this._emailEnabled;
  }

  get pushEnabled(): boolean {
    return this._pushEnabled;
  }

  get inAppEnabled(): boolean {
    return this._inAppEnabled;
  }

  get smsEnabled(): boolean {
    return this._smsEnabled;
  }

  get webhookEnabled(): boolean {
    return this._webhookEnabled;
  }

  get quietHours(): QuietHours {
    return { ...this._quietHours };
  }

  get typePreferences(): Record<NotificationType, TypePreference> {
    return { ...this._typePreferences };
  }

  public isChannelEnabled(channel: NotificationChannel): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this._emailEnabled;
      case NotificationChannel.PUSH:
        return this._pushEnabled;
      case NotificationChannel.IN_APP:
        return this._inAppEnabled;
      case NotificationChannel.SMS:
        return this._smsEnabled;
      case NotificationChannel.WEBHOOK:
        return this._webhookEnabled;
      default:
        return false;
    }
  }

  public isTypeEnabled(type: NotificationType): boolean {
    return this._typePreferences[type]?.enabled ?? true;
  }

  public getEnabledChannelsForType(
    type: NotificationType
  ): NotificationChannel[] {
    const typePrefs = this._typePreferences[type];
    if (!typePrefs || !typePrefs.enabled) {
      return [];
    }

    return typePrefs.channels.filter(channel => this.isChannelEnabled(channel));
  }

  public isInQuietHours(date: Date = new Date()): boolean {
    if (!this._quietHours.enabled) {
      return false;
    }

    // This is a simplified implementation
    // In a real application, you'd need proper timezone handling
    const timeString = date.toTimeString().substring(0, 5);
    return (
      timeString >= this._quietHours.startTime &&
      timeString <= this._quietHours.endTime
    );
  }

  public updateChannelPreference(
    channel: NotificationChannel,
    enabled: boolean
  ): void {
    switch (channel) {
      case NotificationChannel.EMAIL:
        this._emailEnabled = enabled;
        break;
      case NotificationChannel.PUSH:
        this._pushEnabled = enabled;
        break;
      case NotificationChannel.IN_APP:
        this._inAppEnabled = enabled;
        break;
      case NotificationChannel.SMS:
        this._smsEnabled = enabled;
        break;
      case NotificationChannel.WEBHOOK:
        this._webhookEnabled = enabled;
        break;
    }
    this.markAsUpdated();
  }

  public updateTypePreference(
    type: NotificationType,
    enabled: boolean,
    channels?: NotificationChannel[]
  ): void {
    if (!this._typePreferences[type]) {
      this._typePreferences[type] = {
        enabled,
        channels: channels || Object.values(NotificationChannel),
      };
    } else {
      this._typePreferences[type].enabled = enabled;
      if (channels) {
        this._typePreferences[type].channels = channels;
      }
    }
    this.markAsUpdated();
  }

  public static create(
    id: NotificationId,
    userId: UserId,
    workspaceId?: WorkspaceId
  ): NotificationPreferences {
    return new NotificationPreferences(
      id,
      userId,
      true,
      true,
      true,
      false,
      false,
      undefined,
      {},
      workspaceId
    );
  }

  protected validate(): void {
    // No specific validation needed for preferences
  }

  getValidationErrors(): string[] {
    return [];
  }
}
