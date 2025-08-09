import { AggregateRoot } from './aggregate-root';
import { Task } from '../entities/task';
import {
  TaskId,
  UserId,
  ProjectId,
  Priority,
  TaskStatusVO,
} from '../value-objects';
import { TaskStatus } from '../../shared/constants/task-constants';
import { DomainError } from '../../shared/errors';
import { TASK_BUSINESS_RULES } from '../../shared/constants/task-constants';
import { IdGenerator } from '../../shared/utils/id-generator';

/**
 * Task dependency interface
 */
export interface TaskDependency {
  taskId: TaskId;
  dependsOnId: TaskId;
  createdAt: Date;
}

/**
 * Create Task Data interface
 */
export interface CreateTaskData {
  title: string;
  description: string;
  priority: Priority;
  createdById: UserId;
  assigneeId?: UserId;
  dueDate?: Date;
  estimatedHours?: number;
}

/**
 * Task Aggregate
 * Manages tasks within a project with dependency management and business rule enforcement
 */
export class TaskAggregate extends AggregateRoot<ProjectId> {
  private _tasks: Map<string, Task>;
  private _dependencies: Map<string, TaskDependency[]>;

  constructor(
    projectId: ProjectId,
    tasks: Task[] = [],
    dependencies: TaskDependency[] = [],
    createdAt?: Date,
    updatedAt?: Date,
    version?: number
  ) {
    super(projectId, createdAt, updatedAt, version);
    this._tasks = new Map();
    this._dependencies = new Map();

    // Initialize tasks
    tasks.forEach(task => {
      this._tasks.set(task.id.toString(), task);
    });

    // Initialize dependencies
    dependencies.forEach(dependency => {
      const taskIdStr = dependency.taskId.toString();
      if (!this._dependencies.has(taskIdStr)) {
        this._dependencies.set(taskIdStr, []);
      }
      this._dependencies.get(taskIdStr)!.push(dependency);
    });

    this.validate();
  }

  /**
   * Get all tasks in this aggregate
   */
  get tasks(): Task[] {
    return Array.from(this._tasks.values());
  }

  /**
   * Get all task dependencies
   */
  get dependencies(): TaskDependency[] {
    return Array.from(this._dependencies.values()).flat();
  }

  /**
   * Create a new task
   */
  createTask(data: CreateTaskData): Task {
    // Check business rules
    if (this._tasks.size >= TASK_BUSINESS_RULES.MAX_TASKS_PER_PROJECT) {
      throw new DomainError(
        `Project cannot have more than ${TASK_BUSINESS_RULES.MAX_TASKS_PER_PROJECT} tasks`
      );
    }

    const taskId = TaskId.create(IdGenerator.generate());
    const task = Task.create(
      taskId,
      data.title,
      data.description,
      this._id, // projectId
      data.createdById,
      data.priority,
      data.dueDate,
      data.estimatedHours
    );

    // Assign if assignee is provided
    if (data.assigneeId) {
      task.assign(data.assigneeId, data.createdById);
    }

    this._tasks.set(taskId.toString(), task);
    this.incrementVersion();

    // TODO: Add domain event for task created

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: TaskId): Task | null {
    return this._tasks.get(taskId.toString()) || null;
  }

  /**
   * Update a task
   */
  updateTask(taskId: TaskId, updates: Partial<CreateTaskData>): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new DomainError('Task not found');
    }

    if (updates.title !== undefined || updates.description !== undefined) {
      task.updateBasicInfo(
        updates.title ?? task.title,
        updates.description ?? task.description,
        updates.dueDate,
        updates.estimatedHours
      );
    }

    if (updates.priority && !updates.priority.equals(task.priority)) {
      task.updatePriority(updates.priority, updates.createdById!);
    }

    this.incrementVersion();

    // TODO: Add domain event for task updated
  }

  /**
   * Assign a task to a user
   */
  assignTask(taskId: TaskId, assigneeId: UserId, assignedBy: UserId): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new DomainError('Task not found');
    }

    task.assign(assigneeId, assignedBy);
    this.incrementVersion();

    // TODO: Add domain event for task assigned
  }

  /**
   * Start a task
   */
  startTask(taskId: TaskId, startedBy: UserId): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new DomainError('Task not found');
    }

    // Check if all dependencies are completed
    if (!this.allDependenciesCompleted(taskId)) {
      throw new DomainError(
        'Cannot start task until all dependencies are completed'
      );
    }

    task.start(startedBy);
    this.incrementVersion();

    // TODO: Add domain event for task started
  }

  /**
   * Complete a task
   */
  completeTask(
    taskId: TaskId,
    completedBy: UserId,
    actualHours?: number
  ): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new DomainError('Task not found');
    }

    task.complete(completedBy, actualHours);
    this.incrementVersion();

    // TODO: Add domain event for task completed
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: TaskId, cancelledBy: UserId, reason?: string): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new DomainError('Task not found');
    }

    task.cancel(cancelledBy, reason);
    this.incrementVersion();

    // TODO: Add domain event for task cancelled
  }

  /**
   * Add a task dependency
   */
  addTaskDependency(taskId: TaskId, dependsOnId: TaskId): void {
    // Validate both tasks exist
    const task = this.getTask(taskId);
    const dependsOnTask = this.getTask(dependsOnId);

    if (!task) {
      throw new DomainError('Task not found');
    }

    if (!dependsOnTask) {
      throw new DomainError('Dependency task not found');
    }

    // Check for circular dependency
    if (this.wouldCreateCircularDependency(taskId, dependsOnId)) {
      throw new DomainError(
        'Adding this dependency would create a circular dependency'
      );
    }

    // Check maximum dependencies limit
    const taskIdStr = taskId.toString();
    const currentDependencies = this._dependencies.get(taskIdStr) || [];

    if (
      currentDependencies.length >=
      TASK_BUSINESS_RULES.MAX_DEPENDENCIES_PER_TASK
    ) {
      throw new DomainError(
        `Task cannot have more than ${TASK_BUSINESS_RULES.MAX_DEPENDENCIES_PER_TASK} dependencies`
      );
    }

    // Check if dependency already exists
    const dependsOnIdStr = dependsOnId.toString();
    if (
      currentDependencies.some(
        dep => dep.dependsOnId.toString() === dependsOnIdStr
      )
    ) {
      throw new DomainError('Dependency already exists');
    }

    // Add the dependency
    const dependency: TaskDependency = {
      taskId,
      dependsOnId,
      createdAt: new Date(),
    };

    if (!this._dependencies.has(taskIdStr)) {
      this._dependencies.set(taskIdStr, []);
    }

    this._dependencies.get(taskIdStr)!.push(dependency);
    this.incrementVersion();

    // TODO: Add domain event for dependency added
  }

  /**
   * Remove a task dependency
   */
  removeTaskDependency(taskId: TaskId, dependsOnId: TaskId): void {
    const taskIdStr = taskId.toString();
    const dependencies = this._dependencies.get(taskIdStr);

    if (!dependencies) {
      throw new DomainError('No dependencies found for this task');
    }

    const dependsOnIdStr = dependsOnId.toString();
    const dependencyIndex = dependencies.findIndex(
      dep => dep.dependsOnId.toString() === dependsOnIdStr
    );

    if (dependencyIndex === -1) {
      throw new DomainError('Dependency not found');
    }

    dependencies.splice(dependencyIndex, 1);

    if (dependencies.length === 0) {
      this._dependencies.delete(taskIdStr);
    }

    this.incrementVersion();

    // TODO: Add domain event for dependency removed
  }

  /**
   * Get task dependencies
   */
  getTaskDependencies(taskId: TaskId): TaskDependency[] {
    return this._dependencies.get(taskId.toString()) || [];
  }

  /**
   * Get tasks that depend on a specific task
   */
  getTasksDependingOn(taskId: TaskId): Task[] {
    const dependentTasks: Task[] = [];
    const taskIdStr = taskId.toString();

    for (const [
      dependentTaskIdStr,
      dependencies,
    ] of this._dependencies.entries()) {
      if (dependencies.some(dep => dep.dependsOnId.toString() === taskIdStr)) {
        const dependentTask = this._tasks.get(dependentTaskIdStr);
        if (dependentTask) {
          dependentTasks.push(dependentTask);
        }
      }
    }

    return dependentTasks;
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this._tasks.values()).filter(
      task => task.status.value === status
    );
  }

  /**
   * Get tasks assigned to a user
   */
  getTasksAssignedTo(userId: UserId): Task[] {
    return Array.from(this._tasks.values()).filter(
      task => task.assigneeId?.equals(userId) ?? false
    );
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(): Task[] {
    return Array.from(this._tasks.values()).filter(task => task.isOverdue());
  }

  /**
   * Get task completion statistics
   */
  getCompletionStats(): {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    cancelled: number;
    completionPercentage: number;
  } {
    const tasks = Array.from(this._tasks.values());
    const total = tasks.length;
    const completed = tasks.filter(t => t.status.isCompleted()).length;
    const inProgress = tasks.filter(t => t.status.isInProgress()).length;
    const todo = tasks.filter(t => t.status.isTodo()).length;
    const cancelled = tasks.filter(t => t.status.isCancelled()).length;
    const completionPercentage = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      inProgress,
      todo,
      cancelled,
      completionPercentage,
    };
  }

  /**
   * Check if all dependencies for a task are completed
   */
  private allDependenciesCompleted(taskId: TaskId): boolean {
    const dependencies = this.getTaskDependencies(taskId);

    for (const dependency of dependencies) {
      const dependencyTask = this.getTask(dependency.dependsOnId);
      if (!dependencyTask || !dependencyTask.isCompleted()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if adding a dependency would create a circular dependency
   */
  private wouldCreateCircularDependency(
    taskId: TaskId,
    dependsOnId: TaskId
  ): boolean {
    // If the dependency task depends on the current task (directly or indirectly), it's circular
    return this.hasTransitiveDependency(dependsOnId, taskId, new Set());
  }

  /**
   * Check if taskA has a transitive dependency on taskB
   */
  private hasTransitiveDependency(
    taskA: TaskId,
    taskB: TaskId,
    visited: Set<string>
  ): boolean {
    const taskAStr = taskA.toString();
    const taskBStr = taskB.toString();

    // Direct dependency
    if (taskAStr === taskBStr) {
      return true;
    }

    // Avoid infinite loops
    if (visited.has(taskAStr)) {
      return false;
    }
    visited.add(taskAStr);

    // Check transitive dependencies
    const dependencies = this.getTaskDependencies(taskA);
    for (const dependency of dependencies) {
      if (
        this.hasTransitiveDependency(dependency.dependsOnId, taskB, visited)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply a domain event to the aggregate
   */
  protected applyEvent(event: any): void {
    // TODO: Implement event application logic for event sourcing
    // This would handle events like TaskCreated, TaskAssigned, etc.
  }

  /**
   * Check aggregate invariants
   */
  protected checkInvariants(): void {
    // Check that all tasks belong to this project
    for (const task of this._tasks.values()) {
      if (!task.projectId.equals(this._id)) {
        throw new DomainError('All tasks must belong to the same project');
      }
    }

    // Check that all dependencies reference existing tasks
    for (const dependencies of this._dependencies.values()) {
      for (const dependency of dependencies) {
        if (
          !this._tasks.has(dependency.taskId.toString()) ||
          !this._tasks.has(dependency.dependsOnId.toString())
        ) {
          throw new DomainError(
            'All dependencies must reference existing tasks'
          );
        }
      }
    }

    // Check for circular dependencies
    for (const taskId of this._tasks.keys()) {
      const taskIdObj = TaskId.create(taskId);
      if (this.hasTransitiveDependency(taskIdObj, taskIdObj, new Set())) {
        throw new DomainError('Circular dependencies are not allowed');
      }
    }
  }

  /**
   * Get validation errors for the current state
   */
  getValidationErrors(): string[] {
    const errors: string[] = [];

    try {
      this.checkInvariants();
    } catch (error) {
      if (error instanceof DomainError) {
        errors.push(error.message);
      }
    }

    // Add validation errors from individual tasks
    for (const task of this._tasks.values()) {
      errors.push(...task.getValidationErrors());
    }

    return errors;
  }

  /**
   * Create a snapshot of the aggregate's current state
   */
  createSnapshot(): Record<string, any> {
    return {
      projectId: this._id.toString(),
      tasks: Array.from(this._tasks.values()).map(task => ({
        id: task.id.toString(),
        title: task.title,
        description: task.description,
        status: task.status.value,
        priority: task.priority.value,
        assigneeId: task.assigneeId?.toString() || null,
        createdById: task.createdById.toString(),
        dueDate: task.dueDate?.toISOString() || null,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        completedAt: task.completedAt?.toISOString() || null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
      dependencies: this.dependencies.map(dep => ({
        taskId: dep.taskId.toString(),
        dependsOnId: dep.dependsOnId.toString(),
        createdAt: dep.createdAt.toISOString(),
      })),
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Restore the aggregate from a snapshot
   */
  restoreFromSnapshot(snapshot: Record<string, any>): void {
    // TODO: Implement snapshot restoration logic
    // This would restore the aggregate state from a snapshot
  }

  /**
   * Create a new TaskAggregate instance
   */
  static create(projectId: ProjectId): TaskAggregate {
    return new TaskAggregate(projectId);
  }

  /**
   * Restore a TaskAggregate from persistence
   */
  static restore(
    projectId: ProjectId,
    tasks: Task[],
    dependencies: TaskDependency[],
    createdAt: Date,
    updatedAt: Date,
    version: number
  ): TaskAggregate {
    return new TaskAggregate(
      projectId,
      tasks,
      dependencies,
      createdAt,
      updatedAt,
      version
    );
  }
}
