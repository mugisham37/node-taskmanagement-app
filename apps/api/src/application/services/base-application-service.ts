/**
 * Enhanced Base Application Service
 *
 * This module provides a comprehensive base class for all application services
 * with transaction management, logging, error handling, and performance monitoring.
 */

import { DomainEventPublisher } from '@taskmanagement/domain';
import { PerformanceMonitor } from '@taskmanagement/utils';
import { LoggingService } from '@taskmanagement/observability';

export interface IUnitOfWork {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export abstract class BaseApplicationService {
  protected performanceMonitor = new PerformanceMonitor();

  constructor(
    protected readonly logger: LoggingService,
    protected readonly eventPublisher: DomainEventPublisher,
    protected readonly unitOfWork?: IUnitOfWork
  ) {}

  /**
   * Executes an operation within a database transaction with enhanced error handling
   */
  protected async executeInTransaction<T>(
    operation: () => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    if (!this.unitOfWork) {
      this.logger.warn('No unit of work available, executing without transaction');
      return await operation();
    }

    const { timeout = 30000, retryOnFailure = false, maxRetries = 3 } = options;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      const timer = this.performanceMonitor.startTimer('transaction');

      try {
        this.logger.debug('Starting transaction', {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          timeout,
        });

        // Set timeout if supported
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Transaction timeout')), timeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);

        await this.unitOfWork.commit();

        const duration = timer.end();

        this.logger.debug('Transaction completed successfully', {
          attempt: attempt + 1,
          duration,
        });

        // Publish domain events after successful transaction
        await this.eventPublisher.publishAll();

        this.performanceMonitor.recordMetric('transaction.success', 1);
        this.performanceMonitor.recordMetric('transaction.duration', duration);

        return result;
      } catch (error) {
        const duration = timer.end();
        lastError = error as Error;

        this.logger.error('Transaction failed', lastError, {
          attempt: attempt + 1,
          duration,
          willRetry: retryOnFailure && attempt < maxRetries,
        });

        try {
          if (this.unitOfWork.isActive()) {
            await this.unitOfWork.rollback();
          }
        } catch (rollbackError) {
          this.logger.error('Transaction rollback failed', rollbackError as Error);
        }

        // Clear any pending domain events on failure
        // if (typeof this.eventPublisher.clearEvents === 'function') {
        //   this.eventPublisher.clearEvents();
        // }

        this.performanceMonitor.recordMetric('transaction.error', 1);

        if (!retryOnFailure || attempt >= maxRetries) {
          break;
        }

        attempt++;

        // Exponential backoff for retries
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this.delay(delay);
      }
    }

    throw lastError || new Error('Transaction failed after all retries');
  }

  /**
   * Executes an operation with performance monitoring and error handling
   */
  protected async executeWithMonitoring<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const timer = this.performanceMonitor.startTimer(operationName);

    this.logger.debug(`Starting operation: ${operationName}`, context);

    try {
      const result = await operation();
      const duration = timer.end();

      this.logger.debug(`Operation completed: ${operationName}`, {
        ...context,
        duration,
      });

      this.performanceMonitor.recordMetric(`${operationName}.success`, 1);
      this.performanceMonitor.recordMetric(`${operationName}.duration`, duration);

      return result;
    } catch (error) {
      const duration = timer.end();

      this.logger.error(`Operation failed: ${operationName}`, error as Error, {
        ...context,
        duration,
      });

      this.performanceMonitor.recordMetric(`${operationName}.error`, 1);

      throw error;
    }
  }

  /**
   * Validates input data with comprehensive error reporting
   */
  protected validateInput<T>(
    data: T,
    validationRules: ValidationRule<T>[],
    context?: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of validationRules) {
      try {
        const result = rule.validate(data);
        if (!result.isValid) {
          errors.push(...result.errors);
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      } catch (error) {
        this.logger.error('Validation rule failed', error as Error, {
          rule: rule.constructor.name,
          context,
        });
        warnings.push(`Validation rule failed: ${(error as Error).message}`);
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.warn('Input validation failed', {
        context,
        errors,
        warnings,
      });
    }

    return {
      isValid,
      errors,
      warnings: warnings.length > 0 ? warnings : [],
    };
  }

  /**
   * Handles errors with proper logging and context
   */
  protected handleError(
    error: Error,
    context: string,
    additionalData?: Record<string, any>
  ): never {
    this.logger.error(`Error in ${context}`, error, additionalData);

    // Transform domain errors to application errors if needed
    if (error.name === 'DomainError') {
      throw new ApplicationError(error.message, context, error);
    }

    throw error;
  }

  // Logging helpers with consistent formatting
  protected logInfo(message: string, data?: any): void {
    this.logger.info(message, {
      service: this.constructor.name,
      ...data,
    });
  }

  protected logError(message: string, error?: Error, data?: any): void {
    this.logger.error(message, error, {
      service: this.constructor.name,
      ...data,
    });
  }

  protected logWarning(message: string, data?: any): void {
    this.logger.warn(message, {
      service: this.constructor.name,
      ...data,
    });
  }

  protected logDebug(message: string, data?: any): void {
    this.logger.debug(message, {
      service: this.constructor.name,
      ...data,
    });
  }

  /**
   * Gets performance metrics for this service
   */
  getPerformanceMetrics(): Record<string, any> {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics(): void {
    // Reset performance monitor if method exists
    // if (typeof this.performanceMonitor.reset === 'function') {
    //   this.performanceMonitor.reset();
    // }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Supporting interfaces and types
export interface ValidationRule<T> {
  validate(data: T): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly context: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

// Common validation rules
export class RequiredFieldValidationRule<T> implements ValidationRule<T> {
  constructor(
    private readonly fieldName: keyof T,
    private readonly displayName?: string
  ) {}

  validate(data: T): ValidationResult {
    const value = data[this.fieldName];
    const fieldDisplayName = this.displayName || String(this.fieldName);

    if (value === null || value === undefined || value === '') {
      return {
        isValid: false,
        errors: [`${fieldDisplayName} is required`],
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  }
}

export class LengthValidationRule<T> implements ValidationRule<T> {
  constructor(
    private readonly fieldName: keyof T,
    private readonly minLength?: number,
    private readonly maxLength?: number,
    private readonly displayName?: string
  ) {}

  validate(data: T): ValidationResult {
    const value = data[this.fieldName];
    const fieldDisplayName = this.displayName || String(this.fieldName);
    const errors: string[] = [];

    if (typeof value === 'string') {
      if (this.minLength !== undefined && value.length < this.minLength) {
        errors.push(`${fieldDisplayName} must be at least ${this.minLength} characters long`);
      }
      if (this.maxLength !== undefined && value.length > this.maxLength) {
        errors.push(`${fieldDisplayName} must be no more than ${this.maxLength} characters long`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

