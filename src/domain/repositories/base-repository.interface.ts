/**
 * Base repository interface
 * Defines common repository operations for all entities
 */
export interface IBaseRepository<TEntity, TId> {
  /**
   * Find an entity by its ID
   */
  findById(id: TId): Promise<TEntity | null>;

  /**
   * Find multiple entities by their IDs
   */
  findByIds(ids: TId[]): Promise<TEntity[]>;

  /**
   * Find all entities matching the given criteria
   */
  findBy(criteria: Partial<TEntity>): Promise<TEntity[]>;

  /**
   * Find the first entity matching the given criteria
   */
  findOneBy(criteria: Partial<TEntity>): Promise<TEntity | null>;

  /**
   * Find all entities
   */
  findAll(): Promise<TEntity[]>;

  /**
   * Save an entity (create or update)
   */
  save(entity: TEntity): Promise<void>;

  /**
   * Save multiple entities
   */
  saveMany(entities: TEntity[]): Promise<void>;

  /**
   * Delete an entity by ID
   */
  delete(id: TId): Promise<void>;

  /**
   * Delete multiple entities by IDs
   */
  deleteMany(ids: TId[]): Promise<void>;

  /**
   * Delete entities matching criteria
   */
  deleteBy(criteria: Partial<TEntity>): Promise<number>;

  /**
   * Check if an entity exists by ID
   */
  exists(id: TId): Promise<boolean>;

  /**
   * Check if entities exist by criteria
   */
  existsBy(criteria: Partial<TEntity>): Promise<boolean>;

  /**
   * Count entities matching criteria
   */
  count(criteria?: Partial<TEntity>): Promise<number>;

  /**
   * Update entities matching criteria
   */
  updateBy(
    criteria: Partial<TEntity>,
    updates: Partial<TEntity>
  ): Promise<number>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Sort options
 */
export interface SortOptions<T = any> {
  field: keyof T;
  direction: 'ASC' | 'DESC';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Extended repository interface with pagination and sorting
 */
export interface IPaginatedRepository<TEntity, TId>
  extends IBaseRepository<TEntity, TId> {
  /**
   * Find entities with pagination
   */
  findWithPagination(
    criteria?: Partial<TEntity>,
    pagination?: PaginationOptions,
    sort?: SortOptions<TEntity>[]
  ): Promise<PaginatedResult<TEntity>>;

  /**
   * Search entities with pagination
   */
  searchWithPagination(
    searchTerm: string,
    searchFields: (keyof TEntity)[],
    pagination?: PaginationOptions,
    sort?: SortOptions<TEntity>[]
  ): Promise<PaginatedResult<TEntity>>;
}

/**
 * Transaction context interface
 */
export interface ITransactionContext {
  readonly id: string;
  readonly isActive: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Repository interface with transaction support
 */
export interface ITransactionalRepository<TEntity, TId>
  extends IBaseRepository<TEntity, TId> {
  /**
   * Execute operations within a transaction
   */
  withTransaction<T>(
    operation: (context: ITransactionContext) => Promise<T>
  ): Promise<T>;

  /**
   * Save entity within a transaction context
   */
  saveInTransaction(
    entity: TEntity,
    context: ITransactionContext
  ): Promise<void>;

  /**
   * Delete entity within a transaction context
   */
  deleteInTransaction(id: TId, context: ITransactionContext): Promise<void>;
}
