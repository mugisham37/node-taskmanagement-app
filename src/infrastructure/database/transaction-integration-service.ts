import { TransactionManager } from './transaction-manager';
import { LoggingService } from '../monitoring/logging-service';
import { MetricsService } from '../monitoring/metrics-service';
import { DomainEvent } from '../../domain/events/domain-event';

/**
 * Transaction Integration Service
 *
 * Provides comprehensive transaction management integration throughout the application,
 * ensuring ACID properties for all database operations and proper event handling
 * within transaction boundaries.
 */
export class TransactionIntegrationService {
  private readonly activeTransactions = new Map<
    string,
    {
      id: string;
      startTime: Date;
      operations: string[];
      events: DomainEvent[];
    }
  >();

  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Execute a use case within a transaction boundary
   */
  async executeUseCase<T>(
    useCaseName: string,
    operation: () => Promise<T>,
    options: {
      isolationLevel?:
        | 'READ_UNCOMMITTED'
        | 'READ_COMMITTED'
        | 'REPEATABLE_READ'
        | 'SERIALIZABLE';
      timeout?: number;
      retryOnConflict?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const transactionId = this.generateTransactionId();
    const timer = this.metrics.startTimer('transaction_duration');

    this.activeTransactions.set(transactionId, {
      id: transactionId,
      startTime: new Date(),
      operations: [useCaseName],
      events: [],
    });

    try {
      this.logger.info('Starting transaction for use case', {
        transactionId,
        useCaseName,
        options,
      });

      const result = await this.transactionManager.executeInTransaction(
        async () => {
          const result = await operation();

          // Record successful operation
          const transaction = this.activeTransactions.get(transactionId);
          if (transaction) {
            transaction.operations.push(`${useCaseName}:completed`);
          }

          return result;
        },
        {
          isolationLevel: options.isolationLevel,
          timeout: options.timeout,
        }
      );

      const duration = timer.end();
      this.metrics.incrementCounter('transactions_committed_total');
      this.metrics.recordHistogram('transaction_duration', duration);

      this.logger.info('Transaction committed successfully', {
        transactionId,
        useCaseName,
        duration,
      });

      return result;
    } catch (error) {
      timer.end();
      this.metrics.incrementCounter('transactions_rolled_back_total');

      this.logger.error('Transaction rolled back', error as Error, {
        transactionId,
        useCaseName,
      });

      // Handle retry logic if enabled
      if (options.retryOnConflict && this.isConflictError(error as Error)) {
        const maxRetries = options.maxRetries || 3;
        return this.retryWithBackoff(
          () =>
            this.executeUseCase(useCaseName, operation, {
              ...options,
              retryOnConflict: false,
            }),
          maxRetries,
          useCaseName
        );
      }

      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Execute multiple operations within a single transaction
   */
  async executeMultipleOperations<T>(
    operationName: string,
    operations: Array<{
      name: string;
      operation: () => Promise<any>;
    }>
  ): Promise<T[]> {
    const transactionId = this.generateTransactionId();
    const timer = this.metrics.startTimer(
      'multi_operation_transaction_duration'
    );

    this.activeTransactions.set(transactionId, {
      id: transactionId,
      startTime: new Date(),
      operations: operations.map(op => op.name),
      events: [],
    });

    try {
      this.logger.info('Starting multi-operation transaction', {
        transactionId,
        operationName,
        operationCount: operations.length,
      });

      const results = await this.transactionManager.executeInTransaction(
        async () => {
          const results: any[] = [];

          for (const { name, operation } of operations) {
            this.logger.debug('Executing operation within transaction', {
              transactionId,
              operationName: name,
            });

            const result = await operation();
            results.push(result);

            // Record operation completion
            const transaction = this.activeTransactions.get(transactionId);
            if (transaction) {
              transaction.operations.push(`${name}:completed`);
            }
          }

          return results;
        }
      );

      const duration = timer.end();
      this.metrics.incrementCounter(
        'multi_operation_transactions_committed_total'
      );
      this.metrics.recordHistogram(
        'multi_operation_transaction_duration',
        duration
      );

      this.logger.info('Multi-operation transaction committed successfully', {
        transactionId,
        operationName,
        operationCount: operations.length,
        duration,
      });

      return results;
    } catch (error) {
      timer.end();
      this.metrics.incrementCounter(
        'multi_operation_transactions_rolled_back_total'
      );

      this.logger.error(
        'Multi-operation transaction rolled back',
        error as Error,
        {
          transactionId,
          operationName,
          operationCount: operations.length,
        }
      );

      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Execute command handler with transaction support
   */
  async executeCommandHandler<TCommand, TResult>(
    handlerName: string,
    command: TCommand,
    handler: (command: TCommand) => Promise<TResult>
  ): Promise<TResult> {
    return this.executeUseCase(
      `CommandHandler:${handlerName}`,
      () => handler(command),
      {
        retryOnConflict: true,
        maxRetries: 3,
      }
    );
  }

  /**
   * Execute repository operation with transaction support
   */
  async executeRepositoryOperation<T>(
    repositoryName: string,
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.executeUseCase(
      `Repository:${repositoryName}:${operationName}`,
      operation,
      {
        retryOnConflict: true,
        maxRetries: 2,
      }
    );
  }

  /**
   * Execute domain service operation with transaction support
   */
  async executeDomainServiceOperation<T>(
    serviceName: string,
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.executeUseCase(
      `DomainService:${serviceName}:${operationName}`,
      operation,
      {
        retryOnConflict: false, // Domain services should handle their own retry logic
      }
    );
  }

  /**
   * Add domain events to the current transaction context
   */
  addDomainEventsToTransaction(
    transactionId: string,
    events: DomainEvent[]
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (transaction) {
      transaction.events.push(...events);
    }
  }

  /**
   * Get domain events from transaction context
   */
  getDomainEventsFromTransaction(transactionId: string): DomainEvent[] {
    const transaction = this.activeTransactions.get(transactionId);
    return transaction ? [...transaction.events] : [];
  }

  /**
   * Get active transaction statistics
   */
  getActiveTransactionStats(): {
    activeCount: number;
    longestRunning?: {
      id: string;
      duration: number;
      operations: string[];
    };
    averageDuration: number;
  } {
    const active = Array.from(this.activeTransactions.values());
    const now = new Date();

    let longestRunning:
      | { id: string; duration: number; operations: string[] }
      | undefined;
    let totalDuration = 0;

    active.forEach(transaction => {
      const duration = now.getTime() - transaction.startTime.getTime();
      totalDuration += duration;

      if (!longestRunning || duration > longestRunning.duration) {
        longestRunning = {
          id: transaction.id,
          duration,
          operations: transaction.operations,
        };
      }
    });

    return {
      activeCount: active.length,
      longestRunning,
      averageDuration: active.length > 0 ? totalDuration / active.length : 0,
    };
  }

  /**
   * Health check for transaction system
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    activeTransactions: number;
    connectionPoolStatus: string;
    lastError?: string;
  }> {
    try {
      // Check transaction manager health
      const isHealthy = await this.transactionManager.isHealthy();

      return {
        isHealthy,
        activeTransactions: this.activeTransactions.size,
        connectionPoolStatus: 'healthy',
      };
    } catch (error) {
      return {
        isHealthy: false,
        activeTransactions: this.activeTransactions.size,
        connectionPoolStatus: 'unhealthy',
        lastError: (error as Error).message,
      };
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if error is a database conflict error
   */
  private isConflictError(error: Error): boolean {
    const conflictMessages = [
      'deadlock',
      'lock timeout',
      'serialization failure',
      'could not serialize access',
    ];

    return conflictMessages.some(message =>
      error.message.toLowerCase().includes(message)
    );
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    operationName: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);

        if (attempt > 1) {
          this.logger.info('Retrying operation after conflict', {
            operationName,
            attempt,
            delay,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries || !this.isConflictError(lastError)) {
          break;
        }

        this.metrics.incrementCounter('transaction_retries_total', {
          operationName,
          attempt: attempt.toString(),
        });
      }
    }

    this.metrics.incrementCounter('transaction_retry_failures_total', {
      operationName,
    });

    throw lastError!;
  }
}
