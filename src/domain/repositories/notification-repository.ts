import {
  Notification,
  NotificationPreferences,
  NotificationType,
  NotificationStatus,
  NotificationChannel,
} from '../entities/notification';

export interface INotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findByUserId(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<Notification[]>;
  findByWorkspaceId(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<Notification[]>;
  findByType(
    type: NotificationType,
    limit?: number,
    offset?: number
  ): Promise<Notification[]>;
  findByStatus(
    status: NotificationStatus,
    limit?: number,
    offset?: number
  ): Promise<Notification[]>;
  findUnread(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<Notification[]>;
  findPendingDelivery(): Promise<Notification[]>;
  findScheduledNotifications(): Promise<Notification[]>;
  findExpired(): Promise<Notification[]>;
  findFailedRetryable(): Promise<Notification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  getUnreadCount(userId: string): Promise<number>;
  getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    byStatus: Record<NotificationStatus, number>;
  }>;
  delete(id: string): Promise<void>;
  deleteRead(userId: string, olderThan?: Date): Promise<number>;
  deleteExpired(): Promise<number>;
}

export interface INotificationPreferencesRepository {
  save(preferences: NotificationPreferences): Promise<void>;
  findById(id: string): Promise<NotificationPreferences | null>;
  findByUserId(userId: string): Promise<NotificationPreferences | null>;
  findByUserAndWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<NotificationPreferences | null>;
  getEnabledChannels(
    userId: string,
    type: NotificationType,
    workspaceId?: string
  ): Promise<NotificationChannel[]>;
  isTypeEnabled(
    userId: string,
    type: NotificationType,
    workspaceId?: string
  ): Promise<boolean>;
  isInQuietHours(userId: string, date?: Date): Promise<boolean>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
