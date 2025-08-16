import { ValidationError } from '@taskmanagement/core';
import { ValueObject } from './value-object';

/**
 * Device ID value object
 * Represents a unique identifier for a device
 */
export class DeviceId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'deviceId',
        'Device ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'deviceId',
        'Device ID must be a string',
        value
      );
    }

    if (!DeviceId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'deviceId',
        'Device ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new DeviceId from a string
   */
  static create(id: string): DeviceId {
    return new DeviceId(id);
  }

  /**
   * Check if a string is a valid device ID format
   */
  static isValid(id: string): boolean {
    try {
      new DeviceId(id);
      return true;
    } catch {
      return false;
    }
  }
}

