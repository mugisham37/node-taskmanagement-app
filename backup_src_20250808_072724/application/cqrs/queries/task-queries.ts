/**
 * Task Management Queries
 *
 * This module contains all queries related to task management read operations.
 * Queries are optimized for data retrieval and don't change system state.
 */

import { Query, PaginationQuery, FilterQuery, PaginatedResult } from '../query';
import { Task } from '@/domain/task-management/entities/task';
import {
  TaskStatus,
  TaskPriority,
} from '@/domain/task-management/entities/task';

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  projectId?: string;
  assigneeId?: string;
  creatorId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
  tags?: string[];
  search?: string;
}

export class GetTaskByIdQuery extends Query {
  constructor(
    public readonly taskId: string,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTasksQuery extends Query {
  constructor(
    public readonly filters: TaskFilters = {},
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTasksByProjectQuery extends Query {
  constructor(
    public readonly projectId: string,
    public readonly filters: Omit<TaskFilters, 'projectId'> = {},
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTasksByAssigneeQuery extends Query {
  constructor(
    public readonly assigneeId: string,
    public readonly filters: Omit<TaskFilters, 'assigneeId'> = {},
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTaskStatsQuery extends Query {
  constructor(
    public readonly filters: TaskFilters = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class SearchTasksQuery extends Query {
  constructor(
    public readonly searchTerm: string,
    public readonly filters: TaskFilters = {},
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetOverdueTasksQuery extends Query {
  constructor(
    public readonly assigneeId?: string,
    public readonly projectId?: string,
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTasksWithUpcomingDueDatesQuery extends Query {
  constructor(
    public readonly daysAhead: number = 7,
    public readonly assigneeId?: string,
    public readonly projectId?: string,
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTaskHistoryQuery extends Query {
  constructor(
    public readonly taskId: string,
    public readonly pagination: PaginationQuery = {},
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class GetTaskDependenciesQuery extends Query {
  constructor(
    public readonly taskId: string,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

// Result types for queries
export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  completed: number;
  cancelled: number;
  overdue: number;
  highPriority: number;
  averageCompletionTime?: number;
  completionRate?: number;
}

export interface TaskWithDetails extends Task {
  project?: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  action: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'blocks' | 'subtask' | 'related';
  task: TaskWithDetails;
  dependsOnTask: TaskWithDetails;
  createdAt: Date;
}
