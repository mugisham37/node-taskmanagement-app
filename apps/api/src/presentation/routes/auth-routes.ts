import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function authRoutes(
  fastify: FastifyInstance,
  authController: AuthController,
  authMiddleware: AuthMiddleware,
  rateLimitMiddleware: RateLimitMiddleware
): Promise<void> {
  // Public routes (no authentication required)
  fastify.post('/register', {
    preHandler: [rateLimitMiddleware.createRateLimit(RateLimitMiddleware.AUTH)],
    handler: authController.register,
  });

  fastify.post('/login', {
    preHandler: [rateLimitMiddleware.createRateLimit(RateLimitMiddleware.AUTH)],
    handler: authController.login,
  });

  fastify.post('/refresh-token', {
    preHandler: [
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
    ],
    handler: authController.refreshToken,
  });

  // Protected routes (authentication required)
  fastify.post('/logout', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
    ],
    handler: authController.logout,
  });

  fastify.get('/profile', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: authController.getProfile,
  });

  fastify.put('/profile', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
    ],
    handler: authController.updateProfile,
  });

  fastify.post('/change-password', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: authController.changePassword,
  });

  fastify.post('/deactivate', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: authController.deactivateAccount,
  });

  // Admin routes
  fastify.post('/users/:id/activate', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
    ],
    handler: authController.activateAccount,
  });
}

