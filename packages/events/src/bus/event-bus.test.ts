import { DomainEvent } from '@taskmanagement/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, IEventHandler } from './event-bus';

// Mock domain event for testing
class TestEvent implements DomainEvent {
  constructor(
    private id: string,
    private aggregateId: string,
    private occurredAt: Date = new Date()
  ) {}

  getEventId(): string {
    return this.id;
  }

  getEventName(): string {
    return 'TestEvent';
  }

  getAggregateId(): string {
    return this.aggregateId;
  }

  getOccurredOn(): Date {
    return this.occurredAt;
  }

  getVersion?(): number {
    return 1;
  }

  getAggregateType?(): string {
    return 'Test';
  }
}

// Mock logging service
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
};

describe('EventBus', () => {
  let eventBus: EventBus;
  let mockHandler: IEventHandler<TestEvent>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus(mockLogger as any);
    mockHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('subscribe', () => {
    it('should register event handler', () => {
      eventBus.subscribe(TestEvent, mockHandler);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Event handler registered for TestEvent'
      );
    });

    it('should allow multiple handlers for same event type', () => {
      const handler2: IEventHandler<TestEvent> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      eventBus.subscribe(TestEvent, mockHandler);
      eventBus.subscribe(TestEvent, handler2);

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('publish', () => {
    it('should publish event to registered handlers', async () => {
      eventBus.subscribe(TestEvent, mockHandler);
      
      const event = new TestEvent('test-id', 'aggregate-id');
      await eventBus.publish(event);

      expect(mockHandler.handle).toHaveBeenCalledWith(event);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Publishing event: TestEvent',
        { eventId: 'test-id' }
      );
    });

    it('should handle multiple handlers', async () => {
      const handler2: IEventHandler<TestEvent> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      eventBus.subscribe(TestEvent, mockHandler);
      eventBus.subscribe(TestEvent, handler2);
      
      const event = new TestEvent('test-id', 'aggregate-id');
      await eventBus.publish(event);

      expect(mockHandler.handle).toHaveBeenCalledWith(event);
      expect(handler2.handle).toHaveBeenCalledWith(event);
    });

    it('should continue with other handlers if one fails', async () => {
      const handler2: IEventHandler<TestEvent> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      mockHandler.handle = vi.fn().mockRejectedValue(new Error('Handler failed'));

      eventBus.subscribe(TestEvent, mockHandler);
      eventBus.subscribe(TestEvent, handler2);
      
      const event = new TestEvent('test-id', 'aggregate-id');
      await eventBus.publish(event);

      expect(mockHandler.handle).toHaveBeenCalledWith(event);
      expect(handler2.handle).toHaveBeenCalledWith(event);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should do nothing if no handlers registered', async () => {
      const event = new TestEvent('test-id', 'aggregate-id');
      await eventBus.publish(event);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Publishing event: TestEvent',
        { eventId: 'test-id' }
      );
    });
  });

  describe('publishAll', () => {
    it('should publish multiple events', async () => {
      eventBus.subscribe(TestEvent, mockHandler);
      
      const events = [
        new TestEvent('test-id-1', 'aggregate-id-1'),
        new TestEvent('test-id-2', 'aggregate-id-2'),
      ];

      await eventBus.publishAll(events);

      expect(mockHandler.handle).toHaveBeenCalledTimes(2);
      expect(mockHandler.handle).toHaveBeenCalledWith(events[0]);
      expect(mockHandler.handle).toHaveBeenCalledWith(events[1]);
    });

    it('should log start and completion', async () => {
      const events = [new TestEvent('test-id', 'aggregate-id')];
      
      await eventBus.publishAll(events);

      expect(mockLogger.info).toHaveBeenCalledWith('Publishing 1 events');
      expect(mockLogger.info).toHaveBeenCalledWith('Completed publishing 1 events');
    });
  });
});