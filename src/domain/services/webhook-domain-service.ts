import {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookStatus,
} from '../entities/webhook';
import {
  IWebhookRepository,
  IWebhookDeliveryRepository,
} from '../repositories/webhook-repository';

export class WebhookDomainService {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly deliveryRepository: IWebhookDeliveryRepository
  ) {}

  async createWebhook(
    name: string,
    url: string,
    events: WebhookEvent[],
    workspaceId: string,
    createdBy: string,
    options: {
      secret?: string;
      headers?: Record<string, string>;
      timeout?: number;
      maxFailures?: number;
      maxRetries?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Webhook> {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid webhook URL format');
    }

    // Check for duplicate webhooks with same URL in workspace
    const existingWebhooks = await this.webhookRepository.findByUrl(url);
    const duplicateInWorkspace = existingWebhooks.find(
      w => w.workspaceId === workspaceId
    );

    if (duplicateInWorkspace) {
      throw new Error('Webhook with this URL already exists in the workspace');
    }

    const webhook = Webhook.create({
      name,
      url,
      secret: options.secret || Webhook.generateSecret(),
      events,
      status: WebhookStatus.ACTIVE,
      workspaceId,
      createdBy,
      maxFailures: options.maxFailures || 5,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      headers: options.headers || {},
      metadata: options.metadata || {},
    });

    await this.webhookRepository.save(webhook);
    return webhook;
  }

  async triggerWebhook(
    event: WebhookEvent,
    payload: Record<string, any>,
    workspaceId: string
  ): Promise<WebhookDelivery[]> {
    // Find all active webhooks that support this event
    const webhooks = await this.webhookRepository.findByEvent(
      event,
      workspaceId
    );
    const activeWebhooks = webhooks.filter(w => w.canTrigger());

    const deliveries: WebhookDelivery[] = [];

    for (const webhook of activeWebhooks) {
      const delivery = WebhookDelivery.create({
        webhookId: webhook.id,
        event,
        payload: {
          ...payload,
          event,
          timestamp: new Date().toISOString(),
          workspaceId,
        },
        status: 'pending' as any,
        maxAttempts: webhook.maxRetries,
      });

      await this.deliveryRepository.save(delivery);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  async processWebhookDelivery(deliveryId: string): Promise<{
    success: boolean;
    httpStatus?: number;
    responseBody?: string;
    errorMessage?: string;
  }> {
    const delivery = await this.deliveryRepository.findById(deliveryId);
    if (!delivery) {
      throw new Error('Webhook delivery not found');
    }

    const webhook = await this.webhookRepository.findById(delivery.webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    if (!webhook.canTrigger()) {
      delivery.markAsFailed(undefined, 'Webhook is not active or suspended');
      await this.deliveryRepository.save(delivery);
      return { success: false, errorMessage: 'Webhook is not active' };
    }

    try {
      // This would be implemented by the infrastructure layer
      // For now, we'll simulate the HTTP call
      const result = await this.makeHttpRequest(webhook, delivery);

      if (result.success) {
        delivery.markAsSuccess(result.httpStatus!, result.responseBody);
        webhook.recordSuccess();
      } else {
        delivery.markAsFailed(
          result.httpStatus,
          result.errorMessage,
          result.responseBody
        );
        webhook.recordFailure();

        // Schedule retry if possible
        if (delivery.canRetry()) {
          const retryDelay = this.calculateRetryDelay(delivery.attemptCount);
          delivery.scheduleRetry(retryDelay);
        }
      }

      await this.deliveryRepository.save(delivery);
      await this.webhookRepository.save(webhook);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      delivery.markAsFailed(undefined, errorMessage);
      webhook.recordFailure();

      if (delivery.canRetry()) {
        const retryDelay = this.calculateRetryDelay(delivery.attemptCount);
        delivery.scheduleRetry(retryDelay);
      }

      await this.deliveryRepository.save(delivery);
      await this.webhookRepository.save(webhook);

      return { success: false, errorMessage };
    }
  }

  private async makeHttpRequest(
    webhook: Webhook,
    delivery: WebhookDelivery
  ): Promise<{
    success: boolean;
    httpStatus?: number;
    responseBody?: string;
    errorMessage?: string;
  }> {
    // This is a placeholder - actual HTTP implementation would be in infrastructure layer
    // Simulate different outcomes for testing
    const random = Math.random();

    if (random < 0.8) {
      // 80% success rate
      return {
        success: true,
        httpStatus: 200,
        responseBody: JSON.stringify({ received: true }),
      };
    } else if (random < 0.9) {
      // 10% client error
      return {
        success: false,
        httpStatus: 400,
        responseBody: JSON.stringify({ error: 'Bad request' }),
        errorMessage: 'Client error',
      };
    } else {
      // 10% server error
      return {
        success: false,
        httpStatus: 500,
        responseBody: JSON.stringify({ error: 'Internal server error' }),
        errorMessage: 'Server error',
      };
    }
  }

  private calculateRetryDelay(attemptCount: number): number {
    // Exponential backoff: 1min, 2min, 4min, 8min, etc.
    return Math.min(60000 * Math.pow(2, attemptCount - 1), 30 * 60000); // Max 30 minutes
  }

  async processRetries(): Promise<number> {
    const readyForRetry = await this.deliveryRepository.findReadyForRetry();
    let processedCount = 0;

    for (const delivery of readyForRetry) {
      await this.processWebhookDelivery(delivery.id);
      processedCount++;
    }

    return processedCount;
  }

  async getWebhookHealth(webhookId: string): Promise<{
    webhook: Webhook;
    health: ReturnType<Webhook['getHealthStatus']>;
    recentDeliveries: WebhookDelivery[];
    stats: {
      totalDeliveries: number;
      successRate: number;
      averageAttempts: number;
    };
  }> {
    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const health = webhook.getHealthStatus();
    const recentDeliveries = await this.deliveryRepository.getRecentDeliveries(
      webhookId,
      10
    );
    const stats = await this.deliveryRepository.getDeliveryStats(webhookId);

    return {
      webhook,
      health,
      recentDeliveries,
      stats,
    };
  }

  async disableFailedWebhooks(): Promise<number> {
    const failedWebhooks = await this.webhookRepository.findFailed();
    let disabledCount = 0;

    for (const webhook of failedWebhooks) {
      if (webhook.failureCount >= webhook.maxFailures) {
        webhook.suspend();
        await this.webhookRepository.save(webhook);
        disabledCount++;
      }
    }

    return disabledCount;
  }

  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    httpStatus?: number;
    responseTime?: number;
    errorMessage?: string;
  }> {
    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      event: 'webhook.test' as WebhookEvent,
      timestamp: new Date().toISOString(),
      workspaceId: webhook.workspaceId,
      test: true,
    };

    const delivery = WebhookDelivery.create({
      webhookId: webhook.id,
      event: 'webhook.test' as WebhookEvent,
      payload: testPayload,
      status: 'pending' as any,
      maxAttempts: 1,
    });

    const startTime = Date.now();
    const result = await this.processWebhookDelivery(delivery.id);
    const responseTime = Date.now() - startTime;

    return {
      ...result,
      responseTime,
    };
  }

  async cleanupOldDeliveries(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.deliveryRepository.deleteSuccessfulOlderThan(cutoffDate);
  }

  async getWorkspaceWebhookSummary(workspaceId: string): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    failedWebhooks: number;
    totalDeliveries: number;
    successRate: number;
    topEvents: Array<{ event: WebhookEvent; count: number }>;
  }> {
    const stats = await this.webhookRepository.getWebhookStats(workspaceId);
    const deliveryStats = await this.deliveryRepository.getDeliveryStats();

    const topEvents = Object.entries(deliveryStats.byEvent)
      .map(([event, data]) => ({
        event: event as WebhookEvent,
        count: data.total,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalWebhooks: stats.total,
      activeWebhooks: stats.active,
      failedWebhooks: stats.failed,
      totalDeliveries: stats.totalDeliveries,
      successRate: stats.successRate,
      topEvents,
    };
  }
}
