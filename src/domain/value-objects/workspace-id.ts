import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';

/**
 * Workspace ID value object
 * Represents a unique identifier for a workspace
 */
export class WorkspaceId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw new ValidationError('Workspace ID cannot be empty');
    }

    if (typeof value !== 'string') {
      throw new ValidationError('Workspace ID must be a string');
    }

    if (!WorkspaceId.ID_PATTERN.test(value)) {
      throw new ValidationError(
        'Workspace ID must be a valid nanoid (21 characters, alphanumeric with _ and -)'
      );
    }
  }

  /**
   * Create a new WorkspaceId from a string
   */
  static create(id: string): WorkspaceId {
    return new WorkspaceId(id);
  }

  /**
   * Check if a string is a valid workspace ID format
   */
  static isValid(id: string): boolean {
    try {
      new WorkspaceId(id);
      return true;
    } catch {
      return false;
    }
  }
}
