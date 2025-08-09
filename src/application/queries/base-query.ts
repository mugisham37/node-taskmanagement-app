import { UserId } from '../../domain/value-objects/user-id';

export interface IQuery {
  readonly timestamp: Date;
  readonly userId: UserId;
}

export abstract class BaseQuery implements IQuery {
  public readonly timestamp: Date;

  constructor(public readonly userId: UserId) {
    this.timestamp = new Date();
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
