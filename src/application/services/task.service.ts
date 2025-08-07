import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { taskRepository, projectRepository, userRepository, notificationRepository } from '../db/repositories';
import { Task, NewTask } from '../db/schema/tasks';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';

// Define enums based on schema
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  projectId?: string;
  assigneeId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
  tags?: string[];
  search?: string;
}

export interface TaskCreateData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  tags?: string[];
}

export interface TaskUpdateData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
}

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  completed: number;
  cancelled: number;
  overdue: number;
  highPriority: number;
}

export interface BulkTaskOperation {
  taskIds: string[];
  operation: 'update_status' | 'update_priority' | 'assign' | 'move_project' | 'add_tags' | 'delete';
  data?: any;
}

export class TaskService extends BaseService {
  constructor() {
    super('TaskService', {
      enableCache: true,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createTask(data: TaskCreateData, context?: ServiceContext): Promise<Task> {
    const ctx = this.createContext(context);
    this.logOperation('createTask', ctx, { title: data.title, projectId: data.projectId });

    try {
      // Validate input
      this.validateTaskData(data);

      // Verify project exists if provided
      if (data.projectId) {
        const project = await projectRepository.findById(data.projectId);
        if (!project) {
          throw new NotFoundError('Project', data.projectId);
        }
      }

      // Verify assignee exists if provided
      if (data.assigneeId) {
        const assignee = await userRepository.findById(data.assigneeId);
        if (!assignee) {
          throw new NotFoundError('User', data.assigneeId);
        }
      }

      // Create task
      const newTask: NewTask = {
        ...data,
        creatorId: ctx.userId!,
        status: data.status || TaskStatus.TODO,
        priority: data.priority || TaskPriority.MEDIUM,
        tags: data.tags || []
      };

      const task = await taskRepository.create(newTask);

      // Create notification if task is assigned to someone else
      if (data.assigneeId && data.assigneeId !== ctx.userId) {
        await this.createTaskAssignmentNotification(task.id, data.assigneeId, ctx.userId!);
      }

      // Create notification if due date is soon
      if (data.dueDate && this.isDueSoon(data.dueDate)) {
        await this.createTaskDueSoonNotification(task.id, data.assigneeId || ctx.userId!, data.dueDate);
      }

      await this.recordMetric('task.created', 1, { 
        status: task.status, 
        priority: task.priority,
        hasProject: task.projectId ? 'true' : 'false',
        hasAssignee: task.assigneeId ? 'true' : 'false'
      });

      return task;
    } catch (error) {
      this.handleError(error, 'createTask', ctx);
    }
  }

  async getTaskById(id: string, context?: ServiceContext): Promise<Task> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskById', ctx, { taskId: id });

    try {
      const task = await taskRepository.findById(id);
      if (!task) {
        throw new NotFoundError('Task', id);
      }

      // Check access permissions
      await this.verifyTaskAccess(task, ctx.userId!);

      return task;
    } catch (error) {
      this.handleError(error, 'getTaskById', ctx);
    }
  }

  async getTasks(
    filters: TaskFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Task>> {
    const ctx = this.createContext(context);
    this.logOperation('getTasks', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildTaskWhereConditions(filters, ctx.userId!);
      
      const result = await taskRepository.findMany({
        ...paginationOptions,
        where: whereConditions
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getTasks', ctx);
    }
  }

  async updateTask(id: string, data: TaskUpdateData, context?: ServiceContext): Promise<Task> {
    const ctx = this.createContext(context);
    this.logOperation('updateTask', ctx, { taskId: id, updates: Object.keys(data) });

    try {
      const existingTask = await taskRepository.findById(id);
      if (!existingTask) {
        throw new NotFoundError('Task', id);
      }

      // Check permissions
      await this.verifyTaskAccess(existingTask, ctx.userId!);

      // Validate updates
      this.validateTaskUpdateData(data);

      // Check if status is being changed to completed
      const isCompleting = data.status === TaskStatus.COMPLETED && existingTask.status !== TaskStatus.COMPLETED;
      
      // Update completion timestamp if completing
      const updateData = {
        ...data,
        ...(isCompleting && { completedAt: new Date() }),
        updatedAt: new Date()
      };

      const updatedTask = await taskRepository.update(id, updateData);
      if (!updatedTask) {
        throw new NotFoundError('Task', id);
      }

      // Create notifications for status changes
      if (isCompleting) {
        await this.createTaskCompletedNotification(id, updatedTask.assigneeId || updatedTask.creatorId);
      }

      // Create notification if task is reassigned
      if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
        await this.createTaskAssignmentNotification(id, data.assigneeId, ctx.userId!);
      }

      await this.recordMetric('task.updated', 1, { 
        statusChanged: data.status !== undefined ? 'true' : 'false',
        priorityChanged: data.priority !== undefined ? 'true' : 'false',
        completed: isCompleting ? 'true' : 'false'
      });

      return updatedTask;
    } catch (error) {
      this.handleError(error, 'updateTask', ctx);
    }
  }

  async deleteTask(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteTask', ctx, { taskId: id });

    try {
      const task = await taskRepository.findById(id);
      if (!task) {
        throw new NotFoundError('Task', id);
      }

      // Check permissions - only creator or admin can delete
      if (task.creatorId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('Only the task creator or admin can delete this task');
      }

      const success = await taskRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Task', id);
      }

      await this.recordMetric('task.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteTask', ctx);
    }
  }

  // Bulk Operations
  async bulkUpdateTasks(operation: BulkTaskOperation, context?: ServiceContext): Promise<{ updated: number; failed: string[] }> {
    const ctx = this.createContext(context);
    this.logOperation('bulkUpdateTasks', ctx, { operation: operation.operation, count: operation.taskIds.length });

    try {
      const results = { updated: 0, failed: [] as string[] };

      for (const taskId of operation.taskIds) {
        try {
          const task = await taskRepository.findById(taskId);
          if (!task) {
            results.failed.push(taskId);
            continue;
          }

          // Check permissions
          await this.verifyTaskAccess(task, ctx.userId!);

          // Apply operation
          let updateData: any = {};
          switch (operation.operation) {
            case 'update_status':
              updateData.status = operation.data.status;
              if (operation.data.status === TaskStatus.COMPLETED) {
                updateData.completedAt = new Date();
              }
              break;
            case 'update_priority':
              updateData.priority = operation.data.priority;
              break;
            case 'assign':
              updateData.assigneeId = operation.data.assigneeId;
              break;
            case 'move_project':
              updateData.projectId = operation.data.projectId;
              break;
            case 'add_tags':
              updateData.tags = [...(task.tags as string[] || []), ...operation.data.tags];
              break;
            case 'delete':
              await taskRepository.delete(taskId);
              results.updated++;
              continue;
          }

          if (Object.keys(updateData).length > 0) {
            await taskRepository.update(taskId, updateData);
            results.updated++;
          }
        } catch (error) {
          results.failed.push(taskId);
        }
      }

      await this.recordMetric('task.bulk_operation', 1, { 
        operation: operation.operation,
        updated: results.updated.toString(),
        failed: results.failed.length.toString()
      });

      return results;
    } catch (error) {
      this.handleError(error, 'bulkUpdateTasks', ctx);
    }
  }

  // Analytics and Statistics
  async getTaskStats(filters: TaskFilters = {}, context?: ServiceContext): Promise<TaskStats> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskStats', ctx, filters);

    try {
      // For now, return basic stats - this would be enhanced with actual repository methods
      const whereConditions = this.buildTaskWhereConditions(filters, ctx.userId!);
      
      // Get all tasks matching the conditions
      const allTasks = await taskRepository.findMany({
        where: whereConditions,
        limit: 10000 // Large limit to get all tasks for stats
      });

      const tasks = allTasks.data;
      const now = new Date();

      const stats: TaskStats = {
        total: tasks.length,
        todo: tasks.filter(t => t.status === TaskStatus.TODO).length,
        inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
        review: tasks.filter(t => t.status === TaskStatus.REVIEW).length,
        completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED).length,
        overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED).length,
        highPriority: tasks.filter(t => t.priority === TaskPriority.HIGH || t.priority === TaskPriority.URGENT).length
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getTaskStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyTaskAccess(task: Task, userId: string): Promise<void> {
    // User can access task if they are:
    // 1. The creator
    // 2. The assignee
    // 3. Have access to the project (if task belongs to a project)
    // 4. Admin
    
    if (task.creatorId === userId || task.assigneeId === userId) {
      return;
    }

    if (task.projectId && await this.hasProjectAccess(userId, task.projectId)) {
      return;
    }

    // Check if user is admin (would need to get user role)
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this task');
  }

  private async hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const project = await projectRepository.findById(projectId);
    if (!project) return false;

    // Check if user is project owner
    return project.ownerId === userId;
  }

  private buildTaskWhereConditions(filters: TaskFilters, userId: string): any {
    // For now, return a simple condition - this would be enhanced with proper table access
    // The repository layer should handle the complex filtering
    return undefined; // Let the repository handle filtering
  }

  private validateTaskData(data: TaskCreateData): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Task title is required');
    }

    if (data.title.length > 500) {
      throw new ValidationError('Task title must be less than 500 characters');
    }

    if (data.description && data.description.length > 5000) {
      throw new ValidationError('Task description must be less than 5000 characters');
    }

    if (data.estimatedHours && (data.estimatedHours < 0 || data.estimatedHours > 1000)) {
      throw new ValidationError('Estimated hours must be between 0 and 1000');
    }

    if (data.dueDate && data.dueDate < new Date()) {
      throw new ValidationError('Due date cannot be in the past');
    }
  }

  private validateTaskUpdateData(data: TaskUpdateData): void {
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new ValidationError('Task title is required');
      }
      if (data.title.length > 500) {
        throw new ValidationError('Task title must be less than 500 characters');
      }
    }

    if (data.description !== undefined && data.description && data.description.length > 5000) {
      throw new ValidationError('Task description must be less than 5000 characters');
    }

    if (data.estimatedHours !== undefined && data.estimatedHours && (data.estimatedHours < 0 || data.estimatedHours > 1000)) {
      throw new ValidationError('Estimated hours must be between 0 and 1000');
    }

    if (data.actualHours !== undefined && data.actualHours && (data.actualHours < 0 || data.actualHours > 1000)) {
      throw new ValidationError('Actual hours must be between 0 and 1000');
    }
  }

  private isDueSoon(dueDate: Date): boolean {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    return dueDate <= threeDaysFromNow;
  }

  private async createTaskAssignmentNotification(taskId: string, assigneeId: string, assignerId: string): Promise<void> {
    try {
      const task = await taskRepository.findById(taskId);
      const assigner = await userRepository.findById(assignerId);
      
      if (task && assigner) {
        await notificationRepository.create({
          userId: assigneeId,
          type: 'task_assigned',
          title: 'New Task Assignment',
          message: `${assigner.firstName || assigner.email} assigned you a task: "${task.title}"`,
          data: { taskId, assignerId },
          isRead: false
        });
      }
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to create task assignment notification:', error);
    }
  }

  private async createTaskDueSoonNotification(taskId: string, userId: string, dueDate: Date): Promise<void> {
    try {
      const task = await taskRepository.findById(taskId);
      
      if (task) {
        await notificationRepository.create({
          userId,
          type: 'task_due_soon',
          title: 'Task Due Soon',
          message: `Task "${task.title}" is due on ${dueDate.toLocaleDateString()}`,
          data: { taskId, dueDate: dueDate.toISOString() },
          isRead: false
        });
      }
    } catch (error) {
      console.error('Failed to create task due soon notification:', error);
    }
  }

  private async createTaskCompletedNotification(taskId: string, userId: string): Promise<void> {
    try {
      const task = await taskRepository.findById(taskId);
      
      if (task) {
        await notificationRepository.create({
          userId,
          type: 'task_completed',
          title: 'Task Completed',
          message: `Task "${task.title}" has been completed`,
          data: { taskId },
          isRead: false
        });
      }
    } catch (error) {
      console.error('Failed to create task completed notification:', error);
    }
  }
}

// Export singleton instance
export const taskService = new TaskService();
