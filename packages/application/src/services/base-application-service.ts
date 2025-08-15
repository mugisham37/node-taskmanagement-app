/**
 * Enhanced Base Application Service
 *
 * This module provides a comprehensive base class for all application services
 * with transaction management, logging, error handling, and performance monitoring.
 */

import { PerformanceMonitor } from '@project/core/utils/performance-monitor';
import { DomainEventPublisher } from '@project/domain/events/domain-event-publisher';
import { LoggingService } from '@project/infrastructure/monitoring/logging-service';

export interface IUnitOfWork {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface ValidationRule<T> {
  validate(value: T): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class RequiredFieldValidationRule<T> implements ValidationRule<T> {
  constructor(
    private readonly fieldName: keyof T,
    private readonly displayName: string
  ) {}

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    const isValid = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    
    return {
      isValid,
      errors: isValid ? [] : [`${this.displayName} is required`]
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

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    const errors: string[] = [];
    
    if (fieldValue && typeof fieldValue === 'string') {
      if (this.minLength && fieldValue.length < this.minLength) {
        errors.push(`${this.displayName || String(this.fieldName)} must be at least ${this.minLength} characters`);
      }
      if (this.maxLength && fieldValue.length > this.maxLength) {
        errors.push(`${this.displayName || String(this.fieldName)} must be no more than ${this.maxLength} characters`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
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
      this.logger.warn(
        'No unit of work available, executing without transaction'
      );
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
          this.logger.error('Failed to rollback transaction', rollbackError as Error);
        }

        this.performanceMonitor.recordMetric('transaction.failure', 1);

        if (!retryOnFailure || attempt >= maxRetries) {
          break;
        }

        attempt++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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
    context?: any
  ): Promise<T> {
    const timer = this.performanceMonitor.startTimer(operationName);

    try {
      this.logger.debug(`Starting operation: ${operationName}`, context);

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

      this.performanceMonitor.recordMetric(`${operationName}.failure`, 1);
      throw error;
    }
  }

  /**
   * Validates input using provided validation rules
   */
  protected validateInput<T>(
    input: T,
    rules: ValidationRule<T>[]
  ): ValidationResult {
    const allErrors: string[] = [];

    for (const rule of rules) {
      const result = rule.validate(input);
      if (!result.isValid) {
        allErrors.push(...result.errors);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  // Logging helpers
  protected logInfo(message: string, context?: any): void {
    this.logger.info(message, context);
  }

  protected logError(message: string, error: Error, context?: any): void {
    this.logger.error(message, error, context);
  }

  protected logWarning(message: string, context?: any): void {
    this.logger.warn(message, context);
  }

  protected logDebug(message: string, context?: any): void {
    this.logger.debug(message, context);
  }
}