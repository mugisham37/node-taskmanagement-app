import {
  Entity,
  Notification,
  NotificationChannel,
  NotificationId,
  NotificationPreferences,
  NotificationStatus,
  NotificationType,
  ProjectId,
  TaskId,
  UserId,
  WorkspaceId,
} from '@taskmanagement/domain';

/**
 * Adapter to make domain notification entity compatible with repository pattern
 */
export class NotificationEntityAdapter implements Entity<string> {
  public readonly id: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private _notification: Notification;

  constructor(notification: Notification) {
    this._notification = notification;
    this.id = notification.id.value;
    this.createdAt = notification.createdAt;
    this.updatedAt = notification.updatedAt;
  }

  get notification(): Notification {
    return this._notification;
  }

  // Static factory methods
  static fromDomain(notification: Notification): NotificationEntityAdapter {
    return new NotificationEntityAdapter(notification);
  }

  static toDomain(adapter: NotificationEntityAdapter): Notification {
    return adapter._notification;
  }
}

/**
 * Adapter to make domain notification preferences entity compatible with repository pattern
 */
export class NotificationPreferencesEntityAdapter implements Entity<string> {
  public readonly id: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private _preferences: NotificationPreferences;

  constructor(preferences: NotificationPreferences) {
    this._preferences = preferences;
    this.id = preferences.id.value;
    this.createdAt = preferences.createdAt;
    this.updatedAt = preferences.updatedAt;
  }

  get preferences(): NotificationPreferences {
    return this._preferences;
  }

  // Static factory methods
  static fromDomain(preferences: NotificationPreferences): NotificationPreferencesEntityAdapter {
    return new NotificationPreferencesEntityAdapter(preferences);
  }

  static toDomain(adapter: NotificationPreferencesEntityAdapter): NotificationPreferences {
    return adapter._preferences;
  }
}

/**
 * Utility functions for creating domain entities from database models
 */
export class NotificationEntityFactory {
  static createNotification(data: {
    id: string;
    userId: string;
    workspaceId?: string | null;
    projectId?: string | null;
    taskId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    channels: NotificationChannel[];
    status: NotificationStatus;
    readAt?: Date | null;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    failureReason?: string | null;
    retryCount: number;
    maxRetries: number;
    scheduledFor?: Date | null;
    expiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Notification {
    return new Notification(
      NotificationId.create(data.id),
      UserId.create(data.userId),
      data.type,
      data.title,
      data.message,
      data.channels,
      data.workspaceId ? WorkspaceId.create(data.workspaceId) : undefined,
      data.projectId ? ProjectId.create(data.projectId) : undefined,
      data.taskId ? TaskId.create(data.taskId) : undefined,
      data.data,
      data.status,
      data.maxRetries,
      data.scheduledFor || undefined,
      data.expiresAt || undefined,
      data.createdAt,
      data.updatedAt
    );
  }

  static createNotificationPreferences(data: {
    id: string;
    userId: string;
    workspaceId?: string | null;
    emailEnabled: boolean;
    pushEnabled: boolean;
    inAppEnabled: boolean;
    smsEnabled: boolean;
    webhookEnabled: boolean;
    quietHours: any;
    typePreferences: any;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationPreferences {
    return new NotificationPreferences(
      NotificationId.create(data.id),
      UserId.create(data.userId),
      data.emailEnabled,
      data.pushEnabled,
      data.inAppEnabled,
      data.smsEnabled,
      data.webhookEnabled,
      data.quietHours,
      data.typePreferences,
      data.workspaceId ? WorkspaceId.create(data.workspaceId) : undefined,
      data.createdAt,
      data.updatedAt
    );
  }
}
