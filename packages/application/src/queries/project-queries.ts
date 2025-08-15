import { ProjectId } from '@project/domain/value-objects/project-id';
import { ProjectStatus } from '@project/domain/value-objects/project-status';
import { UserId } from '@project/domain/value-objects/user-id';
import { WorkspaceId } from '@project/domain/value-objects/workspace-id';
import { BaseQuery, PaginationOptions } from './base-query';

export interface ProjectFilters {
  status?: ProjectStatus[];
  managerId?: UserId;
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  search?: string;
}

export class GetProjectByIdQuery extends BaseQuery {
  constructor(
    public readonly projectId: ProjectId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class GetProjectsByWorkspaceQuery extends BaseQuery {
  constructor(
    public readonly workspaceId: WorkspaceId,
    userId: UserId,
    public readonly filters?: ProjectFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetProjectsByManagerQuery extends BaseQuery {
  constructor(
    public readonly managerId: UserId,
    userId: UserId,
    public readonly filters?: ProjectFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetProjectsByMemberQuery extends BaseQuery {
  constructor(
    public readonly memberId: UserId,
    userId: UserId,
    public readonly filters?: ProjectFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetProjectMembersQuery extends BaseQuery {
  constructor(
    public readonly projectId: ProjectId,
    userId: UserId,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetProjectStatisticsQuery extends BaseQuery {
  constructor(
    public readonly projectId: ProjectId,
    userId: UserId,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date
  ) {
    super(userId);
  }
}

export class SearchProjectsQuery extends BaseQuery {
  constructor(
    public readonly searchTerm: string,
    userId: UserId,
    public readonly workspaceId?: WorkspaceId,
    public readonly filters?: ProjectFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}