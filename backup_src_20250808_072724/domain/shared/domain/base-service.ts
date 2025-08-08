import { logger } from '@/infrastructure/logging/logger';
import { DomainError } from '../errors/domain-error';

/**
 * Base class for all domain services
 * Provides common functionality like logging, error handling, and validation
 */
export abstract class BaseDomainService {
  protected readonly logger = logger.child({
    service: this.constructor.name,
    domain: this.getDomainName(),
  });

  /**
   * Get the domain name for this service
   */
  protected abstract getDomainName(): string;

  /**
   * Validate input parameters
   */
  protected validateInput(input: any, validationRules: ValidationRule[]): void {
    for (const rule of validationRules) {
      if (!rule.validate(input)) {
        throw new DomainError(rule.errorCode, rule.errorMessage, {
          input,
          rule: rule.name,
        });
      }
    }
  }

  /**
   * Execute operation with logging and error handling
   */
  protected async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = this.generateOperationId();

    this.logger.info(`Starting operation: ${operationName}`, {
      operationId,
      operationName,
      ...context,
    });

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.logger.info(`Operation completed: ${operationName}`, {
        operationId,
        operationName,
        duration,
        success: true,
        ...context,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(`Operation failed: ${operationName}`, {
        operationId,
        operationName,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      });

      // Re-throw domain errors as-is
      if (error instanceof DomainError) {
        throw error;
      }

      // Wrap other errors in domain error
      throw new DomainError(
        'OPERATION_FAILED',
        `Operation ${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operationName, originalError: error, ...context }
      );
    }
  }

  /**
   * Generate unique operation ID for tracing
   */
  private generateOperationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `op_${timestamp}_${random}`;
  }

  /**
   * Assert that a condition is true, throw domain error if false
   */
  protected assert(
    condition: boolean,
    errorCode: string,
    errorMessage: string,
    context?: Record<string, any>
  ): void {
    if (!condition) {
      throw new DomainError(errorCode, errorMessage, context);
    }
  }

  /**
   * Assert that a value is not null or undefined
   */
  protected assertNotNull<T>(
    value: T | null | undefined,
    errorCode: string,
    errorMessage: string,
    context?: Record<string, any>
  ): T {
    if (value === null || value === undefined) {
      throw new DomainError(errorCode, errorMessage, context);
    }
    return value;
  }

  /**
   * Assert that an entity exists
   */
  protected assertEntityExists<T>(
    entity: T | null | undefined,
    entityType: string,
    entityId: string
  ): T {
    if (entity === null || entity === undefined) {
      throw new DomainError(
        'ENTITY_NOT_FOUND',
        `${entityType} with ID ${entityId} not found`,
        { entityType, entityId }
      );
    }
    return entity;
  }
}

/**
 * Base class for application services
 * Application services orchestrate domain operations and handle cross-cutting concerns
 */
export abstract class BaseApplicationService extends BaseDomainService {
  /**
   * Execute use case with transaction support
   */
  protected async executeUseCase<T>(
    useCaseName: string,
    useCase: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    return this.executeOperation(useCaseName, useCase, {
      ...context,
      layer: 'application',
      type: 'use-case',
    });
  }

  /**
   * Validate user permissions for operation
   */
  protected async validatePermissions(
    userId: string,
    requiredPermissions: string[],
    context?: Record<string, any>
  ): Promise<void> {
    // This would integrate with the authentication/authorization system
    // For now, we'll just log the validation
    this.logger.debug('Validating user permissions', {
      userId,
      requiredPermissions,
      ...context,
    });

    // TODO: Implement actual permission validation
    // This will be implemented when we create the authentication domain
  }

  /**
   * Validate workspace access
   */
  protected async validateWorkspaceAccess(
    userId: string,
    workspaceId: string,
    requiredRole?: string
  ): Promise<void> {
    // This would integrate with the workspace access control system
    this.logger.debug('Validating workspace access', {
      userId,
      workspaceId,
      requiredRole,
    });

    // TODO: Implement actual workspace access validation
    // This will be implemented when we create the workspace domain
  }
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  name: string;
  errorCode: string;
  errorMessage: string;
  validate(input: any): boolean;
}

/**
 * Common validation rules
 */
export class ValidationRules {
  static required(fieldName: string): ValidationRule {
    return {
      name: `${fieldName}_required`,
      errorCode: 'FIELD_REQUIRED',
      errorMessage: `${fieldName} is required`,
      validate: (input: any) => {
        const value = input[fieldName];
        return value !== null && value !== undefined && value !== '';
      },
    };
  }

  static minLength(fieldName: string, minLength: number): ValidationRule {
    return {
      name: `${fieldName}_min_length`,
      errorCode: 'FIELD_TOO_SHORT',
      errorMessage: `${fieldName} must be at least ${minLength} characters long`,
      validate: (input: any) => {
        const value = input[fieldName];
        return typeof value === 'string' && value.length >= minLength;
      },
    };
  }

  static maxLength(fieldName: string, maxLength: number): ValidationRule {
    return {
      name: `${fieldName}_max_length`,
      errorCode: 'FIELD_TOO_LONG',
      errorMessage: `${fieldName} must be no more than ${maxLength} characters long`,
      validate: (input: any) => {
        const value = input[fieldName];
        return typeof value === 'string' && value.length <= maxLength;
      },
    };
  }

  static email(fieldName: string): ValidationRule {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      name: `${fieldName}_email`,
      errorCode: 'INVALID_EMAIL',
      errorMessage: `${fieldName} must be a valid email address`,
      validate: (input: any) => {
        const value = input[fieldName];
        return typeof value === 'string' && emailRegex.test(value);
      },
    };
  }

  static uuid(fieldName: string): ValidationRule {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return {
      name: `${fieldName}_uuid`,
      errorCode: 'INVALID_UUID',
      errorMessage: `${fieldName} must be a valid UUID`,
      validate: (input: any) => {
        const value = input[fieldName];
        return typeof value === 'string' && uuidRegex.test(value);
      },
    };
  }

  static oneOf(fieldName: string, allowedValues: any[]): ValidationRule {
    return {
      name: `${fieldName}_one_of`,
      errorCode: 'INVALID_VALUE',
      errorMessage: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      validate: (input: any) => {
        const value = input[fieldName];
        return allowedValues.includes(value);
      },
    };
  }

  static custom(
    name: string,
    errorCode: string,
    errorMessage: string,
    validator: (input: any) => boolean
  ): ValidationRule {
    return {
      name,
      errorCode,
      errorMessage,
      validate: validator,
    };
  }
}

/**
 * Service result wrapper for consistent return types
 */
export class ServiceResult<T> {
  constructor(
    public readonly success: boolean,
    public readonly data?: T,
    public readonly error?: string,
    public readonly errorCode?: string,
    public readonly context?: Record<string, any>
  ) {}

  static success<T>(data: T): ServiceResult<T> {
    return new ServiceResult(true, data);
  }

  static failure<T>(
    error: string,
    errorCode?: string,
    context?: Record<string, any>
  ): ServiceResult<T> {
    return new ServiceResult(false, undefined, error, errorCode, context);
  }

  static fromError<T>(error: Error): ServiceResult<T> {
    if (error instanceof DomainError) {
      return new ServiceResult(
        false,
        undefined,
        error.message,
        error.code,
        error.context
      );
    }

    return new ServiceResult(false, undefined, error.message, 'UNKNOWN_ERROR');
  }

  isSuccess(): boolean {
    return this.success;
  }

  isFailure(): boolean {
    return !this.success;
  }

  getData(): T {
    if (!this.success || this.data === undefined) {
      throw new Error('Cannot get data from failed result');
    }
    return this.data;
  }

  getError(): string {
    if (this.success) {
      throw new Error('Cannot get error from successful result');
    }
    return this.error || 'Unknown error';
  }
}
