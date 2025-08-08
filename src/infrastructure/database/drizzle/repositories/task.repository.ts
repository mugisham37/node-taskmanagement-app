import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, gte, lte } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { tasks, Task, NewTask } from '../schema/tasks';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class TaskRepository extends BaseRepository<Task, NewTask> {
  protected table = tasks;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 180, keyPrefix: 'task' }, // Enable caching for tasks
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Task-specific methods
  async findByProject(projectId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.projectId, projectId),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByProject');
    }
  }

  async findByAssignee(assigneeId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.assigneeId, assigneeId),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByAssignee');
    }
  }

  async findByCreator(creatorId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.creatorId, creatorId),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByCreator');
    }
  }

  async findByStatus(status: string, options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.status, status),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByStatus');
    }
  }

  async findByPriority(priority: string, options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.priority, priority),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByPriority');
    }
  }

  async findOverdueTasks(options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      const now = new Date();
      return await this.findMany({
        where: and(
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, now),
          eq(tasks.status, 'todo') // Assuming 'todo' means not completed
        ),
        ...options,
        sortBy: 'dueDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findOverdueTasks');
    }
  }

  async findTasksDueToday(options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      return await this.findMany({
        where: and(
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, startOfDay),
          lte(tasks.dueDate, endOfDay)
        ),
        ...options,
        sortBy: 'dueDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findTasksDueToday');
    }
  }

  async findTasksDueThisWeek(options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      const today = new Date();
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
      const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 7);

      return await this.findMany({
        where: and(
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, startOfWeek),
          lte(tasks.dueDate, endOfWeek)
        ),
        ...options,
        sortBy: 'dueDate',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findTasksDueThisWeek');
    }
  }

  async findHighPriorityTasks(options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: or(
          eq(tasks.priority, 'high'),
          eq(tasks.priority, 'critical')
        ),
        ...options,
        sortBy: 'priority',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findHighPriorityTasks');
    }
  }

  async findCompletedTasks(options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.status, 'done'),
        ...options,
        sortBy: 'completedAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findCompletedTasks');
    }
  }

  async findInProgressTasks(options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findMany({
        where: eq(tasks.status, 'in-progress'),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findInProgressTasks');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Task>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(tasks.title, searchPattern),
        ilike(tasks.description, searchPattern)
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

  async assignTask(taskId: string, assigneeId: string): Promise<Task | null> {
    try {
      return await this.update(taskId, {
        assigneeId,
        assignedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'assignTask');
    }
  }

  async unassignTask(taskId: string): Promise<Task | null> {
    try {
      return await this.update(taskId, {
        assigneeId: null,
        assignedAt: null
      } as any);
    } catch (error) {
      throw this.handleError(error, 'unassignTask');
    }
  }

  async updateStatus(taskId: string, status: string): Promise<Task | null> {
    try {
      const updateData: any = { status };
      
      // Set completion date if marking as done
      if (status === 'done') {
        updateData.completedAt = new Date();
      } else if (status === 'in-progress') {
        updateData.startedAt = new Date();
      }

      return await this.update(taskId, updateData);
    } catch (error) {
      throw this.handleError(error, 'updateStatus');
    }
  }

  async updatePriority(taskId: string, priority: string): Promise<Task | null> {
    try {
      return await this.update(taskId, { priority } as any);
    } catch (error) {
      throw this.handleError(error, 'updatePriority');
    }
  }

  async setDueDate(taskId: string, dueDate: Date): Promise<Task | null> {
    try {
      return await this.update(taskId, { dueDate } as any);
    } catch (error) {
      throw this.handleError(error, 'setDueDate');
    }
  }

  async removeDueDate(taskId: string): Promise<Task | null> {
    try {
      return await this.update(taskId, { dueDate: null } as any);
    } catch (error) {
      throw this.handleError(error, 'removeDueDate');
    }
  }

  async addTags(taskId: string, tags: string[]): Promise<Task | null> {
    try {
      const task = await this.findById(taskId);
      if (!task) return null;

      const existingTags = (task.tags as string[]) || [];
      const newTags = [...new Set([...existingTags, ...tags])];

      return await this.update(taskId, { tags: newTags } as any);
    } catch (error) {
      throw this.handleError(error, 'addTags');
    }
  }

  async removeTags(taskId: string, tags: string[]): Promise<Task | null> {
    try {
      const task = await this.findById(taskId);
      if (!task) return null;

      const existingTags = (task.tags as string[]) || [];
      const newTags = existingTags.filter(tag => !tags.includes(tag));

      return await this.update(taskId, { tags: newTags } as any);
    } catch (error) {
      throw this.handleError(error, 'removeTags');
    }
  }

  async findByTags(tags: string[], options: PaginationOptions = {}): Promise<PaginatedResult<Task>> {
    try {
      // This would need proper JSON array query implementation
      // For now, we'll return all tasks and filter in application
      const allTasks = await this.findMany(options);
      
      const filteredTasks = allTasks.data.filter(task => {
        const taskTags = (task.tags as string[]) || [];
        return tags.some(tag => taskTags.includes(tag));
      });

      return {
        data: filteredTasks,
        pagination: {
          ...allTasks.pagination,
          total: filteredTasks.length
        }
      };
    } catch (error) {
      throw this.handleError(error, 'findByTags');
    }
  }

  async getTaskStats(projectId?: string): Promise<{
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    highPriority: number;
  }> {
    try {
      const baseWhere = projectId ? eq(tasks.projectId, projectId) : undefined;
      const now = new Date();

      const [
        total,
        todo,
        inProgress,
        done,
        overdue,
        highPriority
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(tasks.status, 'todo')) : eq(tasks.status, 'todo')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(tasks.status, 'in-progress')) : eq(tasks.status, 'in-progress')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(tasks.status, 'done')) : eq(tasks.status, 'done')
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, isNotNull(tasks.dueDate), lte(tasks.dueDate, now), eq(tasks.status, 'todo')) :
            and(isNotNull(tasks.dueDate), lte(tasks.dueDate, now), eq(tasks.status, 'todo'))
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, or(eq(tasks.priority, 'high'), eq(tasks.priority, 'critical'))) :
            or(eq(tasks.priority, 'high'), eq(tasks.priority, 'critical'))
        })
      ]);

      return {
        total,
        todo,
        inProgress,
        done,
        overdue,
        highPriority
      };
    } catch (error) {
      throw this.handleError(error, 'getTaskStats');
    }
  }

  async bulkUpdateStatus(taskIds: string[], status: string): Promise<{ success: boolean; count: number }> {
    try {
      const updateData: any = { status };
      
      if (status === 'done') {
        updateData.completedAt = new Date();
      } else if (status === 'in-progress') {
        updateData.startedAt = new Date();
      }

      return await this.updateMany(taskIds, updateData);
    } catch (error) {
      throw this.handleError(error, 'bulkUpdateStatus');
    }
  }

  async bulkAssign(taskIds: string[], assigneeId: string): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(taskIds, {
        assigneeId,
        assignedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkAssign');
    }
  }

  async bulkUpdatePriority(taskIds: string[], priority: string): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(taskIds, { priority } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkUpdatePriority');
    }
  }

  async updateEstimatedHours(taskId: string, estimatedHours: number): Promise<Task | null> {
    try {
      return await this.update(taskId, { estimatedHours } as any);
    } catch (error) {
      throw this.handleError(error, 'updateEstimatedHours');
    }
  }

  async updateActualHours(taskId: string, actualHours: number): Promise<Task | null> {
    try {
      return await this.update(taskId, { actualHours } as any);
    } catch (error) {
      throw this.handleError(error, 'updateActualHours');
    }
  }

  async addAttachment(taskId: string, attachment: any): Promise<Task | null> {
    try {
      const task = await this.findById(taskId);
      if (!task) return null;

      const existingAttachments = (task.attachments as any[]) || [];
      const newAttachments = [...existingAttachments, attachment];

      return await this.update(taskId, { attachments: newAttachments } as any);
    } catch (error) {
      throw this.handleError(error, 'addAttachment');
    }
  }

  async removeAttachment(taskId: string, attachmentId: string): Promise<Task | null> {
    try {
      const task = await this.findById(taskId);
      if (!task) return null;

      const existingAttachments = (task.attachments as any[]) || [];
      const newAttachments = existingAttachments.filter((att: any) => att.id !== attachmentId);

      return await this.update(taskId, { attachments: newAttachments } as any);
    } catch (error) {
      throw this.handleError(error, 'removeAttachment');
    }
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();
