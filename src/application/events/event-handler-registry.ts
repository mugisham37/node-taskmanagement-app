/**
 * Event Handler Registry
 *
 * This module provides a centralized registry for all event handlers,
 * enabling automatic registration and discovery of handlers for different event types.
 */

import { IContainer } from '@/infrastructure/ioc/container';
import { IDomainEventBus } from '@/shared/events/domain-event-bus';
import { IIntegrationEventBus } from '@/shared/events/integration-event-bus';
import { ILogger } from '@/shared/types/logger';

// Domain Event Handlers
import {
  TaskCreatedEventHandler,
  TaskAssignedEventHandler,
  TaskCompletedEventHandler,
  TaskStatusChangedEventHandler,
  TaskDeletedEventHandler,
  TaskMovedToProjectEventHandler,
} from './handlers/task-event-handlers';

// Integration Event Handlers
import {
  TaskCreatedIntegrationEventHandler,
  TaskCompletedIntegrationEventHandler,
  TaskAssignedIntegrationEventHandler,
  ProjectUpdatedIntegrationEventHandler,
  UserRegisteredIntegrationEventHandler,
} from './handlers/integration-event-handlers';

export interface EventHandlerRegistryConfig {
  enableDomainEventHandlers?: boolean;
  enableIntegrationEventHandlers?: boolean;
  enableMetrics?: boolean;
}

export class EventHandlerRegistry {
  private readonly logger: ILogger;
  private readonly domainEventBus: IDomainEventBus;
  private readonly integrationEventBus: IIntegrationEventBus;
  private isRegistered = false;

  constructor(
    private readonly container: IContainer,
    private readonly config: EventHandlerRegistryConfig = {}
  ) {
    this.logger = container.resolve<ILogger>('ILogger');
    this.domainEventBus = container.resolve<IDomainEventBus>('IDomainEventBus');
    this.integrationEventBus = container.resolve<IIntegrationEventBus>(
      'IIntegrationEventBus'
    );
  }

  /**
   * Registers all event handlers with their respective event buses
   */
  async registerAllHandlers(): Promise<void> {
    if (this.isRegistered) {
      this.logger.warn('Event handlers are already registered');
      return;
    }

    this.logger.info('Registering event handlers...');

    try {
      if (this.config.enableDomainEventHandlers !== false) {
        await this.registerDomainEventHandlers();
      }

      if (this.config.enableIntegrationEventHandlers !== false) {
        await this.registerIntegrationEventHandlers();
      }

      this.isRegistered = true;
      this.logger.info('All event handlers registered successfully');
    } catch (error) {
      this.logger.error('Failed to register event handlers', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Registers domain event handlers
   */
  private async registerDomainEventHandlers(): Promise<void> {
    this.logger.info('Registering domain event handlers...');

    const domainHandlers = [
      { name: 'TaskCreatedEventHandler', handler: TaskCreatedEventHandler },
      { name: 'TaskAssignedEventHandler', handler: TaskAssignedEventHandler },
      { name: 'TaskCompletedEventHandler', handler: TaskCompletedEventHandler },
      {
        name: 'TaskStatusChangedEventHandler',
        handler: TaskStatusChangedEventHandler,
      },
      { name: 'TaskDeletedEventHandler', handler: TaskDeletedEventHandler },
      {
        name: 'TaskMovedToProjectEventHandler',
        handler: TaskMovedToProjectEventHandler,
      },
    ];

    for (const { name, handler } of domainHandlers) {
      try {
        // Register handler in container if not already registered
        if (!this.container.isRegistered(name)) {
          this.container.registerTransient(name, handler);
        }

        // Resolve handler instance and subscribe to events
        const handlerInstance = this.container.resolve(name);
        await this.domainEventBus.subscribe(handlerInstance);

        this.logger.debug(`Domain event handler registered: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to register domain event handler: ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    this.logger.info('Domain event handlers registered successfully');
  }

  /**
   * Registers integration event handlers
   */
  private async registerIntegrationEventHandlers(): Promise<void> {
    this.logger.info('Registering integration event handlers...');

    const integrationHandlers = [
      {
        name: 'TaskCreatedIntegrationEventHandler',
        handler: TaskCreatedIntegrationEventHandler,
      },
      {
        name: 'TaskCompletedIntegrationEventHandler',
        handler: TaskCompletedIntegrationEventHandler,
      },
      {
        name: 'TaskAssignedIntegrationEventHandler',
        handler: TaskAssignedIntegrationEventHandler,
      },
      {
        name: 'ProjectUpdatedIntegrationEventHandler',
        handler: ProjectUpdatedIntegrationEventHandler,
      },
      {
        name: 'UserRegisteredIntegrationEventHandler',
        handler: UserRegisteredIntegrationEventHandler,
      },
    ];

    for (const { name, handler } of integrationHandlers) {
      try {
        // Register handler in container if not already registered
        if (!this.container.isRegistered(name)) {
          this.container.registerTransient(name, handler);
        }

        // Resolve handler instance and subscribe to events
        const handlerInstance = this.container.resolve(name);
        await this.integrationEventBus.subscribe(handlerInstance);

        this.logger.debug(`Integration event handler registered: ${name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register integration event handler: ${name}`,
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
        throw error;
      }
    }

    this.logger.info('Integration event handlers registered successfully');
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
      await this.integrationEventBus.clearSubscriptions();

      this.isRegistered = false;
      this.logger.info('All event handlers unregistered successfully');
    } catch (error) {
      this.logger.error('Failed to unregister event handlers', {
        error: error instanceof Error ? error.message : String(error),
      });
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
    integrationHandlers: number;
    totalSubscriptions: number;
  }> {
    const domainStats = await this.domainEventBus.getSubscriptionStats();
    const integrationStats =
      await this.integrationEventBus.getSubscriptionStats();

    return {
      domainHandlers: domainStats.handlerCount,
      integrationHandlers: integrationStats.handlerCount,
      totalSubscriptions:
        domainStats.subscriptionCount + integrationStats.subscriptionCount,
    };
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

    // Check domain event handlers
    const requiredDomainHandlers = [
      'TaskCreatedEventHandler',
      'TaskAssignedEventHandler',
      'TaskCompletedEventHandler',
      'TaskStatusChangedEventHandler',
      'TaskDeletedEventHandler',
      'TaskMovedToProjectEventHandler',
    ];

    for (const handlerName of requiredDomainHandlers) {
      if (!this.container.isRegistered(handlerName)) {
        missingHandlers.push(handlerName);
      }
    }

    // Check integration event handlers
    const requiredIntegrationHandlers = [
      'TaskCreatedIntegrationEventHandler',
      'TaskCompletedIntegrationEventHandler',
      'TaskAssignedIntegrationEventHandler',
      'ProjectUpdatedIntegrationEventHandler',
      'UserRegisteredIntegrationEventHandler',
    ];

    for (const handlerName of requiredIntegrationHandlers) {
      if (!this.container.isRegistered(handlerName)) {
        missingHandlers.push(handlerName);
      }
    }

    // Check event bus availability
    try {
      await this.domainEventBus.healthCheck();
    } catch (error) {
      errors.push(
        `Domain event bus health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      await this.integrationEventBus.healthCheck();
    } catch (error) {
      errors.push(
        `Integration event bus health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      isValid: missingHandlers.length === 0 && errors.length === 0,
      missingHandlers,
      errors,
    };
  }
}

/**
 * Factory function to create and configure the event handler registry
 */
export function createEventHandlerRegistry(
  container: IContainer,
  config: EventHandlerRegistryConfig = {}
): EventHandlerRegistry {
  return new EventHandlerRegistry(container, {
    enableDomainEventHandlers: true,
    enableIntegrationEventHandlers: true,
    enableMetrics: true,
    ...config,
  });
}

/**
 * Registers the event handler registry with the IoC container
 */
export function registerEventHandlerRegistry(
  container: IContainer,
  config: EventHandlerRegistryConfig = {}
): void {
  const registry = createEventHandlerRegistry(container, config);

  container.registerFactory(
    'EventHandlerRegistry',
    () => registry,
    'singleton' as any
  );
}
