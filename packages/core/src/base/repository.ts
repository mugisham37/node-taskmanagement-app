/**
 * Base Repository interface
 */

export interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
  exists(id: ID): Promise<boolean>;
}

/**
 * Extended Repository interface with additional common operations
 */
export interface ExtendedRepository<T, ID> extends Repository<T, ID> {
  findAll(): Promise<T[]>;
  findMany(ids: ID[]): Promise<T[]>;
  saveMany(entities: T[]): Promise<T[]>;
  deleteMany(ids: ID[]): Promise<void>;
  count(): Promise<number>;
}

/**
 * Repository interface with pagination support
 */
export interface PaginatedRepository<T, ID> extends ExtendedRepository<T, ID> {
  findWithPagination(
    page: number,
    limit: number,
    filters?: Record<string, any>
  ): Promise<{
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}

/**
 * Repository interface with search capabilities
 */
export interface SearchableRepository<T, ID> extends PaginatedRepository<T, ID> {
  search(
    query: string,
    filters?: Record<string, any>,
    page?: number,
    limit?: number
  ): Promise<{
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}

/**
 * Repository interface for aggregate roots
 */
export interface AggregateRepository<T, ID> extends Repository<T, ID> {
  saveWithEvents(aggregate: T): Promise<T>;
  findByIdWithVersion(id: ID, version: number): Promise<T | null>;
}