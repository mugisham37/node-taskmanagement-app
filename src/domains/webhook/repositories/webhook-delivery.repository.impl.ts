import { Injectable } from '../../application/decorators/injectable';
import {
  WebhookDeliveryRepository,
  WebhookDeliveryFilters,
  WebhookDeliveryQueryOptions,
  WebhookDeliveryStats,
} from '../../domain/webhook/repositories/webhook-delivery.repository';
import { WebhookDeliveryEntity } from '../../domain/webhook/entities/webhook-delivery.entity';
import { WebhookDeliveryId } from '../../domain/webhook/value-objects/webhook-delivery-id';
import { WebhookId } from '../../domain/webhook/value-objects/webhook-id';
import { WorkspaceId } from '../../domain/task-management/value-objects/workspace-id';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WebhookDeliveryStatus } from '../../domain/webhook/value-objects/webhook-delivery-status';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../logging/logger';

@Injectable()
export class WebhookDeliveryRepositoryImpl
  implements WebhookDeliveryRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {}

  async findById(id: WebhookDeliveryId): Promise<WebhookDeliveryEntity | null> {
    try {
      const record = await this.prisma.webhookDelivery.findUnique({
        where: { id: id.value },
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      this.logger.error('Failed to find webhook delivery by ID', {
        deliveryId: id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async save(delivery: WebhookDeliveryEntity): Promise<void> {
    try {
      const data = this.toPersistence(delivery);

      await this.prisma.webhookDelivery.upsert({
        where: { id: delivery.id.value },
        create: data,
        update: {
          ...data,
          updatedAt: new Date(),
        },
      });

      this.logger.debug('Webhook delivery saved successfully', {
        deliveryId: delivery.id.value,
        webhookId: delivery.webhookId.value,
        status: delivery.status.value,
      });
    } catch (error) {
      this.logger.error('Failed to save webhook delivery', {
        deliveryId: delivery.id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(id: WebhookDeliveryId): Promise<void> {
    try {
      await this.prisma.webhookDelivery.delete({
        where: { id: id.value },
      });

      this.logger.debug('Webhook delivery deleted successfully', {
        deliveryId: id.value,
      });
    } catch (error) {
      this.logger.error('Failed to delete webhook delivery', {
        deliveryId: id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findByWebhook(
    webhookId: WebhookId,
    options?: WebhookDeliveryQueryOptions
  ): Promise<{
    deliveries: WebhookDeliveryEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = { webhookId: webhookId.value };

      if (options?.status) {
        where.status = options.status.value;
      }

      const orderBy = this.buildOrderBy(options);

      const [records, total] = await Promise.all([
        this.prisma.webhookDelivery.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.webhookDelivery.count({ where }),
      ]);

      const deliveries = records.map(record => this.toDomain(record));
      const totalPages = Math.ceil(total / limit);

      return {
        deliveries,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to find webhook deliveries by webhook', {
        webhookId: webhookId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findByWorkspace(
    workspaceId: WorkspaceId,
    options?: WebhookDeliveryQueryOptions
  ): Promise<WebhookDeliveryEntity[]> {
    try {
      const where: any = { workspaceId: workspaceId.value };

      if (options?.status) {
        where.status = options.status.value;
      }

      if (options?.event) {
        where.event = options.event.value;
      }

      const orderBy = this.buildOrderBy(options);

      const records = await this.prisma.webhookDelivery.findMany({
        where,
        orderBy,
        take: options?.limit,
        skip:
          options?.page && options?.limit
            ? (options.page - 1) * options.limit
            : undefined,
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find webhook deliveries by workspace', {
        workspaceId: workspaceId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findPendingDeliveries(
    limit?: number,
    olderThan?: Date
  ): Promise<WebhookDeliveryEntity[]> {
    try {
      const where: any = {
        status: 'PENDING',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      };

      if (olderThan) {
        where.createdAt = { lte: olderThan };
      }

      const records = await this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find pending webhook deliveries', {
        limit,
        olderThan,
        error: error.message,
      });
      throw error;
    }
  }

  async findFailedDeliveries(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]> {
    try {
      const where: any = { status: 'FAILED' };

      if (webhookId) {
        where.webhookId = webhookId.value;
      }

      if (workspaceId) {
        where.workspaceId = workspaceId.value;
      }

      const records = await this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find failed webhook deliveries', {
        webhookId: webhookId?.value,
        workspaceId: workspaceId?.value,
        error: error.message,
      });
      throw error;
    }
  }

  async findScheduledDeliveries(
    scheduledBefore?: Date,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]> {
    try {
      const where: any = {
        status: 'PENDING',
        nextRetryAt: {
          lte: scheduledBefore || new Date(),
        },
      };

      const records = await this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { nextRetryAt: 'asc' },
        take: limit,
      });

      return records.map(record => this.toDomain(record));
    } catch (error) {
      this.logger.error('Failed to find scheduled webhook deliveries', {
        scheduledBefore,
        limit,
        error: error.message,
      });
      throw error;
    }
  }

  async getStats(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<WebhookDeliveryStats> {
    try {
      const where: any = {};

      if (webhookId) {
        where.webhookId = webhookId.value;
      }

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
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        pendingDeliveries,
        avgDuration,
      ] = await Promise.all([
        this.prisma.webhookDelivery.count({ where }),
        this.prisma.webhookDelivery.count({
          where: { ...where, status: 'DELIVERED' },
        }),
        this.prisma.webhookDelivery.count({
          where: { ...where, status: 'FAILED' },
        }),
        this.prisma.webhookDelivery.count({
          where: { ...where, status: 'PENDING' },
        }),
        this.prisma.webhookDelivery.aggregate({
          where: { ...where, duration: { not: null } },
          _avg: { duration: true },
        }),
      ]);

      const successRate =
        totalDeliveries > 0
          ? (successfulDeliveries / totalDeliveries) * 100
          : 0;

      // Get deliveries by status
      const deliveriesByStatus = await this.prisma.webhookDelivery.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      });

      const statusCounts = deliveriesByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get deliveries by event
      const deliveriesByEvent = await this.prisma.webhookDelivery.groupBy({
        by: ['event'],
        where,
        _count: { event: true },
      });

      const eventCounts = deliveriesByEvent.reduce(
        (acc, item) => {
          acc[item.event] = item._count.event;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        pendingDeliveries,
        successRate,
        averageResponseTime: avgDuration._avg.duration || 0,
        deliveriesByStatus: statusCounts,
        deliveriesByEvent: eventCounts,
        deliveriesByHour: [], // Would need more complex query for hourly breakdown
      };
    } catch (error) {
      this.logger.error('Failed to get webhook delivery stats', {
        webhookId: webhookId?.value,
        workspaceId: workspaceId?.value,
        dateRange,
        error: error.message,
      });
      throw error;
    }
  }

  async getDeliveryTrends(
    webhookId: WebhookId,
    dateRange: { from: Date; to: Date },
    granularity: 'hour' | 'day' | 'week'
  ): Promise<
    Array<{
      period: string;
      totalDeliveries: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      averageResponseTime: number;
      successRate: number;
    }>
  > {
    try {
      // This would require more complex SQL queries with date truncation
      // For now, return empty array - would be implemented with raw SQL
      this.logger.warn('Delivery trends not yet implemented', {
        webhookId: webhookId.value,
        dateRange,
        granularity,
      });

      return [];
    } catch (error) {
      this.logger.error('Failed to get delivery trends', {
        webhookId: webhookId.value,
        dateRange,
        granularity,
        error: error.message,
      });
      throw error;
    }
  }

  async getErrorAnalysis(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<
    Array<{
      errorMessage: string;
      count: number;
      percentage: number;
      lastOccurrence: Date;
      httpStatusCodes: number[];
    }>
  > {
    try {
      const where: any = {
        status: 'FAILED',
        errorMessage: { not: null },
      };

      if (webhookId) {
        where.webhookId = webhookId.value;
      }

      if (workspaceId) {
        where.workspaceId = workspaceId.value;
      }

      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        };
      }

      const errorGroups = await this.prisma.webhookDelivery.groupBy({
        by: ['errorMessage'],
        where,
        _count: { errorMessage: true },
        _max: { createdAt: true },
        orderBy: { _count: { errorMessage: 'desc' } },
      });

      const totalErrors = errorGroups.reduce(
        (sum, group) => sum + group._count.errorMessage,
        0
      );

      const analysis = await Promise.all(
        errorGroups.map(async group => {
          // Get HTTP status codes for this error
          const statusCodes = await this.prisma.webhookDelivery.findMany({
            where: {
              ...where,
              errorMessage: group.errorMessage,
              httpStatusCode: { not: null },
            },
            select: { httpStatusCode: true },
            distinct: ['httpStatusCode'],
          });

          return {
            errorMessage: group.errorMessage || 'Unknown error',
            count: group._count.errorMessage,
            percentage: (group._count.errorMessage / totalErrors) * 100,
            lastOccurrence: group._max.createdAt!,
            httpStatusCodes: statusCodes
              .map(s => s.httpStatusCode)
              .filter(Boolean) as number[],
          };
        })
      );

      return analysis;
    } catch (error) {
      this.logger.error('Failed to get error analysis', {
        webhookId: webhookId?.value,
        workspaceId: workspaceId?.value,
        dateRange,
        error: error.message,
      });
      throw error;
    }
  }

  async cleanupOldDeliveries(
    olderThan: Date,
    keepSuccessful: boolean = true
  ): Promise<{ deletedCount: number; freedSpace: number }> {
    try {
      const where: any = {
        createdAt: { lt: olderThan },
      };

      if (keepSuccessful) {
        where.status = { not: 'DELIVERED' };
      }

      const result = await this.prisma.webhookDelivery.deleteMany({
        where,
      });

      this.logger.info('Cleaned up old webhook deliveries', {
        deletedCount: result.count,
        olderThan,
        keepSuccessful,
      });

      return {
        deletedCount: result.count,
        freedSpace: result.count * 1024, // Rough estimate
      };
    } catch (error) {
      this.logger.error('Failed to cleanup old webhook deliveries', {
        olderThan,
        keepSuccessful,
        error: error.message,
      });
      throw error;
    }
  }

  async bulkUpdateStatus(
    ids: WebhookDeliveryId[],
    status: WebhookDeliveryStatus
  ): Promise<number> {
    try {
      const result = await this.prisma.webhookDelivery.updateMany({
        where: {
          id: { in: ids.map(id => id.value) },
        },
        data: {
          status: status.value,
          updatedAt: new Date(),
        },
      });

      this.logger.debug('Bulk updated webhook delivery status', {
        count: result.count,
        status: status.value,
      });

      return result.count;
    } catch (error) {
      this.logger.error('Failed to bulk update webhook delivery status', {
        ids: ids.map(id => id.value),
        status: status.value,
        error: error.message,
      });
      throw error;
    }
  }

  private buildOrderBy(options?: WebhookDeliveryQueryOptions): any {
    if (!options?.sortBy) {
      return { createdAt: 'desc' };
    }

    const sortOrder = options.sortOrder || 'desc';

    switch (options.sortBy) {
      case 'status':
        return { status: sortOrder };
      case 'deliveredAt':
        return { deliveredAt: sortOrder };
      case 'attemptCount':
        return { attemptCount: sortOrder };
      case 'duration':
        return { duration: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  private toDomain(record: any): WebhookDeliveryEntity {
    return new WebhookDeliveryEntity({
      id: WebhookDeliveryId.fromString(record.id),
      webhookId: WebhookId.fromString(record.webhookId),
      workspaceId: WorkspaceId.fromString(record.workspaceId),
      event: WebhookEvent.fromString(record.event),
      payload: record.payload,
      status: WebhookDeliveryStatus.fromString(record.status),
      httpStatusCode: record.httpStatusCode,
      responseBody: record.responseBody,
      responseHeaders: record.responseHeaders,
      errorMessage: record.errorMessage,
      attemptCount: record.attemptCount || 0,
      maxAttempts: record.maxAttempts || 3,
      nextRetryAt: record.nextRetryAt,
      deliveredAt: record.deliveredAt,
      duration: record.duration,
      metadata: record.metadata || {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toPersistence(delivery: WebhookDeliveryEntity): any {
    return {
      id: delivery.id.value,
      webhookId: delivery.webhookId.value,
      workspaceId: delivery.workspaceId.value,
      event: delivery.event.value,
      payload: delivery.payload,
      status: delivery.status.value,
      httpStatusCode: delivery.httpStatusCode,
      responseBody: delivery.responseBody,
      responseHeaders: delivery.responseHeaders,
      errorMessage: delivery.errorMessage,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt,
      deliveredAt: delivery.deliveredAt,
      duration: delivery.duration,
      metadata: delivery.metadata,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }
}
