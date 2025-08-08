import { EventSystemFactory } from './event-system-factory';
import {
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
} from '@/domain/task-management/events/task-events';
import { UnifiedEventSystem } from '@/shared/events';

describe('Event System Integration', () => {
  let eventSystem: UnifiedEventSystem;

  beforeEach(() => {
    eventSystem = EventSystemFactory.createForTesting();
  });

  afterEach(async () => {
    await eventSystem.shutdown();
  });

  describe('Domain Event Flow', () => {
    it('should publish and handle domain events', async () => {
      // Arrange
      const taskCreatedEvent = new TaskCreatedEvent(
        'task-123',
        'Test Task',
        'This is a test task',
        'user-456',
        'workspace-789',
        'project-101'
      );

      // Act
      await eventSystem.publishDomainEvent(taskCreatedEvent);

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const metrics = eventSystem.getMetrics();
      expect(metrics.domainEvents.published).toBe(1);
      expect(metrics.domainEvents.handled).toBeGreaterThan(0);
    });

    it('should handle multiple domain events in sequence', async () => {
      // Arrange
      const events = [
        new TaskCreatedEvent(
          'task-123',
          'Test Task',
          'This is a test task',
          'user-456',
          'workspace-789',
          'project-101'
        ),
        new TaskAssignedEvent('task-123', 'user-789', null, 'user-456'),
        new TaskCompletedEvent('task-123', 'user-789', new Date()),
      ];

      // Act
      await eventSystem.publishDomainEvents(events);

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const metrics = eventSystem.getMetrics();
      expect(metrics.domainEvents.published).toBe(3);
      expect(metrics.domainEvents.handled).toBeGreaterThan(0);
    });
  });

  describe('Event Store Integration', () => {
    it('should store domain events in event store', async () => {
      // Arrange
      const eventStore = eventSystem.getEventStore();
      expect(eventStore).toBeDefined();

      const taskCreatedEvent = new TaskCreatedEvent(
        'task-123',
        'Test Task',
        'This is a test task',
        'user-456',
        'workspace-789',
        'project-101'
      );

      // Act
      await eventSystem.publishDomainEvent(taskCreatedEvent);

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const storedEvents = await eventStore!.getEvents('task-123');
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].eventName).toBe('TaskCreatedEvent');
      expect(storedEvents[0].aggregateId).toBe('task-123');
    });

    it('should retrieve events by aggregate', async () => {
      // Arrange
      const eventStore = eventSystem.getEventStore();
      const events = [
        new TaskCreatedEvent(
          'task-123',
          'Test Task',
          'This is a test task',
          'user-456',
          'workspace-789',
          'project-101'
        ),
        new TaskAssignedEvent('task-123', 'user-789', null, 'user-456'),
      ];

      // Act
      await eventSystem.publishDomainEvents(events);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const storedEvents = await eventStore!.getEvents('task-123');
      expect(storedEvents).toHaveLength(2);
      expect(storedEvents.map(e => e.eventName)).toContain('TaskCreatedEvent');
      expect(storedEvents.map(e => e.eventName)).toContain('TaskAssignedEvent');
    });
  });

  describe('Cross-System Event Bridging', () => {
    it('should bridge domain events to WebSocket when enabled', async () => {
      // Arrange
      const eventSystemWithBridge = EventSystemFactory.create({
        enableEventStore: true,
        enableWebSocketBridge: true,
      });

      const taskCreatedEvent = new TaskCreatedEvent(
        'task-123',
        'Test Task',
        'This is a test task',
        'user-456',
        'workspace-789',
        'project-101'
      );

      // Act
      await eventSystemWithBridge.publishDomainEvent(taskCreatedEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const metrics = eventSystemWithBridge.getMetrics();
      expect(metrics.domainEvents.published).toBe(1);
      expect(metrics.websocketEvents.broadcast).toBeGreaterThan(0);

      await eventSystemWithBridge.shutdown();
    });

    it('should bridge domain events to integration events when enabled', async () => {
      // Arrange
      const eventSystemWithBridge = EventSystemFactory.create({
        enableEventStore: true,
        enableIntegrationBridge: true,
      });

      const taskCreatedEvent = new TaskCreatedEvent(
        'task-123',
        'Test Task',
        'This is a test task',
        'user-456',
        'workspace-789',
        'project-101'
      );

      // Act
      await eventSystemWithBridge.publishDomainEvent(taskCreatedEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const metrics = eventSystemWithBridge.getMetrics();
      expect(metrics.domainEvents.published).toBe(1);
      expect(metrics.integrationEvents.published).toBeGreaterThan(0);

      await eventSystemWithBridge.shutdown();
    });
  });

  describe('Event System Metrics', () => {
    it('should track comprehensive metrics', async () => {
      // Arrange
      const events = [
        new TaskCreatedEvent(
          'task-123',
          'Test Task',
          'This is a test task',
          'user-456',
          'workspace-789',
          'project-101'
        ),
        new TaskAssignedEvent('task-123', 'user-789', null, 'user-456'),
      ];

      // Act
      await eventSystem.publishDomainEvents(events);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const metrics = eventSystem.getMetrics();

      expect(metrics.domainEvents.published).toBe(2);
      expect(metrics.domainEvents.handled).toBeGreaterThan(0);
      expect(metrics.domainEvents.averageHandlingTime).toBeGreaterThan(0);

      expect(metrics.eventStore.totalEvents).toBe(2);
      expect(metrics.eventStore.storageSize).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle event handler errors gracefully', async () => {
      // Arrange
      const faultyHandler = {
        canHandle: () => true,
        handle: async () => {
          throw new Error('Handler error');
        },
      };

      eventSystem.getDomainEventBus().subscribeToAll(faultyHandler);

      const taskCreatedEvent = new TaskCreatedEvent(
        'task-123',
        'Test Task',
        'This is a test task',
        'user-456',
        'workspace-789',
        'project-101'
      );

      // Act & Assert - should not throw
      await expect(
        eventSystem.publishDomainEvent(taskCreatedEvent)
      ).resolves.not.toThrow();

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = eventSystem.getMetrics();
      expect(metrics.domainEvents.published).toBe(1);
      expect(metrics.domainEvents.failed).toBeGreaterThan(0);
    });
  });

  describe('Event System Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      // Arrange
      const taskCreatedEvent = new TaskCreatedEvent(
        'task-123',
        'Test Task',
        'This is a test task',
        'user-456',
        'workspace-789',
        'project-101'
      );

      await eventSystem.publishDomainEvent(taskCreatedEvent);

      // Act & Assert
      await expect(eventSystem.shutdown()).resolves.not.toThrow();

      // Verify metrics are still accessible after shutdown
      const metrics = eventSystem.getMetrics();
      expect(metrics.domainEvents.published).toBe(1);
    });
  });
});
