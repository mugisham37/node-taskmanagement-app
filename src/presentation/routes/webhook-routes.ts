import { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhook-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function webhookRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const webhookController = container.resolve('WEBHOOK_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All webhook routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // Global webhook operations
  fastify.get('/events', {
    preHandler: readPreHandlers,
    handler: webhookController.getSupportedEvents,
  });

  fastify.post('/generate-secret', {
    preHandler: commonPreHandlers,
    handler: webhookController.generateWebhookSecret,
  });

  // Workspace-specific webhook operations
  fastify.get('/workspaces/:workspaceId/webhooks', {
    preHandler: readPreHandlers,
    handler: webhookController.getWebhooks,
  });

  fastify.post('/workspaces/:workspaceId/webhooks', {
    preHandler: commonPreHandlers,
    handler: webhookController.createWebhook,
  });

  fastify.get('/workspaces/:workspaceId/webhooks/stats', {
    preHandler: readPreHandlers,
    handler: webhookController.getWorkspaceWebhookStats,
  });

  fastify.get('/workspaces/:workspaceId/webhooks/:webhookId', {
    preHandler: readPreHandlers,
    handler: webhookController.getWebhook,
  });

  fastify.put('/workspaces/:workspaceId/webhooks/:webhookId', {
    preHandler: commonPreHandlers,
    handler: webhookController.updateWebhook,
  });

  fastify.delete('/workspaces/:workspaceId/webhooks/:webhookId', {
    preHandler: commonPreHandlers,
    handler: webhookController.deleteWebhook,
  });

  // Webhook testing and validation
  fastify.post('/workspaces/:workspaceId/webhooks/:webhookId/test', {
    preHandler: commonPreHandlers,
    handler: webhookController.testWebhook,
  });

  fastify.post('/workspaces/:workspaceId/webhooks/:webhookId/validate', {
    preHandler: commonPreHandlers,
    handler: webhookController.validateWebhook,
  });

  // Webhook statistics and monitoring
  fastify.get('/workspaces/:workspaceId/webhooks/:webhookId/stats', {
    preHandler: readPreHandlers,
    handler: webhookController.getWebhookStats,
  });

  // Webhook deliveries
  fastify.get('/workspaces/:workspaceId/webhooks/:webhookId/deliveries', {
    preHandler: readPreHandlers,
    handler: webhookController.getWebhookDeliveries,
  });

  fastify.post(
    '/workspaces/:workspaceId/webhooks/:webhookId/deliveries/:deliveryId/retry',
    {
      preHandler: commonPreHandlers,
      handler: webhookController.retryWebhookDelivery,
    }
  );

  // Security operations
  fastify.post('/workspaces/:workspaceId/webhooks/:webhookId/rotate-secret', {
    preHandler: commonPreHandlers,
    handler: webhookController.rotateWebhookSecret,
  });
}
