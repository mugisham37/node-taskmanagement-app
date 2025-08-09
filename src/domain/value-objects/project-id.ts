import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';

/**
 * Project ID value object
 * Represents a unique identifier for a project
 */
export class ProjectId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw new ValidationError('Project ID cannot be empty');
    }

    if (typeof value !== 'string') {
      throw new ValidationError('Project ID must be a string');
    }

    if (!ProjectId.ID_PATTERN.test(value)) {
      throw new ValidationError(
        'Project ID must be a valid nanoid (21 characters, alphanumeric with _ and -)'
      );
    }
  }

  /**
   * Create a new ProjectId from a string
   */
  static create(id: string): ProjectId {
    return new ProjectId(id);
  }

  /**
   * Check if a string is a valid project ID format
   */
  static isValid(id: string): boolean {
    try {
      new ProjectId(id);
      return true;
    } catch {
      return false;
    }
  }
}
