import { Task } from '../entities/Task';
import { TaskId } from '../value-objects/TaskId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskStatus, TaskStatusEnum } from '../value-objects/TaskStatus';
import { Priority, PriorityEnum } from '../value-objects/Priority';
import {
  TaskRepository,
  TaskFilters,
  TaskSearchOptions,
  TaskSortOptions,
} from '../repositories/TaskRepository';
import {
  WorkspacePermissionService,
  WorkspacePermission,
} from './WorkspacePermissionService';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: PriorityEnum;
  assigneeId?: UserId;
  reporterId?: UserId;
  dueDate?: Date;
  startDate?: Date;
  estimatedHours?: number;
  storyPoints?: number;
  tags?: string[];
  labels?: string[];
  epicId?: TaskId;
  parentTaskId?: TaskId;
  customFields?: Record<string, any>;
  position?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: PriorityEnum;
  dueDate?: Date;
  startDate?: Date;
  estimatedHours?: number;
  storyPoints?: number;
  tags?: string[];
  labels?: string[];
  customFields?: Record<string, any>;
  position?: number;
}

export interface BulkTaskOperation {
  taskIds: TaskId[];
  operation:
    | 'assign'
    | 'unassign'
    | 'update_status'
    | 'update_priority'
    | 'add_tags'
    | 'remove_tags'
    | 'delete';
  data?: {
    assigneeId?: UserId;
    status?: TaskStatusEnum;
    priority?: PriorityEnum;
    tags?: string[];
  };
}

export interface TaskAssignmentRequest {
  taskId: TaskId;
  assigneeId: UserId;
  assignedBy: UserId;
  notifyAssignee?: boolean;
}

export interface TaskDependency {
  taskId: TaskId;
  dependsOnId: TaskId;
  type:
    | 'finish_to_start'
    | 'start_to_start'
    | 'finish_to_finish'
    | 'start_to_finish';
}

// Domain Events
export class TaskAssignmentChangedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly previousAssigneeId: UserId | undefined,
    public readonly newAssigneeId: UserId | undefined,
    public readonly assignedBy: UserId
  ) {
    super('TaskAssignmentChanged', {
      taskId: taskId.value,
      previousAssigneeId: previousAssigneeId?.value,
      newAssigneeId: newAssigneeId?.value,
      assignedBy: assignedBy.value,
    });
  }
}

export class TaskBulkOperationCompletedEvent extends DomainEvent {
  constructor(
    public readonly operation: string,
    public readonly taskIds: TaskId[],
    public readonly performedBy: UserId,
    public readonly affectedCount: number
  ) {
    super('TaskBulkOperationCompleted', {
      operation,
      taskIds: taskIds.map(id => id.value),
      performedBy: performedBy.value,
      affectedCount,
    });
  }
}

export class TaskDependencyAddedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly dependsOnId: TaskId,
    public readonly type: string,
    public readonly addedBy: UserId
  ) {
    super('TaskDependencyAdded', {
      taskId: taskId.value,
      dependsOnId: dependsOnId.value,
      type,
      addedBy: addedBy.value,
    });
  }
}

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly permissionService: WorkspacePermissionService
  ) {}

  /**
   * Create a new task
   */
  async createTask(
    workspaceId: WorkspaceId,
    projectId: ProjectId | undefined,
    creatorId: UserId,
    request: CreateTaskRequest
  ): Promise<Task> {
    // Check permissions
    await this.permissionService.ensurePermission(
      creatorId,
      WorkspacePermission.TASK_CREATE,
      { workspaceId, projectId }
    );

    // Validate parent task and epic relationships
    if (request.parentTaskId && request.epicId) {
      if (request.parentTaskId.equals(request.epicId)) {
        throw new Error('Task cannot have the same parent and epic');
      }
    }

    // Create task
    const task = Task.create({
      workspaceId,
      projectId,
      title: request.title,
      description: request.description,
      status: TaskStatus.todo(),
      priority: request.priority
        ? Priority.fromString(request.priority)
        : Priority.medium(),
      assigneeId: request.assigneeId,
      creatorId,
      reporterId: request.reporterId,
      dueDate: request.dueDate,
      startDate: request.startDate,
      estimatedHours: request.estimatedHours,
      storyPoints: request.storyPoints,
      tags: request.tags || [],
      labels: request.labels || [],
      epicId: request.epicId,
      parentTaskId: request.parentTaskId,
      attachments: [],
      externalLinks: [],
      watchers: [],
      customFields: request.customFields || {},
      position: request.position || 0,
    });

    // Add creator as watcher
    task.addWatcher(creatorId, creatorId);

    // Add assignee as watcher if different from creator
    if (request.assigneeId && !request.assigneeId.equals(creatorId)) {
      task.addWatcher(request.assigneeId, creatorId);
    }

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Update task details
   */
  async updateTask(
    taskId: TaskId,
    userId: UserId,
    request: UpdateTaskRequest
  ): Promise<Task> {
    const task = await this.getTaskById(taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      userId,
      WorkspacePermission.TASK_UPDATE
    );

    // Update task fields
    if (request.title) {
      task.updateTitle(request.title, userId);
    }

    if (request.description !== undefined) {
      task.updateDescription(request.description, userId);
    }

    if (request.priority) {
      task.updatePriority(Priority.fromString(request.priority), userId);
    }

    if (request.dueDate !== undefined || request.startDate !== undefined) {
      task.updateTimeline(request.startDate, request.dueDate, userId);
    }

    if (
      request.estimatedHours !== undefined ||
      request.storyPoints !== undefined
    ) {
      task.updateEffortEstimate(
        request.estimatedHours,
        request.storyPoints,
        userId
      );
    }

    if (request.tags) {
      task.updateTags(request.tags, userId);
    }

    if (request.labels) {
      task.updateLabels(request.labels, userId);
    }

    if (request.customFields) {
      task.updateCustomFields(request.customFields, userId);
    }

    if (request.position !== undefined) {
      task.updatePosition(request.position, userId);
    }

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Get task by ID with access control
   */
  async getTaskById(taskId: TaskId): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.isDeleted()) {
      throw new Error('Task has been deleted');
    }

    return task;
  }

  /**
   * Change task status
   */
  async changeTaskStatus(
    taskId: TaskId,
    userId: UserId,
    newStatus: TaskStatusEnum
  ): Promise<Task> {
    const task = await this.getTaskById(taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      userId,
      WorkspacePermission.TASK_UPDATE
    );

    // Change status
    task.changeStatus(TaskStatus.fromString(newStatus), userId);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Assign task to user
   */
  async assignTask(request: TaskAssignmentRequest): Promise<Task> {
    const task = await this.getTaskById(request.taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      request.assignedBy,
      WorkspacePermission.TASK_ASSIGN
    );

    const previousAssigneeId = task.assigneeId;

    // Assign task
    task.assignTo(request.assigneeId, request.assignedBy);

    await this.taskRepository.save(task);

    // Emit domain event
    console.log(
      new TaskAssignmentChangedEvent(
        request.taskId,
        previousAssigneeId,
        request.assigneeId,
        request.assignedBy
      )
    );

    return task;
  }

  /**
   * Unassign task
   */
  async unassignTask(taskId: TaskId, userId: UserId): Promise<Task> {
    const task = await this.getTaskById(taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      userId,
      WorkspacePermission.TASK_ASSIGN
    );

    const previousAssigneeId = task.assigneeId;
    if (!previousAssigneeId) {
      throw new Error('Task is not assigned to anyone');
    }

    // Unassign task
    task.unassign(userId);

    await this.taskRepository.save(task);

    // Emit domain event
    console.log(
      new TaskAssignmentChangedEvent(
        taskId,
        previousAssigneeId,
        undefined,
        userId
      )
    );

    return task;
  }

  /**
   * Add watcher to task
   */
  async addWatcher(
    taskId: TaskId,
    watcherId: UserId,
    addedBy: UserId
  ): Promise<Task> {
    const task = await this.getTaskById(taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      addedBy,
      WorkspacePermission.TASK_UPDATE
    );

    // Add watcher
    task.addWatcher(watcherId, addedBy);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Remove watcher from task
   */
  async removeWatcher(
    taskId: TaskId,
    watcherId: UserId,
    removedBy: UserId
  ): Promise<Task> {
    const task = await this.getTaskById(taskId);

    // Check permissions (user can remove themselves or have update permission)
    if (!watcherId.equals(removedBy)) {
      await this.ensureTaskPermission(
        task,
        removedBy,
        WorkspacePermission.TASK_UPDATE
      );
    }

    // Remove watcher
    task.removeWatcher(watcherId, removedBy);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: TaskId, userId: UserId): Promise<void> {
    const task = await this.getTaskById(taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      userId,
      WorkspacePermission.TASK_DELETE
    );

    // Delete task
    task.delete(userId);

    await this.taskRepository.save(task);
  }

  /**
   * Get tasks with filtering and sorting
   */
  async getTasks(
    workspaceId: WorkspaceId,
    userId: UserId,
    options: TaskSearchOptions = {}
  ): Promise<Task[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TASK_VIEW,
      { workspaceId }
    );

    const tasks = await this.taskRepository.findByWorkspace(
      workspaceId,
      options
    );

    // Filter tasks user has access to
    const accessibleTasks: Task[] = [];
    for (const task of tasks) {
      if (await this.canUserAccessTask(task, userId)) {
        accessibleTasks.push(task);
      }
    }

    return accessibleTasks;
  }

  /**
   * Get tasks by project
   */
  async getProjectTasks(
    projectId: ProjectId,
    userId: UserId,
    options: TaskSearchOptions = {}
  ): Promise<Task[]> {
    const tasks = await this.taskRepository.findByProject(projectId, options);

    // Filter tasks user has access to
    const accessibleTasks: Task[] = [];
    for (const task of tasks) {
      if (await this.canUserAccessTask(task, userId)) {
        accessibleTasks.push(task);
      }
    }

    return accessibleTasks;
  }

  /**
   * Get tasks assigned to user
   */
  async getUserAssignedTasks(
    userId: UserId,
    options: TaskSearchOptions = {}
  ): Promise<Task[]> {
    return await this.taskRepository.findByAssignee(userId, options);
  }

  /**
   * Get tasks created by user
   */
  async getUserCreatedTasks(
    userId: UserId,
    options: TaskSearchOptions = {}
  ): Promise<Task[]> {
    return await this.taskRepository.findByCreator(userId, options);
  }

  /**
   * Get tasks watched by user
   */
  async getUserWatchedTasks(
    userId: UserId,
    options: TaskSearchOptions = {}
  ): Promise<Task[]> {
    return await this.taskRepository.findByWatcher(userId, options);
  }

  /**
   * Search tasks
   */
  async searchTasks(
    workspaceId: WorkspaceId,
    userId: UserId,
    query: string,
    options: TaskSearchOptions = {}
  ): Promise<Task[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TASK_VIEW,
      { workspaceId }
    );

    const tasks = await this.taskRepository.search(workspaceId, query, options);

    // Filter tasks user has access to
    const accessibleTasks: Task[] = [];
    for (const task of tasks) {
      if (await this.canUserAccessTask(task, userId)) {
        accessibleTasks.push(task);
      }
    }

    return accessibleTasks;
  }

  /**
   * Perform bulk operations on tasks
   */
  async performBulkOperation(
    operation: BulkTaskOperation,
    userId: UserId
  ): Promise<{
    successful: TaskId[];
    failed: { taskId: TaskId; error: string }[];
  }> {
    const successful: TaskId[] = [];
    const failed: { taskId: TaskId; error: string }[] = [];

    for (const taskId of operation.taskIds) {
      try {
        const task = await this.getTaskById(taskId);

        // Check permissions for each task
        await this.ensureTaskPermission(
          task,
          userId,
          this.getRequiredPermissionForOperation(operation.operation)
        );

        // Perform operation
        switch (operation.operation) {
          case 'assign':
            if (operation.data?.assigneeId) {
              task.assignTo(operation.data.assigneeId, userId);
            }
            break;

          case 'unassign':
            task.unassign(userId);
            break;

          case 'update_status':
            if (operation.data?.status) {
              task.changeStatus(
                TaskStatus.fromString(operation.data.status),
                userId
              );
            }
            break;

          case 'update_priority':
            if (operation.data?.priority) {
              task.updatePriority(
                Priority.fromString(operation.data.priority),
                userId
              );
            }
            break;

          case 'add_tags':
            if (operation.data?.tags) {
              const currentTags = task.tags;
              const newTags = [
                ...new Set([...currentTags, ...operation.data.tags]),
              ];
              task.updateTags(newTags, userId);
            }
            break;

          case 'remove_tags':
            if (operation.data?.tags) {
              const currentTags = task.tags;
              const newTags = currentTags.filter(
                tag => !operation.data!.tags!.includes(tag)
              );
              task.updateTags(newTags, userId);
            }
            break;

          case 'delete':
            task.delete(userId);
            break;

          default:
            throw new Error(`Unknown operation: ${operation.operation}`);
        }

        await this.taskRepository.save(task);
        successful.push(taskId);
      } catch (error) {
        failed.push({
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Emit domain event
    console.log(
      new TaskBulkOperationCompletedEvent(
        operation.operation,
        successful,
        userId,
        successful.length
      )
    );

    return { successful, failed };
  }

  /**
   * Add task dependency
   */
  async addTaskDependency(
    dependency: TaskDependency,
    userId: UserId
  ): Promise<void> {
    const task = await this.getTaskById(dependency.taskId);
    const dependsOnTask = await this.getTaskById(dependency.dependsOnId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      userId,
      WorkspacePermission.TASK_UPDATE
    );
    await this.ensureTaskPermission(
      dependsOnTask,
      userId,
      WorkspacePermission.TASK_VIEW
    );

    // Validate dependency doesn't create circular reference
    await this.validateNoCyclicDependency(
      dependency.taskId,
      dependency.dependsOnId
    );

    // TODO: Add dependency to repository (would need TaskDependencyRepository)
    console.log(
      `Adding dependency: ${dependency.taskId.value} depends on ${dependency.dependsOnId.value}`
    );

    // Emit domain event
    console.log(
      new TaskDependencyAddedEvent(
        dependency.taskId,
        dependency.dependsOnId,
        dependency.type,
        userId
      )
    );
  }

  /**
   * Get task dependencies
   */
  async getTaskDependencies(
    taskId: TaskId,
    userId: UserId
  ): Promise<{
    dependsOn: Task[];
    dependents: Task[];
  }> {
    const task = await this.getTaskById(taskId);

    // Check permissions
    await this.ensureTaskPermission(
      task,
      userId,
      WorkspacePermission.TASK_VIEW
    );

    return await this.taskRepository.getTaskDependencies(taskId);
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<Task[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TASK_VIEW,
      { workspaceId }
    );

    const tasks = await this.taskRepository.findOverdue(workspaceId);

    // Filter tasks user has access to
    const accessibleTasks: Task[] = [];
    for (const task of tasks) {
      if (await this.canUserAccessTask(task, userId)) {
        accessibleTasks.push(task);
      }
    }

    return accessibleTasks;
  }

  /**
   * Get tasks due soon
   */
  async getTasksDueSoon(
    workspaceId: WorkspaceId,
    userId: UserId,
    days: number = 7
  ): Promise<Task[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TASK_VIEW,
      { workspaceId }
    );

    const tasks = await this.taskRepository.findDueSoon(workspaceId, days);

    // Filter tasks user has access to
    const accessibleTasks: Task[] = [];
    for (const task of tasks) {
      if (await this.canUserAccessTask(task, userId)) {
        accessibleTasks.push(task);
      }
    }

    return accessibleTasks;
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<any> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TASK_VIEW,
      { workspaceId }
    );

    return await this.taskRepository.getWorkspaceTaskStats(workspaceId);
  }

  /**
   * Update task positions for reordering
   */
  async reorderTasks(
    updates: { taskId: TaskId; position: number }[],
    userId: UserId
  ): Promise<void> {
    // Validate permissions for all tasks
    for (const update of updates) {
      const task = await this.getTaskById(update.taskId);
      await this.ensureTaskPermission(
        task,
        userId,
        WorkspacePermission.TASK_UPDATE
      );
    }

    // Update positions
    await this.taskRepository.updatePositions(updates);
  }

  /**
   * Check if user can access task
   */
  private async canUserAccessTask(
    task: Task,
    userId: UserId
  ): Promise<boolean> {
    // Task creator, assignee, or watcher always has access
    if (
      task.isCreatedBy(userId) ||
      task.isAssignedTo(userId) ||
      task.isWatchedBy(userId)
    ) {
      return true;
    }

    // Check workspace-level permissions
    const hasWorkspaceAccess = await this.permissionService.checkPermission(
      userId,
      WorkspacePermission.TASK_VIEW,
      {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
      }
    );

    return hasWorkspaceAccess.granted;
  }

  /**
   * Ensure user has task permission
   */
  private async ensureTaskPermission(
    task: Task,
    userId: UserId,
    permission: WorkspacePermission
  ): Promise<void> {
    const result = await this.permissionService.checkPermission(
      userId,
      permission,
      {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        resourceOwnerId: task.creatorId,
      }
    );

    if (!result.granted) {
      throw new Error(
        result.reason || `Access denied: ${permission} permission required`
      );
    }
  }

  /**
   * Get required permission for bulk operation
   */
  private getRequiredPermissionForOperation(
    operation: string
  ): WorkspacePermission {
    switch (operation) {
      case 'assign':
      case 'unassign':
        return WorkspacePermission.TASK_ASSIGN;
      case 'delete':
        return WorkspacePermission.TASK_DELETE;
      default:
        return WorkspacePermission.TASK_UPDATE;
    }
  }

  /**
   * Validate no cyclic dependency
   */
  private async validateNoCyclicDependency(
    taskId: TaskId,
    dependsOnId: TaskId
  ): Promise<void> {
    // Simple check - in a real implementation, this would do a full graph traversal
    if (taskId.equals(dependsOnId)) {
      throw new Error('Task cannot depend on itself');
    }

    // TODO: Implement full cyclic dependency check
    // This would involve traversing the dependency graph to ensure no cycles
  }
}

// TODO: This is a temporary instance export for compatibility during migration
// In the final architecture, services should be properly injected via DI container
import { PrismaTaskRepository } from '../repositories/task.repository.impl';
import { WorkspacePermissionService } from './WorkspacePermissionService';

// Create temporary instances (this should be replaced with proper DI)
const taskRepository = new PrismaTaskRepository();
const permissionService = new WorkspacePermissionService();

export const taskService = new TaskService(taskRepository, permissionService);
