import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, count } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { 
  taskTemplates, 
  TaskTemplate, 
  NewTaskTemplate,
  taskTemplateUsage,
  TaskTemplateUsage,
  NewTaskTemplateUsage
} from '../schema/task-templates';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class TaskTemplateRepository extends BaseRepository<TaskTemplate, NewTaskTemplate> {
  protected table = taskTemplates;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'task_template' }, // Enable caching for task templates
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Task Template specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByProject(projectId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.projectId, projectId),
        ...options,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByProject');
    }
  }

  async findByWorkspace(workspaceId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.workspaceId, workspaceId),
        ...options,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByWorkspace');
    }
  }

  async findByTeam(teamId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.teamId, teamId),
        ...options,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByTeam');
    }
  }

  async findByCategory(category: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.category, category),
        ...options,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByCategory');
    }
  }

  async findPublicTemplates(options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.isPublic, true),
        ...options,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findPublicTemplates');
    }
  }

  async findPrivateTemplates(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: and(
          eq(taskTemplates.userId, userId),
          eq(taskTemplates.isPublic, false)
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findPrivateTemplates');
    }
  }

  async findPopularTemplates(options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      return await this.findMany({
        where: eq(taskTemplates.isPublic, true),
        ...options,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findPopularTemplates');
    }
  }

  async findRecentTemplates(userId: string, days: number = 30, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      return await this.findMany({
        where: eq(taskTemplates.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentTemplates');
    }
  }

  async makePublic(templateId: string): Promise<TaskTemplate | null> {
    try {
      return await this.update(templateId, {
        isPublic: true,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'makePublic');
    }
  }

  async makePrivate(templateId: string): Promise<TaskTemplate | null> {
    try {
      return await this.update(templateId, {
        isPublic: false,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'makePrivate');
    }
  }

  async updateCategory(templateId: string, category: string): Promise<TaskTemplate | null> {
    try {
      return await this.update(templateId, {
        category,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateCategory');
    }
  }

  async updateTaskData(templateId: string, taskData: Record<string, any>): Promise<TaskTemplate | null> {
    try {
      return await this.update(templateId, {
        taskData,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateTaskData');
    }
  }

  async updateSettings(templateId: string, settings: Record<string, any>): Promise<TaskTemplate | null> {
    try {
      return await this.update(templateId, {
        settings,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateSettings');
    }
  }

  async incrementUsageCount(templateId: string): Promise<TaskTemplate | null> {
    try {
      const template = await this.findById(templateId);
      if (!template) return null;

      return await this.update(templateId, {
        usageCount: template.usageCount + 1,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'incrementUsageCount');
    }
  }

  async addTags(templateId: string, tags: string[]): Promise<TaskTemplate | null> {
    try {
      const template = await this.findById(templateId);
      if (!template) return null;

      const existingTags = (template.tags as string[]) || [];
      const newTags = [...new Set([...existingTags, ...tags])];

      return await this.update(templateId, {
        tags: newTags,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'addTags');
    }
  }

  async removeTags(templateId: string, tags: string[]): Promise<TaskTemplate | null> {
    try {
      const template = await this.findById(templateId);
      if (!template) return null;

      const existingTags = (template.tags as string[]) || [];
      const newTags = existingTags.filter(tag => !tags.includes(tag));

      return await this.update(templateId, {
        tags: newTags,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'removeTags');
    }
  }

  async findByTags(tags: string[], options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplate>> {
    try {
      // This would need proper JSON array query implementation
      // For now, we'll return all templates and filter in application
      const allTemplates = await this.findMany(options);
      
      const filteredTemplates = allTemplates.data.filter(template => {
        const templateTags = (template.tags as string[]) || [];
        return tags.some(tag => templateTags.includes(tag));
      });

      return {
        data: filteredTemplates,
        pagination: {
          ...allTemplates.pagination,
          total: filteredTemplates.length
        }
      };
    } catch (error) {
      throw this.handleError(error, 'findByTags');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<TaskTemplate>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'usageCount', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(taskTemplates.name, searchPattern),
        ilike(taskTemplates.description, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  async getTemplateStats(userId?: string): Promise<{
    total: number;
    public: number;
    private: number;
    byCategory: Record<string, number>;
    totalUsage: number;
    mostUsed: TaskTemplate | null;
  }> {
    try {
      const baseWhere = userId ? eq(taskTemplates.userId, userId) : undefined;

      const [
        total,
        publicCount,
        privateCount
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(taskTemplates.isPublic, true)) : eq(taskTemplates.isPublic, true)
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(taskTemplates.isPublic, false)) : eq(taskTemplates.isPublic, false)
        })
      ]);

      // For byCategory stats, we'd need to group by category
      const byCategory: Record<string, number> = {}; // Placeholder

      // Get most used template
      const mostUsedResult = await this.findMany({
        where: baseWhere,
        limit: 1,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      });

      const mostUsed = mostUsedResult.data[0] || null;
      const totalUsage = mostUsed ? mostUsed.usageCount : 0; // This would need proper aggregation

      return {
        total,
        public: publicCount,
        private: privateCount,
        byCategory,
        totalUsage,
        mostUsed
      };
    } catch (error) {
      throw this.handleError(error, 'getTemplateStats');
    }
  }

  // Template Usage Management
  async recordUsage(templateId: string, userId: string, taskId?: string): Promise<TaskTemplateUsage> {
    try {
      const usageData: NewTaskTemplateUsage = {
        templateId,
        userId,
        taskId
      };

      const result = await this.db
        .insert(taskTemplateUsage)
        .values(usageData)
        .returning();

      // Increment usage count
      await this.incrementUsageCount(templateId);

      return result[0] as TaskTemplateUsage;
    } catch (error) {
      throw this.handleError(error, 'recordUsage');
    }
  }

  async getTemplateUsage(templateId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplateUsage>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'usedAt',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build query for count
      const countQuery = this.db
        .select({ count: count() })
        .from(taskTemplateUsage)
        .where(eq(taskTemplateUsage.templateId, templateId));

      // Build query for data
      let dataQuery = this.db
        .select()
        .from(taskTemplateUsage)
        .where(eq(taskTemplateUsage.templateId, templateId));

      // Apply ordering
      if (sortBy && (taskTemplateUsage as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (taskTemplateUsage as any)[sortBy];
        dataQuery = dataQuery.orderBy(orderFn(column)) as any;
      }

      // Apply pagination
      dataQuery = dataQuery.limit(limit).offset(offset) as any;

      // Execute queries
      const [totalResult, data] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as TaskTemplateUsage[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'getTemplateUsage');
    }
  }

  async getUserTemplateUsage(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TaskTemplateUsage>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'usedAt',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build query for count
      const countQuery = this.db
        .select({ count: count() })
        .from(taskTemplateUsage)
        .where(eq(taskTemplateUsage.userId, userId));

      // Build query for data
      let dataQuery = this.db
        .select()
        .from(taskTemplateUsage)
        .where(eq(taskTemplateUsage.userId, userId));

      // Apply ordering
      if (sortBy && (taskTemplateUsage as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (taskTemplateUsage as any)[sortBy];
        dataQuery = dataQuery.orderBy(orderFn(column)) as any;
      }

      // Apply pagination
      dataQuery = dataQuery.limit(limit).offset(offset) as any;

      // Execute queries
      const [totalResult, data] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as TaskTemplateUsage[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'getUserTemplateUsage');
    }
  }

  async duplicateTemplate(templateId: string, userId: string, newName?: string): Promise<TaskTemplate | null> {
    try {
      const originalTemplate = await this.findById(templateId);
      if (!originalTemplate) {
        throw new RepositoryException('NOT_FOUND', 'Template not found');
      }

      const duplicateData: NewTaskTemplate = {
        name: newName || `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        userId,
        projectId: originalTemplate.projectId,
        workspaceId: originalTemplate.workspaceId,
        teamId: originalTemplate.teamId,
        isPublic: false, // Duplicates are private by default
        category: originalTemplate.category,
        tags: originalTemplate.tags,
        taskData: originalTemplate.taskData,
        settings: originalTemplate.settings
      };

      return await this.create(duplicateData);
    } catch (error) {
      throw this.handleError(error, 'duplicateTemplate');
    }
  }

  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userTemplates = await this.findByUser(userId, { limit: 1000 });
      const templateIds = userTemplates.data.map(template => template.id);
      
      if (templateIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(templateIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  async bulkDeleteByProject(projectId: string): Promise<{ success: boolean; count: number }> {
    try {
      const projectTemplates = await this.findByProject(projectId, { limit: 1000 });
      const templateIds = projectTemplates.data.map(template => template.id);
      
      if (templateIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(templateIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByProject');
    }
  }

  async bulkMakePublic(templateIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(templateIds, {
        isPublic: true,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkMakePublic');
    }
  }

  async bulkMakePrivate(templateIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(templateIds, {
        isPublic: false,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkMakePrivate');
    }
  }

  // Override create to add validation
  async create(data: NewTaskTemplate): Promise<TaskTemplate> {
    try {
      // Add any task template-specific validation here
      if (!data.name || data.name.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Template name cannot be empty');
      }

      if (!data.taskData || Object.keys(data.taskData).length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Template task data cannot be empty');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }

  // Helper method to access db from base class
  private get db() {
    return (this as any).db || require('../../connection').db;
  }
}

// Export singleton instance
export const taskTemplateRepository = new TaskTemplateRepository();
