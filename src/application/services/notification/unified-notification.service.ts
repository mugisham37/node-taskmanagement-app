import { Injectable } from '../../../shared/decorators/injectable';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationPreferencesEntity } from '../entities/notification-preferences.entity';
import { NotificationId } from '../value-objects/notification-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationPriority } from '../value-objects/notification-priority';
import { NotificationStatus } from '../value-objects/notification-status';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferencesRepository } from '../repositories/notification-preferences.repository';
import { NotificationTemplateService } from './notification-template.service';
import {
  NotificationDeliveryService,
  DeliveryResult,
} from '../../domain/notification/services/notification-delivery.service';
import {
  UnifiedNotificationService,
  CreateNotificationRequest,
  BulkNotificationRequest,
  NotificationFilters,
  NotificationQueryOptions,
  NotificationStats,
  DeliveryStats,
} from '../../domain/notification/services/unified-notification.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { Logger } from '../../infrastructure/logging/logger';

@Injectable()
export class UnifiedNotificationServiceImpl
  implements UnifiedNotificationService
{
  public readonly name = 'UnifiedNotificationService';

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly preferencesRepository: NotificationPreferencesRepository,
    private readonly templateService: NotificationTemplateService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly eventBus: DomainEventBus,
    private readonly logger: Logger
  ) {}

  async createNotification(
    request: CreateNotificationRequest
  ): Promise<NotificationEntity> {
    this.logger.info('Creating notification', {
      userId: request.userId.value,
      type: request.type.value,
    });

    // Get user preferences to determine channels if not specified
    const preferences = await this.getUserPreferences(request.userId);
    const channels =
      request.channels || preferences.getEnabledChannels(request.type);

    // Create notification entity
    const notification = NotificationEntity.create(
      request.userId,
      request.type,
      request.title,
      request.message,
      request.data || {},
      channels,
      request.priority || NotificationPriority.NORMAL,
      {
        actionUrl: request.actionUrl,
        expiresAt: request.expiresAt,
        scheduledFor: request.scheduledFor,
      }
    );

    // Save notification
    await this.notificationRepository.save(notification);

    // Publish domain events
    await this.publishDomainEvents(notification);

    this.logger.info('Notification created successfully', {
      notificationId: notification.id.value,
    });

    return notification;
  }

  async createBulkNotifications(
    request: BulkNotificationRequest
  ): Promise<NotificationEntity[]> {
    this.logger.info('Creating bulk notifications', {
      userCount: request.userIds.length,
      type: request.type.value,
    });

    const notifications: NotificationEntity[] = [];

    for (const userId of request.userIds) {
      try {
        const notification = await this.createNotification({
          ...request,
          userId,
        });
        notifications.push(notification);
      } catch (error) {
        this.logger.error('Failed to create notification for user', {
          userId: userId.value,
          error: error.message,
        });
      }
    }

    this.logger.info('Bulk notifications created', {
      total: notifications.length,
      requested: request.userIds.length,
    });

    return notifications;
  }

  async sendNotification(
    notificationId: NotificationId
  ): Promise<DeliveryResult[]> {
    this.logger.info('Sending notification', {
      notificationId: notificationId.value,
    });

    const notification =
      await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId.value}`);
    }

    if (!notification.isReadyForDelivery()) {
      throw new Error(
        `Notification is not ready for delivery: ${notificationId.value}`
      );
    }

    // Get user preferences to check if notifications are enabled
    const preferences = await this.getUserPreferences(notification.userId);
    if (!preferences.globalEnabled) {
      this.logger.info('Notifications disabled for user', {
        userId: notification.userId.value,
      });
      return [];
    }

    const deliveryResults: DeliveryResult[] = [];

    // Process each channel
    for (const channel of notification.channels) {
      try {
        // Check if channel is enabled for this notification type
        if (!preferences.isNotificationEnabled(notification.type, channel)) {
          this.logger.debug('Channel disabled for notification type', {
            channel: channel.value,
            type: notification.type.value,
          });
          continue;
        }

        // Check quiet hours
        if (
          preferences.isInQuietHours(notification.type, channel, new Date()) &&
          !notification.priority.shouldBypassQuietHours()
        ) {
          this.logger.debug('Notification in quiet hours', {
            channel: channel.value,
            priority: notification.priority.value,
          });
          continue;
        }

        // Render template if needed
        const content = await this.renderNotificationContent(
          notification,
          channel
        );

        // Deliver notification
        const result = await this.deliveryService.deliverToChannel(
          notification,
          channel,
          content
        );

        deliveryResults.push(result);

        // Update notification with delivery result
        if (result.success) {
          notification.markAsDelivered(channel, result);
        } else {
          notification.markAsDeliveryFailed(channel, result.error);
        }
      } catch (error) {
        this.logger.error('Failed to deliver notification to channel', {
          notificationId: notificationId.value,
          channel: channel.value,
          error: error.message,
        });

        notification.markAsDeliveryFailed(channel, error);
        deliveryResults.push({
          success: false,
          channel,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }

    // Update notification in repository
    await this.notificationRepository.update(notification);

    // Publish domain events
    await this.publishDomainEvents(notification);

    this.logger.info('Notification delivery completed', {
      notificationId: notificationId.value,
      successful: deliveryResults.filter(r => r.success).length,
      failed: deliveryResults.filter(r => !r.success).length,
    });

    return deliveryResults;
  }

  async sendNotificationImmediately(
    request: CreateNotificationRequest
  ): Promise<{
    notification: NotificationEntity;
    deliveryResults: DeliveryResult[];
  }> {
    const notification = await this.createNotification(request);
    const deliveryResults = await this.sendNotification(notification.id);

    return { notification, deliveryResults };
  }

  async getNotification(
    notificationId: NotificationId
  ): Promise<NotificationEntity | null> {
    return this.notificationRepository.findById(notificationId);
  }

  async getUserNotifications(
    userId: UserId,
    filters?: Omit<NotificationFilters, 'userId'>,
    options?: NotificationQueryOptions
  ): Promise<{
    notifications: NotificationEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    return this.notificationRepository.findByUserId(userId, filters, {
      page,
      limit,
      sort: {
        field: options?.sortBy || 'createdAt',
        direction: options?.sortOrder || 'desc',
      },
    });
  }

  async markAsRead(
    notificationId: NotificationId
  ): Promise<NotificationEntity> {
    const notification =
      await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId.value}`);
    }

    notification.markAsRead();
    await this.notificationRepository.update(notification);
    await this.publishDomainEvents(notification);

    return notification;
  }

  async markAllAsRead(userId: UserId): Promise<number> {
    return this.notificationRepository.markAllAsReadForUser(userId);
  }

  async deleteNotification(notificationId: NotificationId): Promise<void> {
    await this.notificationRepository.delete(notificationId);
  }

  async deleteUserNotifications(
    userId: UserId,
    olderThan?: Date
  ): Promise<number> {
    // Implementation would filter by user and date, then delete
    // For now, return 0 as placeholder
    return 0;
  }

  async scheduleNotification(
    request: CreateNotificationRequest
  ): Promise<NotificationEntity> {
    if (!request.scheduledFor) {
      throw new Error('scheduledFor is required for scheduled notifications');
    }

    return this.createNotification(request);
  }

  async cancelScheduledNotification(
    notificationId: NotificationId
  ): Promise<void> {
    const notification =
      await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId.value}`);
    }

    if (!notification.isScheduled()) {
      throw new Error(`Notification is not scheduled: ${notificationId.value}`);
    }

    // Update status to cancelled
    // This would require adding a cancel method to the entity
    await this.notificationRepository.update(notification);
  }

  async rescheduleNotification(
    notificationId: NotificationId,
    newScheduleTime: Date
  ): Promise<NotificationEntity> {
    const notification =
      await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId.value}`);
    }

    // Update scheduled time - would need to add method to entity
    await this.notificationRepository.update(notification);

    return notification;
  }

  async processScheduledNotifications(): Promise<number> {
    const scheduledNotifications =
      await this.notificationRepository.findScheduledNotifications(
        new Date(),
        100 // Process up to 100 at a time
      );

    let processed = 0;
    for (const notification of scheduledNotifications) {
      try {
        await this.sendNotification(notification.id);
        processed++;
      } catch (error) {
        this.logger.error('Failed to process scheduled notification', {
          notificationId: notification.id.value,
          error: error.message,
        });
      }
    }

    return processed;
  }

  async getUserPreferences(
    userId: UserId
  ): Promise<NotificationPreferencesEntity> {
    let preferences = await this.preferencesRepository.findByUserId(userId);

    if (!preferences) {
      // Create default preferences
      preferences =
        await this.preferencesRepository.createDefaultPreferencesForUser(
          userId
        );
    }

    return preferences;
  }

  async updateUserPreferences(
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
  ): Promise<NotificationPreferencesEntity> {
    const preferences = await this.getUserPreferences(userId);

    if (updates.globalEnabled !== undefined) {
      if (updates.globalEnabled) {
        preferences.enableGlobalNotifications();
      } else {
        preferences.disableGlobalNotifications();
      }
    }

    if (updates.defaultChannels) {
      preferences.setDefaultChannels(updates.defaultChannels);
    }

    if (updates.timezone) {
      preferences.updateTimezone(updates.timezone);
    }

    if (updates.language) {
      preferences.updateLanguage(updates.language);
    }

    if (updates.digestEnabled !== undefined) {
      if (
        updates.digestEnabled &&
        updates.digestFrequency &&
        updates.digestTime
      ) {
        preferences.enableDigest(updates.digestFrequency, updates.digestTime);
      } else {
        preferences.disableDigest();
      }
    }

    await this.preferencesRepository.update(preferences);
    await this.publishDomainEvents(preferences);

    return preferences;
  }

  async setTypePreference(
    userId: UserId,
    type: NotificationType,
    enabled: boolean,
    channels?: NotificationChannel[],
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);

    const channelPreferences =
      channels?.map(channel => ({
        channel,
        enabled: true,
        frequency: 'immediate' as const,
      })) || [];

    preferences.setTypePreference(type, enabled, channelPreferences, priority);

    await this.preferencesRepository.update(preferences);
    await this.publishDomainEvents(preferences);
  }

  async setChannelPreference(
    userId: UserId,
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
    frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly',
    quietHours?: { start: string; end: string }
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);

    preferences.setChannelPreference(
      type,
      channel,
      enabled,
      frequency,
      quietHours
    );

    await this.preferencesRepository.update(preferences);
    await this.publishDomainEvents(preferences);
  }

  // Placeholder implementations for remaining methods
  async processNotificationQueue(batchSize?: number): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: Array<{ notificationId: string; error: string }>;
  }> {
    // Implementation would process queued notifications
    return { processed: 0, successful: 0, failed: 0, errors: [] };
  }

  async retryFailedNotifications(maxRetries?: number): Promise<{
    retried: number;
    successful: number;
    failed: number;
  }> {
    // Implementation would retry failed notifications
    return { retried: 0, successful: 0, failed: 0 };
  }

  async cleanupExpiredNotifications(): Promise<number> {
    return this.notificationRepository.deleteExpiredNotifications(new Date());
  }

  async cleanupOldNotifications(olderThan: Date): Promise<number> {
    return this.notificationRepository.deleteOldNotifications(olderThan);
  }

  async getNotificationStats(
    userId?: UserId,
    dateRange?: { from: Date; to: Date }
  ): Promise<NotificationStats> {
    const stats = await this.notificationRepository.getNotificationStats(
      userId,
      dateRange
    );

    return {
      total: stats.total,
      unread: stats.unread,
      read: stats.read,
      byType: stats.byType,
      byChannel: stats.byChannel,
      byPriority: stats.byPriority,
      recentActivity: [], // Would be calculated from stats
    };
  }

  async getDeliveryStats(dateRange?: {
    from: Date;
    to: Date;
  }): Promise<DeliveryStats> {
    return this.notificationRepository.getDeliveryStats(dateRange);
  }

  async getUserEngagementStats(
    userId: UserId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalReceived: number;
    totalRead: number;
    readRate: number;
    avgTimeToRead: number;
    preferredChannels: NotificationChannel[];
    mostEngagedTypes: NotificationType[];
  }> {
    // Implementation would analyze user engagement patterns
    return {
      totalReceived: 0,
      totalRead: 0,
      readRate: 0,
      avgTimeToRead: 0,
      preferredChannels: [],
      mostEngagedTypes: [],
    };
  }

  async getSystemHealthStats(): Promise<{
    queueSize: number;
    processingRate: number;
    errorRate: number;
    avgDeliveryTime: number;
    channelHealth: Record<string, boolean>;
  }> {
    // Implementation would check system health
    return {
      queueSize: 0,
      processingRate: 0,
      errorRate: 0,
      avgDeliveryTime: 0,
      channelHealth: {},
    };
  }

  // Additional placeholder methods...
  async generateDigestForUser(
    userId: UserId,
    frequency: 'daily' | 'weekly'
  ): Promise<any> {
    return {
      hasContent: false,
      summary: {
        totalNotifications: 0,
        unreadCount: 0,
        topTypes: [],
        urgentCount: 0,
      },
    };
  }

  async sendDigestNotifications(frequency: 'daily' | 'weekly'): Promise<any> {
    return { sent: 0, failed: 0, errors: [] };
  }

  async subscribeToUserNotifications(
    userId: UserId,
    callback: (notification: NotificationEntity) => void
  ): Promise<string> {
    return 'subscription-id';
  }

  async unsubscribeFromUserNotifications(
    subscriptionId: string
  ): Promise<void> {
    // Implementation would remove subscription
  }

  async broadcastNotification(
    userIds: UserId[],
    notification: NotificationEntity
  ): Promise<void> {
    // Implementation would broadcast to multiple users
  }

  async createNotificationFromTemplate(
    userId: UserId,
    type: NotificationType,
    templateVariables: Record<string, any>,
    options?: any
  ): Promise<NotificationEntity> {
    // Implementation would use template service
    throw new Error('Not implemented');
  }

  async triggerWebhookNotification(
    webhookUrl: string,
    notification: NotificationEntity,
    retryCount?: number
  ): Promise<DeliveryResult> {
    // Implementation would trigger webhook
    return {
      success: false,
      channel: NotificationChannel.WEBHOOK,
      error: 'Not implemented',
      timestamp: new Date(),
    };
  }

  async createSystemNotification(
    title: string,
    message: string,
    targetUsers?: UserId[],
    priority?: NotificationPriority
  ): Promise<NotificationEntity[]> {
    // Implementation would create system notifications
    return [];
  }

  async createMaintenanceNotification(
    title: string,
    message: string,
    scheduledFor: Date,
    affectedUsers?: UserId[]
  ): Promise<NotificationEntity[]> {
    // Implementation would create maintenance notifications
    return [];
  }

  // Private helper methods
  private async renderNotificationContent(
    notification: NotificationEntity,
    channel: NotificationChannel
  ): Promise<{ subject: string; body: string }> {
    try {
      return await this.templateService.renderTemplate(
        notification.type,
        channel,
        {
          variables: {
            title: notification.title,
            message: notification.message,
            ...notification.data,
          },
        }
      );
    } catch (error) {
      // Fallback to basic content if template rendering fails
      return {
        subject: notification.title,
        body: notification.message,
      };
    }
  }

  private async publishDomainEvents(
    entity: NotificationEntity | NotificationPreferencesEntity
  ): Promise<void> {
    const events = entity.getDomainEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    entity.clearDomainEvents();
  }
}
