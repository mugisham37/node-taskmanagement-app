/**
 * Task Query Handlers
 *
 * This module contains all query handlers for task management read operations.
 * Query handlers are optimized for data retrieval and provide read-only access to task data.
 */

import { QueryHandler, PaginatedResult } from '../query';
import {
  GetTaskByIdQuery,
  GetTasksQuery,
  GetTasksByProjectQuery,
  GetTasksByAssigneeQuery,
  GetTaskStatsQuery,
  SearchTasksQuery,
  GetOverdueTasksQuery,
  GetTasksWithUpcomingDueDatesQuery,
  GetTaskHistoryQuery,
  GetTaskDependenciesQuery,
  TaskStats,
  TaskWithDetails,
  TaskHistoryEntry,
  TaskDependency,
} from '../queries/task-queries';
import { Task } from '@/domains/task-management/entities/task';
import { ITaskRepository } from '@/domains/task-management/repositories/task-repository';
import { ITaskReadRepository } from '@/domains/task-management/repositories/task-read-repository';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';
import { NotFoundError, ForbiddenError } from '@/shared/errors/app-error';

@injectable()
export class GetTaskByIdQueryHandler extends QueryHandler<
  GetTaskByIdQuery,
  TaskWithDetails
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTaskByIdQuery';
  }

  async handle(query: GetTaskByIdQuery): Promise<TaskWithDetails> {
    this.logger.debug('Getting task by ID', {
      taskId: query.taskId,
      userId: query.userId,
    });

    const task = await this.taskReadRepository.findByIdWithDetails(
      query.taskId
    );
    if (!task) {
      throw new NotFoundError('Task', query.taskId);
    }

    // Check access permissions
    if (query.userId && !this.canAccessTask(task, query.userId)) {
      throw new ForbiddenError('You do not have access to this task');
    }

    return task;
  }

  private canAccessTask(task: TaskWithDetails, userId: string): boolean {
    // User can access task if they are:
    // 1. The creator
    // 2. The assignee
    // 3. Have access to the project (simplified check)
    return task.creatorId === userId || task.assigneeId === userId;
  }
}

@injectable()
export class GetTasksQueryHandler extends QueryHandler<
  GetTasksQuery,
  PaginatedResult<TaskWithDetails>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTasksQuery';
  }

  async handle(
    query: GetTasksQuery
  ): Promise<PaginatedResult<TaskWithDetails>> {
    this.logger.debug('Getting tasks with filters', {
      filters: query.filters,
      pagination: query.pagination,
      userId: query.userId,
    });

    // Add user context to filters if needed
    const filters = { ...query.filters };
    if (query.userId && !this.isAdminUser(query.userId)) {
      // Non-admin users can only see tasks they created or are assigned to
      filters.userContext = query.userId;
    }

    const result = await this.taskReadRepository.findManyWithDetails(
      filters,
      query.pagination
    );

    this.logger.debug('Tasks retrieved', {
      count: result.data.length,
      total: result.total,
      userId: query.userId,
    });

    return result;
  }

  private isAdminUser(userId: string): boolean {
    // This would typically check user roles from a user service
    // For now, simplified implementation
    return false;
  }
}

@injectable()
export class GetTasksByProjectQueryHandler extends QueryHandler<
  GetTasksByProjectQuery,
  PaginatedResult<TaskWithDetails>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTasksByProjectQuery';
  }

  async handle(
    query: GetTasksByProjectQuery
  ): Promise<PaginatedResult<TaskWithDetails>> {
    this.logger.debug('Getting tasks by project', {
      projectId: query.projectId,
      filters: query.filters,
      pagination: query.pagination,
      userId: query.userId,
    });

    const filters = { ...query.filters, projectId: query.projectId };

    // Add user context if needed
    if (query.userId && !this.isAdminUser(query.userId)) {
      filters.userContext = query.userId;
    }

    const result = await this.taskReadRepository.findManyWithDetails(
      filters,
      query.pagination
    );

    return result;
  }

  private isAdminUser(userId: string): boolean {
    return false; // Simplified implementation
  }
}

@injectable()
export class GetTasksByAssigneeQueryHandler extends QueryHandler<
  GetTasksByAssigneeQuery,
  PaginatedResult<TaskWithDetails>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTasksByAssigneeQuery';
  }

  async handle(
    query: GetTasksByAssigneeQuery
  ): Promise<PaginatedResult<TaskWithDetails>> {
    this.logger.debug('Getting tasks by assignee', {
      assigneeId: query.assigneeId,
      filters: query.filters,
      pagination: query.pagination,
      userId: query.userId,
    });

    const filters = { ...query.filters, assigneeId: query.assigneeId };

    // Check permissions - users can only see their own assigned tasks unless admin
    if (
      query.userId &&
      query.assigneeId !== query.userId &&
      !this.isAdminUser(query.userId)
    ) {
      throw new ForbiddenError('You can only view your own assigned tasks');
    }

    const result = await this.taskReadRepository.findManyWithDetails(
      filters,
      query.pagination
    );

    return result;
  }

  private isAdminUser(userId: string): boolean {
    return false; // Simplified implementation
  }
}

@injectable()
export class GetTaskStatsQueryHandler extends QueryHandler<
  GetTaskStatsQuery,
  TaskStats
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTaskStatsQuery';
  }

  async handle(query: GetTaskStatsQuery): Promise<TaskStats> {
    this.logger.debug('Getting task statistics', {
      filters: query.filters,
      userId: query.userId,
    });

    const filters = { ...query.filters };
    if (query.userId && !this.isAdminUser(query.userId)) {
      filters.userContext = query.userId;
    }

    const stats = await this.taskReadRepository.getTaskStats(filters);

    return stats;
  }

  private isAdminUser(userId: string): boolean {
    return false; // Simplified implementation
  }
}

@injectable()
export class SearchTasksQueryHandler extends QueryHandler<
  SearchTasksQuery,
  PaginatedResult<TaskWithDetails>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'SearchTasksQuery';
  }

  async handle(
    query: SearchTasksQuery
  ): Promise<PaginatedResult<TaskWithDetails>> {
    this.logger.debug('Searching tasks', {
      searchTerm: query.searchTerm,
      filters: query.filters,
      pagination: query.pagination,
      userId: query.userId,
    });

    const filters = { ...query.filters, search: query.searchTerm };
    if (query.userId && !this.isAdminUser(query.userId)) {
      filters.userContext = query.userId;
    }

    const result = await this.taskReadRepository.searchTasks(
      query.searchTerm,
      filters,
      query.pagination
    );

    return result;
  }

  private isAdminUser(userId: string): boolean {
    return false; // Simplified implementation
  }
}

@injectable()
export class GetOverdueTasksQueryHandler extends QueryHandler<
  GetOverdueTasksQuery,
  PaginatedResult<TaskWithDetails>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetOverdueTasksQuery';
  }

  async handle(
    query: GetOverdueTasksQuery
  ): Promise<PaginatedResult<TaskWithDetails>> {
    this.logger.debug('Getting overdue tasks', {
      assigneeId: query.assigneeId,
      projectId: query.projectId,
      pagination: query.pagination,
      userId: query.userId,
    });

    const filters: any = {
      overdue: true,
    };

    if (query.assigneeId) {
      filters.assigneeId = query.assigneeId;
    }

    if (query.projectId) {
      filters.projectId = query.projectId;
    }

    if (query.userId && !this.isAdminUser(query.userId)) {
      filters.userContext = query.userId;
    }

    const result = await this.taskReadRepository.findManyWithDetails(
      filters,
      query.pagination
    );

    return result;
  }

  private isAdminUser(userId: string): boolean {
    return false; // Simplified implementation
  }
}

@injectable()
export class GetTasksWithUpcomingDueDatesQueryHandler extends QueryHandler<
  GetTasksWithUpcomingDueDatesQuery,
  PaginatedResult<TaskWithDetails>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTasksWithUpcomingDueDatesQuery';
  }

  async handle(
    query: GetTasksWithUpcomingDueDatesQuery
  ): Promise<PaginatedResult<TaskWithDetails>> {
    this.logger.debug('Getting tasks with upcoming due dates', {
      daysAhead: query.daysAhead,
      assigneeId: query.assigneeId,
      projectId: query.projectId,
      pagination: query.pagination,
      userId: query.userId,
    });

    const filters: any = {
      upcomingDueDays: query.daysAhead,
    };

    if (query.assigneeId) {
      filters.assigneeId = query.assigneeId;
    }

    if (query.projectId) {
      filters.projectId = query.projectId;
    }

    if (query.userId && !this.isAdminUser(query.userId)) {
      filters.userContext = query.userId;
    }

    const result = await this.taskReadRepository.findManyWithDetails(
      filters,
      query.pagination
    );

    return result;
  }

  private isAdminUser(userId: string): boolean {
    return false; // Simplified implementation
  }
}

@injectable()
export class GetTaskHistoryQueryHandler extends QueryHandler<
  GetTaskHistoryQuery,
  PaginatedResult<TaskHistoryEntry>
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTaskHistoryQuery';
  }

  async handle(
    query: GetTaskHistoryQuery
  ): Promise<PaginatedResult<TaskHistoryEntry>> {
    this.logger.debug('Getting task history', {
      taskId: query.taskId,
      pagination: query.pagination,
      userId: query.userId,
    });

    // Check if user has access to the task
    const task = await this.taskReadRepository.findByIdWithDetails(
      query.taskId
    );
    if (!task) {
      throw new NotFoundError('Task', query.taskId);
    }

    if (query.userId && !this.canAccessTask(task, query.userId)) {
      throw new ForbiddenError('You do not have access to this task');
    }

    const result = await this.taskReadRepository.getTaskHistory(
      query.taskId,
      query.pagination
    );

    return result;
  }

  private canAccessTask(task: TaskWithDetails, userId: string): boolean {
    return task.creatorId === userId || task.assigneeId === userId;
  }
}

@injectable()
export class GetTaskDependenciesQueryHandler extends QueryHandler<
  GetTaskDependenciesQuery,
  TaskDependency[]
> {
  constructor(
    private readonly taskReadRepository: ITaskReadRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getQueryType(): string {
    return 'GetTaskDependenciesQuery';
  }

  async handle(query: GetTaskDependenciesQuery): Promise<TaskDependency[]> {
    this.logger.debug('Getting task dependencies', {
      taskId: query.taskId,
      userId: query.userId,
    });

    // Check if user has access to the task
    const task = await this.taskReadRepository.findByIdWithDetails(
      query.taskId
    );
    if (!task) {
      throw new NotFoundError('Task', query.taskId);
    }

    if (query.userId && !this.canAccessTask(task, query.userId)) {
      throw new ForbiddenError('You do not have access to this task');
    }

    const dependencies = await this.taskReadRepository.getTaskDependencies(
      query.taskId
    );

    return dependencies;
  }

  private canAccessTask(task: TaskWithDetails, userId: string): boolean {
    return task.creatorId === userId || task.assigneeId === userId;
  }
}
