import { UserId } from '@project/domain/value-objects/user-id';

export interface IQuery {
  readonly queryId: string;
  readonly timestamp: Date;
  readonly userId: UserId;
  readonly correlationId?: string;
}

export abstract class BaseQuery implements IQuery {
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

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}