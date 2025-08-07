import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventAggregator } from '@/infrastructure/websocket/event-aggregator';
import { BroadcastEvent } from '@/infrastructure/websocket/event-broadcaster';

// Mock dependencies
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EventAggregator', () => {
  let eventAggregator: EventAggregator;

  beforeEach(() => {
    eventAggregator = new EventAggregator();
  });

  describe('initialization', () => {
    it('should initialize with default rules', () => {
      const metrics = eventAggregator.getMetrics();
      expect(metrics.activeRules).toBeGreaterThan(0);
    });
  });

  describe('event processing', () => {
    it('should return original event when no aggregation rules match', async () => {
      const event: BroadcastEvent = {
        id: 'event-1',
        type: 'test',
        event: 'test.event',
        data: { message: 'test' },
        timestamp: Date.now(),
        source: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
        },
        target: {
          type: 'workspace',
          id: 'workspace-1',
        },
        priority: 'normal',
        persistent: false,
      };

      const result = await eventAggregator.processEvent(event);
      expect(result).toBe(event);
    });

    it('should start aggregation for matching event', async () => {
      const taskEvent: BroadcastEvent = {
        id: 'event-1',
        type: 'task',
        event: 'task.updated',
        data: {
          taskId: 'task-1',
          action: 'updated',
          task: { id: 'task-1', title: 'Test Task' },
        },
        timestamp: Date.now(),
        source: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
        },
        target: {
          type: 'project',
          id: 'project-1',
        },
        priority: 'normal',
        persistent: true,
      };

      const result = await eventAggregator.processEvent(taskEvent);
      expect(result).toBeNull(); // Event should be queued for aggregation
    });
  });

  describe('aggregation rules', () => {
    it('should add custom aggregation rule', () => {
      const rule = {
        eventTypes: ['custom.event'],
        aggregationKey: (event: BroadcastEvent) => `custom:${event.data.id}`,
        aggregationWindow: 1000,
        maxEvents: 5,
        aggregateData: (events: BroadcastEvent[]) => ({ count: events.length }),
      };

      eventAggregator.addRule('custom-rule', rule);

      const metrics = eventAggregator.getMetrics();
      expect(metrics.activeRules).toBeGreaterThan(4); // Default rules + custom rule
    });

    it('should remove aggregation rule', () => {
      const initialMetrics = eventAggregator.getMetrics();

      eventAggregator.addRule('temp-rule', {
        eventTypes: ['temp.event'],
        aggregationKey: () => 'temp',
        aggregationWindow: 1000,
        maxEvents: 5,
        aggregateData: () => ({}),
      });

      eventAggregator.removeRule('temp-rule');

      const finalMetrics = eventAggregator.getMetrics();
      expect(finalMetrics.activeRules).toBe(initialMetrics.activeRules);
    });
  });

  describe('pending aggregations', () => {
    it('should return pending aggregations info', () => {
      const pendingInfo = eventAggregator.getPendingAggregations();
      expect(Array.isArray(pendingInfo)).toBe(true);
    });

    it('should clear pending aggregations', () => {
      eventAggregator.clearPending();

      const pendingInfo = eventAggregator.getPendingAggregations();
      expect(pendingInfo).toHaveLength(0);
    });
  });

  describe('metrics', () => {
    it('should return aggregator metrics', () => {
      const metrics = eventAggregator.getMetrics();

      expect(metrics).toHaveProperty('eventsAggregated');
      expect(metrics).toHaveProperty('aggregationsCreated');
      expect(metrics).toHaveProperty('aggregationsSaved');
      expect(metrics).toHaveProperty('pendingAggregations');
      expect(metrics).toHaveProperty('activeRules');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', () => {
      expect(() => {
        eventAggregator.shutdown();
      }).not.toThrow();
    });
  });
});
