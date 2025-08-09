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
  gte,
  lte,
} from 'drizzle-orm';
import { BaseDrizzleRepository } from './base-drizzle-repository';
import {
  Webhook,
  WebhookEvent,
  WebhookStatus,
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../../../domain/entities/webhook';
import {
  IWebhookRepository,
  IWebhookDeliveryRepository,
} from '../../../domain/repositories/webhook-repository';
import { ISpecification } from '../../../domain/base/repository.interface';
import {
  webhooks,
  webhookDeliveries,
  webhookStatusEnum,
  webhookDeliveryStatusEnum,
} from '../schema/webhooks';
import { logger } from '../../monitoring/logging-service';

// Drizzle model types
type DrizzleWebhook = typeof webhooks.$inferSelect;
type DrizzleWebhookDelivery = typeof webhookDeliveries.$inferSelect;

export class WebhookRepository
  extends BaseDrizzleRepository<
    Webhook,
    string,
    DrizzleWebhook,
    typeof webhooks
  >
  implements IWebhookRepository
{
  constructor() {
    super(webhooks, 'Webhook');
  }

  protected toDomain(drizzleModel: DrizzleWebhook): Webhook {
    return new Webhook({
      id: drizzleModel.id,
      workspaceId: drizzleModel.workspaceId,
      name: drizzleModel.name,
      url: drizzleModel.url,
      events: (drizzleModel.events as string[]).map(e => e as WebhookEvent),
      headers: (drizzleModel.headers as Record<string, string>) || {},
      secret: drizzleModel.secret || undefined,
      status: drizzleModel.status as WebhookStatus,
      description: drizzleModel.description || undefined,
      retryCount: drizzleModel.retryCount,
      maxRetries: drizzleModel.maxRetries,
      timeout: drizzleModel.timeout,
      lastDeliveryAt: drizzleModel.lastDeliveryAt || undefined,
      lastSuccessAt: drizzleModel.lastSuccessAt || undefined,
      lastFailureAt: drizzleModel.lastFailureAt || undefined,
      failureReason: drizzleModel.failureReason || undefined,
      createdBy: drizzleModel.createdBy,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
    });
  }

  protected toDrizzle(entity: Webhook): Partial<DrizzleWebhook> {
    return {
      id: entity.id,
      workspaceId: entity.workspaceId,
      name: entity.name,
      url: entity.url,
      events: entity.events,
      headers: entity.headers,
      secret: entity.secret,
      status: entity.status,
      description: entity.description,
      retryCount: entity.retryCount,
      maxRetries: entity.maxRetries,
      timeout: entity.timeout,
      lastDeliveryAt: entity.lastDeliveryAt,
      lastSuccessAt: entity.lastSuccessAt,
      lastFailureAt: entity.lastFailureAt,
      failureReason: entity.failureReason,
      createdBy: entity.createdBy,
      updatedAt: new Date(),
    };
  }

  protected buildWhereClause(specification: ISpecification<Webhook>): any {
    return undefined;
  }

  async save(webhook: Webhook): Promise<void> {
    try {
      const data = this.toDrizzle(webhook);
      await this.database
        .insert(webhooks)
        .values(data as any)
        .onConflictDoUpdate({
          target: webhooks.id,
          set: data,
        });
    } catch (error) {
      logger.error('Error saving webhook', {
        webhookId: webhook.id,
        error,
      });
      throw error;
    }
  }

  async findByWorkspaceId(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Webhook[]> {
    try {
      const results = await this.database
        .select()
        .from(webhooks)
        .where(eq(webhooks.workspaceId, workspaceId))
        .orderBy(desc(webhooks.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhooks by workspace ID', {
        workspaceId,
        error,
      });
      throw error;
    }
  }

  async findByStatus(
    status: WebhookStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<Webhook[]> {
    try {
      const results = await this.database
        .select()
        .from(webhooks)
        .where(eq(webhooks.status, status))
        .orderBy(desc(webhooks.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhooks by status', { status, error });
      throw error;
    }
  }

  async findByEvent(
    event: WebhookEvent,
    workspaceId?: string
  ): Promise<Webhook[]> {
    try {
      let whereClause = sql`JSON_CONTAINS(${webhooks.events}, '"${event}"')`;

      if (workspaceId) {
        whereClause = and(whereClause, eq(webhooks.workspaceId, workspaceId));
      }

      const results = await this.database
        .select()
        .from(webhooks)
        .where(whereClause)
        .orderBy(desc(webhooks.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhooks by event', { event, error });
      throw error;
    }
  }

  async findActive(workspaceId?: string): Promise<Webhook[]> {
    try {
      let whereClause = eq(webhooks.status, 'active');

      if (workspaceId) {
        whereClause = and(whereClause, eq(webhooks.workspaceId, workspaceId));
      }

      const results = await this.database
        .select()
        .from(webhooks)
        .where(whereClause)
        .orderBy(desc(webhooks.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding active webhooks', { workspaceId, error });
      throw error;
    }
  }

  async findByCreatedBy(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Webhook[]> {
    try {
      const results = await this.database
        .select()
        .from(webhooks)
        .where(eq(webhooks.createdBy, userId))
        .orderBy(desc(webhooks.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhooks by created by', { userId, error });
      throw error;
    }
  }

  async getWebhookStats(workspaceId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    failed: number;
    byEvent: Record<WebhookEvent, number>;
    averageResponseTime: number;
  }> {
    try {
      let whereClause = undefined;
      if (workspaceId) {
        whereClause = eq(webhooks.workspaceId, workspaceId);
      }

      const results = await this.database
        .select()
        .from(webhooks)
        .where(whereClause);

      const webhookList = results.map(result => this.toDomain(result));

      const stats = {
        total: webhookList.length,
        active: webhookList.filter(w => w.status === 'active').length,
        inactive: webhookList.filter(w => w.status === 'inactive').length,
        failed: webhookList.filter(w => w.status === 'failed').length,
        byEvent: {} as Record<WebhookEvent, number>,
        averageResponseTime: 0,
      };

      // Initialize event counts
      Object.values(WebhookEvent).forEach(event => {
        stats.byEvent[event] = 0;
      });

      // Count events
      webhookList.forEach(webhook => {
        webhook.events.forEach(event => {
          stats.byEvent[event]++;
        });
      });

      return stats;
    } catch (error) {
      logger.error('Error getting webhook stats', { workspaceId, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.delete(webhooks).where(eq(webhooks.id, id));
    } catch (error) {
      logger.error('Error deleting webhook', { id, error });
      throw error;
    }
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<number> {
    try {
      const results = await this.database
        .delete(webhooks)
        .where(eq(webhooks.workspaceId, workspaceId))
        .returning({ id: webhooks.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting webhooks by workspace ID', {
        workspaceId,
        error,
      });
      throw error;
    }
  }
}

export class WebhookDeliveryRepository
  extends BaseDrizzleRepository<
    WebhookDelivery,
    string,
    DrizzleWebhookDelivery,
    typeof webhookDeliveries
  >
  implements IWebhookDeliveryRepository
{
  constructor() {
    super(webhookDeliveries, 'WebhookDelivery');
  }

  protected toDomain(drizzleModel: DrizzleWebhookDelivery): WebhookDelivery {
    return new WebhookDelivery({
      id: drizzleModel.id,
      webhookId: drizzleModel.webhookId,
      event: drizzleModel.event as WebhookEvent,
      payload: (drizzleModel.payload as Record<string, any>) || {},
      headers: (drizzleModel.headers as Record<string, string>) || {},
      status: drizzleModel.status as WebhookDeliveryStatus,
      httpStatus: drizzleModel.httpStatus || undefined,
      responseBody: drizzleModel.responseBody || undefined,
      responseHeaders:
        (drizzleModel.responseHeaders as Record<string, string>) || {},
      duration: drizzleModel.duration || undefined,
      attempt: drizzleModel.attempt,
      maxAttempts: drizzleModel.maxAttempts,
      nextRetryAt: drizzleModel.nextRetryAt || undefined,
      errorMessage: drizzleModel.errorMessage || undefined,
      deliveredAt: drizzleModel.deliveredAt || undefined,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
    });
  }

  protected toDrizzle(
    entity: WebhookDelivery
  ): Partial<DrizzleWebhookDelivery> {
    return {
      id: entity.id,
      webhookId: entity.webhookId,
      event: entity.event,
      payload: entity.payload,
      headers: entity.headers,
      status: entity.status,
      httpStatus: entity.httpStatus,
      responseBody: entity.responseBody,
      responseHeaders: entity.responseHeaders,
      duration: entity.duration,
      attempt: entity.attempt,
      maxAttempts: entity.maxAttempts,
      nextRetryAt: entity.nextRetryAt,
      errorMessage: entity.errorMessage,
      deliveredAt: entity.deliveredAt,
      updatedAt: new Date(),
    };
  }

  protected buildWhereClause(
    specification: ISpecification<WebhookDelivery>
  ): any {
    return undefined;
  }

  async save(delivery: WebhookDelivery): Promise<void> {
    try {
      const data = this.toDrizzle(delivery);
      await this.database
        .insert(webhookDeliveries)
        .values(data as any)
        .onConflictDoUpdate({
          target: webhookDeliveries.id,
          set: data,
        });
    } catch (error) {
      logger.error('Error saving webhook delivery', {
        deliveryId: delivery.id,
        error,
      });
      throw error;
    }
  }

  async findByWebhookId(
    webhookId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    try {
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhook deliveries by webhook ID', {
        webhookId,
        error,
      });
      throw error;
    }
  }

  async findByStatus(
    status: WebhookDeliveryStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    try {
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.status, status))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhook deliveries by status', {
        status,
        error,
      });
      throw error;
    }
  }

  async findPendingRetries(): Promise<WebhookDelivery[]> {
    try {
      const now = new Date();
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.status, 'failed'),
            sql`${webhookDeliveries.attempt} < ${webhookDeliveries.maxAttempts}`,
            or(
              isNull(webhookDeliveries.nextRetryAt),
              lte(webhookDeliveries.nextRetryAt, now)
            )
          )
        )
        .orderBy(asc(webhookDeliveries.nextRetryAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding pending retry webhook deliveries', { error });
      throw error;
    }
  }

  async findByEvent(
    event: WebhookEvent,
    limit: number = 50,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    try {
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.event, event))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhook deliveries by event', {
        event,
        error,
      });
      throw error;
    }
  }

  async getDeliveryStats(
    webhookId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    pending: number;
    averageResponseTime: number;
    successRate: number;
    byStatus: Record<WebhookDeliveryStatus, number>;
  }> {
    try {
      const conditions = [];

      if (webhookId) {
        conditions.push(eq(webhookDeliveries.webhookId, webhookId));
      }
      if (startDate) {
        conditions.push(gte(webhookDeliveries.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(webhookDeliveries.createdAt, endDate));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(whereClause);

      const deliveries = results.map(result => this.toDomain(result));

      const stats = {
        total: deliveries.length,
        successful: deliveries.filter(d => d.status === 'success').length,
        failed: deliveries.filter(d => d.status === 'failed').length,
        pending: deliveries.filter(d => d.status === 'pending').length,
        averageResponseTime: 0,
        successRate: 0,
        byStatus: {} as Record<WebhookDeliveryStatus, number>,
      };

      // Initialize status counts
      Object.values(WebhookDeliveryStatus).forEach(status => {
        stats.byStatus[status] = 0;
      });

      // Calculate statistics
      let totalDuration = 0;
      let durationCount = 0;

      deliveries.forEach(delivery => {
        stats.byStatus[delivery.status]++;
        if (delivery.duration) {
          totalDuration += delivery.duration;
          durationCount++;
        }
      });

      stats.averageResponseTime =
        durationCount > 0 ? totalDuration / durationCount : 0;
      stats.successRate =
        stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting webhook delivery stats', {
        webhookId,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.id, id));
    } catch (error) {
      logger.error('Error deleting webhook delivery', { id, error });
      throw error;
    }
  }

  async deleteByWebhookId(webhookId: string): Promise<number> {
    try {
      const results = await this.database
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .returning({ id: webhookDeliveries.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting webhook deliveries by webhook ID', {
        webhookId,
        error,
      });
      throw error;
    }
  }

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const results = await this.database
        .delete(webhookDeliveries)
        .where(lte(webhookDeliveries.createdAt, date))
        .returning({ id: webhookDeliveries.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting webhook deliveries older than date', {
        date,
        error,
      });
      throw error;
    }
  }
}
