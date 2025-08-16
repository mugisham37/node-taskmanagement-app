import { TASK_STATUS_TRANSITIONS, TaskStatus, ValidationError } from '@taskmanagement/core';
import { ValueObject } from './value-object';

// Re-export the enum for convenience
export { TaskStatus } from '@taskmanagement/core';

/**
 * Task Status value object
 * Represents a task status with state transition validation
 */
export class TaskStatusVO extends ValueObject<TaskStatus> {
  protected validate(value: TaskStatus): void {
    if (!value) {
      throw ValidationError.forField('taskStatus', 'Task status cannot be empty', value);
    }

    if (!Object.values(TaskStatus).includes(value)) {
      throw ValidationError.forField(
        'taskStatus',
        `Invalid task status. Must be one of: ${Object.values(TaskStatus).join(', ')}`,
        value
      );
    }
  }

  /**
   * Get the task status value
   */
  override get value(): TaskStatus {
    return this._value;
  }

  /**
   * Create a new TaskStatusVO from a TaskStatus enum
   */
  static create(status: TaskStatus): TaskStatusVO {
    return new TaskStatusVO(status);
  }

  /**
   * Create a TaskStatusVO from a string
   */
  static fromString(status: string): TaskStatusVO {
    const upperStatus = status.toUpperCase() as TaskStatus;
    return new TaskStatusVO(upperStatus);
  }

  /**
   * Check if this status can transition to another status
   */
  canTransitionTo(newStatus: TaskStatus): boolean {
    const allowedTransitions = TASK_STATUS_TRANSITIONS[this._value];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Get all valid transitions from this status
   */
  getValidTransitions(): TaskStatus[] {
    return [...TASK_STATUS_TRANSITIONS[this._value]];
  }

  /**
   * Check if the task is completed
   */
  isCompleted(): boolean {
    return this._value === TaskStatus.COMPLETED;
  }

  /**
   * Check if the task is cancelled
   */
  isCancelled(): boolean {
    return this._value === TaskStatus.CANCELLED;
  }

  /**
   * Check if the task is active (not completed or cancelled)
   */
  isActive(): boolean {
    return !this.isCompleted() && !this.isCancelled();
  }

  /**
   * Check if the task is in progress
   */
  isInProgress(): boolean {
    return this._value === TaskStatus.IN_PROGRESS;
  }

  /**
   * Check if the task is in review
   */
  isInReview(): boolean {
    return this._value === TaskStatus.IN_REVIEW;
  }

  /**
   * Check if the task is todo
   */
  isTodo(): boolean {
    return this._value === TaskStatus.TODO;
  }

  /**
   * Check if the task can be assigned (not completed or cancelled)
   */
  canBeAssigned(): boolean {
    return this.isActive();
  }

  /**
   * Check if the task can be started (is in TODO status)
   */
  canBeStarted(): boolean {
    return this.isTodo();
  }

  /**
   * Get a human-readable description of the status
   */
  getDescription(): string {
    switch (this._value) {
      case TaskStatus.TODO:
        return 'To Do';
      case TaskStatus.IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.IN_REVIEW:
        return 'In Review';
      case TaskStatus.COMPLETED:
        return 'Completed';
      case TaskStatus.CANCELLED:
        return 'Cancelled';
      default:
        return this._value;
    }
  }
}
