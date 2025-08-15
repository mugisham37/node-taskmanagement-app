import { Priority, TaskStatus, UnifiedTaskFilters } from '@monorepo/core';
import { TaskAggregate, TaskDependency } from '../aggregates/task-aggregate';
import { Task } from '../entities/task';
import { ProjectId, TaskId, UserId } from '../value-objects';

/**
 * Task filter options
 * @deprecated Use UnifiedTaskFilters instead
 */
export interface TaskFilters {
  status?: TaskStatus[];
  assigneeId?: UserId;
  createdById?: UserId;
  priority?: Priority[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  isOverdue?: boolean;
  hasEstimatedHours?: boolean;
  search?: string;
}

/**
 * Task sorting options
 */
export interface TaskSortOptions {
  field: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
  direction: 'ASC' | 'DESC';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Task Repository Interface
 * Defines all necessary task operations for persistence
 */
export interface ITaskRepository {
  /**
   * Find a task by its ID
   */
  findById(id: TaskId): Promise<Task | null>;

  /**
   * Find multiple tasks by their IDs
   */
  findByIds(ids: TaskId[]): Promise<Task[]>;

  /**
   * Find all tasks with optional filters, sorting, and pagination
   */
  findAll(
    filters?: UnifiedTaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Find tasks by project ID with optional filters, sorting, and pagination
   */
  findByProjectId(
    projectId: ProjectId,
    filters?: UnifiedTaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Find tasks assigned to a user
   */
  findByAssigneeId(
    assigneeId: UserId,
    filters?: UnifiedTaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Find tasks created by a user
   */
  findByCreatedById(
    createdById: UserId,
    filters?: UnifiedTaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Find overdue tasks
   */
  findOverdueTasks(
    projectId?: ProjectId,
    assigneeId?: UserId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Find tasks due within specified days
   */
  findTasksDueWithinDays(
    days: number,
    projectId?: ProjectId,
    assigneeId?: UserId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Search tasks by title or description
   */
  searchTasks(
    searchTerm: string,
    projectId?: ProjectId,
    filters?: UnifiedTaskFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>>;

  /**
   * Get task statistics for a project
   */
  getTaskStatistics(projectId: ProjectId): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completed: number;
    averageCompletionTime?: number; // in hours
  }>;

  /**
   * Get task dependencies for a task
   */
  getTaskDependencies(taskId: TaskId): Promise<TaskDependency[]>;

  /**
   * Get tasks that depend on a specific task
   */
  getTasksDependingOn(taskId: TaskId): Promise<Task[]>;

  /**
   * Save a single task
   */
  save(task: Task): Promise<void>;

  /**
   * Save multiple tasks
   */
  saveMany(tasks: Task[]): Promise<void>;

  /**
   * Delete a task
   */
  delete(id: TaskId): Promise<void>;

  /**
   * Delete multiple tasks
   */
  deleteMany(ids: TaskId[]): Promise<void>;

  /**
   * Check if a task exists
   */
  exists(id: TaskId): Promise<boolean>;

  /**
   * Count tasks matching filters
   */
  count(projectId?: ProjectId, filters?: UnifiedTaskFilters): Promise<number>;

  /**
   * Get task aggregate for a project
   */
  getTaskAggregate(projectId: ProjectId): Promise<TaskAggregate | null>;

  /**
   * Save task aggregate
   */
  saveTaskAggregate(aggregate: TaskAggregate): Promise<void>;

  /**
   * Add task dependency
   */
  addTaskDependency(taskId: TaskId, dependsOnId: TaskId): Promise<void>;

  /**
   * Remove task dependency
   */
  removeTaskDependency(taskId: TaskId, dependsOnId: TaskId): Promise<void>;

  /**
   * Get tasks with no dependencies (can be started)
   */
  getTasksWithNoDependencies(projectId: ProjectId): Promise<Task[]>;

  /**
   * Get task completion history for analytics
   */
  getTaskCompletionHistory(
    projectId: ProjectId,
    fromDate: Date,
    toDate: Date
  ): Promise<
    Array<{
      date: Date;
      completedCount: number;
      totalCount: number;
    }>
  >;

  /**
   * Get user task workload
   */
  getUserTaskWorkload(userId: UserId): Promise<{
    activeTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    averageCompletionTime?: number;
  }>;

  /**
   * Bulk update task status
   */
  bulkUpdateStatus(taskIds: TaskId[], status: TaskStatus): Promise<void>;

  /**
   * Bulk assign tasks
   */
  bulkAssignTasks(taskIds: TaskId[], assigneeId: UserId): Promise<void>;

  /**
   * Get tasks requiring attention (overdue, high priority unassigned, etc.)
   */
  getTasksRequiringAttention(
    projectId?: ProjectId,
    assigneeId?: UserId
  ): Promise<Task[]>;
}
