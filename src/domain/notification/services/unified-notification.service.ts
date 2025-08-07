import { NotificationEntity } from '../entities/notification.entity';
import { NotificationPreferencesEntity } from '../entities/notification-preferences.entity';
import { NotificationId } from '../value-objects/notification-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationPriority } from '../value-objects/notification-priority';
import { DomainService } from '../../shared/base/domain-service';
import { DeliveryResult } from './notification-delivery.service';

export interface CreateNotificationRequest {
  userId: UserId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  actionUrl?: string;
  expiresAt?: Date;
  scheduledFor?: Date;
  templateVariables?: Record<string, any>;
}

export interface BulkNotificationRequest {
  userIds: UserId[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  actionUrl?: string;
  expiresAt?: Date;
  scheduledFor?: Date;
  templateVariables?: Record<string, any>;
}

export interface NotificationFilters {
  userId?: UserId;
  type?: NotificationType;
  types?: NotificationType[];
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  isRead?: boolean;
  priority?: NotificationPriority;
  createdAfter?: Date;
  createdBefore?: Date;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
}

export interface NotificationQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'scheduledFor';
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  byPriority: Record<string, number>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

export interface DeliveryStats {
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
  byPriority: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      rate: number;
    }
  >;
}

export interface UnifiedNotificationService extends DomainService {
  // Core notification operations
  createNotification(
    request: CreateNotificationRequest
  ): Promise<NotificationEntity>;

  createBulkNotifications(
    request: BulkNotificationRequest
  ): Promise<NotificationEntity[]>;

  sendNotification(notificationId: NotificationId): Promise<DeliveryResult[]>;

  sendNotificationImmediately(request: CreateNotificationRequest): Promise<{
    notification: NotificationEntity;
    deliveryResults: DeliveryResult[];
  }>;

  // Notification management
  getNotification(
    notificationId: NotificationId
  ): Promise<NotificationEntity | null>;

  getUserNotifications(
    userId: UserId,
    filters?: Omit<NotificationFilters, 'userId'>,
    options?: NotificationQueryOptions
  ): Promise<{
    notifications: NotificationEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  markAsRead(notificationId: NotificationId): Promise<NotificationEntity>;
  markAllAsRead(userId: UserId): Promise<number>;
  deleteNotification(notificationId: NotificationId): Promise<void>;
  deleteUserNotifications(userId: UserId, olderThan?: Date): Promise<number>;

  // Scheduled notifications
  scheduleNotification(
    request: CreateNotificationRequest
  ): Promise<NotificationEntity>;
  cancelScheduledNotification(notificationId: NotificationId): Promise<void>;
  rescheduleNotification(
    notificationId: NotificationId,
    newScheduleTime: Date
  ): Promise<NotificationEntity>;
  processScheduledNotifications(): Promise<number>;

  // Preferences management
  getUserPreferences(userId: UserId): Promise<NotificationPreferencesEntity>;
  updateUserPreferences(
    userId: UserId,
    updates: {
      globalEnabled?: boolean;
      defaultChannels?: NotificationChannel[];
      timezone?: string;
      language?: string;
      digestEnabled?: boolean;
      digestFrequency?: 'daily' | 'weekly';
      digestTime?: string;
    }
  ): Promise<NotificationPreferencesEntity>;

  setTypePreference(
    userId: UserId,
    type: NotificationType,
    enabled: boolean,
    channels?: NotificationChannel[],
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  ): Promise<void>;

  setChannelPreference(
    userId: UserId,
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
    frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly',
    quietHours?: { start: string; end: string }
  ): Promise<void>;

  // Batch processing
  processNotificationQueue(batchSize?: number): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: Array<{ notificationId: string; error: string }>;
  }>;

  retryFailedNotifications(maxRetries?: number): Promise<{
    retried: number;
    successful: number;
    failed: number;
  }>;

  cleanupExpiredNotifications(): Promise<number>;
  cleanupOldNotifications(olderThan: Date): Promise<number>;

  // Analytics and reporting
  getNotificationStats(
    userId?: UserId,
    dateRange?: { from: Date; to: Date }
  ): Promise<NotificationStats>;

  getDeliveryStats(dateRange?: {
    from: Date;
    to: Date;
  }): Promise<DeliveryStats>;

  getUserEngagementStats(
    userId: UserId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalReceived: number;
    totalRead: number;
    readRate: number;
    avgTimeToRead: number; // in minutes
    preferredChannels: NotificationChannel[];
    mostEngagedTypes: NotificationType[];
  }>;

  getSystemHealthStats(): Promise<{
    queueSize: number;
    processingRate: number;
    errorRate: number;
    avgDeliveryTime: number;
    channelHealth: Record<string, boolean>;
  }>;

  // Digest notifications
  generateDigestForUser(
    userId: UserId,
    frequency: 'daily' | 'weekly'
  ): Promise<{
    hasContent: boolean;
    notification?: NotificationEntity;
    summary: {
      totalNotifications: number;
      unreadCount: number;
      topTypes: Array<{ type: NotificationType; count: number }>;
      urgentCount: number;
    };
  }>;

  sendDigestNotifications(frequency: 'daily' | 'weekly'): Promise<{
    sent: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  }>;

  // Real-time features
  subscribeToUserNotifications(
    userId: UserId,
    callback: (notification: NotificationEntity) => void
  ): Promise<string>; // Returns subscription ID

  unsubscribeFromUserNotifications(subscriptionId: string): Promise<void>;

  broadcastNotification(
    userIds: UserId[],
    notification: NotificationEntity
  ): Promise<void>;

  // Template integration
  createNotificationFromTemplate(
    userId: UserId,
    type: NotificationType,
    templateVariables: Record<string, any>,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
      scheduledFor?: Date;
      expiresAt?: Date;
    }
  ): Promise<NotificationEntity>;

  // Webhook integration
  triggerWebhookNotification(
    webhookUrl: string,
    notification: NotificationEntity,
    retryCount?: number
  ): Promise<DeliveryResult>;

  // System notifications
  createSystemNotification(
    title: string,
    message: string,
    targetUsers?: UserId[],
    priority?: NotificationPriority
  ): Promise<NotificationEntity[]>;

  createMaintenanceNotification(
    title: string,
    message: string,
    scheduledFor: Date,
    affectedUsers?: UserId[]
  ): Promise<NotificationEntity[]>;
}
