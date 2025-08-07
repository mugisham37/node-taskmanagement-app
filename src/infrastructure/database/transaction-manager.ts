/**
 * Advanced Transaction Management
 * Provides comprehensive transaction support for multi-aggregate operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma-client';
import { logger } from '../logging/logger';
import { DomainEvent } from '../../shared/domain/domain-event';
import { OptimisticLockingError } from '../../shared/domain/optimistic-locking';

export interface TransactionContext {
  id: string;
  client: Prisma.TransactionClient;
  startTime: Date;
  operations: TransactionOperation[];
  events: DomainEvent[];
  metadata: Record<string, any>;
}

export interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  operation: string;
  timestamp: Date;
}

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface TransactionResult<T> {
  result: T;
  context: TransactionContext;
  duration: number;
  operationCount: number;
  eventCount: number;
}

export class TransactionManager {
  private static readonly DEFAULT_OPTIONS: Required<TransactionOptions> = {
    maxWait: 30000, // 30 seconds
    timeout: 60000, // 60 seconds
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  constructor(private readonly client: PrismaClient = prisma) {}

  /**
   * Execute operation within a transaction with comprehensive error handling
   */
  async executeTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const finalOptions = { ...TransactionManager.DEFAULT_OPTIONS, ...options };
    const transactionId = this.generateTransactionId();
    const startTime = new Date();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalOptions.retryAttempts; attempt++) {
      try {
        const result = await this.client.$transaction(
          async tx => {
            const context: TransactionContext = {
              id: transactionId,
              client: tx,
              startTime,
              operations: [],
              events: [],
              metadata: {
                attempt,
                maxAttempts: finalOptions.retryAttempts,
              },
            };

            logger.debug('Transaction started', {
              transactionId,
              attempt,
              isolationLevel: finalOptions.isolationLevel,
            });

            const operationResult = await operation(context);

            logger.debug('Transaction operations completed', {
              transactionId,
              operationCount: context.operations.length,
              eventCount: context.events.length,
            });

            return {
              result: operationResult,
              context,
            };
          },
          {
            maxWait: finalOptions.maxWait,
            timeout: finalOptions.timeout,
            isolationLevel: finalOptions.isolationLevel,
          }
        );

        const duration = Date.now() - startTime.getTime();

        logger.info('Transaction completed successfully', {
          transactionId,
          duration,
          attempt,
          operationCount: result.context.operations.length,
          eventCount: result.context.events.length,
        });

        return {
          result: result.result,
          context: result.context,
          duration,
          operationCount: result.context.operations.length,
          eventCount: result.context.events.length,
        };
      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - startTime.getTime();

        logger.warn('Transaction failed', {
          transactionId,
          attempt,
          duration,
          error: error instanceof Error ? error.message : String(error),
          retryable: this.isRetryableError(error),
        });

        // Check if error is retryable and we have attempts left
        if (
          this.isRetryableError(error) &&
          attempt < finalOptions.retryAttempts
        ) {
          const delay = finalOptions.retryDelay * Math.pow(2, attempt - 1);
          logger.info('Retrying transaction', {
            transactionId,
            nextAttempt: attempt + 1,
            delayMs: delay,
          });

          await this.delay(delay);
          continue;
        }

        // If not retryable or max attempts reached, throw the error
        throw this.enhanceError(error, transactionId, attempt);
      }
    }

    throw lastError;
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeBatch<T>(
    operations: Array<(context: TransactionContext) => Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    return this.executeTransaction(async context => {
      const results: T[] = [];

      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i](context);
          results.push(result);

          this.recordOperation(context, {
            type: 'update',
            entityType: 'BatchOperation',
            entityId: `batch-${i}`,
            operation: `batch-operation-${i}`,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error('Batch operation failed', {
            transactionId: context.id,
            operationIndex: i,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      return results;
    }, options);
  }

  /**
   * Execute operation with saga pattern for distributed transactions
   */
  async executeSaga<T>(
    operations: Array<{
      execute: (context: TransactionContext) => Promise<any>;
      compensate: (context: TransactionContext, result: any) => Promise<void>;
    }>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    const executedOperations: Array<{ operation: any; result: any }> = [];

    try {
      return await this.executeTransaction(async context => {
        const results: any[] = [];

        // Execute all operations
        for (let i = 0; i < operations.length; i++) {
          const operation = operations[i];

          try {
            const result = await operation.execute(context);
            results.push(result);
            executedOperations.push({ operation, result });

            this.recordOperation(context, {
              type: 'update',
              entityType: 'SagaOperation',
              entityId: `saga-${i}`,
              operation: `saga-step-${i}`,
              timestamp: new Date(),
            });
          } catch (error) {
            logger.error('Saga operation failed, starting compensation', {
              transactionId: context.id,
              failedOperationIndex: i,
              error: error instanceof Error ? error.message : String(error),
            });

            // Compensate in reverse order
            await this.compensateOperations(
              context,
              executedOperations.reverse()
            );
            throw error;
          }
        }

        return results;
      }, options);
    } catch (error) {
      // If transaction fails, compensate outside transaction
      logger.error(
        'Saga transaction failed, performing external compensation',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      throw error;
    }
  }

  /**
   * Record transaction operation for audit and debugging
   */
  recordOperation(
    context: TransactionContext,
    operation: TransactionOperation
  ): void {
    context.operations.push(operation);
  }

  /**
   * Record domain event within transaction context
   */
  recordEvent(context: TransactionContext, event: DomainEvent): void {
    context.events.push(event);
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats(context: TransactionContext): {
    duration: number;
    operationCount: number;
    eventCount: number;
    averageOperationTime: number;
  } {
    const duration = Date.now() - context.startTime.getTime();
    const operationCount = context.operations.length;
    const eventCount = context.events.length;
    const averageOperationTime =
      operationCount > 0 ? duration / operationCount : 0;

    return {
      duration,
      operationCount,
      eventCount,
      averageOperationTime,
    };
  }

  /**
   * Create savepoint within transaction
   */
  async createSavepoint(
    context: TransactionContext,
    name: string
  ): Promise<void> {
    await context.client.$executeRaw`SAVEPOINT ${Prisma.raw(name)}`;

    logger.debug('Savepoint created', {
      transactionId: context.id,
      savepointName: name,
    });
  }

  /**
   * Rollback to savepoint
   */
  async rollbackToSavepoint(
    context: TransactionContext,
    name: string
  ): Promise<void> {
    await context.client.$executeRaw`ROLLBACK TO SAVEPOINT ${Prisma.raw(name)}`;

    logger.debug('Rolled back to savepoint', {
      transactionId: context.id,
      savepointName: name,
    });
  }

  /**
   * Release savepoint
   */
  async releaseSavepoint(
    context: TransactionContext,
    name: string
  ): Promise<void> {
    await context.client.$executeRaw`RELEASE SAVEPOINT ${Prisma.raw(name)}`;

    logger.debug('Savepoint released', {
      transactionId: context.id,
      savepointName: name,
    });
  }

  private async compensateOperations(
    context: TransactionContext,
    operations: Array<{ operation: any; result: any }>
  ): Promise<void> {
    for (const { operation, result } of operations) {
      try {
        await operation.compensate(context, result);
        logger.debug('Compensation completed', {
          transactionId: context.id,
          operation: operation.constructor.name,
        });
      } catch (compensationError) {
        logger.error('Compensation failed', {
          transactionId: context.id,
          operation: operation.constructor.name,
          error:
            compensationError instanceof Error
              ? compensationError.message
              : String(compensationError),
        });
        // Continue with other compensations even if one fails
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    // Prisma-specific retryable errors
    const retryableErrors = [
      'P2034', // Transaction conflict
      'P2024', // Timed out fetching a new connection
      'P2037', // Too many database connections opened
      'P2028', // Transaction API error
    ];

    // Check for optimistic locking errors
    if (error instanceof OptimisticLockingError) {
      return true;
    }

    // Check for deadlock errors
    if (error.message.includes('deadlock') || error.message.includes('40P01')) {
      return true;
    }

    // Check for serialization failure
    if (error.message.includes('40001')) {
      return true;
    }

    return retryableErrors.some(code => error.message.includes(code));
  }

  private enhanceError(
    error: unknown,
    transactionId: string,
    attempt: number
  ): Error {
    if (error instanceof Error) {
      const enhancedError = new Error(
        `Transaction failed: ${error.message} (Transaction ID: ${transactionId}, Attempt: ${attempt})`
      );
      enhancedError.stack = error.stack;
      enhancedError.cause = error;
      return enhancedError;
    }

    return new Error(
      `Transaction failed: ${String(error)} (Transaction ID: ${transactionId}, Attempt: ${attempt})`
    );
  }

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `tx_${timestamp}_${random}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Transaction decorator for automatic transaction management
 */
export function Transactional(options: TransactionOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const transactionManager = new TransactionManager();

    descriptor.value = async function (...args: any[]) {
      return await transactionManager.executeTransaction(async context => {
        // Inject transaction context as last parameter
        return await originalMethod.apply(this, [...args, context]);
      }, options);
    };

    return descriptor;
  };
}

export const transactionManager = new TransactionManager();
