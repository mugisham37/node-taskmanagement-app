import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PresenceTracker } from '@/infrastructure/websocket/presence-tracker';
import { WebSocketConnectionManager } from '@/infrastructure/websocket/websocket-connection-manager';
import { EventBroadcaster } from '@/infrastructure/websocket/event-broadcaster';

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
  getConnectionsByUser: vi.fn().mockReturnValue([
    {
      getUser: () => ({
        id: 'user-1',
        email: 'user1@example.com',
        workspaceId: 'workspace-1',
        roles: ['user'],
        permissions: ['read'],
      }),
    },
  ]),
});

// Mock event broadcaster
const createMockEventBroadcaster = () => ({
  broadcast: vi.fn().mockResolvedValue({
    eventId: 'test-event-id',
    delivered: 0,
    failed: 0,
    filtered: 0,
    duration: 10,
  }),
});

describe('PresenceTracker', () => {
  let presenceTracker: PresenceTracker;
  let mockConnectionManager: any;
  let mockEventBroadcaster: any;

  beforeEach(() => {
    mockConnectionManager = createMockConnectionManager();
    mockEventBroadcaster = createMockEventBroadcaster();
    presenceTracker = new PresenceTracker(
      mockConnectionManager,
      mockEventBroadcaster
    );
  });

  afterEach(() => {
    presenceTracker.shutdown();
  });

  describe('presence management', () => {
    it('should update user presence', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
        name: 'Test Workspace',
      });

      const presence = presenceTracker.getUserPresence('user-1');

      expect(presence).toBeDefined();
      expect(presence!.userId).toBe('user-1');
      expect(presence!.status).toBe('online');
      expect(presence!.location?.type).toBe('workspace');
      expect(presence!.location?.id).toBe('workspace-1');
    });

    it('should get workspace presence', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
      });
      await presenceTracker.updatePresence('user-2', 'away', {
        type: 'workspace',
        id: 'workspace-1',
      });

      const workspacePresence =
        presenceTracker.getWorkspacePresence('workspace-1');

      expect(workspacePresence).toHaveLength(2);
      expect(workspacePresence.map(p => p.userId)).toContain('user-1');
      expect(workspacePresence.map(p => p.userId)).toContain('user-2');
    });

    it('should get project presence', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'project',
        id: 'project-1',
      });

      const projectPresence = presenceTracker.getProjectPresence('project-1');

      expect(projectPresence).toHaveLength(1);
      expect(projectPresence[0].userId).toBe('user-1');
    });

    it('should get task presence', async () => {
      await presenceTracker.updatePresence('user-1', 'busy', {
        type: 'task',
        id: 'task-1',
      });

      const taskPresence = presenceTracker.getTaskPresence('task-1');

      expect(taskPresence).toHaveLength(1);
      expect(taskPresence[0].userId).toBe('user-1');
      expect(taskPresence[0].status).toBe('busy');
    });

    it('should set user offline', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
      });

      await presenceTracker.setUserOffline('user-1');

      const presence = presenceTracker.getUserPresence('user-1');
      expect(presence!.status).toBe('offline');

      const workspacePresence =
        presenceTracker.getWorkspacePresence('workspace-1');
      expect(workspacePresence).toHaveLength(0);
    });

    it('should return null for non-existent user presence', () => {
      const presence = presenceTracker.getUserPresence('non-existent');
      expect(presence).toBeNull();
    });
  });

  describe('typing indicators', () => {
    it('should update typing indicator', async () => {
      await presenceTracker.updateTypingIndicator(
        'user-1',
        'task-1',
        'task',
        true
      );

      const indicators = presenceTracker.getTypingIndicators('task-1');

      expect(indicators).toHaveLength(1);
      expect(indicators[0].userId).toBe('user-1');
      expect(indicators[0].isTyping).toBe(true);
      expect(indicators[0].resourceType).toBe('task');
    });

    it('should remove typing indicator when stopped', async () => {
      await presenceTracker.updateTypingIndicator(
        'user-1',
        'task-1',
        'task',
        true
      );
      await presenceTracker.updateTypingIndicator(
        'user-1',
        'task-1',
        'task',
        false
      );

      const indicators = presenceTracker.getTypingIndicators('task-1');

      expect(indicators).toHaveLength(0);
    });

    it('should return empty array for non-existent resource', () => {
      const indicators = presenceTracker.getTypingIndicators('non-existent');
      expect(indicators).toEqual([]);
    });

    it('should handle multiple users typing', async () => {
      await presenceTracker.updateTypingIndicator(
        'user-1',
        'task-1',
        'task',
        true
      );
      await presenceTracker.updateTypingIndicator(
        'user-2',
        'task-1',
        'task',
        true
      );

      const indicators = presenceTracker.getTypingIndicators('task-1');

      expect(indicators).toHaveLength(2);
      expect(indicators.map(i => i.userId)).toContain('user-1');
      expect(indicators.map(i => i.userId)).toContain('user-2');
    });
  });

  describe('activity tracking', () => {
    it('should record activity event', async () => {
      const activity = await presenceTracker.recordActivity(
        'user-1',
        'edit',
        { type: 'task', id: 'task-1', name: 'Test Task' },
        { field: 'title', oldValue: 'Old Title', newValue: 'New Title' }
      );

      expect(activity).toBeDefined();
      expect(activity.userId).toBe('user-1');
      expect(activity.type).toBe('edit');
      expect(activity.resource.type).toBe('task');
      expect(activity.resource.id).toBe('task-1');
      expect(activity.metadata).toEqual({
        field: 'title',
        oldValue: 'Old Title',
        newValue: 'New Title',
      });
    });

    it('should get activity feed', async () => {
      // Mock workspace ID resolution
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
      });

      await presenceTracker.recordActivity('user-1', 'create', {
        type: 'task',
        id: 'task-1',
      });
      await presenceTracker.recordActivity('user-1', 'edit', {
        type: 'task',
        id: 'task-1',
      });

      const feed = presenceTracker.getActivityFeed('workspace-1', 10);

      expect(feed.workspaceId).toBe('workspace-1');
      expect(feed.activities).toHaveLength(2);
      expect(feed.activities[0].type).toBe('edit'); // Latest first
      expect(feed.activities[1].type).toBe('create');
    });

    it('should filter activity feed', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
      });

      await presenceTracker.recordActivity('user-1', 'create', {
        type: 'task',
        id: 'task-1',
      });
      await presenceTracker.recordActivity('user-1', 'edit', {
        type: 'project',
        id: 'project-1',
      });

      const feed = presenceTracker.getActivityFeed('workspace-1', 10, 0, {
        types: ['create'],
        resourceTypes: ['task'],
      });

      expect(feed.activities).toHaveLength(1);
      expect(feed.activities[0].type).toBe('create');
      expect(feed.activities[0].resource.type).toBe('task');
    });

    it('should get user activity summary', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
      });

      const now = Date.now();
      const timeRange = { start: now - 24 * 60 * 60 * 1000, end: now };

      // Record some activities
      await presenceTracker.recordActivity('user-1', 'create', {
        type: 'task',
        id: 'task-1',
      });
      await presenceTracker.recordActivity('user-1', 'edit', {
        type: 'task',
        id: 'task-1',
      });
      await presenceTracker.recordActivity('user-1', 'create', {
        type: 'project',
        id: 'project-1',
      });

      const summary = presenceTracker.getUserActivitySummary(
        'user-1',
        'workspace-1',
        timeRange
      );

      expect(summary.totalActivities).toBe(3);
      expect(summary.activitiesByType.create).toBe(2);
      expect(summary.activitiesByType.edit).toBe(1);
      expect(summary.activitiesByResource.task).toBe(2);
      expect(summary.activitiesByResource.project).toBe(1);
    });
  });

  describe('metrics', () => {
    it('should return presence tracker metrics', async () => {
      await presenceTracker.updatePresence('user-1', 'online', {
        type: 'workspace',
        id: 'workspace-1',
      });
      await presenceTracker.updatePresence('user-2', 'away', {
        type: 'workspace',
        id: 'workspace-1',
      });
      await presenceTracker.updateTypingIndicator(
        'user-1',
        'task-1',
        'task',
        true
      );

      const metrics = presenceTracker.getMetrics();

      expect(metrics).toHaveProperty('totalUsers');
      expect(metrics).toHaveProperty('onlineUsers');
      expect(metrics).toHaveProperty('awayUsers');
      expect(metrics).toHaveProperty('busyUsers');
      expect(metrics).toHaveProperty('offlineUsers');
      expect(metrics).toHaveProperty('workspacesWithPresence');
      expect(metrics).toHaveProperty('activeTypingIndicators');

      expect(metrics.totalUsers).toBe(2);
      expect(metrics.onlineUsers).toBe(1);
      expect(metrics.awayUsers).toBe(1);
      expect(metrics.workspacesWithPresence).toBe(1);
      expect(metrics.activeTypingIndicators).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should shutdown gracefully', () => {
      expect(() => {
        presenceTracker.shutdown();
      }).not.toThrow();
    });
  });
});
