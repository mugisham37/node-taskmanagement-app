import { Logger } from '../monitoring/logging-service';
import { JobHandler } from './job-types';
import { CircuitBreaker } from '../external-services/circuit-breaker';

export interface WebhookDeliveryJobPayload {
  type:
    | 'process_pending'
    | 'process_retries'
    | 'process_scheduled'
    | 'deliver_specific';
  webhookDeliveryId?: string;
  batchSize?: number;
  maxProcessingTime?: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'cancelled';
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  lastError?: string;
  responseStatus?: number;
  responseBody?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryResult {
  success: boolean;
  status: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  deliveryTime: number;
  error?: string;
}

export class WebhookDeliveryJobHandler implements JobHandler {
  name = 'webhook-delivery-job';
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(
    private logger: Logger,
    private webhookService: any, // Will be injected
    private httpClient: any // Will be injected
  ) {}

  /**
   * Execute webhook delivery job
   */
  async execute(payload: WebhookDeliveryJobPayload): Promise<any> {
    this.logger.info('Processing webhook delivery job', {
      type: payload.type,
      webhookDeliveryId: payload.webhookDeliveryId,
      batchSize: payload.batchSize,
    });

    switch (payload.type) {
      case 'process_pending':
        return await this.processPendingDeliveries(payload.batchSize || 50);
      case 'process_retries':
        return await this.processRetryQueue(payload.batchSize || 50);
      case 'process_scheduled':
        return await this.processScheduledDeliveries(payload.batchSize || 50);
      case 'deliver_specific':
        if (!payload.webhookDeliveryId) {
          throw new Error(
            'webhookDeliveryId is required for deliver_specific type'
          );
        }
        return await this.deliverSpecificWebhook(payload.webhookDeliveryId);
      default:
        throw new Error(`Unknown webhook delivery job type: ${payload.type}`);
    }
  }

  /**
   * Validate webhook delivery job payload
   */
  validate(payload: WebhookDeliveryJobPayload): boolean {
    if (!payload.type) {
      return false;
    }

    const validTypes = [
      'process_pending',
      'process_retries',
      'process_scheduled',
      'deliver_specific',
    ];
    if (!validTypes.includes(payload.type)) {
      return false;
    }

    if (payload.type === 'deliver_specific' && !payload.webhookDeliveryId) {
      return false;
    }

    return true;
  }

  /**
   * Handle successful webhook delivery processing
   */
  async onSuccess(result: any): Promise<void> {
    this.logger.info('Webhook delivery job completed successfully', {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
    });
  }

  /**
   * Handle webhook delivery processing failure
   */
  async onFailure(error: Error): Promise<void> {
    this.logger.error('Webhook delivery job failed', {
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Handle webhook delivery job retry
   */
  async onRetry(attempt: number): Promise<void> {
    this.logger.warn('Retrying webhook delivery job', {
      attempt,
      maxRetries: 3,
    });
  }

  /**
   * Process pending webhook deliveries
   */
  private async processPendingDeliveries(batchSize: number): Promise<any> {
    const startTime = Date.now();
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing pending webhook deliveries', { batchSize });

      const pendingDeliveries = await this.getPendingDeliveries(batchSize);

      for (const delivery of pendingDeliveries) {
        try {
          const result = await this.deliverWebhook(delivery);

          if (result.success) {
            await this.markDeliveryAsDelivered(delivery.id, result);
            successful++;
          } else {
            await this.handleDeliveryFailure(
              delivery,
              result.error || 'Unknown error'
            );
            failed++;
          }

          processed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Delivery ${delivery.id}: ${errorMessage}`);

          await this.handleDeliveryFailure(delivery, errorMessage);
          failed++;
          processed++;

          this.logger.error('Failed to process webhook delivery', {
            deliveryId: delivery.id,
            webhookId: delivery.webhookId,
            error: errorMessage,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'process_pending',
        processed,
        successful,
        failed,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing pending webhook deliveries', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process webhook retry queue
   */
  private async processRetryQueue(batchSize: number): Promise<any> {
    const startTime = Date.now();
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing webhook retry queue', { batchSize });

      const retryDeliveries = await this.getRetryDeliveries(batchSize);

      for (const delivery of retryDeliveries) {
        try {
          // Check if retry is due
          if (delivery.nextAttemptAt && delivery.nextAttemptAt > new Date()) {
            continue; // Not ready for retry yet
          }

          const result = await this.deliverWebhook(delivery);

          if (result.success) {
            await this.markDeliveryAsDelivered(delivery.id, result);
            successful++;
          } else {
            await this.handleDeliveryFailure(
              delivery,
              result.error || 'Unknown error'
            );
            failed++;
          }

          processed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Delivery ${delivery.id}: ${errorMessage}`);

          await this.handleDeliveryFailure(delivery, errorMessage);
          failed++;
          processed++;
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'process_retries',
        processed,
        successful,
        failed,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing webhook retry queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process scheduled webhook deliveries
   */
  private async processScheduledDeliveries(batchSize: number): Promise<any> {
    const startTime = Date.now();
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing scheduled webhook deliveries', {
        batchSize,
      });

      const scheduledDeliveries = await this.getScheduledDeliveries(batchSize);

      for (const delivery of scheduledDeliveries) {
        try {
          const result = await this.deliverWebhook(delivery);

          if (result.success) {
            await this.markDeliveryAsDelivered(delivery.id, result);
            successful++;
          } else {
            await this.handleDeliveryFailure(
              delivery,
              result.error || 'Unknown error'
            );
            failed++;
          }

          processed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Delivery ${delivery.id}: ${errorMessage}`);

          await this.handleDeliveryFailure(delivery, errorMessage);
          failed++;
          processed++;
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'process_scheduled',
        processed,
        successful,
        failed,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing scheduled webhook deliveries', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Deliver a specific webhook
   */
  private async deliverSpecificWebhook(deliveryId: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.debug('Delivering specific webhook', { deliveryId });

      const delivery = await this.getWebhookDelivery(deliveryId);
      if (!delivery) {
        throw new Error(`Webhook delivery not found: ${deliveryId}`);
      }

      const result = await this.deliverWebhook(delivery);

      if (result.success) {
        await this.markDeliveryAsDelivered(delivery.id, result);
      } else {
        await this.handleDeliveryFailure(
          delivery,
          result.error || 'Unknown error'
        );
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'deliver_specific',
        deliveryId,
        processed: 1,
        successful: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error delivering specific webhook', {
        deliveryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Deliver a webhook to its endpoint
   */
  private async deliverWebhook(
    delivery: WebhookDelivery
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      // Update delivery status to processing
      await this.updateDeliveryStatus(delivery.id, 'processing');

      // Get or create circuit breaker for this webhook endpoint
      const circuitBreaker = this.getCircuitBreaker(delivery.url);

      // Execute delivery with circuit breaker protection
      const result = await circuitBreaker.execute(async () => {
        return await this.makeHttpRequest(delivery);
      });

      const deliveryTime = Date.now() - startTime;

      this.logger.debug('Webhook delivered successfully', {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        url: delivery.url,
        status: result.status,
        deliveryTime,
      });

      return {
        success: true,
        status: result.status,
        responseBody: result.responseBody,
        responseHeaders: result.responseHeaders,
        deliveryTime,
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Webhook delivery failed', {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        url: delivery.url,
        error: errorMessage,
        deliveryTime,
        attemptCount: delivery.attemptCount,
      });

      return {
        success: false,
        status: 0,
        responseBody: '',
        responseHeaders: {},
        deliveryTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Make HTTP request to webhook endpoint
   */
  private async makeHttpRequest(delivery: WebhookDelivery): Promise<{
    status: number;
    responseBody: string;
    responseHeaders: Record<string, string>;
  }> {
    const requestConfig = {
      method: delivery.method,
      url: delivery.url,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webhook-Delivery-Service/1.0',
        ...delivery.headers,
      },
      data: delivery.payload,
      timeout: 30000, // 30 seconds
      validateStatus: (status: number) => status < 500, // Don't throw for 4xx errors
    };

    const response = await this.httpClient.request(requestConfig);

    return {
      status: response.status,
      responseBody:
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data),
      responseHeaders: response.headers || {},
    };
  }

  /**
   * Mark delivery as successfully delivered
   */
  private async markDeliveryAsDelivered(
    deliveryId: string,
    result: WebhookDeliveryResult
  ): Promise<void> {
    await this.webhookService.updateDelivery(deliveryId, {
      status: 'delivered',
      deliveredAt: new Date(),
      lastAttemptAt: new Date(),
      responseStatus: result.status,
      responseBody: result.responseBody,
      lastError: null,
    });
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(
    delivery: WebhookDelivery,
    error: string
  ): Promise<void> {
    const attemptCount = delivery.attemptCount + 1;
    const now = new Date();

    // Check if we should retry
    if (attemptCount < delivery.maxAttempts) {
      // Calculate next retry time with exponential backoff
      const retryDelay = this.calculateRetryDelay(attemptCount);
      const nextAttemptAt = new Date(now.getTime() + retryDelay);

      await this.webhookService.updateDelivery(delivery.id, {
        status: 'pending',
        attemptCount,
        lastAttemptAt: now,
        nextAttemptAt,
        lastError: error,
      });

      this.logger.info('Webhook delivery scheduled for retry', {
        deliveryId: delivery.id,
        attemptCount,
        nextAttemptAt,
        retryDelay,
      });
    } else {
      // Max attempts reached, mark as failed
      await this.webhookService.updateDelivery(delivery.id, {
        status: 'failed',
        attemptCount,
        lastAttemptAt: now,
        lastError: error,
      });

      this.logger.warn('Webhook delivery failed permanently', {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        attemptCount,
        maxAttempts: delivery.maxAttempts,
        error,
      });
    }
  }

  /**
   * Update delivery status
   */
  private async updateDeliveryStatus(
    deliveryId: string,
    status: WebhookDelivery['status']
  ): Promise<void> {
    await this.webhookService.updateDelivery(deliveryId, {
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptCount: number): number {
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes

    return Math.min(baseDelay * Math.pow(2, attemptCount - 1), maxDelay);
  }

  /**
   * Get or create circuit breaker for webhook endpoint
   */
  private getCircuitBreaker(url: string): CircuitBreaker {
    const host = new URL(url).hostname;
    let breaker = this.circuitBreakers.get(host);

    if (!breaker) {
      breaker = new CircuitBreaker(`webhook-${host}`, {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        expectedErrors: ['TimeoutError', 'NetworkError'],
      });

      this.circuitBreakers.set(host, breaker);

      this.logger.debug('Created circuit breaker for webhook endpoint', {
        host,
        failureThreshold: 5,
        recoveryTimeout: 60000,
      });
    }

    return breaker;
  }

  /**
   * Get pending webhook deliveries
   */
  private async getPendingDeliveries(
    limit: number
  ): Promise<WebhookDelivery[]> {
    // This would be implemented to fetch from database
    // For now, return empty array
    return [];
  }

  /**
   * Get retry webhook deliveries
   */
  private async getRetryDeliveries(limit: number): Promise<WebhookDelivery[]> {
    // This would be implemented to fetch from database
    // For now, return empty array
    return [];
  }

  /**
   * Get scheduled webhook deliveries
   */
  private async getScheduledDeliveries(
    limit: number
  ): Promise<WebhookDelivery[]> {
    // This would be implemented to fetch from database
    // For now, return empty array
    return [];
  }

  /**
   * Get specific webhook delivery
   */
  private async getWebhookDelivery(
    deliveryId: string
  ): Promise<WebhookDelivery | null> {
    // This would be implemented to fetch from database
    // For now, return null
    return null;
  }
}
