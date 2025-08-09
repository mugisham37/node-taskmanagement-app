import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { ProjectApplicationService } from '../../application/services/project-application-service';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  AddProjectMemberSchema,
  UpdateProjectMemberSchema,
  ProjectQuerySchema,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddProjectMemberRequest,
  UpdateProjectMemberRequest,
  ProjectQuery,
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

      const project = await this.projectService.createProject(
        userId,
        projectData
      );

      await this.sendCreated(reply, project);
    });
  };

  getProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const project = await this.projectService.getProject(userId, id);

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

      const project = await this.projectService.updateProject(
        userId,
        id,
        updateData
      );

      return project;
    });
  };

  deleteProject = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.projectService.deleteProject(userId, id);

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

      const result = await this.projectService.getProjects(userId, query);

      await this.sendPaginated(
        reply,
        result.projects,
        result.total,
        query.page,
        query.limit
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
        userId,
        workspaceId,
        query
      );

      await this.sendPaginated(
        reply,
        result.projects,
        result.total,
        query.page,
        query.limit
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

      const result = await this.projectService.getMyProjects(userId, query);

      await this.sendPaginated(
        reply,
        result.projects,
        result.total,
        query.page,
        query.limit
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

      const member = await this.projectService.addProjectMember(
        userId,
        id,
        memberData
      );

      await this.sendCreated(reply, member);
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

      await this.projectService.removeProjectMember(userId, id, memberId);

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

      const member = await this.projectService.updateProjectMember(
        userId,
        id,
        memberId,
        updateData
      );

      return member;
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

      await this.projectService.leaveProject(userId, id);

      await this.sendNoContent(reply);
    });
  };
}
