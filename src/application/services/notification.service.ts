import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { notificationRepository, userRepository } from '../db/repositories';
import { Notification, NewNotification } from '../db/schema/notifications';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  TASK_COMPLETED = 'task_completed',
  TASK_COMMENTED = 'task_commented',
  PROJECT_SHARED = 'project_shared',
  TEAM_INVITATION = 'team_invitation',
  CALENDAR_REMINDER = 'calendar_reminder',
  SYSTEM = 'system',
  REMINDER = 'reminder'
}

export interface NotificationFilters {
  userId?: string;
  type?: NotificationType | NotificationType[];
  isRead?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface NotificationCreateData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead?: boolean;
}

export interface NotificationUpdateData {
  isRead?: boolean;
  readAt?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
}

export class NotificationService extends BaseService {
  constructor() {
    super('NotificationService', {
      enableCache: true,
      cacheTimeout: 60, // Short cache for real-time notifications
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createNotification(data: NotificationCreateData, context?: ServiceContext): Promise<Notification> {
    const ctx = this.createContext(context);
    this.logOperation('createNotification', ctx, { 
      userId: data.userId, 
      type: data.type, 
      title: data.title 
    });

    try {
      // Validate input
      this.validateNotificationData(data);

      // Verify user exists
      const user = await userRepository.findById(data.userId);
      if (!user) {
        throw new NotFoundError('User', data.userId);
      }

      // Create notification
      const newNotification: NewNotification = {
        ...data,
        isRead: data.isRead || false,
        data: data.data || {}
      };

      const notification = await notificationRepository.create(newNotification);

      await this.recordMetric('notification.created', 1, { 
        type: notification.type,
        hasData: Object.keys(notification.data as object || {}).length > 0 ? 'true' : 'false'
      });

      return notification;
    } catch (error) {
      this.handleError(error, 'createNotification', ctx);
    }
  }

  async getNotificationById(id: string, context?: ServiceContext): Promise<Notification> {
    const ctx = this.createContext(context);
    this.logOperation('getNotificationById', ctx, { notificationId: id });

    try {
      const notification = await notificationRepository.findById(id);
      if (!notification) {
        throw new NotFoundError('Notification', id);
      }

      // Check access permissions
      await this.verifyNotificationAccess(notification, ctx.userId!);

      return notification;
    } catch (error) {
      this.handleError(error, 'getNotificationById', ctx);
    }
  }

  async getNotifications(
    filters: NotificationFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Notification>> {
    const ctx = this.createContext(context);
    this.logOperation('getNotifications', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions - user can only see their own notifications
      const whereConditions = this.buildNotificationWhereConditions(filters, ctx.userId!);
      
      const result = await notificationRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc' // Most recent first
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getNotifications', ctx);
    }
  }

  async markAsRead(id: string, context?: ServiceContext): Promise<Notification> {
    const ctx = this.createContext(context);
    this.logOperation('markAsRead', ctx, { notificationId: id });

    try {
      const existingNotification = await notificationRepository.findById(id);
      if (!existingNotification) {
        throw new NotFoundError('Notification', id);
      }

      // Check permissions
      await this.verifyNotificationAccess(existingNotification, ctx.userId!);

      // Skip if already read
      if (existingNotification.isRead) {
        return existingNotification;
      }

      const updatedNotification = await notificationRepository.update(id, {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      });

      if (!updatedNotification) {
        throw new NotFoundError('Notification', id);
      }

      await this.recordMetric('notification.marked_read', 1, { 
        type: updatedNotification.type 
      });

      return updatedNotification;
    } catch (error) {
      this.handleError(error, 'markAsRead', ctx);
    }
  }

  async markAllAsRead(userId?: string, context?: ServiceContext): Promise<{ updated: number }> {
    const ctx = this.createContext(context);
    const targetUserId = userId || ctx.userId!;
    this.logOperation('markAllAsRead', ctx, { userId: targetUserId });

    try {
      // Verify user access
      if (targetUserId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('You can only mark your own notifications as read');
      }

      // Get all unread notifications for the user
      const unreadNotifications = await notificationRepository.findMany({
        where: and(
          eq(notificationRepository['table']?.userId, targetUserId),
          eq(notificationRepository['table']?.isRead, false)
        ),
        limit: 10000 // Large limit to get all unread notifications
      });

      let updated = 0;
      const now = new Date();

      // Update each notification
      for (const notification of unreadNotifications.data) {
        const result = await notificationRepository.update(notification.id, {
          isRead: true,
          readAt: now,
          updatedAt: now
        });
        if (result) updated++;
      }

      await this.recordMetric('notification.mark_all_read', 1, { 
        updated: updated.toString(),
        userId: targetUserId 
      });

      return { updated };
    } catch (error) {
      this.handleError(error, 'markAllAsRead', ctx);
    }
  }

  async deleteNotification(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteNotification', ctx, { notificationId: id });

    try {
      const notification = await notificationRepository.findById(id);
      if (!notification) {
        throw new NotFoundError('Notification', id);
      }

      // Check permissions
      await this.verifyNotificationAccess(notification, ctx.userId!);

      const success = await notificationRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Notification', id);
      }

      await this.recordMetric('notification.deleted', 1, { 
        type: notification.type 
      });
    } catch (error) {
      this.handleError(error, 'deleteNotification', ctx);
    }
  }

  // Statistics
  async getNotificationStats(userId?: string, context?: ServiceContext): Promise<NotificationStats> {
    const ctx = this.createContext(context);
    const targetUserId = userId || ctx.userId!;
    this.logOperation('getNotificationStats', ctx, { userId: targetUserId });

    try {
      // Verify user access
      if (targetUserId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('You can only view your own notification stats');
      }

      // Get all notifications for the user
      const allNotifications = await notificationRepository.findMany({
        where: eq(notificationRepository['table']?.userId, targetUserId),
        limit: 10000 // Large limit to get all notifications
      });

      const notifications = allNotifications.data;
      const byType: Record<string, number> = {};

      // Count by type
      notifications.forEach(notification => {
        byType[notification.type] = (byType[notification.type] || 0) + 1;
      });

      const stats: NotificationStats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.isRead).length,
        read: notifications.filter(n => n.isRead).length,
        byType
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getNotificationStats', ctx);
    }
  }

  // Specialized notification creators
  async createTaskDueSoonNotification(
    userId: string, 
    taskId: string, 
    taskTitle: string, 
    dueDate: Date,
    context?: ServiceContext
  ): Promise<Notification> {
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.createNotification({
      userId,
      type: NotificationType.TASK_DUE_SOON,
      title: 'Task Due Soon',
      message: `Your task "${taskTitle}" is due on ${formattedDate}`,
      data: {
        taskId,
        dueDate: dueDate.toISOString(),
      },
    }, context);
  }

  async createTaskOverdueNotification(
    userId: string,
    taskId: string,
    taskTitle: string,
    context?: ServiceContext
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.TASK_OVERDUE,
      title: 'Task Overdue',
      message: `Your task "${taskTitle}" is now overdue`,
      data: {
        taskId,
      },
    }, context);
  }

  async createTaskCompletedNotification(
    userId: string,
    taskId: string,
    taskTitle: string,
    context?: ServiceContext
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.TASK_COMPLETED,
      title: 'Task Completed',
      message: `You've completed the task "${taskTitle}"`,
      data: {
        taskId,
      },
    }, context);
  }

  async createSystemNotification(
    userId: string,
    title: string,
    message: string,
    data: Record<string, any> = {},
    context?: ServiceContext
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.SYSTEM,
      title,
      message,
      data,
    }, context);
  }

  // Private Helper Methods
  private async verifyNotificationAccess(notification: Notification, userId: string): Promise<void> {
    // User can access notification if they are:
    // 1. The recipient
    // 2. Admin (would need to check user role)
    
    if (notification.userId === userId) {
      return;
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this notification');
  }

  private buildNotificationWhereConditions(filters: NotificationFilters, userId: string): any {
    const conditions = [eq(notificationRepository['table']?.userId, userId)];

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        conditions.push(inArray(notificationRepository['table']?.type, filters.type));
      } else {
        conditions.push(eq(notificationRepository['table']?.type, filters.type));
      }
    }

    if (filters.isRead !== undefined) {
      conditions.push(eq(notificationRepository['table']?.isRead, filters.isRead));
    }

    if (filters.createdFrom) {
      conditions.push(gte(notificationRepository['table']?.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(notificationRepository['table']?.createdAt, filters.createdTo));
    }

    return and(...conditions);
  }

  private validateNotificationData(data: NotificationCreateData): void {
    if (!data.userId || data.userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (!data.type || !Object.values(NotificationType).includes(data.type)) {
      throw new ValidationError('Valid notification type is required');
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Notification title is required');
    }

    if (data.title.length > 255) {
      throw new ValidationError('Notification title must be less than 255 characters');
    }

    if (!data.message || data.message.trim().length === 0) {
      throw new ValidationError('Notification message is required');
    }

    if (data.message.length > 1000) {
      throw new ValidationError('Notification message must be less than 1000 characters');
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
