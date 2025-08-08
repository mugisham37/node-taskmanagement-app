import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  ilike,
  isNull,
  isNotNull,
  gte,
  lte,
  inArray,
} from 'drizzle-orm';
import {
  BaseService,
  ServiceContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from './base.service';
import {
  taskTemplateRepository,
  userRepository,
  workspaceRepository,
  teamRepository,
  taskRepository,
  projectRepository,
} from '../db/repositories';
import { TaskTemplate, NewTaskTemplate } from '../db/schema/task-templates';
import {
  PaginationOptions,
  PaginatedResult,
} from '../db/repositories/base/interfaces';
import { taskService } from './TaskService';
import { activityService } from './activity.service';

export interface TaskTemplateFilters {
  userId?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  isPublic?: boolean;
  category?: string;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface TaskTemplateCreateData {
  name: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskData: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    estimatedHours?: number;
    tags?: string[];
    checklist?: Array<{
      title: string;
      completed?: boolean;
    }>;
    attachments?: Array<{
      filename: string;
      path: string;
      mimetype: string;
      size: number;
    }>;
  };
  settings?: Record<string, any>;
  tags?: string[];
}

export interface TaskTemplateUpdateData {
  name?: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskData?: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    estimatedHours?: number;
    tags?: string[];
    checklist?: Array<{
      title: string;
      completed?: boolean;
    }>;
    attachments?: Array<{
      filename: string;
      path: string;
      mimetype: string;
      size: number;
    }>;
  };
  settings?: Record<string, any>;
  tags?: string[];
}

export interface TaskTemplateStats {
  totalTemplates: number;
  publicTemplates: number;
  privateTemplates: number;
  byCategory: Record<string, number>;
  mostUsedTemplates: Array<{
    templateId: string;
    name: string;
    usageCount: number;
  }>;
  recentTemplates: TaskTemplate[];
}

export class TaskTemplateService extends BaseService {
  constructor() {
    super('TaskTemplateService', {
      enableCache: true,
      cacheTimeout: 600, // 10 minutes cache for templates
      enableAudit: true,
      enableMetrics: true,
    });
  }

  // Core CRUD Operations
  async createTaskTemplate(
    data: TaskTemplateCreateData,
    context?: ServiceContext
  ): Promise<TaskTemplate> {
    const ctx = this.createContext(context);
    this.logOperation('createTaskTemplate', ctx, {
      name: data.name,
      category: data.category,
      isPublic: data.isPublic,
    });

    try {
      // Validate input
      this.validateTaskTemplateData(data);

      // Verify workspace access if specified
      if (data.workspaceId) {
        await this.verifyWorkspaceAccess(data.workspaceId, ctx.userId!);
      }

      // Verify team access if specified
      if (data.teamId) {
        await this.verifyTeamAccess(data.teamId, ctx.userId!);
      }

      // Verify project access if specified
      if (data.projectId) {
        await this.verifyProjectAccess(data.projectId, ctx.userId!);
      }

      // Create task template
      const newTemplate: NewTaskTemplate = {
        name: data.name,
        description: data.description,
        category: data.category || 'general',
        isPublic: data.isPublic || false,
        userId: ctx.userId!,
        workspaceId: data.workspaceId || undefined,
        teamId: data.teamId || undefined,
        projectId: data.projectId || undefined,
        taskData: data.taskData,
        settings: data.settings || {},
        tags: data.tags || [],
        usageCount: 0,
      };

      const template = await taskTemplateRepository.create(newTemplate);

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_created',
          workspaceId: data.workspaceId || undefined,
          teamId: data.teamId || undefined,
          projectId: data.projectId || undefined,
          data: {
            action: 'task_template_created',
            templateId: template.id,
            templateName: template.name,
            category: template.category,
            isPublic: template.isPublic,
          },
          metadata: {
            templateId: template.id,
          },
        },
        ctx
      );

      await this.recordMetric('task_template.created', 1, {
        category: template.category || 'uncategorized',
        isPublic: template.isPublic ? 'true' : 'false',
        hasWorkspace: template.workspaceId ? 'true' : 'false',
        hasTeam: template.teamId ? 'true' : 'false',
      });

      return template;
    } catch (error) {
      this.handleError(error, 'createTaskTemplate', ctx);
    }
  }

  async getTaskTemplateById(
    id: string,
    context?: ServiceContext
  ): Promise<TaskTemplate> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskTemplateById', ctx, { templateId: id });

    try {
      const template = await taskTemplateRepository.findById(id);
      if (!template) {
        throw new NotFoundError('Task Template', id);
      }

      // Check access permissions
      await this.verifyTemplateAccess(template, ctx.userId!);

      return template;
    } catch (error) {
      this.handleError(error, 'getTaskTemplateById', ctx);
    }
  }

  async getTaskTemplates(
    filters: TaskTemplateFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<TaskTemplate>> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskTemplates', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);

      // Build where conditions
      const whereConditions = this.buildTemplateWhereConditions(
        filters,
        ctx.userId!
      );

      const result = await taskTemplateRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getTaskTemplates', ctx);
    }
  }

  async updateTaskTemplate(
    id: string,
    data: TaskTemplateUpdateData,
    context?: ServiceContext
  ): Promise<TaskTemplate> {
    const ctx = this.createContext(context);
    this.logOperation('updateTaskTemplate', ctx, {
      templateId: id,
      updates: Object.keys(data),
    });

    try {
      const existingTemplate = await taskTemplateRepository.findById(id);
      if (!existingTemplate) {
        throw new NotFoundError('Task Template', id);
      }

      // Check permissions - only owner can update
      if (existingTemplate.userId !== ctx.userId) {
        throw new ForbiddenError(
          'Only the template owner can update this template'
        );
      }

      // Validate updates
      this.validateTaskTemplateUpdateData(data);

      // Verify access for new workspace/team/project if being changed
      if (
        data.workspaceId &&
        data.workspaceId !== existingTemplate.workspaceId
      ) {
        await this.verifyWorkspaceAccess(data.workspaceId, ctx.userId!);
      }

      if (data.teamId && data.teamId !== existingTemplate.teamId) {
        await this.verifyTeamAccess(data.teamId, ctx.userId!);
      }

      if (data.projectId && data.projectId !== existingTemplate.projectId) {
        await this.verifyProjectAccess(data.projectId, ctx.userId!);
      }

      // Merge task data if provided
      let updatedTaskData = existingTemplate.taskData;
      if (data.taskData) {
        updatedTaskData = {
          ...(existingTemplate.taskData as any),
          ...data.taskData,
        };
      }

      const updatedTemplate = await taskTemplateRepository.update(id, {
        ...data,
        taskData: updatedTaskData,
        updatedAt: new Date(),
      });

      if (!updatedTemplate) {
        throw new NotFoundError('Task Template', id);
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_updated',
          data: {
            action: 'task_template_updated',
            templateId: updatedTemplate.id,
            templateName: updatedTemplate.name,
            changes: Object.keys(data),
          },
          metadata: {
            templateId: updatedTemplate.id,
          },
        },
        ctx
      );

      await this.recordMetric('task_template.updated', 1);

      return updatedTemplate;
    } catch (error) {
      this.handleError(error, 'updateTaskTemplate', ctx);
    }
  }

  async deleteTaskTemplate(
    id: string,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteTaskTemplate', ctx, { templateId: id });

    try {
      const template = await taskTemplateRepository.findById(id);
      if (!template) {
        throw new NotFoundError('Task Template', id);
      }

      // Check permissions - only owner can delete
      if (template.userId !== ctx.userId) {
        throw new ForbiddenError(
          'Only the template owner can delete this template'
        );
      }

      const success = await taskTemplateRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Task Template', id);
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_deleted',
          data: {
            action: 'task_template_deleted',
            templateId: id,
            templateName: template.name,
          },
          metadata: {
            templateId: id,
          },
        },
        ctx
      );

      await this.recordMetric('task_template.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteTaskTemplate', ctx);
    }
  }

  // Template Usage
  async createTaskFromTemplate(
    templateId: string,
    options: {
      projectId?: string;
      assigneeId?: string;
      dueDate?: Date;
      customData?: Record<string, any>;
    } = {},
    context?: ServiceContext
  ): Promise<any> {
    const ctx = this.createContext(context);
    this.logOperation('createTaskFromTemplate', ctx, { templateId, options });

    try {
      const template = await taskTemplateRepository.findById(templateId);
      if (!template) {
        throw new NotFoundError('Task Template', templateId);
      }

      // Check access permissions
      await this.verifyTemplateAccess(template, ctx.userId!);

      // Increment usage count
      await taskTemplateRepository.incrementUsageCount(templateId);

      // Create task data from template
      const taskData = {
        ...(template.taskData as any),
        projectId:
          options.projectId ??
          (template.projectId === null ? undefined : template.projectId),
        assigneeId: options.assigneeId ?? undefined,
        dueDate: options.dueDate ?? undefined,
        ...options.customData,
      };

      // Create the task using task service
      const task = await taskService.createTask(taskData, ctx);

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_created',
          taskId: task.id,
          projectId: task.projectId || undefined,
          data: {
            action: 'task_created_from_template',
            templateId: template.id,
            templateName: template.name,
            taskTitle: task.title,
          },
          metadata: {
            templateId: template.id,
            taskId: task.id,
          },
        },
        ctx
      );

      await this.recordMetric('task_template.used', 1, {
        templateId: template.id,
        category: template.category || 'uncategorized',
      });

      return task;
    } catch (error) {
      this.handleError(error, 'createTaskFromTemplate', ctx);
    }
  }

  // Template Categories
  async getTemplateCategories(
    context?: ServiceContext
  ): Promise<Array<{ category: string; count: number }>> {
    const ctx = this.createContext(context);
    this.logOperation('getTemplateCategories', ctx);

    try {
      // Get all templates accessible to user
      const whereConditions = this.buildTemplateWhereConditions(
        {},
        ctx.userId!
      );

      const allTemplates = await taskTemplateRepository.findMany({
        where: whereConditions,
        limit: 10000,
      });

      // Group by category
      const categoryMap: Record<string, number> = {};
      allTemplates.data.forEach(template => {
        const category = template.category || 'Uncategorized';
        categoryMap[category] = (categoryMap[category] || 0) + 1;
      });

      return Object.entries(categoryMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      this.handleError(error, 'getTemplateCategories', ctx);
    }
  }

  // Public Templates
  async getPublicTemplates(
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<TaskTemplate>> {
    const ctx = this.createContext(context);
    this.logOperation('getPublicTemplates', ctx, options);

    try {
      const paginationOptions = this.validatePagination(options);

      const result = await taskTemplateRepository.findMany({
        ...paginationOptions,
        where: eq(taskTemplateRepository['table']?.isPublic, true),
        sortBy: 'usageCount',
        sortOrder: 'desc', // Most used first
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getPublicTemplates', ctx);
    }
  }

  async duplicateTemplate(
    templateId: string,
    context?: ServiceContext
  ): Promise<TaskTemplate> {
    const ctx = this.createContext(context);
    this.logOperation('duplicateTemplate', ctx, { templateId });

    try {
      const originalTemplate =
        await taskTemplateRepository.findById(templateId);
      if (!originalTemplate) {
        throw new NotFoundError('Task Template', templateId);
      }

      // Check access permissions
      await this.verifyTemplateAccess(originalTemplate, ctx.userId!);

      // Create duplicate
      const duplicateData: TaskTemplateCreateData = {
        name: `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description || undefined,
        category: originalTemplate.category || undefined,
        isPublic: false, // Duplicates are always private initially
        workspaceId: originalTemplate.workspaceId || undefined,
        teamId: originalTemplate.teamId || undefined,
        projectId: originalTemplate.projectId || undefined,
        taskData:
          originalTemplate.taskData as TaskTemplateCreateData['taskData'],
        settings: originalTemplate.settings as Record<string, any>,
      };

      const duplicateTemplate = await this.createTaskTemplate(
        duplicateData,
        ctx
      );

      await this.recordMetric('task_template.duplicated', 1, {
        originalTemplateId: templateId,
      });

      return duplicateTemplate;
    } catch (error) {
      this.handleError(error, 'duplicateTemplate', ctx);
    }
  }

  // Statistics
  async getTaskTemplateStats(
    filters: TaskTemplateFilters = {},
    context?: ServiceContext
  ): Promise<TaskTemplateStats> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskTemplateStats', ctx, { filters });

    try {
      const whereConditions = this.buildTemplateWhereConditions(
        filters,
        ctx.userId!
      );

      const allTemplates = await taskTemplateRepository.findMany({
        where: whereConditions,
        limit: 10000,
      });

      const templates = allTemplates.data;

      // Calculate stats
      const byCategory: Record<string, number> = {};
      templates.forEach(template => {
        const category = template.category || 'Uncategorized';
        byCategory[category] = (byCategory[category] || 0) + 1;
      });

      // Get most used templates
      const mostUsedTemplates = templates
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10)
        .map(template => ({
          templateId: template.id,
          name: template.name,
          usageCount: template.usageCount,
        }));

      // Get recent templates
      const recentTemplates = templates
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5);

      const stats: TaskTemplateStats = {
        totalTemplates: templates.length,
        publicTemplates: templates.filter(t => t.isPublic).length,
        privateTemplates: templates.filter(t => !t.isPublic).length,
        byCategory,
        mostUsedTemplates,
        recentTemplates,
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getTaskTemplateStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyTemplateAccess(
    template: TaskTemplate,
    userId: string
  ): Promise<void> {
    // User can access template if:
    // 1. They own it
    // 2. It's public
    // 3. They have access to the workspace/team/project it belongs to

    if (template.userId === userId || template.isPublic) {
      return;
    }

    // Check workspace/team/project access
    if (
      template.workspaceId &&
      (await this.hasWorkspaceAccess(userId, template.workspaceId))
    ) {
      return;
    }

    if (
      template.teamId &&
      (await this.hasTeamAccess(userId, template.teamId))
    ) {
      return;
    }

    if (
      template.projectId &&
      (await this.hasProjectAccess(userId, template.projectId))
    ) {
      return;
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this task template');
  }

  private async verifyWorkspaceAccess(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }
    // Add workspace member check logic here
  }

  private async verifyTeamAccess(
    teamId: string,
    userId: string
  ): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }
    // Add team member check logic here
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    // Add project access check logic here
  }

  private async hasWorkspaceAccess(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) return false;
    // Add workspace member check logic here
    return true; // Placeholder
  }

  private async hasTeamAccess(
    userId: string,
    teamId: string
  ): Promise<boolean> {
    const team = await teamRepository.findById(teamId);
    if (!team) return false;
    // Add team member check logic here
    return true; // Placeholder
  }

  private async hasProjectAccess(
    userId: string,
    projectId: string
  ): Promise<boolean> {
    const project = await projectRepository.findById(projectId);
    if (!project) return false;
    // Add project access check logic here
    return true; // Placeholder
  }

  private buildTemplateWhereConditions(
    filters: TaskTemplateFilters,
    userId: string
  ): any {
    const conditions = [];

    // User can see their own templates and public templates
    conditions.push(
      or(
        eq(taskTemplateRepository['table']?.userId, userId),
        eq(taskTemplateRepository['table']?.isPublic, true)
      )
    );

    if (filters.userId) {
      conditions.push(
        eq(taskTemplateRepository['table']?.userId, filters.userId)
      );
    }

    if (filters.workspaceId) {
      if (filters.workspaceId === 'none') {
        conditions.push(isNull(taskTemplateRepository['table']?.workspaceId));
      } else {
        conditions.push(
          eq(taskTemplateRepository['table']?.workspaceId, filters.workspaceId)
        );
      }
    }

    if (filters.teamId) {
      if (filters.teamId === 'none') {
        conditions.push(isNull(taskTemplateRepository['table']?.teamId));
      } else {
        conditions.push(
          eq(taskTemplateRepository['table']?.teamId, filters.teamId)
        );
      }
    }

    if (filters.projectId) {
      if (filters.projectId === 'none') {
        conditions.push(isNull(taskTemplateRepository['table']?.projectId));
      } else {
        conditions.push(
          eq(taskTemplateRepository['table']?.projectId, filters.projectId)
        );
      }
    }

    if (filters.isPublic !== undefined) {
      conditions.push(
        eq(taskTemplateRepository['table']?.isPublic, filters.isPublic)
      );
    }

    if (filters.category) {
      conditions.push(
        eq(taskTemplateRepository['table']?.category, filters.category)
      );
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(taskTemplateRepository['table']?.name, `%${filters.search}%`),
          ilike(
            taskTemplateRepository['table']?.description,
            `%${filters.search}%`
          )
        )
      );
    }

    if (filters.createdFrom) {
      conditions.push(
        gte(taskTemplateRepository['table']?.createdAt, filters.createdFrom)
      );
    }

    if (filters.createdTo) {
      conditions.push(
        lte(taskTemplateRepository['table']?.createdAt, filters.createdTo)
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateTaskTemplateData(data: TaskTemplateCreateData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Template name is required');
    }

    if (data.name.length > 200) {
      throw new ValidationError(
        'Template name must be less than 200 characters'
      );
    }

    if (data.description && data.description.length > 1000) {
      throw new ValidationError(
        'Template description must be less than 1000 characters'
      );
    }

    if (!data.taskData || !data.taskData.title) {
      throw new ValidationError('Task data with title is required');
    }

    if (data.taskData.title.length > 500) {
      throw new ValidationError('Task title must be less than 500 characters');
    }

    if (data.taskData.description && data.taskData.description.length > 5000) {
      throw new ValidationError(
        'Task description must be less than 5000 characters'
      );
    }

    if (
      data.taskData.estimatedHours &&
      (data.taskData.estimatedHours < 0 || data.taskData.estimatedHours > 1000)
    ) {
      throw new ValidationError('Estimated hours must be between 0 and 1000');
    }
  }

  private validateTaskTemplateUpdateData(data: TaskTemplateUpdateData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Template name is required');
      }
      if (data.name.length > 200) {
        throw new ValidationError(
          'Template name must be less than 200 characters'
        );
      }
    }

    if (
      data.description !== undefined &&
      data.description &&
      data.description.length > 1000
    ) {
      throw new ValidationError(
        'Template description must be less than 1000 characters'
      );
    }

    if (data.taskData) {
      if (data.taskData.title !== undefined) {
        if (!data.taskData.title || data.taskData.title.trim().length === 0) {
          throw new ValidationError('Task title is required');
        }
        if (data.taskData.title.length > 500) {
          throw new ValidationError(
            'Task title must be less than 500 characters'
          );
        }
      }

      if (
        data.taskData.description !== undefined &&
        data.taskData.description &&
        data.taskData.description.length > 5000
      ) {
        throw new ValidationError(
          'Task description must be less than 5000 characters'
        );
      }

      if (
        data.taskData.estimatedHours !== undefined &&
        data.taskData.estimatedHours &&
        (data.taskData.estimatedHours < 0 ||
          data.taskData.estimatedHours > 1000)
      ) {
        throw new ValidationError('Estimated hours must be between 0 and 1000');
      }
    }
  }
}

// Export singleton instance
export const taskTemplateService = new TaskTemplateService();
