/**
 * Enhanced Drizzle Transaction Manager
 * Comprehensive transaction management with advanced features migrated from older version
 */

import { DomainEvent } from '@monorepo/domain';
import { logger } from '../monitoring/logging-service';
import { db } from './connection';

export interface TransactionContext {
  id: string;
  database: any; // Using any for transaction compatibility
  startTime: Date;
  operations: TransactionOperation[];
  events: DomainEvent[];
  metadata: Record<string, any>;
  savepoints: Map<string, Date>;
}

export interface TransactionOperation {
  type: 'create' | 'update' | 'delete' | 'query';
  entityType: string;
  entityId: string;
  operation: string;
  timestamp: Date;
  duration?: number;
}

export interface TransactionOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  isolationLevel?:
    | 'read uncommitted'
    | 'read committed'
    | 'repeatable read'
    | 'serializable';
}

export interface TransactionResult<T> {
  result: T;
  context: TransactionContext;
  duration: number;
  operationCount: number;
  eventCount: number;
}

export class DrizzleTransactionManager {
  private static readonly DEFAULT_OPTIONS: Required<TransactionOptions> = {
    timeout: 60000, // 60 seconds
    retryAttempts: 3,
    retryDelay: 1000,
    isolationLevel: 'read committed',
  };

  constructor(private readonly database: any = db) {}

  /**
   * Execute operation within a transaction with comprehensive error handling
   */
  async executeTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const finalOptions = {
      ...DrizzleTransactionManager.DEFAULT_OPTIONS,
      ...options,
    };
    const transactionId = this.generateTransactionId();
    const startTime = new Date();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalOptions.retryAttempts; attempt++) {
      try {
        const result = await this.database.transaction(
          async (tx: any) => {
            const context: TransactionContext = {
              id: transactionId,
              database: tx,
              startTime,
              operations: [],
              events: [],
              savepoints: new Map(),
              metadata: {
                attempt,
                maxAttempts: finalOptions.retryAttempts,
                isolationLevel: finalOptions.isolationLevel,
              },
            };

            logger.debug('Transaction started', {
              transactionId,
              attempt,
              isolationLevel: finalOptions.isolationLevel,
            });

            // Set isolation level if specified
            if (finalOptions.isolationLevel !== 'read committed') {
              await tx.execute(
                `SET TRANSACTION ISOLATION LEVEL ${finalOptions.isolationLevel.toUpperCase()}`
              );
            }

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
            // Drizzle transaction options would go here
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
        const operation = operations[i];
        if (!operation) continue;

        try {
          const operationStart = Date.now();
          const result = await operation(context);
          const operationDuration = Date.now() - operationStart;

          results.push(result);

          this.recordOperation(context, {
            type: 'query',
            entityType: 'BatchOperation',
            entityId: `batch-${i}`,
            operation: `batch-operation-${i}`,
            timestamp: new Date(),
            duration: operationDuration,
          });
        } catch (error) {
          logger.error('Batch operation failed', error as Error, {
            transactionId: context.id,
            operationIndex: i,
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
          if (!operation) continue;

          try {
            const operationStart = Date.now();
            const result = await operation.execute(context);
            const operationDuration = Date.now() - operationStart;

            results.push(result);
            executedOperations.push({ operation, result });

            this.recordOperation(context, {
              type: 'query',
              entityType: 'SagaOperation',
              entityId: `saga-${i}`,
              operation: `saga-step-${i}`,
              timestamp: new Date(),
              duration: operationDuration,
            });
          } catch (error) {
            logger.error(
              'Saga operation failed, starting compensation',
              error as Error,
              {
                transactionId: context.id,
                failedOperationIndex: i,
              }
            );

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
      logger.error('Saga transaction failed', error as Error);
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

    const totalOperationTime = context.operations.reduce(
      (sum, op) => sum + (op.duration || 0),
      0
    );
    const averageOperationTime =
      operationCount > 0 ? totalOperationTime / operationCount : 0;

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
    await context.database.execute(`SAVEPOINT ${name}`);
    context.savepoints.set(name, new Date());

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
    await context.database.execute(`ROLLBACK TO SAVEPOINT ${name}`);

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
    await context.database.execute(`RELEASE SAVEPOINT ${name}`);
    context.savepoints.delete(name);

    logger.debug('Savepoint released', {
      transactionId: context.id,
      savepointName: name,
    });
  }

  /**
   * Execute operation with automatic savepoint management
   */
  async executeWithSavepoint<T>(
    context: TransactionContext,
    operation: () => Promise<T>,
    savepointName?: string
  ): Promise<T> {
    const name = savepointName || `sp_${Date.now()}`;

    await this.createSavepoint(context, name);

    try {
      const result = await operation();
      await this.releaseSavepoint(context, name);
      return result;
    } catch (error) {
      await this.rollbackToSavepoint(context, name);
      throw error;
    }
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
        logger.error('Compensation failed', compensationError as Error, {
          transactionId: context.id,
          operation: operation.constructor.name,
        });
        // Continue with other compensations even if one fails
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    // PostgreSQL-specific retryable errors
    const retryableErrors = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '53300', // too_many_connections
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
    ];

    // Check for deadlock errors
    if (error.message.includes('deadlock') || error.message.includes('40P01')) {
      return true;
    }

    // Check for serialization failure
    if (error.message.includes('40001')) {
      return true;
    }

    // Check for connection issues
    if (
      error.message.includes('connection') &&
      error.message.includes('failed')
    ) {
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
      if (error.stack !== undefined) {
        enhancedError.stack = error.stack;
      }
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
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const transactionManager = new DrizzleTransactionManager();

    descriptor.value = async function (...args: any[]) {
      return await transactionManager.executeTransaction(async context => {
        // Inject transaction context as last parameter
        return await originalMethod.apply(this, [...args, context]);
      }, options);
    };

    return descriptor;
  };
}

export const drizzleTransactionManager = new DrizzleTransactionManager();
