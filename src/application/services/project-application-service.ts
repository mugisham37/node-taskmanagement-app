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
import { ProjectRole, ProjectRoleVO } from '../../domain/value-objects/project-role';
import { ProjectStatus } from '../../shared/constants/project-constants';
import { injectable } from '../../shared/decorators/injectable.decorator';
import { nanoid } from 'nanoid';

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
    private readonly emailService: EmailService
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

      // Verify workspace exists and user has permission
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const owner = await this.userRepository.findById(ownerId);
      if (!owner) {
        throw new Error('Owner not found');
      }

      // Check if user can create projects in this workspace
      const canCreateProject = await this.canUserCreateProject(
        ownerId,
        workspaceId
      );
      if (!canCreateProject) {
        throw new Error(
          'Insufficient permissions to create project in this workspace'
        );
      }

      // Create project
      const projectId = ProjectId.create(nanoid());
      const project = Project.create(
        projectId,
        request.name,
        request.description || '',
        workspaceId,
        ownerId,
        request.startDate,
        request.endDate
      );

      await this.projectRepository.save(project);

      // Add owner as project admin
      const ownerRole = ProjectRoleVO.create(ProjectRole.MANAGER);
      project.addMember(ownerId, ownerRole);
      await this.projectRepository.save(project);

      // Clear cache
      await this.clearProjectCaches(project.id, workspaceId);

      this.logInfo('Project created successfully', {
        projectId: project.id.value,
        name: request.name,
        workspaceId: request.workspaceId,
        ownerId: request.ownerId,
      });

      return project.id;
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

      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check permissions
      const canUpdate = await this.canUserUpdateProject(updatedBy, projectId);
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update project');
      }

      // Update project fields
      if (request.name !== undefined) {
        project.updateName(request.name);
      }
      if (request.description !== undefined) {
        project.updateDescription(request.description);
      }
      if (request.status !== undefined) {
        // Use specific methods based on status
        switch (request.status) {
          case 'COMPLETED':
            project.complete();
            break;
          case 'CANCELLED':
            project.cancel();
            break;
          case 'ARCHIVED':
            project.archive();
            break;
          case 'ON_HOLD':
            project.putOnHold();
            break;
          case 'ACTIVE':
            project.activate();
            break;
          default:
            throw new Error(`Invalid project status: ${request.status}`);
        }
      }
      if (request.startDate !== undefined) {
        project.updateStartDate(request.startDate);
      }
      if (request.endDate !== undefined) {
        project.updateEndDate(request.endDate);
      }
      if (request.budget !== undefined) {
        // Budget is not currently supported in the Project entity
        // Would need to add budget property and updateBudget method
        this.logInfo('Budget update requested but not implemented', { 
          projectId: project.id.value, 
          budget: request.budget 
        });
      }
      if (request.tags !== undefined) {
        // Tags are not currently supported in the Project entity
        // Would need to add tags property and updateTags method
        this.logInfo('Tags update requested but not implemented', { 
          projectId: project.id.value, 
          tags: request.tags 
        });
      }

      await this.projectRepository.save(project);

      // Clear cache
      await this.clearProjectCaches(projectId, project.workspaceId);

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
      const userId = new UserId(request.userId);
      const addedBy = new UserId(request.addedBy);

      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check permissions
      const canAddMember = await this.canUserManageMembers(addedBy, projectId);
      if (!canAddMember) {
        throw new Error('Insufficient permissions to add members');
      }

      // Check if user is already a member
      const existingMember = await this.projectRepository.findMember(
        projectId,
        userId
      );
      if (existingMember) {
        throw new Error('User is already a member of this project');
      }

      // Add member using Project entity method
      const roleVO = ProjectRoleVO.create(request.role as ProjectRole);
      project.addMember(userId, roleVO);
      
      await this.projectRepository.save(project);

      // Send notification email
      await this.emailService.sendProjectMemberWelcome(
        user.email.value,
        `${user.firstName} ${user.lastName}`,
        project.name,
        project.description || '',
        'Project Manager', // Would get from addedBy user
        request.role
      );

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
      const userIdVO = new UserId(userId);
      const removedByVO = new UserId(removedBy);

      const project = await this.projectRepository.findById(projectIdVO);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check permissions
      const canRemoveMember = await this.canUserManageMembers(
        removedByVO,
        projectIdVO
      );
      if (!canRemoveMember) {
        throw new Error('Insufficient permissions to remove members');
      }

      // Cannot remove project owner
      if (project.managerId.equals(userIdVO)) {
        throw new Error('Cannot remove project owner');
      }

      const member = await this.projectRepository.findMember(
        projectIdVO,
        userIdVO
      );
      if (!member) {
        throw new Error('User is not a member of this project');
      }

      // Remove member using Project entity method
      project.removeMember(userIdVO);
      await this.projectRepository.save(project);

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
      const userId = new UserId(request.userId);
      const updatedBy = new UserId(request.updatedBy);

      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check permissions
      const canUpdateRole = await this.canUserManageMembers(
        updatedBy,
        projectId
      );
      if (!canUpdateRole) {
        throw new Error('Insufficient permissions to update member roles');
      }

      // Cannot change owner role
      if (project.managerId.equals(userId)) {
        throw new Error('Cannot change project owner role');
      }

      const member = await this.projectRepository.findMember(projectId, userId);
      if (!member) {
        throw new Error('User is not a member of this project');
      }

      // Update member role using Project entity method
      const newRoleVO = ProjectRoleVO.create(request.newRole as ProjectRole);
      project.updateMemberRole(userId, newRoleVO, updatedBy);
      await this.projectRepository.save(project);

      // Clear member cache
      await this.clearMemberCaches(projectId);

      this.logInfo('Member role updated', {
        projectId: request.projectId,
        userId: request.userId,
        newRole: request.newRole,
        updatedBy: request.updatedBy,
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
    _userId: UserId,
    _workspaceId: WorkspaceId
  ): Promise<boolean> {
    // Implementation would check workspace permissions
    // For now, assume all workspace members can create projects
    return true;
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
    _userId: UserId,
    _workspaceId: WorkspaceId
  ): Promise<boolean> {
    // Implementation would check workspace membership
    return true;
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
}
