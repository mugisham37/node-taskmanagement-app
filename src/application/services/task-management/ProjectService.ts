import { Project } from '../entities/Project';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import {
  ProjectStatus,
  ProjectStatusEnum,
} from '../value-objects/ProjectStatus';
import { Priority, PriorityEnum } from '../value-objects/Priority';
import { ProjectRepository } from '../repositories/ProjectRepository';
import {
  ProjectMemberRepository,
  ProjectMember,
  ProjectMemberRole,
} from '../repositories/ProjectMemberRepository';
import {
  WorkspacePermissionService,
  WorkspacePermission,
} from './WorkspacePermissionService';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  priority?: PriorityEnum;
  startDate?: Date;
  endDate?: Date;
  budgetAmount?: number;
  budgetCurrency?: string;
  settings?: any;
  templateId?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
  priority?: PriorityEnum;
  startDate?: Date;
  endDate?: Date;
  budgetAmount?: number;
  budgetCurrency?: string;
  settings?: any;
}

export interface ProjectAnalytics {
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
  };
  memberStats: {
    total: number;
    active: number;
    owners: number;
    admins: number;
  };
  timeStats: {
    totalEstimatedHours: number;
    totalActualHours: number;
    efficiency: number; // actual/estimated
  };
  progressStats: {
    completionPercentage: number;
    onTrack: boolean;
    daysRemaining?: number;
    estimatedCompletionDate?: Date;
  };
}

export interface ProjectDuplicationRequest {
  newName: string;
  includeMembers?: boolean;
  includeTasks?: boolean;
  includeSettings?: boolean;
  targetWorkspaceId?: WorkspaceId;
}

// Domain Events
export class ProjectMemberAddedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly memberId: UserId,
    public readonly role: ProjectMemberRole,
    public readonly addedBy: UserId
  ) {
    super('ProjectMemberAdded', {
      projectId: projectId.value,
      memberId: memberId.value,
      role,
      addedBy: addedBy.value,
    });
  }
}

export class ProjectMemberRemovedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly memberId: UserId,
    public readonly removedBy: UserId
  ) {
    super('ProjectMemberRemoved', {
      projectId: projectId.value,
      memberId: memberId.value,
      removedBy: removedBy.value,
    });
  }
}

export class ProjectMemberRoleChangedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly memberId: UserId,
    public readonly oldRole: ProjectMemberRole,
    public readonly newRole: ProjectMemberRole,
    public readonly changedBy: UserId
  ) {
    super('ProjectMemberRoleChanged', {
      projectId: projectId.value,
      memberId: memberId.value,
      oldRole,
      newRole,
      changedBy: changedBy.value,
    });
  }
}

export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly memberRepository: ProjectMemberRepository,
    private readonly permissionService: WorkspacePermissionService
  ) {}

  /**
   * Create a new project
   */
  async createProject(
    workspaceId: WorkspaceId,
    ownerId: UserId,
    request: CreateProjectRequest
  ): Promise<Project> {
    // Check permissions
    await this.permissionService.ensurePermission(
      ownerId,
      WorkspacePermission.PROJECT_CREATE,
      { workspaceId }
    );

    // Create project
    const project = Project.create({
      workspaceId,
      name: request.name,
      description: request.description,
      color: request.color || '#3B82F6',
      ownerId,
      status: ProjectStatus.planning(),
      priority: request.priority
        ? Priority.fromString(request.priority)
        : Priority.medium(),
      startDate: request.startDate,
      endDate: request.endDate,
      budgetAmount: request.budgetAmount,
      budgetCurrency: request.budgetCurrency || 'USD',
      settings: request.settings || {},
      templateId: request.templateId,
      isArchived: false,
    });

    // Save project
    await this.projectRepository.save(project);

    // Add owner as project member
    const ownerMember: ProjectMember = {
      id: this.generateId(),
      projectId: project.id,
      userId: ownerId,
      role: ProjectMemberRole.OWNER,
      addedAt: new Date(),
    };

    await this.memberRepository.addMember(ownerMember);

    return project;
  }

  /**
   * Update project details
   */
  async updateProject(
    projectId: ProjectId,
    userId: UserId,
    request: UpdateProjectRequest
  ): Promise<Project> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_UPDATE
    );

    // Update project
    if (request.name) {
      project.updateName(request.name);
    }

    if (request.description !== undefined) {
      project.updateDescription(request.description);
    }

    if (request.color) {
      project.updateColor(request.color);
    }

    if (request.priority) {
      project.updatePriority(Priority.fromString(request.priority));
    }

    if (request.startDate !== undefined || request.endDate !== undefined) {
      project.updateTimeline(request.startDate, request.endDate);
    }

    if (request.budgetAmount !== undefined || request.budgetCurrency) {
      project.updateBudget(request.budgetAmount, request.budgetCurrency);
    }

    if (request.settings) {
      project.updateSettings(request.settings);
    }

    await this.projectRepository.save(project);
    return project;
  }

  /**
   * Get project by ID with access control
   */
  async getProjectById(projectId: ProjectId): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.isDeleted()) {
      throw new Error('Project has been deleted');
    }

    return project;
  }

  /**
   * Get projects by workspace
   */
  async getProjectsByWorkspace(
    workspaceId: WorkspaceId,
    userId: UserId,
    options: {
      includeArchived?: boolean;
      status?: ProjectStatusEnum;
      ownedOnly?: boolean;
    } = {}
  ): Promise<Project[]> {
    // Check workspace access
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.PROJECT_VIEW,
      { workspaceId }
    );

    let projects: Project[];

    if (options.ownedOnly) {
      projects = await this.projectRepository.findByOwner(userId);
      // Filter by workspace
      projects = projects.filter(p => p.workspaceId.equals(workspaceId));
    } else if (options.status) {
      projects = await this.projectRepository.findByStatus(
        workspaceId,
        ProjectStatus.fromString(options.status)
      );
    } else {
      projects = await this.projectRepository.findByWorkspace(workspaceId);
    }

    // Filter out archived projects unless explicitly requested
    if (!options.includeArchived) {
      projects = projects.filter(p => !p.isArchived);
    }

    // Filter projects user has access to
    const accessibleProjects: Project[] = [];
    for (const project of projects) {
      if (await this.canUserAccessProject(project, userId)) {
        accessibleProjects.push(project);
      }
    }

    return accessibleProjects;
  }

  /**
   * Change project status
   */
  async changeProjectStatus(
    projectId: ProjectId,
    userId: UserId,
    newStatus: ProjectStatusEnum
  ): Promise<Project> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_UPDATE
    );

    // Change status
    project.changeStatus(ProjectStatus.fromString(newStatus), userId);

    await this.projectRepository.save(project);
    return project;
  }

  /**
   * Archive project
   */
  async archiveProject(
    projectId: ProjectId,
    userId: UserId,
    reason?: string
  ): Promise<void> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_ARCHIVE
    );

    // Archive project
    project.archive(userId, reason);

    await this.projectRepository.save(project);
  }

  /**
   * Unarchive project
   */
  async unarchiveProject(projectId: ProjectId, userId: UserId): Promise<void> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_UPDATE
    );

    // Unarchive project
    project.unarchive();

    await this.projectRepository.save(project);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: ProjectId, userId: UserId): Promise<void> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_DELETE
    );

    // Delete project
    project.delete(userId);

    await this.projectRepository.save(project);
  }

  /**
   * Add member to project
   */
  async addMember(
    projectId: ProjectId,
    memberId: UserId,
    role: ProjectMemberRole,
    addedBy: UserId
  ): Promise<void> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      addedBy,
      WorkspacePermission.PROJECT_MANAGE_MEMBERS
    );

    // Check if user is already a member
    const existingMember = await this.memberRepository.findMember(
      projectId,
      memberId
    );
    if (existingMember) {
      throw new Error('User is already a member of this project');
    }

    // Add member
    const member: ProjectMember = {
      id: this.generateId(),
      projectId,
      userId: memberId,
      role,
      addedBy,
      addedAt: new Date(),
    };

    await this.memberRepository.addMember(member);

    // Emit domain event
    console.log(
      new ProjectMemberAddedEvent(projectId, memberId, role, addedBy)
    );
  }

  /**
   * Remove member from project
   */
  async removeMember(
    projectId: ProjectId,
    memberId: UserId,
    removedBy: UserId
  ): Promise<void> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      removedBy,
      WorkspacePermission.PROJECT_MANAGE_MEMBERS
    );

    // Cannot remove project owner
    if (project.isOwner(memberId)) {
      throw new Error('Cannot remove project owner');
    }

    // Remove member
    await this.memberRepository.removeMember(projectId, memberId);

    // Emit domain event
    console.log(new ProjectMemberRemovedEvent(projectId, memberId, removedBy));
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    projectId: ProjectId,
    memberId: UserId,
    newRole: ProjectMemberRole,
    updatedBy: UserId
  ): Promise<void> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      updatedBy,
      WorkspacePermission.PROJECT_MANAGE_MEMBERS
    );

    // Cannot change owner role
    if (project.isOwner(memberId)) {
      throw new Error('Cannot change project owner role');
    }

    // Get current role
    const currentRole = await this.memberRepository.getUserRole(
      projectId,
      memberId
    );
    if (!currentRole) {
      throw new Error('User is not a member of this project');
    }

    // Update role
    await this.memberRepository.updateMemberRole(projectId, memberId, newRole);

    // Emit domain event
    console.log(
      new ProjectMemberRoleChangedEvent(
        projectId,
        memberId,
        currentRole,
        newRole,
        updatedBy
      )
    );
  }

  /**
   * Get project members
   */
  async getProjectMembers(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMember[]> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_VIEW
    );

    return await this.memberRepository.findMembersByProject(projectId);
  }

  /**
   * Duplicate project
   */
  async duplicateProject(
    projectId: ProjectId,
    userId: UserId,
    request: ProjectDuplicationRequest
  ): Promise<Project> {
    const originalProject = await this.getProjectById(projectId);

    // Check permissions on original project
    await this.ensureProjectPermission(
      originalProject,
      userId,
      WorkspacePermission.PROJECT_VIEW
    );

    const targetWorkspaceId =
      request.targetWorkspaceId || originalProject.workspaceId;

    // Check permissions on target workspace
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.PROJECT_CREATE,
      { workspaceId: targetWorkspaceId }
    );

    // Create new project
    const newProject = Project.create({
      workspaceId: targetWorkspaceId,
      name: request.newName,
      description: originalProject.description,
      color: originalProject.color,
      ownerId: userId,
      status: ProjectStatus.planning(),
      priority: originalProject.priority,
      startDate: originalProject.startDate,
      endDate: originalProject.endDate,
      budgetAmount: originalProject.budgetAmount,
      budgetCurrency: originalProject.budgetCurrency,
      settings: request.includeSettings ? originalProject.settings : {},
      isArchived: false,
    });

    await this.projectRepository.save(newProject);

    // Add owner as member
    const ownerMember: ProjectMember = {
      id: this.generateId(),
      projectId: newProject.id,
      userId,
      role: ProjectMemberRole.OWNER,
      addedAt: new Date(),
    };

    await this.memberRepository.addMember(ownerMember);

    // Copy members if requested
    if (request.includeMembers) {
      const originalMembers =
        await this.memberRepository.findMembersByProject(projectId);

      for (const member of originalMembers) {
        // Skip owner (already added) and only copy if user has permission
        if (!member.userId.equals(userId)) {
          try {
            const newMember: ProjectMember = {
              id: this.generateId(),
              projectId: newProject.id,
              userId: member.userId,
              role:
                member.role === ProjectMemberRole.OWNER
                  ? ProjectMemberRole.ADMIN
                  : member.role,
              addedBy: userId,
              addedAt: new Date(),
            };

            await this.memberRepository.addMember(newMember);
          } catch (error) {
            // Skip members that can't be added
            console.warn(
              `Could not add member ${member.userId.value} to duplicated project:`,
              error
            );
          }
        }
      }
    }

    // TODO: Copy tasks if requested (would need TaskService integration)

    return newProject;
  }

  /**
   * Get project analytics
   */
  async getProjectAnalytics(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectAnalytics> {
    const project = await this.getProjectById(projectId);

    // Check permissions
    await this.ensureProjectPermission(
      project,
      userId,
      WorkspacePermission.PROJECT_VIEW
    );

    // Get project statistics
    const stats = await this.projectRepository.getProjectStats(projectId);
    const members = await this.memberRepository.findMembersByProject(projectId);

    // Calculate analytics
    const taskStats = {
      total: stats.taskCount,
      completed: stats.completedTaskCount,
      inProgress: 0, // Would be calculated from actual task data
      todo: stats.taskCount - stats.completedTaskCount,
      overdue: 0, // Would be calculated from actual task data
    };

    const memberStats = {
      total: members.length,
      active: members.length, // Simplified
      owners: members.filter(m => m.role === ProjectMemberRole.OWNER).length,
      admins: members.filter(m => m.role === ProjectMemberRole.ADMIN).length,
    };

    const timeStats = {
      totalEstimatedHours: stats.totalEstimatedHours,
      totalActualHours: stats.totalActualHours,
      efficiency:
        stats.totalEstimatedHours > 0
          ? stats.totalActualHours / stats.totalEstimatedHours
          : 0,
    };

    const completionPercentage =
      stats.taskCount > 0
        ? (stats.completedTaskCount / stats.taskCount) * 100
        : 0;

    const progressStats = {
      completionPercentage,
      onTrack: completionPercentage >= project.getProgress(),
      daysRemaining: project.endDate
        ? Math.ceil(
            (project.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : undefined,
      estimatedCompletionDate: project.endDate,
    };

    return {
      taskStats,
      memberStats,
      timeStats,
      progressStats,
    };
  }

  /**
   * Search projects
   */
  async searchProjects(
    workspaceId: WorkspaceId,
    userId: UserId,
    query: string
  ): Promise<Project[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.PROJECT_VIEW,
      { workspaceId }
    );

    const projects = await this.projectRepository.search(workspaceId, query);

    // Filter projects user has access to
    const accessibleProjects: Project[] = [];
    for (const project of projects) {
      if (await this.canUserAccessProject(project, userId)) {
        accessibleProjects.push(project);
      }
    }

    return accessibleProjects;
  }

  /**
   * Get projects with upcoming deadlines
   */
  async getProjectsWithUpcomingDeadlines(
    workspaceId: WorkspaceId,
    userId: UserId,
    days: number = 7
  ): Promise<Project[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.PROJECT_VIEW,
      { workspaceId }
    );

    const projects = await this.projectRepository.findWithUpcomingDeadlines(
      workspaceId,
      days
    );

    // Filter projects user has access to
    const accessibleProjects: Project[] = [];
    for (const project of projects) {
      if (await this.canUserAccessProject(project, userId)) {
        accessibleProjects.push(project);
      }
    }

    return accessibleProjects;
  }

  /**
   * Get overdue projects
   */
  async getOverdueProjects(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<Project[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.PROJECT_VIEW,
      { workspaceId }
    );

    const projects = await this.projectRepository.findOverdue(workspaceId);

    // Filter projects user has access to
    const accessibleProjects: Project[] = [];
    for (const project of projects) {
      if (await this.canUserAccessProject(project, userId)) {
        accessibleProjects.push(project);
      }
    }

    return accessibleProjects;
  }

  /**
   * Check if user can access project
   */
  private async canUserAccessProject(
    project: Project,
    userId: UserId
  ): Promise<boolean> {
    // Project owner always has access
    if (project.isOwner(userId)) {
      return true;
    }

    // Check if user is a project member
    const isMember = await this.memberRepository.isMember(project.id, userId);
    if (isMember) {
      return true;
    }

    // Check workspace-level permissions
    const hasWorkspaceAccess = await this.permissionService.checkPermission(
      userId,
      WorkspacePermission.PROJECT_VIEW,
      { workspaceId: project.workspaceId }
    );

    return hasWorkspaceAccess.granted;
  }

  /**
   * Ensure user has project permission
   */
  private async ensureProjectPermission(
    project: Project,
    userId: UserId,
    permission: WorkspacePermission
  ): Promise<void> {
    // Check workspace-level permission first
    const workspaceResult = await this.permissionService.checkPermission(
      userId,
      permission,
      {
        workspaceId: project.workspaceId,
        projectId: project.id,
        resourceOwnerId: project.ownerId,
      }
    );

    if (!workspaceResult.granted) {
      throw new Error(
        workspaceResult.reason ||
          `Access denied: ${permission} permission required`
      );
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
// TODO: This is a temporary instance export for compatibility during migration
// In the final architecture, services should be properly injected via DI container
import { PrismaProjectRepository } from '../repositories/project.repository.impl';
import { ProjectMemberRepository } from '../repositories/ProjectMemberRepository';

// Create temporary instances (this should be replaced with proper DI)
const projectRepository = new PrismaProjectRepository();
const memberRepository = new ProjectMemberRepository();
const permissionService = new WorkspacePermissionService();

export const projectService = new ProjectService(
  projectRepository,
  memberRepository,
  permissionService
);
