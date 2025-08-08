import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { 
  recurringTaskRepository, 
  userRepository, 
  projectRepository,
  workspaceRepository,
  teamRepository,
  taskRepository
} from '../db/repositories';
import { RecurringTask, NewRecurringTask } from '../db/schema/recurring-tasks';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import { taskService } from './task.service';
import { notificationService, NotificationType } from './notification.service';
import { activityService } from './activity.service';

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export interface RecurringTaskFilters {
  userId?: string;
  projectId?: string;
  frequency?: RecurrenceFrequency | RecurrenceFrequency[];
  active?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  search?: string;
}

export interface RecurringTaskCreateData {
  title: string;
  description?: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: Date;
  endDate?: Date;
  active?: boolean;
  projectId?: string;
  taskTemplate: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    estimatedHours?: number;
    tags?: string[];
  };
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  monthsOfYear?: number[];
}

export interface RecurringTaskUpdateData {
  title?: string;
  description?: string;
  frequency?: RecurrenceFrequency;
  interval?: number;
  startDate?: Date;
  endDate?: Date;
  active?: boolean;
  taskTemplate?: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    estimatedHours?: number;
    tags?: string[];
  };
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  monthsOfYear?: number[];
}

export interface RecurringTaskStats {
  total: number;
  active: number;
  inactive: number;
  byFrequency: Record<string, number>;
  tasksCreated: number;
  nextDue: Array<{
    id: string;
    title: string;
    nextRunDate: Date;
  }>;
}

export class RecurringTaskService extends BaseService {
  constructor() {
    super('RecurringTaskService', {
      enableCache: true,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createRecurringTask(data: RecurringTaskCreateData, context?: ServiceContext): Promise<RecurringTask> {
    const ctx = this.createContext(context);
    this.logOperation('createRecurringTask', ctx, { 
      title: data.title, 
      frequency: data.frequency,
      interval: data.interval
    });

    try {
      // Validate input
      this.validateRecurringTaskData(data);

      // Verify project access if specified
      if (data.projectId) {
        await this.verifyProjectAccess(data.projectId, ctx.userId!);
      }

      // Calculate next run date
      const nextRunDate = this.calculateNextRunDate(data);

      // Create recurring task
      const newRecurringTask: NewRecurringTask = {
        title: data.title,
        description: data.description,
        frequency: data.frequency,
        interval: data.interval,
        startDate: data.startDate,
        endDate: data.endDate,
        active: data.active !== false,
        userId: ctx.userId!,
        projectId: data.projectId,
        taskTemplate: data.taskTemplate,
        daysOfWeek: data.daysOfWeek || [],
        daysOfMonth: data.daysOfMonth || [],
        monthsOfYear: data.monthsOfYear || [],
        nextRunDate
      };

      const recurringTask = await recurringTaskRepository.create(newRecurringTask);

      // Schedule the first task instance if the recurring task is active
      if (recurringTask.active) {
        await this.scheduleNextTaskInstance(recurringTask);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'task_created',
        projectId: data.projectId,
        data: {
          action: 'recurring_task_created',
          recurringTaskId: recurringTask.id,
          title: recurringTask.title,
          frequency: recurringTask.frequency,
          interval: recurringTask.interval
        },
        metadata: {
          recurringTaskId: recurringTask.id,
          nextRunDate: nextRunDate.toISOString()
        }
      }, ctx);

      await this.recordMetric('recurring_task.created', 1, { 
        frequency: recurringTask.frequency,
        interval: recurringTask.interval.toString(),
        hasProject: recurringTask.projectId ? 'true' : 'false',
        active: recurringTask.active ? 'true' : 'false'
      });

      return recurringTask;
    } catch (error) {
      this.handleError(error, 'createRecurringTask', ctx);
    }
  }

  async getRecurringTaskById(id: string, context?: ServiceContext): Promise<RecurringTask> {
    const ctx = this.createContext(context);
    this.logOperation('getRecurringTaskById', ctx, { recurringTaskId: id });

    try {
      const recurringTask = await recurringTaskRepository.findById(id);
      if (!recurringTask) {
        throw new NotFoundError('Recurring Task', id);
      }

      // Check access permissions
      await this.verifyRecurringTaskAccess(recurringTask, ctx.userId!);

      return recurringTask;
    } catch (error) {
      this.handleError(error, 'getRecurringTaskById', ctx);
    }
  }

  async getRecurringTasks(
    filters: RecurringTaskFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<RecurringTask>> {
    const ctx = this.createContext(context);
    this.logOperation('getRecurringTasks', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildRecurringTaskWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const result = await recurringTaskRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getRecurringTasks', ctx);
    }
  }

  async updateRecurringTask(id: string, data: RecurringTaskUpdateData, context?: ServiceContext): Promise<RecurringTask> {
    const ctx = this.createContext(context);
    this.logOperation('updateRecurringTask', ctx, { recurringTaskId: id, updates: Object.keys(data) });

    try {
      const existingRecurringTask = await recurringTaskRepository.findById(id);
      if (!existingRecurringTask) {
        throw new NotFoundError('Recurring Task', id);
      }

      // Check permissions
      await this.verifyRecurringTaskAccess(existingRecurringTask, ctx.userId!);

      // Validate updates
      this.validateRecurringTaskUpdateData(data);

      // Recalculate next run date if frequency or interval changed
      let nextRunDate = existingRecurringTask.nextRunDate;
      if (data.frequency || data.interval || data.startDate) {
        const updatedData = { ...existingRecurringTask, ...data };
        nextRunDate = this.calculateNextRunDate(updatedData as any);
      }

      const updatedRecurringTask = await recurringTaskRepository.update(id, {
        ...data,
        nextRunDate,
        updatedAt: new Date()
      });

      if (!updatedRecurringTask) {
        throw new NotFoundError('Recurring Task', id);
      }

      // If the recurring task was activated, schedule the next task instance
      if (data.active === true && !existingRecurringTask.active) {
        await this.scheduleNextTaskInstance(updatedRecurringTask);
      }

      await this.recordMetric('recurring_task.updated', 1, { 
        frequencyChanged: data.frequency !== undefined ? 'true' : 'false',
        activeChanged: data.active !== undefined ? 'true' : 'false'
      });

      return updatedRecurringTask;
    } catch (error) {
      this.handleError(error, 'updateRecurringTask', ctx);
    }
  }

  async deleteRecurringTask(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteRecurringTask', ctx, { recurringTaskId: id });

    try {
      const recurringTask = await recurringTaskRepository.findById(id);
      if (!recurringTask) {
        throw new NotFoundError('Recurring Task', id);
      }

      // Check permissions
      await this.verifyRecurringTaskAccess(recurringTask, ctx.userId!);

      const success = await recurringTaskRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Recurring Task', id);
      }

      await this.recordMetric('recurring_task.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteRecurringTask', ctx);
    }
  }

  async toggleRecurringTaskActive(id: string, context?: ServiceContext): Promise<RecurringTask> {
    const ctx = this.createContext(context);
    this.logOperation('toggleRecurringTaskActive', ctx, { recurringTaskId: id });

    try {
      const recurringTask = await recurringTaskRepository.findById(id);
      if (!recurringTask) {
        throw new NotFoundError('Recurring Task', id);
      }

      // Check permissions
      await this.verifyRecurringTaskAccess(recurringTask, ctx.userId!);

      // Toggle active status
      const updatedRecurringTask = await recurringTaskRepository.update(id, {
        active: !recurringTask.active,
        updatedAt: new Date()
      });

      if (!updatedRecurringTask) {
        throw new NotFoundError('Recurring Task', id);
      }

      // If the recurring task was activated, schedule the next task instance
      if (updatedRecurringTask.active) {
        await this.scheduleNextTaskInstance(updatedRecurringTask);
      }

      await this.recordMetric('recurring_task.toggled', 1, { 
        active: updatedRecurringTask.active ? 'true' : 'false'
      });

      return updatedRecurringTask;
    } catch (error) {
      this.handleError(error, 'toggleRecurringTaskActive', ctx);
    }
  }

  async processRecurringTasks(context?: ServiceContext): Promise<{ tasksCreated: number }> {
    const ctx = this.createContext(context);
    this.logOperation('processRecurringTasks', ctx);

    try {
      const now = new Date();

      // Find active recurring tasks that need to be processed
      const recurringTasks = await recurringTaskRepository.findMany({
        where: and(
          eq(recurringTaskRepository['table']?.active, true),
          lte(recurringTaskRepository['table']?.nextRunDate, now)
        ),
        limit: 1000
      });

      let tasksCreated = 0;

      // Process each recurring task
      for (const recurringTask of recurringTasks.data) {
        try {
          // Create a task instance from the recurring task
          await this.createTaskFromRecurringTask(recurringTask);

          // Calculate and update the next run date
          const nextRunDate = this.calculateNextRunDate(recurringTask);

          // If the recurring task has an end date and the next run date is after the end date,
          // deactivate the recurring task
          let updateData: any = { nextRunDate, updatedAt: new Date() };
          if (recurringTask.endDate && nextRunDate > recurringTask.endDate) {
            updateData.active = false;
            updateData.nextRunDate = null;
          }

          // Save the updated recurring task
          await recurringTaskRepository.update(recurringTask.id, updateData);

          tasksCreated++;
        } catch (error) {
          console.error(`Error processing recurring task ${recurringTask.id}:`, error);
        }
      }

      await this.recordMetric('recurring_task.processed', 1, { 
        tasksCreated: tasksCreated.toString()
      });

      return { tasksCreated };
    } catch (error) {
      this.handleError(error, 'processRecurringTasks', ctx);
    }
  }

  // Statistics
  async getRecurringTaskStats(
    filters: RecurringTaskFilters = {},
    context?: ServiceContext
  ): Promise<RecurringTaskStats> {
    const ctx = this.createContext(context);
    this.logOperation('getRecurringTaskStats', ctx, { filters });

    try {
      const whereConditions = this.buildRecurringTaskWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const allRecurringTasks = await recurringTaskRepository.findMany({
        where: whereConditions,
        limit: 10000
      });

      const recurringTasks = allRecurringTasks.data;
      const byFrequency: Record<string, number> = {};

      recurringTasks.forEach(task => {
        byFrequency[task.frequency] = (byFrequency[task.frequency] || 0) + 1;
      });

      // Get next due tasks
      const nextDue = recurringTasks
        .filter(task => task.active && task.nextRunDate)
        .sort((a, b) => a.nextRunDate!.getTime() - b.nextRunDate!.getTime())
        .slice(0, 10)
        .map(task => ({
          id: task.id,
          title: task.title,
          nextRunDate: task.nextRunDate!
        }));

      const stats: RecurringTaskStats = {
        total: recurringTasks.length,
        active: recurringTasks.filter(t => t.active).length,
        inactive: recurringTasks.filter(t => !t.active).length,
        byFrequency,
        tasksCreated: 0, // Would need to track this separately
        nextDue
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getRecurringTaskStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyRecurringTaskAccess(recurringTask: RecurringTask, userId: string): Promise<void> {
    // User can access recurring task if they are:
    // 1. The owner
    // 2. Have access to the project/workspace/team
    // 3. Admin
    
    if (recurringTask.userId === userId) {
      return;
    }

    // Check project/workspace/team access
    if (recurringTask.projectId && await this.hasProjectAccess(userId, recurringTask.projectId)) {
      return;
    }


    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this recurring task');
  }

  private async verifyProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    // Add project access check logic here
  }

  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }
    // Add workspace access check logic here
  }

  private async verifyTeamAccess(teamId: string, userId: string): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }
    // Add team access check logic here
  }

  private async hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const project = await projectRepository.findById(projectId);
    if (!project) return false;
    return project.ownerId === userId;
  }

  private async hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) return false;
    // Add workspace member check logic here
    return true; // Placeholder
  }

  private async hasTeamAccess(userId: string, teamId: string): Promise<boolean> {
    const team = await teamRepository.findById(teamId);
    if (!team) return false;
    // Add team member check logic here
    return true; // Placeholder
  }

  private buildRecurringTaskWhereConditions(filters: RecurringTaskFilters, userId: string, userRole?: string): any {
    const conditions = [];

    // Non-admin users can only see their own recurring tasks
    if (userRole !== 'admin' && !filters.userId) {
      conditions.push(eq(recurringTaskRepository['table']?.userId, userId));
    }

    if (filters.userId) {
      conditions.push(eq(recurringTaskRepository['table']?.userId, filters.userId));
    }

    if (filters.projectId) {
      conditions.push(eq(recurringTaskRepository['table']?.projectId, filters.projectId));
    }


    if (filters.frequency) {
      if (Array.isArray(filters.frequency)) {
        conditions.push(inArray(recurringTaskRepository['table']?.frequency, filters.frequency));
      } else {
        conditions.push(eq(recurringTaskRepository['table']?.frequency, filters.frequency));
      }
    }

    if (filters.active !== undefined) {
      conditions.push(eq(recurringTaskRepository['table']?.active, filters.active));
    }

    if (filters.createdFrom) {
      conditions.push(gte(recurringTaskRepository['table']?.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(recurringTaskRepository['table']?.createdAt, filters.createdTo));
    }

    if (filters.search) {
      conditions.push(or(
        ilike(recurringTaskRepository['table']?.title, `%${filters.search}%`),
        ilike(recurringTaskRepository['table']?.description, `%${filters.search}%`)
      ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateRecurringTaskData(data: RecurringTaskCreateData): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Recurring task title is required');
    }

    if (data.title.length > 200) {
      throw new ValidationError('Recurring task title must be less than 200 characters');
    }

    if (!data.frequency || !Object.values(RecurrenceFrequency).includes(data.frequency)) {
      throw new ValidationError('Valid frequency is required');
    }

    if (!data.interval || data.interval < 1 || data.interval > 365) {
      throw new ValidationError('Interval must be between 1 and 365');
    }

    if (!data.startDate) {
      throw new ValidationError('Start date is required');
    }

    if (data.endDate && data.endDate <= data.startDate) {
      throw new ValidationError('End date must be after start date');
    }

    if (!data.taskTemplate || !data.taskTemplate.title) {
      throw new ValidationError('Task template with title is required');
    }

    // Validate frequency-specific fields
    this.validateFrequencyFields(data);
  }

  private validateRecurringTaskUpdateData(data: RecurringTaskUpdateData): void {
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new ValidationError('Recurring task title is required');
      }
      if (data.title.length > 200) {
        throw new ValidationError('Recurring task title must be less than 200 characters');
      }
    }

    if (data.frequency && !Object.values(RecurrenceFrequency).includes(data.frequency)) {
      throw new ValidationError('Valid frequency is required');
    }

    if (data.interval !== undefined && (data.interval < 1 || data.interval > 365)) {
      throw new ValidationError('Interval must be between 1 and 365');
    }

    if (data.endDate && data.startDate && data.endDate <= data.startDate) {
      throw new ValidationError('End date must be after start date');
    }
  }

  private validateFrequencyFields(data: RecurringTaskCreateData | RecurringTaskUpdateData): void {
    if (!data.frequency) return;

    switch (data.frequency) {
      case RecurrenceFrequency.WEEKLY:
        if (!data.daysOfWeek || !Array.isArray(data.daysOfWeek) || data.daysOfWeek.length === 0) {
          throw new ValidationError('Days of week are required for weekly frequency');
        }
        if (data.daysOfWeek.some(day => day < 0 || day > 6)) {
          throw new ValidationError('Days of week must be between 0 (Sunday) and 6 (Saturday)');
        }
        break;

      case RecurrenceFrequency.MONTHLY:
        if (!data.daysOfMonth || !Array.isArray(data.daysOfMonth) || data.daysOfMonth.length === 0) {
          throw new ValidationError('Days of month are required for monthly frequency');
        }
        if (data.daysOfMonth.some(day => day < 1 || day > 31)) {
          throw new ValidationError('Days of month must be between 1 and 31');
        }
        break;

      case RecurrenceFrequency.YEARLY:
        if (!data.monthsOfYear || !Array.isArray(data.monthsOfYear) || data.monthsOfYear.length === 0) {
          throw new ValidationError('Months of year are required for yearly frequency');
        }
        if (data.monthsOfYear.some(month => month < 0 || month > 11)) {
          throw new ValidationError('Months of year must be between 0 (January) and 11 (December)');
        }
        break;
    }
  }

  private calculateNextRunDate(data: RecurringTaskCreateData | RecurringTask): Date {
    const now = new Date();
    let baseDate = data.startDate;
    
    // If we have a nextRunDate and it's in the future, use it as base
    if ('nextRunDate' in data && data.nextRunDate && data.nextRunDate > now) {
      baseDate = data.nextRunDate;
    } else if (baseDate < now) {
      baseDate = now;
    }

    const nextDate = new Date(baseDate);

    switch (data.frequency) {
      case RecurrenceFrequency.DAILY:
        nextDate.setDate(nextDate.getDate() + data.interval);
        break;

      case RecurrenceFrequency.WEEKLY:
        if (data.daysOfWeek && Array.isArray(data.daysOfWeek) && data.daysOfWeek.length > 0) {
          const sortedDays = [...data.daysOfWeek].sort((a, b) => a - b);
          const currentDayOfWeek = nextDate.getDay();
          const nextDayOfWeek = sortedDays.find((day) => day > currentDayOfWeek);

          if (nextDayOfWeek !== undefined) {
            nextDate.setDate(nextDate.getDate() + (nextDayOfWeek - currentDayOfWeek));
          } else {
            nextDate.setDate(nextDate.getDate() + (7 - currentDayOfWeek) + sortedDays[0]);
          }
        } else {
          nextDate.setDate(nextDate.getDate() + 7 * data.interval);
        }
        break;

      case RecurrenceFrequency.MONTHLY:
        if (data.daysOfMonth && Array.isArray(data.daysOfMonth) && data.daysOfMonth.length > 0) {
          const sortedDays = [...data.daysOfMonth].sort((a, b) => a - b);
          const currentDayOfMonth = nextDate.getDate();
          const nextDayOfMonth = sortedDays.find((day) => day > currentDayOfMonth);

          if (nextDayOfMonth !== undefined) {
            nextDate.setDate(nextDayOfMonth);
          } else {
            nextDate.setMonth(nextDate.getMonth() + data.interval);
            nextDate.setDate(sortedDays[0]);
          }
        } else {
          nextDate.setMonth(nextDate.getMonth() + data.interval);
        }
        break;

      case RecurrenceFrequency.YEARLY:
        if (data.monthsOfYear && Array.isArray(data.monthsOfYear) && data.monthsOfYear.length > 0) {
          const sortedMonths = [...data.monthsOfYear].sort((a, b) => a - b);
          const currentMonth = nextDate.getMonth();
          const nextMonth = sortedMonths.find((month) => month > currentMonth);

          if (nextMonth !== undefined) {
            nextDate.setMonth(nextMonth);
          } else {
            nextDate.setFullYear(nextDate.getFullYear() + data.interval);
            nextDate.setMonth(sortedMonths[0]);
          }
        } else {
          nextDate.setFullYear(nextDate.getFullYear() + data.interval);
        }
        break;
    }

    return nextDate;
  }

  private async scheduleNextTaskInstance(recurringTask: RecurringTask): Promise<void> {
    // If the recurring task doesn't have a next run date, calculate it
    if (!recurringTask.nextRunDate) {
      const nextRunDate = this.calculateNextRunDate(recurringTask);
      await recurringTaskRepository.update(recurringTask.id, { nextRunDate });
      return;
    }

    // If the next run date is in the past, create a task instance and update the next run date
    const now = new Date();
    if (recurringTask.nextRunDate <= now) {
      await this.createTaskFromRecurringTask(recurringTask);
      const nextRunDate = this.calculateNextRunDate(recurringTask);
      await recurringTaskRepository.update(recurringTask.id, { nextRunDate });
    }
  }

  private async createTaskFromRecurringTask(recurringTask: RecurringTask): Promise<any> {
    try {
      // Create task data from the recurring task's task template
      const template = recurringTask.taskTemplate as any;
      const taskData = {
        title: template.title || recurringTask.title,
        description: template.description || recurringTask.description,
        priority: template.priority || 'medium',
        estimatedHours: template.estimatedHours,
        tags: template.tags || [],
        projectId: recurringTask.projectId,
        creatorId: recurringTask.userId,
        assigneeId: recurringTask.userId, // Default to creator
        metadata: {
          recurringTaskId: recurringTask.id,
          generatedAt: new Date().toISOString()
        }
      };

      // Create the task using the task service
      const task = await taskService.createTask(taskData as any, {
        userId: recurringTask.userId,
        timestamp: new Date()
      });

      // Create notification for the new recurring task
      await notificationService.createNotification({
        userId: recurringTask.userId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Recurring Task Created',
        message: `A new task "${task.title}" has been created from your recurring task "${recurringTask.title}"`,
        data: {
          taskId: task.id,
          recurringTaskId: recurringTask.id
        }
      });

      return task;
    } catch (error) {
      console.error('Failed to create task from recurring task:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const recurringTaskService = new RecurringTaskService();
