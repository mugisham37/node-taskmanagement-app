import {
  DomainEventBus,
  InMemoryDomainEventBus,
  IntegrationEventBus,
  DefaultIntegrationEventBus,
  WebSocketEventBus,
  DefaultWebSocketEventBus,
  EventStore,
  InMemoryEventStore,
  UnifiedEventSystem,
  DefaultUnifiedEventSystem,
  WebhookDeliveryService,
} from '@/shared/events';
import { TaskEventHandler } from '@/application/events/handlers/task-event-handlers';
import { logger } from '@/infrastructure/logging/logger';

export interface EventSystemConfig {
  enableEventStore?: boolean;
  enableWebhooks?: boolean;
  enableWebSocketBridge?: boolean;
  enableIntegrationBridge?: boolean;
  eventStoreConfig?: {
    type: 'memory' | 'database';
    connectionString?: string;
  };
  webhookConfig?: {
    retryAttempts?: number;
    retryDelay?: number;
    timeout?: number;
  };
}

export class EventSystemFactory {
  static create(config: EventSystemConfig = {}): UnifiedEventSystem {
    logger.info('Creating unified event system', { config });

    // Create event store if enabled
    let eventStore: EventStore | undefined;
    if (config.enableEventStore) {
      eventStore = new InMemoryEventStore();
      logger.info('Event store created', { type: 'memory' });
    }

    // Create domain event bus
    const domainEventBus: DomainEventBus = new InMemoryDomainEventBus(
      eventStore
    );
    logger.info('Domain event bus created');

    // Create webhook delivery service if enabled
    let webhookService: WebhookDeliveryService | undefined;
    if (config.enableWebhooks) {
      webhookService = new WebhookDeliveryService();
      logger.info('Webhook delivery service created');
    }

    // Create integration event bus
    const integrationEventBus: IntegrationEventBus =
      new DefaultIntegrationEventBus(
        webhookService || new WebhookDeliveryService()
      );
    logger.info('Integration event bus created');

    // Create WebSocket event bus
    const websocketEventBus: WebSocketEventBus = new DefaultWebSocketEventBus();
    logger.info('WebSocket event bus created');

    // Create unified event system
    const unifiedEventSystem = new DefaultUnifiedEventSystem(
      domainEventBus,
      integrationEventBus,
      websocketEventBus,
      eventStore
    );

    // Register default event handlers
    this.registerDefaultHandlers(unifiedEventSystem);

    // Enable bridges if configured
    if (config.enableWebSocketBridge) {
      unifiedEventSystem.enableDomainToWebSocketBridge();
      unifiedEventSystem.enableIntegrationToWebSocketBridge();
      logger.info('WebSocket bridges enabled');
    }

    if (config.enableIntegrationBridge) {
      unifiedEventSystem.enableDomainToIntegrationBridge();
      logger.info('Integration bridge enabled');
    }

    logger.info('Unified event system created successfully');
    return unifiedEventSystem;
  }

  private static registerDefaultHandlers(
    eventSystem: UnifiedEventSystem
  ): void {
    // Register task event handlers
    const taskEventHandler = new TaskEventHandler();

    // Subscribe to all task-related domain events
    eventSystem.subscribeToDomainEvent(
      class TaskCreatedEvent {
        static name = 'TaskCreatedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskAssignedEvent {
        static name = 'TaskAssignedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskStatusChangedEvent {
        static name = 'TaskStatusChangedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskCompletedEvent {
        static name = 'TaskCompletedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskDeletedEvent {
        static name = 'TaskDeletedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskCommentAddedEvent {
        static name = 'TaskCommentAddedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskDueDateChangedEvent {
        static name = 'TaskDueDateChangedEvent';
      } as any,
      taskEventHandler
    );

    eventSystem.subscribeToDomainEvent(
      class TaskPriorityChangedEvent {
        static name = 'TaskPriorityChangedEvent';
      } as any,
      taskEventHandler
    );

    logger.info('Default event handlers registered');
  }

  static createForTesting(): UnifiedEventSystem {
    return this.create({
      enableEventStore: true,
      enableWebhooks: false,
      enableWebSocketBridge: false,
      enableIntegrationBridge: false,
    });
  }

  static createForProduction(): UnifiedEventSystem {
    return this.create({
      enableEventStore: true,
      enableWebhooks: true,
      enableWebSocketBridge: true,
      enableIntegrationBridge: true,
      eventStoreConfig: {
        type: 'database',
      },
      webhookConfig: {
        retryAttempts: 3,
        retryDelay: 5000,
        timeout: 30000,
      },
    });
  }

  static createForDevelopment(): UnifiedEventSystem {
    return this.create({
      enableEventStore: true,
      enableWebhooks: true,
      enableWebSocketBridge: true,
      enableIntegrationBridge: true,
    });
  }
}
