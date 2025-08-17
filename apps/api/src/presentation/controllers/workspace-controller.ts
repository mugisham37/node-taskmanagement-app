import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '@taskmanagement/observability';
import { WorkspaceApplicationService } from '../../application/services/workspace-application-service';
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  InviteWorkspaceMemberSchema,
  UpdateWorkspaceMemberSchema,
  WorkspaceQuerySchema,
  WorkspaceMemberQuerySchema,
} from '../dto/workspace-dto';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string(),
});

const MemberParamsSchema = z.object({
  id: z.string(),
  memberId: z.string(),
});

const InvitationParamsSchema = z.object({
  id: z.string(),
  invitationId: z.string(),
});

const InvitationIdParamsSchema = z.object({
  invitationId: z.string(),
});

export class WorkspaceController extends BaseController {
  constructor(
    logger: LoggingService,
    private readonly workspaceService: WorkspaceApplicationService
  ) {
    super(logger);
  }

  createWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const workspaceData = this.validateBody(
        request.body,
        CreateWorkspaceSchema
      );

      // Transform DTO to service request
      const createRequest = {
        name: workspaceData.name,
        description: workspaceData.description || null,
      };

      const workspaceId = await this.workspaceService.createWorkspace(
        userId,
        createRequest
      );

      await this.sendCreated(reply, { id: workspaceId.value });
    });
  };

  getWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const workspace = await this.workspaceService.getWorkspaceById(id, userId);

      return workspace;
    });
  };

  updateWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const updateData = this.validateBody(request.body, UpdateWorkspaceSchema);

      // Transform DTO to service request
      const updateRequest = {
        name: updateData.name,
        description: updateData.description || null,
      };

      const workspace = await this.workspaceService.updateWorkspace(
        userId,
        id,
        updateRequest
      );

      return workspace;
    });
  };

  deleteWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.workspaceService.deleteWorkspace(userId, id);

      await this.sendNoContent(reply);
    });
  };

  deactivateWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const workspace = await this.workspaceService.deactivateWorkspace(
        userId,
        id
      );

      return workspace;
    });
  };

  activateWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const workspace = await this.workspaceService.activateWorkspace(
        userId,
        id
      );

      return workspace;
    });
  };

  getWorkspaces = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, WorkspaceQuerySchema);

      const result = await this.workspaceService.getUserWorkspaces(userId, query);

      await this.sendPaginated(
        reply,
        result.workspaces,
        result.total,
        query.page || 1,
        query.limit || 10
      );
    });
  };

  getMyWorkspaces = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, WorkspaceQuerySchema);

      const result = await this.workspaceService.getUserWorkspaces(userId, query);

      await this.sendPaginated(
        reply,
        result.workspaces,
        result.total,
        query.page || 1,
        query.limit || 10
      );
    });
  };

  getWorkspaceStats = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const stats = await this.workspaceService.getWorkspaceStats(userId, id);

      return stats;
    });
  };

  // Workspace Members Management
  inviteWorkspaceMember = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const inviteData = this.validateBody(
        request.body,
        InviteWorkspaceMemberSchema
      );

      const invitation = await this.workspaceService.inviteWorkspaceMember(
        userId,
        id,
        inviteData
      );

      await this.sendCreated(reply, invitation);
    });
  };

  removeWorkspaceMember = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id, memberId } = this.validateParams(
        request.params,
        MemberParamsSchema
      );

      await this.workspaceService.removeWorkspaceMember(userId, id, memberId);

      await this.sendNoContent(reply);
    });
  };

  updateWorkspaceMember = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id, memberId } = this.validateParams(
        request.params,
        MemberParamsSchema
      );
      const updateData = this.validateBody(
        request.body,
        UpdateWorkspaceMemberSchema
      );

      const member = await this.workspaceService.updateWorkspaceMember(
        userId,
        id,
        memberId,
        updateData
      );

      return member;
    });
  };

  getWorkspaceMembers = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const query = this.validateQuery(
        request.query,
        WorkspaceMemberQuerySchema
      );

      const result = await this.workspaceService.getWorkspaceMembers(
        userId,
        id,
        query
      );

      await this.sendPaginated(
        reply,
        result.members,
        result.total,
        query.page || 1,
        query.limit || 10
      );
    });
  };

  leaveWorkspace = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.workspaceService.leaveWorkspace(userId, id);

      await this.sendNoContent(reply);
    });
  };

  // Workspace Invitations Management
  getWorkspaceInvitations = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const invitations = await this.workspaceService.getWorkspaceInvitations(
        userId,
        id
      );

      return invitations;
    });
  };

  cancelWorkspaceInvitation = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id, invitationId } = this.validateParams(
        request.params,
        InvitationParamsSchema
      );

      await this.workspaceService.cancelWorkspaceInvitation(
        userId,
        id,
        invitationId
      );

      await this.sendNoContent(reply);
    });
  };

  acceptWorkspaceInvitation = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { invitationId } = this.validateParams(request.params, InvitationIdParamsSchema);

      const member = await this.workspaceService.acceptWorkspaceInvitation(
        userId,
        invitationId
      );

      return member;
    });
  };

  declineWorkspaceInvitation = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { invitationId } = this.validateParams(request.params, InvitationIdParamsSchema);

      await this.workspaceService.declineWorkspaceInvitation(
        userId,
        invitationId
      );

      await this.sendNoContent(reply);
    });
  };

  getMyInvitations = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      const invitations = await this.workspaceService.getMyInvitations(userId);

      return invitations;
    });
  };
}

