import { AppError } from '@taskmanagement/core';

/**
 * Interface for validation error details
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
  public readonly errors: ValidationErrorDetail[];

  constructor(
    errors: ValidationErrorDetail[],
    message?: string,
    context?: Record<string, any>
  ) {
    const errorMessage = message || ValidationError.formatErrorMessage(errors);
    super(errorMessage, 'VALIDATION_ERROR', context);
    this.errors = errors;
  }

  /**
   * Create a validation error for a single field
   */
  static forField(
    field: string,
    message: string,
    value?: any,
    constraint?: string
  ): ValidationError {
    const errorDetail: ValidationErrorDetail = { field, message };
    if (value !== undefined) errorDetail.value = value;
    if (constraint !== undefined) errorDetail.constraint = constraint;
    return new ValidationError([errorDetail]);
  }

  /**
   * Create a validation error for multiple fields
   */
  static forFields(errors: ValidationErrorDetail[]): ValidationError {
    return new ValidationError(errors);
  }

  /**
   * Format multiple validation errors into a single message
   */
  private static formatErrorMessage(errors: ValidationErrorDetail[]): string {
    if (errors.length === 1 && errors[0]) {
      return `Validation failed for field '${errors[0].field}': ${errors[0].message}`;
    }

    const fieldMessages = errors.map(
      error => `${error.field}: ${error.message}`
    );
    return `Validation failed for fields: ${fieldMessages.join(', ')}`;
  }

  /**
   * Add another validation error
   */
  addError(error: ValidationErrorDetail): void {
    this.errors.push(error);
  }

  /**
   * Check if a specific field has validation errors
   */
  hasErrorForField(field: string): boolean {
    return this.errors.some(error => error.field === field);
  }

  /**
   * Get validation errors for a specific field
   */
  getErrorsForField(field: string): ValidationErrorDetail[] {
    return this.errors.filter(error => error.field === field);
  }

  /**
   * Convert to JSON with error details
   */
  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }

  /**
   * Get safe JSON for API responses
   */
  override toSafeJSON(): Record<string, any> {
    return {
      ...super.toSafeJSON(),
      errors: this.errors,
    };
  }
}
