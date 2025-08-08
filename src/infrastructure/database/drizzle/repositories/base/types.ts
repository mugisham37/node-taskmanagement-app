import { PgTable } from 'drizzle-orm/pg-core';
import { SQL } from 'drizzle-orm';

export type TableColumns<T extends PgTable> = T['_']['columns'];

export type SortDirection = 'asc' | 'desc';

export type WhereCondition = SQL | undefined;

export interface QueryBuilder<T> {
  select(): QueryBuilder<T>;
  from(table: PgTable): QueryBuilder<T>;
  where(condition: WhereCondition): QueryBuilder<T>;
  orderBy(...columns: SQL[]): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  keyPrefix: string;
}

export interface AuditConfig {
  enabled: boolean;
  trackChanges: boolean;
  userId?: string;
}

export interface TransactionContext {
  db: any;
  isTransaction: boolean;
}

export type RepositoryError = 
  | 'NOT_FOUND'
  | 'DUPLICATE_KEY'
  | 'FOREIGN_KEY_VIOLATION'
  | 'VALIDATION_ERROR'
  | 'TRANSACTION_ERROR'
  | 'UNKNOWN_ERROR';

export class RepositoryException extends Error {
  constructor(
    public type: RepositoryError,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'RepositoryException';
  }
}

export interface RelationConfig {
  table: PgTable;
  foreignKey: string;
  localKey: string;
  type: 'one' | 'many';
}

export interface IncludeOptions {
  [key: string]: boolean | IncludeOptions;
}

export interface AggregateResult {
  count?: number;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'ilike' | 'between';
  value: any;
}

export interface ComplexFilter {
  and?: FilterCondition[];
  or?: FilterCondition[];
  not?: FilterCondition;
}
