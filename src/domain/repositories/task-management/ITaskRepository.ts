import {
  IRepository,
  ISpecification,
} from '../../shared/repositories/IRepository';
import { Task } from '../entities/Task';
import { TaskId } from '../value-objects/TaskId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskStatus } from '../value-objects/TaskStatus';
import { Priority } from '../value-objects/Priority';

export interface ITaskRepository extends IRepository<Task, TaskId> {
  // Workspace-specific queries
  findByWorkspace(workspaceId: WorkspaceId): Promise<Task[]>;
  findByWorkspaceAndStatus(
    workspaceId: WorkspaceId,
    status: TaskStatus
  ): Promise<Task[]>;
  findByWorkspaceAndPriority(
    workspaceId: WorkspaceId,
    priority: Priority
  ): Promise<Task[]>;

  // Project-specific queries
  findByProject(projectId: ProjectId): Promise<Task[]>;
  findByProjectAndStatus(
    projectId: ProjectId,
    status: TaskStatus
  ): Promise<Task[]>;
  findByProjectAndAssignee(
    projectId: ProjectId,
    assigneeId: UserId
  ): Promise<Task[]>;

  // User-specific queries
  findByAssignee(assigneeId: UserId): Promise<Task[]>;
  findByCreator(creatorId: UserId): Promise<Task[]>;
  findByWatcher(watcherId: UserId): Promise<Task[]>;

  // Status and priority queries
  findByStatus(status: TaskStatus): Promise<Task[]>;
  findByPriority(priority: Priority): Promise<Task[]>;
  findOverdueTasks(): Promise<Task[]>;
  findTasksDueToday(): Promise<Task[]>;
  findTasksDueThisWeek(): Promise<Task[]>;

  // Hierarchy queries
  findSubtasks(parentTaskId: TaskId): Promise<Task[]>;
  findEpicTasks(epicId: TaskId): Promise<Task[]>;
  findRootTasks(workspaceId: WorkspaceId): Promise<Task[]>;

  // Dependency queries
  findDependencies(taskId: TaskId): Promise<Task[]>;
  findDependents(taskId: TaskId): Promise<Task[]>;

  // Search and filtering
  searchTasks(workspaceId: WorkspaceId, query: string): Promise<Task[]>;
  findByTags(workspaceId: WorkspaceId, tags: string[]): Promise<Task[]>;
  findByLabels(workspaceId: WorkspaceId, labels: string[]): Promise<Task[]>;

  // Analytics queries
  getTaskCountByStatus(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>>;
  getTaskCountByPriority(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>>;
  getTaskCountByAssignee(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>>;
  getAverageCompletionTime(workspaceId: WorkspaceId): Promise<number>;

  // Bulk operations
  bulkUpdateStatus(taskIds: TaskId[], status: TaskStatus): Promise<void>;
  bulkUpdatePriority(taskIds: TaskId[], priority: Priority): Promise<void>;
  bulkAssign(taskIds: TaskId[], assigneeId: UserId): Promise<void>;
  bulkAddTags(taskIds: TaskId[], tags: string[]): Promise<void>;

  // Soft delete operations
  softDelete(taskId: TaskId): Promise<void>;
  restore(taskId: TaskId): Promise<void>;
  findDeleted(workspaceId: WorkspaceId): Promise<Task[]>;
  permanentlyDelete(taskId: TaskId): Promise<void>;
}
