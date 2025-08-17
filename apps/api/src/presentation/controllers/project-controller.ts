import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '@taskmanagement/observability';
import { ProjectApplicationService } from '../../application/services/project-application-service';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  AddProjectMemberSchema,
  UpdateProjectMemberSchema,
  ProjectQuerySchema,
} from '../dto/project-dto';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string(),
});

const MemberParamsSchema = z.object({
  id: z.string(),
  memberId: z.string(),
});

const WorkspaceParamsSchema = z.object({
  workspaceId: z.string(),
});

export class ProjectController extends BaseController {
  constructor(
    logger: LoggingService,
    private readonly projectService: ProjectApplicationService
  ) {
    super(logger);
  }

  createProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const projectData = this.validateBody(request.body, CreateProjectSchema);

      // Ensure required fields are present and clean undefined values
      const cleanProjectData: any = {
        ownerId: userId,
        ...Object.fromEntries(
          Object.entries(projectData).filter(([, value]) => value !== undefined)
        ),
      };

      const projectId = await this.projectService.createProject(cleanProjectData);

      await this.sendCreated(reply, { projectId });
    });
  };

  getProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const project = await this.projectService.getProjectById(id, userId);

      return project;
    });
  };

  updateProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const updateData = this.validateBody(request.body, UpdateProjectSchema);

      // Clean undefined values to match exactOptionalPropertyTypes
      const cleanUpdateData: any = {
        projectId: id,
        updatedBy: userId,
        ...Object.fromEntries(
          Object.entries(updateData).filter(([, value]) => value !== undefined)
        ),
      };

      await this.projectService.updateProject(cleanUpdateData);

      return { success: true, message: 'Project updated successfully' };
    });
  };

  deleteProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.projectService.deleteProject(id, userId);

      await this.sendNoContent(reply);
    });
  };

  archiveProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const project = await this.projectService.archiveProject(userId, id);

      return project;
    });
  };

  unarchiveProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const project = await this.projectService.unarchiveProject(userId, id);

      return project;
    });
  };

  getProjects = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, ProjectQuerySchema);

      const cleanOptions: any = {
        page: query.page || 1,
        limit: query.limit || 20,
      };
      if (query.workspaceId) {
        cleanOptions.workspaceId = query.workspaceId;
      }

      const result = await this.projectService.getProjects(userId, cleanOptions);

      await this.sendPaginated(
        reply,
        result.projects,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getWorkspaceProjects = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { workspaceId } = this.validateParams(
        request.params,
        WorkspaceParamsSchema
      );
      const query = this.validateQuery(request.query, ProjectQuerySchema);

      const result = await this.projectService.getWorkspaceProjects(
        workspaceId,
        userId,
        {
          page: query.page || 1,
          limit: query.limit || 20,
        }
      );

      await this.sendPaginated(
        reply,
        result.projects,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getMyProjects = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, ProjectQuerySchema);

      const result = await this.projectService.getMyProjects(userId, {
        page: query.page || 1,
        limit: query.limit || 20,
      });

      await this.sendPaginated(
        reply,
        result.projects,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getProjectStats = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const stats = await this.projectService.getProjectStats(userId, id);

      return stats;
    });
  };

  // Project Members Management
  addProjectMember = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const memberData = this.validateBody(
        request.body,
        AddProjectMemberSchema
      );

      await this.projectService.addProjectMember({
        projectId: id,
        userId: memberData.userId,
        role: memberData.role,
        addedBy: userId,
      });

      await this.sendCreated(reply, { success: true, message: 'Member added successfully' });
    });
  };

  removeProjectMember = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id, memberId } = this.validateParams(
        request.params,
        MemberParamsSchema
      );

      await this.projectService.removeProjectMember(id, memberId, userId);

      await this.sendNoContent(reply);
    });
  };

  updateProjectMember = async (
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
        UpdateProjectMemberSchema
      );

      await this.projectService.updateProjectMember({
        projectId: id,
        userId: memberId,
        role: updateData.role,
        updatedBy: userId,
      });

      return { success: true, message: 'Member updated successfully' };
    });
  };

  getProjectMembers = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const members = await this.projectService.getProjectMembers(userId, id);

      return members;
    });
  };

  leaveProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.projectService.leaveProject(id, userId);

      await this.sendNoContent(reply);
    });
  };
}

