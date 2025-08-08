/**
 * Base class for Domain Services
 * Domain services contain business logic that doesn't naturally fit within entities or value objects
 */
export abstract class DomainService {
  protected constructor() {}
}

/**
 * Validation result interface for domain services
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Helper function to create a successful validation result
 */
export function createValidationSuccess(): ValidationResult {
  return {
    isValid: true,
    errors: [],
  };
}

/**
 * Helper function to create a failed validation result
 */
export function createValidationFailure(
  errors: ValidationError[]
): ValidationResult {
  return {
    isValid: false,
    errors,
  };
}

/**
 * Helper function to create a single validation error
 */
export function createValidationError(
  field: string,
  message: string,
  code?: string
): ValidationError {
  return {
    field,
    message,
    code,
  };
}
