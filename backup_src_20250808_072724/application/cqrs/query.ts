/**
 * CQRS Query Infrastructure
 *
 * This module provides the base infrastructure for implementing the Query side of CQRS.
 * Queries represent read operations that don't change system state and are optimized for data retrieval.
 */

export interface IQuery {
  readonly queryId: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly correlationId?: string;
}

export abstract class Query implements IQuery {
  public readonly queryId: string;
  public readonly timestamp: Date;
  public readonly userId?: string;
  public readonly correlationId?: string;

  constructor(userId?: string, correlationId?: string) {
    this.queryId = this.generateId();
    this.timestamp = new Date();
    this.userId = userId;
    this.correlationId = correlationId;
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
  register<TQuery extends IQuery, TResult>(
    handler: IQueryHandler<TQuery, TResult>
  ): void;
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
