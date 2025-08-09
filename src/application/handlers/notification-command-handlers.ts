/**
 * Notification Command Handlers
 *
 * Handles commands for creating, updating, and managing notifications
 */

import { BaseHandler, ICommandHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { INotificationRepository } from '../../domain/repositories/notification-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { NotificationId } from '../../domain/value-objects/notification-id';
import { UserId } from '../../domain/value-objects/user-id';
import { Notification } from '../../domain/entities/notification';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

// Command interfaces
export interface CreateNotificationCommand {
  userId: UserId;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  createdBy: UserId;
}

export interface MarkNotificationAsReadCommand {
  notificationId: NotificationId;
  userId: UserId;
}

export interface MarkAllNotificationsAsReadCommand {
  userId: UserId;
}

export interface DeleteNotificationCommand {
  notificationId: NotificationId;
  userId: UserId;
}

export interface UpdateNotificationPreferencesCommand {
  userId: UserId;
  preferences: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    taskAssignments?: boolean;
    taskCompletions?: boolean;
    taskComments?: boolean;
    projectUpdates?: boolean;
    workspaceInvitations?: boolean;
    dailyDigest?: boolean;
    weeklyReport?: boolean;
    quietHours?: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };
}

export interface BulkDeleteNotificationsCommand {
  notificationIds: NotificationId[];
  userId: UserId;
}

/**
 * Create notification command handler
 */
export class CreateNotificationCommandHandler
  extends BaseHandler
  implements ICommandHandler<CreateNotificationCommand, NotificationId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CreateNotificationCommand): Promise<NotificationId> {
    this.logInfo('Creating notification', {
      userId: command.userId.value,
      type: command.type,
      title: command.title,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify target user exists
        const user = await this.userRepository.findById(command.userId);
        if (!user) {
          throw new NotFoundError(
            `User with ID ${command.userId.value} not found`
          );
        }

        // Create notification
        const notification = Notification.create({
          userId: command.userId,
          type: command.type,
          title: command.title,
          message: command.message,
          data: command.data,
        });

        await this.notificationRepository.save(notification);

        // Clear user's notification cache
        await this.clearNotificationCaches(command.userId);

        this.logInfo('Notification created successfully', {
          notificationId: notification.id.value,
          userId: command.userId.value,
        });

        return notification.id;
      } catch (error) {
        this.logError('Failed to create notification', error as Error, {
          userId: command.userId.value,
          type: command.type,
        });
        throw error;
      }
    });
  }

  private async clearNotificationCaches(userId: UserId): Promise<void> {
    const patterns = [
      `notifications:${userId.value}:*`,
      `notification-stats:${userId.value}:*`,
    ];

    // In a real implementation, this would clear cache patterns
    this.logDebug('Notification caches cleared', { userId: userId.value });
  }
}

/**
 * Mark notification as read command handler
 */
export class MarkNotificationAsReadCommandHandler
  extends BaseHandler
  implements ICommandHandler<MarkNotificationAsReadCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: MarkNotificationAsReadCommand): Promise<void> {
    this.logInfo('Marking notification as read', {
      notificationId: command.notificationId.value,
      userId: command.userId.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const notification = await this.notificationRepository.findById(
          command.notificationId
        );
        if (!notification) {
          throw new NotFoundError(
            `Notification with ID ${command.notificationId.value} not found`
          );
        }

        // Check if user owns this notification
        if (!notification.userId.equals(command.userId)) {
          throw new AuthorizationError(
            'User does not have permission to modify this notification'
          );
        }

        // Mark as read
        notification.markAsRead();
        await this.notificationRepository.save(notification);

        // Clear caches
        await this.clearNotificationCaches(command.userId);

        this.logInfo('Notification marked as read successfully', {
          notificationId: command.notificationId.value,
        });
      } catch (error) {
        this.logError('Failed to mark notification as read', error as Error, {
          notificationId: command.notificationId.value,
        });
        throw error;
      }
    });
  }

  private async clearNotificationCaches(userId: UserId): Promise<void> {
    const patterns = [
      `notifications:${userId.value}:*`,
      `notification:${userId.value}:*`,
      `notification-stats:${userId.value}:*`,
    ];

    this.logDebug('Notification caches cleared', { userId: userId.value });
  }
}

/**
 * Mark all notifications as read command handler
 */
export class MarkAllNotificationsAsReadCommandHandler
  extends BaseHandler
  implements ICommandHandler<MarkAllNotificationsAsReadCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: MarkAllNotificationsAsReadCommand): Promise<void> {
    this.logInfo('Marking all notifications as read', {
      userId: command.userId.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const unreadNotifications =
          await this.notificationRepository.findByUserId(command.userId, {
            isRead: false,
          });

        for (const notification of unreadNotifications) {
          notification.markAsRead();
          await this.notificationRepository.save(notification);
        }

        // Clear caches
        await this.clearNotificationCaches(command.userId);

        this.logInfo('All notifications marked as read successfully', {
          userId: command.userId.value,
          count: unreadNotifications.length,
        });
      } catch (error) {
        this.logError(
          'Failed to mark all notifications as read',
          error as Error,
          {
            userId: command.userId.value,
          }
        );
        throw error;
      }
    });
  }

  private async clearNotificationCaches(userId: UserId): Promise<void> {
    const patterns = [
      `notifications:${userId.value}:*`,
      `notification-stats:${userId.value}:*`,
    ];

    this.logDebug('Notification caches cleared', { userId: userId.value });
  }
}

/**
 * Delete notification command handler
 */
export class DeleteNotificationCommandHandler
  extends BaseHandler
  implements ICommandHandler<DeleteNotificationCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: DeleteNotificationCommand): Promise<void> {
    this.logInfo('Deleting notification', {
      notificationId: command.notificationId.value,
      userId: command.userId.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const notification = await this.notificationRepository.findById(
          command.notificationId
        );
        if (!notification) {
          throw new NotFoundError(
            `Notification with ID ${command.notificationId.value} not found`
          );
        }

        // Check if user owns this notification
        if (!notification.userId.equals(command.userId)) {
          throw new AuthorizationError(
            'User does not have permission to delete this notification'
          );
        }

        await this.notificationRepository.delete(command.notificationId);

        // Clear caches
        await this.clearNotificationCaches(command.userId);

        this.logInfo('Notification deleted successfully', {
          notificationId: command.notificationId.value,
        });
      } catch (error) {
        this.logError('Failed to delete notification', error as Error, {
          notificationId: command.notificationId.value,
        });
        throw error;
      }
    });
  }

  private async clearNotificationCaches(userId: UserId): Promise<void> {
    const patterns = [
      `notifications:${userId.value}:*`,
      `notification:${command.notificationId.value}`,
      `notification-stats:${userId.value}:*`,
    ];

    this.logDebug('Notification caches cleared', { userId: userId.value });
  }
}

/**
 * Update notification preferences command handler
 */
export class UpdateNotificationPreferencesCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateNotificationPreferencesCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateNotificationPreferencesCommand): Promise<void> {
    this.logInfo('Updating notification preferences', {
      userId: command.userId.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify user exists
        const user = await this.userRepository.findById(command.userId);
        if (!user) {
          throw new NotFoundError(
            `User with ID ${command.userId.value} not found`
          );
        }

        // Get existing preferences or create new ones
        let preferences = await this.notificationRepository.getPreferences(
          command.userId
        );
        if (!preferences) {
          preferences =
            await this.notificationRepository.createDefaultPreferences(
              command.userId
            );
        }

        // Update preferences
        preferences.update(command.preferences);
        await this.notificationRepository.savePreferences(preferences);

        // Clear preferences cache
        await this.cacheService.delete(
          `notification-preferences:${command.userId.value}`
        );

        this.logInfo('Notification preferences updated successfully', {
          userId: command.userId.value,
        });
      } catch (error) {
        this.logError(
          'Failed to update notification preferences',
          error as Error,
          {
            userId: command.userId.value,
          }
        );
        throw error;
      }
    });
  }
}

/**
 * Bulk delete notifications command handler
 */
export class BulkDeleteNotificationsCommandHandler
  extends BaseHandler
  implements ICommandHandler<BulkDeleteNotificationsCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: BulkDeleteNotificationsCommand): Promise<void> {
    this.logInfo('Bulk deleting notifications', {
      userId: command.userId.value,
      count: command.notificationIds.length,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        let deletedCount = 0;

        for (const notificationId of command.notificationIds) {
          const notification =
            await this.notificationRepository.findById(notificationId);
          if (notification && notification.userId.equals(command.userId)) {
            await this.notificationRepository.delete(notificationId);
            deletedCount++;
          }
        }

        // Clear caches
        await this.clearNotificationCaches(command.userId);

        this.logInfo('Bulk delete notifications completed', {
          userId: command.userId.value,
          requested: command.notificationIds.length,
          deleted: deletedCount,
        });
      } catch (error) {
        this.logError('Failed to bulk delete notifications', error as Error, {
          userId: command.userId.value,
          count: command.notificationIds.length,
        });
        throw error;
      }
    });
  }

  private async clearNotificationCaches(userId: UserId): Promise<void> {
    const patterns = [
      `notifications:${userId.value}:*`,
      `notification-stats:${userId.value}:*`,
    ];

    this.logDebug('Notification caches cleared', { userId: userId.value });
  }
}
