/**
 * Enhanced CQRS Query Infrastructure
 *
 * This module provides the enhanced infrastructure for implementing the Query side of CQRS.
 * Queries represent read operations that don't change system state and are optimized for data retrieval.
 */

import { UserId } from '@taskmanagement/domain';

export interface IQuery {
  readonly queryId: string;
  readonly timestamp: Date;
  readonly userId: UserId;
  readonly correlationId?: string;
}

export abstract class Query implements IQuery {
  public readonly queryId: string;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    public readonly userId: UserId,
    correlationId?: string
  ) {
    this.queryId = this.generateId();
    this.timestamp = new Date();
    if (correlationId) {
      this.correlationId = correlationId;
    }
  }

  private generateId(): string {
    return `qry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface IQueryHandler<TQuery extends IQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
  canHandle(query: IQuery): boolean;
}

export abstract class QueryHandler<TQuery extends IQuery, TResult>
  implements IQueryHandler<TQuery, TResult>
{
  abstract handle(query: TQuery): Promise<TResult>;

  canHandle(query: IQuery): boolean {
    return query.constructor.name === this.getQueryType();
  }

  protected abstract getQueryType(): string;
}

export interface IQueryBus {
  send<TResult>(query: IQuery): Promise<TResult>;
  register<TQuery extends IQuery, TResult>(handler: IQueryHandler<TQuery, TResult>): void;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FilterQuery {
  filters?: Record<string, any>;
  search?: string;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  pagination?: PaginationQuery;
  filters?: FilterQuery;
  sort?: SortOptions[];
  includeDeleted?: boolean;
  includeArchived?: boolean;
}

export class QueryValidationError extends Error {
  constructor(
    public readonly query: string,
    public readonly errors: Record<string, string[]>
  ) {
    super(`Query validation failed for ${query}`);
    this.name = 'QueryValidationError';
  }
}

export class QueryHandlerNotFoundError extends Error {
  constructor(queryType: string) {
    super(`No handler found for query type: ${queryType}`);
    this.name = 'QueryHandlerNotFoundError';
  }
}

export class QueryExecutionError extends Error {
  constructor(
    public readonly query: string,
    public readonly originalError: Error,
    public readonly context?: Record<string, any>
  ) {
    super(`Query execution failed for ${query}: ${originalError.message}`);
    this.name = 'QueryExecutionError';
  }
}

