import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseDomainEvent,
  DomainEventHandler,
} from '@/shared/domain/domain-event';
import {
  InMemoryDomainEventBus,
  resetEventBus,
  getEventBus,
} from '@/shared/domain/event-bus';

// Test event
class TestEvent extends BaseDomainEvent {
  constructor(data: Record<string, any>) {
    super({
      eventType: 'TestEvent',
      aggregateId: 'test-aggregate-id',
      aggregateType: 'TestAggregate',
      aggregateVersion: 1,
      data,
    });
  }
}

// Test handler
class TestEventHandler implements DomainEventHandler<TestEvent> {
  public handledEvents: TestEvent[] = [];

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event);
  }

  getHandledEventTypes(): string[] {
    return ['TestEvent'];
  }

  getPriority(): number {
    return 1;
  }
}

describe('Event Bus', () => {
  let eventBus: InMemoryDomainEventBus;
  let handler: TestEventHandler;

  beforeEach(() => {
    resetEventBus();
    eventBus = new InMemoryDomainEventBus();
    handler = new TestEventHandler();
  });

  describe('InMemoryDomainEventBus', () => {
    it('should publish and handle events', async () => {
      await eventBus.subscribe('TestEvent', handler);

      const event = new TestEvent({ message: 'test' });
      await eventBus.publish(event);

      // Give some time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler.handledEvents).toHaveLength(1);
      expect(handler.handledEvents[0].data.message).toBe('test');
    });

    it('should handle multiple events', async () => {
      await eventBus.subscribe('TestEvent', handler);

      const events = [
        new TestEvent({ message: 'test1' }),
        new TestEvent({ message: 'test2' }),
      ];

      await eventBus.publishAll(events);

      // Give some time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler.handledEvents).toHaveLength(2);
      expect(handler.handledEvents[0].data.message).toBe('test1');
      expect(handler.handledEvents[1].data.message).toBe('test2');
    });

    it('should handle multiple handlers for same event', async () => {
      const handler2 = new TestEventHandler();

      await eventBus.subscribe('TestEvent', handler);
      await eventBus.subscribe('TestEvent', handler2);

      const event = new TestEvent({ message: 'test' });
      await eventBus.publish(event);

      // Give some time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });

    it('should unsubscribe handlers', async () => {
      await eventBus.subscribe('TestEvent', handler);
      await eventBus.unsubscribe('TestEvent', handler);

      const event = new TestEvent({ message: 'test' });
      await eventBus.publish(event);

      // Give some time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler.handledEvents).toHaveLength(0);
    });

    it('should clear all subscriptions', async () => {
      await eventBus.subscribe('TestEvent', handler);
      await eventBus.clear();

      const event = new TestEvent({ message: 'test' });
      await eventBus.publish(event);

      // Give some time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler.handledEvents).toHaveLength(0);
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler: DomainEventHandler = {
        async handle(): Promise<void> {
          throw new Error('Handler error');
        },
        getHandledEventTypes(): string[] {
          return ['TestEvent'];
        },
      };

      await eventBus.subscribe('TestEvent', errorHandler);
      await eventBus.subscribe('TestEvent', handler);

      const event = new TestEvent({ message: 'test' });
      await eventBus.publish(event);

      // Give some time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // The good handler should still work despite the error in the other handler
      expect(handler.handledEvents).toHaveLength(1);
    });

    it('should provide statistics', async () => {
      await eventBus.subscribe('TestEvent', handler);

      const stats = eventBus.getStats();

      expect(stats.subscribedEventTypes).toContain('TestEvent');
      expect(stats.totalHandlers).toBe(1);
      expect(stats.queuedEvents).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });
  });

  describe('Singleton Event Bus', () => {
    it('should return same instance', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();

      expect(bus1).toBe(bus2);
    });

    it('should reset singleton', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();

      expect(bus1).not.toBe(bus2);
    });
  });
});
