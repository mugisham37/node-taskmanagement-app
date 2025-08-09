import { BaseQuery, PaginationOptions } from './base-query';
import { UserId } from '../../domain/value-objects/user-id';
import { Email } from '../../domain/value-objects/email';

export interface UserFilters {
  isActive?: boolean;
  search?: string;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
}

export class GetUserByIdQuery extends BaseQuery {
  constructor(
    public readonly targetUserId: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class GetUserByEmailQuery extends BaseQuery {
  constructor(
    public readonly email: Email,
    userId: UserId
  ) {
    super(userId);
  }
}

export class GetUsersQuery extends BaseQuery {
  constructor(
    userId: UserId,
    public readonly filters?: UserFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class SearchUsersQuery extends BaseQuery {
  constructor(
    public readonly searchTerm: string,
    userId: UserId,
    public readonly filters?: UserFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetUserStatisticsQuery extends BaseQuery {
  constructor(
    public readonly targetUserId: UserId,
    userId: UserId,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date
  ) {
    super(userId);
  }
}
