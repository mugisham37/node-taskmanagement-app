import { Injectable } from '../decorators/injectable';
import {
  WebhookEventDispatcherService,
  EventPayloadBuilder,
  EventContext,
  DispatchOptions,
  DispatchResult,
} from '../../domain/webhook/services/webhook-event-dispatcher.service';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WorkspaceId } from '../../domain/task-management/value-objects/workspace-id';
import { UserId } from '../../domain/authentication/value-objects/user-id';
import { WebhookManagementService } from '../../domain/webhook/services/webhook-management.service';
import { WebhookDeliveryService } from '../../domain/webhook/services/webhook-delivery.service';
import { DomainEvent } from '../../domain/shared/events/domain-event';
import { Logger } from '../../infrastructure/logging/logger';

@Injectable()
export class WebhookEventDispatcherServiceImpl
  implements WebhookEventDispatcherService
{
  private payloadBuilders = new Map<string, EventPayloadBuilder>();

  constructor(
    private readonly webhookManagementService: WebhookManagementService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly logger: Logger
  ) {
    this.registerDefaultPayloadBuilders();
  }

  async dispatchEvent(
    eventType: WebhookEvent,
    payload: Record<string, any>,
    context: EventContext,
    options?: DispatchOptions
  ): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Dispatching webhook event', {
        eventType: eventType.value,
        workspaceId: context.workspaceId.value,
        userId: context.userId?.value,
        correlationId: context.correlationId,
      });

      // Get active webhooks for this event
      const webhooks =
        await this.webhookManagementService.getActiveWebhooksForEvent(
          eventType,
          context.workspaceId
        );

      if (webhooks.length === 0) {
        this.logger.debug('No active webhooks found for event', {
          eventType: eventType.value,
          workspaceId: context.workspaceId.value,
        });

        return {
          eventType,
          workspaceId: context.workspaceId,
          webhooksTriggered: 0,
          deliveryResults: {
            totalWebhooks: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            results: [],
          },
          processingTime: Date.now() - startTime,
          errors: [],
        };
      }

      // Build event payload
      const eventPayload = await this.buildEventPayload(
        eventType,
        payload,
        context
      );

      // Filter webhooks if specified
      const filteredWebhooks = options?.filterWebhooks
        ? webhooks.filter(webhook => options.filterWebhooks!(webhook.id.value))
        : webhooks;

      // Deliver to webhooks
      const deliveryResults =
        await this.webhookDeliveryService.deliverToMultipleWebhooks(
          filteredWebhooks,
          eventType,
          eventPayload,
          {
            priority: options?.priority,
            scheduledFor: options?.scheduledFor,
            maxRetries: options?.retryPolicy?.maxRetries,
            retryDelay: options?.retryPolicy?.retryDelay,
            metadata: {
              correlationId: context.correlationId,
              ...options?.metadata,
            },
          }
        );

      const processingTime = Date.now() - startTime;

      this.logger.info('Webhook event dispatched', {
        eventType: eventType.value,
        workspaceId: context.workspaceId.value,
        webhooksTriggered: filteredWebhooks.length,
        successfulDeliveries: deliveryResults.successfulDeliveries,
        failedDeliveries: deliveryResults.failedDeliveries,
        processingTime,
      });

      return {
        eventType,
        workspaceId: context.workspaceId,
        webhooksTriggered: filteredWebhooks.length,
        deliveryResults,
        processingTime,
        errors: [],
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Failed to dispatch webhook event', {
        eventType: eventType.value,
        workspaceId: context.workspaceId.value,
        error: error.message,
        processingTime,
      });

      return {
        eventType,
        workspaceId: context.workspaceId,
        webhooksTriggered: 0,
        deliveryResults: {
          totalWebhooks: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          results: [],
        },
        processingTime,
        errors: [error.message],
      };
    }
  }

  async dispatchDomainEvent(
    domainEvent: DomainEvent,
    context: EventContext,
    options?: DispatchOptions
  ): Promise<DispatchResult> {
    try {
      // Map domain event to webhook event
      const webhookEvent = this.mapDomainEventToWebhookEvent(domainEvent);
      if (!webhookEvent) {
        this.logger.debug('Domain event not mapped to webhook event', {
          domainEventType: domainEvent.eventType,
        });

        return {
          eventType: WebhookEvent.fromString('webhook.test'), // Placeholder
          workspaceId: context.workspaceId,
          webhooksTriggered: 0,
          deliveryResults: {
            totalWebhooks: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            results: [],
          },
          processingTime: 0,
          errors: ['Domain event not mapped to webhook event'],
        };
      }

      // Build payload from domain event
      const payload = await this.buildPayloadFromDomainEvent(
        domainEvent,
        context
      );

      return await this.dispatchEvent(webhookEvent, payload, context, options);
    } catch (error) {
      this.logger.error('Failed to dispatch domain event as webhook', {
        domainEventType: domainEvent.eventType,
        error: error.message,
      });

      return {
        eventType: WebhookEvent.fromString('webhook.test'), // Placeholder
        workspaceId: context.workspaceId,
        webhooksTriggered: 0,
        deliveryResults: {
          totalWebhooks: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          results: [],
        },
        processingTime: 0,
        errors: [error.message],
      };
    }
  }

  async dispatchMultipleEvents(
    events: Array<{
      eventType: WebhookEvent;
      payload: Record<string, any>;
      context: EventContext;
      options?: DispatchOptions;
    }>
  ): Promise<DispatchResult[]> {
    this.logger.info('Dispatching multiple webhook events', {
      eventCount: events.length,
    });

    const results: DispatchResult[] = [];

    for (const event of events) {
      try {
        const result = await this.dispatchEvent(
          event.eventType,
          event.payload,
          event.context,
          event.options
        );
        results.push(result);
      } catch (error) {
        this.logger.error('Failed to dispatch event in batch', {
          eventType: event.eventType.value,
          error: error.message,
        });

        results.push({
          eventType: event.eventType,
          workspaceId: event.context.workspaceId,
          webhooksTriggered: 0,
          deliveryResults: {
            totalWebhooks: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            results: [],
          },
          processingTime: 0,
          errors: [error.message],
        });
      }
    }

    return results;
  }

  registerPayloadBuilder(
    eventType: WebhookEvent,
    builder: EventPayloadBuilder
  ): void {
    this.payloadBuilders.set(eventType.value, builder);

    this.logger.debug('Registered payload builder', {
      eventType: eventType.value,
    });
  }

  async buildEventPayload(
    eventType: WebhookEvent,
    data: Record<string, any>,
    context: EventContext
  ): Promise<Record<string, any>> {
    const builder = this.payloadBuilders.get(eventType.value);

    if (builder) {
      // Use custom payload builder
      const domainEvent = {
        eventType: eventType.value,
        data,
        timestamp: context.timestamp,
        correlationId: context.correlationId,
      } as DomainEvent;

      return await builder.buildPayload(domainEvent, context);
    }

    // Use default payload structure
    return {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event: eventType.value,
      timestamp: context.timestamp.toISOString(),
      data,
      workspace: {
        id: context.workspaceId.value,
      },
      user: context.userId
        ? {
            id: context.userId.value,
          }
        : undefined,
      metadata: {
        version: '1.0',
        source: 'unified-enterprise-platform',
        correlationId: context.correlationId,
        ...context.metadata,
      },
    };
  }

  async getWebhooksForEvent(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId,
    filters?: {
      isActive?: boolean;
      hasRecentFailures?: boolean;
      minSuccessRate?: number;
    }
  ): Promise<
    Array<{
      webhookId: string;
      name: string;
      url: string;
      isHealthy: boolean;
      lastDeliveryAt?: Date;
    }>
  > {
    try {
      const webhooks =
        await this.webhookManagementService.getActiveWebhooksForEvent(
          eventType,
          workspaceId
        );

      return webhooks
        .filter(webhook => {
          if (
            filters?.isActive !== undefined &&
            webhook.isActive !== filters.isActive
          ) {
            return false;
          }

          if (
            filters?.minSuccessRate !== undefined &&
            webhook.deliveryRate < filters.minSuccessRate
          ) {
            return false;
          }

          if (filters?.hasRecentFailures !== undefined) {
            const hasRecentFailures = webhook.lastDeliveryStatus === 'failed';
            if (hasRecentFailures !== filters.hasRecentFailures) {
              return false;
            }
          }

          return true;
        })
        .map(webhook => ({
          webhookId: webhook.id.value,
          name: webhook.name,
          url: webhook.url.value,
          isHealthy: webhook.deliveryRate >= 95,
          lastDeliveryAt: webhook.lastDeliveryAt,
        }));
    } catch (error) {
      this.logger.error('Failed to get webhooks for event', {
        eventType: eventType.value,
        workspaceId: workspaceId.value,
        error: error.message,
      });

      return [];
    }
  }

  // Additional methods would be implemented here...
  // For brevity, I'm including the core methods

  private registerDefaultPayloadBuilders(): void {
    // Register default payload builders for common events

    // Task events
    this.registerPayloadBuilder(WebhookEvent.fromString('task.created'), {
      buildPayload: async (event: DomainEvent, context: EventContext) => ({
        id: `task-created-${Date.now()}`,
        event: 'task.created',
        timestamp: context.timestamp.toISOString(),
        data: {
          task: event.data,
          action: 'created',
        },
        workspace: { id: context.workspaceId.value },
        user: context.userId ? { id: context.userId.value } : undefined,
        metadata: {
          version: '1.0',
          source: 'unified-enterprise-platform',
          correlationId: context.correlationId,
        },
      }),
    });

    // Project events
    this.registerPayloadBuilder(WebhookEvent.fromString('project.created'), {
      buildPayload: async (event: DomainEvent, context: EventContext) => ({
        id: `project-created-${Date.now()}`,
        event: 'project.created',
        timestamp: context.timestamp.toISOString(),
        data: {
          project: event.data,
          action: 'created',
        },
        workspace: { id: context.workspaceId.value },
        user: context.userId ? { id: context.userId.value } : undefined,
        metadata: {
          version: '1.0',
          source: 'unified-enterprise-platform',
          correlationId: context.correlationId,
        },
      }),
    });

    // Add more payload builders as needed...
  }

  private mapDomainEventToWebhookEvent(
    domainEvent: DomainEvent
  ): WebhookEvent | null {
    // Map domain events to webhook events
    const eventMappings: Record<string, string> = {
      'task.created': 'task.created',
      'task.updated': 'task.updated',
      'task.deleted': 'task.deleted',
      'task.assigned': 'task.assigned',
      'task.completed': 'task.completed',
      'project.created': 'project.created',
      'project.updated': 'project.updated',
      'project.deleted': 'project.deleted',
      'workspace.created': 'workspace.created',
      'workspace.updated': 'workspace.updated',
      'user.created': 'user.created',
      'user.updated': 'user.updated',
      'comment.created': 'comment.created',
      'comment.updated': 'comment.updated',
      'notification.created': 'notification.created',
      // Add more mappings as needed...
    };

    const webhookEventType = eventMappings[domainEvent.eventType];
    return webhookEventType ? WebhookEvent.fromString(webhookEventType) : null;
  }

  private async buildPayloadFromDomainEvent(
    domainEvent: DomainEvent,
    context: EventContext
  ): Promise<Record<string, any>> {
    return {
      id: `domain-event-${Date.now()}`,
      event: domainEvent.eventType,
      timestamp: context.timestamp.toISOString(),
      data: domainEvent.data || {},
      workspace: { id: context.workspaceId.value },
      user: context.userId ? { id: context.userId.value } : undefined,
      metadata: {
        version: '1.0',
        source: 'unified-enterprise-platform',
        correlationId: context.correlationId,
        domainEvent: {
          type: domainEvent.eventType,
          timestamp: domainEvent.timestamp,
        },
      },
    };
  }
}
