import { TaskRepository } from '../../task-management/repositories/TaskRepository';
import { ProjectRepository } from '../../task-management/repositories/ProjectRepository';
import { WorkspaceRepository } from '../../task-management/repositories/WorkspaceRepository';
import { TeamRepository } from '../../task-management/repositories/TeamRepository';

/**
 * Unit of Work pattern implementation for managing transactions
 * across multiple repositories and ensuring data consistency
 */
export interface IUnitOfWork {
  /**
   * Begin a new transaction
   */
  begin(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Save all changes in the current transaction
   */
  saveChanges(): Promise<void>;

  /**
   * Check if currently in a transaction
   */
  isInTransaction(): boolean;

  /**
   * Get the current transaction ID
   */
  getTransactionId(): string | null;

  /**
   * Repository access - all repositories share the same transaction context
   */
  readonly tasks: TaskRepository;
  readonly projects: ProjectRepository;
  readonly workspaces: WorkspaceRepository;
  readonly teams: TeamRepository;
  // Add other repositories as needed
}

/**
 * Transaction scope for managing nested transactions
 */
export interface ITransactionScope {
  /**
   * Execute a function within a transaction scope
   */
  execute<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T>;

  /**
   * Execute multiple operations in a single transaction
   */
  executeBatch<T>(
    operations: Array<(uow: IUnitOfWork) => Promise<T>>
  ): Promise<T[]>;
}

/**
 * Transaction options for controlling transaction behavior
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level
   */
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';

  /**
   * Transaction timeout in milliseconds
   */
  timeout?: number;

  /**
   * Whether to automatically retry on deadlock
   */
  retryOnDeadlock?: boolean;

  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;

  /**
   * Custom transaction name for debugging
   */
  name?: string;
}

/**
 * Abstract base class for Unit of Work implementations
 */
export abstract class BaseUnitOfWork implements IUnitOfWork {
  protected _isInTransaction = false;
  protected _transactionId: string | null = null;

  abstract begin(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract saveChanges(): Promise<void>;

  isInTransaction(): boolean {
    return this._isInTransaction;
  }

  getTransactionId(): string | null {
    return this._transactionId;
  }

  abstract readonly tasks: TaskRepository;
  abstract readonly projects: ProjectRepository;
  abstract readonly workspaces: WorkspaceRepository;
  abstract readonly teams: TeamRepository;

  /**
   * Template method for transaction execution with error handling
   */
  protected async executeInTransaction<T>(
    operation: () => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.begin();
        const result = await operation();
        await this.commit();
        return result;
      } catch (error) {
        await this.rollback();

        if (
          this.isDeadlockError(error) &&
          options?.retryOnDeadlock &&
          attempt < maxRetries - 1
        ) {
          attempt++;
          await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
          continue;
        }

        throw error;
      }
    }

    throw new Error(`Transaction failed after ${maxRetries} attempts`);
  }

  /**
   * Check if error is a deadlock error (implementation specific)
   */
  protected abstract isDeadlockError(error: any): boolean;

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Transaction scope implementation
 */
export class TransactionScope implements ITransactionScope {
  constructor(private unitOfWorkFactory: () => IUnitOfWork) {}

  async execute<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const uow = this.unitOfWorkFactory();

    try {
      await uow.begin();
      const result = await operation(uow);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }

  async executeBatch<T>(
    operations: Array<(uow: IUnitOfWork) => Promise<T>>
  ): Promise<T[]> {
    const uow = this.unitOfWorkFactory();

    try {
      await uow.begin();
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(uow);
        results.push(result);
      }

      await uow.commit();
      return results;
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }
}

/**
 * Decorator for automatic transaction management
 */
export function Transactional(options?: TransactionOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const uow: IUnitOfWork =
        this.unitOfWork ||
        args.find((arg: any) => arg && typeof arg.begin === 'function');

      if (!uow) {
        throw new Error('No Unit of Work found for transactional method');
      }

      if (uow.isInTransaction()) {
        // Already in transaction, just execute
        return originalMethod.apply(this, args);
      }

      // Start new transaction
      try {
        await uow.begin();
        const result = await originalMethod.apply(this, args);
        await uow.commit();
        return result;
      } catch (error) {
        await uow.rollback();
        throw error;
      }
    };

    return descriptor;
  };
}
