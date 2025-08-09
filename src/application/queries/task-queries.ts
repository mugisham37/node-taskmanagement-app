import { BaseQuery, PaginationOptions } from './base-query';
import { TaskId } from '../../domain/value-objects/task-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { TaskStatus } from '../../domain/value-objects/task-status';
import { Priority } from '../../domain/value-objects/priority';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  assigneeId?: UserId;
  createdById?: UserId;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  isOverdue?: boolean;
  hasAssignee?: boolean;
  search?: string;
}

export class GetTaskByIdQuery extends BaseQuery {
  constructor(
    public readonly taskId: TaskId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class GetTasksByProjectQuery extends BaseQuery {
  constructor(
    public readonly projectId: ProjectId,
    userId: UserId,
    public readonly filters?: TaskFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetTasksByAssigneeQuery extends BaseQuery {
  constructor(
    public readonly assigneeId: UserId,
    userId: UserId,
    public readonly filters?: TaskFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetTasksByCreatorQuery extends BaseQuery {
  constructor(
    public readonly creatorId: UserId,
    userId: UserId,
    public readonly filters?: TaskFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetOverdueTasksQuery extends BaseQuery {
  constructor(
    userId: UserId,
    public readonly projectId?: ProjectId,
    public readonly assigneeId?: UserId,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}

export class GetTaskDependenciesQuery extends BaseQuery {
  constructor(
    public readonly taskId: TaskId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class GetTaskStatisticsQuery extends BaseQuery {
  constructor(
    userId: UserId,
    public readonly projectId?: ProjectId,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date
  ) {
    super(userId);
  }
}

export class SearchTasksQuery extends BaseQuery {
  constructor(
    public readonly searchTerm: string,
    userId: UserId,
    public readonly projectId?: ProjectId,
    public readonly filters?: TaskFilters,
    public readonly pagination?: PaginationOptions
  ) {
    super(userId);
  }
}
