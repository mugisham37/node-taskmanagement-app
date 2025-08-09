import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';

/**
 * Task ID value object
 * Represents a unique identifier for a task
 */
export class TaskId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw new ValidationError('Task ID cannot be empty');
    }

    if (typeof value !== 'string') {
      throw new ValidationError('Task ID must be a string');
    }

    if (!TaskId.ID_PATTERN.test(value)) {
      throw new ValidationError(
        'Task ID must be a valid nanoid (21 characters, alphanumeric with _ and -)'
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
