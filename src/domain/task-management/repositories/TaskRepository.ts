import { Task } from '../entities/Task';
import { TaskId } from '../value-objects/TaskId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskStatus } from '../value-objects/TaskStatus';
import { Priority } from '../value-objects/Priority';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  assigneeId?: UserId;
  creatorId?: UserId;
  tags?: string[];
  labels?: string[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
  hasAttachments?: boolean;
  isOverdue?: boolean;
  epicId?: TaskId;
  parentTaskId?: TaskId;
}

export interface TaskSortOptions {
  field:
    | 'title'
    | 'priority'
    | 'dueDate'
    | 'createdAt'
    | 'updatedAt'
    | 'position';
  direction: 'asc' | 'desc';
}

export interface TaskSearchOptions {
  query?: string;
  filters?: TaskFilters;
  sort?: TaskSortOptions;
  limit?: number;
  offset?: number;
}

export interface TaskRepository {
  /**
   * Save a task entity
   */
  save(task: Task): Promise<void>;

  /**
   * Save multiple tasks in a transaction
   */
  saveMany(tasks: Task[]): Promise<void>;

  /**
   * Find task by ID
   */
  findById(id: TaskId): Promise<Task | null>;

  /**
   * Find multiple tasks by IDs
   */
  findByIds(ids: TaskId[]): Promise<Task[]>;

  /**
   * Find tasks by workspace
   */
  findByWorkspace(
    workspaceId: WorkspaceId,
    options?: TaskSearchOptions
  ): Promise<Task[]>;

  /**
   * Find tasks by project
   */
  findByProject(
    projectId: ProjectId,
    options?: TaskSearchOptions
  ): Promise<Task[]>;

  /**
   * Find tasks assigned to user
   */
  findByAssignee(
    assigneeId: UserId,
    options?: TaskSearchOptions
  ): Promise<Task[]>;

  /**
   * Find tasks created by user
   */
  findByCreator(
    creatorId: UserId,
    options?: TaskSearchOptions
  ): Promise<Task[]>;

  /**
   * Find tasks watched by user
   */
  findByWatcher(
    watcherId: UserId,
    options?: TaskSearchOptions
  ): Promise<Task[]>;

  /**
   * Find subtasks of a parent task
   */
  findSubtasks(parentTaskId: TaskId): Promise<Task[]>;

  /**
   * Find tasks in an epic
   */
  findEpicTasks(epicId: TaskId): Promise<Task[]>;

  /**
   * Find tasks with specific status
   */
  findByStatus(workspaceId: WorkspaceId, status: TaskStatus): Promise<Task[]>;

  /**
   * Find overdue tasks
   */
  findOverdue(workspaceId: WorkspaceId): Promise<Task[]>;

  /**
   * Find tasks due within specified days
   */
  findDueSoon(workspaceId: WorkspaceId, days: number): Promise<Task[]>;

  /**
   * Search tasks by text query
   */
  search(
    workspaceId: WorkspaceId,
    query: string,
    options?: TaskSearchOptions
  ): Promise<Task[]>;

  /**
   * Get task count for workspace
   */
  getTaskCount(
    workspaceId: WorkspaceId,
    filters?: TaskFilters
  ): Promise<number>;

  /**
   * Get task count for project
   */
  getProjectTaskCount(
    projectId: ProjectId,
    filters?: TaskFilters
  ): Promise<number>;

  /**
   * Get task count for user
   */
  getUserTaskCount(userId: UserId, filters?: TaskFilters): Promise<number>;

  /**
   * Delete task (soft delete)
   */
  delete(id: TaskId): Promise<void>;

  /**
   * Delete multiple tasks
   */
  deleteMany(ids: TaskId[]): Promise<void>;

  /**
   * Get task dependencies
   */
  getTaskDependencies(taskId: TaskId): Promise<{
    dependsOn: Task[];
    dependents: Task[];
  }>;

  /**
   * Find tasks by tags
   */
  findByTags(workspaceId: WorkspaceId, tags: string[]): Promise<Task[]>;

  /**
   * Find tasks by labels
   */
  findByLabels(workspaceId: WorkspaceId, labels: string[]): Promise<Task[]>;

  /**
   * Get all unique tags in workspace
   */
  getAllTags(workspaceId: WorkspaceId): Promise<string[]>;

  /**
   * Get all unique labels in workspace
   */
  getAllLabels(workspaceId: WorkspaceId): Promise<string[]>;

  /**
   * Update task positions for reordering
   */
  updatePositions(
    updates: { taskId: TaskId; position: number }[]
  ): Promise<void>;

  /**
   * Get task activity timeline
   */
  getTaskActivity(taskId: TaskId): Promise<any[]>; // Would be properly typed in real implementation

  /**
   * Get task statistics for workspace
   */
  getWorkspaceTaskStats(workspaceId: WorkspaceId): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completed: number;
    averageCompletionTime: number; // in hours
  }>;

  /**
   * Get task statistics for project
   */
  getProjectTaskStats(projectId: ProjectId): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completed: number;
    averageCompletionTime: number; // in hours
  }>;

  /**
   * Get user task statistics
   */
  getUserTaskStats(userId: UserId): Promise<{
    assigned: number;
    created: number;
    completed: number;
    overdue: number;
    completionRate: number;
    averageCompletionTime: number; // in hours
  }>;
}
