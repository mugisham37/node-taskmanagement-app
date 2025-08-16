import {
  Notification,
  NotificationType,
  NotificationChannel,
} from '../entities/notification';
import {
  INotificationRepository,
  INotificationPreferencesRepository,
} from '../repositories/notification-repository';
import { UserId, WorkspaceId, ProjectId, TaskId } from '../value-objects';

export class NotificationDomainService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly preferencesRepository: INotificationPreferencesRepository
  ) {}

  async canSendNotification(
    userId: string,
    type: NotificationType,
    workspaceId?: string
  ): Promise<boolean> {
    const preferences = await this.preferencesRepository.findByUserAndWorkspace(
      userId,
      workspaceId || ''
    );

    if (!preferences) {
      return true; // Default to allowing notifications if no preferences set
    }

    // Check if notification type is enabled
    if (!preferences.isTypeEnabled(type)) {
      return false;
    }

    // Check quiet hours
    if (preferences.isInQuietHours()) {
      return false;
    }

    return true;
  }

  async getEnabledChannelsForNotification(
    userId: string,
    type: NotificationType,
    workspaceId?: string
  ): Promise<NotificationChannel[]> {
    const preferences = await this.preferencesRepository.findByUserAndWorkspace(
      userId,
      workspaceId || ''
    );

    if (!preferences) {
      // Default channels if no preferences set
      return [NotificationChannel.EMAIL, NotificationChannel.IN_APP];
    }

    return preferences.getEnabledChannelsForType(type);
  }

  async createNotificationWithPreferences(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options: {
      workspaceId?: string;
      projectId?: string;
      taskId?: string;
      data?: Record<string, any>;
      scheduledFor?: Date;
      expiresAt?: Date;
    } = {}
  ): Promise<Notification | null> {
    // Check if user can receive this type of notification
    const canSend = await this.canSendNotification(
      userId,
      type,
      options.workspaceId
    );
    if (!canSend) {
      return null;
    }

    // Get enabled channels for this notification type
    const channels = await this.getEnabledChannelsForNotification(
      userId,
      type,
      options.workspaceId
    );

    if (channels.length === 0) {
      return null; // No channels enabled
    }

    // Create notification
    const createOptions: {
      userId: UserId;
      type: string;
      title: string;
      message: string;
      data?: Record<string, any>;
      workspaceId?: WorkspaceId;
      projectId?: ProjectId;
      taskId?: TaskId;
      channels?: NotificationChannel[];
    } = {
      userId: UserId.create(userId),
      type,
      title,
      message,
      channels,
    };

    // Only add optional properties if they have values
    if (options.data !== undefined) {
      createOptions.data = options.data;
    }
    if (options.workspaceId !== undefined) {
      createOptions.workspaceId = WorkspaceId.create(options.workspaceId);
    }
    if (options.projectId !== undefined) {
      createOptions.projectId = ProjectId.create(options.projectId);
    }
    if (options.taskId !== undefined) {
      createOptions.taskId = TaskId.create(options.taskId);
    }

    const notification = Notification.create(createOptions);

    await this.notificationRepository.save(notification);
    return notification;
  }

  async markNotificationsAsReadForEntity(
    userId: string,
    entityType: 'project' | 'task',
    entityId: string
  ): Promise<void> {
    const notifications =
      await this.notificationRepository.findByUserId(userId);

    for (const notification of notifications) {
      if (
        (entityType === 'project' && notification.projectId && notification.projectId.value === entityId) ||
        (entityType === 'task' && notification.taskId && notification.taskId.value === entityId)
      ) {
        if (!notification.isRead()) {
          notification.markAsRead();
          await this.notificationRepository.save(notification);
        }
      }
    }
  }

  async getNotificationSummary(
    userId: string,
    workspaceId?: string
  ): Promise<{
    unreadCount: number;
    totalCount: number;
    byType: Record<NotificationType, number>;
    recentNotifications: Notification[];
  }> {
    const notifications = workspaceId
      ? await this.notificationRepository.findByWorkspaceId(workspaceId)
      : await this.notificationRepository.findByUserId(userId);

    const userNotifications = notifications.filter(n => n.userId.value === userId);
    const unreadNotifications = userNotifications.filter(n => !n.isRead());

    const byType: Record<NotificationType, number> = {} as any;
    for (const notification of userNotifications) {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
    }

    const recentNotifications = userNotifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      unreadCount: unreadNotifications.length,
      totalCount: userNotifications.length,
      byType,
      recentNotifications,
    };
  }

  async cleanupExpiredNotifications(): Promise<number> {
    const expiredNotifications =
      await this.notificationRepository.findExpired();
    let deletedCount = 0;

    for (const notification of expiredNotifications) {
      await this.notificationRepository.delete(notification.id.value);
      deletedCount++;
    }

    return deletedCount;
  }

  async retryFailedNotifications(): Promise<number> {
    const failedNotifications =
      await this.notificationRepository.findFailedRetryable();
    let retriedCount = 0;

    for (const notification of failedNotifications) {
      if (notification.canRetry()) {
        notification.incrementRetryCount();
        await this.notificationRepository.save(notification);
        retriedCount++;
      }
    }

    return retriedCount;
  }
}
