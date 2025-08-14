import { FastifyInstance } from 'fastify';
import { WorkspaceController } from '../controllers/workspace-controller';
import { ProjectController } from '../controllers/project-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function workspaceRoutes(
  fastify: FastifyInstance,
  workspaceController: WorkspaceController,
  projectController: ProjectController,
  authMiddleware: AuthMiddleware,
  rateLimitMiddleware: RateLimitMiddleware
): Promise<void> {
  // All workspace routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // Workspace CRUD operations
  fastify.post('/', {
    preHandler: commonPreHandlers,
    handler: workspaceController.createWorkspace,
  });

  fastify.get('/', {
    preHandler: readPreHandlers,
    handler: workspaceController.getWorkspaces,
  });

  fastify.get('/my', {
    preHandler: readPreHandlers,
    handler: workspaceController.getMyWorkspaces,
  });

  fastify.get('/:id', {
    preHandler: readPreHandlers,
    handler: workspaceController.getWorkspace,
  });

  fastify.put('/:id', {
    preHandler: commonPreHandlers,
    handler: workspaceController.updateWorkspace,
  });

  fastify.delete('/:id', {
    preHandler: commonPreHandlers,
    handler: workspaceController.deleteWorkspace,
  });

  // Workspace state management
  fastify.post('/:id/deactivate', {
    preHandler: commonPreHandlers,
    handler: workspaceController.deactivateWorkspace,
  });

  fastify.post('/:id/activate', {
    preHandler: commonPreHandlers,
    handler: workspaceController.activateWorkspace,
  });

  // Workspace statistics
  fastify.get('/:id/stats', {
    preHandler: readPreHandlers,
    handler: workspaceController.getWorkspaceStats,
  });

  // Workspace member management
  fastify.post('/:id/invite', {
    preHandler: commonPreHandlers,
    handler: workspaceController.inviteWorkspaceMember,
  });

  fastify.get('/:id/members', {
    preHandler: readPreHandlers,
    handler: workspaceController.getWorkspaceMembers,
  });

  fastify.put('/:id/members/:memberId', {
    preHandler: commonPreHandlers,
    handler: workspaceController.updateWorkspaceMember,
  });

  fastify.delete('/:id/members/:memberId', {
    preHandler: commonPreHandlers,
    handler: workspaceController.removeWorkspaceMember,
  });

  fastify.post('/:id/leave', {
    preHandler: commonPreHandlers,
    handler: workspaceController.leaveWorkspace,
  });

  // Workspace invitation management
  fastify.get('/:id/invitations', {
    preHandler: readPreHandlers,
    handler: workspaceController.getWorkspaceInvitations,
  });

  fastify.delete('/:id/invitations/:invitationId', {
    preHandler: commonPreHandlers,
    handler: workspaceController.cancelWorkspaceInvitation,
  });

  // User invitation management (global routes)
  fastify.get('/invitations/my', {
    preHandler: readPreHandlers,
    handler: workspaceController.getMyInvitations,
  });

  fastify.post('/invitations/:invitationId/accept', {
    preHandler: commonPreHandlers,
    handler: workspaceController.acceptWorkspaceInvitation,
  });

  fastify.post('/invitations/:invitationId/decline', {
    preHandler: commonPreHandlers,
    handler: workspaceController.declineWorkspaceInvitation,
  });

  // Workspace projects
  fastify.get('/:workspaceId/projects', {
    preHandler: readPreHandlers,
    handler: projectController.getWorkspaceProjects,
  });
}
