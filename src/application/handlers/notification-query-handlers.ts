/**
 * Notification Query Handlers
 *
 * Handles queries for notifications and notification preferences
 */

import { BaseHandler, IQueryHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { INotificationRepository } from '../../domain/repositories/notification-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { PaginatedResult, PaginationOptions } from '../queries/base-query';
import { UserId } from '../../domain/value-objects/user-id';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

// Query interfaces
export interface GetNotificationsQuery {
  userId: UserId;
  isRead?: boolean;
  type?: string;
  pagination?: PaginationOptions;
}

export interface GetNotificationByIdQuery {
  notificationId: string;
  userId: UserId;
}

export interface GetNotificationPreferencesQuery {
  userId: UserId;
}

export interface GetNotificationStatisticsQuery {
  userId: UserId;
  dateFrom?: Date;
  dateTo?: Date;
}

// DTO interfaces
export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationPreferencesDto {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskAssignments: boolean;
  taskCompletions: boolean;
  taskComments: boolean;
  projectUpdates: boolean;
  workspaceInvitations: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  updatedAt: Date;
}

export interface NotificationStatisticsDto {
  totalNotifications: number;
  unreadNotifications: number;
  readNotifications: number;
  notificationsByType: Record<string, number>;
  notificationsThisWeek: number;
  notificationsThisMonth: number;
  averageReadTime: number;
}

/**
 * Get notifications for a user
 */
export class GetNotificationsQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetNotificationsQuery, PaginatedResult<NotificationDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetNotificationsQuery
  ): Promise<PaginatedResult<NotificationDto>> {
    this.logInfo('Getting notifications for user', {
      userId: query.userId.value,
      isRead: query.isRead,
      type: query.type,
    });

    try {
      // Generate cache key
      const cacheKey = `notifications:${query.userId.value}:${query.isRead || 'all'}:${query.type || 'all'}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<NotificationDto>>(cacheKey);
      if (cachedResult) {
        this.logInfo('Notifications found in cache', {
          userId: query.userId.value,
        });
        return cachedResult;
      }

      // Get notifications from repository
      const notifications = await this.notificationRepository.findByUserId(
        query.userId,
        {
          isRead: query.isRead,
          type: query.type,
        }
      );

      // Map to DTOs
      const notificationDtos = notifications.map(notification =>
        this.mapNotificationToDto(notification)
      );

      // Apply pagination
      const paginatedResult = this.applyPagination(
        notificationDtos,
        query.pagination
      );

      // Cache the result for 2 minutes (notifications change frequently)
      await this.cacheService.set(cacheKey, paginatedResult, 120);

      this.logInfo('Notifications retrieved successfully', {
        userId: query.userId.value,
        count: paginatedResult.data.length,
        total: paginatedResult.total,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get notifications', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }

  private mapNotificationToDto(notification: any): NotificationDto {
    return {
      id: notification.id.value,
      userId: notification.userId.value,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  private applyPagination<T>(
    data: T[],
    pagination?: PaginationOptions
  ): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 20 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

/**
 * Get notification by ID
 */
export class GetNotificationByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetNotificationByIdQuery, NotificationDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetNotificationByIdQuery): Promise<NotificationDto> {
    this.logInfo('Getting notification by ID', {
      notificationId: query.notificationId,
      userId: query.userId.value,
    });

    try {
      // Try cache first
      const cacheKey = `notification:${query.notificationId}`;
      const cachedNotification =
        await this.cacheService.get<NotificationDto>(cacheKey);
      if (cachedNotification) {
        // Verify user owns this notification
        if (cachedNotification.userId !== query.userId.value) {
          throw new AuthorizationError(
            'User does not have permission to view this notification'
          );
        }
        return cachedNotification;
      }

      const notification = await this.notificationRepository.findById(
        query.notificationId
      );
      if (!notification) {
        throw new NotFoundError(
          `Notification with ID ${query.notificationId} not found`
        );
      }

      // Check if user owns this notification
      if (!notification.userId.equals(query.userId)) {
        throw new AuthorizationError(
          'User does not have permission to view this notification'
        );
      }

      const notificationDto = this.mapNotificationToDto(notification);

      // Cache the result
      await this.cacheService.set(cacheKey, notificationDto, 300); // 5 minutes

      this.logInfo('Notification retrieved successfully', {
        notificationId: query.notificationId,
      });

      return notificationDto;
    } catch (error) {
      this.logError('Failed to get notification by ID', error as Error, {
        notificationId: query.notificationId,
      });
      throw error;
    }
  }

  private mapNotificationToDto(notification: any): NotificationDto {
    return {
      id: notification.id.value,
      userId: notification.userId.value,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}

/**
 * Get notification preferences for a user
 */
export class GetNotificationPreferencesQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetNotificationPreferencesQuery, NotificationPreferencesDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetNotificationPreferencesQuery
  ): Promise<NotificationPreferencesDto> {
    this.logInfo('Getting notification preferences', {
      userId: query.userId.value,
    });

    try {
      // Try cache first
      const cacheKey = `notification-preferences:${query.userId.value}`;
      const cachedPreferences =
        await this.cacheService.get<NotificationPreferencesDto>(cacheKey);
      if (cachedPreferences) {
        return cachedPreferences;
      }

      const preferences = await this.notificationRepository.getPreferences(
        query.userId
      );
      if (!preferences) {
        // Return default preferences if none exist
        const defaultPreferences: NotificationPreferencesDto = {
          userId: query.userId.value,
          emailNotifications: true,
          pushNotifications: true,
          taskAssignments: true,
          taskCompletions: true,
          taskComments: true,
          projectUpdates: true,
          workspaceInvitations: true,
          dailyDigest: false,
          weeklyReport: false,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
          },
          updatedAt: new Date(),
        };

        // Cache default preferences
        await this.cacheService.set(cacheKey, defaultPreferences, 3600); // 1 hour

        return defaultPreferences;
      }

      const preferencesDto = this.mapPreferencesToDto(preferences);

      // Cache the result
      await this.cacheService.set(cacheKey, preferencesDto, 3600); // 1 hour

      this.logInfo('Notification preferences retrieved successfully', {
        userId: query.userId.value,
      });

      return preferencesDto;
    } catch (error) {
      this.logError('Failed to get notification preferences', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }

  private mapPreferencesToDto(preferences: any): NotificationPreferencesDto {
    return {
      userId: preferences.userId.value,
      emailNotifications: preferences.emailNotifications,
      pushNotifications: preferences.pushNotifications,
      taskAssignments: preferences.taskAssignments,
      taskCompletions: preferences.taskCompletions,
      taskComments: preferences.taskComments,
      projectUpdates: preferences.projectUpdates,
      workspaceInvitations: preferences.workspaceInvitations,
      dailyDigest: preferences.dailyDigest,
      weeklyReport: preferences.weeklyReport,
      quietHours: preferences.quietHours,
      updatedAt: preferences.updatedAt,
    };
  }
}

/**
 * Get notification statistics for a user
 */
export class GetNotificationStatisticsQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetNotificationStatisticsQuery, NotificationStatisticsDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly notificationRepository: INotificationRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetNotificationStatisticsQuery
  ): Promise<NotificationStatisticsDto> {
    this.logInfo('Getting notification statistics', {
      userId: query.userId.value,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    try {
      // Generate cache key
      const cacheKey = `notification-stats:${query.userId.value}:${query.dateFrom?.toISOString() || 'all'}:${query.dateTo?.toISOString() || 'all'}`;
      const cachedStats =
        await this.cacheService.get<NotificationStatisticsDto>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }

      const statistics = await this.notificationRepository.getStatistics(
        query.userId,
        query.dateFrom,
        query.dateTo
      );

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, statistics, 300);

      this.logInfo('Notification statistics retrieved successfully', {
        userId: query.userId.value,
      });

      return statistics;
    } catch (error) {
      this.logError('Failed to get notification statistics', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }
}
