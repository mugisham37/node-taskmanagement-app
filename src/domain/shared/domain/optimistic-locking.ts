/**
 * Optimistic Locking Implementation
 * Provides version-based concurrency control for domain entities
 */

import { DomainError } from '../errors/domain-error';

export class OptimisticLockingError extends DomainError {
  constructor(
    entityType: string,
    entityId: string,
    expectedVersion: number,
    actualVersion: number
  ) {
    super(
      `Optimistic locking failed for ${entityType} with ID ${entityId}. ` +
        `Expected version ${expectedVersion}, but found version ${actualVersion}. ` +
        `The entity has been modified by another process.`,
      {
        entityType,
        entityId,
        expectedVersion,
        actualVersion,
        errorCode: 'OPTIMISTIC_LOCK_FAILED',
      }
    );
  }
}

export interface VersionedEntity {
  id: string;
  version: number;
  incrementVersion(): void;
  checkVersion(expectedVersion: number): void;
}

export class OptimisticLockManager {
  /**
   * Check if the entity version matches the expected version
   */
  static checkVersion(
    entity: VersionedEntity,
    expectedVersion: number,
    entityType: string = 'Entity'
  ): void {
    if (entity.version !== expectedVersion) {
      throw new OptimisticLockingError(
        entityType,
        entity.id,
        expectedVersion,
        entity.version
      );
    }
  }

  /**
   * Increment entity version for optimistic locking
   */
  static incrementVersion(entity: VersionedEntity): void {
    entity.incrementVersion();
  }

  /**
   * Create a version check function for repository operations
   */
  static createVersionChecker(entityType: string) {
    return (entity: VersionedEntity, expectedVersion: number) => {
      this.checkVersion(entity, expectedVersion, entityType);
    };
  }

  /**
   * Handle concurrent modification with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 100
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (error instanceof OptimisticLockingError && attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          await this.delay(retryDelay * Math.pow(2, attempt - 1));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic optimistic locking
 */
export function OptimisticLock(entityType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const entity = args[0];
      const expectedVersion = args[1];

      if (
        entity &&
        typeof entity.version === 'number' &&
        expectedVersion !== undefined
      ) {
        OptimisticLockManager.checkVersion(entity, expectedVersion, entityType);
      }

      const result = await originalMethod.apply(this, args);

      if (entity && typeof entity.incrementVersion === 'function') {
        OptimisticLockManager.incrementVersion(entity);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Versioned aggregate root base class
 */
export abstract class VersionedAggregateRoot implements VersionedEntity {
  protected _version: number = 1;

  constructor(
    public readonly id: string,
    version?: number
  ) {
    if (version !== undefined) {
      this._version = version;
    }
  }

  get version(): number {
    return this._version;
  }

  incrementVersion(): void {
    this._version += 1;
  }

  checkVersion(expectedVersion: number): void {
    OptimisticLockManager.checkVersion(
      this,
      expectedVersion,
      this.constructor.name
    );
  }

  /**
   * Update entity with version check
   */
  protected updateWithVersionCheck(
    expectedVersion: number,
    updateFn: () => void
  ): void {
    this.checkVersion(expectedVersion);
    updateFn();
    this.incrementVersion();
  }
}

/**
 * Repository interface with optimistic locking support
 */
export interface OptimisticLockingRepository<T extends VersionedEntity> {
  /**
   * Find entity by ID and lock it for update
   */
  findByIdForUpdate(id: string): Promise<T | null>;

  /**
   * Update entity with version check
   */
  updateWithVersionCheck(entity: T, expectedVersion: number): Promise<T>;

  /**
   * Save entity with automatic version increment
   */
  saveWithVersionIncrement(entity: T): Promise<T>;

  /**
   * Get current version of entity
   */
  getVersion(id: string): Promise<number | null>;
}

/**
 * Concurrent operation manager
 */
export class ConcurrentOperationManager {
  private static readonly locks = new Map<string, Promise<any>>();

  /**
   * Execute operation with exclusive lock on entity
   */
  static async withLock<T>(
    entityId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const lockKey = `lock:${entityId}`;

    // Wait for existing lock to complete
    if (this.locks.has(lockKey)) {
      await this.locks.get(lockKey);
    }

    // Create new lock
    const lockPromise = this.executeLocked(operation);
    this.locks.set(lockKey, lockPromise);

    try {
      const result = await lockPromise;
      return result;
    } finally {
      this.locks.delete(lockKey);
    }
  }

  private static async executeLocked<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await operation();
  }

  /**
   * Execute multiple operations with ordered locking to prevent deadlocks
   */
  static async withOrderedLocks<T>(
    entityIds: string[],
    operation: () => Promise<T>
  ): Promise<T> {
    // Sort entity IDs to ensure consistent lock ordering
    const sortedIds = [...entityIds].sort();

    return await this.acquireLocksRecursively(sortedIds, 0, operation);
  }

  private static async acquireLocksRecursively<T>(
    entityIds: string[],
    index: number,
    operation: () => Promise<T>
  ): Promise<T> {
    if (index >= entityIds.length) {
      return await operation();
    }

    return await this.withLock(entityIds[index], () =>
      this.acquireLocksRecursively(entityIds, index + 1, operation)
    );
  }
}
