import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  sql,
  inArray,
  isNull,
  lt,
  lte,
  gte,
} from 'drizzle-orm';
import { BaseDrizzleRepository } from './base-drizzle-repository';
import {
  Notification,
  NotificationPreferences,
  NotificationType,
  NotificationStatus,
  NotificationChannel,
} from '../../../domain/entities/notification';
import {
  INotificationRepository,
  INotificationPreferencesRepository,
} from '../../../domain/repositories/notification-repository';
import { ISpecification } from '../../../domain/base/repository.interface';
import {
  notifications,
  notificationPreferences,
  notificationTypeEnum,
  notificationStatusEnum,
  notificationChannelEnum,
} from '../schema/notifications';
import { logger } from '../../monitoring/logging-service';

// Drizzle model types
type DrizzleNotification = typeof notifications.$inferSelect;
type DrizzleNotificationPreferences =
  typeof notificationPreferences.$inferSelect;

export class NotificationRepository
  extends BaseDrizzleRepository<
    Notification,
    string,
    DrizzleNotification,
    typeof notifications
  >
  implements INotificationRepository
{
  constructor() {
    super(notifications, 'Notification');
  }

  protected toDomain(drizzleModel: DrizzleNotification): Notification {
    return new Notification({
      id: drizzleModel.id,
      userId: drizzleModel.userId,
      workspaceId: drizzleModel.workspaceId || undefined,
      projectId: drizzleModel.projectId || undefined,
      taskId: drizzleModel.taskId || undefined,
      type: drizzleModel.type as NotificationType,
      title: drizzleModel.title,
      message: drizzleModel.message,
      data: (drizzleModel.data as Record<string, any>) || undefined,
      channels: (drizzleModel.channels as string[]).map(
        c => c as NotificationChannel
      ),
      status: drizzleModel.status as NotificationStatus,
      readAt: drizzleModel.readAt || undefined,
      sentAt: drizzleModel.sentAt || undefined,
      deliveredAt: drizzleModel.deliveredAt || undefined,
      failureReason: drizzleModel.failureReason || undefined,
      retryCount: drizzleModel.retryCount,
      maxRetries: drizzleModel.maxRetries,
      scheduledFor: drizzleModel.scheduledFor || undefined,
      expiresAt: drizzleModel.expiresAt || undefined,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
    });
  }

  protected toDrizzle(entity: Notification): Partial<DrizzleNotification> {
    return {
      id: entity.id,
      userId: entity.userId,
      workspaceId: entity.workspaceId,
      projectId: entity.projectId,
      taskId: entity.taskId,
      type: entity.type,
      title: entity.title,
      message: entity.message,
      data: entity.data,
      channels: entity.channels,
      status: entity.status,
      readAt: entity.readAt,
      sentAt: entity.sentAt,
      deliveredAt: entity.deliveredAt,
      failureReason: entity.failureReason,
      retryCount: entity.retryCount,
      maxRetries: entity.maxRetries,
      scheduledFor: entity.scheduledFor,
      expiresAt: entity.expiresAt,
      updatedAt: new Date(),
    };
  }

  protected buildWhereClause(specification: ISpecification<Notification>): any {
    // This would be implemented based on your specification pattern
    // For now, returning undefined as a placeholder
    return undefined;
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
      logger.error('Error saving notification', {
        notificationId: notification.id,
        error,
      });
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

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by user ID', { userId, error });
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

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by workspace ID', {
        workspaceId,
        error,
      });
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

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by type', { type, error });
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

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding notifications by status', { status, error });
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

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding unread notifications', { userId, error });
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
            or(
              isNull(notifications.scheduledFor),
              lte(notifications.scheduledFor, now)
            ),
            or(
              isNull(notifications.expiresAt),
              gte(notifications.expiresAt, now)
            )
          )
        )
        .orderBy(asc(notifications.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding pending delivery notifications', { error });
      throw error;
    }
  }

  async findScheduledNotifications(): Promise<Notification[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'pending'),
            gte(notifications.scheduledFor, now)
          )
        )
        .orderBy(asc(notifications.scheduledFor));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding scheduled notifications', { error });
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
            or(
              eq(notifications.status, 'pending'),
              eq(notifications.status, 'failed')
            )
          )
        );

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding expired notifications', { error });
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

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding failed retryable notifications', { error });
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
      logger.error('Error marking notification as read', { id, error });
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
      logger.error('Error marking all notifications as read', {
        userId,
        error,
      });
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
      logger.error('Error getting unread count', { userId, error });
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
      const [totalResult, unreadResult, byTypeResult, byStatusResult] =
        await Promise.all([
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
      byTypeResult.forEach(row => {
        byType[row.type as NotificationType] = row.count;
      });

      const byStatus = {} as Record<NotificationStatus, number>;
      byStatusResult.forEach(row => {
        byStatus[row.status as NotificationStatus] = row.count;
      });

      return {
        total: totalResult[0]?.count || 0,
        unread: unreadResult[0]?.count || 0,
        byType,
        byStatus,
      };
    } catch (error) {
      logger.error('Error getting notification stats', { userId, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.delete(notifications).where(eq(notifications.id, id));
    } catch (error) {
      logger.error('Error deleting notification', { id, error });
      throw error;
    }
  }

  async deleteRead(userId: string, olderThan?: Date): Promise<number> {
    try {
      let whereClause = and(
        eq(notifications.userId, userId),
        eq(notifications.status, 'read')
      );

      if (olderThan) {
        whereClause = and(whereClause, lt(notifications.readAt, olderThan));
      }

      const results = await this.database
        .delete(notifications)
        .where(whereClause)
        .returning({ id: notifications.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting read notifications', {
        userId,
        olderThan,
        error,
      });
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
      logger.error('Error deleting expired notifications', { error });
      throw error;
    }
  }
}

export class NotificationPreferencesRepository
  extends BaseDrizzleRepository<
    NotificationPreferences,
    string,
    DrizzleNotificationPreferences,
    typeof notificationPreferences
  >
  implements INotificationPreferencesRepository
{
  constructor() {
    super(notificationPreferences, 'NotificationPreferences');
  }

  protected toDomain(
    drizzleModel: DrizzleNotificationPreferences
  ): NotificationPreferences {
    return new NotificationPreferences({
      id: drizzleModel.id,
      userId: drizzleModel.userId,
      workspaceId: drizzleModel.workspaceId || undefined,
      emailEnabled: drizzleModel.emailEnabled,
      pushEnabled: drizzleModel.pushEnabled,
      inAppEnabled: drizzleModel.inAppEnabled,
      smsEnabled: drizzleModel.smsEnabled,
      webhookEnabled: drizzleModel.webhookEnabled,
      quietHours: drizzleModel.quietHours as any,
      typePreferences: drizzleModel.typePreferences as any,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
    });
  }

  protected toDrizzle(
    entity: NotificationPreferences
  ): Partial<DrizzleNotificationPreferences> {
    return {
      id: entity.id,
      userId: entity.userId,
      workspaceId: entity.workspaceId,
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

  protected buildWhereClause(
    specification: ISpecification<NotificationPreferences>
  ): any {
    return undefined;
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
      logger.error('Error saving notification preferences', {
        preferencesId: preferences.id,
        error,
      });
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

      return results.length > 0 ? this.toDomain(results[0]) : null;
    } catch (error) {
      logger.error('Error finding notification preferences by user ID', {
        userId,
        error,
      });
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

      return results.length > 0 ? this.toDomain(results[0]) : null;
    } catch (error) {
      logger.error(
        'Error finding notification preferences by user and workspace',
        { userId, workspaceId, error }
      );
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
      logger.error('Error getting enabled channels', {
        userId,
        type,
        workspaceId,
        error,
      });
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
      logger.error('Error checking if type is enabled', {
        userId,
        type,
        workspaceId,
        error,
      });
      throw error;
    }
  }

  async isInQuietHours(
    userId: string,
    date: Date = new Date()
  ): Promise<boolean> {
    try {
      const preferences = await this.findByUserId(userId);

      if (!preferences) {
        return false; // Default to not in quiet hours
      }

      return preferences.isInQuietHours(date);
    } catch (error) {
      logger.error('Error checking quiet hours', { userId, date, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.id, id));
    } catch (error) {
      logger.error('Error deleting notification preferences', { id, error });
      throw error;
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.database
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
    } catch (error) {
      logger.error('Error deleting notification preferences by user ID', {
        userId,
        error,
      });
      throw error;
    }
  }
}
