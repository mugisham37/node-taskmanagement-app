import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { projectRepository, userRepository, taskRepository, notificationRepository } from '../db/repositories';
import { Project, NewProject } from '../db/schema/projects';
import { tasks as tasksSchema } from '../db/schema/tasks';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';

export interface ProjectFilters {
  ownerId?: string;
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  isArchived?: boolean;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface ProjectCreateData {
  name: string;
  description?: string;
  color?: string;
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  isArchived?: boolean;
}

export interface ProjectUpdateData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  isArchived?: boolean;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number;
}

export class ProjectService extends BaseService {
  constructor() {
    super('ProjectService', {
      enableCache: true,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createProject(data: ProjectCreateData, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('createProject', ctx, { name: data.name });

    try {
      // Validate input
      this.validateProjectData(data);

      // Check if project name already exists for this user
      const existingProject = await this.findProjectByName(data.name, ctx.userId!);
      if (existingProject) {
        throw new ValidationError(`Project with name "${data.name}" already exists`);
      }

      // Create project
      const newProject: NewProject = {
        ...data,
        ownerId: ctx.userId!,
        isArchived: data.isArchived || false
      };

      const project = await projectRepository.create(newProject);

      await this.recordMetric('project.created', 1, { 
        hasDescription: project.description ? 'true' : 'false'
      });

      return project;
    } catch (error) {
      this.handleError(error, 'createProject', ctx);
    }
  }

  async getProjectById(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectById', ctx, { projectId: id });

    try {
      const project = await projectRepository.findById(id);
      if (!project) {
        throw new NotFoundError('Project', id);
      }

      // Check access permissions
      await this.verifyProjectAccess(project, ctx.userId!);

      return project;
    } catch (error) {
      this.handleError(error, 'getProjectById', ctx);
    }
  }

  async getProjects(
    filters: ProjectFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Project>> {
    const ctx = this.createContext(context);
    this.logOperation('getProjects', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions - user can only see their own projects
      const whereConditions = this.buildProjectWhereConditions(filters, ctx.userId!);
      
      const result = await projectRepository.findMany({
        ...paginationOptions,
        where: whereConditions
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getProjects', ctx);
    }
  }

  async updateProject(id: string, data: ProjectUpdateData, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('updateProject', ctx, { projectId: id, updates: Object.keys(data) });

    try {
      const existingProject = await projectRepository.findById(id);
      if (!existingProject) {
        throw new NotFoundError('Project', id);
      }

      // Check permissions
      await this.verifyProjectAccess(existingProject, ctx.userId!);

      // Validate updates
      this.validateProjectUpdateData(data);

      // Check if name is being updated and if it already exists
      if (data.name && data.name !== existingProject.name) {
        const existingProjectWithName = await this.findProjectByName(data.name, ctx.userId!);
        if (existingProjectWithName && existingProjectWithName.id !== id) {
          throw new ValidationError(`Project with name "${data.name}" already exists`);
        }
      }

      const updatedProject = await projectRepository.update(id, {
        ...data,
        updatedAt: new Date()
      });

      if (!updatedProject) {
        throw new NotFoundError('Project', id);
      }

      await this.recordMetric('project.updated', 1, { 
        nameChanged: data.name !== undefined ? 'true' : 'false',
        archived: data.isArchived !== undefined ? 'true' : 'false'
      });

      return updatedProject;
    } catch (error) {
      this.handleError(error, 'updateProject', ctx);
    }
  }

  async deleteProject(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteProject', ctx, { projectId: id });

    try {
      const project = await projectRepository.findById(id);
      if (!project) {
        throw new NotFoundError('Project', id);
      }

      // Check permissions - only owner can delete
      if (project.ownerId !== ctx.userId) {
        throw new ForbiddenError('Only the project owner can delete this project');
      }

      // Check if project has tasks
      const projectTasks = await taskRepository.findMany({
        where: eq(tasksSchema.projectId, id),
        limit: 1
      });

      if (projectTasks.data.length > 0) {
        throw new ValidationError('Cannot delete project that contains tasks. Please move or delete all tasks first.');
      }

      const success = await projectRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Project', id);
      }

      await this.recordMetric('project.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteProject', ctx);
    }
  }

  // Project Statistics
  async getProjectStats(id: string, context?: ServiceContext): Promise<ProjectStats> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectStats', ctx, { projectId: id });

    try {
      const project = await projectRepository.findById(id);
      if (!project) {
        throw new NotFoundError('Project', id);
      }

      // Check access permissions
      await this.verifyProjectAccess(project, ctx.userId!);

      // Get all tasks for this project
      const allTasks = await taskRepository.findMany({
        where: eq(tasksSchema.projectId, id),
        limit: 10000 // Large limit to get all tasks
      });

      const tasks = allTasks.data;
      const now = new Date();

      const stats: ProjectStats = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
        todoTasks: tasks.filter(t => t.status === 'todo').length,
        overdueTasks: tasks.filter(t => 
          t.dueDate && 
          new Date(t.dueDate) < now && 
          t.status !== 'completed'
        ).length,
        completionRate: tasks.length > 0 ? 
          (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getProjectStats', ctx);
    }
  }

  // Get Project Tasks
  async getProjectTasks(
    id: string, 
    filters: any = {}, 
    context?: ServiceContext
  ): Promise<any> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectTasks', ctx, { projectId: id, filters });

    try {
      const project = await projectRepository.findById(id);
      if (!project) {
        throw new NotFoundError('Project', id);
      }

      // Check access permissions
      await this.verifyProjectAccess(project, ctx.userId!);

      // Build pagination options
      const paginationOptions = this.validatePagination({
        page: filters.page ? parseInt(filters.page) : 1,
        limit: filters.limit ? parseInt(filters.limit) : 10
      });

      // Build where conditions for tasks
      const whereConditions = [];
      
      // Add project filter
      whereConditions.push(eq(tasksSchema.projectId, id));

      // Add additional filters
      if (filters.status) {
        whereConditions.push(eq(tasksSchema.status, filters.status));
      }
      if (filters.priority) {
        whereConditions.push(eq(tasksSchema.priority, filters.priority));
      }
      if (filters.assignedTo) {
        whereConditions.push(eq(tasksSchema.assigneeId, filters.assignedTo));
      }
      if (filters.search) {
        const searchCondition = or(
          ilike(tasksSchema.title, `%${filters.search}%`),
          ilike(tasksSchema.description, `%${filters.search}%`)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      const result = await taskRepository.findMany({
        ...paginationOptions,
        where: whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0],
        orderBy: [desc(tasksSchema.createdAt)]
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getProjectTasks', ctx);
    }
  }

  // Archive/Unarchive
  async archiveProject(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('archiveProject', ctx, { projectId: id });

    try {
      const updatedProject = await this.updateProject(id, { isArchived: true }, ctx);
      
      await this.recordMetric('project.archived', 1);
      
      return updatedProject;
    } catch (error) {
      this.handleError(error, 'archiveProject', ctx);
    }
  }

  async unarchiveProject(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('unarchiveProject', ctx, { projectId: id });

    try {
      const updatedProject = await this.updateProject(id, { isArchived: false }, ctx);
      
      await this.recordMetric('project.unarchived', 1);
      
      return updatedProject;
    } catch (error) {
      this.handleError(error, 'unarchiveProject', ctx);
    }
  }

  // Private Helper Methods
  private async verifyProjectAccess(project: Project, userId: string): Promise<void> {
    // User can access project if they are:
    // 1. The owner
    // 2. Admin (would need to check user role)
    
    if (project.ownerId === userId) {
      return;
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this project');
  }

  private async findProjectByName(name: string, userId: string): Promise<Project | null> {
    const projects = await projectRepository.findMany({
      where: and(
        eq(projectRepository['table']?.ownerId, userId),
        eq(projectRepository['table']?.name, name)
      ),
      limit: 1
    });

    return projects.data[0] || null;
  }

  private buildProjectWhereConditions(filters: ProjectFilters, userId: string): any {
    // For now, return a simple condition - the repository layer should handle complex filtering
    return eq(projectRepository['table']?.ownerId, userId);
  }

  // Status Management Methods
  async startProject(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('startProject', ctx, { projectId: id });

    try {
      const updatedProject = await this.updateProject(id, { status: 'active' }, ctx);
      
      await this.recordMetric('project.started', 1);
      
      return updatedProject;
    } catch (error) {
      this.handleError(error, 'startProject', ctx);
    }
  }

  async pauseProject(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('pauseProject', ctx, { projectId: id });

    try {
      const updatedProject = await this.updateProject(id, { status: 'on_hold' }, ctx);
      
      await this.recordMetric('project.paused', 1);
      
      return updatedProject;
    } catch (error) {
      this.handleError(error, 'pauseProject', ctx);
    }
  }

  async completeProject(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('completeProject', ctx, { projectId: id });

    try {
      const updatedProject = await this.updateProject(id, { status: 'completed' }, ctx);
      
      await this.recordMetric('project.completed', 1);
      
      return updatedProject;
    } catch (error) {
      this.handleError(error, 'completeProject', ctx);
    }
  }

  async cancelProject(id: string, context?: ServiceContext): Promise<Project> {
    const ctx = this.createContext(context);
    this.logOperation('cancelProject', ctx, { projectId: id });

    try {
      const updatedProject = await this.updateProject(id, { status: 'cancelled' }, ctx);
      
      await this.recordMetric('project.cancelled', 1);
      
      return updatedProject;
    } catch (error) {
      this.handleError(error, 'cancelProject', ctx);
    }
  }

  private validateProjectData(data: ProjectCreateData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Project name is required');
    }

    if (data.name.length > 255) {
      throw new ValidationError('Project name must be less than 255 characters');
    }

    if (data.description && data.description.length > 1000) {
      throw new ValidationError('Project description must be less than 1000 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Project color must be a valid hex color code');
    }

    if (data.status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(data.status)) {
      throw new ValidationError('Invalid project status');
    }
  }

  private validateProjectUpdateData(data: ProjectUpdateData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Project name is required');
      }
      if (data.name.length > 255) {
        throw new ValidationError('Project name must be less than 255 characters');
      }
    }

    if (data.description !== undefined && data.description && data.description.length > 1000) {
      throw new ValidationError('Project description must be less than 1000 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Project color must be a valid hex color code');
    }

    if (data.status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(data.status)) {
      throw new ValidationError('Invalid project status');
    }
  }
}

// Export singleton instance
export const projectService = new ProjectService();
