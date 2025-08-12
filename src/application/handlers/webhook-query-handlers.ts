/**
 * Webhook Query Handlers
 *
 * Handles queries for webhooks and webhook delivery status
 */

import { BaseHandler, IQueryHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { IWebhookRepository } from '../../domain/repositories/webhook-repository';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { PaginatedResult, PaginationOptions } from '../queries/base-query';
import { WebhookId } from '../../domain/value-objects/webhook-id';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { UserId } from '../../domain/value-objects/user-id';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { Webhook, WebhookDelivery } from '../../domain/entities/webhook';

// Query interfaces
export interface GetWebhookByIdQuery {
  webhookId: WebhookId;
  userId: UserId;
}

export interface GetWebhooksByWorkspaceQuery {
  workspaceId: WorkspaceId;
  userId: UserId;
  filters?: WebhookFilters;
  pagination?: PaginationOptions;
}

export interface GetWebhookDeliveriesQuery {
  webhookId: WebhookId;
  userId: UserId;
  filters?: DeliveryFilters;
  pagination?: PaginationOptions;
}

export interface GetWebhookStatisticsQuery {
  webhookId?: WebhookId;
  workspaceId?: WorkspaceId;
  userId: UserId;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetWebhookDeliveryByIdQuery {
  deliveryId: string;
  userId: UserId;
}

// Filter interfaces
export interface WebhookFilters {
  isActive?: boolean;
  events?: string[];
  createdFrom?: Date;
  createdTo?: Date;
}

export interface DeliveryFilters {
  status?: string[];
  eventType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// DTO interfaces
export interface WebhookDto {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt?: Date | undefined;
  lastDeliveryStatus?: string | undefined;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryDto {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  url: string;
  httpMethod: string;
  headers: Record<string, string>;
  status: string;
  statusCode?: number | undefined;
  responseBody?: string | undefined;
  responseHeaders?: Record<string, string> | undefined;
  deliveredAt?: Date | undefined;
  duration?: number | undefined;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date | undefined;
  errorMessage?: string | undefined;
  createdAt: Date;
}

export interface WebhookStatisticsDto {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  averageResponseTime: number;
  deliverySuccessRate: number;
  deliveriesByStatus: Record<string, number>;
  deliveriesByEventType: Record<string, number>;
  deliveryTrend: { date: string; successful: number; failed: number }[];
  recentDeliveries: WebhookDeliveryDto[];
}

/**
 * Get webhook by ID
 */
export class GetWebhookByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWebhookByIdQuery, WebhookDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetWebhookByIdQuery): Promise<WebhookDto> {
    this.logInfo('Getting webhook by ID', {
      webhookId: query.webhookId.value,
      userId: query.userId.value,
    });

    try {
      // Try cache first
      const cacheKey = `webhook:${query.webhookId.value}`;
      const cachedWebhook = await this.cacheService.get<WebhookDto>(cacheKey);
      if (cachedWebhook) {
        // Verify user still has access
        const hasAccess = await this.canUserViewWebhook(
          query.userId,
          query.webhookId
        );
        if (hasAccess) {
          this.logInfo('Webhook found in cache', {
            webhookId: query.webhookId.value,
          });
          return cachedWebhook;
        }
      }

      const webhook = await this.webhookRepository.findById(query.webhookId.value);
      if (!webhook) {
        throw new NotFoundError(
          `Webhook with ID ${query.webhookId.value} not found`
        );
      }

      // Check if user has permission to view this webhook
      if (!(await this.canUserViewWebhook(query.userId, query.webhookId))) {
        throw new AuthorizationError(
          'User does not have permission to view this webhook'
        );
      }

      const webhookDto = await this.mapWebhookToDto(webhook);

      // Cache the result
      await this.cacheService.set(cacheKey, webhookDto, { ttl: 600 }); // 10 minutes

      this.logInfo('Webhook retrieved successfully', {
        webhookId: query.webhookId.value,
      });

      return webhookDto;
    } catch (error) {
      this.logError('Failed to get webhook by ID', error as Error, {
        webhookId: query.webhookId.value,
      });
      throw error;
    }
  }

  private async canUserViewWebhook(
    userId: UserId,
    webhookId: WebhookId
  ): Promise<boolean> {
    const webhook = await this.webhookRepository.findById(webhookId.value);
    if (!webhook) return false;

    const member = await this.workspaceRepository.findMember(
      WorkspaceId.create(webhook.workspaceId),
      userId
    );
    return member !== null;
  }

  private async mapWebhookToDto(webhook: Webhook): Promise<WebhookDto> {
    const stats = await this.webhookRepository.getWebhookStatistics(webhook.id);

    return {
      id: webhook.id,
      workspaceId: webhook.workspaceId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events.map(e => e.toString()),
      isActive: webhook.status === 'active',
      lastDeliveryAt: stats.lastDeliveryAt || undefined,
      lastDeliveryStatus: stats.lastDeliveryStatus || undefined,
      totalDeliveries: stats.totalDeliveries,
      successfulDeliveries: stats.successfulDeliveries,
      failedDeliveries: stats.failedDeliveries,
      successRate:
        stats.totalDeliveries > 0
          ? (stats.successfulDeliveries / stats.totalDeliveries) * 100
          : 0,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}

/**
 * Get webhooks by workspace
 */
export class GetWebhooksByWorkspaceQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetWebhooksByWorkspaceQuery, PaginatedResult<WebhookDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetWebhooksByWorkspaceQuery
  ): Promise<PaginatedResult<WebhookDto>> {
    this.logInfo('Getting webhooks by workspace', {
      workspaceId: query.workspaceId.value,
      userId: query.userId.value,
    });

    try {
      // Check if user can view webhooks in this workspace
      const canView = await this.canUserViewWorkspaceWebhooks(
        query.userId,
        query.workspaceId
      );
      if (!canView) {
        throw new AuthorizationError(
          'User does not have permission to view webhooks in this workspace'
        );
      }

      // Generate cache key
      const cacheKey = `workspace-webhooks:${query.workspaceId.value}:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<WebhookDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const webhooks = await this.webhookRepository.findByWorkspaceId(
        query.workspaceId.value,
        query.filters
      );

      const webhookDtos: WebhookDto[] = [];
      for (const webhook of webhooks) {
        const dto = await this.mapWebhookToDto(webhook);
        webhookDtos.push(dto);
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(
        webhookDtos,
        query.pagination
      );

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, { ttl: 300 }); // 5 minutes

      this.logInfo('Webhooks by workspace retrieved successfully', {
        workspaceId: query.workspaceId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get webhooks by workspace', error as Error, {
        workspaceId: query.workspaceId.value,
      });
      throw error;
    }
  }

  private async canUserViewWorkspaceWebhooks(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }

  private async mapWebhookToDto(webhook: Webhook): Promise<WebhookDto> {
    const stats = await this.webhookRepository.getWebhookStatistics(webhook.id);

    return {
      id: webhook.id,
      workspaceId: webhook.workspaceId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events.map(e => e.toString()),
      isActive: webhook.status === 'active',
      lastDeliveryAt: stats.lastDeliveryAt || undefined,
      lastDeliveryStatus: stats.lastDeliveryStatus || undefined,
      totalDeliveries: stats.totalDeliveries,
      successfulDeliveries: stats.successfulDeliveries,
      failedDeliveries: stats.failedDeliveries,
      successRate:
        stats.totalDeliveries > 0
          ? (stats.successfulDeliveries / stats.totalDeliveries) * 100
          : 0,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
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
 * Get webhook deliveries
 */
export class GetWebhookDeliveriesQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<
      GetWebhookDeliveriesQuery,
      PaginatedResult<WebhookDeliveryDto>
    >
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetWebhookDeliveriesQuery
  ): Promise<PaginatedResult<WebhookDeliveryDto>> {
    this.logInfo('Getting webhook deliveries', {
      webhookId: query.webhookId.value,
      userId: query.userId.value,
    });

    try {
      // Check if user can view webhook deliveries
      const canView = await this.canUserViewWebhook(
        query.userId,
        query.webhookId
      );
      if (!canView) {
        throw new AuthorizationError(
          'User does not have permission to view webhook deliveries'
        );
      }

      // Generate cache key
      const cacheKey = `webhook-deliveries:${query.webhookId.value}:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<WebhookDeliveryDto>>(
          cacheKey
        );
      if (cachedResult) {
        return cachedResult;
      }

      const deliveries = await this.webhookRepository.getDeliveries(
        query.webhookId.value,
        query.filters,
        query.pagination?.limit || 50
      );

      const deliveryDtos = deliveries.map((delivery: WebhookDelivery) =>
        this.mapDeliveryToDto(delivery)
      );

      // Apply pagination
      const paginatedResult = this.applyPagination(
        deliveryDtos,
        query.pagination
      );

      // Cache the result for 2 minutes (deliveries change frequently)
      await this.cacheService.set(cacheKey, paginatedResult, { ttl: 120 });

      this.logInfo('Webhook deliveries retrieved successfully', {
        webhookId: query.webhookId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get webhook deliveries', error as Error, {
        webhookId: query.webhookId.value,
      });
      throw error;
    }
  }

  private async canUserViewWebhook(
    userId: UserId,
    webhookId: WebhookId
  ): Promise<boolean> {
    const webhook = await this.webhookRepository.findById(webhookId.value);
    if (!webhook) return false;

    const member = await this.workspaceRepository.findMember(
      WorkspaceId.create(webhook.workspaceId),
      userId
    );
    return member !== null;
  }

  private mapDeliveryToDto(delivery: WebhookDelivery): WebhookDeliveryDto {
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventType: delivery.event,
      payload: delivery.payload,
      url: '', // URL will be fetched from webhook
      httpMethod: 'POST', // Default HTTP method
      headers: delivery.headers || {},
      status: delivery.status,
      statusCode: delivery.httpStatus || undefined,
      responseBody: delivery.responseBody || undefined,
      responseHeaders: delivery.responseHeaders || undefined,
      deliveredAt: delivery.deliveredAt || undefined,
      duration: delivery.duration || undefined,
      attempts: delivery.attempt,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt || undefined,
      errorMessage: delivery.errorMessage || undefined,
      createdAt: delivery.createdAt,
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

    const { page = 1, limit = 50 } = pagination;
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
 * Get webhook statistics
 */
export class GetWebhookStatisticsQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWebhookStatisticsQuery, WebhookStatisticsDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetWebhookStatisticsQuery
  ): Promise<WebhookStatisticsDto> {
    this.logInfo('Getting webhook statistics', {
      webhookId: query.webhookId?.value,
      workspaceId: query.workspaceId?.value,
      userId: query.userId.value,
    });

    try {
      // Check permissions
      if (query.webhookId) {
        const canView = await this.canUserViewWebhook(
          query.userId,
          query.webhookId
        );
        if (!canView) {
          throw new AuthorizationError(
            'User does not have permission to view webhook statistics'
          );
        }
      } else if (query.workspaceId) {
        const canView = await this.canUserViewWorkspaceWebhooks(
          query.userId,
          query.workspaceId
        );
        if (!canView) {
          throw new AuthorizationError(
            'User does not have permission to view workspace webhook statistics'
          );
        }
      }

      // Generate cache key
      const cacheKey = `webhook-stats:${query.webhookId?.value || 'all'}:${query.workspaceId?.value || 'all'}:${query.dateFrom?.toISOString() || 'all'}:${query.dateTo?.toISOString() || 'all'}`;
      const cachedStats =
        await this.cacheService.get<WebhookStatisticsDto>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }

      const statistics = await this.webhookRepository.getStatistics(
        query.webhookId?.value,
        query.workspaceId?.value,
        query.dateFrom,
        query.dateTo
      );

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, statistics, { ttl: 300 });

      this.logInfo('Webhook statistics retrieved successfully');

      return statistics;
    } catch (error) {
      this.logError('Failed to get webhook statistics', error as Error);
      throw error;
    }
  }

  private async canUserViewWebhook(
    userId: UserId,
    webhookId: WebhookId
  ): Promise<boolean> {
    const webhook = await this.webhookRepository.findById(webhookId.value);
    if (!webhook) return false;

    const member = await this.workspaceRepository.findMember(
      WorkspaceId.create(webhook.workspaceId),
      userId
    );
    return member !== null;
  }

  private async canUserViewWorkspaceWebhooks(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }
}

/**
 * Get webhook delivery by ID
 */
export class GetWebhookDeliveryByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWebhookDeliveryByIdQuery, WebhookDeliveryDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetWebhookDeliveryByIdQuery
  ): Promise<WebhookDeliveryDto> {
    this.logInfo('Getting webhook delivery by ID', {
      deliveryId: query.deliveryId,
      userId: query.userId.value,
    });

    try {
      const delivery = await this.webhookRepository.getDeliveryById(
        query.deliveryId
      );
      if (!delivery) {
        throw new NotFoundError(
          `Webhook delivery with ID ${query.deliveryId} not found`
        );
      }

      // Check if user can view this delivery
      const canView = await this.canUserViewWebhook(
        query.userId,
        WebhookId.create(delivery.webhookId)
      );
      if (!canView) {
        throw new AuthorizationError(
          'User does not have permission to view this webhook delivery'
        );
      }

      const deliveryDto = this.mapDeliveryToDto(delivery);

      this.logInfo('Webhook delivery retrieved successfully', {
        deliveryId: query.deliveryId,
      });

      return deliveryDto;
    } catch (error) {
      this.logError('Failed to get webhook delivery by ID', error as Error, {
        deliveryId: query.deliveryId,
      });
      throw error;
    }
  }

  private async canUserViewWebhook(
    userId: UserId,
    webhookId: WebhookId
  ): Promise<boolean> {
    const webhook = await this.webhookRepository.findById(webhookId.value);
    if (!webhook) return false;

    const member = await this.workspaceRepository.findMember(
      WorkspaceId.create(webhook.workspaceId),
      userId
    );
    return member !== null;
  }

  private mapDeliveryToDto(delivery: WebhookDelivery): WebhookDeliveryDto {
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventType: delivery.event,
      payload: delivery.payload,
      url: '', // URL will be fetched from webhook
      httpMethod: 'POST', // Default HTTP method
      headers: delivery.headers || {},
      status: delivery.status,
      statusCode: delivery.httpStatus || undefined,
      responseBody: delivery.responseBody || undefined,
      responseHeaders: delivery.responseHeaders || undefined,
      deliveredAt: delivery.deliveredAt || undefined,
      duration: delivery.duration || undefined,
      attempts: delivery.attempt,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt || undefined,
      errorMessage: delivery.errorMessage || undefined,
      createdAt: delivery.createdAt,
    };
  }
}

// Export aliases for backward compatibility
export const GetWebhooksHandler = GetWebhooksByWorkspaceQueryHandler;
export const GetWebhookDeliveriesHandler = GetWebhookDeliveriesQueryHandler;
