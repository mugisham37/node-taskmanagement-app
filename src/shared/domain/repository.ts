/**
 * Generic repository interface for domain entities
 * Provides standard CRUD operations and query capabilities
 */
export interface Repository<T, ID> {
  /**
   * Find an entity by its unique identifier
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Save an entity (create or update)
   */
  save(entity: T): Promise<T>;

  /**
   * Delete an entity by its identifier
   */
  delete(id: ID): Promise<void>;

  /**
   * Find all entities matching the given criteria
   */
  findAll(criteria?: any): Promise<T[]>;

  /**
   * Check if an entity exists by its identifier
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Count entities matching the given criteria
   */
  count(criteria?: any): Promise<number>;
}

/**
 * Extended repository interface with additional query capabilities
 */
export interface ExtendedRepository<T, ID> extends Repository<T, ID> {
  /**
   * Find entities with pagination support
   */
  findWithPagination(
    criteria?: any,
    page?: number,
    limit?: number,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC'
  ): Promise<PaginatedResult<T>>;

  /**
   * Find the first entity matching the criteria
   */
  findOne(criteria: any): Promise<T | null>;

  /**
   * Save multiple entities in a batch operation
   */
  saveMany(entities: T[]): Promise<T[]>;

  /**
   * Delete multiple entities by their identifiers
   */
  deleteMany(ids: ID[]): Promise<void>;
}

/**
 * Result type for paginated queries
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Base repository implementation with common functionality
 */
export abstract class BaseRepository<T, ID> implements Repository<T, ID> {
  abstract findById(id: ID): Promise<T | null>;
  abstract save(entity: T): Promise<T>;
  abstract delete(id: ID): Promise<void>;
  abstract findAll(criteria?: any): Promise<T[]>;

  async exists(id: ID): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  async count(criteria?: any): Promise<number> {
    const entities = await this.findAll(criteria);
    return entities.length;
  }

  /**
   * Helper method to create paginated results
   */
  protected createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}

/**
 * Specification pattern interface for complex queries
 */
export interface Specification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

/**
 * Repository interface that supports specification pattern
 */
export interface SpecificationRepository<T, ID> extends Repository<T, ID> {
  findBySpecification(specification: Specification<T>): Promise<T[]>;
  findOneBySpecification(specification: Specification<T>): Promise<T | null>;
  countBySpecification(specification: Specification<T>): Promise<number>;
}
