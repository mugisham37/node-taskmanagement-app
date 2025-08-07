import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock all dependencies first
vi.mock('../../../src/db/repositories', () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/services/base.service', () => ({
  BaseService: class MockBaseService {
    constructor(name: string, options: any) {}
    protected recordMetric = vi.fn();
  },
}));

// Import after mocking
const { PresenceService } = await import(
  '../../../src/services/presence.service'
);
const { userRepository } = await import('../../../src/db/repositories');

describe('PresenceService - Task 4.4 Implementation', () => {
  let presenceService: InstanceType<typeof PresenceService>;

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    avatar: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
    presenceService = new PresenceService();
  });

  afterEach(async () => {
    await presenceService.shutdown();
  });

  describe('Enhanced Presence Tracking', () => {
    it('should update user presence with location context', async () => {
      const workspaceId = 'workspace-123';
      const deviceInfo = {
        type: 'desktop' as const,
        browser: 'Chrome',
        os: 'Windows',
      };

      const presence = await presenceService.updatePresence(
        mockUser.id,
        'online',
        workspaceId,
        deviceInfo
      );

      expect(presence).toMatchObject({
        userId: mockUser.id,
        status: 'online',
        workspaceId,
        deviceInfo,
      });
      expect(presence.lastSeen).toBeInstanceOf(Date);
    });

    it('should update user location context', async () => {
      const location = {
        workspaceId: 'workspace-123',
        projectId: 'project-456',
        taskId: 'task-789',
      };

      await presenceService.updateUserLocation(mockUser.id, location);

      // Verify location is tracked
      const presence = presenceService.getPresence(mockUser.id);
      expect(presence?.location).toEqual(location);
    });

    it('should set and clear custom status', async () => {
      const message = 'In a meeting';
      const emoji = '📅';
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await presenceService.setCustomStatus(
        mockUser.id,
        message,
        emoji,
        expiresAt
      );

      let presence = presenceService.getPresence(mockUser.id);
      expect(presence?.customStatus).toEqual({
        message,
        emoji,
        expiresAt,
      });

      await presenceService.clearCustomStatus(mockUser.id);

      presence = presenceService.getPresence(mockUser.id);
      expect(presence?.customStatus).toBeUndefined();
    });
  });

  describe('Activity Tracking', () => {
    it('should track users viewing a resource', async () => {
      const resourceId = 'task-123';

      await presenceService.updateActivity(mockUser.id, {
        type: 'viewing',
        resourceType: 'task',
        resourceId,
        resourceTitle: 'Test Task',
        startedAt: new Date(),
      });

      const viewers = presenceService.getUsersViewingResource(resourceId);
      expect(viewers).toHaveLength(1);
      expect(viewers[0]).toMatchObject({
        userId: mockUser.id,
        userName: 'John Doe',
        activity: {
          type: 'viewing',
          resourceType: 'task',
          resourceId,
        },
      });
    });

    it('should track users editing a resource', async () => {
      const resourceId = 'task-123';

      await presenceService.updateActivity(mockUser.id, {
        type: 'editing',
        resourceType: 'task',
        resourceId,
        resourceTitle: 'Test Task',
        startedAt: new Date(),
      });

      const editors = presenceService.getUsersEditingResource(resourceId);
      expect(editors).toHaveLength(1);
      expect(editors[0]).toMatchObject({
        userId: mockUser.id,
        userName: 'John Doe',
        activity: {
          type: 'editing',
          resourceType: 'task',
          resourceId,
        },
      });
    });

    it('should provide comprehensive resource activity summary', async () => {
      const resourceId = 'task-123';

      // Add viewing activity
      await presenceService.updateActivity(mockUser.id, {
        type: 'viewing',
        resourceType: 'task',
        resourceId,
        resourceTitle: 'Test Task',
        startedAt: new Date(),
      });

      // Add typing indicator
      await presenceService.startTyping(mockUser.id, 'task', resourceId);

      const summary = presenceService.getResourceActivitySummary(resourceId);

      expect(summary).toMatchObject({
        totalActiveUsers: 1,
      });
      expect(summary.viewers).toHaveLength(1);
      expect(summary.typing).toHaveLength(1);
    });
  });

  describe('Typing Indicators', () => {
    it('should start and stop typing indicators', async () => {
      const resourceId = 'task-123';

      await presenceService.startTyping(mockUser.id, 'task', resourceId);

      let typingIndicators = presenceService.getTypingIndicators(resourceId);
      expect(typingIndicators).toHaveLength(1);
      expect(typingIndicators[0]).toMatchObject({
        userId: mockUser.id,
        userName: 'John Doe',
        resourceType: 'task',
        resourceId,
      });

      await presenceService.stopTyping(mockUser.id, resourceId);

      typingIndicators = presenceService.getTypingIndicators(resourceId);
      expect(typingIndicators).toHaveLength(0);
    });
  });

  describe('Activity History', () => {
    it('should track user activity history', async () => {
      const resourceId = 'task-123';

      await presenceService.updateActivity(mockUser.id, {
        type: 'editing',
        resourceType: 'task',
        resourceId,
        resourceTitle: 'Test Task',
        startedAt: new Date(),
      });

      // Wait a bit to ensure activity is tracked
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = presenceService.getUserActivityHistory(mockUser.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toMatchObject({
        userId: mockUser.id,
        userName: 'John Doe',
        action: 'started_editing',
        resourceType: 'task',
        resourceId,
      });
    });
  });

  describe('Enhanced Statistics', () => {
    it('should provide enhanced presence statistics', async () => {
      await presenceService.updatePresence(mockUser.id, 'online');
      await presenceService.setCustomStatus(mockUser.id, 'Working');
      await presenceService.updateUserLocation(mockUser.id, {
        workspaceId: 'workspace-123',
      });

      const stats = presenceService.getEnhancedPresenceStats();

      expect(stats).toMatchObject({
        totalUsers: 1,
        onlineUsers: 1,
        customStatuses: 1,
        userLocations: 1,
      });
      expect(stats.recentActivities).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Workspace Context', () => {
    it('should get online users in workspace', async () => {
      const workspaceId = 'workspace-123';

      await presenceService.updatePresence(mockUser.id, 'online', workspaceId);

      const onlineUsers =
        presenceService.getOnlineUsersInWorkspace(workspaceId);
      expect(onlineUsers).toHaveLength(1);
      expect(onlineUsers[0]).toMatchObject({
        userId: mockUser.id,
        status: 'online',
        workspaceId,
      });
    });

    it('should manage activity feed for workspace', async () => {
      const workspaceId = 'workspace-123';

      await presenceService.addActivityToFeed({
        userId: mockUser.id,
        userName: 'John Doe',
        userAvatar: mockUser.avatar,
        action: 'task_created',
        resourceType: 'task',
        resourceId: 'task-123',
        resourceTitle: 'New Task',
        description: 'created a new task',
        workspaceId,
        timestamp: new Date(),
      });

      const feed = presenceService.getActivityFeed(workspaceId);
      expect(feed).toHaveLength(1);
      expect(feed[0]).toMatchObject({
        userId: mockUser.id,
        action: 'task_created',
        resourceType: 'task',
        workspaceId,
      });
    });
  });
});
