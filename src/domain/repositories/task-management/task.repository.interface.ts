import { TaskAggregate } from '../aggregates/task.aggregate';
import { TaskId } from '../value-objects/task-id';
import { ProjectId } from '../value-objects/project-id';
import { WorkspaceId } from '../value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { TaskStatus } from '../value-objects/task-status';
import { Priority } from '../value-objects/priority';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  assigneeId?: UserId;
  creatorId?: UserId;
  tags?: string[];
  labels?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  createdAt?: {
    from?: Date;
    to?: Date;
  };
  isOverdue?: boolean;
  hasAttachments?: boolean;
  isWatchedBy?: UserId;
}

export interface TaskSimilarityFilters {
  tags?: string[];
  labels?: string[];
  assigneeId?: UserId;
  priority?: Priority;
}

export interface ITaskRepository {
  /**
   * Finds a task by its unique identifier
   */
  findById(id: TaskId): Promise<TaskAggregate | null>;

  /**
   * Finds multiple tasks by their identifiers
   */
  findByIds(ids: TaskId[]): Promise<TaskAggregate[]>;

  /**
   * Finds tasks by workspace ID with optional filters
   */
  findByWorkspaceId(
    workspaceId: WorkspaceId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Finds tasks by project ID with optional filters
   */
  findByProjectId(
    projectId: ProjectId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Finds tasks assigned to a specific user
   */
  findByAssigneeId(
    assigneeId: UserId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Finds tasks created by a specific user
   */
  findByCreatorId(
    creatorId: UserId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Finds tasks watched by a specific user
   */
  findWatchedByUser(
    userId: UserId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Finds subtasks of a parent task
   */
  findSubtasks(parentTaskId: TaskId): Promise<TaskAggregate[]>;

  /**
   * Finds tasks in an epic
   */
  findTasksInEpic(epicId: TaskId): Promise<TaskAggregate[]>;

  /**
   * Finds overdue tasks
   */
  findOverdueTasks(workspaceId?: WorkspaceId): Promise<TaskAggregate[]>;

  /**
   * Finds tasks due within a specific timeframe
   */
  findTasksDueSoon(
    days: number,
    workspaceId?: WorkspaceId
  ): Promise<TaskAggregate[]>;

  /**
   * Finds similar tasks based on criteria
   */
  findSimilarTasks(
    workspaceId: WorkspaceId,
    filters: TaskSimilarityFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Finds tasks with pagination
   */
  findWithPagination(
    workspaceId: WorkspaceId,
    offset: number,
    limit: number,
    filters?: TaskFilters,
    sortBy?: {
      field: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'status';
      direction: 'asc' | 'desc';
    }
  ): Promise<{
    tasks: TaskAggregate[];
    total: number;
  }>;

  /**
   * Searches tasks by text
   */
  searchTasks(
    workspaceId: WorkspaceId,
    query: string,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]>;

  /**
   * Saves a task aggregate
   */
  save(task: TaskAggregate): Promise<void>;

  /**
   * Deletes a task (soft delete)
   */
  delete(id: TaskId): Promise<void>;

  /**
   * Counts tasks by status
   */
  countByStatus(
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<Record<string, number>>;

  /**
   * Counts tasks by priority
   */
  countByPriority(
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<Record<string, number>>;

  /**
   * Counts tasks by assignee
   */
  countByAssignee(
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<Record<string, number>>;

  /**
   * Gets task completion statistics
   */
  getCompletionStats(
    workspaceId: WorkspaceId,
    dateRange?: {
      from: Date;
      to: Date;
    }
  ): Promise<{
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageCompletionTime: number; // in hours
  }>;

  /**
   * Gets task activity timeline
   */
  getActivityTimeline(taskId: TaskId): Promise<
    Array<{
      timestamp: Date;
      action: string;
      userId: UserId;
      details: Record<string, any>;
    }>
  >;

  /**
   * Finds tasks that need attention (overdue, stale, etc.)
   */
  findTasksNeedingAttention(workspaceId: WorkspaceId): Promise<{
    overdue: TaskAggregate[];
    stale: TaskAggregate[];
    blocked: TaskAggregate[];
    highPriority: TaskAggregate[];
  }>;

  /**
   * Gets user workload statistics
   */
  getUserWorkload(
    userId: UserId,
    workspaceId?: WorkspaceId
  ): Promise<{
    totalTasks: number;
    activeTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    estimatedHours: number;
    actualHours: number;
  }>;
}
