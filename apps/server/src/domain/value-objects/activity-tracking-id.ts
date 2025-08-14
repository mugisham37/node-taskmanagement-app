import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';

/**
 * Activity Tracking ID value object
 * Represents a unique identifier for an activity tracking record
 */
export class ActivityTrackingId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'activityTrackingId',
        'Activity Tracking ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'activityTrackingId',
        'Activity Tracking ID must be a string',
        value
      );
    }

    if (!ActivityTrackingId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'activityTrackingId',
        'Activity Tracking ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new ActivityTrackingId from a string
   */
  static create(id: string): ActivityTrackingId {
    return new ActivityTrackingId(id);
  }

  /**
   * Check if a string is a valid activity tracking ID format
   */
  static isValid(id: string): boolean {
    try {
      new ActivityTrackingId(id);
      return true;
    } catch {
      return false;
    }
  }
}
