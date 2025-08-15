import { NotFoundError } from '@project/core/errors/not-found-error';
import { Task } from '@project/domain/entities/task';
import { DomainEventPublisher } from '@project/domain/events/domain-event-publisher';
import { ITaskRepository } from '@project/domain/repositories/task-repository';
import { CacheService } from '@project/infrastructure/caching/cache-service';
import { LoggingService } from '@project/infrastructure/monitoring/logging-service';
import {
    GetTaskByIdQuery,
    GetTasksByAssigneeQuery,
    GetTasksByProjectQuery,
    GetTasksQuery,
    PaginatedResult,
} from '../queries/task-queries';
import { BaseHandler, IQueryHandler } from './base-handler';

export class GetTaskByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTaskByIdQuery, Task>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTaskByIdQuery): Promise<Task> {
    this.logInfo('Getting task by ID', { query });

    try {
      // Try cache first
      const cacheKey = `task:${query.taskId.value}`;
      const cached = await this.cacheService.get<Task>(cacheKey);
      if (cached) {
        return cached;
      }

      const task = await this.taskRepository.findById(query.taskId);
      if (!task) {
        throw new NotFoundError(`Task with ID ${query.taskId.value} not found`);
      }

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, task, 300);

      return task;
    } catch (error) {
      this.logError('Failed to get task by ID', error as Error, { query });
      throw error;
    }
  }
}

export class GetTasksByProjectQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTasksByProjectQuery, PaginatedResult<Task>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTasksByProjectQuery): Promise<PaginatedResult<Task>> {
    this.logInfo('Getting tasks by project', { query });

    try {
      // Create cache key based on query parameters
      const cacheKey = `tasks:project:${query.projectId.value}:${JSON.stringify({
        filters: query.filters,
        pagination: query.pagination,
      })}`;

      const cached = await this.cacheService.get<PaginatedResult<Task>>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.taskRepository.findByProject(
        query.projectId,
        query.filters,
        query.pagination
      );

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, result, 120);

      return result;
    } catch (error) {
      this.logError('Failed to get tasks by project', error as Error, { query });
      throw error;
    }
  }
}

export class GetTasksByAssigneeQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTasksByAssigneeQuery, PaginatedResult<Task>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTasksByAssigneeQuery): Promise<PaginatedResult<Task>> {
    this.logInfo('Getting tasks by assignee', { query });

    try {
      const cacheKey = `tasks:assignee:${query.assigneeId.value}:${JSON.stringify({
        filters: query.filters,
        pagination: query.pagination,
      })}`;

      const cached = await this.cacheService.get<PaginatedResult<Task>>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.taskRepository.findByAssignee(
        query.assigneeId,
        query.filters,
        query.pagination
      );

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, result, 120);

      return result;
    } catch (error) {
      this.logError('Failed to get tasks by assignee', error as Error, { query });
      throw error;
    }
  }
}

export class GetTasksQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetTasksQuery, PaginatedResult<Task>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetTasksQuery): Promise<PaginatedResult<Task>> {
    this.logInfo('Getting tasks', { query });

    try {
      const cacheKey = `tasks:all:${JSON.stringify({
        filters: query.filters,
        pagination: query.pagination,
        userId: query.userId.value,
      })}`;

      const cached = await this.cacheService.get<PaginatedResult<Task>>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.taskRepository.findAll(
        query.filters,
        query.pagination
      );

      // Cache for 1 minute
      await this.cacheService.set(cacheKey, result, 60);

      return result;
    } catch (error) {
      this.logError('Failed to get tasks', error as Error, { query });
      throw error;
    }
  }
}