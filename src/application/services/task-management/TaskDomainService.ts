import { Task } from '../entities/Task';
import { Project } from '../entities/Project';
import { TaskId } from '../value-objects/TaskId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskStatus } from '../value-objects/TaskStatus';
import { Priority } from '../value-objects/Priority';
import { DomainService } from '../../shared/base/domain-service';

export interface TaskDependencyRule {
  canCreateDependency(task: Task, dependsOn: Task): boolean;
  validateDependencyChain(tasks: Task[]): boolean;
}

export interface TaskAssignmentRule {
  canAssignTask(task: Task, assignee: UserId, assigner: UserId): boolean;
  validateWorkloadCapacity(assignee: UserId, additionalTask: Task): boolean;
}

export interface TaskProgressRule {
  canTransitionStatus(task: Task, newStatus: TaskStatus, user: UserId): boolean;
  validateProgressConsistency(task: Task, subtasks: Task[]): boolean;
}

export class TaskDomainService extends DomainService {
  constructor(
    private readonly dependencyRule: TaskDependencyRule,
    private readonly assignmentRule: TaskAssignmentRule,
    private readonly progressRule: TaskProgressRule
  ) {
    super();
  }

  /**
   * Validates and creates a dependency between two tasks
   */
  public createTaskDependency(task: Task, dependsOn: Task): void {
    // Prevent circular dependencies
    if (this.wouldCreateCircularDependency(task, dependsOn)) {
      throw new Error(
        'Creating this dependency would result in a circular dependency'
      );
    }

    // Validate business rules for dependency creation
    if (!this.dependencyRule.canCreateDependency(task, dependsOn)) {
      throw new Error(
        'Cannot create dependency between these tasks based on business rules'
      );
    }

    // Validate that dependent task is not completed if dependency is not
    if (task.status.isCompleted() && !dependsOn.status.isCompleted()) {
      throw new Error(
        'Cannot create dependency on incomplete task for completed task'
      );
    }
  }

  /**
   * Validates task assignment considering workload and permissions
   */
  public assignTaskWithValidation(
    task: Task,
    assignee: UserId,
    assigner: UserId
  ): void {
    // Check assignment permissions
    if (!this.assignmentRule.canAssignTask(task, assignee, assigner)) {
      throw new Error('User does not have permission to assign this task');
    }

    // Check workload capacity
    if (!this.assignmentRule.validateWorkloadCapacity(assignee, task)) {
      throw new Error('Assignee has reached maximum workload capacity');
    }

    // Perform the assignment
    task.assignTo(assignee, assigner);
  }

  /**
   * Validates status transitions considering dependencies and subtasks
   */
  public transitionTaskStatus(
    task: Task,
    newStatus: TaskStatus,
    user: UserId,
    dependencies: Task[] = [],
    subtasks: Task[] = []
  ): void {
    // Check if user can transition this task
    if (!this.progressRule.canTransitionStatus(task, newStatus, user)) {
      throw new Error('User does not have permission to change task status');
    }

    // Validate dependencies are satisfied
    if (newStatus.isInProgress() || newStatus.isCompleted()) {
      const incompleteDependencies = dependencies.filter(
        dep => !dep.status.isCompleted()
      );
      if (incompleteDependencies.length > 0) {
        throw new Error(
          'Cannot start/complete task while dependencies are incomplete'
        );
      }
    }

    // Validate subtask consistency
    if (!this.progressRule.validateProgressConsistency(task, subtasks)) {
      throw new Error('Task status is inconsistent with subtask progress');
    }

    // Perform the status change
    task.changeStatus(newStatus, user);
  }

  /**
   * Calculates task priority based on various factors
   */
  public calculateDynamicPriority(
    task: Task,
    project: Project,
    dependencies: Task[] = [],
    dependents: Task[] = []
  ): Priority {
    let priorityScore = task.priority.numericValue;

    // Increase priority if task is blocking others
    if (dependents.length > 0) {
      priorityScore += dependents.length * 10;
    }

    // Increase priority if task is overdue
    if (task.isOverdue()) {
      const daysOverdue = Math.abs(task.getDaysUntilDue() || 0);
      priorityScore += daysOverdue * 5;
    }

    // Increase priority based on project priority
    priorityScore += project.priority.numericValue * 2;

    // Decrease priority if task has incomplete dependencies
    const incompleteDependencies = dependencies.filter(
      dep => !dep.status.isCompleted()
    );
    priorityScore -= incompleteDependencies.length * 5;

    // Convert score back to Priority enum
    if (priorityScore >= 80) return Priority.urgent();
    if (priorityScore >= 60) return Priority.high();
    if (priorityScore >= 40) return Priority.medium();
    return Priority.low();
  }

  /**
   * Validates task hierarchy consistency
   */
  public validateTaskHierarchy(task: Task, parent?: Task, epic?: Task): void {
    // Validate parent relationship
    if (parent) {
      if (parent.id.equals(task.id)) {
        throw new Error('Task cannot be its own parent');
      }

      if (parent.epicId && task.epicId && !parent.epicId.equals(task.epicId)) {
        throw new Error('Subtask must belong to the same epic as its parent');
      }
    }

    // Validate epic relationship
    if (epic) {
      if (epic.id.equals(task.id)) {
        throw new Error('Task cannot be its own epic');
      }

      if (epic.parentTaskId) {
        throw new Error('Epic cannot be a subtask of another task');
      }
    }

    // Validate hierarchy depth (prevent too deep nesting)
    if (parent && this.getTaskDepth(parent) >= 5) {
      throw new Error('Task hierarchy cannot exceed 5 levels deep');
    }
  }

  /**
   * Estimates task completion based on historical data and current progress
   */
  public estimateCompletion(
    task: Task,
    subtasks: Task[] = [],
    historicalData?: { averageCompletionTime: number; accuracyRate: number }
  ): { estimatedCompletionDate: Date; confidenceLevel: number } {
    let estimatedDays = 0;
    let confidenceLevel = 0.5; // Default 50% confidence

    // If task has subtasks, calculate based on subtask estimates
    if (subtasks.length > 0) {
      const completedSubtasks = subtasks.filter(st =>
        st.status.isCompleted()
      ).length;
      const totalSubtasks = subtasks.length;
      const progressRatio = completedSubtasks / totalSubtasks;

      if (task.estimatedHours) {
        const remainingHours = task.estimatedHours * (1 - progressRatio);
        estimatedDays = Math.ceil(remainingHours / 8); // Assuming 8 hours per day
        confidenceLevel = 0.7; // Higher confidence with subtask breakdown
      }
    } else if (task.estimatedHours) {
      // Use task's own estimate
      estimatedDays = Math.ceil(task.estimatedHours / 8);
      confidenceLevel = 0.6;
    } else if (historicalData) {
      // Use historical data
      estimatedDays = Math.ceil(
        historicalData.averageCompletionTime / (24 * 60 * 60 * 1000)
      );
      confidenceLevel = historicalData.accuracyRate;
    } else {
      // Default estimate based on priority
      const priorityDays = {
        LOW: 5,
        MEDIUM: 3,
        HIGH: 2,
        URGENT: 1,
      };
      estimatedDays = priorityDays[task.priority.value] || 3;
      confidenceLevel = 0.3; // Low confidence for default estimates
    }

    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(
      estimatedCompletionDate.getDate() + estimatedDays
    );

    return {
      estimatedCompletionDate,
      confidenceLevel: Math.min(Math.max(confidenceLevel, 0), 1), // Clamp between 0 and 1
    };
  }

  /**
   * Validates task effort estimates against project constraints
   */
  public validateEffortEstimate(task: Task, project: Project): void {
    if (!task.estimatedHours) return;

    // Check if estimate exceeds project timeline
    if (project.startDate && project.endDate) {
      const projectDurationDays = Math.ceil(
        (project.endDate.getTime() - project.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const taskDurationDays = Math.ceil(task.estimatedHours / 8);

      if (taskDurationDays > projectDurationDays) {
        throw new Error('Task estimate exceeds project duration');
      }
    }

    // Validate against story points if both are provided
    if (task.storyPoints) {
      const expectedHours = task.storyPoints * 8; // Assuming 8 hours per story point
      const variance =
        Math.abs(task.estimatedHours - expectedHours) / expectedHours;

      if (variance > 0.5) {
        // More than 50% variance
        throw new Error('Estimated hours and story points are inconsistent');
      }
    }
  }

  private wouldCreateCircularDependency(task: Task, dependsOn: Task): boolean {
    // This would need to be implemented with actual dependency traversal
    // For now, just check direct circular dependency
    return task.id.equals(dependsOn.id);
  }

  private getTaskDepth(task: Task): number {
    // This would need to be implemented with actual parent traversal
    // For now, return a simple depth calculation
    return task.parentTaskId ? 1 : 0;
  }
}
