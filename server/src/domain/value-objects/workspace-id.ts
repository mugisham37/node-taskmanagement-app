import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import { nanoid } from 'nanoid';

/**
 * Workspace ID value object
 * Represents a unique identifier for a workspace
 */
export class WorkspaceId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'workspaceId',
        'Workspace ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'workspaceId',
        'Workspace ID must be a string',
        value
      );
    }

    if (!WorkspaceId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'workspaceId',
        'Workspace ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
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
   * Generate a new unique WorkspaceId
   */
  static generate(): WorkspaceId {
    return new WorkspaceId(nanoid());
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
