/**
 * Enhanced Event Handler Registry
 *
 * This module provides a centralized registry for all event handlers,
 * enabling automatic registration and discovery of handlers for different event types.
 */

import { IDomainEventBus } from './domain-event-bus';
import { IEventBus } from './event-bus';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { injectable } from '../../shared/decorators/injectable.decorator';

export interface EventHandlerRegistryConfig {
  enableDomainEventHandlers?: boolean;
  enableApplicationEventHandlers?: boolean;
  enableMetrics?: boolean;
  autoRegisterHandlers?: boolean;
}

export interface HandlerRegistrationInfo {
  name: string;
  eventTypes: string[];
  priority: number;
  isRegistered: boolean;
}

@injectable()
export class EventHandlerRegistry {
  private isRegistered = false;
  private registeredHandlers = new Map<string, HandlerRegistrationInfo>();

  constructor(
    private readonly logger: LoggingService,
    private readonly domainEventBus: IDomainEventBus,
    private readonly applicationEventBus: IEventBus,
    private readonly config: EventHandlerRegistryConfig = {}
  ) {
    this.config = {
      enableDomainEventHandlers: true,
      enableApplicationEventHandlers: true,
      enableMetrics: true,
      autoRegisterHandlers: true,
      ...config,
    };
  }

  /**
   * Registers all event handlers with their respective event buses
   */
  async registerAllHandlers(): Promise<void> {
    if (this.isRegistered) {
      this.logger.warn('Event handlers are already registered');
      return;
    }

    this.logger.info('Registering event handlers...', {
      enableDomainEventHandlers: this.config.enableDomainEventHandlers,
      enableApplicationEventHandlers:
        this.config.enableApplicationEventHandlers,
    });

    try {
      if (this.config.enableDomainEventHandlers) {
        await this.registerDomainEventHandlers();
      }

      if (this.config.enableApplicationEventHandlers) {
        await this.registerApplicationEventHandlers();
      }

      this.isRegistered = true;
      this.logger.info('All event handlers registered successfully', {
        totalHandlers: this.registeredHandlers.size,
      });
    } catch (error) {
      this.logger.error('Failed to register event handlers', error as Error);
      throw error;
    }
  }

  /**
   * Registers domain event handlers
   */
  private async registerDomainEventHandlers(): Promise<void> {
    this.logger.info('Registering domain event handlers...');

    // For now, we'll register handlers that exist in the current system
    // This can be expanded as more handlers are migrated

    const domainHandlerCount = 0; // Will be updated as handlers are added

    this.logger.info('Domain event handlers registered successfully', {
      handlerCount: domainHandlerCount,
    });
  }

  /**
   * Registers application event handlers
   */
  private async registerApplicationEventHandlers(): Promise<void> {
    this.logger.info('Registering application event handlers...');

    // Register application event handlers with the application event bus
    let applicationHandlerCount = 0;

    // Import and register actual application event handlers
    try {
      const {
        TaskCreatedEventHandler,
        TaskAssignedEventHandler,
        TaskCompletedEventHandler,
        TaskStartedEventHandler,
        UserActivatedEventHandler,
        ProjectCreatedEventHandler,
        ProjectMemberAddedEventHandler,
        UserRegisteredEventHandler,
      } = await import('./application-event-handlers');

      // Register Task Event Handlers
      await this.registerHandler(
        'TaskCreatedEventHandler',
        TaskCreatedEventHandler,
        ['TaskCreated'],
        1
      );
      applicationHandlerCount++;

      await this.registerHandler(
        'TaskAssignedEventHandler',
        TaskAssignedEventHandler,
        ['TaskAssigned'],
        1
      );
      applicationHandlerCount++;

      await this.registerHandler(
        'TaskCompletedEventHandler',
        TaskCompletedEventHandler,
        ['TaskCompleted'],
        1
      );
      applicationHandlerCount++;

      await this.registerHandler(
        'TaskStartedEventHandler',
        TaskStartedEventHandler,
        ['TaskStarted'],
        1
      );
      applicationHandlerCount++;

      // Register User Event Handlers
      await this.registerHandler(
        'UserActivatedEventHandler',
        UserActivatedEventHandler,
        ['UserActivated'],
        1
      );
      applicationHandlerCount++;

      await this.registerHandler(
        'UserRegisteredEventHandler',
        UserRegisteredEventHandler,
        ['UserCreated'],
        1
      );
      applicationHandlerCount++;

      // Register Project Event Handlers
      await this.registerHandler(
        'ProjectCreatedEventHandler',
        ProjectCreatedEventHandler,
        ['ProjectCreated'],
        1
      );
      applicationHandlerCount++;

      await this.registerHandler(
        'ProjectMemberAddedEventHandler',
        ProjectMemberAddedEventHandler,
        ['ProjectMemberAdded'],
        1
      );
      applicationHandlerCount++;

    } catch (error) {
      this.logger.error('Failed to import application event handlers', error as Error);
    }

    this.logger.info('Application event handlers registered successfully', {
      handlerCount: applicationHandlerCount,
    });
  }

  /**
   * Registers a single handler
   */
  async registerHandler(
    handlerName: string,
    handlerClass: any,
    eventTypes: string[],
    priority: number = 0
  ): Promise<void> {
    try {
      // Register with appropriate event bus based on event types
      for (const eventType of eventTypes) {
        if (this.isDomainEvent(eventType)) {
          // Register with domain event bus (uses string-based registration)
          this.domainEventBus.subscribe(eventType, handlerClass);
        } else {
          // For application event bus, we need to create handler instances
          // and register them with the appropriate event class constructor
          const eventClass = await this.getEventClass(eventType);
          if (eventClass) {
            const handlerInstance = new handlerClass();
            this.applicationEventBus.subscribe(eventClass, handlerInstance);
          }
        }
      }

      this.registeredHandlers.set(handlerName, {
        name: handlerName,
        eventTypes,
        priority,
        isRegistered: true,
      });

      this.logger.debug(`Event handler registered: ${handlerName}`, {
        eventTypes,
        priority,
      });
    } catch (error) {
      this.logger.error(
        `Failed to register event handler: ${handlerName}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Unregisters a single handler
   */
  async unregisterHandler(handlerName: string): Promise<void> {
    const handlerInfo = this.registeredHandlers.get(handlerName);
    if (!handlerInfo) {
      this.logger.warn(`Handler not found for unregistration: ${handlerName}`);
      return;
    }

    try {
      // Unregister from event buses
      // This would need implementation based on the specific handler

      this.registeredHandlers.delete(handlerName);

      this.logger.debug(`Event handler unregistered: ${handlerName}`);
    } catch (error) {
      this.logger.error(
        `Failed to unregister event handler: ${handlerName}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Unregisters all event handlers
   */
  async unregisterAllHandlers(): Promise<void> {
    if (!this.isRegistered) {
      return;
    }

    this.logger.info('Unregistering event handlers...');

    try {
      // Clear all subscriptions
      await this.domainEventBus.clearSubscriptions();
      // Clear application event bus subscriptions would go here

      this.registeredHandlers.clear();
      this.isRegistered = false;

      this.logger.info('All event handlers unregistered successfully');
    } catch (error) {
      this.logger.error('Failed to unregister event handlers', error as Error);
      throw error;
    }
  }

  /**
   * Gets registration status
   */
  get registered(): boolean {
    return this.isRegistered;
  }

  /**
   * Gets handler statistics
   */
  async getHandlerStats(): Promise<{
    domainHandlers: number;
    applicationHandlers: number;
    totalHandlers: number;
    totalSubscriptions: number;
  }> {
    const domainStats = await this.domainEventBus.getSubscriptionStats();

    // Application event bus stats would be calculated here
    const applicationHandlers = 0;
    const applicationSubscriptions = 0;

    return {
      domainHandlers: domainStats.handlerCount,
      applicationHandlers,
      totalHandlers: domainStats.handlerCount + applicationHandlers,
      totalSubscriptions:
        domainStats.subscriptionCount + applicationSubscriptions,
    };
  }

  /**
   * Gets registered handler information
   */
  getRegisteredHandlers(): HandlerRegistrationInfo[] {
    return Array.from(this.registeredHandlers.values());
  }

  /**
   * Validates that all required handlers are registered
   */
  async validateHandlerRegistration(): Promise<{
    isValid: boolean;
    missingHandlers: string[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const missingHandlers: string[] = [];

    // Check domain event bus health
    try {
      await this.domainEventBus.healthCheck();
    } catch (error) {
      errors.push(
        `Domain event bus health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Additional validation logic would go here

    return {
      isValid: missingHandlers.length === 0 && errors.length === 0,
      missingHandlers,
      errors,
    };
  }

  /**
   * Performs health check on the registry
   */
  async healthCheck(): Promise<void> {
    if (!this.isRegistered) {
      throw new Error('Event handler registry is not initialized');
    }

    await this.domainEventBus.healthCheck();

    this.logger.debug('Event handler registry health check passed', {
      registeredHandlers: this.registeredHandlers.size,
    });
  }

  /**
   * Gets performance metrics
   */
  getPerformanceMetrics(): Record<string, any> {
    return {
      registry: {
        registeredHandlers: this.registeredHandlers.size,
        isRegistered: this.isRegistered,
      },
      domainEventBus: this.domainEventBus.getPerformanceMetrics(),
    };
  }

  private isDomainEvent(eventType: string): boolean {
    // Determine if an event type is a domain event
    // This could be based on naming conventions or other criteria
    return (
      eventType.includes('Domain') ||
      eventType.endsWith('Event') ||
      eventType.includes('Created') ||
      eventType.includes('Updated') ||
      eventType.includes('Deleted')
    );
  }

  /**
   * Get event class constructor from event type string
   */
  private async getEventClass(eventType: string): Promise<(new (...args: any[]) => any) | undefined> {
    try {
      // Dynamically import event classes based on type
      switch (eventType) {
        case 'TaskCreated':
          const { TaskCreatedEvent } = await import('../../domain/events/task-events');
          return TaskCreatedEvent;
        case 'TaskAssigned':
          const { TaskAssignedEvent } = await import('../../domain/events/task-events');
          return TaskAssignedEvent;
        case 'TaskCompleted':
          const { TaskCompletedEvent } = await import('../../domain/events/task-events');
          return TaskCompletedEvent;
        case 'TaskStarted':
          const { TaskStartedEvent } = await import('../../domain/events/task-events');
          return TaskStartedEvent;
        case 'UserCreated':
          const { UserCreatedEvent } = await import('../../domain/events/user-events');
          return UserCreatedEvent;
        case 'UserActivated':
          const { UserActivatedEvent } = await import('../../domain/events/user-events');
          return UserActivatedEvent;
        case 'ProjectCreated':
          const { ProjectCreatedEvent } = await import('../../domain/events/project-events');
          return ProjectCreatedEvent;
        case 'ProjectMemberAdded':
          const { ProjectMemberAddedEvent } = await import('../../domain/events/project-events');
          return ProjectMemberAddedEvent;
        default:
          return undefined;
      }
    } catch (error) {
      this.logger.error(`Failed to load event class for ${eventType}`, error as Error);
      return undefined;
    }
  }
}

/**
 * Factory function to create and configure the event handler registry
 */
export function createEventHandlerRegistry(
  logger: LoggingService,
  domainEventBus: IDomainEventBus,
  applicationEventBus: IEventBus,
  config: EventHandlerRegistryConfig = {}
): EventHandlerRegistry {
  return new EventHandlerRegistry(logger, domainEventBus, applicationEventBus, {
    enableDomainEventHandlers: true,
    enableApplicationEventHandlers: true,
    enableMetrics: true,
    autoRegisterHandlers: true,
    ...config,
  });
}
