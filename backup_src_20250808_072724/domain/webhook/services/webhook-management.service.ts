import { Injectable } from '../decorators/injectable';
import {
  WebhookDeliveryProvider,
  WebhookEndpoint,
} from '../../infrastructure/webhook/webhook-delivery-provider';
import { UserId } from '../../domain/authentication/value-objects/user-id';
import { NotificationType } from '../../domain/notification/value-objects/notification-type';
import { Logger } from '../../infrastructure/logging/logger';

export interface WebhookSubscription {
  id: string;
  userId: string;
  workspaceId?: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  isActive: boolean;
  events: NotificationType[];
  filters: {
    userIds?: string[];
    projectIds?: string[];
    taskIds?: string[];
    priorities?: string[];
    tags?: string[];
  };
  settings: {
    httpMethod: 'POST' | 'PUT' | 'PATCH';
    contentType: 'application/json' | 'application/x-www-form-urlencoded';
    signatureHeader: string;
    signatureAlgorithm: 'sha256' | 'sha1' | 'md5';
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };
  headers: Record<string, string>;
  metadata: Record<string, any>;
  statistics: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    lastDeliveryAt?: Date;
    lastDeliveryStatus?: 'success' | 'failed';
    averageResponseTime: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  subscriptionId: string;
  event: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookManagementService {
  // Subscription management
  createSubscription(
    userId: UserId,
    data: {
      name: string;
      description?: string;
      url: string;
      events: NotificationType[];
      workspaceId?: string;
      filters?: WebhookSubscription['filters'];
      settings?: Partial<WebhookSubscription['settings']>;
      headers?: Record<string, string>;
    }
  ): Promise<WebhookSubscription>;

  updateSubscription(
    subscriptionId: string,
    updates: Partial<
      Pick<
        WebhookSubscription,
        | 'name'
        | 'description'
        | 'url'
        | 'isActive'
        | 'events'
        | 'filters'
        | 'settings'
        | 'headers'
      >
    >
  ): Promise<WebhookSubscription>;

  deleteSubscription(subscriptionId: string): Promise<boolean>;

  getSubscription(subscriptionId: string): Promise<WebhookSubscription | null>;
  getUserSubscriptions(userId: UserId): Promise<WebhookSubscription[]>;
  getWorkspaceSubscriptions(
    workspaceId: string
  ): Promise<WebhookSubscription[]>;

  // Event management
  getSubscriptionEvents(
    subscriptionId: string,
    filters?: {
      status?: WebhookEvent['status'];
      dateRange?: { from: Date; to: Date };
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    events: WebhookEvent[];
    total: number;
    hasMore: boolean;
  }>;

  retryFailedEvent(eventId: string): Promise<boolean>;
  retryFailedEvents(
    subscriptionId: string,
    maxEvents?: number
  ): Promise<number>;
  cancelPendingEvent(eventId: string): Promise<boolean>;

  // Testing and validation
  testSubscription(
    subscriptionId: string,
    customPayload?: any
  ): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime: number;
    error?: string;
  }>;

  validateWebhookUrl(url: string): Promise<{
    valid: boolean;
    reachable: boolean;
    responseTime?: number;
    error?: string;
  }>;

  // Security
  generateSecret(): string;
  rotateSecret(subscriptionId: string): Promise<string>;
  validateSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string
  ): boolean;

  // Analytics and monitoring
  getSubscriptionStats(subscriptionId: string): Promise<{
    totalEvents: number;
    deliveredEvents: number;
    failedEvents: number;
    deliveryRate: number;
    averageResponseTime: number;
    recentActivity: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }>;
  }>;

  getSystemStats(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalEvents: number;
    deliveryRate: number;
    topEvents: Array<{
      event: string;
      count: number;
    }>;
    healthyEndpoints: number;
    unhealthyEndpoints: number;
  }>;

  // Bulk operations
  enableSubscriptions(subscriptionIds: string[]): Promise<number>;
  disableSubscriptions(subscriptionIds: string[]): Promise<number>;
  deleteSubscriptions(subscriptionIds: string[]): Promise<number>;

  // Event filtering
  shouldDeliverEvent(
    subscription: WebhookSubscription,
    event: {
      type: NotificationType;
      userId: string;
      projectId?: string;
      taskId?: string;
      priority?: string;
      tags?: string[];
    }
  ): boolean;
}

@Injectable()
export class WebhookManagementServiceImpl implements WebhookManagementService {
  private subscriptions = new Map<string, WebhookSubscription>();
  private events = new Map<string, WebhookEvent>();
  private userSubscriptions = new Map<string, string[]>(); // userId -> subscriptionIds

  constructor(
    private readonly webhookProvider: WebhookDeliveryProvider,
    private readonly logger: Logger
  ) {}

  async createSubscription(
    userId: UserId,
    data: {
      name: string;
      description?: string;
      url: string;
      events: NotificationType[];
      workspaceId?: string;
      filters?: WebhookSubscription['filters'];
      settings?: Partial<WebhookSubscription['settings']>;
      headers?: Record<string, string>;
    }
  ): Promise<WebhookSubscription> {
    // Validate URL
    const urlValidation = await this.validateWebhookUrl(data.url);
    if (!urlValidation.valid) {
      throw new Error(`Invalid webhook URL: ${urlValidation.error}`);
    }

    // Generate subscription ID and secret
    const subscriptionId = this.generateSubscriptionId();
    const secret = this.generateSecret();

    // Create subscription
    const subscription: WebhookSubscription = {
      id: subscriptionId,
      userId: userId.value,
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description,
      url: data.url,
      secret,
      isActive: true,
      events: data.events,
      filters: data.filters || {},
      settings: {
        httpMethod: 'POST',
        contentType: 'application/json',
        signatureHeader: 'X-Webhook-Signature',
        signatureAlgorithm: 'sha256',
        timeout: 30000,
        retryCount: 3,
        retryDelay: 1000,
        ...data.settings,
      },
      headers: data.headers || {},
      metadata: {},
      statistics: {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        averageResponseTime: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Register with webhook provider
    await this.webhookProvider.registerEndpoint({
      url: subscription.url,
      secret: subscription.secret,
      isActive: subscription.isActive,
      events: subscription.events.map(e => e.value),
      headers: subscription.headers,
      httpMethod: subscription.settings.httpMethod,
      contentType: subscription.settings.contentType,
      signatureHeader: subscription.settings.signatureHeader,
      signatureAlgorithm: subscription.settings.signatureAlgorithm,
      metadata: {
        subscriptionId,
        userId: userId.value,
        workspaceId: data.workspaceId,
      },
    });

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);

    // Update user subscriptions index
    const userSubs = this.userSubscriptions.get(userId.value) || [];
    userSubs.push(subscriptionId);
    this.userSubscriptions.set(userId.value, userSubs);

    this.logger.info('Webhook subscription created', {
      subscriptionId,
      userId: userId.value,
      url: data.url,
      events: data.events.map(e => e.value),
    });

    return subscription;
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<
      Pick<
        WebhookSubscription,
        | 'name'
        | 'description'
        | 'url'
        | 'isActive'
        | 'events'
        | 'filters'
        | 'settings'
        | 'headers'
      >
    >
  ): Promise<WebhookSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Webhook subscription not found: ${subscriptionId}`);
    }

    // Validate URL if being updated
    if (updates.url) {
      const urlValidation = await this.validateWebhookUrl(updates.url);
      if (!urlValidation.valid) {
        throw new Error(`Invalid webhook URL: ${urlValidation.error}`);
      }
    }

    // Update subscription
    Object.assign(subscription, updates, { updatedAt: new Date() });

    // Update webhook provider endpoint if necessary
    if (
      updates.url ||
      updates.isActive ||
      updates.events ||
      updates.headers ||
      updates.settings
    ) {
      // Find the corresponding endpoint in the provider
      const endpoints = await this.webhookProvider.getAllEndpoints();
      const endpoint = endpoints.find(
        e => e.metadata.subscriptionId === subscriptionId
      );

      if (endpoint) {
        await this.webhookProvider.updateEndpoint(endpoint.id, {
          url: subscription.url,
          isActive: subscription.isActive,
          events: subscription.events.map(e => e.value),
          headers: subscription.headers,
          httpMethod: subscription.settings.httpMethod,
          contentType: subscription.settings.contentType,
        });
      }
    }

    this.logger.info('Webhook subscription updated', {
      subscriptionId,
      updates: Object.keys(updates),
    });

    return subscription;
  }

  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from webhook provider
    const endpoints = await this.webhookProvider.getAllEndpoints();
    const endpoint = endpoints.find(
      e => e.metadata.subscriptionId === subscriptionId
    );
    if (endpoint) {
      await this.webhookProvider.deleteEndpoint(endpoint.id);
    }

    // Remove from storage
    this.subscriptions.delete(subscriptionId);

    // Update user subscriptions index
    const userSubs = this.userSubscriptions.get(subscription.userId) || [];
    const updatedSubs = userSubs.filter(id => id !== subscriptionId);

    if (updatedSubs.length === 0) {
      this.userSubscriptions.delete(subscription.userId);
    } else {
      this.userSubscriptions.set(subscription.userId, updatedSubs);
    }

    // Remove associated events
    const subscriptionEvents = Array.from(this.events.values()).filter(
      e => e.subscriptionId === subscriptionId
    );
    for (const event of subscriptionEvents) {
      this.events.delete(event.id);
    }

    this.logger.info('Webhook subscription deleted', {
      subscriptionId,
      userId: subscription.userId,
    });

    return true;
  }

  async getSubscription(
    subscriptionId: string
  ): Promise<WebhookSubscription | null> {
    return this.subscriptions.get(subscriptionId) || null;
  }

  async getUserSubscriptions(userId: UserId): Promise<WebhookSubscription[]> {
    const subscriptionIds = this.userSubscriptions.get(userId.value) || [];
    return subscriptionIds
      .map(id => this.subscriptions.get(id))
      .filter((sub): sub is WebhookSubscription => sub !== undefined);
  }

  async getWorkspaceSubscriptions(
    workspaceId: string
  ): Promise<WebhookSubscription[]> {
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.workspaceId === workspaceId
    );
  }

  async getSubscriptionEvents(
    subscriptionId: string,
    filters: {
      status?: WebhookEvent['status'];
      dateRange?: { from: Date; to: Date };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    events: WebhookEvent[];
    total: number;
    hasMore: boolean;
  }> {
    let events = Array.from(this.events.values()).filter(
      e => e.subscriptionId === subscriptionId
    );

    // Apply filters
    if (filters.status) {
      events = events.filter(e => e.status === filters.status);
    }

    if (filters.dateRange) {
      events = events.filter(
        e =>
          e.createdAt >= filters.dateRange!.from &&
          e.createdAt <= filters.dateRange!.to
      );
    }

    // Sort by creation date (newest first)
    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = events.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    const paginatedEvents = events.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      events: paginatedEvents,
      total,
      hasMore,
    };
  }

  async retryFailedEvent(eventId: string): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event || event.status !== 'failed') {
      return false;
    }

    if (event.attempts >= event.maxAttempts) {
      this.logger.warn('Cannot retry event: max attempts reached', {
        eventId,
        attempts: event.attempts,
        maxAttempts: event.maxAttempts,
      });
      return false;
    }

    // Reset event for retry
    event.status = 'pending';
    event.nextRetryAt = new Date();
    event.error = undefined;
    event.updatedAt = new Date();

    this.logger.info('Event queued for retry', { eventId });
    return true;
  }

  async retryFailedEvents(
    subscriptionId: string,
    maxEvents: number = 100
  ): Promise<number> {
    const failedEvents = Array.from(this.events.values())
      .filter(
        e =>
          e.subscriptionId === subscriptionId &&
          e.status === 'failed' &&
          e.attempts < e.maxAttempts
      )
      .slice(0, maxEvents);

    let retriedCount = 0;
    for (const event of failedEvents) {
      const retried = await this.retryFailedEvent(event.id);
      if (retried) {
        retriedCount++;
      }
    }

    this.logger.info('Bulk retry completed', {
      subscriptionId,
      retriedCount,
      totalFailed: failedEvents.length,
    });

    return retriedCount;
  }

  async cancelPendingEvent(eventId: string): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event || event.status !== 'pending') {
      return false;
    }

    event.status = 'cancelled';
    event.updatedAt = new Date();

    this.logger.info('Event cancelled', { eventId });
    return true;
  }

  async testSubscription(
    subscriptionId: string,
    customPayload?: any
  ): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime: number;
    error?: string;
  }> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Webhook subscription not found: ${subscriptionId}`);
    }

    const startTime = Date.now();

    try {
      // Find the corresponding endpoint in the provider
      const endpoints = await this.webhookProvider.getAllEndpoints();
      const endpoint = endpoints.find(
        e => e.metadata.subscriptionId === subscriptionId
      );

      if (!endpoint) {
        throw new Error('Webhook endpoint not found in provider');
      }

      const success = await this.webhookProvider.sendTestWebhook(
        endpoint.id,
        customPayload
      );
      const responseTime = Date.now() - startTime;

      return {
        success,
        responseTime,
        statusCode: success ? 200 : undefined,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        responseTime,
        error: error.message,
      };
    }
  }

  async validateWebhookUrl(url: string): Promise<{
    valid: boolean;
    reachable: boolean;
    responseTime?: number;
    error?: string;
  }> {
    // Basic URL validation
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          valid: false,
          reachable: false,
          error: 'URL must use HTTP or HTTPS protocol',
        };
      }
    } catch (error) {
      return {
        valid: false,
        reachable: false,
        error: 'Invalid URL format',
      };
    }

    // Test reachability
    const startTime = Date.now();
    const reachable = await this.webhookProvider.testEndpoint(url);
    const responseTime = Date.now() - startTime;

    return {
      valid: true,
      reachable,
      responseTime,
      error: reachable ? undefined : 'URL is not reachable',
    };
  }

  generateSecret(): string {
    // Generate a cryptographically secure random secret
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';

    for (let i = 0; i < 64; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return secret;
  }

  async rotateSecret(subscriptionId: string): Promise<string> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Webhook subscription not found: ${subscriptionId}`);
    }

    const newSecret = this.generateSecret();
    subscription.secret = newSecret;
    subscription.updatedAt = new Date();

    // Update webhook provider endpoint
    const endpoints = await this.webhookProvider.getAllEndpoints();
    const endpoint = endpoints.find(
      e => e.metadata.subscriptionId === subscriptionId
    );

    if (endpoint) {
      await this.webhookProvider.updateEndpoint(endpoint.id, {
        secret: newSecret,
      });
    }

    this.logger.info('Webhook secret rotated', { subscriptionId });
    return newSecret;
  }

  validateSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string
  ): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
    const providedSignature = signature.replace(`${algorithm}=`, '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  }

  async getSubscriptionStats(subscriptionId: string): Promise<{
    totalEvents: number;
    deliveredEvents: number;
    failedEvents: number;
    deliveryRate: number;
    averageResponseTime: number;
    recentActivity: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }>;
  }> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Webhook subscription not found: ${subscriptionId}`);
    }

    const events = Array.from(this.events.values()).filter(
      e => e.subscriptionId === subscriptionId
    );

    const totalEvents = events.length;
    const deliveredEvents = events.filter(e => e.status === 'delivered').length;
    const failedEvents = events.filter(e => e.status === 'failed').length;
    const deliveryRate =
      totalEvents > 0 ? (deliveredEvents / totalEvents) * 100 : 0;

    // Calculate recent activity (last 7 days)
    const recentActivity: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }> = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayEvents = events.filter(
        e => e.createdAt.toISOString().split('T')[0] === dateStr
      );

      recentActivity.push({
        date: dateStr,
        sent: dayEvents.length,
        delivered: dayEvents.filter(e => e.status === 'delivered').length,
        failed: dayEvents.filter(e => e.status === 'failed').length,
      });
    }

    return {
      totalEvents,
      deliveredEvents,
      failedEvents,
      deliveryRate,
      averageResponseTime: subscription.statistics.averageResponseTime,
      recentActivity,
    };
  }

  async getSystemStats(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalEvents: number;
    deliveryRate: number;
    topEvents: Array<{
      event: string;
      count: number;
    }>;
    healthyEndpoints: number;
    unhealthyEndpoints: number;
  }> {
    const subscriptions = Array.from(this.subscriptions.values());
    const events = Array.from(this.events.values());

    const totalSubscriptions = subscriptions.length;
    const activeSubscriptions = subscriptions.filter(s => s.isActive).length;
    const totalEvents = events.length;
    const deliveredEvents = events.filter(e => e.status === 'delivered').length;
    const deliveryRate =
      totalEvents > 0 ? (deliveredEvents / totalEvents) * 100 : 0;

    // Calculate top events
    const eventCounts = new Map<string, number>();
    for (const event of events) {
      const count = eventCounts.get(event.event) || 0;
      eventCounts.set(event.event, count + 1);
    }

    const topEvents = Array.from(eventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));

    // Get endpoint health from provider
    const providerStats = await this.webhookProvider.getDeliveryStats();
    const healthyEndpoints = Object.values(providerStats.byEndpoint).filter(
      stats => stats.rate >= 80 // 80% success rate considered healthy
    ).length;
    const unhealthyEndpoints =
      Object.values(providerStats.byEndpoint).length - healthyEndpoints;

    return {
      totalSubscriptions,
      activeSubscriptions,
      totalEvents,
      deliveryRate,
      topEvents,
      healthyEndpoints,
      unhealthyEndpoints,
    };
  }

  async enableSubscriptions(subscriptionIds: string[]): Promise<number> {
    let enabledCount = 0;

    for (const subscriptionId of subscriptionIds) {
      try {
        await this.updateSubscription(subscriptionId, { isActive: true });
        enabledCount++;
      } catch (error) {
        this.logger.error('Failed to enable subscription', {
          subscriptionId,
          error: error.message,
        });
      }
    }

    return enabledCount;
  }

  async disableSubscriptions(subscriptionIds: string[]): Promise<number> {
    let disabledCount = 0;

    for (const subscriptionId of subscriptionIds) {
      try {
        await this.updateSubscription(subscriptionId, { isActive: false });
        disabledCount++;
      } catch (error) {
        this.logger.error('Failed to disable subscription', {
          subscriptionId,
          error: error.message,
        });
      }
    }

    return disabledCount;
  }

  async deleteSubscriptions(subscriptionIds: string[]): Promise<number> {
    let deletedCount = 0;

    for (const subscriptionId of subscriptionIds) {
      try {
        const deleted = await this.deleteSubscription(subscriptionId);
        if (deleted) {
          deletedCount++;
        }
      } catch (error) {
        this.logger.error('Failed to delete subscription', {
          subscriptionId,
          error: error.message,
        });
      }
    }

    return deletedCount;
  }

  shouldDeliverEvent(
    subscription: WebhookSubscription,
    event: {
      type: NotificationType;
      userId: string;
      projectId?: string;
      taskId?: string;
      priority?: string;
      tags?: string[];
    }
  ): boolean {
    // Check if subscription is active
    if (!subscription.isActive) {
      return false;
    }

    // Check if event type is subscribed
    if (!subscription.events.some(e => e.equals(event.type))) {
      return false;
    }

    // Apply filters
    const { filters } = subscription;

    if (filters.userIds && filters.userIds.length > 0) {
      if (!filters.userIds.includes(event.userId)) {
        return false;
      }
    }

    if (
      filters.projectIds &&
      filters.projectIds.length > 0 &&
      event.projectId
    ) {
      if (!filters.projectIds.includes(event.projectId)) {
        return false;
      }
    }

    if (filters.taskIds && filters.taskIds.length > 0 && event.taskId) {
      if (!filters.taskIds.includes(event.taskId)) {
        return false;
      }
    }

    if (filters.priorities && filters.priorities.length > 0 && event.priority) {
      if (!filters.priorities.includes(event.priority)) {
        return false;
      }
    }

    if (filters.tags && filters.tags.length > 0 && event.tags) {
      const hasMatchingTag = event.tags.some(tag =>
        filters.tags!.includes(tag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  // Private helper methods
  private generateSubscriptionId(): string {
    return `webhook-sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
