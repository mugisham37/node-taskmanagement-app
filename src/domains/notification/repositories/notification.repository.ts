import { NotificationEntity } from '../entities/notification.entity';
import { NotificationId } from '../value-objects/notification-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationStatus } from '../value-objects/notification-status';
import { NotificationPriority } from '../value-objects/notification-priority';

export interface NotificationFilters {
  userId?: UserId;
  type?: NotificationType;
  types?: NotificationType[];
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  status?: NotificationStatus;
  statuses?: NotificationStatus[];
  priority?: NotificationPriority;
  isRead?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
}

export interface NotificationSortOptions {
  field: 'createdAt' | 'updatedAt' | 'scheduledFor' | 'priority';
  direction: 'asc' | 'desc';
}

export interface NotificationPaginationOptions {
  page: number;
  limit: number;
  sort?: NotificationSortOptions;
}

export interface NotificationRepository {
  // Basic CRUD operations
  save(notification: NotificationEntity): Promise<void>;
  findById(id: NotificationId): Promise<NotificationEntity | null>;
  findMany(
    filters: NotificationFilters,
    pagination?: NotificationPaginationOptions
  ): Promise<{
    notifications: NotificationEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  update(notification: NotificationEntity): Promise<void>;
  delete(id: NotificationId): Promise<void>;

  // Specialized queries
  findByUserId(
    userId: UserId,
    filters?: Omit<NotificationFilters, 'userId'>,
    pagination?: NotificationPaginationOptions
  ): Promise<{
    notifications: NotificationEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  findUnreadByUserId(userId: UserId): Promise<NotificationEntity[]>;

  findReadyForDelivery(
    limit?: number,
    priority?: NotificationPriority
  ): Promise<NotificationEntity[]>;

  findScheduledNotifications(
    scheduledBefore: Date,
    limit?: number
  ): Promise<NotificationEntity[]>;

  findExpiredNotifications(limit?: number): Promise<NotificationEntity[]>;

  findFailedNotifications(
    retryAfter: Date,
    limit?: number
  ): Promise<NotificationEntity[]>;

  // Bulk operations
  markAllAsReadForUser(userId: UserId): Promise<number>;
  deleteExpiredNotifications(expiredBefore: Date): Promise<number>;
  deleteOldNotifications(olderThan: Date): Promise<number>;

  // Analytics queries
  getNotificationStats(
    userId?: UserId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    total: number;
    unread: number;
    read: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }>;

  getDeliveryStats(dateRange?: { from: Date; to: Date }): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    byChannel: Record<
      string,
      {
        sent: number;
        delivered: number;
        failed: number;
        rate: number;
      }
    >;
  }>;

  // Performance queries
  countUnreadByUserId(userId: UserId): Promise<number>;
  existsById(id: NotificationId): Promise<boolean>;
}
