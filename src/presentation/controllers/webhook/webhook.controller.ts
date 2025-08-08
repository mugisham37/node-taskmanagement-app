import { FastifyRequest, FastifyReply } from 'fastify';
import { Injectable } from '../../../application/decorators/injectable';
import { WebhookManagementService } from '../services/webhook-management.service';
import { WebhookDeliveryService } from '../services/webhook-delivery.service';
import { WebhookId } from '../value-objects/webhook-id';
import { WebhookDeliveryId } from '../value-objects/webhook-delivery-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { WebhookUrl } from '../value-objects/webhook-url';
import { WebhookSecret } from '../value-objects/webhook-secret';
import { WebhookEvent } from '../value-objects/webhook-event';
import { Logger } from '../../../infrastructure/logging/logger';
import { BaseController } from '../../../presentation/controllers/base.controller';
import { WebhookDeliveryStatus } from '../value-objects/webhook-delivery-status';
import { WebhookDeliveryStatus } from '../value-objects/webhook-delivery-status';

interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
}

interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  headers?: Record<string, string>;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
}

interface TestWebhookRequest {
  payload?: Record<string, any>;
}

@Injectable()
export class WebhookController extends BaseController {
  constructor(
    private readonly webhookManagementService: WebhookManagementService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly logger: Logger
  ) {
    super();
  }

  // Webhook Management Endpoints

  async createWebhook(
    request: FastifyRequest<{
      Body: CreateWebhookRequest;
      Params: { workspaceId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const userId = this.getUserId(request);
      const body = request.body;

      this.logger.info('Creating webhook', {
        workspaceId,
        userId: userId.value,
        name: body.name,
      });

      // Validate required fields
      if (!body.name || !body.url || !body.events || body.events.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name, URL, and events are required',
          },
        });
      }

      // Create webhook
      const webhook = await this.webhookManagementService.createWebhook({
        workspaceId: WorkspaceId.fromString(workspaceId),
        userId,
        name: body.name,
        url: WebhookUrl.fromString(body.url),
        events: body.events.map(e => WebhookEvent.fromString(e)),
        secret: body.secret ? WebhookSecret.fromString(body.secret) : undefined,
        headers: body.headers,
        httpMethod: body.httpMethod,
        contentType: body.contentType,
        signatureHeader: body.signatureHeader,
        signatureAlgorithm: body.signatureAlgorithm,
        timeout: body.timeout,
        maxRetries: body.maxRetries,
        retryDelay: body.retryDelay,
        metadata: body.metadata,
      });

      reply.status(201).send({
        success: true,
        data: {
          id: webhook.id.value,
          name: webhook.name,
          url: webhook.url.value,
          status: webhook.status.value,
          events: webhook.events.map(e => e.value),
          headers: webhook.headers,
          httpMethod: webhook.httpMethod,
          contentType: webhook.contentType,
          signatureHeader: webhook.signatureHeader,
          signatureAlgorithm: webhook.signatureAlgorithm,
          timeout: webhook.timeout,
          maxRetries: webhook.maxRetries,
          retryDelay: webhook.retryDelay,
          metadata: webhook.metadata,
          successCount: webhook.successCount,
          failureCount: webhook.failureCount,
          deliveryRate: webhook.deliveryRate,
          lastDeliveryAt: webhook.lastDeliveryAt,
          lastDeliveryStatus: webhook.lastDeliveryStatus,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create webhook', {
        error: error.message,
        workspaceId: request.params.workspaceId,
      });

      reply.status(400).send({
        success: false,
        error: {
          code: 'WEBHOOK_CREATION_FAILED',
          message: error.message,
        },
      });
    }
  }

  async getWebhooks(
    request: FastifyRequest<{
      Params: { workspaceId: string };
      Querystring: {
        page?: number;
        limit?: number;
        status?: string;
        event?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const userId = this.getUserId(request);

      const webhooks =
        await this.webhookManagementService.getWebhooksByWorkspace(
          WorkspaceId.fromString(workspaceId),
          userId
        );

      reply.send({
        success: true,
        data: webhooks.map(webhook => ({
          id: webhook.id.value,
          name: webhook.name,
          url: webhook.url.value,
          status: webhook.status.value,
          events: webhook.events.map(e => e.value),
          headers: webhook.headers,
          httpMethod: webhook.httpMethod,
          contentType: webhook.contentType,
          timeout: webhook.timeout,
          maxRetries: webhook.maxRetries,
          successCount: webhook.successCount,
          failureCount: webhook.failureCount,
          deliveryRate: webhook.deliveryRate,
          lastDeliveryAt: webhook.lastDeliveryAt,
          lastDeliveryStatus: webhook.lastDeliveryStatus,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
        })),
        meta: {
          total: webhooks.length,
        },
      });
    } catch (error) {
      this.logger.error('Failed to get webhooks', {
        error: error.message,
        workspaceId: request.params.workspaceId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_FETCH_FAILED',
          message: error.message,
        },
      });
    }
  }

  async getWebhook(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const userId = this.getUserId(request);

      const webhook = await this.webhookManagementService.getWebhook(
        WebhookId.fromString(webhookId),
        userId
      );

      reply.send({
        success: true,
        data: {
          id: webhook.id.value,
          name: webhook.name,
          url: webhook.url.value,
          status: webhook.status.value,
          events: webhook.events.map(e => e.value),
          headers: webhook.headers,
          httpMethod: webhook.httpMethod,
          contentType: webhook.contentType,
          signatureHeader: webhook.signatureHeader,
          signatureAlgorithm: webhook.signatureAlgorithm,
          timeout: webhook.timeout,
          maxRetries: webhook.maxRetries,
          retryDelay: webhook.retryDelay,
          metadata: webhook.metadata,
          successCount: webhook.successCount,
          failureCount: webhook.failureCount,
          deliveryRate: webhook.deliveryRate,
          lastDeliveryAt: webhook.lastDeliveryAt,
          lastDeliveryStatus: webhook.lastDeliveryStatus,
          lastError: webhook.lastError,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error('Failed to get webhook', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      const statusCode = error.message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        success: false,
        error: {
          code:
            statusCode === 404 ? 'WEBHOOK_NOT_FOUND' : 'WEBHOOK_FETCH_FAILED',
          message: error.message,
        },
      });
    }
  }

  async updateWebhook(
    request: FastifyRequest<{
      Body: UpdateWebhookRequest;
      Params: { workspaceId: string; webhookId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const userId = this.getUserId(request);
      const body = request.body;

      const updateRequest: any = {};

      if (body.name !== undefined) updateRequest.name = body.name;
      if (body.url !== undefined)
        updateRequest.url = WebhookUrl.fromString(body.url);
      if (body.events !== undefined) {
        updateRequest.events = body.events.map(e => WebhookEvent.fromString(e));
      }
      if (body.secret !== undefined) {
        updateRequest.secret = body.secret
          ? WebhookSecret.fromString(body.secret)
          : undefined;
      }
      if (body.headers !== undefined) updateRequest.headers = body.headers;
      if (body.httpMethod !== undefined)
        updateRequest.httpMethod = body.httpMethod;
      if (body.contentType !== undefined)
        updateRequest.contentType = body.contentType;
      if (body.signatureHeader !== undefined)
        updateRequest.signatureHeader = body.signatureHeader;
      if (body.signatureAlgorithm !== undefined)
        updateRequest.signatureAlgorithm = body.signatureAlgorithm;
      if (body.timeout !== undefined) updateRequest.timeout = body.timeout;
      if (body.maxRetries !== undefined)
        updateRequest.maxRetries = body.maxRetries;
      if (body.retryDelay !== undefined)
        updateRequest.retryDelay = body.retryDelay;
      if (body.metadata !== undefined) updateRequest.metadata = body.metadata;

      const webhook = await this.webhookManagementService.updateWebhook(
        WebhookId.fromString(webhookId),
        updateRequest,
        userId
      );

      reply.send({
        success: true,
        data: {
          id: webhook.id.value,
          name: webhook.name,
          url: webhook.url.value,
          status: webhook.status.value,
          events: webhook.events.map(e => e.value),
          headers: webhook.headers,
          httpMethod: webhook.httpMethod,
          contentType: webhook.contentType,
          signatureHeader: webhook.signatureHeader,
          signatureAlgorithm: webhook.signatureAlgorithm,
          timeout: webhook.timeout,
          maxRetries: webhook.maxRetries,
          retryDelay: webhook.retryDelay,
          metadata: webhook.metadata,
          successCount: webhook.successCount,
          failureCount: webhook.failureCount,
          deliveryRate: webhook.deliveryRate,
          lastDeliveryAt: webhook.lastDeliveryAt,
          lastDeliveryStatus: webhook.lastDeliveryStatus,
          updatedAt: webhook.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error('Failed to update webhook', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      const statusCode = error.message.includes('not found') ? 404 : 400;
      reply.status(statusCode).send({
        success: false,
        error: {
          code:
            statusCode === 404 ? 'WEBHOOK_NOT_FOUND' : 'WEBHOOK_UPDATE_FAILED',
          message: error.message,
        },
      });
    }
  }

  async deleteWebhook(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const userId = this.getUserId(request);

      await this.webhookManagementService.deleteWebhook(
        WebhookId.fromString(webhookId),
        userId
      );

      reply.status(204).send();
    } catch (error) {
      this.logger.error('Failed to delete webhook', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      const statusCode = error.message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        success: false,
        error: {
          code:
            statusCode === 404 ? 'WEBHOOK_NOT_FOUND' : 'WEBHOOK_DELETE_FAILED',
          message: error.message,
        },
      });
    }
  }

  // Webhook Testing and Debugging

  async testWebhook(
    request: FastifyRequest<{
      Body: TestWebhookRequest;
      Params: { workspaceId: string; webhookId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const userId = this.getUserId(request);
      const { payload } = request.body;

      const result = await this.webhookManagementService.testWebhook(
        WebhookId.fromString(webhookId),
        userId,
        payload
      );

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Failed to test webhook', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_TEST_FAILED',
          message: error.message,
        },
      });
    }
  }

  async validateWebhook(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const userId = this.getUserId(request);

      const result =
        await this.webhookManagementService.validateWebhookConfiguration(
          WebhookId.fromString(webhookId),
          userId
        );

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Failed to validate webhook', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_VALIDATION_FAILED',
          message: error.message,
        },
      });
    }
  }

  // Webhook Analytics

  async getWebhookStats(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string };
      Querystring: {
        from?: string;
        to?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const { from, to } = request.query;
      const userId = this.getUserId(request);

      const dateRange =
        from && to
          ? {
              from: new Date(from),
              to: new Date(to),
            }
          : undefined;

      const stats = await this.webhookManagementService.getWebhookStats(
        WebhookId.fromString(webhookId),
        userId,
        dateRange
      );

      reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.logger.error('Failed to get webhook stats', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_STATS_FAILED',
          message: error.message,
        },
      });
    }
  }

  async getWorkspaceWebhookStats(
    request: FastifyRequest<{
      Params: { workspaceId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const userId = this.getUserId(request);

      const stats =
        await this.webhookManagementService.getWorkspaceWebhookStats(
          WorkspaceId.fromString(workspaceId),
          userId
        );

      reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.logger.error('Failed to get workspace webhook stats', {
        error: error.message,
        workspaceId: request.params.workspaceId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WORKSPACE_WEBHOOK_STATS_FAILED',
          message: error.message,
        },
      });
    }
  }

  // Webhook Deliveries

  async getWebhookDeliveries(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string };
      Querystring: {
        page?: number;
        limit?: number;
        status?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const { page = 1, limit = 20, status, sortBy, sortOrder } = request.query;

      const result = await this.webhookDeliveryService.getDeliveriesByWebhook(
        WebhookId.fromString(webhookId),
        {
          limit,
          offset: (page - 1) * limit,
          status: status ? WebhookDeliveryStatus.fromString(status) : undefined,
          sortBy: sortBy as any,
          sortOrder,
        }
      );

      reply.send({
        success: true,
        data: result.deliveries.map(delivery => ({
          id: delivery.id.value,
          event: delivery.event.value,
          status: delivery.status.value,
          httpStatusCode: delivery.httpStatusCode,
          responseBody: delivery.responseBody,
          errorMessage: delivery.errorMessage,
          attemptCount: delivery.attemptCount,
          maxAttempts: delivery.maxAttempts,
          nextRetryAt: delivery.nextRetryAt,
          deliveredAt: delivery.deliveredAt,
          duration: delivery.duration,
          createdAt: delivery.createdAt,
          updatedAt: delivery.updatedAt,
        })),
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      this.logger.error('Failed to get webhook deliveries', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_DELIVERIES_FAILED',
          message: error.message,
        },
      });
    }
  }

  async retryWebhookDelivery(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string; deliveryId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { deliveryId } = request.params;

      const result = await this.webhookDeliveryService.retryFailedDelivery(
        WebhookDeliveryId.fromString(deliveryId)
      );

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Failed to retry webhook delivery', {
        error: error.message,
        deliveryId: request.params.deliveryId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_RETRY_FAILED',
          message: error.message,
        },
      });
    }
  }

  // Webhook Events and Configuration

  async getSupportedEvents(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const events = await this.webhookManagementService.getSupportedEvents();

      const eventsByCategory = events.reduce(
        (acc, event) => {
          const category = event.category;
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push({
            value: event.value,
            action: event.action,
          });
          return acc;
        },
        {} as Record<string, Array<{ value: string; action: string }>>
      );

      reply.send({
        success: true,
        data: {
          events: events.map(e => ({
            value: e.value,
            category: e.category,
            action: e.action,
          })),
          eventsByCategory,
        },
      });
    } catch (error) {
      this.logger.error('Failed to get supported events', {
        error: error.message,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'SUPPORTED_EVENTS_FAILED',
          message: error.message,
        },
      });
    }
  }

  async generateWebhookSecret(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const secret =
        await this.webhookManagementService.generateWebhookSecret();

      reply.send({
        success: true,
        data: {
          secret: secret.value,
        },
      });
    } catch (error) {
      this.logger.error('Failed to generate webhook secret', {
        error: error.message,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'SECRET_GENERATION_FAILED',
          message: error.message,
        },
      });
    }
  }

  async rotateWebhookSecret(
    request: FastifyRequest<{
      Params: { workspaceId: string; webhookId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { webhookId } = request.params;
      const userId = this.getUserId(request);

      const result = await this.webhookManagementService.rotateWebhookSecret(
        WebhookId.fromString(webhookId),
        userId
      );

      reply.send({
        success: true,
        data: {
          secret: result.newSecret.value,
          webhook: {
            id: result.webhook.id.value,
            updatedAt: result.webhook.updatedAt,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to rotate webhook secret', {
        error: error.message,
        webhookId: request.params.webhookId,
      });

      reply.status(500).send({
        success: false,
        error: {
          code: 'SECRET_ROTATION_FAILED',
          message: error.message,
        },
      });
    }
  }

  private getUserId(request: FastifyRequest): UserId {
    // This would typically extract the user ID from the JWT token or session
    // For now, we'll assume it's available in the request context
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return UserId.fromString(userId);
  }
}
