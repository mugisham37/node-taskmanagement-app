import {
  INotificationPreferencesRepository,
  INotificationRepository,
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
import { and, asc, count, desc, eq, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { logger } from '../../monitoring/logging-service';
import { db } from '../connection';
import { notificationPreferences, notifications } from '../schema/notifications';

// Drizzle model types
type DrizzleNotification = typeof notifications.$inferSelect;
type DrizzleNotificationPreferences = typeof notificationPreferences.$inferSelect;

/**
 * Notification Repository Implementation
 * Direct implementation without extending BaseDrizzleRepository to avoid type conflicts
 */
export class NotificationRepository implements INotificationRepository {
  private readonly database = db;

  private toDomain(drizzleModel: DrizzleNotification): Notification {
    // Handle existing notifications that might have null values for some audit fields
    const notification = new Notification(
      NotificationId.create(drizzleModel.id),
      UserId.create(drizzleModel.userId),
      drizzleModel.type as NotificationType,
      drizzleModel.title,
      drizzleModel.message,
      (drizzleModel.channels as string[]).map((c) => c as NotificationChannel),
      drizzleModel.workspaceId ? WorkspaceId.create(drizzleModel.workspaceId) : undefined,
      drizzleModel.projectId ? ProjectId.create(drizzleModel.projectId) : undefined,
      drizzleModel.taskId ? TaskId.create(drizzleModel.taskId) : undefined,
      (drizzleModel.data as Record<string, any>) || undefined,
      drizzleModel.status as NotificationStatus,
      drizzleModel.maxRetries,
      drizzleModel.scheduledFor || undefined,
      drizzleModel.expiresAt || undefined,
      drizzleModel.createdAt,
      drizzleModel.updatedAt
    );

    // Set additional fields that are not in constructor but exist in database
    if (drizzleModel.readAt) {
      (notification as any)._readAt = drizzleModel.readAt;
    }
    if (drizzleModel.sentAt) {
      (notification as any)._sentAt = drizzleModel.sentAt;
    }
    if (drizzleModel.deliveredAt) {
      (notification as any)._deliveredAt = drizzleModel.deliveredAt;
    }
    if (drizzleModel.failureReason) {
      (notification as any)._failureReason = drizzleModel.failureReason;
    }
    (notification as any)._retryCount = drizzleModel.retryCount;

    return notification;
  }

  private toDrizzle(entity: Notification): Partial<DrizzleNotification> {
    return {
      id: entity.id.value,
      userId: entity.userId.value,
      workspaceId: entity.workspaceId?.value || null,
      projectId: entity.projectId?.value || null,
      taskId: entity.taskId?.value || null,
      type: entity.type,
      title: entity.title,
      message: entity.message,
      data: entity.data || null,
      channels: entity.channels,
      status: entity.status,
      readAt: entity.readAt || null,
      sentAt: entity.sentAt || null,
      deliveredAt: entity.deliveredAt || null,
      failureReason: entity.failureReason || null,
      retryCount: entity.retryCount,
      maxRetries: entity.maxRetries,
      scheduledFor: entity.scheduledFor || null,
      expiresAt: entity.expiresAt || null,
      updatedAt: new Date(),
    };
  }

  async save(notification: Notification): Promise<void> {
    try {
      const data = this.toDrizzle(notification);
      await this.database
        .insert(notifications)
        .values(data as any)
        .onConflictDoUpdate({
          target: notifications.id,
          set: data,
        });
    } catch (error) {
      logger.error('Error saving notification', error as Error);
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(eq(notifications.id, id))
        .limit(1);

      if (results.length === 0) return null;

      const result = results[0];
      if (!result) return null;

      return this.toDomain(result);
    } catch (error) {
      logger.error('Error finding notification by ID', error as Error);
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by user ID', error as Error);
      throw error;
    }
  }

  async findByWorkspaceId(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(eq(notifications.workspaceId, workspaceId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by workspace ID', error as Error);
      throw error;
    }
  }

  async findByType(
    type: NotificationType,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(eq(notifications.type, type))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by type', error as Error);
      throw error;
    }
  }

  async findByStatus(
    status: NotificationStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(eq(notifications.status, status))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by status', error as Error);
      throw error;
    }
  }

  async findUnread(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            or(
              eq(notifications.status, 'pending'),
              eq(notifications.status, 'sent'),
              eq(notifications.status, 'delivered')
            )
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding unread notifications', error as Error);
      throw error;
    }
  }

  async findPendingDelivery(): Promise<Notification[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'pending'),
            or(isNull(notifications.scheduledFor), lte(notifications.scheduledFor, now)),
            or(isNull(notifications.expiresAt), gte(notifications.expiresAt, now))
          )
        )
        .orderBy(asc(notifications.createdAt));

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding pending delivery notifications', error as Error);
      throw error;
    }
  }

  async findScheduledNotifications(): Promise<Notification[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(notifications)
        .where(and(eq(notifications.status, 'pending'), gte(notifications.scheduledFor, now)))
        .orderBy(asc(notifications.scheduledFor));

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding scheduled notifications', error as Error);
      throw error;
    }
  }

  async findExpired(): Promise<Notification[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(notifications)
        .where(
          and(
            lt(notifications.expiresAt, now),
            or(eq(notifications.status, 'pending'), eq(notifications.status, 'failed'))
          )
        );

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding expired notifications', error as Error);
      throw error;
    }
  }

  async findFailedRetryable(): Promise<Notification[]> {
    try {
      const results = await this.database
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'failed'),
            sql`${notifications.retryCount} < ${notifications.maxRetries}`
          )
        )
        .orderBy(asc(notifications.updatedAt));

      return results.map((result) => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding failed retryable notifications', error as Error);
      throw error;
    }
  }

  async markAsRead(id: string): Promise<void> {
    try {
      await this.database
        .update(notifications)
        .set({
          status: 'read',
          readAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notifications.id, id));
    } catch (error) {
      logger.error('Error marking notification as read', error as Error);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const results = await this.database
        .update(notifications)
        .set({
          status: 'read',
          readAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notifications.userId, userId),
            or(
              eq(notifications.status, 'pending'),
              eq(notifications.status, 'sent'),
              eq(notifications.status, 'delivered')
            )
          )
        )
        .returning({ id: notifications.id });

      return results.length;
    } catch (error) {
      logger.error('Error marking all notifications as read', error as Error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const results = await this.database
        .select({ count: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            or(
              eq(notifications.status, 'pending'),
              eq(notifications.status, 'sent'),
              eq(notifications.status, 'delivered')
            )
          )
        );

      return results[0]?.count || 0;
    } catch (error) {
      logger.error('Error getting unread count', error as Error);
      throw error;
    }
  }

  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    byStatus: Record<NotificationStatus, number>;
  }> {
    try {
      const [totalResult, unreadResult, byTypeResult, byStatusResult] = await Promise.all([
        this.database
          .select({ count: count() })
          .from(notifications)
          .where(eq(notifications.userId, userId)),

        this.database
          .select({ count: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              or(
                eq(notifications.status, 'pending'),
                eq(notifications.status, 'sent'),
                eq(notifications.status, 'delivered')
              )
            )
          ),

        this.database
          .select({
            type: notifications.type,
            count: count(),
          })
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .groupBy(notifications.type),

        this.database
          .select({
            status: notifications.status,
            count: count(),
          })
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .groupBy(notifications.status),
      ]);

      const byType = {} as Record<NotificationType, number>;
      byTypeResult.forEach((row) => {
        byType[row.type as NotificationType] = row.count;
      });

      const byStatus = {} as Record<NotificationStatus, number>;
      byStatusResult.forEach((row) => {
        byStatus[row.status as NotificationStatus] = row.count;
      });

      return {
        total: totalResult[0]?.count || 0,
        unread: unreadResult[0]?.count || 0,
        byType,
        byStatus,
      };
    } catch (error) {
      logger.error('Error getting notification stats', error as Error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.delete(notifications).where(eq(notifications.id, id));
    } catch (error) {
      logger.error('Error deleting notification', error as Error);
      throw error;
    }
  }

  async deleteRead(userId: string, olderThan?: Date): Promise<number> {
    try {
      let whereClause = and(eq(notifications.userId, userId), eq(notifications.status, 'read'));

      if (olderThan) {
        whereClause = and(whereClause, lt(notifications.readAt, olderThan));
      }

      const results = await this.database
        .delete(notifications)
        .where(whereClause)
        .returning({ id: notifications.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting read notifications', error as Error);
      throw error;
    }
  }

  async deleteExpired(): Promise<number> {
    try {
      const now = new Date();
      const results = await this.database
        .delete(notifications)
        .where(lt(notifications.expiresAt, now))
        .returning({ id: notifications.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting expired notifications', error as Error);
      throw error;
    }
  }
}

/**
 * Notification Preferences Repository Implementation
 * Direct implementation without extending BaseDrizzleRepository to avoid type conflicts
 */
export class NotificationPreferencesRepository implements INotificationPreferencesRepository {
  private readonly database = db;

  private toDomain(drizzleModel: DrizzleNotificationPreferences): NotificationPreferences {
    return new NotificationPreferences(
      NotificationId.create(drizzleModel.id),
      UserId.create(drizzleModel.userId),
      drizzleModel.emailEnabled,
      drizzleModel.pushEnabled,
      drizzleModel.inAppEnabled,
      drizzleModel.smsEnabled,
      drizzleModel.webhookEnabled,
      drizzleModel.quietHours as any,
      drizzleModel.typePreferences as any,
      drizzleModel.workspaceId ? WorkspaceId.create(drizzleModel.workspaceId) : undefined,
      drizzleModel.createdAt,
      drizzleModel.updatedAt
    );
  }

  private toDrizzle(entity: NotificationPreferences): Partial<DrizzleNotificationPreferences> {
    return {
      id: entity.id.value,
      userId: entity.userId.value,
      workspaceId: entity.workspaceId?.value || null,
      emailEnabled: entity.emailEnabled,
      pushEnabled: entity.pushEnabled,
      inAppEnabled: entity.inAppEnabled,
      smsEnabled: entity.smsEnabled,
      webhookEnabled: entity.webhookEnabled,
      quietHours: entity.quietHours as any,
      typePreferences: entity.typePreferences as any,
      updatedAt: new Date(),
    };
  }

  async save(preferences: NotificationPreferences): Promise<void> {
    try {
      const data = this.toDrizzle(preferences);
      await this.database
        .insert(notificationPreferences)
        .values(data as any)
        .onConflictDoUpdate({
          target: notificationPreferences.id,
          set: data,
        });
    } catch (error) {
      logger.error('Error saving notification preferences', error as Error);
      throw error;
    }
  }

  async findById(id: string): Promise<NotificationPreferences | null> {
    try {
      const results = await this.database
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.id, id))
        .limit(1);

      if (results.length === 0) return null;

      const result = results[0];
      if (!result) return null;

      return this.toDomain(result);
    } catch (error) {
      logger.error('Error finding notification preferences by ID', error as Error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<NotificationPreferences | null> {
    try {
      const results = await this.database
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            isNull(notificationPreferences.workspaceId)
          )
        )
        .limit(1);

      if (results.length === 0) return null;

      const result = results[0];
      if (!result) return null;

      return this.toDomain(result);
    } catch (error) {
      logger.error('Error finding notification preferences by user ID', error as Error);
      throw error;
    }
  }

  async findByUserAndWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<NotificationPreferences | null> {
    try {
      const results = await this.database
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.workspaceId, workspaceId)
          )
        )
        .limit(1);

      if (results.length === 0) return null;

      const result = results[0];
      if (!result) return null;

      return this.toDomain(result);
    } catch (error) {
      logger.error('Error finding notification preferences by user and workspace', error as Error);
      throw error;
    }
  }

  async getEnabledChannels(
    userId: string,
    type: NotificationType,
    workspaceId?: string
  ): Promise<NotificationChannel[]> {
    try {
      const preferences = workspaceId
        ? await this.findByUserAndWorkspace(userId, workspaceId)
        : await this.findByUserId(userId);

      if (!preferences) {
        // Return default channels if no preferences found
        return [NotificationChannel.EMAIL, NotificationChannel.IN_APP];
      }

      return preferences.getEnabledChannelsForType(type);
    } catch (error) {
      logger.error('Error getting enabled channels', error as Error);
      throw error;
    }
  }

  async isTypeEnabled(
    userId: string,
    type: NotificationType,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      const preferences = workspaceId
        ? await this.findByUserAndWorkspace(userId, workspaceId)
        : await this.findByUserId(userId);

      if (!preferences) {
        return true; // Default to enabled if no preferences found
      }

      return preferences.isTypeEnabled(type);
    } catch (error) {
      logger.error('Error checking if type is enabled', error as Error);
      throw error;
    }
  }

  async isInQuietHours(userId: string, date: Date = new Date()): Promise<boolean> {
    try {
      const preferences = await this.findByUserId(userId);

      if (!preferences) {
        return false; // Default to not in quiet hours
      }

      return preferences.isInQuietHours(date);
    } catch (error) {
      logger.error('Error checking quiet hours', error as Error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.delete(notificationPreferences).where(eq(notificationPreferences.id, id));
    } catch (error) {
      logger.error('Error deleting notification preferences', error as Error);
      throw error;
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.database
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
    } catch (error) {
      logger.error('Error deleting notification preferences by user ID', error as Error);
      throw error;
    }
  }
}
