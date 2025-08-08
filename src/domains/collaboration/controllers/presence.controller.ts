import { FastifyRequest, FastifyReply } from 'fastify';
import { presenceService } from '../services/presence.service';
import { webSocketService } from '../../../shared/services/websocket.service';
import { BaseController } from '../../../shared/controllers/base.controller';
import { z } from 'zod';

// Validation schemas
const UpdatePresenceSchema = z.object({
  status: z.enum(['online', 'away', 'busy', 'offline']),
  workspaceId: z.string().uuid().optional(),
});

const UpdateActivitySchema = z.object({
  type: z.enum(['viewing', 'editing', 'commenting']),
  resourceType: z.enum(['task', 'project', 'workspace']),
  resourceId: z.string().uuid(),
  resourceTitle: z.string().optional(),
});

const StartTypingSchema = z.object({
  resourceType: z.enum(['task', 'comment']),
  resourceId: z.string().uuid(),
});

const StopTypingSchema = z.object({
  resourceId: z.string().uuid(),
});

const GetPresenceSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  workspaceId: z.string().uuid().optional(),
});

const GetActivitySchema = z.object({
  resourceId: z.string().uuid(),
});

const GetActivityFeedSchema = z.object({
  workspaceId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const UpdateLocationSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});

const SetCustomStatusSchema = z.object({
  message: z.string().min(1).max(100),
  emoji: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const GetResourceActivitySchema = z.object({
  resourceId: z.string().uuid(),
});

const GetUserActivityHistorySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
});

export class PresenceController extends BaseController {
  constructor() {
    super('PresenceController');
  }

  /**
   * Update user presence status
   */
  async updatePresence(
    request: FastifyRequest<{
      Body: z.infer<typeof UpdatePresenceSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { status, workspaceId } = this.validateInput(
        UpdatePresenceSchema,
        request.body
      );

      // Extract device info from request headers
      const userAgent = request.headers['user-agent'] || '';
      const deviceInfo = this.extractDeviceInfo(userAgent);

      const presenceInfo = await presenceService.updatePresence(
        userId,
        status,
        workspaceId,
        deviceInfo
      );

      // Broadcast presence update if workspace is specified
      if (workspaceId) {
        await webSocketService.broadcastPresenceUpdate(
          workspaceId,
          presenceInfo
        );
      }

      reply.send({
        success: true,
        data: {
          presence: presenceInfo,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to update presence');
    }
  }

  /**
   * Update user activity
   */
  async updateActivity(
    request: FastifyRequest<{
      Body: z.infer<typeof UpdateActivitySchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { type, resourceType, resourceId, resourceTitle } =
        this.validateInput(UpdateActivitySchema, request.body);

      await presenceService.updateActivity(userId, {
        type,
        resourceType,
        resourceId,
        resourceTitle,
      });

      // Get updated activity indicators
      const activityIndicators =
        presenceService.getActivityIndicators(resourceId);
      const userActivity = activityIndicators.find(a => a.userId === userId);

      if (userActivity) {
        await webSocketService.broadcastActivityUpdate(
          resourceId,
          userActivity
        );
      }

      reply.send({
        success: true,
        data: {
          message: 'Activity updated successfully',
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to update activity');
    }
  }

  /**
   * Clear user activity
   */
  async clearActivity(
    request: FastifyRequest<{
      Body: { resourceId?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { resourceId } = request.body;

      await presenceService.clearActivity(userId, resourceId);

      reply.send({
        success: true,
        data: {
          message: 'Activity cleared successfully',
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to clear activity');
    }
  }

  /**
   * Start typing indicator
   */
  async startTyping(
    request: FastifyRequest<{
      Body: z.infer<typeof StartTypingSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { resourceType, resourceId } = this.validateInput(
        StartTypingSchema,
        request.body
      );

      await presenceService.startTyping(userId, resourceType, resourceId);

      reply.send({
        success: true,
        data: {
          message: 'Typing indicator started',
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to start typing indicator');
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(
    request: FastifyRequest<{
      Body: z.infer<typeof StopTypingSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { resourceId } = this.validateInput(StopTypingSchema, request.body);

      await presenceService.stopTyping(userId, resourceId);

      reply.send({
        success: true,
        data: {
          message: 'Typing indicator stopped',
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to stop typing indicator');
    }
  }

  /**
   * Get presence information
   */
  async getPresence(
    request: FastifyRequest<{
      Querystring: z.infer<typeof GetPresenceSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { userIds, workspaceId } = this.validateInput(
        GetPresenceSchema,
        request.query
      );

      let presenceData: any;

      if (userIds && userIds.length > 0) {
        // Get presence for specific users
        const presenceMap = presenceService.getMultiplePresence(userIds);
        presenceData = Object.fromEntries(presenceMap);
      } else if (workspaceId) {
        // Get all online users in workspace
        const onlineUsers =
          presenceService.getOnlineUsersInWorkspace(workspaceId);
        presenceData = onlineUsers.reduce(
          (acc, presence) => {
            acc[presence.userId] = presence;
            return acc;
          },
          {} as Record<string, any>
        );
      } else {
        return reply.status(400).send({
          success: false,
          error: { message: 'Either userIds or workspaceId must be provided' },
        });
      }

      reply.send({
        success: true,
        data: {
          presence: presenceData,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to get presence information');
    }
  }

  /**
   * Get activity indicators for a resource
   */
  async getActivity(
    request: FastifyRequest<{
      Querystring: z.infer<typeof GetActivitySchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { resourceId } = this.validateInput(
        GetActivitySchema,
        request.query
      );

      const activityIndicators =
        presenceService.getActivityIndicators(resourceId);
      const typingIndicators = presenceService.getTypingIndicators(resourceId);

      reply.send({
        success: true,
        data: {
          resourceId,
          activities: activityIndicators,
          typing: typingIndicators,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to get activity information');
    }
  }

  /**
   * Get activity feed for a workspace
   */
  async getActivityFeed(
    request: FastifyRequest<{
      Querystring: z.infer<typeof GetActivityFeedSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { workspaceId, limit, offset } = this.validateInput(
        GetActivityFeedSchema,
        request.query
      );

      // TODO: Add workspace access validation here
      // const hasAccess = await workspaceService.hasAccess(userId, workspaceId);
      // if (!hasAccess) {
      //   return reply.status(403).send({
      //     success: false,
      //     error: { message: 'Access denied to workspace' }
      //   });
      // }

      const activities = presenceService.getActivityFeed(
        workspaceId,
        limit,
        offset
      );

      reply.send({
        success: true,
        data: {
          workspaceId,
          activities,
          pagination: {
            limit,
            offset,
            total: activities.length,
          },
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to get activity feed');
    }
  }

  /**
   * Update user location context
   */
  async updateLocation(
    request: FastifyRequest<{
      Body: z.infer<typeof UpdateLocationSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const location = this.validateInput(UpdateLocationSchema, request.body);

      await presenceService.updateUserLocation(userId, location);

      reply.send({
        success: true,
        data: {
          message: 'Location updated successfully',
          location,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to update location');
    }
  }

  /**
   * Set custom status message
   */
  async setCustomStatus(
    request: FastifyRequest<{
      Body: z.infer<typeof SetCustomStatusSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { message, emoji, expiresAt } = this.validateInput(
        SetCustomStatusSchema,
        request.body
      );

      const expiryDate = expiresAt ? new Date(expiresAt) : undefined;

      await presenceService.setCustomStatus(userId, message, emoji, expiryDate);

      reply.send({
        success: true,
        data: {
          message: 'Custom status set successfully',
          customStatus: {
            message,
            emoji,
            expiresAt: expiryDate,
          },
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to set custom status');
    }
  }

  /**
   * Clear custom status
   */
  async clearCustomStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      await presenceService.clearCustomStatus(userId);

      reply.send({
        success: true,
        data: {
          message: 'Custom status cleared successfully',
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to clear custom status');
    }
  }

  /**
   * Get comprehensive resource activity summary
   */
  async getResourceActivity(
    request: FastifyRequest<{
      Querystring: z.infer<typeof GetResourceActivitySchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { resourceId } = this.validateInput(
        GetResourceActivitySchema,
        request.query
      );

      const activitySummary =
        presenceService.getResourceActivitySummary(resourceId);

      reply.send({
        success: true,
        data: {
          resourceId,
          ...activitySummary,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to get resource activity');
    }
  }

  /**
   * Get user activity history
   */
  async getUserActivityHistory(
    request: FastifyRequest<{
      Querystring: z.infer<typeof GetUserActivityHistorySchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const currentUserId = request.user?.id;
      if (!currentUserId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      const { userId, limit } = this.validateInput(
        GetUserActivityHistorySchema,
        request.query
      );

      // Use current user ID if not specified, or check permissions
      const targetUserId = userId || currentUserId;

      // TODO: Add permission check for viewing other users' activity
      // if (targetUserId !== currentUserId && !request.user?.isAdmin) {
      //   return reply.status(403).send({
      //     success: false,
      //     error: { message: 'Access denied' }
      //   });
      // }

      const activities = presenceService.getUserActivityHistory(
        targetUserId,
        limit
      );

      reply.send({
        success: true,
        data: {
          userId: targetUserId,
          activities,
          total: activities.length,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to get user activity history');
    }
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      // TODO: Add admin role check here
      // if (!request.user?.isAdmin) {
      //   return reply.status(403).send({
      //     success: false,
      //     error: { message: 'Admin access required' }
      //   });
      // }

      const stats = presenceService.getEnhancedPresenceStats();
      const webSocketStats = webSocketService.getPresenceStats();

      reply.send({
        success: true,
        data: {
          presence: stats,
          websocket: webSocketStats,
        },
      });
    } catch (error) {
      this.handleError(reply, error, 'Failed to get presence statistics');
    }
  }

  /**
   * Extract device information from user agent
   */
  private extractDeviceInfo(userAgent: string): any {
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    let browser = 'unknown';
    let os = 'unknown';

    // Simple device detection
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Simple browser detection
    if (/Chrome/.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/.test(userAgent)) browser = 'Firefox';
    else if (/Safari/.test(userAgent)) browser = 'Safari';
    else if (/Edge/.test(userAgent)) browser = 'Edge';

    // Simple OS detection
    if (/Windows/.test(userAgent)) os = 'Windows';
    else if (/Mac/.test(userAgent)) os = 'macOS';
    else if (/Linux/.test(userAgent)) os = 'Linux';
    else if (/Android/.test(userAgent)) os = 'Android';
    else if (/iOS/.test(userAgent)) os = 'iOS';

    return {
      type: deviceType,
      browser,
      os,
    };
  }
}

export const presenceController = new PresenceController();
