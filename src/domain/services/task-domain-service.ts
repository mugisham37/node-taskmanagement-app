import { Task } from '../entities/task';
import {
  TaskId,
  ProjectId,
  UserId,
  Priority,
  TaskStatusVO,
} from '../value-objects';
import { TaskStatus } from '../../shared/constants/task-constants';
import { TaskDependency } from '../aggregates/task-aggregate';

/**
 * Task Assignment Result interface
 */
export interface TaskAssignmentResult {
  success: boolean;
  reason?: string;
  conflictingTasks?: Task[];
}

/**
 * Task Completion Validation Result interface
 */
export interface TaskCompletionValidationResult {
  canComplete: boolean;
  reason?: string;
  blockedBy?: TaskId[];
}

/**
 * Task Priority Recommendation interface
 */
export interface TaskPriorityRecommendation {
  recommendedPriority: Priority;
  reason: string;
  factors: string[];
}

/**
 * Task Domain Service
 * Handles complex task operations and business rule validation
 */
export class TaskDomainService {
  /**
   * Create a new task with validation
   */
  async createTask(params: {
    title: string;
    description: string;
    priority: Priority;
    projectId: ProjectId;
    createdById: UserId;
    dueDate?: Date;
    assigneeId?: UserId;
    estimatedHours?: number;
  }): Promise<Task> {
    // Create new task with proper validation
    const taskId = TaskId.generate();
    
    return new Task(
      taskId,
      params.title,
      params.description,
      params.projectId,
      params.createdById,
      TaskStatusVO.create(TaskStatus.TODO),
      params.priority,
      params.assigneeId,
      params.dueDate,
      params.estimatedHours
    );
  }

  /**
   * Check if user can update a task
   */
  canUserUpdateTask(task: Task, userId: UserId): boolean {
    // User can update if they are the creator or assignee
    return task.createdById.equals(userId) || 
           (task.assigneeId?.equals(userId) || false);
  }

  /**
   * Check if user can delete a task
   */
  canUserDeleteTask(task: Task, userId: UserId): boolean {
    // Only task creator can delete
    return task.createdById.equals(userId);
  }

  /**
   * Assign task to user
   */
  async assignTask(
    task: Task,
    assigneeId: UserId,
    assignedBy: UserId
  ): Promise<void> {
    task.assign(assigneeId, assignedBy);
  }

  /**
   * Complete a task
   */
  async completeTask(
    task: Task,
    completedBy: UserId,
    actualHours?: number
  ): Promise<void> {
    task.complete(completedBy, actualHours);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    task: Task,
    status: TaskStatusVO,
    updatedBy: UserId
  ): Promise<void> {
    task.updateStatus(status, updatedBy);
  }

  /**
   * Add task dependency
   */
  async addTaskDependency(
    taskId: TaskId,
    dependsOnTaskId: TaskId
  ): Promise<void> {
    // This would typically involve aggregate operations
    // For now, we'll assume this is handled at the aggregate level
    console.log(`Adding dependency: ${taskId.value} depends on ${dependsOnTaskId.value}`);
  }

  /**
   * Remove task dependency
   */
  async removeTaskDependency(
    taskId: TaskId,
    dependsOnTaskId: TaskId
  ): Promise<void> {
    // This would typically involve aggregate operations
    // For now, we'll assume this is handled at the aggregate level
    console.log(`Removing dependency: ${taskId.value} no longer depends on ${dependsOnTaskId.value}`);
  }

  /**
   * Validate if a task can be assigned to a user
   */
  validateTaskAssignment(
    task: Task,
    userActiveTasks: Task[]
  ): TaskAssignmentResult {
    // Check if task can be assigned
    if (!task.canBeAssigned()) {
      return {
        success: false,
        reason: `Task cannot be assigned in ${task.status.value} status`,
      };
    }

    // Check if user already has too many active tasks
    const activeTaskCount = userActiveTasks.filter(t =>
      t.status.isActive()
    ).length;
    const maxActiveTasks = 10; // Business rule: max 10 active tasks per user

    if (activeTaskCount >= maxActiveTasks) {
      return {
        success: false,
        reason: `User already has ${activeTaskCount} active tasks (maximum: ${maxActiveTasks})`,
        conflictingTasks: userActiveTasks.filter(t => t.status.isActive()),
      };
    }

    // Check for conflicting high-priority tasks with same due date
    if (task.priority.isUrgent() && task.dueDate) {
      const conflictingTasks = userActiveTasks.filter(
        t =>
          t.priority.isUrgent() &&
          t.dueDate &&
          this.isSameDay(t.dueDate, task.dueDate!)
      );

      if (conflictingTasks.length > 0) {
        return {
          success: false,
          reason: 'User already has urgent tasks due on the same day',
          conflictingTasks,
        };
      }
    }

    return { success: true };
  }

  /**
   * Validate if a task can be completed
   */
  validateTaskCompletion(
    task: Task,
    dependencies: TaskDependency[],
    allTasks: Map<string, Task>
  ): TaskCompletionValidationResult {
    // Check if task status allows completion
    if (!task.status.canTransitionTo(TaskStatus.COMPLETED)) {
      return {
        canComplete: false,
        reason: `Task cannot be completed from ${task.status.value} status`,
      };
    }

    // Check if all dependencies are completed
    const incompleteDependencies: TaskId[] = [];

    for (const dependency of dependencies) {
      const dependencyTask = allTasks.get(dependency.dependsOnTaskId.toString());
      if (!dependencyTask || !dependencyTask.isCompleted()) {
        incompleteDependencies.push(dependency.dependsOnTaskId);
      }
    }

    if (incompleteDependencies.length > 0) {
      return {
        canComplete: false,
        reason: 'Task has incomplete dependencies',
        blockedBy: incompleteDependencies,
      };
    }

    return { canComplete: true };
  }

  /**
   * Calculate task priority recommendation based on various factors
   */
  calculatePriorityRecommendation(
    task: Task,
    projectDeadline?: Date,
    dependentTasks: Task[] = [],
    userWorkload: number = 0
  ): TaskPriorityRecommendation {
    const factors: string[] = [];
    let priorityScore = 2; // Start with MEDIUM (2)

    // Factor 1: Due date proximity
    if (task.dueDate) {
      const daysUntilDue = task.getDaysUntilDue();
      if (daysUntilDue !== null) {
        if (daysUntilDue <= 1) {
          priorityScore += 2;
          factors.push('Due within 1 day');
        } else if (daysUntilDue <= 3) {
          priorityScore += 1;
          factors.push('Due within 3 days');
        } else if (daysUntilDue <= 7) {
          factors.push('Due within a week');
        }
      }
    }

    // Factor 2: Project deadline proximity
    if (projectDeadline) {
      const daysUntilProjectDeadline = Math.ceil(
        (projectDeadline.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysUntilProjectDeadline <= 7) {
        priorityScore += 1;
        factors.push('Project deadline approaching');
      }
    }

    // Factor 3: Number of dependent tasks
    if (dependentTasks.length > 0) {
      if (dependentTasks.length >= 5) {
        priorityScore += 2;
        factors.push(`${dependentTasks.length} tasks depend on this`);
      } else if (dependentTasks.length >= 2) {
        priorityScore += 1;
        factors.push(`${dependentTasks.length} tasks depend on this`);
      }
    }

    // Factor 4: User workload (inverse relationship)
    if (userWorkload > 8) {
      priorityScore -= 1;
      factors.push('High user workload - consider reassignment');
    }

    // Factor 5: Task is overdue
    if (task.isOverdue()) {
      priorityScore += 2;
      factors.push('Task is overdue');
    }

    // Convert score to priority
    let recommendedPriority: Priority;
    let reason: string;

    if (priorityScore >= 5) {
      recommendedPriority = Priority.create('URGENT' as any);
      reason = 'Multiple high-impact factors detected';
    } else if (priorityScore >= 4) {
      recommendedPriority = Priority.create('HIGH' as any);
      reason = 'High-impact factors detected';
    } else if (priorityScore >= 2) {
      recommendedPriority = Priority.create('MEDIUM' as any);
      reason = 'Standard priority based on current factors';
    } else {
      recommendedPriority = Priority.create('LOW' as any);
      reason = 'Low urgency based on current factors';
    }

    return {
      recommendedPriority,
      reason,
      factors,
    };
  }

  /**
   * Validate task dependency addition
   */
  validateDependencyAddition(
    taskId: TaskId,
    dependsOnId: TaskId,
    allTasks: Map<string, Task>,
    existingDependencies: Map<string, TaskDependency[]>
  ): { isValid: boolean; reason?: string } {
    // Check if both tasks exist
    const task = allTasks.get(taskId.toString());
    const dependsOnTask = allTasks.get(dependsOnId.toString());

    if (!task || !dependsOnTask) {
      return { isValid: false, reason: 'One or both tasks do not exist' };
    }

    // Check if tasks are in the same project
    if (!task.projectId.equals(dependsOnTask.projectId)) {
      return { isValid: false, reason: 'Tasks must be in the same project' };
    }

    // Check if dependency already exists
    const taskDependencies = existingDependencies.get(taskId.toString()) || [];
    const dependencyExists = taskDependencies.some(dep =>
      dep.dependsOnTaskId.equals(dependsOnId)
    );

    if (dependencyExists) {
      return { isValid: false, reason: 'Dependency already exists' };
    }

    // Check for circular dependency
    if (
      this.wouldCreateCircularDependency(
        taskId,
        dependsOnId,
        existingDependencies
      )
    ) {
      return { isValid: false, reason: 'Would create circular dependency' };
    }

    // Check if the dependency task is already completed
    if (dependsOnTask.isCompleted()) {
      // This is allowed but we should warn
      return { isValid: true };
    }

    // Check if the task is already completed (shouldn't add dependencies to completed tasks)
    if (task.isCompleted()) {
      return {
        isValid: false,
        reason: 'Cannot add dependencies to completed tasks',
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate estimated completion date based on dependencies and workload
   */
  calculateEstimatedCompletionDate(
    task: Task,
    dependencies: TaskDependency[],
    allTasks: Map<string, Task>,
    userWorkload: number = 1 // tasks per day
  ): Date | null {
    if (!task.estimatedHours) {
      return null;
    }

    // Find the latest completion date among dependencies
    let latestDependencyCompletion = new Date();

    for (const dependency of dependencies) {
      const dependencyTask = allTasks.get(dependency.dependsOnTaskId.toString());
      if (dependencyTask) {
        const dependencyCompletion = this.calculateEstimatedCompletionDate(
          dependencyTask,
          [], // Avoid infinite recursion
          allTasks,
          userWorkload
        );

        if (
          dependencyCompletion &&
          dependencyCompletion > latestDependencyCompletion
        ) {
          latestDependencyCompletion = dependencyCompletion;
        }
      }
    }

    // Calculate completion time based on estimated hours and workload
    const hoursPerDay = 8; // Standard work day
    const daysNeeded = Math.ceil(
      task.estimatedHours / (hoursPerDay * userWorkload)
    );

    const estimatedCompletion = new Date(latestDependencyCompletion);
    estimatedCompletion.setDate(estimatedCompletion.getDate() + daysNeeded);

    return estimatedCompletion;
  }

  /**
   * Get task health score (0-100)
   */
  getTaskHealthScore(task: Task, dependencies: TaskDependency[] = []): number {
    let score = 100;

    // Deduct points for overdue tasks
    if (task.isOverdue()) {
      score -= 30;
    }

    // Deduct points for tasks without assignee
    if (!task.isAssigned()) {
      score -= 20;
    }

    // Deduct points for tasks without due date
    if (!task.dueDate) {
      score -= 10;
    }

    // Deduct points for tasks without estimated hours
    if (!task.estimatedHours) {
      score -= 10;
    }

    // Deduct points for tasks with many dependencies
    if (dependencies.length > 3) {
      score -= dependencies.length * 5;
    }

    // Bonus points for tasks in progress
    if (task.isInProgress()) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if two dates are on the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  /**
   * Check if adding a dependency would create a circular dependency
   */
  private wouldCreateCircularDependency(
    taskId: TaskId,
    dependsOnId: TaskId,
    existingDependencies: Map<string, TaskDependency[]>
  ): boolean {
    return this.hasTransitiveDependency(
      dependsOnId,
      taskId,
      existingDependencies,
      new Set()
    );
  }

  /**
   * Check if taskA has a transitive dependency on taskB
   */
  private hasTransitiveDependency(
    taskA: TaskId,
    taskB: TaskId,
    dependencies: Map<string, TaskDependency[]>,
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
    const taskDependencies = dependencies.get(taskAStr) || [];
    for (const dependency of taskDependencies) {
      if (
        this.hasTransitiveDependency(
          dependency.dependsOnTaskId,
          taskB,
          dependencies,
          visited
        )
      ) {
        return true;
      }
    }

    return false;
  }
}
