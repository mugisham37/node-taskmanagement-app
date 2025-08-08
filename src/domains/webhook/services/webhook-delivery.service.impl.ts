import { Injectable } from '../decorators/injectable';
import {
  WebhookDeliveryService,
  WebhookPayload,
  DeliveryResult,
  BulkDeliveryResult,
  DeliveryOptions,
} from '../../domain/webhook/services/webhook-delivery.service';
import { WebhookDeliveryEntity } from '../../domain/webhook/entities/webhook-delivery.entity';
import { WebhookEntity } from '../../domain/webhook/entities/webhook.entity';
import { WebhookDeliveryId } from '../../domain/webhook/value-objects/webhook-delivery-id';
import { WebhookId } from '../../domain/webhook/value-objects/webhook-id';
import { WorkspaceId } from '../../domain/task-management/value-objects/workspace-id';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WebhookDeliveryStatus } from '../../domain/webhook/value-objects/webhook-delivery-status';
import { WebhookRepository } from '../../domain/webhook/repositories/webhook.repository';
import { WebhookDeliveryRepository } from '../../domain/webhook/repositories/webhook-delivery.repository';
import { Logger } from '../../infrastructure/logging/logger';
import { DomainEventBus } from '../../../shared/domain/events/domain-event-bus';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class WebhookDeliveryServiceImpl implements WebhookDeliveryService {
  private httpClient: AxiosInstance;

  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly webhookDeliveryRepository: WebhookDeliveryRepository,
    private readonly eventBus: DomainEventBus,
    private readonly logger: Logger
  ) {
    this.httpClient = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 600, // Accept all status codes
    });

    this.setupHttpInterceptors();
  }

  async deliverWebhook(
    webhook: WebhookEntity,
    event: WebhookEvent,
    payload: Record<string, any>,
    options?: DeliveryOptions
  ): Promise<DeliveryResult> {
    try {
      this.logger.info('Delivering webhook', {
        webhookId: webhook.id.value,
        event: event.value,
        workspaceId: webhook.workspaceId.value,
      });

      // Check if webhook can receive this event
      if (!webhook.canReceiveEvent(event)) {
        throw new Error(`Webhook does not subscribe to event: ${event.value}`);
      }

      // Create webhook payload
      const webhookPayload = this.createWebhookPayload(event, payload, {
        webhookId: webhook.id.value,
        workspaceId: webhook.workspaceId.value,
        ...options?.metadata,
      });

      // Create delivery record
      const delivery = WebhookDeliveryEntity.create(
        webhook.id,
        webhook.workspaceId,
        event,
        webhookPayload,
        options?.maxRetries || webhook.maxRetries,
        options?.metadata || {}
      );

      // Save delivery record
      await this.webhookDeliveryRepository.save(delivery);

      // Publish domain events
      const events = delivery.getUncommittedEvents();
      for (const domainEvent of events) {
        await this.eventBus.publish(domainEvent);
      }
      delivery.markEventsAsCommitted();

      // Schedule delivery if requested
      if (options?.scheduledFor && options.scheduledFor > new Date()) {
        this.logger.info('Webhook delivery scheduled', {
          deliveryId: delivery.id.value,
          scheduledFor: options.scheduledFor,
        });

        return {
          success: true,
          deliveryId: delivery.id,
          willRetry: false,
          nextRetryAt: options.scheduledFor,
        };
      }

      // Perform immediate delivery
      return await this.performDelivery(webhook, delivery);
    } catch (error) {
      this.logger.error('Failed to deliver webhook', {
        webhookId: webhook.id.value,
        event: event.value,
        error: error.message,
      });

      return {
        success: false,
        deliveryId: WebhookDeliveryId.generate(),
        errorMessage: error.message,
        willRetry: false,
      };
    }
  }

  async deliverToMultipleWebhooks(
    webhooks: WebhookEntity[],
    event: WebhookEvent,
    payload: Record<string, any>,
    options?: DeliveryOptions
  ): Promise<BulkDeliveryResult> {
    try {
      this.logger.info('Delivering to multiple webhooks', {
        webhookCount: webhooks.length,
        event: event.value,
      });

      const deliveryPromises = webhooks.map(webhook =>
        this.deliverWebhook(webhook, event, payload, options)
          .then(result => ({ webhookId: webhook.id, result }))
          .catch(error => ({
            webhookId: webhook.id,
            result: {
              success: false,
              deliveryId: WebhookDeliveryId.generate(),
              errorMessage: error.message,
              willRetry: false,
            } as DeliveryResult,
          }))
      );

      const results = await Promise.all(deliveryPromises);

      const successfulDeliveries = results.filter(r => r.result.success).length;
      const failedDeliveries = results.filter(r => !r.result.success).length;

      return {
        totalWebhooks: webhooks.length,
        successfulDeliveries,
        failedDeliveries,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to deliver to multiple webhooks', {
        webhookCount: webhooks.length,
        event: event.value,
        error: error.message,
      });

      return {
        totalWebhooks: webhooks.length,
        successfulDeliveries: 0,
        failedDeliveries: webhooks.length,
        results: webhooks.map(webhook => ({
          webhookId: webhook.id,
          result: {
            success: false,
            deliveryId: WebhookDeliveryId.generate(),
            errorMessage: error.message,
            willRetry: false,
          },
        })),
      };
    }
  }

  async deliverEventToWorkspace(
    workspaceId: WorkspaceId,
    event: WebhookEvent,
    payload: Record<string, any>,
    options?: DeliveryOptions
  ): Promise<BulkDeliveryResult> {
    try {
      this.logger.info('Delivering event to workspace', {
        workspaceId: workspaceId.value,
        event: event.value,
      });

      // Get active webhooks for this event in the workspace
      const webhooks = await this.webhookRepository.findActiveByEvent(
        event,
        workspaceId
      );

      if (webhooks.length === 0) {
        this.logger.info('No active webhooks found for event', {
          workspaceId: workspaceId.value,
          event: event.value,
        });

        return {
          totalWebhooks: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          results: [],
        };
      }

      return await this.deliverToMultipleWebhooks(
        webhooks,
        event,
        payload,
        options
      );
    } catch (error) {
      this.logger.error('Failed to deliver event to workspace', {
        workspaceId: workspaceId.value,
        event: event.value,
        error: error.message,
      });

      return {
        totalWebhooks: 0,
        successfulDeliveries: 0,
        failedDeliveries: 1,
        results: [],
      };
    }
  }

  async scheduleWebhookDelivery(
    webhook: WebhookEntity,
    event: WebhookEvent,
    payload: Record<string, any>,
    scheduledFor: Date,
    options?: Omit<DeliveryOptions, 'scheduledFor'>
  ): Promise<WebhookDeliveryEntity> {
    try {
      const webhookPayload = this.createWebhookPayload(event, payload, {
        webhookId: webhook.id.value,
        workspaceId: webhook.workspaceId.value,
        ...options?.metadata,
      });

      const delivery = WebhookDeliveryEntity.create(
        webhook.id,
        webhook.workspaceId,
        event,
        webhookPayload,
        options?.maxRetries || webhook.maxRetries,
        { ...options?.metadata, scheduledFor: scheduledFor.toISOString() }
      );

      // Set next retry to the scheduled time
      delivery.scheduleRetry();

      await this.webhookDeliveryRepository.save(delivery);

      this.logger.info('Webhook delivery scheduled', {
        deliveryId: delivery.id.value,
        webhookId: webhook.id.value,
        scheduledFor,
      });

      return delivery;
    } catch (error) {
      this.logger.error('Failed to schedule webhook delivery', {
        webhookId: webhook.id.value,
        scheduledFor,
        error: error.message,
      });
      throw error;
    }
  }

  async retryFailedDelivery(
    deliveryId: WebhookDeliveryId
  ): Promise<DeliveryResult> {
    try {
      const delivery =
        await this.webhookDeliveryRepository.findById(deliveryId);
      if (!delivery) {
        throw new Error(`Delivery not found: ${deliveryId.value}`);
      }

      if (!delivery.canRetry) {
        throw new Error('Delivery cannot be retried');
      }

      const webhook = await this.webhookRepository.findById(delivery.webhookId);
      if (!webhook) {
        throw new Error(`Webhook not found: ${delivery.webhookId.value}`);
      }

      this.logger.info('Retrying failed delivery', {
        deliveryId: deliveryId.value,
        webhookId: webhook.id.value,
        attemptCount: delivery.attemptCount,
      });

      return await this.performDelivery(webhook, delivery);
    } catch (error) {
      this.logger.error('Failed to retry delivery', {
        deliveryId: deliveryId.value,
        error: error.message,
      });

      return {
        success: false,
        deliveryId,
        errorMessage: error.message,
        willRetry: false,
      };
    }
  }

  async processRetryQueue(batchSize: number = 50): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    try {
      this.logger.info('Processing retry queue', { batchSize });

      const pendingDeliveries =
        await this.webhookDeliveryRepository.findPendingDeliveries(
          batchSize,
          new Date()
        );

      if (pendingDeliveries.length === 0) {
        return { processed: 0, successful: 0, failed: 0 };
      }

      let successful = 0;
      let failed = 0;

      for (const delivery of pendingDeliveries) {
        try {
          const webhook = await this.webhookRepository.findById(
            delivery.webhookId
          );
          if (!webhook) {
            delivery.markAsFailed('Webhook not found');
            await this.webhookDeliveryRepository.save(delivery);
            failed++;
            continue;
          }

          const result = await this.performDelivery(webhook, delivery);
          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          this.logger.error('Failed to process delivery in retry queue', {
            deliveryId: delivery.id.value,
            error: error.message,
          });
          failed++;
        }
      }

      this.logger.info('Retry queue processed', {
        processed: pendingDeliveries.length,
        successful,
        failed,
      });

      return {
        processed: pendingDeliveries.length,
        successful,
        failed,
      };
    } catch (error) {
      this.logger.error('Failed to process retry queue', {
        error: error.message,
      });

      return { processed: 0, successful: 0, failed: 0 };
    }
  }

  async getDelivery(
    deliveryId: WebhookDeliveryId
  ): Promise<WebhookDeliveryEntity | null> {
    try {
      return await this.webhookDeliveryRepository.findById(deliveryId);
    } catch (error) {
      this.logger.error('Failed to get delivery', {
        deliveryId: deliveryId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async getDeliveriesByWebhook(
    webhookId: WebhookId,
    options?: {
      status?: WebhookDeliveryStatus;
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'deliveredAt' | 'attemptCount';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    deliveries: WebhookDeliveryEntity[];
    total: number;
  }> {
    try {
      const queryOptions = {
        page: options?.offset
          ? Math.floor(options.offset / (options.limit || 20)) + 1
          : 1,
        limit: options?.limit || 20,
        status: options?.status,
        sortBy: options?.sortBy || 'createdAt',
        sortOrder: options?.sortOrder || 'desc',
      };

      const result = await this.webhookDeliveryRepository.findByWebhook(
        webhookId,
        queryOptions
      );

      return {
        deliveries: result.deliveries,
        total: result.total,
      };
    } catch (error) {
      this.logger.error('Failed to get deliveries by webhook', {
        webhookId: webhookId.value,
        error: error.message,
      });
      throw error;
    }
  }

  async getDeliveryStats(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    deliveriesByStatus: Record<string, number>;
    deliveriesByEvent: Record<string, number>;
    deliveriesByHour: Array<{
      hour: string;
      count: number;
      successCount: number;
      failureCount: number;
    }>;
  }> {
    try {
      return await this.webhookDeliveryRepository.getStats(
        webhookId,
        workspaceId,
        dateRange
      );
    } catch (error) {
      this.logger.error('Failed to get delivery stats', {
        webhookId: webhookId?.value,
        workspaceId: workspaceId?.value,
        error: error.message,
      });
      throw error;
    }
  }

  createWebhookPayload(
    event: WebhookEvent,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): WebhookPayload {
    return {
      id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        version: '1.0',
        source: 'unified-enterprise-platform',
        deliveryAttempt: 1,
        ...metadata,
      },
    };
  }

  validatePayload(payload: WebhookPayload): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!payload.id) {
      errors.push('Payload ID is required');
    }

    if (!payload.event) {
      errors.push('Event is required');
    }

    if (!payload.timestamp) {
      errors.push('Timestamp is required');
    }

    if (!payload.data) {
      errors.push('Data is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async performDelivery(
    webhook: WebhookEntity,
    delivery: WebhookDeliveryEntity
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Prepare request configuration
      const requestConfig: AxiosRequestConfig = {
        method: webhook.httpMethod,
        url: webhook.url.value,
        headers: {
          'Content-Type': webhook.contentType,
          'User-Agent': 'Unified-Enterprise-Platform-Webhook/1.0',
          ...webhook.headers,
        },
        timeout: webhook.timeout,
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        const payloadString = JSON.stringify(delivery.payload);
        const signature = crypto
          .createHmac(webhook.signatureAlgorithm, webhook.secret.value)
          .update(payloadString)
          .digest('hex');

        const signatureHeader =
          webhook.signatureHeader || 'X-Webhook-Signature';
        requestConfig.headers![signatureHeader] =
          `${webhook.signatureAlgorithm}=${signature}`;
      }

      // Prepare request data
      if (webhook.contentType === 'application/json') {
        requestConfig.data = delivery.payload;
      } else {
        // URL-encoded form data
        const formData = new URLSearchParams();
        formData.append('payload', JSON.stringify(delivery.payload));
        requestConfig.data = formData.toString();
      }

      this.logger.debug('Sending webhook request', {
        deliveryId: delivery.id.value,
        webhookId: webhook.id.value,
        url: webhook.url.value,
        method: webhook.httpMethod,
        attempt: delivery.attemptCount + 1,
      });

      // Make the HTTP request
      const response = await this.httpClient.request(requestConfig);
      const duration = Date.now() - startTime;

      // Check if response indicates success
      const isSuccess = response.status >= 200 && response.status < 300;

      if (isSuccess) {
        // Mark delivery as successful
        delivery.markAsDelivered(
          response.status,
          this.truncateResponseBody(response.data),
          response.headers,
          duration
        );

        // Update webhook statistics
        webhook.recordDeliverySuccess();
      } else {
        // Mark delivery as failed
        delivery.markAsFailed(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.truncateResponseBody(response.data),
          response.headers,
          duration
        );

        // Update webhook statistics
        webhook.recordDeliveryFailure(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Save updates
      await Promise.all([
        this.webhookDeliveryRepository.save(delivery),
        this.webhookRepository.save(webhook),
      ]);

      // Publish domain events
      const events = delivery.getUncommittedEvents();
      for (const event of events) {
        await this.eventBus.publish(event);
      }
      delivery.markEventsAsCommitted();

      this.logger.info('Webhook delivery completed', {
        deliveryId: delivery.id.value,
        webhookId: webhook.id.value,
        success: isSuccess,
        statusCode: response.status,
        duration,
      });

      return {
        success: isSuccess,
        deliveryId: delivery.id,
        httpStatusCode: response.status,
        responseBody: this.truncateResponseBody(response.data),
        responseHeaders: response.headers,
        duration,
        willRetry: !isSuccess && delivery.canRetry,
        nextRetryAt: delivery.nextRetryAt,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message;

      // Mark delivery as failed
      delivery.markAsFailed(
        errorMessage,
        error.response?.status,
        error.response?.data
          ? this.truncateResponseBody(error.response.data)
          : undefined,
        error.response?.headers,
        duration
      );

      // Update webhook statistics
      webhook.recordDeliveryFailure(errorMessage);

      // Save updates
      await Promise.all([
        this.webhookDeliveryRepository.save(delivery),
        this.webhookRepository.save(webhook),
      ]);

      // Publish domain events
      const events = delivery.getUncommittedEvents();
      for (const event of events) {
        await this.eventBus.publish(event);
      }
      delivery.markEventsAsCommitted();

      this.logger.error('Webhook delivery failed', {
        deliveryId: delivery.id.value,
        webhookId: webhook.id.value,
        error: errorMessage,
        statusCode: error.response?.status,
        duration,
        willRetry: delivery.canRetry,
      });

      return {
        success: false,
        deliveryId: delivery.id,
        httpStatusCode: error.response?.status,
        errorMessage,
        duration,
        willRetry: delivery.canRetry,
        nextRetryAt: delivery.nextRetryAt,
      };
    }
  }

  private truncateResponseBody(data: any): string {
    if (!data) return '';

    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return str.length > 1000 ? str.substring(0, 1000) + '...' : str;
  }

  private setupHttpInterceptors(): void {
    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      config => {
        this.logger.debug('Webhook HTTP request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          timeout: config.timeout,
        });
        return config;
      },
      error => {
        this.logger.error('Webhook HTTP request error', {
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.httpClient.interceptors.response.use(
      response => {
        this.logger.debug('Webhook HTTP response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          responseTime: response.headers['x-response-time'],
        });
        return response;
      },
      error => {
        this.logger.debug('Webhook HTTP response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }
}
