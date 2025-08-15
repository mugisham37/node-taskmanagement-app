import { ValidationError } from '@monorepo/core';
import { ValueObject } from './value-object';

/**
 * Task ID value object
 * Represents a unique identifier for a task
 */
export class TaskId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'taskId',
        'Task ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'taskId',
        'Task ID must be a string',
        value
      );
    }

    if (!TaskId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'taskId',
        'Task ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new TaskId from a string
   */
  static create(id: string): TaskId {
    return new TaskId(id);
  }

  /**
   * Generate a new random TaskId
   */
  static generate(): TaskId {
    // Generate a nanoid-like string (21 characters)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return new TaskId(result);
  }

  /**
   * Check if a string is a valid task ID format
   */
  static isValid(id: string): boolean {
    try {
      new TaskId(id);
      return true;
    } catch {
      return false;
    }
  }
}
