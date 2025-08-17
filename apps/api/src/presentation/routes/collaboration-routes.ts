import { FastifyInstance } from 'fastify';
import { RateLimitMiddleware } from '../middleware';

export async function collaborationRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const collaborationController = container.resolve('COLLABORATION_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All collaboration routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // Comments system
  fastify.post('/comments', {
    preHandler: commonPreHandlers,
    handler: collaborationController.createComment,
  });

  fastify.get('/comments', {
    preHandler: readPreHandlers,
    handler: collaborationController.getComments,
  });

  fastify.get('/comments/:id', {
    preHandler: readPreHandlers,
    handler: collaborationController.getComment,
  });

  fastify.put('/comments/:id', {
    preHandler: commonPreHandlers,
    handler: collaborationController.updateComment,
  });

  fastify.delete('/comments/:id', {
    preHandler: commonPreHandlers,
    handler: collaborationController.deleteComment,
  });

  // Comment reactions
  fastify.post('/comments/:id/reactions', {
    preHandler: commonPreHandlers,
    handler: collaborationController.addCommentReaction,
  });

  fastify.delete('/comments/:id/reactions/:reactionId', {
    preHandler: commonPreHandlers,
    handler: collaborationController.removeCommentReaction,
  });

  // Mentions and notifications
  fastify.get('/mentions', {
    preHandler: readPreHandlers,
    handler: collaborationController.getMentions,
  });

  fastify.post('/mentions/:id/read', {
    preHandler: commonPreHandlers,
    handler: collaborationController.markMentionAsRead,
  });

  // Activity feeds
  fastify.get('/activity', {
    preHandler: readPreHandlers,
    handler: collaborationController.getActivityFeed,
  });

  fastify.get('/activity/project/:projectId', {
    preHandler: readPreHandlers,
    handler: collaborationController.getProjectActivity,
  });

  fastify.get('/activity/task/:taskId', {
    preHandler: readPreHandlers,
    handler: collaborationController.getTaskActivity,
  });

  // Real-time collaboration
  fastify.get('/presence', {
    preHandler: readPreHandlers,
    handler: collaborationController.getPresence,
  });

  fastify.post('/presence/update', {
    preHandler: commonPreHandlers,
    handler: collaborationController.updatePresence,
  });

  // Document collaboration
  fastify.post('/documents/:id/lock', {
    preHandler: commonPreHandlers,
    handler: collaborationController.lockDocument,
  });

  fastify.post('/documents/:id/unlock', {
    preHandler: commonPreHandlers,
    handler: collaborationController.unlockDocument,
  });

  fastify.get('/documents/:id/locks', {
    preHandler: readPreHandlers,
    handler: collaborationController.getDocumentLocks,
  });

  // Team collaboration
  fastify.get('/teams/:teamId/activity', {
    preHandler: readPreHandlers,
    handler: collaborationController.getTeamActivity,
  });

  fastify.get('/teams/:teamId/members/online', {
    preHandler: readPreHandlers,
    handler: collaborationController.getOnlineTeamMembers,
  });

  // Collaboration analytics
  fastify.get('/analytics/engagement', {
    preHandler: readPreHandlers,
    handler: collaborationController.getEngagementAnalytics,
  });

  fastify.get('/analytics/communication', {
    preHandler: readPreHandlers,
    handler: collaborationController.getCommunicationAnalytics,
  });

  // Collaboration settings
  fastify.get('/settings', {
    preHandler: readPreHandlers,
    handler: collaborationController.getCollaborationSettings,
  });

  fastify.put('/settings', {
    preHandler: commonPreHandlers,
    handler: collaborationController.updateCollaborationSettings,
  });
}

