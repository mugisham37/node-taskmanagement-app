import { DomainEvent } from '../../domain/events/domain-event';
import { DomainEventBus, EventHandler } from './domain-event-bus';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { MetricsService } from '../../infrastructure/monitoring/metrics-service';

/**
 * Event Handler Lifecycle Manager
 *
 * Manages the registration, lifecycle, and health of event handlers
 * throughout the application, ensuring proper event processing and
 * error handling.
 */
export class EventHandlerLifecycleManager {
  private registeredHandlers = new Map<string, EventHandlerRegistration[]>();
  private handlerInstances = new Map<string, EventHandler>();
  private isInitialized = false;

  constructor(
    private readonly domainEventBus: DomainEventBus,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Initialize the event handler lifecycle manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register all application event handlers
      await this.registerApplicationEventHandlers();

      // Register domain event handlers
      await this.registerDomainEventHandlers();

      // Register cross-cutting concern handlers
      await this.registerCrossCuttingHandlers();

      this.isInitialized = true;
      this.logger.info('Event handler lifecycle manager initialized', {
        totalHandlers: this.handlerInstances.size,
        eventTypes: Array.from(this.registeredHandlers.keys()),
      });
    } catch (error) {
      this.logger.error(
        'Failed to initialize event handler lifecycle manager',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Register an event handler
   */
  registerHandler<T extends DomainEvent>(
    eventName: string,
    handlerClass: new (...args: any[]) => EventHandler<T>,
    dependencies: any[] = [],
    options: EventHandlerOptions = {}
  ): void {
    const handlerId = `${eventName}_${handlerClass.name}`;

    // Create handler instance
    const handler = new handlerClass(...dependencies);

    // Store handler instance
    this.handlerInstances.set(handlerId, handler);

    // Register with event bus
    const subscription = this.domainEventBus.subscribe(eventName, handler);

    // Store registration info
    if (!this.registeredHandlers.has(eventName)) {
      this.registeredHandlers.set(eventName, []);
    }

    this.registeredHandlers.get(eventName)!.push({
      handlerId,
      handlerClass,
      handler,
      subscription,
      options,
      registeredAt: new Date(),
      isActive: true,
    });

    this.logger.debug('Event handler registered', {
      eventName,
      handlerId,
      handlerClass: handlerClass.name,
      options,
    });
  }

  /**
   * Unregister an event handler
   */
  unregisterHandler(eventName: string, handlerId: string): void {
    const handlers = this.registeredHandlers.get(eventName);
    if (!handlers) {
      return;
    }

    const handlerIndex = handlers.findIndex(h => h.handlerId === handlerId);
    if (handlerIndex === -1) {
      return;
    }

    const registration = handlers[handlerIndex];
    if (!registration) {
      this.logger.warn('Handler registration not found during unregister', {
        eventName,
        handlerId,
      });
      return;
    }

    // Unsubscribe from event bus
    registration.subscription.unsubscribe();

    // Remove from collections
    handlers.splice(handlerIndex, 1);
    this.handlerInstances.delete(handlerId);

    // Clean up empty event arrays
    if (handlers.length === 0) {
      this.registeredHandlers.delete(eventName);
    }

    this.logger.debug('Event handler unregistered', {
      eventName,
      handlerId,
    });
  }

  /**
   * Get handler statistics
   */
  getHandlerStatistics(): HandlerStatistics {
    const totalHandlers = this.handlerInstances.size;
    const activeHandlers = Array.from(this.registeredHandlers.values())
      .flat()
      .filter(h => h.isActive).length;

    const handlersByEvent = new Map<string, number>();
    this.registeredHandlers.forEach((handlers, eventName) => {
      handlersByEvent.set(eventName, handlers.length);
    });

    return {
      totalHandlers,
      activeHandlers,
      inactiveHandlers: totalHandlers - activeHandlers,
      eventTypes: Array.from(this.registeredHandlers.keys()),
      handlersByEvent: Object.fromEntries(handlersByEvent),
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Health check for event handlers
   */
  async performHealthCheck(): Promise<HandlerHealthStatus> {
    const healthResults: HandlerHealthResult[] = [];

    for (const [eventName, handlers] of this.registeredHandlers) {
      for (const registration of handlers) {
        try {
          // Check if handler is responsive
          const isHealthy = await this.checkHandlerHealth(registration.handler);

          healthResults.push({
            handlerId: registration.handlerId,
            eventName,
            isHealthy,
            lastChecked: new Date(),
          });
        } catch (error) {
          healthResults.push({
            handlerId: registration.handlerId,
            eventName,
            isHealthy: false,
            lastChecked: new Date(),
            error: (error as Error).message,
          });
        }
      }
    }

    const healthyCount = healthResults.filter(r => r.isHealthy).length;
    const totalCount = healthResults.length;

    return {
      isHealthy: healthyCount === totalCount,
      healthyHandlers: healthyCount,
      totalHandlers: totalCount,
      results: healthResults,
    };
  }

  /**
   * Register application event handlers
   */
  private async registerApplicationEventHandlers(): Promise<void> {
    // Task-related event handlers
    this.registerHandler(
      'TaskCreated',
      TaskCreatedHandler,
      [], // Dependencies would be injected here
      { priority: 1, retryOnFailure: true }
    );

    this.registerHandler('TaskCompleted', TaskCompletedHandler, [], {
      priority: 1,
      retryOnFailure: true,
    });

    this.registerHandler('TaskAssigned', TaskAssignedHandler, [], {
      priority: 2,
      retryOnFailure: true,
    });

    // Project-related event handlers
    this.registerHandler('ProjectCreated', ProjectCreatedHandler, [], {
      priority: 1,
      retryOnFailure: true,
    });

    this.registerHandler('ProjectMemberAdded', ProjectMemberAddedHandler, [], {
      priority: 2,
      retryOnFailure: true,
    });

    // User-related event handlers
    this.registerHandler('UserRegistered', UserRegisteredHandler, [], {
      priority: 1,
      retryOnFailure: true,
    });

    // Workspace-related event handlers
    this.registerHandler('WorkspaceCreated', WorkspaceCreatedHandler, [], {
      priority: 1,
      retryOnFailure: true,
    });

    this.logger.info('Application event handlers registered');
  }

  /**
   * Register domain event handlers
   */
  private async registerDomainEventHandlers(): Promise<void> {
    // Notification-related event handlers
    this.registerHandler(
      'NotificationCreated',
      NotificationCreatedHandler,
      [],
      { priority: 1, retryOnFailure: true }
    );

    // Audit-related event handlers
    this.registerHandler('AuditLogCreated', AuditLogCreatedHandler, [], {
      priority: 3,
      retryOnFailure: false,
    });

    // Webhook-related event handlers
    this.registerHandler('WebhookTriggered', WebhookTriggeredHandler, [], {
      priority: 2,
      retryOnFailure: true,
    });

    this.logger.info('Domain event handlers registered');
  }

  /**
   * Register cross-cutting concern handlers
   */
  private async registerCrossCuttingHandlers(): Promise<void> {
    // Metrics collection handler
    this.registerHandler(
      '*', // Wildcard for all events
      MetricsCollectionHandler,
      [this.metrics],
      { priority: 10, retryOnFailure: false }
    );

    // Audit logging handler
    this.registerHandler(
      '*', // Wildcard for all events
      AuditLoggingHandler,
      [],
      { priority: 9, retryOnFailure: false }
    );

    this.logger.info('Cross-cutting concern handlers registered');
  }

  /**
   * Check if a handler is healthy
   */
  private async checkHandlerHealth(handler: EventHandler): Promise<boolean> {
    try {
      // If handler has a health check method, use it
      if (
        'healthCheck' in handler &&
        typeof handler.healthCheck === 'function'
      ) {
        return await (handler as any).healthCheck();
      }

      // Otherwise, assume healthy if handler exists
      return handler !== null && handler !== undefined;
    } catch (error) {
      this.logger.warn('Handler health check failed', {
        handlerName: handler.constructor.name,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Shutdown all event handlers
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down event handler lifecycle manager...');

      // Unregister all handlers
      for (const [_eventName, handlers] of this.registeredHandlers) {
        for (const registration of handlers) {
          registration.subscription.unsubscribe();
        }
      }

      // Clear all collections
      this.registeredHandlers.clear();
      this.handlerInstances.clear();
      this.isInitialized = false;

      this.logger.info(
        'Event handler lifecycle manager shut down successfully'
      );
    } catch (error) {
      this.logger.error(
        'Error during event handler lifecycle manager shutdown',
        error as Error
      );
      throw error;
    }
  }
}

// Placeholder event handler classes (these would be implemented elsewhere)
class TaskCreatedHandler implements EventHandler {
  priority = 1;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'TaskCreated';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class TaskCompletedHandler implements EventHandler {
  priority = 1;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'TaskCompleted';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class TaskAssignedHandler implements EventHandler {
  priority = 2;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'TaskAssigned';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class ProjectCreatedHandler implements EventHandler {
  priority = 1;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'ProjectCreated';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class ProjectMemberAddedHandler implements EventHandler {
  priority = 2;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'ProjectMemberAdded';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class UserRegisteredHandler implements EventHandler {
  priority = 1;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'UserRegistered';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class WorkspaceCreatedHandler implements EventHandler {
  priority = 1;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'WorkspaceCreated';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class NotificationCreatedHandler implements EventHandler {
  priority = 1;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'NotificationCreated';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class AuditLogCreatedHandler implements EventHandler {
  priority = 3;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'AuditLogCreated';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class WebhookTriggeredHandler implements EventHandler {
  priority = 2;

  canHandle(event: DomainEvent): boolean {
    return event.getEventName() === 'WebhookTriggered';
  }

  async handle(_event: DomainEvent): Promise<void> {
    // Implementation would go here
  }
}

class MetricsCollectionHandler implements EventHandler {
  priority = 10;

  constructor(private readonly metrics: MetricsService) {}

  canHandle(_event: DomainEvent): boolean {
    return true; // Handle all events
  }

  async handle(event: DomainEvent): Promise<void> {
    this.metrics.incrementCounter('domain_events_total', {
      eventType: event.getEventName(),
    });
  }
}

class AuditLoggingHandler implements EventHandler {
  priority = 9;

  canHandle(_event: DomainEvent): boolean {
    return true; // Handle all events
  }

  async handle(event: DomainEvent): Promise<void> {
    // Log event for audit purposes
    console.log(`Audit: ${event.getEventName()} occurred at ${event.occurredAt}`);
  }
}

// Types and interfaces
interface EventHandlerOptions {
  priority?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  timeout?: number;
}

interface EventHandlerRegistration {
  handlerId: string;
  handlerClass: new (...args: any[]) => EventHandler;
  handler: EventHandler;
  subscription: { unsubscribe(): void; isActive(): boolean };
  options: EventHandlerOptions;
  registeredAt: Date;
  isActive: boolean;
}

interface HandlerStatistics {
  totalHandlers: number;
  activeHandlers: number;
  inactiveHandlers: number;
  eventTypes: string[];
  handlersByEvent: Record<string, number>;
  isInitialized: boolean;
}

interface HandlerHealthResult {
  handlerId: string;
  eventName: string;
  isHealthy: boolean;
  lastChecked: Date;
  error?: string;
}

interface HandlerHealthStatus {
  isHealthy: boolean;
  healthyHandlers: number;
  totalHandlers: number;
  results: HandlerHealthResult[];
}
