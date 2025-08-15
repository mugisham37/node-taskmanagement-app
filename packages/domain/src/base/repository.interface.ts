/**
 * Base specification interface for query objects
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
}

/**
 * Base specification interface for query objects (aliased for consistency)
 */
export interface ISpecification<T> extends Specification<T> {}

/**
 * Pagination options for repository queries
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination options interface (aliased for consistency)
 */
export interface IPaginationOptions extends PaginationOptions {}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated result interface (aliased for consistency)
 */
export interface IPaginatedResult<T> extends PaginatedResult<T> {}

/**
 * Sort options for repository queries
 */
export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Base repository interface that all repositories must implement
 */
export interface IRepository<TEntity, TId = string> {
  /**
   * Find entity by ID
   */
  findById(id: TId): Promise<TEntity | null>;

  /**
   * Find multiple entities by IDs
   */
  findByIds(ids: TId[]): Promise<TEntity[]>;

  /**
   * Find all entities with optional pagination
   */
  findAll(options?: PaginationOptions): Promise<PaginatedResult<TEntity>>;

  /**
   * Save an entity (create or update)
   */
  save(entity: TEntity): Promise<TEntity>;

  /**
   * Delete an entity by ID
   */
  delete(id: TId): Promise<void>;

  /**
   * Check if an entity exists by ID
   */
  exists(id: TId): Promise<boolean>;

  /**
   * Count total entities
   */
  count(): Promise<number>;

  /**
   * Delete multiple entities by IDs
   */
  deleteMany(ids: TId[]): Promise<void>;

  /**
   * Find entities by specification
   */
  findBySpecification?(
    specification: Specification<TEntity>,
    options?: PaginationOptions
  ): Promise<PaginatedResult<TEntity>>;
}

/**
 * Context for database transactions
 */
export interface TransactionContext {
  database: any;
  [key: string]: any;
}

/**
 * Repository with transaction support
 */
export interface ITransactionalRepository<TEntity, TId = string> extends IRepository<TEntity, TId> {
  /**
   * Execute operations within a transaction
   */
  withTransaction<T>(
    callback: (context: TransactionContext) => Promise<T>
  ): Promise<T>;
}

/**
 * Log context for audit operations
 */
export interface LogContext {
  entityId?: string;
  userId?: string;
  changes?: Record<string, any>;
  timestamp?: Date;
  metadata?: Record<string, any>;
  ids?: any;
  id?: any;
  error?: any;
  pagination?: any;
  count?: any;
  query?: any;
  action?: string;
  [key: string]: any;
}
