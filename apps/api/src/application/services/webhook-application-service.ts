/**
 * Webhook Application Service
 *
 * Handles webhook delivery, retry logic, and security
 */

import {
  DomainEventPublisher,
  IWebhookRepository,
  IWorkspaceRepository,
  UserId,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEvent,
  WebhookId,
  WebhookStatus,
  WorkspaceId,
} from '@taskmanagement/domain';
import * as crypto from 'crypto';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { injectable } from '../../shared/decorators/injectable.decorator';
import {
  BaseApplicationService,
  LengthValidationRule,
  RequiredFieldValidationRule,
  ValidationResult,
} from './base-application-service';

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

export interface WebhookEventData {
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

      const canCreate = await this.canUserManageWebhooks(createdBy, workspaceId);
      if (!canCreate) {
        throw new Error('Insufficient permissions to create webhooks');
      }

      // Validate URL
      if (!this.isValidUrl(request.url)) {
        throw new Error('Invalid webhook URL');
      }

      // Validate events
      const validEvents = this.getValidEventTypes();
      const invalidEvents = request.events.filter((event) => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid event types: ${invalidEvents.join(', ')}`);
      }

      // Generate secret if not provided
      const secret = request.secret || this.generateWebhookSecret();

      // Convert string events to WebhookEvent enum values
      const webhookEvents = request.events.map((event) => event as any);

      // Create webhook using constructor with generated ID
      const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const webhook = new Webhook({
        id: webhookId,
        workspaceId: workspaceId.value,
        name: request.name,
        url: request.url,
        events: webhookEvents,
        secret,
        headers: request.headers || {},
        status: request.isActive !== false ? WebhookStatus.ACTIVE : WebhookStatus.INACTIVE,
        createdBy: createdBy.value,
        retryCount: 0,
        maxRetries: 3,
        timeout: 30000,
        failureCount: 0,
        maxFailures: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      });

      await this.webhookRepository.save(webhook);

      // Clear cache
      await this.clearWebhookCaches(workspaceId);

      this.logInfo('Webhook created successfully', {
        webhookId: webhookId,
        name: request.name,
        url: request.url,
        workspaceId: request.workspaceId,
        events: request.events,
      });

      return WebhookId.create(webhookId);
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
        new WorkspaceId(webhook.workspaceId)
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
        const invalidEvents = request.events.filter((event) => !validEvents.includes(event));
        if (invalidEvents.length > 0) {
          throw new Error(`Invalid event types: ${invalidEvents.join(', ')}`);
        }
        const webhookEvents = request.events.map((event) => event as any);
        webhook.updateEvents(webhookEvents);
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
      await this.clearWebhookCaches(new WorkspaceId(webhook.workspaceId));

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
        new WorkspaceId(webhook.workspaceId)
      );
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete webhook');
      }

      await this.webhookRepository.delete(webhookIdVO);

      // Clear cache
      await this.clearWebhookCaches(new WorkspaceId(webhook.workspaceId));

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
        new WorkspaceId(webhook.workspaceId)
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
  async getWebhooksByWorkspace(workspaceId: string, userId: string): Promise<WebhookDto[]> {
    return await this.executeWithMonitoring('getWebhooksByWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      // Check permissions
      const canView = await this.canUserViewWebhooks(userIdVO, workspaceIdVO);
      if (!canView) {
        throw new Error('Insufficient permissions to view webhooks');
      }

      // Check cache first
      const cacheKey = `workspace-webhooks:${workspaceId}`;
      const cachedWebhooks = await this.cacheService.get<WebhookDto[]>(cacheKey);
      if (cachedWebhooks) {
        return cachedWebhooks;
      }

      const webhooks = await this.webhookRepository.findByWorkspaceId(workspaceIdVO);
      const webhookDtos: WebhookDto[] = [];

      for (const webhook of webhooks) {
        const dto = await this.mapWebhookToDto(webhook);
        webhookDtos.push(dto);
      }

      // Cache the result
      await this.cacheService.set(cacheKey, webhookDtos, this.WEBHOOK_CACHE_TTL);

      return webhookDtos;
    });
  }

  /**
   * Trigger webhook for event
   */
  async triggerWebhook(event: WebhookEventData, options?: WebhookDeliveryOptions): Promise<void> {
    return await this.executeWithMonitoring('triggerWebhook', async () => {
      const workspaceId = new WorkspaceId(event.workspaceId);

      // Get active webhooks for this workspace that listen to this event type
      const webhooks = await this.webhookRepository.findActiveByWorkspaceAndEvent(
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
      const deliveryPromises = webhooks.map((webhook) =>
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
    event: WebhookEventData,
    options?: WebhookDeliveryOptions
  ): Promise<void> {
    const delivery = new WebhookDelivery({
      id: `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookId: webhook.id,
      event: event.type as WebhookEvent,
      payload: event.data,
      headers: this.buildDeliveryHeaders(webhook, event),
      status: WebhookDeliveryStatus.PENDING,
      attempt: 0,
      maxAttempts: options?.maxAttempts || this.DEFAULT_MAX_ATTEMPTS,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.webhookRepository.saveDelivery(delivery);

    try {
      await this.attemptDelivery(delivery, webhook, options);
    } catch (error) {
      this.logError('Webhook delivery failed', error as Error, {
        webhookId: webhook.id,
        deliveryId: delivery.id,
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

    let currentDelivery = delivery;

    while (currentDelivery.attempt < currentDelivery.maxAttempts) {
      // Create a new delivery with incremented attempt
      currentDelivery = currentDelivery.withRetryAttempt();

      try {
        const startTime = Date.now();

        // Make HTTP request - using webhook URL since delivery doesn't have url property
        const response = await this.makeHttpRequest(
          webhook.url,
          'POST',
          currentDelivery.payload,
          currentDelivery.headers || {},
          timeout
        );

        const duration = Date.now() - startTime;

        // Create delivery with success status
        currentDelivery = currentDelivery.withSuccess(
          response.statusCode,
          response.body,
          response.headers,
          duration
        );

        await this.webhookRepository.saveDelivery(currentDelivery);

        this.logInfo('Webhook delivered successfully', {
          webhookId: webhook.id,
          deliveryId: currentDelivery.id,
          statusCode: response.statusCode,
          duration,
        });

        return;
      } catch (error) {
        const errorMessage = (error as Error).message;

        if (currentDelivery.attempt >= currentDelivery.maxAttempts) {
          // Final failure
          currentDelivery = currentDelivery.withFailure(errorMessage);
          await this.webhookRepository.saveDelivery(currentDelivery);

          this.logError('Webhook delivery failed permanently', error as Error, {
            webhookId: webhook.id,
            deliveryId: currentDelivery.id,
            attempts: currentDelivery.attempt,
          });

          return;
        } else {
          // Schedule retry
          const retryDelay =
            retryDelays[currentDelivery.attempt - 1] || retryDelays[retryDelays.length - 1];

          if (retryDelay !== undefined) {
            currentDelivery = currentDelivery.withFailure(
              errorMessage,
              undefined,
              undefined,
              new Date(Date.now() + retryDelay)
            );
            await this.webhookRepository.saveDelivery(currentDelivery);

            this.logWarning('Webhook delivery failed, scheduling retry', {
              webhookId: webhook.id,
              deliveryId: currentDelivery.id,
              attempt: currentDelivery.attempt,
              nextRetryAt: currentDelivery.nextRetryAt,
              error: errorMessage,
            });

            // Wait before retry
            await this.delay(retryDelay);
          }
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
    return await this.executeWithMonitoring('getWebhookDeliveries', async () => {
      const webhookIdVO = new WebhookId(webhookId);
      const userIdVO = new UserId(userId);

      const webhook = await this.webhookRepository.findById(webhookIdVO);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check permissions
      const canView = await this.canUserViewWebhooks(
        userIdVO,
        new WorkspaceId(webhook.workspaceId)
      );
      if (!canView) {
        throw new Error('Insufficient permissions to view webhook deliveries');
      }

      const deliveries = await this.webhookRepository.getDeliveries(webhookIdVO, limit);

      return deliveries.map((delivery) => ({
        id: delivery.id,
        webhookId: delivery.webhookId,
        eventType: delivery.event.toString(),
        payload: delivery.payload,
        url: webhook.url, // Use webhook URL since delivery doesn't have url
        httpMethod: 'POST', // Default HTTP method
        headers: delivery.headers || {},
        status: delivery.status.toString(),
        ...(delivery.httpStatus !== undefined && { statusCode: delivery.httpStatus }),
        ...(delivery.responseBody && { responseBody: delivery.responseBody }),
        ...(delivery.responseHeaders && { responseHeaders: delivery.responseHeaders }),
        ...(delivery.deliveredAt && { deliveredAt: delivery.deliveredAt }),
        ...(delivery.duration !== undefined && { duration: delivery.duration }),
        attempts: delivery.attempt,
        maxAttempts: delivery.maxAttempts,
        ...(delivery.nextRetryAt && { nextRetryAt: delivery.nextRetryAt }),
        createdAt: delivery.createdAt,
      }));
    });
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string, userId: string): Promise<WebhookDeliveryDto> {
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
        new WorkspaceId(webhook.workspaceId)
      );
      if (!canTest) {
        throw new Error('Insufficient permissions to test webhook');
      }

      // Create test event
      const testEvent: WebhookEventData = {
        id: `test_${Date.now()}`,
        type: 'webhook.test',
        data: {
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString(),
          webhook: {
            id: webhook.id,
            name: webhook.name,
          },
        },
        timestamp: new Date(),
        workspaceId: webhook.workspaceId,
        userId: userId,
      };

      // Create test delivery
      const delivery = new WebhookDelivery({
        id: `wd_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        webhookId: webhook.id,
        event: WebhookEvent.WEBHOOK_TEST,
        payload: testEvent.data,
        headers: this.buildDeliveryHeaders(webhook, testEvent),
        status: WebhookDeliveryStatus.PENDING,
        attempt: 0,
        maxAttempts: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.webhookRepository.saveDelivery(delivery);

      // Attempt delivery
      await this.attemptDelivery(delivery, webhook);

      // Return delivery result
      const updatedDelivery = await this.webhookRepository.getDeliveryById(delivery.id);
      if (!updatedDelivery) {
        throw new Error('Test delivery not found');
      }

      return {
        id: updatedDelivery.id,
        webhookId: updatedDelivery.webhookId,
        eventType: updatedDelivery.event.toString(),
        payload: updatedDelivery.payload,
        url: webhook.url,
        httpMethod: 'POST',
        headers: updatedDelivery.headers || {},
        status: updatedDelivery.status.toString(),
        ...(updatedDelivery.httpStatus !== undefined && { statusCode: updatedDelivery.httpStatus }),
        ...(updatedDelivery.responseBody && { responseBody: updatedDelivery.responseBody }),
        ...(updatedDelivery.responseHeaders && {
          responseHeaders: updatedDelivery.responseHeaders,
        }),
        ...(updatedDelivery.deliveredAt && { deliveredAt: updatedDelivery.deliveredAt }),
        ...(updatedDelivery.duration !== undefined && { duration: updatedDelivery.duration }),
        attempts: updatedDelivery.attempt,
        maxAttempts: updatedDelivery.maxAttempts,
        ...(updatedDelivery.nextRetryAt && { nextRetryAt: updatedDelivery.nextRetryAt }),
        createdAt: updatedDelivery.createdAt,
      };
    });
  }

  // Private helper methods
  private validateCreateWebhookRequest(request: CreateWebhookRequest): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('workspaceId', 'Workspace ID'),
      new RequiredFieldValidationRule('name', 'Webhook Name'),
      new RequiredFieldValidationRule('url', 'Webhook URL'),
      new RequiredFieldValidationRule('events', 'Events'),
      new RequiredFieldValidationRule('createdBy', 'Created By'),
      new LengthValidationRule('name', 1, 100, 'Webhook Name'),
    ]);
  }

  private validateUpdateWebhookRequest(request: UpdateWebhookRequest): ValidationResult {
    const rules: any[] = [
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

  private buildDeliveryHeaders(webhook: Webhook, event: WebhookEventData): Record<string, string> {
    const timestamp = Math.floor(event.timestamp.getTime() / 1000).toString();
    const payload = JSON.stringify(event.data);
    const signature = this.generateSignature(payload, webhook.secret || '', timestamp);

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

  private generateSignature(payload: string, secret: string, timestamp: string): string {
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
    return `sha256=${signature}`;
  }

  private async makeHttpRequest(
    _url: string,
    _method: string,
    _payload: any,
    _headers: Record<string, string>,
    _timeout: number
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

  private async canUserManageWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return !!member && (member.role === 'ADMIN' || member.role === 'OWNER');
  }

  private async canUserViewWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return member !== null;
  }

  private async mapWebhookToDto(webhook: Webhook): Promise<WebhookDto> {
    const stats = await this.webhookRepository.getWebhookStatistics(new WebhookId(webhook.id));

    return {
      id: webhook.id,
      workspaceId: webhook.workspaceId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events.map((event) => event.toString()),
      isActive: webhook.status === WebhookStatus.ACTIVE,
      ...(stats.lastDeliveryAt && { lastDeliveryAt: stats.lastDeliveryAt }),
      ...(stats.lastDeliveryStatus && { lastDeliveryStatus: stats.lastDeliveryStatus }),
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

  protected override delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
