/**
 * Validator interface for consistent validation across the application
 */
export interface IValidator {
  validate<T>(data: any, schema: any): Promise<T>;
  validateSync<T>(data: any, schema: any): T;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validation result
 */
export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors?: ValidationError[];
}
