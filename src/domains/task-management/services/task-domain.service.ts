import { TaskAggregate } from '../aggregates/task.aggregate';
import { UserId } from '../../authentication/value-objects/user-id';
import { TaskId } from '../value-objects/task-id';
import { ProjectId } from '../value-objects/project-id';
import { WorkspaceId } from '../value-objects/workspace-id';
import { Priority } from '../value-objects/priority';
import { TaskStatus } from '../value-objects/task-status';
import { ITaskRepository } from '../repositories/task.repository.interface';
import { IProjectRepository } from '../repositories/project.repository.interface';

/**
 * Task Management Domain Service
 * Contains business logic that spans multiple aggregates or doesn't naturally fit within a single aggregate
 */
export class TaskDomainService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository
  ) {}

  /**
   * Determines if a user can create a task in a specific project
   */
  async canUserCreateTask(
    userId: UserId,
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<boolean> {
    // Check if project exists and allows task creation
    if (projectId) {
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        return false;
      }

      if (!project.canAcceptTasks()) {
        return false;
      }

      // Check if user has permission in the project's workspace
      if (!project.workspaceId.equals(workspaceId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculates the priority of a task based on various factors
   */
  calculateTaskPriority(task: TaskAggregate): Priority {
    let priorityScore = task.priority.getNumericValue();

    // Increase priority if overdue
    if (task.isOverdue()) {
      priorityScore += 1;
    }

    // Increase priority if due soon (within 2 days)
    const daysUntilDue = task.getDaysUntilDue();
    if (daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue > 0) {
      priorityScore += 0.5;
    }

    // Increase priority if it's blocking other tasks (would need additional context)
    // This would require checking if other tasks depend on this one

    // Cap at critical priority
    if (priorityScore >= 4) {
      return Priority.critical();
    } else if (priorityScore >= 3) {
      return Priority.high();
    } else if (priorityScore >= 2) {
      return Priority.medium();
    } else {
      return Priority.low();
    }
  }

  /**
   * Determines if a task can be assigned to a specific user
   */
  async canAssignTaskToUser(
    task: TaskAggregate,
    assigneeId: UserId,
    assignedBy: UserId
  ): Promise<{
    canAssign: boolean;
    reason?: string;
  }> {
    // Check if the assignee is the same as current assignee
    if (task.assigneeId && task.assigneeId.equals(assigneeId)) {
      return {
        canAssign: false,
        reason: 'Task is already assigned to this user',
      };
    }

    // Check if the user assigning has permission
    if (!task.canBeEditedBy(assignedBy)) {
      return {
        canAssign: false,
        reason: 'You do not have permission to assign this task',
      };
    }

    // Additional business rules could be added here:
    // - Check if assignee is in the same workspace
    // - Check if assignee has capacity
    // - Check if assignee has required skills/role

    return { canAssign: true };
  }

  /**
   * Determines if a task can transition to a new status
   */
  canTransitionTaskStatus(
    task: TaskAggregate,
    newStatus: TaskStatus,
    userId: UserId
  ): {
    canTransition: boolean;
    reason?: string;
  } {
    // Check basic status transition rules
    if (!task.status.canTransitionTo(newStatus)) {
      return {
        canTransition: false,
        reason: `Cannot transition from ${task.status.value} to ${newStatus.value}`,
      };
    }

    // Check if user has permission to change status
    if (!task.canBeEditedBy(userId)) {
      return {
        canTransition: false,
        reason: 'You do not have permission to change this task status',
      };
    }

    // Additional business rules for specific transitions
    if (newStatus.isCompleted()) {
      // Check if all subtasks are completed (would need additional context)
      // Check if required fields are filled
      if (!task.assigneeId) {
        return {
          canTransition: false,
          reason: 'Task must be assigned before it can be completed',
        };
      }
    }

    return { canTransition: true };
  }

  /**
   * Calculates task dependencies and determines if a task can be started
   */
  async canStartTask(taskId: TaskId): Promise<{
    canStart: boolean;
    blockedBy?: TaskId[];
    reason?: string;
  }> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return {
        canStart: false,
        reason: 'Task not found',
      };
    }

    // Check if task is already in progress or completed
    if (!task.status.requiresAction()) {
      return {
        canStart: false,
        reason: 'Task is not in a startable state',
      };
    }

    // Check if parent task is completed (for subtasks)
    if (task.parentTaskId) {
      const parentTask = await this.taskRepository.findById(task.parentTaskId);
      if (parentTask && !parentTask.status.isCompleted()) {
        return {
          canStart: false,
          blockedBy: [task.parentTaskId],
          reason: 'Parent task must be completed first',
        };
      }
    }

    // Check for blocking dependencies (would need a dependency system)
    // This would require additional domain modeling for task dependencies

    return { canStart: true };
  }

  /**
   * Estimates task completion time based on historical data
   */
  async estimateTaskCompletion(task: TaskAggregate): Promise<{
    estimatedHours?: number;
    confidence: 'low' | 'medium' | 'high';
    basedOn: string;
  }> {
    // If task already has an estimate, use it
    if (task.estimatedHours) {
      return {
        estimatedHours: task.estimatedHours,
        confidence: 'high',
        basedOn: 'manual_estimate',
      };
    }

    // Find similar tasks by tags, labels, or assignee
    const similarTasks = await this.taskRepository.findSimilarTasks(
      task.workspaceId,
      {
        tags: task.tags,
        labels: task.labels,
        assigneeId: task.assigneeId,
        priority: task.priority,
      }
    );

    if (similarTasks.length === 0) {
      return {
        confidence: 'low',
        basedOn: 'no_historical_data',
      };
    }

    // Calculate average completion time from similar tasks
    const completedTasks = similarTasks.filter(
      t => t.status.isCompleted() && t.actualHours
    );

    if (completedTasks.length === 0) {
      return {
        confidence: 'low',
        basedOn: 'no_completed_similar_tasks',
      };
    }

    const averageHours =
      completedTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0) /
      completedTasks.length;

    const confidence =
      completedTasks.length >= 5
        ? 'high'
        : completedTasks.length >= 2
          ? 'medium'
          : 'low';

    return {
      estimatedHours: Math.round(averageHours * 100) / 100, // Round to 2 decimal places
      confidence,
      basedOn: `${completedTasks.length}_similar_tasks`,
    };
  }

  /**
   * Determines if a task should be escalated based on various factors
   */
  shouldEscalateTask(task: TaskAggregate): {
    shouldEscalate: boolean;
    reasons: string[];
    suggestedActions: string[];
  } {
    const reasons: string[] = [];
    const suggestedActions: string[] = [];

    // Check if task is overdue
    if (task.isOverdue()) {
      reasons.push('Task is overdue');
      suggestedActions.push('Update due date or prioritize completion');
    }

    // Check if task has been in progress for too long
    const daysSinceLastActivity = Math.floor(
      (Date.now() - task.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastActivity > 7 && task.status.isActive()) {
      reasons.push('No activity for over 7 days');
      suggestedActions.push('Check with assignee or reassign task');
    }

    // Check if task is blocked
    if (task.status.isBlocked()) {
      reasons.push('Task is blocked');
      suggestedActions.push('Resolve blocking issues');
    }

    // Check if task is critical priority and not progressing
    if (task.priority.isCritical() && !task.status.isCompleted()) {
      const daysUntilDue = task.getDaysUntilDue();
      if (daysUntilDue !== null && daysUntilDue <= 1) {
        reasons.push('Critical priority task due soon');
        suggestedActions.push('Immediate attention required');
      }
    }

    return {
      shouldEscalate: reasons.length > 0,
      reasons,
      suggestedActions,
    };
  }

  /**
   * Validates task hierarchy (epic -> task -> subtask)
   */
  async validateTaskHierarchy(
    taskId: TaskId,
    parentTaskId?: TaskId,
    epicId?: TaskId
  ): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check for circular references
    if (parentTaskId && parentTaskId.equals(taskId)) {
      errors.push('Task cannot be its own parent');
    }

    if (epicId && epicId.equals(taskId)) {
      errors.push('Task cannot be its own epic');
    }

    // Check if parent task exists and is not a subtask itself
    if (parentTaskId) {
      const parentTask = await this.taskRepository.findById(parentTaskId);
      if (!parentTask) {
        errors.push('Parent task does not exist');
      } else if (parentTask.isSubtask()) {
        errors.push('Parent task cannot be a subtask (max 2 levels)');
      }
    }

    // Check if epic exists
    if (epicId) {
      const epicTask = await this.taskRepository.findById(epicId);
      if (!epicTask) {
        errors.push('Epic task does not exist');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
