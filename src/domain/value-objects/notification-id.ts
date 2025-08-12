import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import { IdGenerator } from '../../shared/utils/id-generator';

/**
 * Notification ID value object
 * Represents a unique identifier for a notification
 */
export class NotificationId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'notificationId',
        'Notification ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'notificationId',
        'Notification ID must be a string',
        value
      );
    }

    if (!NotificationId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'notificationId',
        'Notification ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Generate a new unique NotificationId
   */
  static generate(): NotificationId {
    return new NotificationId(IdGenerator.generate());
  }

  /**
   * Create a new NotificationId from a string
   */
  static create(id: string): NotificationId {
    return new NotificationId(id);
  }

  /**
   * Check if a string is a valid notification ID format
   */
  static isValid(id: string): boolean {
    try {
      new NotificationId(id);
      return true;
    } catch {
      return false;
    }
  }
}
