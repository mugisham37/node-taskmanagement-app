/**
 * Webhook Application Service
 *
 * Handles webhook delivery, retry logic, and security
 */

import {
  BaseApplicationService,
  ValidationResult,
  RequiredFieldValidationRule,
  LengthValidationRule,
} from './base-application-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IWebhookRepository } from '../../domain/repositories/webhook-repository';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { WebhookId } from '../../domain/value-objects/webhook-id';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { UserId } from '../../domain/value-objects/user-id';
import { Webhook } from '../../domain/entities/webhook';
import { WebhookDelivery } from '../../domain/entities/webhook-delivery';
import { injectable } from '../../shared/decorators/injectable.decorator';
import * as crypto from 'crypto';

export interface CreateWebhookRequest {
  workspaceId: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  createdBy: string;
}

export interface UpdateWebhookRequest {
  webhookId: string;
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  updatedBy: string;
}

export interface WebhookDto {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryDto {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  url: string;
  httpMethod: string;
  headers: Record<string, string>;
  status: string;
  statusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  deliveredAt?: Date;
  duration?: number;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  workspaceId: string;
  userId?: string;
}

export interface WebhookDeliveryOptions {
  timeout?: number;
  maxAttempts?: number;
  retryDelays?: number[];
  includeHeaders?: Record<string, string>;
}

export interface WebhookStatistics {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  deliverySuccessRate: number;
  recentDeliveries: WebhookDeliveryDto[];
}

@injectable()
export class WebhookApplicationService extends BaseApplicationService {
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_MAX_ATTEMPTS = 3;
  private readonly DEFAULT_RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
  private readonly WEBHOOK_CACHE_TTL = 1800; // 30 minutes

  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Create a new webhook
   */
  async createWebhook(request: CreateWebhookRequest): Promise<WebhookId> {
    return await this.executeWithMonitoring('createWebhook', async () => {
      // Validate input
      const validation = this.validateCreateWebhookRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const workspaceId = new WorkspaceId(request.workspaceId);
      const createdBy = new UserId(request.createdBy);

      // Verify workspace exists and user has permission
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const canCreate = await this.canUserManageWebhooks(
        createdBy,
        workspaceId
      );
      if (!canCreate) {
        throw new Error('Insufficient permissions to create webhooks');
      }

      // Validate URL
      if (!this.isValidUrl(request.url)) {
        throw new Error('Invalid webhook URL');
      }

      // Validate events
      const validEvents = this.getValidEventTypes();
      const invalidEvents = request.events.filter(
        event => !validEvents.includes(event)
      );
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid event types: ${invalidEvents.join(', ')}`);
      }

      // Generate secret if not provided
      const secret = request.secret || this.generateWebhookSecret();

      // Create webhook
      const webhook = Webhook.create({
        workspaceId,
        name: request.name,
        url: request.url,
        events: request.events,
        secret,
        headers: request.headers || {},
        isActive: request.isActive !== false,
        createdBy,
      });

      await this.webhookRepository.save(webhook);

      // Clear cache
      await this.clearWebhookCaches(workspaceId);

      this.logInfo('Webhook created successfully', {
        webhookId: webhook.id.value,
        name: request.name,
        url: request.url,
        workspaceId: request.workspaceId,
        events: request.events,
      });

      return webhook.id;
    });
  }

  /**
   * Update webhook
   */
  async updateWebhook(request: UpdateWebhookRequest): Promise<void> {
    return await this.executeWithMonitoring('updateWebhook', async () => {
      const validation = this.validateUpdateWebhookRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const webhookId = new WebhookId(request.webhookId);
      const updatedBy = new UserId(request.updatedBy);

      const webhook = await this.webhookRepository.findById(webhookId);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check permissions
      const canUpdate = await this.canUserManageWebhooks(
        updatedBy,
        webhook.workspaceId
      );
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update webhook');
      }

      // Update webhook fields
      if (request.name !== undefined) {
        webhook.updateName(request.name);
      }
      if (request.url !== undefined) {
        if (!this.isValidUrl(request.url)) {
          throw new Error('Invalid webhook URL');
        }
        webhook.updateUrl(request.url);
      }
      if (request.events !== undefined) {
        const validEvents = this.getValidEventTypes();
        const invalidEvents = request.events.filter(
          event => !validEvents.includes(event)
        );
        if (invalidEvents.length > 0) {
          throw new Error(`Invalid event types: ${invalidEvents.join(', ')}`);
        }
        webhook.updateEvents(request.events);
      }
      if (request.secret !== undefined) {
        webhook.updateSecret(request.secret);
      }
      if (request.headers !== undefined) {
        webhook.updateHeaders(request.headers);
      }
      if (request.isActive !== undefined) {
        if (request.isActive) {
          webhook.activate();
        } else {
          webhook.deactivate();
        }
      }

      await this.webhookRepository.save(webhook);

      // Clear cache
      await this.clearWebhookCaches(webhook.workspaceId);

      this.logInfo('Webhook updated successfully', {
        webhookId: request.webhookId,
        updatedBy: request.updatedBy,
      });
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, deletedBy: string): Promise<void> {
    return await this.executeWithMonitoring('deleteWebhook', async () => {
      const webhookIdVO = new WebhookId(webhookId);
      const deletedByVO = new UserId(deletedBy);

      const webhook = await this.webhookRepository.findById(webhookIdVO);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check permissions
      const canDelete = await this.canUserManageWebhooks(
        deletedByVO,
        webhook.workspaceId
      );
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete webhook');
      }

      await this.webhookRepository.delete(webhookIdVO);

      // Clear cache
      await this.clearWebhookCaches(webhook.workspaceId);

      this.logInfo('Webhook deleted successfully', {
        webhookId,
        deletedBy,
      });
    });
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(webhookId: string, userId: string): Promise<WebhookDto> {
    return await this.executeWithMonitoring('getWebhookById', async () => {
      const webhookIdVO = new WebhookId(webhookId);
      const userIdVO = new UserId(userId);

      const webhook = await this.webhookRepository.findById(webhookIdVO);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check permissions
      const canView = await this.canUserViewWebhooks(
        userIdVO,
        webhook.workspaceId
      );
      if (!canView) {
        throw new Error('Insufficient permissions to view webhook');
      }

      return await this.mapWebhookToDto(webhook);
    });
  }

  /**
   * Get webhooks by workspace
   */
  async getWebhooksByWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<WebhookDto[]> {
    return await this.executeWithMonitoring(
      'getWebhooksByWorkspace',
      async () => {
        const workspaceIdVO = new WorkspaceId(workspaceId);
        const userIdVO = new UserId(userId);

        // Check permissions
        const canView = await this.canUserViewWebhooks(userIdVO, workspaceIdVO);
        if (!canView) {
          throw new Error('Insufficient permissions to view webhooks');
        }

        // Check cache first
        const cacheKey = `workspace-webhooks:${workspaceId}`;
        const cachedWebhooks =
          await this.cacheService.get<WebhookDto[]>(cacheKey);
        if (cachedWebhooks) {
          return cachedWebhooks;
        }

        const webhooks =
          await this.webhookRepository.findByWorkspaceId(workspaceIdVO);
        const webhookDtos: WebhookDto[] = [];

        for (const webhook of webhooks) {
          const dto = await this.mapWebhookToDto(webhook);
          webhookDtos.push(dto);
        }

        // Cache the result
        await this.cacheService.set(
          cacheKey,
          webhookDtos,
          this.WEBHOOK_CACHE_TTL
        );

        return webhookDtos;
      }
    );
  }

  /**
   * Trigger webhook for event
   */
  async triggerWebhook(
    event: WebhookEvent,
    options?: WebhookDeliveryOptions
  ): Promise<void> {
    return await this.executeWithMonitoring('triggerWebhook', async () => {
      const workspaceId = new WorkspaceId(event.workspaceId);

      // Get active webhooks for this workspace that listen to this event type
      const webhooks =
        await this.webhookRepository.findActiveByWorkspaceAndEvent(
          workspaceId,
          event.type
        );

      if (webhooks.length === 0) {
        this.logDebug('No webhooks found for event', {
          eventType: event.type,
          workspaceId: event.workspaceId,
        });
        return;
      }

      // Trigger each webhook
      const deliveryPromises = webhooks.map(webhook =>
        this.deliverWebhook(webhook, event, options)
      );

      await Promise.allSettled(deliveryPromises);

      this.logInfo('Webhook event triggered', {
        eventType: event.type,
        workspaceId: event.workspaceId,
        webhookCount: webhooks.length,
      });
    });
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    webhook: Webhook,
    event: WebhookEvent,
    options?: WebhookDeliveryOptions
  ): Promise<void> {
    const delivery = WebhookDelivery.create({
      webhookId: webhook.id,
      eventType: event.type,
      payload: event.data,
      url: webhook.url,
      httpMethod: 'POST',
      headers: this.buildDeliveryHeaders(webhook, event),
      maxAttempts: options?.maxAttempts || this.DEFAULT_MAX_ATTEMPTS,
    });

    await this.webhookRepository.saveDelivery(delivery);

    try {
      await this.attemptDelivery(delivery, webhook, options);
    } catch (error) {
      this.logError('Webhook delivery failed', error as Error, {
        webhookId: webhook.id.value,
        deliveryId: delivery.id.value,
        eventType: event.type,
      });
    }
  }

  /**
   * Attempt webhook delivery
   */
  private async attemptDelivery(
    delivery: WebhookDelivery,
    webhook: Webhook,
    options?: WebhookDeliveryOptions
  ): Promise<void> {
    const timeout = options?.timeout || this.DEFAULT_TIMEOUT;
    const retryDelays = options?.retryDelays || this.DEFAULT_RETRY_DELAYS;

    while (delivery.attempts < delivery.maxAttempts) {
      delivery.incrementAttempts();

      try {
        const startTime = Date.now();

        // Make HTTP request
        const response = await this.makeHttpRequest(
          delivery.url,
          delivery.httpMethod,
          delivery.payload,
          delivery.headers,
          timeout
        );

        const duration = Date.now() - startTime;

        // Update delivery with success
        delivery.markAsDelivered(
          response.statusCode,
          response.body,
          response.headers,
          duration
        );

        await this.webhookRepository.saveDelivery(delivery);

        this.logInfo('Webhook delivered successfully', {
          webhookId: webhook.id.value,
          deliveryId: delivery.id.value,
          statusCode: response.statusCode,
          duration,
        });

        return;
      } catch (error) {
        const errorMessage = (error as Error).message;

        if (delivery.attempts >= delivery.maxAttempts) {
          // Final failure
          delivery.markAsFailed(errorMessage);
          await this.webhookRepository.saveDelivery(delivery);

          this.logError('Webhook delivery failed permanently', error as Error, {
            webhookId: webhook.id.value,
            deliveryId: delivery.id.value,
            attempts: delivery.attempts,
          });

          return;
        } else {
          // Schedule retry
          const retryDelay =
            retryDelays[delivery.attempts - 1] ||
            retryDelays[retryDelays.length - 1];
          delivery.scheduleRetry(new Date(Date.now() + retryDelay));
          await this.webhookRepository.saveDelivery(delivery);

          this.logWarning('Webhook delivery failed, scheduling retry', {
            webhookId: webhook.id.value,
            deliveryId: delivery.id.value,
            attempt: delivery.attempts,
            nextRetryAt: delivery.nextRetryAt,
            error: errorMessage,
          });

          // Wait before retry
          await this.delay(retryDelay);
        }
      }
    }
  }

  /**
   * Get webhook deliveries
   */
  async getWebhookDeliveries(
    webhookId: string,
    userId: string,
    limit: number = 50
  ): Promise<WebhookDeliveryDto[]> {
    return await this.executeWithMonitoring(
      'getWebhookDeliveries',
      async () => {
        const webhookIdVO = new WebhookId(webhookId);
        const userIdVO = new UserId(userId);

        const webhook = await this.webhookRepository.findById(webhookIdVO);
        if (!webhook) {
          throw new Error('Webhook not found');
        }

        // Check permissions
        const canView = await this.canUserViewWebhooks(
          userIdVO,
          webhook.workspaceId
        );
        if (!canView) {
          throw new Error(
            'Insufficient permissions to view webhook deliveries'
          );
        }

        const deliveries = await this.webhookRepository.getDeliveries(
          webhookIdVO,
          limit
        );

        return deliveries.map(delivery => ({
          id: delivery.id.value,
          webhookId: delivery.webhookId.value,
          eventType: delivery.eventType,
          payload: delivery.payload,
          url: delivery.url,
          httpMethod: delivery.httpMethod,
          headers: delivery.headers,
          status: delivery.status.value,
          statusCode: delivery.statusCode,
          responseBody: delivery.responseBody,
          responseHeaders: delivery.responseHeaders,
          deliveredAt: delivery.deliveredAt,
          duration: delivery.duration,
          attempts: delivery.attempts,
          maxAttempts: delivery.maxAttempts,
          nextRetryAt: delivery.nextRetryAt,
          createdAt: delivery.createdAt,
        }));
      }
    );
  }

  /**
   * Test webhook
   */
  async testWebhook(
    webhookId: string,
    userId: string
  ): Promise<WebhookDeliveryDto> {
    return await this.executeWithMonitoring('testWebhook', async () => {
      const webhookIdVO = new WebhookId(webhookId);
      const userIdVO = new UserId(userId);

      const webhook = await this.webhookRepository.findById(webhookIdVO);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check permissions
      const canTest = await this.canUserManageWebhooks(
        userIdVO,
        webhook.workspaceId
      );
      if (!canTest) {
        throw new Error('Insufficient permissions to test webhook');
      }

      // Create test event
      const testEvent: WebhookEvent = {
        id: `test_${Date.now()}`,
        type: 'webhook.test',
        data: {
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString(),
          webhook: {
            id: webhook.id.value,
            name: webhook.name,
          },
        },
        timestamp: new Date(),
        workspaceId: webhook.workspaceId.value,
        userId: userId,
      };

      // Create test delivery
      const delivery = WebhookDelivery.create({
        webhookId: webhook.id,
        eventType: testEvent.type,
        payload: testEvent.data,
        url: webhook.url,
        httpMethod: 'POST',
        headers: this.buildDeliveryHeaders(webhook, testEvent),
        maxAttempts: 1,
      });

      await this.webhookRepository.saveDelivery(delivery);

      // Attempt delivery
      await this.attemptDelivery(delivery, webhook);

      // Return delivery result
      const updatedDelivery = await this.webhookRepository.getDeliveryById(
        delivery.id
      );
      if (!updatedDelivery) {
        throw new Error('Test delivery not found');
      }

      return {
        id: updatedDelivery.id.value,
        webhookId: updatedDelivery.webhookId.value,
        eventType: updatedDelivery.eventType,
        payload: updatedDelivery.payload,
        url: updatedDelivery.url,
        httpMethod: updatedDelivery.httpMethod,
        headers: updatedDelivery.headers,
        status: updatedDelivery.status.value,
        statusCode: updatedDelivery.statusCode,
        responseBody: updatedDelivery.responseBody,
        responseHeaders: updatedDelivery.responseHeaders,
        deliveredAt: updatedDelivery.deliveredAt,
        duration: updatedDelivery.duration,
        attempts: updatedDelivery.attempts,
        maxAttempts: updatedDelivery.maxAttempts,
        nextRetryAt: updatedDelivery.nextRetryAt,
        createdAt: updatedDelivery.createdAt,
      };
    });
  }

  // Private helper methods
  private validateCreateWebhookRequest(
    request: CreateWebhookRequest
  ): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('workspaceId', 'Workspace ID'),
      new RequiredFieldValidationRule('name', 'Webhook Name'),
      new RequiredFieldValidationRule('url', 'Webhook URL'),
      new RequiredFieldValidationRule('events', 'Events'),
      new RequiredFieldValidationRule('createdBy', 'Created By'),
      new LengthValidationRule('name', 1, 100, 'Webhook Name'),
    ]);
  }

  private validateUpdateWebhookRequest(
    request: UpdateWebhookRequest
  ): ValidationResult {
    const rules = [
      new RequiredFieldValidationRule('webhookId', 'Webhook ID'),
      new RequiredFieldValidationRule('updatedBy', 'Updated By'),
    ];

    if (request.name !== undefined) {
      rules.push(new LengthValidationRule('name', 1, 100, 'Webhook Name'));
    }

    return this.validateInput(request, rules);
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private getValidEventTypes(): string[] {
    return [
      'task.created',
      'task.updated',
      'task.assigned',
      'task.completed',
      'task.deleted',
      'project.created',
      'project.updated',
      'project.deleted',
      'project.member.added',
      'project.member.removed',
      'workspace.created',
      'workspace.updated',
      'workspace.member.added',
      'workspace.member.removed',
      'user.created',
      'user.updated',
    ];
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private buildDeliveryHeaders(
    webhook: Webhook,
    event: WebhookEvent
  ): Record<string, string> {
    const timestamp = Math.floor(event.timestamp.getTime() / 1000).toString();
    const payload = JSON.stringify(event.data);
    const signature = this.generateSignature(
      payload,
      webhook.secret,
      timestamp
    );

    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Webhook-Delivery/1.0',
      'X-Webhook-Event': event.type,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature,
      'X-Webhook-ID': event.id,
      ...webhook.headers,
    };
  }

  private generateSignature(
    payload: string,
    secret: string,
    timestamp: string
  ): string {
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');
    return `sha256=${signature}`;
  }

  private async makeHttpRequest(
    url: string,
    method: string,
    payload: any,
    headers: Record<string, string>,
    timeout: number
  ): Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }> {
    // This would use a proper HTTP client like axios or fetch
    // For now, simulate the request
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate successful delivery
        if (Math.random() > 0.1) {
          // 90% success rate
          resolve({
            statusCode: 200,
            body: JSON.stringify({ success: true }),
            headers: { 'content-type': 'application/json' },
          });
        } else {
          reject(new Error('Connection timeout'));
        }
      }, Math.random() * 1000); // Random delay up to 1 second
    });
  }

  private async canUserManageWebhooks(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member && (member.role.isAdmin() || member.role.isOwner());
  }

  private async canUserViewWebhooks(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }

  private async mapWebhookToDto(webhook: Webhook): Promise<WebhookDto> {
    const stats = await this.webhookRepository.getWebhookStatistics(webhook.id);

    return {
      id: webhook.id.value,
      workspaceId: webhook.workspaceId.value,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      lastDeliveryAt: stats.lastDeliveryAt,
      lastDeliveryStatus: stats.lastDeliveryStatus,
      totalDeliveries: stats.totalDeliveries,
      successfulDeliveries: stats.successfulDeliveries,
      failedDeliveries: stats.failedDeliveries,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }

  private async clearWebhookCaches(workspaceId: WorkspaceId): Promise<void> {
    await this.cacheService.delete(`workspace-webhooks:${workspaceId.value}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
