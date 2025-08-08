import { Injectable } from '../../application/decorators/injectable';
import { NotificationEntity } from '../../domain/notification/entities/notification.entity';
import { NotificationChannel } from '../../domain/notification/value-objects/notification-channel';
import {
  DeliveryProvider,
  DeliveryResult,
} from '../../domain/notification/services/notification-delivery.service';
import { Logger } from '../logging/logger';
import { WebhookEntity } from '../../domain/webhook/entities/webhook.entity';
import { WebhookDeliveryEntity } from '../../domain/webhook/entities/webhook-delivery.entity';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WebhookDeliveryService } from '../../domain/webhook/services/webhook-delivery.service';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

export interface WebhookConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxRedirects: number;
  validateSSL: boolean;
  userAgent: string;
  defaultHeaders: Record<string, string>;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret?: string;
  isActive: boolean;
  events: string[];
  headers: Record<string, string>;
  httpMethod: 'POST' | 'PUT' | 'PATCH';
  contentType: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm: 'sha256' | 'sha1' | 'md5';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: 'success' | 'failed';
  failureCount: number;
  successCount: number;
}

export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: {
    notification: {
      id: string;
      type: string;
      title: string;
      message: string;
      priority: string;
      userId: string;
      data: Record<string, any>;
      actionUrl?: string;
      createdAt: string;
    };
    user?: {
      id: string;
      email?: string;
      name?: string;
    };
    workspace?: {
      id: string;
      name: string;
    };
  };
  metadata: Record<string, any>;
}

@Injectable()
export class WebhookDeliveryProvider implements DeliveryProvider {
  public readonly channel = NotificationChannel.WEBHOOK;
  private httpClient: AxiosInstance;
  private config: WebhookConfig;
  private endpoints = new Map<string, WebhookEndpoint>();
  private isHealthy = false;
  private lastHealthCheck = new Date();

  constructor(
    config: Partial<WebhookConfig>,
    private readonly logger: Logger
  ) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRedirects: 5,
      validateSSL: true,
      userAgent: 'Unified-Enterprise-Platform-Webhook/1.0',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'User-Agent': 'Unified-Enterprise-Platform-Webhook/1.0',
      },
      ...config,
    };

    this.httpClient = axios.create({
      timeout: this.config.timeout,
      maxRedirects: this.config.maxRedirects,
      validateStatus: status => status >= 200 && status < 300,
      headers: this.config.defaultHeaders,
    });

    this.setupHttpInterceptors();
  }

  canDeliver(notification: NotificationEntity): boolean {
    // Check if notification has webhook channel
    const hasWebhookChannel = notification.channels.some(channel =>
      channel.equals(NotificationChannel.WEBHOOK)
    );

    if (!hasWebhookChannel) {
      return false;
    }

    // Check if we have active endpoints for this notification type
    const activeEndpoints = Array.from(this.endpoints.values()).filter(
      endpoint =>
        endpoint.isActive && endpoint.events.includes(notification.type.value)
    );

    if (activeEndpoints.length === 0) {
      this.logger.warn(
        'No active webhook endpoints found for notification type',
        {
          notificationId: notification.id.value,
          type: notification.type.value,
        }
      );
      return false;
    }

    return true;
  }

  async deliver(
    notification: NotificationEntity,
    content: { subject: string; body: string }
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Get active endpoints for this notification type
      const activeEndpoints = Array.from(this.endpoints.values()).filter(
        endpoint =>
          endpoint.isActive && endpoint.events.includes(notification.type.value)
      );

      if (activeEndpoints.length === 0) {
        throw new Error('No active webhook endpoints found');
      }

      // Create webhook payload
      const payload = this.createWebhookPayload(notification, content);

      // Send to all active endpoints
      const deliveryPromises = activeEndpoints.map(endpoint =>
        this.sendToEndpoint(endpoint, payload, notification)
      );

      const results = await Promise.allSettled(deliveryPromises);

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const deliveryTime = Date.now() - startTime;

      // Update endpoint statistics
      await this.updateEndpointStats(activeEndpoints, results);

      this.logger.info('Webhook delivery completed', {
        notificationId: notification.id.value,
        successful,
        failed,
        totalEndpoints: activeEndpoints.length,
        deliveryTime,
      });

      return {
        success: successful > 0,
        channel: this.channel,
        messageId: `webhook-${notification.id.value}-${Date.now()}`,
        timestamp: new Date(),
        metadata: {
          deliveryTime,
          successful,
          failed,
          totalEndpoints: activeEndpoints.length,
          endpointResults: results.map((result, index) => ({
            endpointId: activeEndpoints[index].id,
            url: activeEndpoints[index].url,
            success: result.status === 'fulfilled',
            error:
              result.status === 'rejected' ? result.reason?.message : undefined,
            statusCode:
              result.status === 'fulfilled' ? result.value?.status : undefined,
          })),
        },
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      this.logger.error('Failed to deliver webhook notification', {
        notificationId: notification.id.value,
        error: error.message,
        deliveryTime,
      });

      return {
        success: false,
        channel: this.channel,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          deliveryTime,
        },
      };
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Test HTTP client configuration
      if (this.config.timeout <= 0) {
        throw new Error('Invalid timeout configuration');
      }

      if (this.config.maxRetries < 0) {
        throw new Error('Invalid maxRetries configuration');
      }

      if (this.config.retryDelay < 0) {
        throw new Error('Invalid retryDelay configuration');
      }

      // Test HTTP client by making a simple request to a test endpoint
      // In a real implementation, you might want to ping a health check endpoint

      this.isHealthy = true;
      this.lastHealthCheck = new Date();

      this.logger.info('Webhook configuration validated successfully');
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      this.logger.error('Webhook configuration validation failed', {
        error: error.message,
      });

      return false;
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    details?: Record<string, any>;
  }> {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();

    // Re-check health if it's been more than 5 minutes
    if (timeSinceLastCheck > 300000) {
      await this.validateConfiguration();
    }

    const totalEndpoints = this.endpoints.size;
    const activeEndpoints = Array.from(this.endpoints.values()).filter(
      e => e.isActive
    ).length;
    const recentFailures = Array.from(this.endpoints.values()).filter(
      e =>
        e.lastDeliveryStatus === 'failed' &&
        e.lastDeliveryAt &&
        now.getTime() - e.lastDeliveryAt.getTime() < 3600000 // Last hour
    ).length;

    return {
      healthy: this.isHealthy && recentFailures < totalEndpoints * 0.5, // Less than 50% recent failures
      details: {
        lastHealthCheck: this.lastHealthCheck,
        totalEndpoints,
        activeEndpoints,
        recentFailures,
        config: {
          timeout: this.config.timeout,
          maxRetries: this.config.maxRetries,
          retryDelay: this.config.retryDelay,
          validateSSL: this.config.validateSSL,
        },
      },
    };
  }

  // Webhook endpoint management
  async registerEndpoint(
    endpoint: Omit<
      WebhookEndpoint,
      'id' | 'createdAt' | 'updatedAt' | 'failureCount' | 'successCount'
    >
  ): Promise<string> {
    const endpointId = this.generateEndpointId();
    const now = new Date();

    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: endpointId,
      failureCount: 0,
      successCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Validate endpoint URL
    if (!this.isValidUrl(endpoint.url)) {
      throw new Error(`Invalid webhook URL: ${endpoint.url}`);
    }

    // Test endpoint connectivity
    const isReachable = await this.testEndpoint(endpoint.url);
    if (!isReachable) {
      this.logger.warn('Webhook endpoint may not be reachable', {
        endpointId,
        url: endpoint.url,
      });
    }

    this.endpoints.set(endpointId, newEndpoint);

    this.logger.info('Webhook endpoint registered', {
      endpointId,
      url: endpoint.url,
      events: endpoint.events,
    });

    return endpointId;
  }

  async updateEndpoint(
    endpointId: string,
    updates: Partial<
      Pick<
        WebhookEndpoint,
        | 'url'
        | 'secret'
        | 'isActive'
        | 'events'
        | 'headers'
        | 'httpMethod'
        | 'contentType'
      >
    >
  ): Promise<WebhookEndpoint> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${endpointId}`);
    }

    // Validate URL if being updated
    if (updates.url && !this.isValidUrl(updates.url)) {
      throw new Error(`Invalid webhook URL: ${updates.url}`);
    }

    // Update endpoint
    Object.assign(endpoint, updates, { updatedAt: new Date() });

    this.logger.info('Webhook endpoint updated', {
      endpointId,
      updates: Object.keys(updates),
    });

    return endpoint;
  }

  async deleteEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return false;
    }

    this.endpoints.delete(endpointId);

    this.logger.info('Webhook endpoint deleted', {
      endpointId,
      url: endpoint.url,
    });

    return true;
  }

  async getEndpoint(endpointId: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.get(endpointId) || null;
  }

  async getAllEndpoints(): Promise<WebhookEndpoint[]> {
    return Array.from(this.endpoints.values());
  }

  async getActiveEndpoints(): Promise<WebhookEndpoint[]> {
    return Array.from(this.endpoints.values()).filter(e => e.isActive);
  }

  async getEndpointsByEvent(event: string): Promise<WebhookEndpoint[]> {
    return Array.from(this.endpoints.values()).filter(
      e => e.isActive && e.events.includes(event)
    );
  }

  // Testing and debugging
  async testEndpoint(url: string, payload?: any): Promise<boolean> {
    try {
      const testPayload = payload || {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Webhook endpoint test',
      };

      const response = await this.httpClient.post(url, testPayload, {
        timeout: 10000, // Shorter timeout for testing
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.debug('Webhook endpoint test failed', {
        url,
        error: error.message,
      });
      return false;
    }
  }

  async sendTestWebhook(
    endpointId: string,
    customPayload?: any
  ): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${endpointId}`);
    }

    const testPayload = customPayload || {
      id: `test-${Date.now()}`,
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook',
        endpoint: {
          id: endpointId,
          url: endpoint.url,
        },
      },
      metadata: {
        test: true,
      },
    };

    try {
      const response = await this.sendToEndpoint(endpoint, testPayload, null);

      this.logger.info('Test webhook sent successfully', {
        endpointId,
        statusCode: response.status,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to send test webhook', {
        endpointId,
        error: error.message,
      });

      return false;
    }
  }

  // Analytics
  async getDeliveryStats(dateRange?: { from: Date; to: Date }): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    byEndpoint: Record<
      string,
      {
        sent: number;
        delivered: number;
        failed: number;
        rate: number;
      }
    >;
  }> {
    const endpoints = Array.from(this.endpoints.values());

    const stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      deliveryRate: 0,
      byEndpoint: {} as Record<string, any>,
    };

    for (const endpoint of endpoints) {
      const sent = endpoint.successCount + endpoint.failureCount;
      const delivered = endpoint.successCount;
      const failed = endpoint.failureCount;
      const rate = sent > 0 ? (delivered / sent) * 100 : 0;

      stats.totalSent += sent;
      stats.totalDelivered += delivered;
      stats.totalFailed += failed;

      stats.byEndpoint[endpoint.id] = {
        sent,
        delivered,
        failed,
        rate,
      };
    }

    stats.deliveryRate =
      stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent) * 100 : 0;

    return stats;
  }

  // Private helper methods
  private createWebhookPayload(
    notification: NotificationEntity,
    content: { subject: string; body: string }
  ): WebhookPayload {
    return {
      id: `webhook-${notification.id.value}-${Date.now()}`,
      event: `notification.${notification.type.value}`,
      timestamp: new Date().toISOString(),
      data: {
        notification: {
          id: notification.id.value,
          type: notification.type.value,
          title: content.subject,
          message: content.body,
          priority: notification.priority.value,
          userId: notification.userId.value,
          data: notification.data,
          actionUrl: notification.actionUrl,
          createdAt: notification.createdAt.toISOString(),
        },
        // Additional context would be populated from other services
        user: notification.data.user,
        workspace: notification.data.workspace,
      },
      metadata: {
        version: '1.0',
        source: 'unified-enterprise-platform',
        deliveryAttempt: 1,
      },
    };
  }

  private async sendToEndpoint(
    endpoint: WebhookEndpoint,
    payload: any,
    notification: NotificationEntity | null
  ): Promise<any> {
    const requestConfig: AxiosRequestConfig = {
      method: endpoint.httpMethod,
      url: endpoint.url,
      headers: {
        ...this.config.defaultHeaders,
        ...endpoint.headers,
      },
      timeout: this.config.timeout,
    };

    // Add signature if secret is provided
    if (endpoint.secret) {
      const signature = this.generateSignature(
        JSON.stringify(payload),
        endpoint.secret,
        endpoint.signatureAlgorithm
      );

      const signatureHeader = endpoint.signatureHeader || 'X-Webhook-Signature';
      requestConfig.headers![signatureHeader] =
        `${endpoint.signatureAlgorithm}=${signature}`;
    }

    // Set content type and prepare data
    if (endpoint.contentType === 'application/json') {
      requestConfig.data = payload;
      requestConfig.headers!['Content-Type'] = 'application/json';
    } else {
      // URL-encoded form data
      const formData = new URLSearchParams();
      formData.append('payload', JSON.stringify(payload));
      requestConfig.data = formData.toString();
      requestConfig.headers!['Content-Type'] =
        'application/x-www-form-urlencoded';
    }

    this.logger.debug('Sending webhook', {
      endpointId: endpoint.id,
      url: endpoint.url,
      method: endpoint.httpMethod,
      notificationId: notification?.id.value,
    });

    const response = await this.httpClient.request(requestConfig);

    this.logger.debug('Webhook sent successfully', {
      endpointId: endpoint.id,
      statusCode: response.status,
      responseTime: response.headers['x-response-time'],
    });

    return response;
  }

  private generateSignature(
    payload: string,
    secret: string,
    algorithm: string
  ): string {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  private async updateEndpointStats(
    endpoints: WebhookEndpoint[],
    results: PromiseSettledResult<any>[]
  ): Promise<void> {
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      const result = results[i];

      endpoint.lastDeliveryAt = new Date();

      if (result.status === 'fulfilled') {
        endpoint.successCount += 1;
        endpoint.lastDeliveryStatus = 'success';
      } else {
        endpoint.failureCount += 1;
        endpoint.lastDeliveryStatus = 'failed';
      }

      endpoint.updatedAt = new Date();
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  private generateEndpointId(): string {
    return `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupHttpInterceptors(): void {
    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      config => {
        this.logger.debug('Webhook HTTP request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
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
        });
        return response;
      },
      error => {
        this.logger.error('Webhook HTTP response error', {
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
