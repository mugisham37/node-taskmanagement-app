import { ValidationError } from '../errors/domain-error';

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Base validator class for domain validation
 */
export abstract class Validator<T> {
  /**
   * Validates an entity and returns validation result
   */
  abstract validate(entity: T): ValidationResult;

  /**
   * Validates an entity and throws on first error
   */
  validateAndThrow(entity: T): void {
    const result = this.validate(entity);
    if (!result.isValid && result.errors.length > 0) {
      throw result.errors[0];
    }
  }

  /**
   * Helper method to create a successful validation result
   */
  protected success(): ValidationResult {
    return {
      isValid: true,
      errors: [],
    };
  }

  /**
   * Helper method to create a failed validation result
   */
  protected failure(errors: ValidationError[]): ValidationResult {
    return {
      isValid: false,
      errors,
    };
  }

  /**
   * Helper method to create a single error validation result
   */
  protected singleError(
    field: string,
    value: any,
    reason: string
  ): ValidationResult {
    return this.failure([new ValidationError(field, value, reason)]);
  }
}

/**
 * Composite validator that combines multiple validators
 */
export class CompositeValidator<T> extends Validator<T> {
  constructor(private readonly validators: Validator<T>[]) {
    super();
  }

  validate(entity: T): ValidationResult {
    const allErrors: ValidationError[] = [];

    for (const validator of this.validators) {
      const result = validator.validate(entity);
      if (!result.isValid) {
        allErrors.push(...result.errors);
      }
    }

    return allErrors.length === 0 ? this.success() : this.failure(allErrors);
  }
}

/**
 * Common validation utilities
 */
export class ValidationUtils {
  /**
   * Validates that a value is not null or undefined
   */
  static required(value: any, fieldName: string): ValidationError | null {
    if (value === null || value === undefined) {
      return new ValidationError(fieldName, value, 'is required');
    }
    return null;
  }

  /**
   * Validates that a string is not empty
   */
  static notEmpty(value: string, fieldName: string): ValidationError | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return new ValidationError(fieldName, value, 'cannot be empty');
    }
    return null;
  }

  /**
   * Validates string length constraints
   */
  static stringLength(
    value: string,
    fieldName: string,
    min?: number,
    max?: number
  ): ValidationError | null {
    if (typeof value !== 'string') {
      return new ValidationError(fieldName, value, 'must be a string');
    }

    if (min !== undefined && value.length < min) {
      return new ValidationError(
        fieldName,
        value,
        `must be at least ${min} characters long`
      );
    }

    if (max !== undefined && value.length > max) {
      return new ValidationError(
        fieldName,
        value,
        `must be at most ${max} characters long`
      );
    }

    return null;
  }

  /**
   * Validates numeric range constraints
   */
  static numberRange(
    value: number,
    fieldName: string,
    min?: number,
    max?: number
  ): ValidationError | null {
    if (typeof value !== 'number' || isNaN(value)) {
      return new ValidationError(fieldName, value, 'must be a valid number');
    }

    if (min !== undefined && value < min) {
      return new ValidationError(fieldName, value, `must be at least ${min}`);
    }

    if (max !== undefined && value > max) {
      return new ValidationError(fieldName, value, `must be at most ${max}`);
    }

    return null;
  }

  /**
   * Validates email format
   */
  static email(value: string, fieldName: string): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (typeof value !== 'string') {
      return new ValidationError(fieldName, value, 'must be a string');
    }

    if (!emailRegex.test(value)) {
      return new ValidationError(
        fieldName,
        value,
        'must be a valid email address'
      );
    }

    return null;
  }

  /**
   * Validates URL format
   */
  static url(value: string, fieldName: string): ValidationError | null {
    if (typeof value !== 'string') {
      return new ValidationError(fieldName, value, 'must be a string');
    }

    try {
      new URL(value);
      return null;
    } catch {
      return new ValidationError(fieldName, value, 'must be a valid URL');
    }
  }

  /**
   * Validates that a value is in a list of allowed values
   */
  static oneOf<T>(
    value: T,
    allowedValues: T[],
    fieldName: string
  ): ValidationError | null {
    if (!allowedValues.includes(value)) {
      return new ValidationError(
        fieldName,
        value,
        `must be one of: ${allowedValues.join(', ')}`
      );
    }
    return null;
  }

  /**
   * Validates date constraints
   */
  static dateRange(
    value: Date,
    fieldName: string,
    minDate?: Date,
    maxDate?: Date
  ): ValidationError | null {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      return new ValidationError(fieldName, value, 'must be a valid date');
    }

    if (minDate && value < minDate) {
      return new ValidationError(
        fieldName,
        value,
        `must be after ${minDate.toISOString()}`
      );
    }

    if (maxDate && value > maxDate) {
      return new ValidationError(
        fieldName,
        value,
        `must be before ${maxDate.toISOString()}`
      );
    }

    return null;
  }

  /**
   * Validates array constraints
   */
  static arrayLength<T>(
    value: T[],
    fieldName: string,
    min?: number,
    max?: number
  ): ValidationError | null {
    if (!Array.isArray(value)) {
      return new ValidationError(fieldName, value, 'must be an array');
    }

    if (min !== undefined && value.length < min) {
      return new ValidationError(
        fieldName,
        value,
        `must contain at least ${min} items`
      );
    }

    if (max !== undefined && value.length > max) {
      return new ValidationError(
        fieldName,
        value,
        `must contain at most ${max} items`
      );
    }

    return null;
  }

  /**
   * Validates UUID format
   */
  static uuid(value: string, fieldName: string): ValidationError | null {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (typeof value !== 'string') {
      return new ValidationError(fieldName, value, 'must be a string');
    }

    if (!uuidRegex.test(value)) {
      return new ValidationError(fieldName, value, 'must be a valid UUID');
    }

    return null;
  }
}
