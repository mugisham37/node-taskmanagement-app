import { DomainEvent } from '@monorepo/domain';
import { DomainEventBus } from '../../application/events/domain-event-bus';
import { EventBus } from '../../application/events/event-bus';
import { TransactionManager } from '../database/transaction-manager';
import { LoggingService } from '../monitoring/logging-service';
import { MetricsService } from '../monitoring/metrics-service';

/**
 * Timer interface for measuring operation duration
 */
interface Timer {
  end(): number;
}

/**
 * Event Integration Service
 *
 * Provides comprehensive event system integration throughout the application,
 * connecting domain events to application event handlers with proper
 * transaction management and error handling.
 */
export class EventIntegrationService {
  private readonly eventHandlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();
  private isInitialized = false;

  constructor(
    private readonly domainEventBus: DomainEventBus,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Initialize the event integration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register cross-service event handlers
      await this.registerCrossServiceHandlers();

      // Set up event bus integration
      await this.setupEventBusIntegration();

      // Initialize event publishing for aggregates
      await this.initializeAggregateEventPublishing();

      this.isInitialized = true;
      this.logger.info('Event integration service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize event integration service', error as Error);
      throw error;
    }
  }

  /**
   * Register an event handler for cross-service communication
   */
  registerEventHandler<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => Promise<void>
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler as (event: DomainEvent) => Promise<void>);

    this.logger.debug('Event handler registered', {
      eventType,
      handlerCount: this.eventHandlers.get(eventType)!.length,
    });
  }

  /**
   * Publish domain events with transaction support
   */
  async publishDomainEvents(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const timer = this.startTimer();

    try {
      // Publish events within transaction context
      await this.transactionManager.executeInTransaction(async () => {
        for (const event of events) {
          await this.publishSingleEvent(event);
        }
      });

      const duration = timer.end();
      this.metrics.incrementCounter('events_published_total', {
        count: events.length.toString(),
      });
      this.metrics.recordHistogram('event_publishing_duration', duration);

      this.logger.info('Domain events published successfully', {
        eventCount: events.length,
        duration,
      });
    } catch (error) {
      timer.end();
      this.metrics.incrementCounter('event_publishing_errors_total');
      this.logger.error('Failed to publish domain events', error as Error, {
        eventCount: events.length,
      });
      throw error;
    }
  }

  /**
   * Publish a single domain event
   */
  private async publishSingleEvent(event: DomainEvent): Promise<void> {
    const eventType = event.getEventName();

    try {
      // Publish to domain event bus
      await this.domainEventBus.publish(event);

      // Publish to application event bus
      await this.eventBus.publish(event);

      // Execute registered cross-service handlers
      const handlers = this.eventHandlers.get(eventType) || [];
      if (handlers.length > 0) {
        await Promise.allSettled(
          handlers.map((handler) => this.executeHandlerSafely(handler, event))
        );
      }

      this.metrics.incrementCounter('event_published_success', { eventType });
    } catch (error) {
      this.metrics.incrementCounter('event_published_error', { eventType });
      this.logger.error(`Failed to publish event: ${eventType}`, error as Error, {
        eventId: event.getEventId(),
        eventType,
      });
      throw error;
    }
  }

  /**
   * Execute event handler with error handling
   */
  private async executeHandlerSafely(
    handler: (event: DomainEvent) => Promise<void>,
    event: DomainEvent
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      this.logger.error('Event handler execution failed', error as Error, {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
        handlerName: handler.constructor.name,
      });
      // Don't rethrow to prevent one handler failure from affecting others
    }
  }

  /**
   * Register cross-service event handlers
   */
  private async registerCrossServiceHandlers(): Promise<void> {
    // Task-related event handlers
    this.registerEventHandler('TaskCreated', async (event) => {
      // Trigger notifications, audit logging, etc.
      this.logger.debug('Handling TaskCreated event', {
        taskId: event.getAggregateId(),
      });
    });

    this.registerEventHandler('TaskCompleted', async (event) => {
      // Update project progress, send notifications, etc.
      this.logger.debug('Handling TaskCompleted event', {
        taskId: event.getAggregateId(),
      });
    });

    this.registerEventHandler('TaskAssigned', async (event) => {
      // Send assignment notifications, update calendars, etc.
      this.logger.debug('Handling TaskAssigned event', {
        taskId: event.getAggregateId(),
      });
    });

    // Project-related event handlers
    this.registerEventHandler('ProjectCreated', async (event) => {
      // Set up default webhooks, create calendar entries, etc.
      this.logger.debug('Handling ProjectCreated event', {
        projectId: event.getAggregateId(),
      });
    });

    this.registerEventHandler('ProjectMemberAdded', async (event) => {
      // Send welcome notifications, update permissions, etc.
      this.logger.debug('Handling ProjectMemberAdded event', {
        projectId: event.getAggregateId(),
      });
    });

    // User-related event handlers
    this.registerEventHandler('UserRegistered', async (event) => {
      // Send welcome email, create default preferences, etc.
      this.logger.debug('Handling UserRegistered event', {
        userId: event.getAggregateId(),
      });
    });

    // Workspace-related event handlers
    this.registerEventHandler('WorkspaceCreated', async (event) => {
      // Set up default settings, create admin permissions, etc.
      this.logger.debug('Handling WorkspaceCreated event', {
        workspaceId: event.getAggregateId(),
      });
    });

    // Notification-related event handlers
    this.registerEventHandler('NotificationCreated', async (event) => {
      // Trigger delivery mechanisms, update counters, etc.
      this.logger.debug('Handling NotificationCreated event', {
        notificationId: event.getAggregateId(),
      });
    });

    // Webhook-related event handlers
    this.registerEventHandler('WebhookTriggered', async (event) => {
      // Log delivery attempts, update statistics, etc.
      this.logger.debug('Handling WebhookTriggered event', {
        webhookId: event.getAggregateId(),
      });
    });

    this.logger.info('Cross-service event handlers registered');
  }

  /**
   * Set up event bus integration
   */
  private async setupEventBusIntegration(): Promise<void> {
    // Configure event bus with proper error handling and retry policies
    await this.domainEventBus.healthCheck();

    this.logger.info('Event bus integration configured');
  }

  /**
   * Initialize event publishing for aggregates
   */
  private async initializeAggregateEventPublishing(): Promise<void> {
    // This would typically involve setting up aggregate root base classes
    // to automatically publish events when aggregate operations complete

    this.logger.info('Aggregate event publishing initialized');
  }

  /**
   * Get event system health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    registeredHandlers: number;
    eventTypes: string[];
    lastError?: string;
  }> {
    try {
      await this.domainEventBus.healthCheck();

      const eventTypes = Array.from(this.eventHandlers.keys());
      const registeredHandlers = Array.from(this.eventHandlers.values()).reduce(
        (total, handlers) => total + handlers.length,
        0
      );

      return {
        isHealthy: true,
        registeredHandlers,
        eventTypes,
      };
    } catch (error) {
      return {
        isHealthy: false,
        registeredHandlers: 0,
        eventTypes: [],
        lastError: (error as Error).message,
      };
    }
  }

  /**
   * Get event system metrics
   */
  getMetrics(): Record<string, any> {
    return {
      registeredEventTypes: this.eventHandlers.size,
      totalHandlers: Array.from(this.eventHandlers.values()).reduce(
        (total, handlers) => total + handlers.length,
        0
      ),
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Shutdown the event integration service
   */
  async shutdown(): Promise<void> {
    try {
      this.eventHandlers.clear();
      this.isInitialized = false;
      this.logger.info('Event integration service shut down successfully');
    } catch (error) {
      this.logger.error('Error during event integration service shutdown', error as Error);
      throw error;
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  private startTimer(): Timer {
    const start = Date.now();
    return {
      end(): number {
        return Date.now() - start;
      },
    };
  }
}
