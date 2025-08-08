import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { 
  workspaceRepository, 
  userRepository, 
  teamRepository,
  projectRepository,
  taskRepository,
  activityRepository
} from '../db/repositories';
import { Workspace, NewWorkspace } from '../db/schema/workspaces';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import { activityService } from './activity.service';

export interface WorkspaceFilters {
  ownerId?: string;
  teamId?: string;
  isPersonal?: boolean;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface WorkspaceCreateData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isPersonal?: boolean;
  teamId?: string;
  settings?: Record<string, any>;
}

export interface WorkspaceUpdateData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  settings?: Record<string, any>;
}

export interface WorkspaceStats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  recentActivity: number;
  memberCount: number;
}

export class WorkspaceService extends BaseService {
  constructor() {
    super('WorkspaceService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache for workspaces
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createWorkspace(data: WorkspaceCreateData, context?: ServiceContext): Promise<Workspace> {
    const ctx = this.createContext(context);
    this.logOperation('createWorkspace', ctx, { 
      name: data.name, 
      isPersonal: data.isPersonal,
      teamId: data.teamId
    });

    try {
      // Validate input
      this.validateWorkspaceData(data);

      // If team is provided, check if user is a member of the team
      if (data.teamId) {
        await this.verifyTeamAccess(data.teamId, ctx.userId!);
      }

      // Create workspace
      const newWorkspace: NewWorkspace = {
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color || '#4f46e5',
        isPersonal: data.isPersonal || false,
        ownerId: ctx.userId!,
        teamId: data.teamId,
        settings: data.settings || {}
      };

      const workspace = await workspaceRepository.create(newWorkspace);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'workspace_created',
        workspaceId: workspace.id,
        teamId: data.teamId || undefined,
        data: {
          workspaceName: workspace.name,
          isPersonal: workspace.isPersonal,
          action: 'workspace_created'
        },
        metadata: {
          workspaceId: workspace.id
        }
      }, ctx);

      await this.recordMetric('workspace.created', 1, { 
        isPersonal: workspace.isPersonal ? 'true' : 'false',
        hasTeam: workspace.teamId ? 'true' : 'false'
      });

      return workspace;
    } catch (error) {
      this.handleError(error, 'createWorkspace', ctx);
    }
  }

  async getWorkspaceById(workspaceId: string, context?: ServiceContext): Promise<Workspace> {
    const ctx = this.createContext(context);
    this.logOperation('getWorkspaceById', ctx, { workspaceId });

    try {
      const workspace = await workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      // Check access permissions
      await this.verifyWorkspaceAccess(workspace, ctx.userId!);

      return workspace;
    } catch (error) {
      this.handleError(error, 'getWorkspaceById', ctx);
    }
  }

  async getWorkspaces(
    filters: WorkspaceFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Workspace>> {
    const ctx = this.createContext(context);
    this.logOperation('getWorkspaces', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildWorkspaceWhereConditions(filters, ctx.userId!);
      
      const result = await workspaceRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getWorkspaces', ctx);
    }
  }

  async updateWorkspace(workspaceId: string, data: WorkspaceUpdateData, context?: ServiceContext): Promise<Workspace> {
    const ctx = this.createContext(context);
    this.logOperation('updateWorkspace', ctx, { workspaceId, updates: Object.keys(data) });

    try {
      const existingWorkspace = await workspaceRepository.findById(workspaceId);
      if (!existingWorkspace) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      // Check permissions
      await this.verifyWorkspaceAccess(existingWorkspace, ctx.userId!);

      // Validate updates
      this.validateWorkspaceUpdateData(data);

      const updatedWorkspace = await workspaceRepository.update(workspaceId, {
        ...data,
        updatedAt: new Date()
      });

      if (!updatedWorkspace) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'workspace_updated',
        workspaceId: workspaceId,
        teamId: updatedWorkspace.teamId || undefined,
        data: {
          workspaceName: updatedWorkspace.name,
          updates: Object.keys(data),
          action: 'workspace_updated'
        },
        metadata: {
          workspaceId: workspaceId
        }
      }, ctx);

      await this.recordMetric('workspace.updated', 1);

      return updatedWorkspace;
    } catch (error) {
      this.handleError(error, 'updateWorkspace', ctx);
    }
  }

  async deleteWorkspace(workspaceId: string, context?: ServiceContext): Promise<{ message: string }> {
    const ctx = this.createContext(context);
    this.logOperation('deleteWorkspace', ctx, { workspaceId });

    try {
      const workspace = await workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      // Check permissions - only owner can delete
      if (workspace.ownerId !== ctx.userId) {
        throw new ForbiddenError('Only the workspace owner can delete this workspace');
      }

      // Get workspace info for activity log
      const workspaceName = workspace.name;
      const teamId = workspace.teamId;

      // Delete workspace (cascade will handle projects and tasks)
      const success = await workspaceRepository.delete(workspaceId);
      if (!success) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'workspace_deleted',
        teamId: teamId || undefined,
        data: {
          workspaceName,
          workspaceId,
          action: 'workspace_deleted'
        }
      }, ctx);

      await this.recordMetric('workspace.deleted', 1);

      return {
        message: 'Workspace deleted successfully'
      };
    } catch (error) {
      this.handleError(error, 'deleteWorkspace', ctx);
    }
  }

  // Workspace Projects
  async getWorkspaceProjects(
    workspaceId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<any>> {
    const ctx = this.createContext(context);
    this.logOperation('getWorkspaceProjects', ctx, { workspaceId, options });

    try {
      // Check if user has access to the workspace
      const workspace = await this.getWorkspaceById(workspaceId, ctx);

      const paginationOptions = this.validatePagination(options);
      
      // For now, return empty result since projects don't have workspaceId
      // This would need to be implemented based on your project-workspace relationship
      return {
        data: [],
        pagination: {
          page: paginationOptions.page,
          limit: paginationOptions.limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      this.handleError(error, 'getWorkspaceProjects', ctx);
    }
  }

  async getWorkspaceTasks(
    workspaceId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<any>> {
    const ctx = this.createContext(context);
    this.logOperation('getWorkspaceTasks', ctx, { workspaceId, options });

    try {
      // Check if user has access to the workspace
      const workspace = await this.getWorkspaceById(workspaceId, ctx);

      const paginationOptions = this.validatePagination(options);
      
      // For now, return empty result since projects don't have workspaceId
      // This would need to be implemented based on your project-workspace relationship
      return {
        data: [],
        pagination: {
          page: paginationOptions.page,
          limit: paginationOptions.limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      this.handleError(error, 'getWorkspaceTasks', ctx);
    }
  }

  // Personal Workspace
  async createPersonalWorkspace(context?: ServiceContext): Promise<Workspace> {
    const ctx = this.createContext(context);
    this.logOperation('createPersonalWorkspace', ctx);

    try {
      // Check if user already has a personal workspace
      const existingWorkspaces = await workspaceRepository.findMany({
        where: and(
          eq(workspaceRepository['table']?.ownerId, ctx.userId!),
          eq(workspaceRepository['table']?.isPersonal, true)
        ),
        limit: 1
      });

      if (existingWorkspaces.data.length > 0) {
        return existingWorkspaces.data[0];
      }

      // Create personal workspace
      const workspaceData: WorkspaceCreateData = {
        name: 'Personal Workspace',
        description: 'Your personal workspace for tasks and projects',
        icon: 'user',
        color: '#4f46e5',
        isPersonal: true
      };

      const workspace = await this.createWorkspace(workspaceData, ctx);

      await this.recordMetric('workspace.personal.created', 1);

      return workspace;
    } catch (error) {
      this.handleError(error, 'createPersonalWorkspace', ctx);
    }
  }

  async getPersonalWorkspace(context?: ServiceContext): Promise<Workspace> {
    const ctx = this.createContext(context);
    this.logOperation('getPersonalWorkspace', ctx);

    try {
      const existingWorkspaces = await workspaceRepository.findMany({
        where: and(
          eq(workspaceRepository['table']?.ownerId, ctx.userId!),
          eq(workspaceRepository['table']?.isPersonal, true)
        ),
        limit: 1
      });

      if (existingWorkspaces.data.length === 0) {
        // Create personal workspace if it doesn't exist
        return await this.createPersonalWorkspace(ctx);
      }

      return existingWorkspaces.data[0];
    } catch (error) {
      this.handleError(error, 'getPersonalWorkspace', ctx);
    }
  }

  // Statistics
  async getWorkspaceStats(workspaceId: string, context?: ServiceContext): Promise<WorkspaceStats> {
    const ctx = this.createContext(context);
    this.logOperation('getWorkspaceStats', ctx, { workspaceId });

    try {
      // Check if user has access to the workspace
      const workspace = await this.getWorkspaceById(workspaceId, ctx);

      // Note: Projects table doesn't have workspaceId column yet
      // For now, return empty projects array until the relationship is implemented
      const projects = { data: [] as any[] };

      const projectIds: string[] = [];

      // Get tasks in workspace projects
      let totalTasks = 0;
      let completedTasks = 0;

      if (projectIds.length > 0) {
        const tasks = await taskRepository.findMany({
          where: inArray(taskRepository['table']?.projectId, projectIds),
          limit: 10000
        });

        totalTasks = tasks.data.length;
        completedTasks = tasks.data.filter(task => task.status === 'completed').length;
      }

      // Get recent activity count (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentActivities = await activityRepository.findMany({
        where: and(
          eq(activityRepository['table']?.workspaceId, workspaceId),
          gte(activityRepository['table']?.createdAt, sevenDaysAgo)
        )
      });

      // Calculate member count
      let memberCount = 1; // Owner
      if (workspace.teamId) {
        const teamMembers = await teamRepository.getTeamMembers(workspace.teamId);
        memberCount = teamMembers.data.length;
      }

      const stats: WorkspaceStats = {
        totalProjects: projects.data.length,
        totalTasks,
        completedTasks,
        recentActivity: recentActivities.data.length,
        memberCount
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getWorkspaceStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyWorkspaceAccess(workspace: Workspace, userId: string): Promise<void> {
    // User can access workspace if they are:
    // 1. The owner
    // 2. Member of the team (if workspace belongs to a team)
    // 3. Admin
    
    if (workspace.ownerId === userId) {
      return;
    }

    if (workspace.teamId) {
      const isMember = await teamRepository.isMember(workspace.teamId, userId);
      if (isMember) {
        return;
      }
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this workspace');
  }

  private async verifyTeamAccess(teamId: string, userId: string): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    const isMember = await teamRepository.isMember(teamId, userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this team');
    }

    // Check if user has admin or owner role in the team
    const userRole = await teamRepository.getMemberRole(teamId, userId);
    if (!['admin', 'owner'].includes(userRole || '')) {
      throw new ForbiddenError('Only team administrators and owners can create team workspaces');
    }
  }

  private buildWorkspaceWhereConditions(filters: WorkspaceFilters, userId: string): any {
    const conditions = [];

    // User can see workspaces they own or are team members of
    const userConditions = [eq(workspaceRepository['table']?.ownerId, userId)];

    // Add team-based access (would need to implement team membership check)
    // For now, just check ownership
    conditions.push(or(...userConditions));

    if (filters.ownerId) {
      conditions.push(eq(workspaceRepository['table']?.ownerId, filters.ownerId));
    }

    if (filters.teamId) {
      conditions.push(eq(workspaceRepository['table']?.teamId, filters.teamId));
    }

    if (filters.isPersonal !== undefined) {
      conditions.push(eq(workspaceRepository['table']?.isPersonal, filters.isPersonal));
    }

    if (filters.search) {
      conditions.push(or(
        ilike(workspaceRepository['table']?.name, `%${filters.search}%`),
        ilike(workspaceRepository['table']?.description, `%${filters.search}%`)
      ));
    }

    if (filters.createdFrom) {
      conditions.push(gte(workspaceRepository['table']?.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(workspaceRepository['table']?.createdAt, filters.createdTo));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateWorkspaceData(data: WorkspaceCreateData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Workspace name is required');
    }

    if (data.name.length > 100) {
      throw new ValidationError('Workspace name must be less than 100 characters');
    }

    if (data.description && data.description.length > 500) {
      throw new ValidationError('Workspace description must be less than 500 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Workspace color must be a valid hex color code');
    }
  }

  private validateWorkspaceUpdateData(data: WorkspaceUpdateData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Workspace name is required');
      }
      if (data.name.length > 100) {
        throw new ValidationError('Workspace name must be less than 100 characters');
      }
    }

    if (data.description !== undefined && data.description && data.description.length > 500) {
      throw new ValidationError('Workspace description must be less than 500 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Workspace color must be a valid hex color code');
    }
  }
}

// Export singleton instance
export const workspaceService = new WorkspaceService();
