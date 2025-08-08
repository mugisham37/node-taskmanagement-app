import { BaseEntity, AggregateRoot } from './base-entity';

/**
 * Base repository interface for all domain repositories
 */
export interface BaseRepository<T extends BaseEntity, ID = string> {
  /**
   * Find entity by ID
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find multiple entities by IDs
   */
  findByIds(ids: ID[]): Promise<T[]>;

  /**
   * Check if entity exists
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Save entity (create or update)
   */
  save(entity: T): Promise<T>;

  /**
   * Save multiple entities
   */
  saveAll(entities: T[]): Promise<T[]>;

  /**
   * Delete entity by ID
   */
  delete(id: ID): Promise<void>;

  /**
   * Delete multiple entities by IDs
   */
  deleteAll(ids: ID[]): Promise<void>;

  /**
   * Count total entities
   */
  count(): Promise<number>;
}

/**
 * Repository interface for aggregate roots with additional capabilities
 */
export interface AggregateRepository<T extends AggregateRoot, ID = string>
  extends BaseRepository<T, ID> {
  /**
   * Find aggregate by ID and lock it for update
   */
  findByIdForUpdate(id: ID): Promise<T | null>;

  /**
   * Save aggregate and publish its domain events
   */
  saveAndPublishEvents(aggregate: T): Promise<T>;

  /**
   * Get aggregate version
   */
  getVersion(id: ID): Promise<number | null>;
}

/**
 * Query specification interface for complex queries
 */
export interface Specification<T> {
  /**
   * Check if entity satisfies the specification
   */
  isSatisfiedBy(entity: T): boolean;

  /**
   * Convert specification to query criteria
   */
  toQueryCriteria(): QueryCriteria;
}

/**
 * Query criteria for repository queries
 */
export interface QueryCriteria {
  where?: Record<string, any>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
  include?: string[];
}

/**
 * Paginated result interface
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Sorting parameters
 */
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Extended repository interface with query capabilities
 */
export interface QueryableRepository<T extends BaseEntity, ID = string>
  extends BaseRepository<T, ID> {
  /**
   * Find entities by specification
   */
  findBySpecification(spec: Specification<T>): Promise<T[]>;

  /**
   * Find entities with pagination
   */
  findWithPagination(
    criteria: QueryCriteria,
    pagination: PaginationParams
  ): Promise<PaginatedResult<T>>;

  /**
   * Find entities by criteria
   */
  findByCriteria(criteria: QueryCriteria): Promise<T[]>;

  /**
   * Find first entity by criteria
   */
  findFirstByCriteria(criteria: QueryCriteria): Promise<T | null>;

  /**
   * Count entities by criteria
   */
  countByCriteria(criteria: QueryCriteria): Promise<number>;
}

/**
 * Transaction interface for unit of work pattern
 */
export interface Transaction {
  /**
   * Commit the transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>;

  /**
   * Check if transaction is active
   */
  isActive(): boolean;
}

/**
 * Unit of work interface for managing transactions
 */
export interface UnitOfWork {
  /**
   * Begin a new transaction
   */
  begin(): Promise<Transaction>;

  /**
   * Execute work within a transaction
   */
  execute<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;

  /**
   * Get repository within transaction context
   */
  getRepository<R>(repositoryType: new (...args: any[]) => R): R;
}

/**
 * Base specification class
 */
export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(entity: T): boolean;
  abstract toQueryCriteria(): QueryCriteria;

  /**
   * Combine specifications with AND logic
   */
  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  /**
   * Combine specifications with OR logic
   */
  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  /**
   * Negate specification
   */
  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

/**
 * AND specification
 */
class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }

  toQueryCriteria(): QueryCriteria {
    const leftCriteria = this.left.toQueryCriteria();
    const rightCriteria = this.right.toQueryCriteria();

    return {
      where: {
        AND: [leftCriteria.where, rightCriteria.where].filter(Boolean),
      },
      orderBy: rightCriteria.orderBy || leftCriteria.orderBy,
      limit: rightCriteria.limit || leftCriteria.limit,
      offset: rightCriteria.offset || leftCriteria.offset,
      include: [
        ...(leftCriteria.include || []),
        ...(rightCriteria.include || []),
      ],
    };
  }
}

/**
 * OR specification
 */
class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }

  toQueryCriteria(): QueryCriteria {
    const leftCriteria = this.left.toQueryCriteria();
    const rightCriteria = this.right.toQueryCriteria();

    return {
      where: {
        OR: [leftCriteria.where, rightCriteria.where].filter(Boolean),
      },
      orderBy: rightCriteria.orderBy || leftCriteria.orderBy,
      limit: rightCriteria.limit || leftCriteria.limit,
      offset: rightCriteria.offset || leftCriteria.offset,
      include: [
        ...(leftCriteria.include || []),
        ...(rightCriteria.include || []),
      ],
    };
  }
}

/**
 * NOT specification
 */
class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.spec.isSatisfiedBy(entity);
  }

  toQueryCriteria(): QueryCriteria {
    const criteria = this.spec.toQueryCriteria();

    return {
      where: {
        NOT: criteria.where,
      },
      orderBy: criteria.orderBy,
      limit: criteria.limit,
      offset: criteria.offset,
      include: criteria.include,
    };
  }
}
