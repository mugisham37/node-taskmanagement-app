import { UserId } from '@project/domain/value-objects/user-id';
import { WorkspaceId } from '@project/domain/value-objects/workspace-id';
import { BaseQuery, PaginationOptions } from './base-query';

export interface WorkspaceFilters {
  ownerId?: UserId;
  isActive?: boolean;
  search?: string;
}

export class GetWorkspaceByIdQuery extends BaseQuery {
  constructor(
    public readonly workspaceId: WorkspaceId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class GetWorkspacesByOwnerQuery extends BaseQuery {
  constructor(
    public readonly ownerId: UserId,
    userId: UserId,
    public readonly filters?: WorkspaceFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetWorkspacesByMemberQuery extends BaseQuery {
  constructor(
    public readonly memberId: UserId,
    userId: UserId,
    public readonly filters?: WorkspaceFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetWorkspaceProjectsQuery extends BaseQuery {
  constructor(
    public readonly workspaceId: WorkspaceId,
    userId: UserId,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetWorkspaceStatisticsQuery extends BaseQuery {
  constructor(
    public readonly workspaceId: WorkspaceId,
    userId: UserId,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date
  ) {
    super(userId);
  }
}

export class SearchWorkspacesQuery extends BaseQuery {
  constructor(
    public readonly searchTerm: string,
    userId: UserId,
    public readonly filters?: WorkspaceFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}