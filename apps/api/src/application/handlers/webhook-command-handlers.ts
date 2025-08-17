/**
 * Webhook Command Handlers
 *
 * Handles commands for creating, updating, and triggering webhooks
 */

import { TransactionManager } from '@taskmanagement/database';
import * as crypto from 'crypto';
import { Webhook, WebhookStatus } from "@taskmanagement/domain";
import { validateWebhookEvents } from "@taskmanagement/domain";
import { WorkspaceRoleHelper } from "@taskmanagement/domain";
import { DomainEventPublisher } from "@taskmanagement/domain";
import { IWebhookRepository } from "@taskmanagement/domain";
import { IWorkspaceRepository } from "@taskmanagement/domain";
import { UserId } from "@taskmanagement/domain";
import { WebhookId } from "@taskmanagement/domain";
import { WorkspaceId } from "@taskmanagement/domain";
import { CacheService } from "@taskmanagement/cache";
import { LoggingService } from '@taskmanagement/observability';
import { AuthorizationError } from '../shared/errors/authorization-error';
import { NotFoundError } from '../shared/errors/not-found-error';
import { BaseHandler, ICommandHandler } from './base-handler';

// Command interfaces
export interface CreateWebhookCommand {
  workspaceId: WorkspaceId;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  createdBy: UserId;
}

export interface UpdateWebhookCommand {
  webhookId: WebhookId;
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  updatedBy: UserId;
}

export interface DeleteWebhookCommand {
  webhookId: WebhookId;
  deletedBy: UserId;
}

export interface TriggerWebhookCommand {
  webhookId: WebhookId;
  eventType: string;
  payload: any;
  triggeredBy: UserId;
}

export interface RetryWebhookDeliveryCommand {
  deliveryId: string;
  retriedBy: UserId;
}

export interface BulkUpdateWebhookStatusCommand {
  webhookIds: WebhookId[];
  isActive: boolean;
  updatedBy: UserId;
}

export interface TestWebhookCommand {
  webhookId: WebhookId;
  testedBy: UserId;
}

/**
 * Create webhook command handler
 */
export class CreateWebhookCommandHandler
  extends BaseHandler
  implements ICommandHandler<CreateWebhookCommand, WebhookId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CreateWebhookCommand): Promise<WebhookId> {
    this.logInfo('Creating webhook', {
      workspaceId: command.workspaceId.value,
      name: command.name,
      url: command.url,
      events: command.events,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify workspace exists and user has permission
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        const canCreate = await this.canUserManageWebhooks(command.createdBy, command.workspaceId);
        if (!canCreate) {
          throw new AuthorizationError('User does not have permission to create webhooks');
        }

        // Validate URL format
        if (!this.isValidUrl(command.url)) {
          throw new Error('Invalid webhook URL format');
        }

        // Validate and convert events
        const validWebhookEvents = validateWebhookEvents(command.events);

        // Generate secret if not provided
        const secret = command.secret || this.generateWebhookSecret();

        // Create webhook
        const webhook = Webhook.create({
          workspaceId: command.workspaceId.value,
          name: command.name,
          url: command.url,
          events: validWebhookEvents,
          secret,
          headers: command.headers || {},
          status: command.isActive !== false ? WebhookStatus.ACTIVE : WebhookStatus.INACTIVE,
          createdBy: command.createdBy.value,
          retryCount: 0,
          maxRetries: 3,
          timeout: 30000,
          failureCount: 0,
          maxFailures: 10,
          metadata: {},
        });

        await this.webhookRepository.save(webhook);

        // Clear workspace webhook cache
        await this.clearWebhookCaches(command.workspaceId);

        this.logInfo('Webhook created successfully', {
          webhookId: webhook.id,
          workspaceId: command.workspaceId.value,
          name: command.name,
        });

        return WebhookId.create(webhook.id);
      } catch (error) {
        this.logError('Failed to create webhook', error as Error, {
          workspaceId: command.workspaceId.value,
          name: command.name,
        });
        throw error;
      }
    });
  }

  private async canUserManageWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return member ? WorkspaceRoleHelper.canManageWebhooks(member.role) : false;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async clearWebhookCaches(workspaceId: WorkspaceId): Promise<void> {
    await this.cacheService.delete(`workspace-webhooks:${workspaceId.value}`);
  }
}

/**
 * Update webhook command handler
 */
export class UpdateWebhookCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateWebhookCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateWebhookCommand): Promise<void> {
    this.logInfo('Updating webhook', {
      webhookId: command.webhookId.value,
      updatedBy: command.updatedBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const webhook = await this.webhookRepository.findById(command.webhookId.value);
        if (!webhook) {
          throw new NotFoundError(`Webhook with ID ${command.webhookId.value} not found`);
        }

        // Check permissions
        const canUpdate = await this.canUserManageWebhooks(
          command.updatedBy,
          WorkspaceId.create(webhook.workspaceId)
        );
        if (!canUpdate) {
          throw new AuthorizationError('User does not have permission to update webhooks');
        }

        // Update webhook fields
        if (command.name !== undefined) {
          webhook.updateName(command.name);
        }
        if (command.url !== undefined) {
          if (!this.isValidUrl(command.url)) {
            throw new Error('Invalid webhook URL format');
          }
          webhook.updateUrl(command.url);
        }
        if (command.events !== undefined) {
          const validWebhookEvents = validateWebhookEvents(command.events);
          webhook.updateEvents(validWebhookEvents);
        }
        if (command.secret !== undefined) {
          webhook.updateSecret(command.secret);
        }
        if (command.headers !== undefined) {
          webhook.updateHeaders(command.headers);
        }
        if (command.isActive !== undefined) {
          if (command.isActive) {
            webhook.activate();
          } else {
            webhook.deactivate();
          }
        }

        await this.webhookRepository.save(webhook);

        // Clear caches
        await this.clearWebhookCaches(WorkspaceId.create(webhook.workspaceId));

        this.logInfo('Webhook updated successfully', {
          webhookId: command.webhookId.value,
        });
      } catch (error) {
        this.logError('Failed to update webhook', error as Error, {
          webhookId: command.webhookId.value,
        });
        throw error;
      }
    });
  }

  private async canUserManageWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return member ? WorkspaceRoleHelper.canManageWebhooks(member.role) : false;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async clearWebhookCaches(workspaceId: WorkspaceId): Promise<void> {
    await this.cacheService.delete(`workspace-webhooks:${workspaceId.value}`);
  }
}

/**
 * Delete webhook command handler
 */
export class DeleteWebhookCommandHandler
  extends BaseHandler
  implements ICommandHandler<DeleteWebhookCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: DeleteWebhookCommand): Promise<void> {
    this.logInfo('Deleting webhook', {
      webhookId: command.webhookId.value,
      deletedBy: command.deletedBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const webhook = await this.webhookRepository.findById(command.webhookId.value);
        if (!webhook) {
          throw new NotFoundError(`Webhook with ID ${command.webhookId.value} not found`);
        }

        // Check permissions
        const canDelete = await this.canUserManageWebhooks(
          command.deletedBy,
          WorkspaceId.create(webhook.workspaceId)
        );
        if (!canDelete) {
          throw new AuthorizationError('User does not have permission to delete webhooks');
        }

        await this.webhookRepository.delete(command.webhookId.value);

        // Clear caches
        await this.clearWebhookCaches(WorkspaceId.create(webhook.workspaceId));

        this.logInfo('Webhook deleted successfully', {
          webhookId: command.webhookId.value,
        });
      } catch (error) {
        this.logError('Failed to delete webhook', error as Error, {
          webhookId: command.webhookId.value,
        });
        throw error;
      }
    });
  }

  private async canUserManageWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return member ? WorkspaceRoleHelper.canManageWebhooks(member.role) : false;
  }

  private async clearWebhookCaches(workspaceId: WorkspaceId): Promise<void> {
    await this.cacheService.delete(`workspace-webhooks:${workspaceId.value}`);
  }
}

/**
 * Trigger webhook command handler
 */
export class TriggerWebhookCommandHandler
  extends BaseHandler
  implements ICommandHandler<TriggerWebhookCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: TriggerWebhookCommand): Promise<void> {
    this.logInfo('Triggering webhook', {
      webhookId: command.webhookId.value,
      eventType: command.eventType,
      triggeredBy: command.triggeredBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const webhook = await this.webhookRepository.findById(command.webhookId.value);
        if (!webhook) {
          throw new NotFoundError(`Webhook with ID ${command.webhookId.value} not found`);
        }

        // Check permissions
        const canTrigger = await this.canUserManageWebhooks(
          command.triggeredBy,
          WorkspaceId.create(webhook.workspaceId)
        );
        if (!canTrigger) {
          throw new AuthorizationError('User does not have permission to trigger webhooks');
        }

        // Check if webhook is active
        if (!webhook.isActive()) {
          throw new Error('Cannot trigger inactive webhook');
        }

        // Check if webhook listens to this event type
        const eventAsWebhookEvent = command.eventType as any; // Type assertion for compatibility
        if (!webhook.events.includes(eventAsWebhookEvent)) {
          throw new Error(`Webhook does not listen to event type: ${command.eventType}`);
        }

        // Create webhook delivery (simplified for now)
        const delivery = {
          id: crypto.randomUUID(),
          webhookId: webhook.id,
          eventType: command.eventType,
          payload: command.payload,
          status: 'pending' as const,
          attempt: 1,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Trigger actual delivery (would be handled by background job in real implementation)
        await this.deliverWebhook(delivery, webhook);

        this.logInfo('Webhook triggered successfully', {
          webhookId: command.webhookId.value,
          deliveryId: delivery.id,
          eventType: command.eventType,
        });
      } catch (error) {
        this.logError('Failed to trigger webhook', error as Error, {
          webhookId: command.webhookId.value,
          eventType: command.eventType,
        });
        throw error;
      }
    });
  }

  private async canUserManageWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return member ? WorkspaceRoleHelper.canManageWebhooks(member.role) : false;
  }

  private async deliverWebhook(delivery: any, webhook: any): Promise<void> {
    // This would be implemented with actual HTTP client
    this.logInfo('Webhook delivery simulated', {
      deliveryId: delivery.id,
      url: webhook.url,
    });
  }
}

/**
 * Test webhook command handler
 */
export class TestWebhookCommandHandler
  extends BaseHandler
  implements ICommandHandler<TestWebhookCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly webhookRepository: IWebhookRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: TestWebhookCommand): Promise<void> {
    this.logInfo('Testing webhook', {
      webhookId: command.webhookId.value,
      testedBy: command.testedBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const webhook = await this.webhookRepository.findById(command.webhookId.value);
        if (!webhook) {
          throw new NotFoundError(`Webhook with ID ${command.webhookId.value} not found`);
        }

        // Check permissions
        const canTest = await this.canUserManageWebhooks(
          command.testedBy,
          WorkspaceId.create(webhook.workspaceId)
        );
        if (!canTest) {
          throw new AuthorizationError('User does not have permission to test webhooks');
        }

        // Create test payload
        const testPayload = {
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString(),
          webhook: {
            id: webhook.id,
            name: webhook.name,
          },
          test: true,
        };

        // Create test delivery (simplified)
        const delivery = {
          id: crypto.randomUUID(),
          webhookId: webhook.id,
          eventType: 'webhook.test',
          payload: testPayload,
          status: 'pending' as const,
          attempt: 1,
          maxAttempts: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Attempt delivery
        await this.deliverWebhook(delivery, webhook);

        this.logInfo('Webhook test completed', {
          webhookId: command.webhookId.value,
          deliveryId: delivery.id,
        });
      } catch (error) {
        this.logError('Failed to test webhook', error as Error, {
          webhookId: command.webhookId.value,
        });
        throw error;
      }
    });
  }

  private async canUserManageWebhooks(userId: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    return member ? WorkspaceRoleHelper.canManageWebhooks(member.role) : false;
  }

  private async deliverWebhook(delivery: any, webhook: any): Promise<void> {
    // This would be implemented with actual HTTP client
    this.logInfo('Webhook delivery simulated', {
      deliveryId: delivery.id,
      url: webhook.url,
    });
  }
}

// Export aliases for backward compatibility
export const CreateWebhookHandler = CreateWebhookCommandHandler;
export const UpdateWebhookHandler = UpdateWebhookCommandHandler;
export const TriggerWebhookHandler = TriggerWebhookCommandHandler;

