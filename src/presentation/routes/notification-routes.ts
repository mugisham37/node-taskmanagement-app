import { FastifyInstance } from 'fastify';
import { NotificationController } from '../controllers/notification-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function notificationRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const notificationController = container.resolve('NOTIFICATION_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All notification routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // Notification CRUD operations
  fastify.get('/', {
    preHandler: readPreHandlers,
    handler: notificationController.getNotifications,
  });

  fastify.get('/stats', {
    preHandler: readPreHandlers,
    handler: notificationController.getNotificationStats,
  });

  fastify.get('/unread-count', {
    preHandler: readPreHandlers,
    handler: notificationController.getUnreadNotificationCount,
  });

  fastify.get('/preferences', {
    preHandler: readPreHandlers,
    handler: notificationController.getNotificationPreferences,
  });

  fastify.put('/preferences', {
    preHandler: commonPreHandlers,
    handler: notificationController.updateNotificationPreferences,
  });

  fastify.patch('/read-all', {
    preHandler: commonPreHandlers,
    handler: notificationController.markAllNotificationsAsRead,
  });

  fastify.get('/:id', {
    preHandler: readPreHandlers,
    handler: notificationController.getNotificationById,
  });

  fastify.patch('/:id/read', {
    preHandler: commonPreHandlers,
    handler: notificationController.markNotificationAsRead,
  });

  fastify.delete('/:id', {
    preHandler: commonPreHandlers,
    handler: notificationController.deleteNotification,
  });

  // Admin operations
  fastify.post('/', {
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: notificationController.createNotification,
  });

  fastify.post('/system', {
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: notificationController.createSystemNotification,
  });

  // Testing operations
  fastify.post('/test', {
    preHandler: commonPreHandlers,
    handler: notificationController.testNotification,
  });
}
