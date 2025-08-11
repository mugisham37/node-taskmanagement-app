import { DomainEvent } from '../../domain/events/domain-event';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface IEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface IEventBus {
  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: IEventHandler<T>
  ): void;
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

export class EventBus implements IEventBus {
  private readonly handlers = new Map<string, IEventHandler<any>[]>();

  constructor(private readonly logger: LoggingService) {}

  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: IEventHandler<T>
  ): void {
    const eventName = eventType.name;

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }

    this.handlers.get(eventName)!.push(handler);
    this.logger.info(`Event handler registered for ${eventName}`);
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventName = event.constructor.name;
    const handlers = this.handlers.get(eventName) || [];

    this.logger.info(`Publishing event: ${eventName}`, {
      eventId: event.getEventId(),
    });

    const promises = handlers.map(async handler => {
      try {
        await handler.handle(event);
        this.logger.info(`Event handler completed for ${eventName}`, {
          eventId: event.getEventId(),
        });
      } catch (error) {
        this.logger.error(`Event handler failed for ${eventName}`, error as Error, {
          eventId: event.getEventId(),
          handler: handler.constructor.name,
        });
        // Continue with other handlers even if one fails
      }
    });

    await Promise.allSettled(promises);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    this.logger.info(`Publishing ${events.length} events`);

    for (const event of events) {
      await this.publish(event);
    }

    this.logger.info(`Completed publishing ${events.length} events`);
  }
}
