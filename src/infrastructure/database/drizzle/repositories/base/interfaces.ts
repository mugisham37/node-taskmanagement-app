import { SQL } from 'drizzle-orm';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterOptions {
  where?: SQL;
  orderBy?: SQL[];
  limit?: number;
  offset?: number;
}

export interface SearchOptions extends PaginationOptions {
  query: string;
  fields?: string[];
}

export interface BulkOperationResult {
  success: boolean;
  count: number;
  errors?: Error[];
}

export interface RepositoryOptions {
  enableCache?: boolean;
  cacheTimeout?: number;
  enableSoftDelete?: boolean;
  enableAudit?: boolean;
}

export interface BaseRepository<TSelect, TInsert> {
  // Basic CRUD operations
  findById(id: string): Promise<TSelect | null>;
  findMany(options?: PaginationOptions & FilterOptions): Promise<PaginatedResult<TSelect>>;
  create(data: TInsert): Promise<TSelect>;
  update(id: string, data: Partial<TInsert>): Promise<TSelect | null>;
  delete(id: string): Promise<boolean>;
  
  // Bulk operations
  createMany(data: TInsert[]): Promise<TSelect[]>;
  updateMany(ids: string[], data: Partial<TInsert>): Promise<BulkOperationResult>;
  deleteMany(ids: string[]): Promise<BulkOperationResult>;
  
  // Utility methods
  exists(id: string): Promise<boolean>;
  count(options?: FilterOptions): Promise<number>;
  
  // Transaction support
  withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
}

export interface AuditableRepository<TSelect, TInsert> extends BaseRepository<TSelect, TInsert> {
  // Soft delete operations
  softDelete(id: string): Promise<TSelect | null>;
  restore(id: string): Promise<TSelect | null>;
  findWithDeleted(options?: PaginationOptions & FilterOptions): Promise<PaginatedResult<TSelect>>;
  findDeleted(options?: PaginationOptions & FilterOptions): Promise<PaginatedResult<TSelect>>;
}

export interface SearchableRepository<TSelect, TInsert> extends BaseRepository<TSelect, TInsert> {
  search(options: SearchOptions): Promise<PaginatedResult<TSelect>>;
}
