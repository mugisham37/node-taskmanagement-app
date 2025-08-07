import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { notifications, Notification, NewNotification } from '../schema/notifications';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class NotificationRepository extends BaseRepository<Notification, NewNotification> {
  protected table = notifications;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 120, keyPrefix: 'notification' }, // Enable caching for notifications
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Notification-specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Notification>> {
    try {
      return await this.findMany({
        where: eq(notifications.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findUnreadByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Notification>> {
    try {
      return await this.findMany({
        where: and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findUnreadByUser');
    }
  }

  async findReadByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Notification>> {
    try {
      return await this.findMany({
        where: and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, true)
        ),
        ...options,
        sortBy: 'readAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findReadByUser');
    }
  }

  async findByType(type: string, options: PaginationOptions = {}): Promise<PaginatedResult<Notification>> {
    try {
      return await this.findMany({
        where: eq(notifications.type, type),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByType');
    }
  }

  async markAsRead(notificationId: string): Promise<Notification | null> {
    try {
      return await this.update(notificationId, {
        isRead: true,
        readAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'markAsRead');
    }
  }

  async markAsUnread(notificationId: string): Promise<Notification | null> {
    try {
      return await this.update(notificationId, {
        isRead: false,
        readAt: null
      } as any);
    } catch (error) {
      throw this.handleError(error, 'markAsUnread');
    }
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const unreadNotifications = await this.findUnreadByUser(userId, { limit: 1000 });
      const notificationIds = unreadNotifications.data.map(notification => notification.id);
      
      if (notificationIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.updateMany(notificationIds, {
        isRead: true,
        readAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'markAllAsRead');
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.count({
        where: and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      });
    } catch (error) {
      throw this.handleError(error, 'getUnreadCount');
    }
  }

  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    byType: Record<string, number>;
  }> {
    try {
      const [total, unread, read] = await Promise.all([
        this.count({ where: eq(notifications.userId, userId) }),
        this.count({ 
          where: and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        }),
        this.count({ 
          where: and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, true)
          )
        })
      ]);

      // For byType stats, we'd need to group by type
      const byType: Record<string, number> = {}; // Placeholder

      return {
        total,
        unread,
        read,
        byType
      };
    } catch (error) {
      throw this.handleError(error, 'getNotificationStats');
    }
  }

  async deleteOldNotifications(days: number = 30): Promise<{ success: boolean; count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      // For now, we'll just return a placeholder
      return { success: true, count: 0 };
    } catch (error) {
      throw this.handleError(error, 'deleteOldNotifications');
    }
  }

  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userNotifications = await this.findByUser(userId, { limit: 1000 });
      const notificationIds = userNotifications.data.map(notification => notification.id);
      
      if (notificationIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(notificationIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  async deleteReadNotifications(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const readNotifications = await this.findReadByUser(userId, { limit: 1000 });
      const notificationIds = readNotifications.data.map(notification => notification.id);
      
      if (notificationIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(notificationIds);
    } catch (error) {
      throw this.handleError(error, 'deleteReadNotifications');
    }
  }

  async findRecentNotifications(userId: string, hours: number = 24, options: PaginationOptions = {}): Promise<PaginatedResult<Notification>> {
    try {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - hours);

      // Note: You'd need to implement proper date comparison here with Drizzle
      return await this.findByUser(userId, {
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentNotifications');
    }
  }

  // Override create to add validation
  async create(data: NewNotification): Promise<Notification> {
    try {
      // Add any notification-specific validation here
      if (!data.title || data.title.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Notification title cannot be empty');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }

  // Batch create notifications for multiple users
  async createForUsers(userIds: string[], notificationData: Omit<NewNotification, 'userId'>): Promise<Notification[]> {
    try {
      const notifications = userIds.map(userId => ({
        ...notificationData,
        userId
      }));

      return await this.createMany(notifications);
    } catch (error) {
      throw this.handleError(error, 'createForUsers');
    }
  }
}

// Export singleton instance
export const notificationRepository = new NotificationRepository();
