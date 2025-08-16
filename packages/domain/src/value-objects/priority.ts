import { TASK_PRIORITY_WEIGHTS, Priority as TaskPriority, ValidationError } from '@taskmanagement/core';
import { ValueObject } from './value-object';

/**
 * Priority value object
 * Represents a task priority with comparison capabilities
 */
export class Priority extends ValueObject<TaskPriority> {
  protected validate(value: TaskPriority): void {
    if (!value) {
      throw ValidationError.forField(
        'priority',
        'Priority cannot be empty',
        value
      );
    }

    if (!Object.values(TaskPriority).includes(value)) {
      throw ValidationError.forField(
        'priority',
        `Invalid priority. Must be one of: ${Object.values(TaskPriority).join(', ')}`,
        value
      );
    }
  }

  /**
   * Create a new Priority from a TaskPriority enum
   */
  static create(priority: TaskPriority): Priority {
    return new Priority(priority);
  }

  /**
   * Create a Priority from a string
   */
  static fromString(priority: string): Priority {
    const upperPriority = priority.toUpperCase() as TaskPriority;
    return new Priority(upperPriority);
  }

  /**
   * Get the numeric weight of this priority for sorting
   */
  get weight(): number {
    return TASK_PRIORITY_WEIGHTS[this._value];
  }

  /**
   * Check if this priority is higher than another priority
   */
  isHigherThan(other: Priority): boolean {
    return this.weight > other.weight;
  }

  /**
   * Check if this priority is lower than another priority
   */
  isLowerThan(other: Priority): boolean {
    return this.weight < other.weight;
  }

  /**
   * Check if this priority is equal to another priority
   */
  isEqualTo(other: Priority): boolean {
    return this.weight === other.weight;
  }

  /**
   * Compare this priority with another priority
   * Returns: -1 if lower, 0 if equal, 1 if higher
   */
  compareTo(other: Priority): number {
    if (this.weight < other.weight) return -1;
    if (this.weight > other.weight) return 1;
    return 0;
  }

  /**
   * Check if this is a low priority
   */
  isLow(): boolean {
    return this._value === TaskPriority.LOW;
  }

  /**
   * Check if this is a medium priority
   */
  isMedium(): boolean {
    return this._value === TaskPriority.MEDIUM;
  }

  /**
   * Check if this is a high priority
   */
  isHigh(): boolean {
    return this._value === TaskPriority.HIGH;
  }

  /**
   * Check if this is an urgent priority
   */
  isUrgent(): boolean {
    return this._value === TaskPriority.URGENT;
  }

  /**
   * Check if this priority requires immediate attention (high or urgent)
   */
  requiresImmediateAttention(): boolean {
    return this.isHigh() || this.isUrgent();
  }

  /**
   * Get a human-readable description of the priority
   */
  getDescription(): string {
    switch (this._value) {
      case TaskPriority.LOW:
        return 'Low Priority';
      case TaskPriority.MEDIUM:
        return 'Medium Priority';
      case TaskPriority.HIGH:
        return 'High Priority';
      case TaskPriority.URGENT:
        return 'Urgent Priority';
      case TaskPriority.CRITICAL:
        return 'Critical Priority';
      default:
        return this._value;
    }
  }

  /**
   * Get the color associated with this priority (for UI purposes)
   */
  getColor(): string {
    switch (this._value) {
      case TaskPriority.LOW:
        return '#28a745'; // Green
      case TaskPriority.MEDIUM:
        return '#ffc107'; // Yellow
      case TaskPriority.HIGH:
        return '#fd7e14'; // Orange
      case TaskPriority.URGENT:
        return '#dc3545'; // Red
      case TaskPriority.CRITICAL:
        return '#8b0000'; // Dark Red
      default:
        return '#6c757d'; // Gray
    }
  }
}

