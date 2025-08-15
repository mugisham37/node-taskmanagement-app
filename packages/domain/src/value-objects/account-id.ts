import { ValidationError } from '@monorepo/core';
import { ValueObject } from './value-object';

/**
 * Account ID value object
 * Represents a unique identifier for an account
 */
export class AccountId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'accountId',
        'Account ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'accountId',
        'Account ID must be a string',
        value
      );
    }

    if (!AccountId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'accountId',
        'Account ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new AccountId from a string
   */
  static create(id: string): AccountId {
    return new AccountId(id);
  }

  /**
   * Check if a string is a valid account ID format
   */
  static isValid(id: string): boolean {
    try {
      new AccountId(id);
      return true;
    } catch {
      return false;
    }
  }
}
