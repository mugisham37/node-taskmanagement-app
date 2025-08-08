import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, lte, gte, count } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { 
  recurringTasks, 
  RecurringTask, 
  NewRecurringTask,
  recurringTaskInstances,
  RecurringTaskInstance,
  NewRecurringTaskInstance
} from '../schema/recurring-tasks';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class RecurringTaskRepository extends BaseRepository<RecurringTask, NewRecurringTask> {
  protected table = recurringTasks;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'recurring_task' }, // Enable caching for recurring tasks
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Recurring Task specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      return await this.findMany({
        where: eq(recurringTasks.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByProject(projectId: string, options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      return await this.findMany({
        where: eq(recurringTasks.projectId, projectId),
        ...options,
        sortBy: 'nextRunDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByProject');
    }
  }

  async findByFrequency(frequency: string, options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      return await this.findMany({
        where: eq(recurringTasks.frequency, frequency),
        ...options,
        sortBy: 'nextRunDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByFrequency');
    }
  }

  async findActiveRecurringTasks(options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      return await this.findMany({
        where: eq(recurringTasks.active, true),
        ...options,
        sortBy: 'nextRunDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findActiveRecurringTasks');
    }
  }

  async findInactiveRecurringTasks(options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      return await this.findMany({
        where: eq(recurringTasks.active, false),
        ...options,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findInactiveRecurringTasks');
    }
  }

  async findTasksDueForExecution(options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      const now = new Date();
      return await this.findMany({
        where: and(
          eq(recurringTasks.active, true),
          isNotNull(recurringTasks.nextRunDate),
          lte(recurringTasks.nextRunDate, now)
        ),
        ...options,
        sortBy: 'nextRunDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findTasksDueForExecution');
    }
  }

  async findExpiredRecurringTasks(options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTask>> {
    try {
      const now = new Date();
      return await this.findMany({
        where: and(
          eq(recurringTasks.active, true),
          isNotNull(recurringTasks.endDate),
          lte(recurringTasks.endDate, now)
        ),
        ...options,
        sortBy: 'endDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findExpiredRecurringTasks');
    }
  }

  async activateRecurringTask(recurringTaskId: string): Promise<RecurringTask | null> {
    try {
      return await this.update(recurringTaskId, {
        active: true,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'activateRecurringTask');
    }
  }

  async deactivateRecurringTask(recurringTaskId: string): Promise<RecurringTask | null> {
    try {
      return await this.update(recurringTaskId, {
        active: false,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'deactivateRecurringTask');
    }
  }

  async updateNextRunDate(recurringTaskId: string, nextRunDate: Date): Promise<RecurringTask | null> {
    try {
      return await this.update(recurringTaskId, {
        nextRunDate,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateNextRunDate');
    }
  }

  async updateTaskTemplate(recurringTaskId: string, taskTemplate: Record<string, any>): Promise<RecurringTask | null> {
    try {
      return await this.update(recurringTaskId, {
        taskTemplate,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateTaskTemplate');
    }
  }

  async updateSettings(recurringTaskId: string, settings: Record<string, any>): Promise<RecurringTask | null> {
    try {
      return await this.update(recurringTaskId, {
        settings,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateSettings');
    }
  }

  async incrementCreatedTasksCount(recurringTaskId: string): Promise<RecurringTask | null> {
    try {
      const recurringTask = await this.findById(recurringTaskId);
      if (!recurringTask) return null;

      return await this.update(recurringTaskId, {
        createdTasksCount: recurringTask.createdTasksCount + 1,
        lastTaskCreated: new Date(),
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'incrementCreatedTasksCount');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<RecurringTask>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(recurringTasks.title, searchPattern),
        ilike(recurringTasks.description, searchPattern)
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

  async getRecurringTaskStats(userId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    dueForExecution: number;
    expired: number;
    byFrequency: Record<string, number>;
  }> {
    try {
      const baseWhere = userId ? eq(recurringTasks.userId, userId) : undefined;
      const now = new Date();

      const [
        total,
        active,
        inactive,
        dueForExecution,
        expired
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(recurringTasks.active, true)) : eq(recurringTasks.active, true)
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(recurringTasks.active, false)) : eq(recurringTasks.active, false)
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, eq(recurringTasks.active, true), isNotNull(recurringTasks.nextRunDate), lte(recurringTasks.nextRunDate, now)) :
            and(eq(recurringTasks.active, true), isNotNull(recurringTasks.nextRunDate), lte(recurringTasks.nextRunDate, now))
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, eq(recurringTasks.active, true), isNotNull(recurringTasks.endDate), lte(recurringTasks.endDate, now)) :
            and(eq(recurringTasks.active, true), isNotNull(recurringTasks.endDate), lte(recurringTasks.endDate, now))
        })
      ]);

      // For byFrequency stats, we'd need to group by frequency
      const byFrequency: Record<string, number> = {}; // Placeholder

      return {
        total,
        active,
        inactive,
        dueForExecution,
        expired,
        byFrequency
      };
    } catch (error) {
      throw this.handleError(error, 'getRecurringTaskStats');
    }
  }

  // Recurring Task Instance Management
  async createInstance(recurringTaskId: string, taskId: string, scheduledDate: Date): Promise<RecurringTaskInstance> {
    try {
      const instanceData: NewRecurringTaskInstance = {
        recurringTaskId,
        taskId,
        scheduledDate
      };

      const result = await this.db
        .insert(recurringTaskInstances)
        .values(instanceData)
        .returning();

      return result[0] as RecurringTaskInstance;
    } catch (error) {
      throw this.handleError(error, 'createInstance');
    }
  }

  async getRecurringTaskInstances(recurringTaskId: string, options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTaskInstance>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'scheduledDate',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build query for count
      const countQuery = this.db
        .select({ count: count() })
        .from(recurringTaskInstances)
        .where(eq(recurringTaskInstances.recurringTaskId, recurringTaskId));

      // Build query for data
      let dataQuery = this.db
        .select()
        .from(recurringTaskInstances)
        .where(eq(recurringTaskInstances.recurringTaskId, recurringTaskId));

      // Apply ordering
      if (sortBy && (recurringTaskInstances as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (recurringTaskInstances as any)[sortBy];
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
        data: data as RecurringTaskInstance[],
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
      throw this.handleError(error, 'getRecurringTaskInstances');
    }
  }

  async getInstancesByDateRange(startDate: Date, endDate: Date, options: PaginationOptions = {}): Promise<PaginatedResult<RecurringTaskInstance>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'scheduledDate',
        sortOrder = 'asc'
      } = options;

      const offset = (page - 1) * limit;

      const whereCondition = and(
        gte(recurringTaskInstances.scheduledDate, startDate),
        lte(recurringTaskInstances.scheduledDate, endDate)
      );

      // Build query for count
      const countQuery = this.db
        .select({ count: count() })
        .from(recurringTaskInstances)
        .where(whereCondition);

      // Build query for data
      let dataQuery = this.db
        .select()
        .from(recurringTaskInstances)
        .where(whereCondition);

      // Apply ordering
      if (sortBy && (recurringTaskInstances as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (recurringTaskInstances as any)[sortBy];
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
        data: data as RecurringTaskInstance[],
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
      throw this.handleError(error, 'getInstancesByDateRange');
    }
  }

  async deleteInstance(instanceId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(recurringTaskInstances)
        .where(eq(recurringTaskInstances.id, instanceId));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      throw this.handleError(error, 'deleteInstance');
    }
  }

  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userRecurringTasks = await this.findByUser(userId, { limit: 1000 });
      const recurringTaskIds = userRecurringTasks.data.map(task => task.id);
      
      if (recurringTaskIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(recurringTaskIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  async bulkDeleteByProject(projectId: string): Promise<{ success: boolean; count: number }> {
    try {
      const projectRecurringTasks = await this.findByProject(projectId, { limit: 1000 });
      const recurringTaskIds = projectRecurringTasks.data.map(task => task.id);
      
      if (recurringTaskIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(recurringTaskIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByProject');
    }
  }

  async bulkActivate(recurringTaskIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(recurringTaskIds, {
        active: true,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkActivate');
    }
  }

  async bulkDeactivate(recurringTaskIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(recurringTaskIds, {
        active: false,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkDeactivate');
    }
  }

  // Override create to add validation
  async create(data: NewRecurringTask): Promise<RecurringTask> {
    try {
      // Add any recurring task-specific validation here
      if (!data.title || data.title.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Recurring task title cannot be empty');
      }

      if (!data.frequency || data.frequency.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Recurring task frequency cannot be empty');
      }

      if (!data.taskTemplate || Object.keys(data.taskTemplate).length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Recurring task template cannot be empty');
      }

      if (data.endDate && data.endDate <= data.startDate) {
        throw new RepositoryException('VALIDATION_ERROR', 'End date must be after start date');
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
export const recurringTaskRepository = new RecurringTaskRepository();
