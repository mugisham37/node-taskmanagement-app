import { FastifyInstance } from 'fastify';
import { TaskController } from '../controllers/task-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function taskRoutes(
  fastify: FastifyInstance,
  taskController: TaskController,
  authMiddleware: AuthMiddleware,
  rateLimitMiddleware: RateLimitMiddleware
): Promise<void> {
  // All task routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  // Task CRUD operations
  fastify.post('/', {
    preHandler: commonPreHandlers,
    handler: taskController.createTask,
  });

  fastify.get('/', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: taskController.getTasks,
  });

  fastify.get('/my', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: taskController.getMyTasks,
  });

  fastify.get('/assigned', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: taskController.getAssignedTasks,
  });

  fastify.get('/overdue', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: taskController.getOverdueTasks,
  });

  fastify.get('/:id', {
    preHandler: [
      authMiddleware.authenticate,
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: taskController.getTask,
  });

  fastify.put('/:id', {
    preHandler: commonPreHandlers,
    handler: taskController.updateTask,
  });

  fastify.delete('/:id', {
    preHandler: commonPreHandlers,
    handler: taskController.deleteTask,
  });

  // Task state management
  fastify.post('/:id/assign', {
    preHandler: commonPreHandlers,
    handler: taskController.assignTask,
  });

  fastify.post('/:id/unassign', {
    preHandler: commonPreHandlers,
    handler: taskController.unassignTask,
  });

  fastify.post('/:id/start', {
    preHandler: commonPreHandlers,
    handler: taskController.startTask,
  });

  fastify.post('/:id/submit-for-review', {
    preHandler: commonPreHandlers,
    handler: taskController.submitForReview,
  });

  fastify.post('/:id/complete', {
    preHandler: commonPreHandlers,
    handler: taskController.completeTask,
  });

  fastify.post('/:id/reopen', {
    preHandler: commonPreHandlers,
    handler: taskController.reopenTask,
  });

  fastify.post('/:id/cancel', {
    preHandler: commonPreHandlers,
    handler: taskController.cancelTask,
  });
}
