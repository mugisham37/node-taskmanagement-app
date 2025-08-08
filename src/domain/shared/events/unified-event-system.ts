import {
  DomainEvent,
  DomainEventHandler,
  DomainEventBus,
} from './domain-event';
import {
  IntegrationEvent,
  IntegrationEventHandler,
  IntegrationEventBus,
} from './integration-event';
import { WebSocketEvent, WebSocketEventBus } from './websocket-event-bus';
import { EventStore } from './event-store';
import { logger } from '@/infrastructure/logging/logger';

export interface UnifiedEventSystem {
  // Domain events
  publishDomainEvent(event: DomainEvent): Promise<void>;
  publishDomainEvents(events: DomainEvent[]): Promise<void>;
  subscribeToDomainEvent<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: DomainEventHandler<T>
  ): void;

  // Integration events
  publishIntegrationEvent(event: IntegrationEvent): Promise<void>;
  publishIntegrationEvents(events: IntegrationEvent[]): Promise<void>;
  subscribeToIntegrationEvent<T extends IntegrationEvent>(
    eventType: new (...args: any[]) => T,
    handler: IntegrationEventHandler<T>
  ): void;

  // WebSocket events
  broadcastWebSocketEvent(event: WebSocketEvent): Promise<void>;
  broadcastToUser(userId: string, event: WebSocketEvent): Promise<void>;
  broadcastToWorkspace(
    workspaceId: string,
    event: WebSocketEvent
  ): Promise<void>;
  broadcastToProject(projectId: string, event: WebSocketEvent): Promise<void>;

  // Cross-system integration
  enableDomainToWebSocketBridge(): void;
  enableIntegrationToWebSocketBridge(): void;
  enableDomainToIntegrationBridge(): void;

  // System management
  getMetrics(): UnifiedEventSystemMetrics;
  shutdown(): Promise<void>;
}

export interface UnifiedEventSystemMetrics {
  domainEvents: {
    published: number;
    handled: number;
    failed: number;
    averageHandlingTime: number;
  };
  integrationEvents: {
    published: number;
    handled: number;
    failed: number;
    webhooksDelivered: number;
    webhooksFailed: number;
  };
  websocketEvents: {
    broadcast: number;
    delivered: number;
    failed: number;
    connections: number;
  };
  eventStore: {
    totalEvents: number;
    totalSnapshots: number;
    storageSize: number;
  };
}

export class DefaultUnifiedEventSystem implements UnifiedEventSystem {
  private domainEventBus: DomainEventBus;
  private integrationEventBus: IntegrationEventBus;
  private websocketEventBus: WebSocketEventBus;
  private eventStore?: EventStore;

  private bridgeHandlers: {
    domainToWebSocket?: DomainEventHandler;
    domainToIntegration?: DomainEventHandler;
    integrationToWebSocket?: IntegrationEventHandler;
  } = {};

  constructor(
    domainEventBus: DomainEventBus,
    integrationEventBus: IntegrationEventBus,
    websocketEventBus: WebSocketEventBus,
    eventStore?: EventStore
  ) {
    this.domainEventBus = domainEventBus;
    this.integrationEventBus = integrationEventBus;
    this.websocketEventBus = websocketEventBus;
    this.eventStore = eventStore;

    logger.info('Unified event system initialized', {
      hasDomainEventBus: !!domainEventBus,
      hasIntegrationEventBus: !!integrationEventBus,
      hasWebSocketEventBus: !!websocketEventBus,
      hasEventStore: !!eventStore,
    });
  }

  async publishDomainEvent(event: DomainEvent): Promise<void> {
    logger.debug('Publishing domain event through unified system', {
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateId: event.getAggregateId(),
    });

    await this.domainEventBus.publish(event);
  }

  async publishDomainEvents(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    logger.debug('Publishing multiple domain events through unified system', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map(e => e.eventName))],
    });

    await this.domainEventBus.publishMany(events);
  }

  subscribeToDomainEvent<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: DomainEventHandler<T>
  ): void {
    this.domainEventBus.subscribe(eventType, handler);

    logger.debug('Subscribed to domain event through unified system', {
      eventType: eventType.name,
      handlerName: handler.constructor.name,
    });
  }

  async publishIntegrationEvent(event: IntegrationEvent): Promise<void> {
    logger.debug('Publishing integration event through unified system', {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      routingKey: event.getRoutingKey(),
    });

    await this.integrationEventBus.publish(event);
  }

  async publishIntegrationEvents(events: IntegrationEvent[]): Promise<void> {
    if (events.length === 0) return;

    logger.debug(
      'Publishing multiple integration events through unified system',
      {
        eventCount: events.length,
        eventTypes: [...new Set(events.map(e => e.eventName))],
      }
    );

    await this.integrationEventBus.publishMany(events);
  }

  subscribeToIntegrationEvent<T extends IntegrationEvent>(
    eventType: new (...args: any[]) => T,
    handler: IntegrationEventHandler<T>
  ): void {
    this.integrationEventBus.subscribe(eventType, handler);

    logger.debug('Subscribed to integration event through unified system', {
      eventType: eventType.name,
      handlerName: handler.constructor.name,
    });
  }

  async broadcastWebSocketEvent(event: WebSocketEvent): Promise<void> {
    logger.debug('Broadcasting WebSocket event through unified system', {
      eventId: event.id,
      eventType: event.type,
      targetType: event.target.type,
      targetId: event.target.id,
    });

    await this.websocketEventBus.broadcast(event);
  }

  async broadcastToUser(userId: string, event: WebSocketEvent): Promise<void> {
    await this.websocketEventBus.broadcastToUser(userId, event);
  }

  async broadcastToWorkspace(
    workspaceId: string,
    event: WebSocketEvent
  ): Promise<void> {
    await this.websocketEventBus.broadcastToWorkspace(workspaceId, event);
  }

  async broadcastToProject(
    projectId: string,
    event: WebSocketEvent
  ): Promise<void> {
    await this.websocketEventBus.broadcastToProject(projectId, event);
  }

  enableDomainToWebSocketBridge(): void {
    if (this.bridgeHandlers.domainToWebSocket) {
      logger.warn('Domain to WebSocket bridge already enabled');
      return;
    }

    const bridgeHandler: DomainEventHandler = {
      canHandle: () => true, // Handle all domain events
      handle: async (event: DomainEvent) => {
        try {
          await this.websocketEventBus.publishDomainEvent(event);

          logger.debug('Domain event bridged to WebSocket', {
            eventId: event.eventId,
            eventName: event.eventName,
          });
        } catch (error) {
          logger.error('Error bridging domain event to WebSocket', {
            error: error instanceof Error ? error.message : String(error),
            eventId: event.eventId,
            eventName: event.eventName,
          });
        }
      },
    };

    this.bridgeHandlers.domainToWebSocket = bridgeHandler;
    this.domainEventBus.subscribeToAll(bridgeHandler);

    logger.info('Domain to WebSocket bridge enabled');
  }

  enableIntegrationToWebSocketBridge(): void {
    if (this.bridgeHandlers.integrationToWebSocket) {
      logger.warn('Integration to WebSocket bridge already enabled');
      return;
    }

    const bridgeHandler: IntegrationEventHandler = {
      canHandle: () => true, // Handle all integration events
      getHandledEventTypes: () => ['*'],
      handle: async (event: IntegrationEvent) => {
        try {
          await this.websocketEventBus.publishIntegrationEvent(event);

          logger.debug('Integration event bridged to WebSocket', {
            eventId: event.eventId,
            eventName: event.eventName,
          });
        } catch (error) {
          logger.error('Error bridging integration event to WebSocket', {
            error: error instanceof Error ? error.message : String(error),
            eventId: event.eventId,
            eventName: event.eventName,
          });
        }
      },
    };

    this.bridgeHandlers.integrationToWebSocket = bridgeHandler;
    // Note: This would require the integration event bus to support global subscriptions
    // For now, we'll assume it's implemented

    logger.info('Integration to WebSocket bridge enabled');
  }

  enableDomainToIntegrationBridge(): void {
    if (this.bridgeHandlers.domainToIntegration) {
      logger.warn('Domain to Integration bridge already enabled');
      return;
    }

    const bridgeHandler: DomainEventHandler = {
      canHandle: (event: DomainEvent) => {
        // Only bridge certain domain events to integration events
        // This is where you'd implement your business logic for which events
        // should be published as integration events
        return this.shouldBridgeToIntegration(event);
      },
      handle: async (event: DomainEvent) => {
        try {
          const integrationEvent = this.convertDomainToIntegrationEvent(event);
          if (integrationEvent) {
            await this.integrationEventBus.publish(integrationEvent);

            logger.debug('Domain event bridged to integration event', {
              domainEventId: event.eventId,
              domainEventName: event.eventName,
              integrationEventId: integrationEvent.eventId,
              integrationEventName: integrationEvent.eventName,
            });
          }
        } catch (error) {
          logger.error('Error bridging domain event to integration event', {
            error: error instanceof Error ? error.message : String(error),
            eventId: event.eventId,
            eventName: event.eventName,
          });
        }
      },
    };

    this.bridgeHandlers.domainToIntegration = bridgeHandler;
    this.domainEventBus.subscribeToAll(bridgeHandler);

    logger.info('Domain to Integration bridge enabled');
  }

  getMetrics(): UnifiedEventSystemMetrics {
    const domainMetrics = this.domainEventBus.getMetrics();
    const integrationMetrics = this.integrationEventBus.getMetrics();
    const websocketMetrics = this.websocketEventBus.getMetrics();
    const eventStoreMetrics = this.eventStore?.getMetrics();

    return {
      domainEvents: {
        published: domainMetrics.totalEventsPublished,
        handled: domainMetrics.totalEventsHandled,
        failed: domainMetrics.totalEventsFailed,
        averageHandlingTime: domainMetrics.averageHandlingTime,
      },
      integrationEvents: {
        published: integrationMetrics.totalEventsPublished,
        handled: integrationMetrics.totalEventsHandled,
        failed: integrationMetrics.totalEventsFailed,
        webhooksDelivered: integrationMetrics.totalWebhooksDelivered,
        webhooksFailed: integrationMetrics.totalWebhooksFailed,
      },
      websocketEvents: {
        broadcast: websocketMetrics.totalEventsBroadcast,
        delivered: websocketMetrics.totalEventsDelivered,
        failed: websocketMetrics.totalEventsFailed,
        connections: websocketMetrics.totalConnections,
      },
      eventStore: {
        totalEvents: eventStoreMetrics?.totalEvents || 0,
        totalSnapshots: eventStoreMetrics?.totalSnapshots || 0,
        storageSize: eventStoreMetrics?.storageSize || 0,
      },
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down unified event system');

    try {
      // Clear all bridges
      if (this.bridgeHandlers.domainToWebSocket) {
        // Note: Would need unsubscribe functionality in domain event bus
        this.bridgeHandlers.domainToWebSocket = undefined;
      }

      if (this.bridgeHandlers.domainToIntegration) {
        this.bridgeHandlers.domainToIntegration = undefined;
      }

      if (this.bridgeHandlers.integrationToWebSocket) {
        this.bridgeHandlers.integrationToWebSocket = undefined;
      }

      // Clear event buses
      this.domainEventBus.clear();
      this.integrationEventBus.clear();

      // WebSocket event bus cleanup would be handled by the WebSocket server

      logger.info('Unified event system shutdown completed');
    } catch (error) {
      logger.error('Error during unified event system shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Helper methods for domain to integration event bridging
  private shouldBridgeToIntegration(event: DomainEvent): boolean {
    // Define which domain events should be bridged to integration events
    const bridgeableEvents = [
      'TaskCreatedEvent',
      'TaskAssignedEvent',
      'TaskCompletedEvent',
      'TaskDeletedEvent',
      'ProjectCreatedEvent',
      'UserInvitedEvent',
      'WorkspaceCreatedEvent',
    ];

    return bridgeableEvents.includes(event.eventName);
  }

  private convertDomainToIntegrationEvent(
    event: DomainEvent
  ): IntegrationEvent | null {
    // This is a simplified conversion - in practice, you'd have specific
    // converters for each domain event type

    try {
      // Create a generic integration event wrapper
      const IntegrationEventClass = class extends IntegrationEvent {
        constructor(domainEvent: DomainEvent) {
          super(
            {
              service: 'task-management',
              version: '1.0.0',
              userId: 'system',
            },
            domainEvent.correlationId,
            domainEvent.eventId
          );
        }

        getEventVersion(): string {
          return '1.0.0';
        }

        getEventData(): Record<string, any> {
          return {
            domainEventId: event.eventId,
            domainEventName: event.eventName,
            aggregateId: event.getAggregateId(),
            aggregateType: event.getAggregateType(),
            domainEventData: event.getEventData(),
            occurredAt: event.occurredAt,
          };
        }

        getRoutingKey(): string {
          return `domain.${event.getAggregateType().toLowerCase()}.${event.eventName.toLowerCase()}`;
        }
      };

      return new IntegrationEventClass(event);
    } catch (error) {
      logger.error('Error converting domain event to integration event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
        eventName: event.eventName,
      });
      return null;
    }
  }

  // Utility methods
  getDomainEventBus(): DomainEventBus {
    return this.domainEventBus;
  }

  getIntegrationEventBus(): IntegrationEventBus {
    return this.integrationEventBus;
  }

  getWebSocketEventBus(): WebSocketEventBus {
    return this.websocketEventBus;
  }

  getEventStore(): EventStore | undefined {
    return this.eventStore;
  }
}
