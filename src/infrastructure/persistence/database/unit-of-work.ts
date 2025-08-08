import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma-client';
import { logger } from '../logging/logger';

export interface IUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  saveChanges(): Promise<void>;
  isInTransaction(): boolean;
  getClient(): PrismaClient | Prisma.TransactionClient;
}

export class PrismaUnitOfWork implements IUnitOfWork {
  private transaction: Prisma.TransactionClient | null = null;
  private isTransactionActive = false;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(private readonly client: PrismaClient = prisma) {}

  public async begin(): Promise<void> {
    if (this.isTransactionActive) {
      throw new Error('Transaction is already active');
    }

    try {
      // Start an interactive transaction
      await this.client.$transaction(
        async tx => {
          this.transaction = tx;
          this.isTransactionActive = true;

          // Keep the transaction alive until explicitly committed or rolled back
          return new Promise<void>((resolve, reject) => {
            // Store resolve/reject for later use
            (this as any)._transactionResolve = resolve;
            (this as any)._transactionReject = reject;
          });
        },
        {
          maxWait: 30000, // 30 seconds
          timeout: 60000, // 60 seconds
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        }
      );
    } catch (error) {
      this.isTransactionActive = false;
      this.transaction = null;
      logger.error('Failed to begin transaction', { error });
      throw error;
    }
  }

  public async commit(): Promise<void> {
    if (!this.isTransactionActive || !this.transaction) {
      throw new Error('No active transaction to commit');
    }

    try {
      // Resolve the transaction promise to commit
      if ((this as any)._transactionResolve) {
        (this as any)._transactionResolve();
      }

      this.isTransactionActive = false;
      this.transaction = null;
      logger.debug('Transaction committed successfully');
    } catch (error) {
      logger.error('Failed to commit transaction', { error });
      await this.rollback();
      throw error;
    }
  }

  public async rollback(): Promise<void> {
    if (!this.isTransactionActive) {
      return; // No active transaction to rollback
    }

    try {
      // Reject the transaction promise to rollback
      if ((this as any)._transactionReject) {
        (this as any)._transactionReject(new Error('Transaction rolled back'));
      }

      this.isTransactionActive = false;
      this.transaction = null;
      logger.debug('Transaction rolled back successfully');
    } catch (error) {
      logger.error('Failed to rollback transaction', { error });
      throw error;
    }
  }

  public async saveChanges(): Promise<void> {
    // In Prisma, changes are automatically saved when the transaction commits
    // This method is here for interface compatibility
    if (this.isTransactionActive) {
      await this.commit();
    }
  }

  public isInTransaction(): boolean {
    return this.isTransactionActive;
  }

  public getClient(): PrismaClient | Prisma.TransactionClient {
    return this.transaction || this.client;
  }

  // Utility method for executing operations with retry logic
  public async executeWithRetry<T>(
    operation: (client: PrismaClient | Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const client = this.getClient();
        return await operation(client);
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          logger.warn(
            `Operation failed, retrying (${attempt}/${this.maxRetries})`,
            {
              error: error instanceof Error ? error.message : String(error),
              attempt,
            }
          );

          await this.delay(this.retryDelay * attempt);
          continue;
        }

        // If not retryable or max retries reached, throw the error
        throw error;
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const retryableErrors = [
      'P2034', // Transaction conflict
      'P2024', // Timed out fetching a new connection
      'P2037', // Too many database connections opened
    ];

    return retryableErrors.some(code => error.message.includes(code));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for creating unit of work instances
export function createUnitOfWork(client?: PrismaClient): IUnitOfWork {
  return new PrismaUnitOfWork(client);
}

// Decorator for automatic transaction management
export function Transactional(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const uow = createUnitOfWork();

    try {
      await uow.begin();
      const result = await originalMethod.apply(this, [...args, uow]);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  };

  return descriptor;
}
