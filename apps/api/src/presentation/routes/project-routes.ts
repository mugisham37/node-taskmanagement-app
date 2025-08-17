import { FastifyInstance } from 'fastify';
import { ProjectController } from '../controllers/project-controller';
import { TaskController } from '../controllers/task-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function projectRoutes(
  fastify: FastifyInstance,
  projectController: ProjectController,
  taskController: TaskController,
  authMiddleware: AuthMiddleware,
  rateLimitMiddleware: RateLimitMiddleware
): Promise<void> {
  // All project routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // Project CRUD operations
  fastify.post('/', {
    preHandler: commonPreHandlers,
    handler: projectController.createProject,
  });

  fastify.get('/', {
    preHandler: readPreHandlers,
    handler: projectController.getProjects,
  });

  fastify.get('/my', {
    preHandler: readPreHandlers,
    handler: projectController.getMyProjects,
  });

  fastify.get('/:id', {
    preHandler: readPreHandlers,
    handler: projectController.getProject,
  });

  fastify.put('/:id', {
    preHandler: commonPreHandlers,
    handler: projectController.updateProject,
  });

  fastify.delete('/:id', {
    preHandler: commonPreHandlers,
    handler: projectController.deleteProject,
  });

  // Project state management
  fastify.post('/:id/archive', {
    preHandler: commonPreHandlers,
    handler: projectController.archiveProject,
  });

  fastify.post('/:id/unarchive', {
    preHandler: commonPreHandlers,
    handler: projectController.unarchiveProject,
  });

  // Project statistics
  fastify.get('/:id/stats', {
    preHandler: readPreHandlers,
    handler: projectController.getProjectStats,
  });

  // Project member management
  fastify.post('/:id/members', {
    preHandler: commonPreHandlers,
    handler: projectController.addProjectMember,
  });

  fastify.get('/:id/members', {
    preHandler: readPreHandlers,
    handler: projectController.getProjectMembers,
  });

  fastify.put('/:id/members/:memberId', {
    preHandler: commonPreHandlers,
    handler: projectController.updateProjectMember,
  });

  fastify.delete('/:id/members/:memberId', {
    preHandler: commonPreHandlers,
    handler: projectController.removeProjectMember,
  });

  fastify.post('/:id/leave', {
    preHandler: commonPreHandlers,
    handler: projectController.leaveProject,
  });

  // Project tasks
  fastify.get('/:projectId/tasks', {
    preHandler: readPreHandlers,
    handler: taskController.getProjectTasks,
  });
}

