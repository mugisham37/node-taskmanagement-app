import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/db/repositories', () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      avatar: 'https://example.com/avatar.jpg',
    }),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/base.service', () => ({
  BaseService: class MockBaseService {
    constructor(name: string, options: any) {}
    protected recordMetric = vi.fn();
  },
}));

describe('Presence API Integration - Task 4.4', () => {
  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    role: 'user',
    isEmailVerified: true,
    profilePicture: 'https://example.com/avatar.jpg',
  };

  // Mock request and reply objects
  const createMockRequest = (
    body: any = {},
    query: any = {},
    user = mockUser
  ) => ({
    body,
    query,
    user,
  });

  const createMockReply = () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    return reply;
  };

  describe('Enhanced Presence Endpoints', () => {
    it('should update user location', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest({
        workspaceId: 'workspace-123',
        projectId: 'project-456',
        taskId: 'task-789',
      });
      const reply = createMockReply();

      await presenceController.updateLocation(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Location updated successfully',
          location: {
            workspaceId: 'workspace-123',
            projectId: 'project-456',
            taskId: 'task-789',
          },
        },
      });
    });

    it('should set custom status', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest({
        message: 'In a meeting',
        emoji: '📅',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      const reply = createMockReply();

      await presenceController.setCustomStatus(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'Custom status set successfully',
            customStatus: expect.objectContaining({
              message: 'In a meeting',
              emoji: '📅',
            }),
          }),
        })
      );
    });

    it('should clear custom status', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest();
      const reply = createMockReply();

      await presenceController.clearCustomStatus(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Custom status cleared successfully',
        },
      });
    });

    it('should get resource activity summary', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest({}, { resourceId: 'task-123' });
      const reply = createMockReply();

      await presenceController.getResourceActivity(
        request as any,
        reply as any
      );

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            resourceId: 'task-123',
            viewers: expect.any(Array),
            editors: expect.any(Array),
            commenters: expect.any(Array),
            typing: expect.any(Array),
            totalActiveUsers: expect.any(Number),
          }),
        })
      );
    });

    it('should get user activity history', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest({}, { limit: 10 });
      const reply = createMockReply();

      await presenceController.getUserActivityHistory(
        request as any,
        reply as any
      );

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            userId: mockUser.id,
            activities: expect.any(Array),
            total: expect.any(Number),
          }),
        })
      );
    });

    it('should get enhanced presence statistics', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest();
      const reply = createMockReply();

      await presenceController.getPresenceStats(request as any, reply as any);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            presence: expect.objectContaining({
              totalUsers: expect.any(Number),
              onlineUsers: expect.any(Number),
              customStatuses: expect.any(Number),
              userLocations: expect.any(Number),
              recentActivities: expect.any(Number),
            }),
            websocket: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest({}, {}, undefined); // No user
      const reply = createMockReply();

      await presenceController.updateLocation(request as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: { message: 'Authentication required' },
      });
    });

    it('should handle validation errors', async () => {
      const { presenceController } = await import(
        '../../src/controllers/presence.controller'
      );

      const request = createMockRequest({
        message: '', // Invalid empty message
      });
      const reply = createMockReply();

      await presenceController.setCustomStatus(request as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });
});
