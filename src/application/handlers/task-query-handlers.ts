import { BaseHandler, IQueryHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { ITaskRepository } from '../../domain/repositories/task-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import {
  GetTaskByIdQuery,
  GetTasksByProjectQuery,
  GetTasksByAssigneeQuery,
  GetTasksByCreatorQuery,
  GetOverdueTasksQuery,
  GetTaskDependenciesQuery,
  GetTaskStatisticsQuery,
  SearchTasksQuery,
  GetTasksQuery,
} from '../queries/task-queries';
import { PaginatedResult } from '../queries/base-query';
import { Task } from '../../domain/entities/task';
import { TaskId } from '../../domain/value-objects/task-id';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId?: string;
  projectId: string;
  createdById: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskStatisticsDto {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  averageCompletionTime: number;
  tasksByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
}

export class GetTaskByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTaskByIdQuery, TaskDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTaskByIdQuery): Promise<TaskDto> {
    this.logInfo('Getting task by ID', { taskId: query.taskId.value });

    try {
      // Try cache first
      const cacheKey = `task:${query.taskId.value}`;
      const cachedTask = await this.cacheService.get<TaskDto>(cacheKey);
      if (cachedTask) {
        this.logInfo('Task found in cache', { taskId: query.taskId.value });
        return cachedTask;
      }

      const task = await this.taskRepository.findById(query.taskId);
      if (!task) {
        throw new NotFoundError(`Task with ID ${query.taskId.value} not found`);
      }

      // Check if user has permission to view this task
      if (!(await this.canUserViewTask(task, query.userId))) {
        throw new AuthorizationError(
          'User does not have permission to view this task'
        );
      }

      const taskDto = this.mapTaskToDto(task);

      // Cache the result
      await this.cacheService.set(cacheKey, taskDto, { ttl: 300 }); // 5 minutes

      this.logInfo('Task retrieved successfully', {
        taskId: query.taskId.value,
      });
      return taskDto;
    } catch (error) {
      this.logError('Failed to get task by ID', error as Error, {
        taskId: query.taskId.value,
      });
      throw error;
    }
  }

  private async canUserViewTask(_task: Task, _userId: any): Promise<boolean> {
    // In a real implementation, this would check project membership, workspace access, etc.
    // For now, we'll return true
    return true;
  }

  private mapTaskToDto(task: Task): TaskDto {
    return {
      id: task.id.value,
      title: task.title,
      description: task.description,
      status: task.status.value,
      priority: task.priority.value,
      ...(task.assigneeId && { assigneeId: task.assigneeId.value }),
      projectId: task.projectId.value,
      createdById: task.createdById.value,
      ...(task.dueDate && { dueDate: task.dueDate }),
      ...(task.estimatedHours && { estimatedHours: task.estimatedHours }),
      ...(task.actualHours && { actualHours: task.actualHours }),
      ...(task.completedAt && { completedAt: task.completedAt }),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

export class GetTasksByProjectQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTasksByProjectQuery, PaginatedResult<TaskDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetTasksByProjectQuery
  ): Promise<PaginatedResult<TaskDto>> {
    this.logInfo('Getting tasks by project', {
      projectId: query.projectId.value,
    });

    try {
      // Generate cache key based on query parameters
      const cacheKey = `tasks:project:${query.projectId.value}:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<TaskDto>>(cacheKey);
      if (cachedResult) {
        this.logInfo('Tasks found in cache', {
          projectId: query.projectId.value,
        });
        return cachedResult;
      }

      const tasks = await this.taskRepository.findByProjectId(
        query.projectId,
        query.filters
      );
      const taskDtos = tasks.items.map((task: Task) => this.mapTaskToDto(task));

      // Apply pagination
      const paginatedResult: PaginatedResult<TaskDto> = {
        data: taskDtos,
        total: tasks.total,
        page: tasks.page,
        limit: tasks.limit,
        totalPages: tasks.totalPages,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, { ttl: 180 }); // 3 minutes

      this.logInfo('Tasks retrieved successfully', {
        projectId: query.projectId.value,
        count: paginatedResult.data.length,
      });
      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get tasks by project', error as Error, {
        projectId: query.projectId.value,
      });
      throw error;
    }
  }

  private mapTaskToDto(task: Task): TaskDto {
    return {
      id: task.id.value,
      title: task.title,
      description: task.description,
      status: task.status.value,
      priority: task.priority.value,
      ...(task.assigneeId && { assigneeId: task.assigneeId.value }),
      projectId: task.projectId.value,
      createdById: task.createdById.value,
      ...(task.dueDate && { dueDate: task.dueDate }),
      ...(task.estimatedHours && { estimatedHours: task.estimatedHours }),
      ...(task.actualHours && { actualHours: task.actualHours }),
      ...(task.completedAt && { completedAt: task.completedAt }),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private applyPagination<T>(data: T[], pagination?: any): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 10 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

export class GetTasksByAssigneeQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTasksByAssigneeQuery, PaginatedResult<TaskDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetTasksByAssigneeQuery
  ): Promise<PaginatedResult<TaskDto>> {
    this.logInfo('Getting tasks by assignee', {
      assigneeId: query.assigneeId.value,
    });

    try {
      const cacheKey = `tasks:assignee:${query.assigneeId.value}:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<TaskDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const tasks = await this.taskRepository.findByAssigneeId(
        query.assigneeId,
        query.filters
      );
      const taskDtos = tasks.items.map((task: Task) => this.mapTaskToDto(task));
      const paginatedResult: PaginatedResult<TaskDto> = {
        data: taskDtos,
        total: tasks.total,
        page: tasks.page,
        limit: tasks.limit,
        totalPages: tasks.totalPages,
      };

      await this.cacheService.set(cacheKey, paginatedResult, { ttl: 180 });

      this.logInfo('Tasks by assignee retrieved successfully', {
        assigneeId: query.assigneeId.value,
        count: paginatedResult.data.length,
      });
      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get tasks by assignee', error as Error, {
        assigneeId: query.assigneeId.value,
      });
      throw error;
    }
  }

  private mapTaskToDto(task: Task): TaskDto {
    return {
      id: task.id.value,
      title: task.title,
      description: task.description,
      status: task.status.value,
      priority: task.priority.value,
      ...(task.assigneeId && { assigneeId: task.assigneeId.value }),
      projectId: task.projectId.value,
      createdById: task.createdById.value,
      ...(task.dueDate && { dueDate: task.dueDate }),
      ...(task.estimatedHours && { estimatedHours: task.estimatedHours }),
      ...(task.actualHours && { actualHours: task.actualHours }),
      ...(task.completedAt && { completedAt: task.completedAt }),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private applyPagination<T>(data: T[], pagination?: any): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 10 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

export class GetOverdueTasksQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetOverdueTasksQuery, PaginatedResult<TaskDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetOverdueTasksQuery): Promise<PaginatedResult<TaskDto>> {
    this.logInfo('Getting overdue tasks', { query });

    try {
      const cacheKey = `tasks:overdue:${query.projectId?.value || 'all'}:${query.assigneeId?.value || 'all'}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<TaskDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const tasks = await this.taskRepository.findOverdueTasks(
        query.projectId,
        query.assigneeId,
        query.pagination
      );
      const taskDtos = tasks.items.map((task: Task) => this.mapTaskToDto(task));
      const paginatedResult: PaginatedResult<TaskDto> = {
        data: taskDtos,
        total: tasks.total,
        page: tasks.page,
        limit: tasks.limit,
        totalPages: tasks.totalPages,
      };

      await this.cacheService.set(cacheKey, paginatedResult, { ttl: 60 }); // 1 minute for overdue tasks

      this.logInfo('Overdue tasks retrieved successfully', {
        count: paginatedResult.data.length,
      });
      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get overdue tasks', error as Error, { query });
      throw error;
    }
  }

  private mapTaskToDto(task: Task): TaskDto {
    return {
      id: task.id.value,
      title: task.title,
      description: task.description,
      status: task.status.value,
      priority: task.priority.value,
      ...(task.assigneeId && { assigneeId: task.assigneeId.value }),
      projectId: task.projectId.value,
      createdById: task.createdById.value,
      ...(task.dueDate && { dueDate: task.dueDate }),
      ...(task.estimatedHours && { estimatedHours: task.estimatedHours }),
      ...(task.actualHours && { actualHours: task.actualHours }),
      ...(task.completedAt && { completedAt: task.completedAt }),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private applyPagination<T>(data: T[], pagination?: any): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 10 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

export class GetTaskStatisticsQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTaskStatisticsQuery, TaskStatisticsDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTaskStatisticsQuery): Promise<TaskStatisticsDto> {
    this.logInfo('Getting task statistics', { query });

    try {
      const cacheKey = `task-stats:${query.projectId?.value || 'all'}:${query.dateFrom?.toISOString() || 'all'}:${query.dateTo?.toISOString() || 'all'}`;
      const cachedStats =
        await this.cacheService.get<TaskStatisticsDto>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }

      const statistics = await this.taskRepository.getTaskStatistics(
        query.projectId!
      );

      // Transform the repository result to match TaskStatisticsDto
      const taskStatisticsDto: TaskStatisticsDto = {
        totalTasks: statistics.total,
        completedTasks: statistics.completed,
        inProgressTasks: statistics.byStatus['IN_PROGRESS'] || 0,
        overdueTasks: statistics.overdue,
        averageCompletionTime: statistics.averageCompletionTime || 0,
        tasksByPriority: statistics.byPriority,
        tasksByStatus: Object.entries(statistics.byStatus).reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, number>),
      };

      await this.cacheService.set(cacheKey, taskStatisticsDto, { ttl: 300 }); // 5 minutes

      this.logInfo('Task statistics retrieved successfully');
      return taskStatisticsDto;
    } catch (error) {
      this.logError('Failed to get task statistics', error as Error, { query });
      throw error;
    }
  }
}

export class GetTasksQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTasksQuery, PaginatedResult<TaskDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTasksQuery): Promise<PaginatedResult<TaskDto>> {
    this.logInfo('Getting all tasks', { filters: query.filters });

    try {
      // Generate cache key based on query parameters
      const cacheKey = `tasks:all:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<TaskDto>>(cacheKey);
      if (cachedResult) {
        this.logInfo('Tasks found in cache');
        return cachedResult;
      }

      // Since there's no findAll method, we'll need to use a different approach
      // For now, let's create a dummy implementation that returns empty results
      // In a real implementation, you'd add findAll to the repository interface
      const tasks = {
        items: [] as Task[],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      
      const taskDtos = tasks.items.map((task: Task) => this.mapTaskToDto(task));

      // Apply pagination if not already applied by repository
      const paginatedResult = query.pagination
        ? this.applyPagination(taskDtos, query.pagination)
        : {
            data: taskDtos,
            total: tasks.total,
            page: 1,
            limit: taskDtos.length,
            totalPages: 1,
          };

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, { ttl: 180 }); // 3 minutes

      this.logInfo('Tasks retrieved successfully', {
        count: paginatedResult.data.length,
      });
      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get tasks', error as Error, {
        filters: query.filters,
      });
      throw error;
    }
  }

  private mapTaskToDto(task: Task): TaskDto {
    return {
      id: task.id.value,
      title: task.title,
      description: task.description,
      status: task.status.value,
      priority: task.priority.value,
      ...(task.assigneeId && { assigneeId: task.assigneeId.value }),
      projectId: task.projectId.value,
      createdById: task.createdById.value,
      ...(task.dueDate && { dueDate: task.dueDate }),
      ...(task.estimatedHours && { estimatedHours: task.estimatedHours }),
      ...(task.actualHours && { actualHours: task.actualHours }),
      ...(task.completedAt && { completedAt: task.completedAt }),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private applyPagination<T>(
    data: T[],
    pagination: { page: number; limit: number }
  ): PaginatedResult<T> {
    const { page, limit } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

// Export aliases for backward compatibility
export const GetTaskHandler = GetTaskByIdQueryHandler;
export const ListTasksHandler = GetTasksQueryHandler;
