import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/user-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function userRoutes(
  fastify: FastifyInstance,
  userController: UserController,
  authMiddleware: AuthMiddleware,
  rateLimitMiddleware: RateLimitMiddleware
): Promise<void> {
  // All user routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // User operations
  fastify.get('/', {
    preHandler: readPreHandlers,
    handler: userController.getUsers,
  });

  fastify.get('/search', {
    preHandler: readPreHandlers,
    handler: userController.searchUsers,
  });

  fastify.get('/my/stats', {
    preHandler: readPreHandlers,
    handler: userController.getMyStats,
  });

  fastify.get('/:id', {
    preHandler: readPreHandlers,
    handler: userController.getUser,
  });

  fastify.put('/:id', {
    preHandler: commonPreHandlers,
    handler: userController.updateUser,
  });

  fastify.get('/:id/stats', {
    preHandler: readPreHandlers,
    handler: userController.getUserStats,
  });

  // Admin operations
  fastify.post('/:id/deactivate', {
    preHandler: commonPreHandlers,
    handler: userController.deactivateUser,
  });

  fastify.post('/:id/activate', {
    preHandler: commonPreHandlers,
    handler: userController.activateUser,
  });
}
