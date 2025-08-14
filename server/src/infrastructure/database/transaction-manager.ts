import { DatabaseConnection } from './connection';
import { PoolClient } from 'pg';

export interface TransactionOptions {
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
  timeout?: number; // in milliseconds
  retryAttempts?: number;
  retryDelay?: number; // in milliseconds
}

export interface TransactionContext {
  client: PoolClient;
  isActive: boolean;
  startTime: Date;
  isolationLevel?: string;
}

export class TransactionManager {
  private connection: DatabaseConnection;
  private activeTransactions = new Map<string, TransactionContext>();

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Execute a function within a database transaction
   */
  async executeInTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      isolationLevel = 'READ_COMMITTED',
      timeout = 30000,
      retryAttempts = 3,
      retryDelay = 1000,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      const client = await this.connection.pool.connect();
      const transactionId = this.generateTransactionId();

      try {
        // Start transaction
        await client.query('BEGIN');

        // Set isolation level if specified
        if (isolationLevel !== 'READ_COMMITTED') {
          await client.query(
            `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
          );
        }

        // Set timeout if specified
        if (timeout > 0) {
          await client.query(`SET statement_timeout = ${timeout}`);
        }

        // Track active transaction
        const context: TransactionContext = {
          client,
          isActive: true,
          startTime: new Date(),
          isolationLevel,
        };
        this.activeTransactions.set(transactionId, context);

        // Execute the operation
        const result = await operation(client);

        // Commit transaction
        await client.query('COMMIT');

        // Clean up
        this.activeTransactions.delete(transactionId);
        client.release();

        return result;
      } catch (error) {
        lastError = error as Error;

        try {
          // Rollback transaction
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }

        // Clean up
        this.activeTransactions.delete(transactionId);
        client.release();

        // Check if we should retry
        if (attempt < retryAttempts && this.shouldRetry(error as Error)) {
          console.warn(
            `Transaction attempt ${attempt} failed, retrying in ${retryDelay}ms:`,
            error
          );
          await this.delay(retryDelay);
          continue;
        }

        // Re-throw the error if we've exhausted retries or shouldn't retry
        throw error;
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Transaction failed after all retry attempts');
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeMultipleInTransaction<T>(
    operations: Array<(client: PoolClient) => Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.executeInTransaction(async client => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }

      return results;
    }, options);
  }

  /**
   * Execute a batch of operations with savepoints
   */
  async executeWithSavepoints<T>(
    operations: Array<{
      name: string;
      operation: (client: PoolClient) => Promise<T>;
      onError?: (error: Error) => Promise<void>;
    }>,
    options: TransactionOptions = {}
  ): Promise<Array<{ name: string; result?: T; error?: Error }>> {
    return this.executeInTransaction(async client => {
      const results: Array<{ name: string; result?: T; error?: Error }> = [];

      for (const { name, operation, onError } of operations) {
        const savepointName = `sp_${name}_${Date.now()}`;

        try {
          // Create savepoint
          await client.query(`SAVEPOINT ${savepointName}`);

          // Execute operation
          const result = await operation(client);
          results.push({ name, result });

          // Release savepoint
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        } catch (error) {
          // Rollback to savepoint
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);

          results.push({ name, error: error as Error });

          // Execute error handler if provided
          if (onError) {
            try {
              await onError(error as Error);
            } catch (handlerError) {
              console.error(`Error handler for ${name} failed:`, handlerError);
            }
          }
        }
      }

      return results;
    }, options);
  }

  /**
   * Get information about active transactions
   */
  getActiveTransactions(): Array<{
    id: string;
    startTime: Date;
    duration: number;
    isolationLevel?: string;
  }> {
    const now = new Date();
    return Array.from(this.activeTransactions.entries()).map(
      ([id, context]) => ({
        id,
        startTime: context.startTime,
        duration: now.getTime() - context.startTime.getTime(),
        isolationLevel: context.isolationLevel,
      })
    );
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStatistics(): Promise<{
    activeTransactions: number;
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
  }> {
    const connectionInfo = await this.connection.getConnectionInfo();

    return {
      activeTransactions: this.activeTransactions.size,
      totalConnections: connectionInfo.totalConnections,
      idleConnections: connectionInfo.idleConnections,
      waitingConnections:
        connectionInfo.totalConnections -
        connectionInfo.activeConnections -
        connectionInfo.idleConnections,
    };
  }

  /**
   * Force cleanup of long-running transactions
   */
  async cleanupLongRunningTransactions(
    maxDurationMs: number = 300000
  ): Promise<number> {
    const now = new Date();
    let cleanedUp = 0;

    for (const [id, context] of this.activeTransactions.entries()) {
      const duration = now.getTime() - context.startTime.getTime();

      if (duration > maxDurationMs) {
        try {
          await context.client.query('ROLLBACK');
          context.client.release();
          this.activeTransactions.delete(id);
          cleanedUp++;

          console.warn(
            `Cleaned up long-running transaction ${id} (duration: ${duration}ms)`
          );
        } catch (error) {
          console.error(`Failed to cleanup transaction ${id}:`, error);
        }
      }
    }

    return cleanedUp;
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldRetry(error: Error): boolean {
    // Retry on serialization failures, deadlocks, and connection issues
    const retryableErrors = [
      'serialization_failure',
      'deadlock_detected',
      'connection_failure',
      'connection_does_not_exist',
      'connection_exception',
    ];

    return retryableErrors.some(
      errorType =>
        error.message.toLowerCase().includes(errorType) ||
        (error as any).code === '40001' || // serialization_failure
        (error as any).code === '40P01' // deadlock_detected
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export function createTransactionManager(
  connection: DatabaseConnection
): TransactionManager {
  return new TransactionManager(connection);
}
