import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBroadcaster } from '@/infrastructure/websocket/event-broadcaster';
import { WebSocketConnectionManager } from '@/infrastructure/websocket/websocket-connection-manager';
import { WebSocketAuthenticator } from '@/infrastructure/websocket/websocket-authenticator';

// Mock dependencies
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock connection manager
const createMockConnectionManager = () => ({
  getConnectionsByWorkspace: vi.fn().mockReturnValue([]),
  getConnectionsByProject: vi.fn().mockReturnValue([]),
  getConnectionsByUser: vi.fn().mockReturnValue([]),
  getAllConnections: vi.fn().mockReturnValue([]),
});

// Mock authenticator
const createMockAuthenticator = () => ({
  validateActionPermission: vi.fn().mockResolvedValue(true),
});

describe('EventBroadcaster', () => {
  let eventBroadcaster: EventBroadcaster;
  let mockConnectionManager: any;
  let mockAuthenticator: any;

  beforeEach(() => {
    mockConnectionManager = createMockConnectionManager();
    mockAuthenticator = createMockAuthenticator();
    eventBroadcaster = new EventBroadcaster(
      mockConnectionManager,
      mockAuthenticator
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(eventBroadcaster).toBeDefined();
    });
  });

  describe('task update broadcasting', () => {
    it('should return broadcast result for task update', async () => {
      const taskData = {
        taskId: 'task-1',
        projectId: 'project-1',
        workspaceId: 'workspace-1',
        action: 'updated' as const,
        task: { id: 'task-1', title: 'Test Task' },
        userId: 'user-1',
      };

      const result = await eventBroadcaster.broadcastTaskUpdate(taskData);

      expect(result).toHaveProperty('eventId');
      expect(result).toHaveProperty('delivered');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('filtered');
      expect(result).toHaveProperty('duration');
      expect(result.eventId).toBeDefined();
    });
  });

  describe('comment broadcasting', () => {
    it('should return broadcast result for comment added', async () => {
      const commentData = {
        commentId: 'comment-1',
        taskId: 'task-1',
        projectId: 'project-1',
        workspaceId: 'workspace-1',
        comment: { id: 'comment-1', text: 'Test comment' },
        userId: 'user-1',
      };

      const result = await eventBroadcaster.broadcastCommentAdded(commentData);

      expect(result).toHaveProperty('eventId');
      expect(result.eventId).toBeDefined();
    });
  });

  describe('workspace broadcasting', () => {
    it('should return broadcast result for workspace event', async () => {
      const eventData = {
        workspaceId: 'workspace-1',
        event: 'workspace.updated',
        data: { name: 'Updated Workspace' },
        userId: 'user-1',
        priority: 'normal' as const,
      };

      const result = await eventBroadcaster.broadcastWorkspaceEvent(eventData);

      expect(result).toHaveProperty('eventId');
      expect(result.eventId).toBeDefined();
    });
  });

  describe('event filtering', () => {
    it('should set event filter for connection', () => {
      const filter = {
        eventTypes: ['task.updated'],
        workspaceIds: ['workspace-1'],
      };

      expect(() => {
        eventBroadcaster.setEventFilter('connection-1', filter);
      }).not.toThrow();
    });

    it('should remove event filter for connection', () => {
      expect(() => {
        eventBroadcaster.removeEventFilter('connection-1');
      }).not.toThrow();
    });
  });

  describe('stored events', () => {
    it('should return empty array for user with no stored events', () => {
      const events = eventBroadcaster.getStoredEvents(
        'user-1',
        Date.now() - 1000
      );
      expect(events).toEqual([]);
    });
  });

  describe('metrics', () => {
    it('should return broadcaster metrics', () => {
      const metrics = eventBroadcaster.getMetrics();

      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('deliveredEvents');
      expect(metrics).toHaveProperty('failedEvents');
      expect(metrics).toHaveProperty('filteredEvents');
      expect(metrics).toHaveProperty('storedEvents');
      expect(metrics).toHaveProperty('queuedEvents');
      expect(metrics).toHaveProperty('activeFilters');
    });
  });
});
