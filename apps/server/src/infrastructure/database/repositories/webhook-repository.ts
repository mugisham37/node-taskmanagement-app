import {
  eq,
  and,
  or,
  desc,
  asc,
  sql,
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
  WebhookProps,
  WebhookDeliveryProps,
} from '../../../domain/entities/webhook';
import {
  IWebhookRepository,
  IWebhookDeliveryRepository,
} from '../../../domain/repositories/webhook-repository';
import { ISpecification } from '../../../domain/base/repository.interface';
import {
  webhooks,
  webhookDeliveries,
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
    const props: WebhookProps = {
      id: drizzleModel.id,
      workspaceId: drizzleModel.workspaceId,
      name: drizzleModel.name,
      url: drizzleModel.url,
      events: (drizzleModel.events as string[]).map(e => e as WebhookEvent),
      headers: (drizzleModel.headers as Record<string, string>) || {},
      status: drizzleModel.status as WebhookStatus,
      retryCount: drizzleModel.retryCount,
      maxRetries: drizzleModel.maxRetries,
      timeout: drizzleModel.timeout,
      failureCount: drizzleModel.failureCount,
      maxFailures: drizzleModel.maxFailures,
      createdBy: drizzleModel.createdBy,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
      metadata: (drizzleModel.metadata as Record<string, any>) || {},
    };

    // Add optional properties only if they exist
    if (drizzleModel.secret !== null) {
      props.secret = drizzleModel.secret;
    }
    if (drizzleModel.description !== null) {
      props.description = drizzleModel.description;
    }
    if (drizzleModel.lastDeliveryAt !== null) {
      props.lastDeliveryAt = drizzleModel.lastDeliveryAt;
    }
    if (drizzleModel.lastSuccessAt !== null) {
      props.lastSuccessAt = drizzleModel.lastSuccessAt;
    }
    if (drizzleModel.lastFailureAt !== null) {
      props.lastFailureAt = drizzleModel.lastFailureAt;
    }
    if (drizzleModel.failureReason !== null) {
      props.failureReason = drizzleModel.failureReason;
    }
    if (drizzleModel.lastTriggeredAt !== null) {
      props.lastTriggeredAt = drizzleModel.lastTriggeredAt;
    }

    return new Webhook(props);
  }

  protected toDrizzle(entity: Webhook): Partial<DrizzleWebhook> {
    return {
      id: entity.id,
      workspaceId: entity.workspaceId,
      name: entity.name,
      url: entity.url,
      events: entity.events,
      headers: entity.headers,
      secret: entity.secret || null,
      status: entity.status,
      description: entity.description || null,
      lastDeliveryAt: entity.lastDeliveryAt || null,
      lastSuccessAt: entity.lastSuccessAt || null,
      lastFailureAt: entity.lastFailureAt || null,
      failureReason: entity.failureReason || null,
      retryCount: entity.retryCount,
      maxRetries: entity.maxRetries,
      timeout: entity.timeout,
      lastTriggeredAt: entity.lastTriggeredAt || null,
      failureCount: entity.failureCount,
      maxFailures: entity.maxFailures,
      createdBy: entity.createdBy,
      updatedAt: new Date(),
      metadata: entity.metadata,
    };
  }

  protected buildWhereClause(_specification: ISpecification<Webhook>): any {
    // TODO: Implement specification pattern for complex queries
    return undefined;
  }

  override async save(webhook: Webhook): Promise<Webhook> {
    try {
      const data = this.toDrizzle(webhook);
      const results = await this.database
        .insert(webhooks)
        .values(data as any)
        .onConflictDoUpdate({
          target: webhooks.id,
          set: data,
        })
        .returning();

      if (!results || results.length === 0) {
        throw new Error('Failed to save webhook - no results returned');
      }

      return this.toDomain(results[0]!);
    } catch (error) {
      logger.error('Error saving webhook', {
        webhookId: webhook.id,
        error: error
      } as any);
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
        workspaceId: workspaceId,
        error: error
      } as any);
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
      logger.error('Error finding webhooks by status', { 
        status: status, 
        error: error 
      } as any);
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
        whereClause = and(whereClause, eq(webhooks.workspaceId, workspaceId))!;
      }

      const results = await this.database
        .select()
        .from(webhooks)
        .where(whereClause)
        .orderBy(desc(webhooks.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhooks by event', { 
        event: event, 
        error: error 
      } as any);
      throw error;
    }
  }

  async findActive(workspaceId?: string): Promise<Webhook[]> {
    try {
      let whereClause = eq(webhooks.status, 'active');

      if (workspaceId) {
        whereClause = and(whereClause, eq(webhooks.workspaceId, workspaceId))!;
      }

      const results = await this.database
        .select()
        .from(webhooks)
        .where(whereClause)
        .orderBy(desc(webhooks.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding active webhooks', { 
        workspaceId: workspaceId, 
        error: error 
      } as any);
      throw error;
    }
  }

  async findFailed(): Promise<Webhook[]> {
    try {
      const results = await this.database
        .select()
        .from(webhooks)
        .where(eq(webhooks.status, 'failed'))
        .orderBy(desc(webhooks.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding failed webhooks', { error: error } as any);
      throw error;
    }
  }

  async findByUrl(url: string): Promise<Webhook[]> {
    try {
      const results = await this.database
        .select()
        .from(webhooks)
        .where(eq(webhooks.url, url))
        .orderBy(desc(webhooks.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhooks by URL', { 
        url: url, 
        error: error 
      } as any);
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
      logger.error('Error finding webhooks by created by', { 
        userId: userId, 
        error: error 
      } as any);
      throw error;
    }
  }

  async getWebhookStats(workspaceId?: string): Promise<{
    total: number;
    active: number;
    failed: number;
    suspended: number;
    byEvent: Record<WebhookEvent, number>;
    totalDeliveries: number;
    successRate: number;
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
        failed: webhookList.filter(w => w.status === 'failed').length,
        suspended: webhookList.filter(w => w.status === 'suspended').length,
        byEvent: {} as Record<WebhookEvent, number>,
        totalDeliveries: 0,
        successRate: 0,
      };

      // Initialize event counts
      Object.values(WebhookEvent).forEach((event: WebhookEvent) => {
        stats.byEvent[event] = 0;
      });

      // Count events
      webhookList.forEach(webhook => {
        webhook.events.forEach((event: WebhookEvent) => {
          if (stats.byEvent[event] !== undefined) {
            stats.byEvent[event]++;
          }
        });
      });

      return stats;
    } catch (error) {
      logger.error('Error getting webhook stats', { 
        workspaceId: workspaceId, 
        error: error 
      } as any);
      throw error;
    }
  }

  override async delete(id: string): Promise<void> {
    try {
      await this.database.delete(webhooks).where(eq(webhooks.id, id));
    } catch (error) {
      logger.error('Error deleting webhook', { 
        id: id, 
        error: error 
      } as any);
      throw error;
    }
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    try {
      await this.database
        .delete(webhooks)
        .where(eq(webhooks.workspaceId, workspaceId));
    } catch (error) {
      logger.error('Error deleting webhooks by workspace ID', {
        workspaceId: workspaceId,
        error: error
      } as any);
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
    const props: WebhookDeliveryProps = {
      id: drizzleModel.id,
      webhookId: drizzleModel.webhookId,
      event: drizzleModel.event as WebhookEvent,
      payload: (drizzleModel.payload as Record<string, any>) || {},
      status: drizzleModel.status as WebhookDeliveryStatus,
      attempt: drizzleModel.attempt,
      maxAttempts: drizzleModel.maxAttempts,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
    };

    // Add optional properties only if they exist
    if (drizzleModel.headers !== null) {
      props.headers = drizzleModel.headers as Record<string, string>;
    }
    if (drizzleModel.httpStatus !== null) {
      props.httpStatus = drizzleModel.httpStatus;
    }
    if (drizzleModel.responseBody !== null) {
      props.responseBody = drizzleModel.responseBody;
    }
    if (drizzleModel.responseHeaders !== null) {
      props.responseHeaders = drizzleModel.responseHeaders as Record<string, string>;
    }
    if (drizzleModel.duration !== null) {
      props.duration = drizzleModel.duration;
    }
    if (drizzleModel.nextRetryAt !== null) {
      props.nextRetryAt = drizzleModel.nextRetryAt;
    }
    if (drizzleModel.errorMessage !== null) {
      props.errorMessage = drizzleModel.errorMessage;
    }
    if (drizzleModel.deliveredAt !== null) {
      props.deliveredAt = drizzleModel.deliveredAt;
    }

    return new WebhookDelivery(props);
  }

  protected toDrizzle(
    entity: WebhookDelivery
  ): Partial<DrizzleWebhookDelivery> {
    return {
      id: entity.id,
      webhookId: entity.webhookId,
      event: entity.event,
      payload: entity.payload,
      headers: entity.headers || null,
      status: entity.status,
      httpStatus: entity.httpStatus || null,
      responseBody: entity.responseBody || null,
      responseHeaders: entity.responseHeaders || null,
      duration: entity.duration || null,
      attempt: entity.attempt,
      maxAttempts: entity.maxAttempts,
      nextRetryAt: entity.nextRetryAt || null,
      errorMessage: entity.errorMessage || null,
      deliveredAt: entity.deliveredAt || null,
      updatedAt: new Date(),
    };
  }

  protected buildWhereClause(
    _specification: ISpecification<WebhookDelivery>
  ): any {
    // TODO: Implement specification pattern for complex queries
    return undefined;
  }

  override async save(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    try {
      const data = this.toDrizzle(delivery);
      const results = await this.database
        .insert(webhookDeliveries)
        .values(data as any)
        .onConflictDoUpdate({
          target: webhookDeliveries.id,
          set: data,
        })
        .returning();

      if (!results || results.length === 0) {
        throw new Error('Failed to save webhook delivery - no results returned');
      }

      return this.toDomain(results[0]!);
    } catch (error) {
      logger.error('Error saving webhook delivery', {
        deliveryId: delivery.id,
        error: error
      } as any);
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
        webhookId: webhookId,
        error: error
      } as any);
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
        status: status,
        error: error
      } as any);
      throw error;
    }
  }

  async findPending(): Promise<WebhookDelivery[]> {
    try {
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.status, 'pending'))
        .orderBy(asc(webhookDeliveries.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding pending webhook deliveries', { 
        error: error 
      } as any);
      throw error;
    }
  }

  async findReadyForRetry(): Promise<WebhookDelivery[]> {
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
          )!
        )
        .orderBy(asc(webhookDeliveries.nextRetryAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding ready for retry webhook deliveries', { 
        error: error 
      } as any);
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
        event: event,
        error: error
      } as any);
      throw error;
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 50,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    try {
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            gte(webhookDeliveries.createdAt, startDate),
            lte(webhookDeliveries.createdAt, endDate)
          )!
        )
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding webhook deliveries by date range', {
        startDate: startDate,
        endDate: endDate,
        error: error
      } as any);
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
    retrying: number;
    successRate: number;
    averageAttempts: number;
    byEvent: Record<WebhookEvent, { total: number; successful: number }>;
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
        retrying: deliveries.filter(d => d.status === 'retrying').length,
        successRate: 0,
        averageAttempts: 0,
        byEvent: {} as Record<WebhookEvent, { total: number; successful: number }>,
      };

      // Initialize event stats
      Object.values(WebhookEvent).forEach((event: WebhookEvent) => {
        stats.byEvent[event] = { total: 0, successful: 0 };
      });

      // Calculate statistics
      let totalAttempts = 0;

      deliveries.forEach(delivery => {
        const eventStats = stats.byEvent[delivery.event];
        if (eventStats) {
          eventStats.total++;
          if (delivery.status === 'success') {
            eventStats.successful++;
          }
        }
        totalAttempts += delivery.attempt;
      });

      stats.successRate =
        stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
      stats.averageAttempts =
        stats.total > 0 ? totalAttempts / stats.total : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting webhook delivery stats', {
        webhookId: webhookId,
        startDate: startDate,
        endDate: endDate,
        error: error
      } as any);
      throw error;
    }
  }

  async getRecentDeliveries(
    webhookId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    try {
      const results = await this.database
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding recent webhook deliveries', {
        webhookId: webhookId,
        error: error
      } as any);
      throw error;
    }
  }

  override async delete(id: string): Promise<void> {
    try {
      await this.database
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.id, id));
    } catch (error) {
      logger.error('Error deleting webhook delivery', { 
        id: id, 
        error: error 
      } as any);
      throw error;
    }
  }

  async deleteByWebhookId(webhookId: string): Promise<void> {
    try {
      await this.database
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId));
    } catch (error) {
      logger.error('Error deleting webhook deliveries by webhook ID', {
        webhookId: webhookId,
        error: error
      } as any);
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
        date: date,
        error: error
      } as any);
      throw error;
    }
  }

  async deleteSuccessfulOlderThan(date: Date): Promise<number> {
    try {
      const results = await this.database
        .delete(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.status, 'success'),
            lte(webhookDeliveries.createdAt, date)
          )!
        )
        .returning({ id: webhookDeliveries.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting successful webhook deliveries older than date', {
        date: date,
        error: error
      } as any);
      throw error;
    }
  }
}
