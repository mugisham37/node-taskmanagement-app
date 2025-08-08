import { Injectable } from '../../application/decorators/injectable';
import {
  WebhookRepository,
  WebhookFilters,
  WebhookQueryOptions,
  WebhookStats,
} from '../../domain/webhook/repositories/webhook.repository';
import { WebhookEntity } from '../../domain/webhook/entities/webhook.entity';
import { WebhookId } from '../../domain/webhook/value-objects/webhook-id';
import { WorkspaceId } from '../../domain/task-management/value-objects/workspace-id';
import { UserId } from '../../domain/authentication/value-objects/user-id';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WebhookStatus } from '../../domain/webhook/value-objects/webhook-status';
import { WebhookUrl } from '../../domain/webhook/value-objects/webhook-url';
import { WebhookSecret } from '../../domain/webhook/value-objects/webhook-secret';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../logging/logger';

interface WebhookRecord {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  url: string;
  secret?: string;
  status: string;
  events: string[];
  headers: Record<string, string>;
  httpMethod: 'POST' | 'PUT' | 'PATCH';
  contentType: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm: 'sha256' | 'sha1' | 'md5';
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  metadata: Record<string, any>;
  successCount: number;
  failureCount: number;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: 'success' | 'failed';
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WebhookRepositoryImpl implements WebhookRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {}

  async findById(id: WebhookId): Promise<WebhookEntity | null> {
    try {
      const record = await this.prisma.webhook.findUnique({
        where: { id: id.value },
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      this.logger.error('Failed to find webhook by ID', {
        webhookId: id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findByIds(ids: WebhookId[]): Promise<WebhookEntity[]> {
    try {
      const records = await this.prisma.webhook.findMany({
        where: {
          id: { in: ids.map(id => id.value) },
        },
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find webhooks by IDs', {
        webhookIds: ids.map(id => id.value),
        error: error.message,
      });
      throw error;
    }
  }

  async save(webhook: WebhookEntity): Promise<void> {
    try {
      const data = this.toPersistence(webhook);

      await this.prisma.webhook.upsert({
        where: { id: webhook.id.value },
        create: data,
        update: {
          ...data,
          updatedAt: new Date(),
        },
      });

      this.logger.debug('Webhook saved successfully', {
        webhookId: webhook.id.value,
        name: webhook.name,
      });
    } catch (error) {
      this.logger.error('Failed to save webhook', {
        webhookId: webhook.id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(id: WebhookId): Promise<void> {
    try {
      await this.prisma.webhook.delete({
        where: { id: id.value },
      });

      this.logger.debug('Webhook deleted successfully', {
        webhookId: id.value,
      });
    } catch (error) {
      this.logger.error('Failed to delete webhook', {
        webhookId: id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findMany(
    filters?: WebhookFilters,
    options?: WebhookQueryOptions
  ): Promise<{
    webhooks: WebhookEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(options);

      const [records, total] = await Promise.all([
        this.prisma.webhook.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.webhook.count({ where }),
      ]);

      const webhooks = records.map(record => this.toDomain(record));
      const totalPages = Math.ceil(total / limit);

      return {
        webhooks,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to find webhooks', {
        filters,
        options,
        error: error.message,
      });
      throw error;
    }
  }

  async findByWorkspace(
    workspaceId: WorkspaceId,
    options?: WebhookQueryOptions
  ): Promise<WebhookEntity[]> {
    try {
      const orderBy = this.buildOrderBy(options);

      const records = await this.prisma.webhook.findMany({
        where: { workspaceId: workspaceId.value },
        orderBy,
        take: options?.limit,
        skip:
          options?.page && options?.limit
            ? (options.page - 1) * options.limit
            : undefined,
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find webhooks by workspace', {
        workspaceId: workspaceId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findByUser(
    userId: UserId,
    options?: WebhookQueryOptions
  ): Promise<WebhookEntity[]> {
    try {
      const orderBy = this.buildOrderBy(options);

      const records = await this.prisma.webhook.findMany({
        where: { userId: userId.value },
        orderBy,
        take: options?.limit,
        skip:
          options?.page && options?.limit
            ? (options.page - 1) * options.limit
            : undefined,
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find webhooks by user', {
        userId: userId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findActiveByEvent(
    event: WebhookEvent,
    workspaceId: WorkspaceId
  ): Promise<WebhookEntity[]> {
    try {
      const records = await this.prisma.webhook.findMany({
        where: {
          workspaceId: workspaceId.value,
          status: 'ACTIVE',
          events: {
            has: event.value,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find active webhooks by event', {
        event: event.value,
        workspaceId: workspaceId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findByUrl(url: WebhookUrl): Promise<WebhookEntity[]> {
    try {
      const records = await this.prisma.webhook.findMany({
        where: { url: url.value },
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find webhooks by URL', {
        url: url.value,
        error: error.message,
      });
      throw error;
    }
  }

  async getStats(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<WebhookStats> {
    try {
      const where: any = {};

      if (workspaceId) {
        where.workspaceId = workspaceId.value;
      }

      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        };
      }

      const [
        totalWebhooks,
        activeWebhooks,
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
      ] = await Promise.all([
        this.prisma.webhook.count({ where }),
        this.prisma.webhook.count({
          where: { ...where, status: 'ACTIVE' },
        }),
        this.prisma.webhook.aggregate({
          where,
          _sum: {
            successCount: true,
            failureCount: true,
          },
        }),
        this.prisma.webhook.aggregate({
          where,
          _sum: { successCount: true },
        }),
        this.prisma.webhook.aggregate({
          where,
          _sum: { failureCount: true },
        }),
      ]);

      const totalDeliveriesCount =
        (totalDeliveries._sum.successCount || 0) +
        (totalDeliveries._sum.failureCount || 0);

      const successRate =
        totalDeliveriesCount > 0
          ? ((successfulDeliveries._sum.successCount || 0) /
              totalDeliveriesCount) *
            100
          : 0;

      return {
        totalWebhooks,
        activeWebhooks,
        totalDeliveries: totalDeliveriesCount,
        successfulDeliveries: successfulDeliveries._sum.successCount || 0,
        failedDeliveries: failedDeliveries._sum.failureCount || 0,
        successRate,
        averageResponseTime: 0, // Would need to calculate from delivery records
      };
    } catch (error) {
      this.logger.error('Failed to get webhook stats', {
        workspaceId: workspaceId?.value,
        dateRange,
        error: error.message,
      });
      throw error;
    }
  }

  async findUnhealthy(
    workspaceId?: WorkspaceId,
    failureThreshold: number = 80
  ): Promise<WebhookEntity[]> {
    try {
      const where: any = {
        status: 'ACTIVE',
      };

      if (workspaceId) {
        where.workspaceId = workspaceId.value;
      }

      // Find webhooks with high failure rates
      const records = await this.prisma.webhook.findMany({
        where: {
          ...where,
          OR: [
            {
              AND: [
                { failureCount: { gt: 0 } },
                {
                  // Calculate failure rate: failureCount / (successCount + failureCount) * 100 > threshold
                  // This is a simplified query - in production you might want to use raw SQL
                  lastDeliveryStatus: 'failed',
                },
              ],
            },
            {
              lastError: { not: null },
            },
          ],
        },
      });

      // Filter by actual failure rate
      const unhealthyWebhooks = records.filter(record => {
        const total = record.successCount + record.failureCount;
        if (total === 0) return false;
        const failureRate = (record.failureCount / total) * 100;
        return failureRate > failureThreshold;
      });

      return unhealthyWebhooks.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find unhealthy webhooks', {
        workspaceId: workspaceId?.value,
        failureThreshold,
        error: error.message,
      });
      throw error;
    }
  }

  async bulkUpdate(
    ids: WebhookId[],
    updates: Partial<{
      status: WebhookStatus;
      events: WebhookEvent[];
      headers: Record<string, string>;
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    }>
  ): Promise<number> {
    try {
      const updateData: any = {};

      if (updates.status) {
        updateData.status = updates.status.value;
      }
      if (updates.events) {
        updateData.events = updates.events.map(e => e.value);
      }
      if (updates.headers) {
        updateData.headers = updates.headers;
      }
      if (updates.timeout !== undefined) {
        updateData.timeout = updates.timeout;
      }
      if (updates.maxRetries !== undefined) {
        updateData.maxRetries = updates.maxRetries;
      }
      if (updates.retryDelay !== undefined) {
        updateData.retryDelay = updates.retryDelay;
      }

      updateData.updatedAt = new Date();

      const result = await this.prisma.webhook.updateMany({
        where: {
          id: { in: ids.map(id => id.value) },
        },
        data: updateData,
      });

      this.logger.debug('Bulk updated webhooks', {
        count: result.count,
        updates: Object.keys(updateData),
      });

      return result.count;
    } catch (error) {
      this.logger.error('Failed to bulk update webhooks', {
        ids: ids.map(id => id.value),
        error: error.message,
      });
      throw error;
    }
  }

  async bulkDelete(ids: WebhookId[]): Promise<number> {
    try {
      const result = await this.prisma.webhook.deleteMany({
        where: {
          id: { in: ids.map(id => id.value) },
        },
      });

      this.logger.debug('Bulk deleted webhooks', {
        count: result.count,
      });

      return result.count;
    } catch (error) {
      this.logger.error('Failed to bulk delete webhooks', {
        ids: ids.map(id => id.value),
        error: error.message,
      });
      throw error;
    }
  }

  private buildWhereClause(filters?: WebhookFilters): any {
    if (!filters) return {};

    const where: any = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId.value;
    }

    if (filters.userId) {
      where.userId = filters.userId.value;
    }

    if (filters.status) {
      where.status = filters.status.value;
    }

    if (filters.events && filters.events.length > 0) {
      where.events = {
        hasSome: filters.events.map(e => e.value),
      };
    }

    if (filters.url) {
      where.url = {
        contains: filters.url,
        mode: 'insensitive',
      };
    }

    if (filters.name) {
      where.name = {
        contains: filters.name,
        mode: 'insensitive',
      };
    }

    if (filters.isHealthy !== undefined) {
      if (filters.isHealthy) {
        where.lastDeliveryStatus = 'success';
      } else {
        where.OR = [
          { lastDeliveryStatus: 'failed' },
          { lastError: { not: null } },
        ];
      }
    }

    if (filters.createdAfter) {
      where.createdAt = { gte: filters.createdAfter };
    }

    if (filters.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    }

    return where;
  }

  private buildOrderBy(options?: WebhookQueryOptions): any {
    if (!options?.sortBy) {
      return { createdAt: 'desc' };
    }

    const sortOrder = options.sortOrder || 'desc';

    switch (options.sortBy) {
      case 'name':
        return { name: sortOrder };
      case 'status':
        return { status: sortOrder };
      case 'lastDeliveryAt':
        return { lastDeliveryAt: sortOrder };
      case 'successCount':
        return { successCount: sortOrder };
      case 'failureCount':
        return { failureCount: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  private toDomain(record: any): WebhookEntity {
    return new WebhookEntity({
      id: WebhookId.fromString(record.id),
      workspaceId: WorkspaceId.fromString(record.workspaceId),
      userId: UserId.fromString(record.userId),
      name: record.name,
      url: WebhookUrl.fromString(record.url),
      secret: record.secret
        ? WebhookSecret.fromString(record.secret)
        : undefined,
      status: WebhookStatus.fromString(record.status),
      events: record.events.map((e: string) => WebhookEvent.fromString(e)),
      headers: record.headers || {},
      httpMethod: record.httpMethod || 'POST',
      contentType: record.contentType || 'application/json',
      signatureHeader: record.signatureHeader,
      signatureAlgorithm: record.signatureAlgorithm || 'sha256',
      timeout: record.timeout || 30000,
      maxRetries: record.maxRetries || 3,
      retryDelay: record.retryDelay || 1000,
      metadata: record.metadata || {},
      successCount: record.successCount || 0,
      failureCount: record.failureCount || 0,
      lastDeliveryAt: record.lastDeliveryAt,
      lastDeliveryStatus: record.lastDeliveryStatus,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toPersistence(webhook: WebhookEntity): any {
    return {
      id: webhook.id.value,
      workspaceId: webhook.workspaceId.value,
      userId: webhook.userId.value,
      name: webhook.name,
      url: webhook.url.value,
      secret: webhook.secret?.value,
      status: webhook.status.value,
      events: webhook.events.map(e => e.value),
      headers: webhook.headers,
      httpMethod: webhook.httpMethod,
      contentType: webhook.contentType,
      signatureHeader: webhook.signatureHeader,
      signatureAlgorithm: webhook.signatureAlgorithm,
      timeout: webhook.timeout,
      maxRetries: webhook.maxRetries,
      retryDelay: webhook.retryDelay,
      metadata: webhook.metadata,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastDeliveryStatus: webhook.lastDeliveryStatus,
      lastError: webhook.lastError,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}
