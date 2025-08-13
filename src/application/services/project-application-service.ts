/**
 * Project Application Service
 *
 * Handles project lifecycle management, team operations, and permissions
 */

import {
  BaseApplicationService,
  ValidationResult,
  RequiredFieldValidationRule,
  LengthValidationRule,
} from './base-application-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { Project } from '../../domain/entities/project';
import { ProjectRole } from '../../domain/value-objects/project-role';
import { ProjectStatus } from '../../shared/constants/project-constants';
import { injectable } from '../../shared/decorators/injectable.decorator';
import { ICommandBus } from '../cqrs/command';
import {
  CreateProjectCommand,
  UpdateProjectCommand,
  AddProjectMemberCommand,
  RemoveProjectMemberCommand,
  UpdateProjectMemberRoleCommand,
  ArchiveProjectCommand,
  RestoreProjectCommand,
  UpdateProjectStatusCommand
} from '../commands/project-commands';

export interface CreateProjectRequest {
  name: string;
  description?: string;
  workspaceId: string;
  ownerId: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tags?: string[];
}

export interface UpdateProjectRequest {
  projectId: string;
  name?: string;
  description?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tags?: string[];
  updatedBy: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description?: string;
  status: string;
  workspaceId: string;
  ownerId: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tags: string[];
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  permissions: string[];
  joinedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AddMemberRequest {
  projectId: string;
  userId: string;
  role: string;
  addedBy: string;
}

export interface UpdateMemberRoleRequest {
  projectId: string;
  userId: string;
  newRole: string;
  updatedBy: string;
}

export interface ProjectStatistics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMembers: number;
  averageProjectDuration: number;
  projectCompletionRate: number;
}

@injectable()
export class ProjectApplicationService extends BaseApplicationService {
  private readonly PROJECT_CACHE_TTL = 3600; // 1 hour
  private readonly MEMBER_CACHE_TTL = 1800; // 30 minutes

  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly commandBus: ICommandBus
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Create a new project
   */
  async createProject(request: CreateProjectRequest): Promise<ProjectId> {
    return await this.executeWithMonitoring('createProject', async () => {
      // Validate input
      const validation = this.validateCreateProjectRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const workspaceId = new WorkspaceId(request.workspaceId);
      const ownerId = new UserId(request.ownerId);
      const managerId = new UserId(request.ownerId);

      // Check if user can create projects in this workspace
      const canCreate = await this.canUserCreateProject(ownerId, workspaceId);
      if (!canCreate) {
        throw new Error('Insufficient permissions to create project in this workspace');
      }

      // Use command pattern for project creation
      const command = new CreateProjectCommand(
        request.name,
        request.description || '',
        workspaceId,
        managerId,
        ownerId,
        request.startDate,
        request.endDate
      );

      const projectId = await this.commandBus.send<ProjectId>(command);

      // Clear cache
      await this.clearProjectCaches(projectId, workspaceId);

      this.logInfo('Project created successfully', {
        projectId: projectId.value,
        name: request.name,
        workspaceId: request.workspaceId,
        ownerId: request.ownerId,
      });

      return projectId;
    });
  }

  /**
   * Update project details
   */
  async updateProject(request: UpdateProjectRequest): Promise<void> {
    return await this.executeWithMonitoring('updateProject', async () => {
      const validation = this.validateUpdateProjectRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const projectId = new ProjectId(request.projectId);
      const updatedBy = new UserId(request.updatedBy);

      // Check if user can update this project
      const canUpdate = await this.canUserUpdateProject(updatedBy, projectId);
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update project');
      }

      // Use command pattern for project update
      const command = new UpdateProjectCommand(
        projectId,
        updatedBy,
        request.name,
        request.description,
        request.startDate,
        request.endDate
      );

      await this.commandBus.send(command);

      // Clear cache
      const project = await this.projectRepository.findById(projectId);
      if (project) {
        await this.clearProjectCaches(projectId, project.workspaceId);
      }

      this.logInfo('Project updated successfully', {
        projectId: request.projectId,
        updatedBy: request.updatedBy,
      });
    });
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string, deletedBy: string): Promise<void> {
    return await this.executeWithMonitoring('deleteProject', async () => {
      const projectIdVO = new ProjectId(projectId);
      const deletedByVO = new UserId(deletedBy);

      const project = await this.projectRepository.findById(projectIdVO);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check permissions (only owner or workspace admin can delete)
      const canDelete = await this.canUserDeleteProject(
        deletedByVO,
        projectIdVO
      );
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete project');
      }

      // Soft delete project
      project.archive();
      await this.projectRepository.save(project);

      // Clear cache
      await this.clearProjectCaches(projectIdVO, project.workspaceId);

      this.logInfo('Project deleted successfully', {
        projectId,
        deletedBy,
      });
    });
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string, userId: string): Promise<ProjectDto> {
    return await this.executeWithMonitoring('getProjectById', async () => {
      const projectIdVO = new ProjectId(projectId);
      const userIdVO = new UserId(userId);

      // Check cache first
      const cacheKey = `project:${projectId}`;
      const cachedProject = await this.cacheService.get<ProjectDto>(cacheKey);
      if (cachedProject) {
        // Verify user still has access
        const hasAccess = await this.canUserViewProject(userIdVO, projectIdVO);
        if (hasAccess) {
          return cachedProject;
        }
      }

      const project = await this.projectRepository.findById(projectIdVO);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check permissions
      const canView = await this.canUserViewProject(userIdVO, projectIdVO);
      if (!canView) {
        throw new Error('Insufficient permissions to view project');
      }

      const projectDto = await this.mapProjectToDto(project);

      // Cache the result
      await this.cacheService.set(cacheKey, projectDto, this.PROJECT_CACHE_TTL);

      return projectDto;
    });
  }

  /**
   * Get projects by workspace
   */
  async getProjectsByWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<ProjectDto[]> {
    return await this.executeWithMonitoring(
      'getProjectsByWorkspace',
      async () => {
        const workspaceIdVO = new WorkspaceId(workspaceId);
        const userIdVO = new UserId(userId);

        // Check if user has access to workspace
        const hasWorkspaceAccess = await this.canUserAccessWorkspace(
          userIdVO,
          workspaceIdVO
        );
        if (!hasWorkspaceAccess) {
          throw new Error('Insufficient permissions to access workspace');
        }

        const projects =
          await this.projectRepository.findByWorkspaceId(workspaceIdVO);

        // Filter projects user can view and map to DTOs
        const projectDtos: ProjectDto[] = [];
        for (const project of projects.items) {
          const canView = await this.canUserViewProject(userIdVO, project.id);
          if (canView) {
            const dto = await this.mapProjectToDto(project);
            projectDtos.push(dto);
          }
        }

        return projectDtos;
      }
    );
  }

  /**
   * Add member to project
   */
  async addMember(request: AddMemberRequest): Promise<void> {
    return await this.executeWithMonitoring('addMember', async () => {
      const projectId = new ProjectId(request.projectId);
      const memberId = new UserId(request.userId);
      const addedBy = new UserId(request.addedBy);
      const role = request.role as ProjectRole;

      // Check if user can manage members
      const canManageMembers = await this.canUserManageMembers(addedBy, projectId);
      if (!canManageMembers) {
        throw new Error('Insufficient permissions to manage project members');
      }

      // Use command pattern for adding project member
      const command = new AddProjectMemberCommand(
        projectId,
        memberId,
        role,
        addedBy,
        addedBy
      );

      await this.commandBus.send(command);

      // Send notification email to the new member
      try {
        const user = await this.userRepository.findById(memberId);
        const project = await this.projectRepository.findById(projectId);
        if (user && project) {
          await this.emailService.sendEmail({
            to: user.email.value,
            subject: `Added to Project: ${project.name}`,
            html: `
              <h2>You've been added to project "${project.name}"</h2>
              <p>Hello ${user.firstName},</p>
              <p>You have been added to the project "${project.name}" with the role of ${role}.</p>
              <p>You can now access the project and collaborate with your team.</p>
              <p>Best regards,<br>The Task Management Team</p>
            `,
            text: `You've been added to project "${project.name}" with the role of ${role}.`,
            priority: 'normal' as const,
          });
        }
      } catch (emailError) {
        // Log email error but don't fail the operation
        this.logError('Failed to send project invitation email', emailError as Error, {
          projectId: request.projectId,
          userId: request.userId,
        });
      }

      // Clear member cache
      await this.clearMemberCaches(projectId);

      this.logInfo('Member added to project', {
        projectId: request.projectId,
        userId: request.userId,
        role: request.role,
        addedBy: request.addedBy,
      });
    });
  }

  /**
   * Remove member from project
   */
  async removeMember(
    projectId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    return await this.executeWithMonitoring('removeMember', async () => {
      const projectIdVO = new ProjectId(projectId);
      const memberIdVO = new UserId(userId);
      const removedByVO = new UserId(removedBy);

      // Check if user can manage members
      const canManageMembers = await this.canUserManageMembers(removedByVO, projectIdVO);
      if (!canManageMembers) {
        throw new Error('Insufficient permissions to manage project members');
      }

      // Use command pattern for removing project member
      const command = new RemoveProjectMemberCommand(
        projectIdVO,
        memberIdVO,
        removedByVO,
        removedByVO
      );

      await this.commandBus.send(command);

      // Clear member cache
      await this.clearMemberCaches(projectIdVO);

      this.logInfo('Member removed from project', {
        projectId,
        userId,
        removedBy,
      });
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(request: UpdateMemberRoleRequest): Promise<void> {
    return await this.executeWithMonitoring('updateMemberRole', async () => {
      const projectId = new ProjectId(request.projectId);
      const memberId = new UserId(request.userId);
      const updatedBy = new UserId(request.updatedBy);
      const newRole = request.newRole as ProjectRole;

      // Check if user can manage members
      const canManageMembers = await this.canUserManageMembers(updatedBy, projectId);
      if (!canManageMembers) {
        throw new Error('Insufficient permissions to manage project members');
      }

      // Use command pattern for updating project member role
      const command = new UpdateProjectMemberRoleCommand(
        projectId,
        memberId,
        newRole,
        updatedBy,
        updatedBy
      );

      await this.commandBus.send(command);

      this.logInfo('Member role updated successfully', {
        projectId: request.projectId,
        userId: request.userId,
        newRole: request.newRole,
        updatedBy: request.updatedBy,
      });
    });
  }

  /**
   * Archive project
   */
  async archiveProject(projectId: string, archivedBy: string): Promise<void> {
    return await this.executeWithMonitoring('archiveProject', async () => {
      const projectIdVO = new ProjectId(projectId);
      const archivedByVO = new UserId(archivedBy);

      // Use command pattern for archiving project
      const command = new ArchiveProjectCommand(
        projectIdVO,
        archivedByVO,
        archivedByVO
      );

      await this.commandBus.send(command);

      this.logInfo('Project archived successfully', {
        projectId,
        archivedBy,
      });
    });
  }

  /**
   * Restore project
   */
  async restoreProject(projectId: string, restoredBy: string): Promise<void> {
    return await this.executeWithMonitoring('restoreProject', async () => {
      const projectIdVO = new ProjectId(projectId);
      const restoredByVO = new UserId(restoredBy);

      // Use command pattern for restoring project
      const command = new RestoreProjectCommand(
        projectIdVO,
        restoredByVO,
        restoredByVO
      );

      await this.commandBus.send(command);

      this.logInfo('Project restored successfully', {
        projectId,
        restoredBy,
      });
    });
  }

  /**
   * Update project status
   */
  async updateProjectStatus(
    projectId: string,
    status: ProjectStatus,
    updatedBy: string
  ): Promise<void> {
    return await this.executeWithMonitoring('updateProjectStatus', async () => {
      const projectIdVO = new ProjectId(projectId);
      const updatedByVO = new UserId(updatedBy);

      // Use command pattern for updating project status
      const command = new UpdateProjectStatusCommand(
        projectIdVO,
        status,
        updatedByVO,
        updatedByVO
      );

      await this.commandBus.send(command);

      this.logInfo('Project status updated successfully', {
        projectId,
        status,
        updatedBy,
      });
    });
  }

  /**
   * Get project members
   */
  async getProjectMembers(
    projectId: string,
    userId: string
  ): Promise<ProjectMemberDto[]> {
    return await this.executeWithMonitoring('getProjectMembers', async () => {
      const projectIdVO = new ProjectId(projectId);
      const userIdVO = new UserId(userId);

      // Check permissions
      const canView = await this.canUserViewProject(userIdVO, projectIdVO);
      if (!canView) {
        throw new Error('Insufficient permissions to view project members');
      }

      // Check cache first
      const cacheKey = `project-members:${projectId}`;
      const cachedMembers =
        await this.cacheService.get<ProjectMemberDto[]>(cacheKey);
      if (cachedMembers) {
        return cachedMembers;
      }

      const members =
        await this.projectRepository.getProjectMembers(projectIdVO);
      const memberDtos: ProjectMemberDto[] = [];

      for (const member of members) {
        const user = await this.userRepository.findById(member.userId);
        if (user) {
          memberDtos.push({
            id: member.id.value,
            projectId: member.projectId.value,
            userId: member.userId.value,
            role: member.role.value,
            permissions: member.getPermissions(),
            joinedAt: member.joinedAt,
            user: {
              id: user.id.value,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email.value,
            },
          });
        }
      }

      // Cache the result
      await this.cacheService.set(cacheKey, memberDtos, this.MEMBER_CACHE_TTL);

      return memberDtos;
    });
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(
    workspaceId: string,
    userId: string
  ): Promise<ProjectStatistics> {
    return await this.executeWithMonitoring(
      'getProjectStatistics',
      async () => {
        const workspaceIdVO = new WorkspaceId(workspaceId);
        const userIdVO = new UserId(userId);

        // Check permissions
        const hasAccess = await this.canUserAccessWorkspace(
          userIdVO,
          workspaceIdVO
        );
        if (!hasAccess) {
          throw new Error(
            'Insufficient permissions to view workspace statistics'
          );
        }

        const cacheKey = `project-stats:${workspaceId}`;
        const cachedStats =
          await this.cacheService.get<ProjectStatistics>(cacheKey);
        if (cachedStats) {
          return cachedStats;
        }

        const stats =
          await this.projectRepository.getProjectStatistics(workspaceIdVO);

        // Transform repository result to match ProjectStatistics interface
        const projectStats: ProjectStatistics = {
          totalProjects: stats.total,
          activeProjects: stats.byStatus[ProjectStatus.ACTIVE] || 0,
          completedProjects: stats.byStatus[ProjectStatus.COMPLETED] || 0,
          onHoldProjects: stats.byStatus[ProjectStatus.ON_HOLD] || 0,
          totalTasks: 0, // Would need additional repository method
          completedTasks: 0, // Would need additional repository method
          overdueTasks: 0, // Would need additional repository method
          totalMembers: stats.totalMembers,
          averageProjectDuration: stats.averageCompletionTime || 0,
          projectCompletionRate: stats.total > 0 ? 
            ((stats.byStatus[ProjectStatus.COMPLETED] || 0) / stats.total) * 100 : 0,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, projectStats, 300);

        return projectStats;
      }
    );
  }

  // Private helper methods
  private validateCreateProjectRequest(
    request: CreateProjectRequest
  ): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('name', 'Project Name'),
      new RequiredFieldValidationRule('workspaceId', 'Workspace ID'),
      new RequiredFieldValidationRule('ownerId', 'Owner ID'),
      new LengthValidationRule('name', 1, 100, 'Project Name'),
    ]);
  }

  private validateUpdateProjectRequest(
    request: UpdateProjectRequest
  ): ValidationResult {
    const rules: any[] = [
      new RequiredFieldValidationRule('projectId', 'Project ID'),
      new RequiredFieldValidationRule('updatedBy', 'Updated By'),
    ];

    if (request.name !== undefined) {
      rules.push(new LengthValidationRule('name', 1, 100, 'Project Name'));
    }

    return this.validateInput(request, rules);
  }

  private async canUserCreateProject(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    // Check if user is member of the workspace with appropriate permissions
    const workspaceMember = await this.workspaceRepository.findMember(workspaceId, userId);
    return workspaceMember !== null;
  }

  private async canUserUpdateProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null && (member.role.isAdmin() || member.role.isManager());
  }

  private async canUserDeleteProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const project = await this.projectRepository.findById(projectId);
    return project ? project.managerId.equals(userId) : false;
  }

  private async canUserViewProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
  }

  private async canUserManageMembers(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null && (member.role.isAdmin() || member.role.isManager());
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    // Check if user is member of the workspace
    const workspaceMember = await this.workspaceRepository.findMember(workspaceId, userId);
    return workspaceMember !== null;
  }

  private async mapProjectToDto(project: Project): Promise<ProjectDto> {
    // Get additional data for DTO
    const memberCount = await this.projectRepository.getMemberCount(project.id);
    const taskStats = await this.projectRepository.getTaskStatistics(
      project.id
    );

    return {
      id: project.id.value,
      name: project.name,
      description: project.description,
      status: project.status.value,
      workspaceId: project.workspaceId.value,
      ownerId: project.managerId.value,
      startDate: project.startDate || new Date(),
      endDate: project.endDate || new Date(),
      budget: 0, // Budget not implemented in current Project entity
      tags: [], // Tags not implemented in current Project entity
      memberCount,
      taskCount: taskStats.totalTasks,
      completedTaskCount: taskStats.completedTasks,
      progress:
        taskStats.totalTasks > 0
          ? (taskStats.completedTasks / taskStats.totalTasks) * 100
          : 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private async clearProjectCaches(
    projectId: ProjectId,
    workspaceId: WorkspaceId
  ): Promise<void> {
    await Promise.all([
      this.cacheService.delete(`project:${projectId.value}`),
      this.cacheService.delete(`project-stats:${workspaceId.value}`),
      this.clearMemberCaches(projectId),
    ]);
  }

  private async clearMemberCaches(projectId: ProjectId): Promise<void> {
    await this.cacheService.delete(`project-members:${projectId.value}`);
  }

  // Additional convenience methods for controller compatibility
  
  async unarchiveProject(projectId: string, unarchivedBy: string): Promise<void> {
    return await this.executeWithMonitoring('unarchiveProject', async () => {
      // Use restore command for unarchiving
      const projectIdVO = new ProjectId(projectId);
      const restoredByVO = new UserId(unarchivedBy);

      const command = new RestoreProjectCommand(
        projectIdVO,
        restoredByVO,
        restoredByVO
      );

      await this.commandBus.send(command);

      this.logInfo('Project unarchived successfully', {
        projectId,
        unarchivedBy,
      });
    });
  }

  async getProjects(
    userId: string,
    options?: { page?: number; limit?: number; workspaceId?: string }
  ): Promise<{ projects: any[]; total: number; page: number; limit: number }> {
    return await this.executeWithMonitoring('getProjects', async () => {
      // TODO: Implement general project listing
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      
      if (options?.workspaceId) {
        const projects = await this.getProjectsByWorkspace(
          options.workspaceId,
          userId
        );
        return {
          projects: projects,
          total: projects.length,
          page,
          limit
        };
      }
      
      // Return empty for now - TODO: implement user's accessible projects
      return {
        projects: [],
        total: 0,
        page,
        limit
      };
    });
  }

  async getWorkspaceProjects(
    workspaceId: string,
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ projects: any[]; total: number; page: number; limit: number }> {
    const projects = await this.getProjectsByWorkspace(workspaceId, userId);
    return {
      projects: projects,
      total: projects.length,
      page: options?.page || 1,
      limit: options?.limit || 20
    };
  }

  async getMyProjects(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ projects: any[]; total: number; page: number; limit: number }> {
    return await this.executeWithMonitoring('getMyProjects', async () => {
      // TODO: Get projects where user is owner or member
      // userId will be used when implementing the actual logic
      void userId; // Suppress unused variable warning
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      
      return {
        projects: [],
        total: 0,
        page,
        limit
      };
    });
  }

  // Alias for getProjectStatistics with different naming
  async getProjectStats(projectId: string, userId: string): Promise<any> {
    return await this.getProjectStatistics(projectId, userId);
  }

  async addProjectMember(request: {
    projectId: string;
    userId: string;
    role: string;
    addedBy: string;
  }): Promise<void> {
    await this.addMember({
      projectId: request.projectId,
      userId: request.userId,
      role: request.role as ProjectRole,
      addedBy: request.addedBy,
    });
  }

  async removeProjectMember(
    projectId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    await this.removeMember(projectId, userId, removedBy);
  }

  async updateProjectMember(request: {
    projectId: string;
    userId: string;
    role: string;
    updatedBy: string;
  }): Promise<void> {
    await this.updateMemberRole({
      projectId: request.projectId,
      userId: request.userId,
      newRole: request.role as ProjectRole,
      updatedBy: request.updatedBy,
    });
  }

  async leaveProject(projectId: string, userId: string): Promise<void> {
    await this.removeMember(projectId, userId, userId);
  }
}
