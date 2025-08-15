import { ValidationError } from '@monorepo/core';
import { ValueObject } from './value-object';

/**
 * User ID value object
 * Represents a unique identifier for a user
 */
export class UserId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'userId',
        'User ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'userId',
        'User ID must be a string',
        value
      );
    }

    if (!UserId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'userId',
        'User ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new UserId from a string
   */
  static create(id: string): UserId {
    return new UserId(id);
  }

  /**
   * Check if a string is a valid user ID format
   */
  static isValid(id: string): boolean {
    try {
      new UserId(id);
      return true;
    } catch {
      return false;
    }
  }
}
