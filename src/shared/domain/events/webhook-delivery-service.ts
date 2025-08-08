import { IntegrationEvent, EventDeliveryOptions } from './integration-event';
import { logger } from '../../../infrastructure/logging/logger';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  eventTypes: string[];
  isActive: boolean;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  headers?: Record<string, string>;
  workspaceId?: string;
  userId?: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  url: string;
  payload: string;
  signature: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

export interface WebhookMetrics {
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  totalRetrying: number;
  averageDeliveryTime: number;
  endpointCount: number;
}

export class WebhookDeliveryService {
  private endpoints = new Map<string, WebhookEndpoint>();
  private deliveries = new Map<string, WebhookDelivery>();
  private retryQueue: WebhookDelivery[] = [];
  private isProcessingRetries = false;
  private metrics: WebhookMetrics = {
    totalDelivered: 0,
    totalFailed: 0,
    totalPending: 0,
    totalRetrying: 0,
    averageDeliveryTime: 0,
    endpointCount: 0,
  };
  private deliveryTimes: number[] = [];
  private nextDeliveryId = 1;

  constructor() {
    this.startRetryProcessor();
  }

  async deliverEvent(
    event: IntegrationEvent,
    options?: EventDeliveryOptions
  ): Promise<void> {
    const matchingEndpoints = this.findMatchingEndpoints(event);

    if (matchingEndpoints.length === 0) {
      logger.debug('No webhook endpoints found for event', {
        eventId: event.eventId,
        eventName: event.eventName,
        routingKey: event.getRoutingKey(),
      });
      return;
    }

    logger.info('Delivering event to webhook endpoints', {
      eventId: event.eventId,
      eventName: event.eventName,
      endpointCount: matchingEndpoints.length,
    });

    // Create deliveries for all matching endpoints
    const deliveryPromises = matchingEndpoints.map(endpoint =>
      this.createAndExecuteDelivery(endpoint, event, options)
    );

    await Promise.allSettled(deliveryPromises);
  }

  async registerEndpoint(
    endpoint: Omit<WebhookEndpoint, 'id'>
  ): Promise<string> {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const webhookEndpoint: WebhookEndpoint = {
      ...endpoint,
      id,
    };

    this.endpoints.set(id, webhookEndpoint);
    this.metrics.endpointCount = this.endpoints.size;

    logger.info('Webhook endpoint registered', {
      endpointId: id,
      url: endpoint.url,
      eventTypes: endpoint.eventTypes,
    });

    return id;
  }

  async updateEndpoint(
    id: string,
    updates: Partial<WebhookEndpoint>
  ): Promise<void> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    const updatedEndpoint = { ...endpoint, ...updates, id };
    this.endpoints.set(id, updatedEndpoint);

    logger.info('Webhook endpoint updated', {
      endpointId: id,
      updates: Object.keys(updates),
    });
  }

  async deleteEndpoint(id: string): Promise<void> {
    const deleted = this.endpoints.delete(id);
    if (!deleted) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    this.metrics.endpointCount = this.endpoints.size;

    logger.info('Webhook endpoint deleted', {
      endpointId: id,
    });
  }

  getEndpoint(id: string): WebhookEndpoint | null {
    return this.endpoints.get(id) || null;
  }

  getAllEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getDelivery(id: string): WebhookDelivery | null {
    return this.deliveries.get(id) || null;
  }

  getDeliveriesForEndpoint(endpointId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(delivery => delivery.endpointId === endpointId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getMetrics(): WebhookMetrics {
    const pending = Array.from(this.deliveries.values()).filter(
      d => d.status === 'pending'
    ).length;

    const retrying = Array.from(this.deliveries.values()).filter(
      d => d.status === 'retrying'
    ).length;

    return {
      ...this.metrics,
      totalPending: pending,
      totalRetrying: retrying,
    };
  }

  private findMatchingEndpoints(event: IntegrationEvent): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(endpoint => {
      // Check if endpoint is active
      if (!endpoint.isActive) {
        return false;
      }

      // Check if event type matches
      if (
        !endpoint.eventTypes.includes(event.eventName) &&
        !endpoint.eventTypes.includes('*')
      ) {
        return false;
      }

      // Check workspace/user filtering if applicable
      if (
        endpoint.workspaceId &&
        event.source.workspaceId !== endpoint.workspaceId
      ) {
        return false;
      }

      if (endpoint.userId && event.source.userId !== endpoint.userId) {
        return false;
      }

      return true;
    });
  }

  private async createAndExecuteDelivery(
    endpoint: WebhookEndpoint,
    event: IntegrationEvent,
    options?: EventDeliveryOptions
  ): Promise<void> {
    const deliveryId = this.nextDeliveryId.toString();
    this.nextDeliveryId++;

    const payload = event.serialize();
    const signature = this.generateSignature(payload, endpoint.secret);

    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      eventId: event.eventId,
      url: endpoint.url,
      payload,
      signature,
      status: 'pending',
      attempts: 0,
      maxAttempts: options?.retryAttempts || endpoint.retryAttempts,
      createdAt: new Date(),
    };

    this.deliveries.set(deliveryId, delivery);

    await this.executeDelivery(delivery, endpoint, options);
  }

  private async executeDelivery(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    options?: EventDeliveryOptions
  ): Promise<void> {
    const startTime = Date.now();
    delivery.attempts++;
    delivery.lastAttemptAt = new Date();

    try {
      const timeout = options?.timeout || endpoint.timeout || 30000;
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': delivery.signature,
        'X-Webhook-Event': delivery.eventId,
        'X-Webhook-Delivery': delivery.id,
        ...endpoint.headers,
      };

      logger.debug('Executing webhook delivery', {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: endpoint.url,
        attempt: delivery.attempts,
      });

      // Simulate HTTP request (in real implementation, use fetch or axios)
      const response = await this.makeHttpRequest(endpoint.url, {
        method: 'POST',
        headers,
        body: delivery.payload,
        timeout,
      });

      delivery.responseStatus = response.status;
      delivery.responseBody = response.body;

      if (response.status >= 200 && response.status < 300) {
        // Success
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        this.metrics.totalDelivered++;

        const deliveryTime = Date.now() - startTime;
        this.deliveryTimes.push(deliveryTime);

        if (this.deliveryTimes.length > 100) {
          this.deliveryTimes.shift();
        }

        this.metrics.averageDeliveryTime =
          this.deliveryTimes.reduce((sum, time) => sum + time, 0) /
          this.deliveryTimes.length;

        logger.info('Webhook delivered successfully', {
          deliveryId: delivery.id,
          endpointId: endpoint.id,
          responseStatus: response.status,
          deliveryTime,
        });
      } else {
        // HTTP error - retry if attempts remaining
        throw new Error(`HTTP ${response.status}: ${response.body}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      delivery.error = errorMessage;

      logger.warn('Webhook delivery failed', {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        attempt: delivery.attempts,
        maxAttempts: delivery.maxAttempts,
        error: errorMessage,
      });

      if (delivery.attempts < delivery.maxAttempts) {
        // Schedule retry
        delivery.status = 'retrying';
        const retryDelay = options?.retryDelay || endpoint.retryDelay || 5000;
        delivery.nextRetryAt = new Date(
          Date.now() + retryDelay * Math.pow(2, delivery.attempts - 1)
        );

        this.retryQueue.push(delivery);

        logger.debug('Webhook delivery scheduled for retry', {
          deliveryId: delivery.id,
          nextRetryAt: delivery.nextRetryAt,
        });
      } else {
        // Max attempts reached - mark as failed
        delivery.status = 'failed';
        this.metrics.totalFailed++;

        logger.error('Webhook delivery failed permanently', {
          deliveryId: delivery.id,
          endpointId: endpoint.id,
          attempts: delivery.attempts,
          error: errorMessage,
        });
      }
    }
  }

  private async makeHttpRequest(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
      timeout: number;
    }
  ): Promise<{ status: number; body: string }> {
    // This is a mock implementation
    // In a real implementation, you would use fetch, axios, or similar

    return new Promise(resolve => {
      setTimeout(() => {
        // Simulate successful delivery most of the time
        const success = Math.random() > 0.1; // 90% success rate

        if (success) {
          resolve({
            status: 200,
            body: 'OK',
          });
        } else {
          resolve({
            status: 500,
            body: 'Internal Server Error',
          });
        }
      }, Math.random() * 1000); // Random delay up to 1 second
    });
  }

  private generateSignature(payload: string, secret: string): string {
    // In a real implementation, use HMAC-SHA256
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private startRetryProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingRetries || this.retryQueue.length === 0) {
        return;
      }

      this.isProcessingRetries = true;

      try {
        const now = new Date();
        const readyForRetry = this.retryQueue.filter(
          delivery => delivery.nextRetryAt && delivery.nextRetryAt <= now
        );

        for (const delivery of readyForRetry) {
          const endpoint = this.endpoints.get(delivery.endpointId);
          if (endpoint) {
            await this.executeDelivery(delivery, endpoint);
          }

          // Remove from retry queue
          const index = this.retryQueue.indexOf(delivery);
          if (index > -1) {
            this.retryQueue.splice(index, 1);
          }
        }
      } catch (error) {
        logger.error('Error processing webhook retry queue', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.isProcessingRetries = false;
      }
    }, 5000); // Check every 5 seconds
  }

  // Cleanup old deliveries
  cleanup(olderThanDays: number = 30): void {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );

    let cleanedCount = 0;
    for (const [id, delivery] of this.deliveries) {
      if (delivery.createdAt < cutoffDate) {
        this.deliveries.delete(id);
        cleanedCount++;
      }
    }

    logger.info('Cleaned up old webhook deliveries', {
      cleanedCount,
      cutoffDate: cutoffDate.toISOString(),
    });
  }
}
