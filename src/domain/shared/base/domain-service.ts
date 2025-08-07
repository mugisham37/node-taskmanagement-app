/**
 * Base class for domain services that coordinate complex business logic
 * across multiple aggregates or handle operations that don't naturally
 * belong to a single entity.
 */
export abstract class DomainService {
  protected constructor() {}

  /**
   * Template method for domain service operations
   * Ensures consistent error handling and logging
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      this.beforeOperation(operationName);
      const result = await operation();
      this.afterOperation(operationName, true);
      return result;
    } catch (error) {
      this.afterOperation(operationName, false, error);
      throw error;
    }
  }

  protected beforeOperation(operationName: string): void {
    // Override in subclasses for logging, metrics, etc.
  }

  protected afterOperation(
    operationName: string,
    success: boolean,
    error?: any
  ): void {
    // Override in subclasses for logging, metrics, etc.
  }
}

/**
 * Interface for domain services that need to validate business rules
 */
export interface IDomainValidator<T> {
  validate(entity: T): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
