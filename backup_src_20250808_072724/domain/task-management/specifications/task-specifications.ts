import {
  Specification,
  QueryExpression,
} from '../../shared/base/specification';
import { Task } from '../entities/Task';
import { TaskStatus } from '../value-objects/TaskStatus';
import { Priority } from '../value-objects/Priority';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { TaskId } from '../value-objects/TaskId';

/**
 * Specification for tasks by workspace
 */
export class TasksByWorkspaceSpecification extends Specification<Task> {
  constructor(private workspaceId: WorkspaceId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.workspaceId.equals(this.workspaceId);
  }

  toQuery(): QueryExpression {
    return {
      where: {
        workspaceId: this.workspaceId.value,
      },
    };
  }
}

/**
 * Specification for tasks by project
 */
export class TasksByProjectSpecification extends Specification<Task> {
  constructor(private projectId: ProjectId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.projectId?.equals(this.projectId) || false;
  }

  toQuery(): QueryExpression {
    return {
      where: {
        projectId: this.projectId.value,
      },
    };
  }
}

/**
 * Specification for tasks by assignee
 */
export class TasksByAssigneeSpecification extends Specification<Task> {
  constructor(private assigneeId: UserId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.assigneeId?.equals(this.assigneeId) || false;
  }

  toQuery(): QueryExpression {
    return {
      where: {
        assigneeId: this.assigneeId.value,
      },
    };
  }
}

/**
 * Specification for tasks by creator
 */
export class TasksByCreatorSpecification extends Specification<Task> {
  constructor(private creatorId: UserId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.creatorId.equals(this.creatorId);
  }

  toQuery(): QueryExpression {
    return {
      where: {
        creatorId: this.creatorId.value,
      },
    };
  }
}

/**
 * Specification for tasks by status
 */
export class TasksByStatusSpecification extends Specification<Task> {
  constructor(private statuses: TaskStatus[]) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return this.statuses.some(status => task.status.equals(status));
  }

  toQuery(): QueryExpression {
    return {
      where: {
        status: {
          in: this.statuses.map(s => s.value),
        },
      },
    };
  }
}

/**
 * Specification for tasks by priority
 */
export class TasksByPrioritySpecification extends Specification<Task> {
  constructor(private priorities: Priority[]) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return this.priorities.some(priority => task.priority.equals(priority));
  }

  toQuery(): QueryExpression {
    return {
      where: {
        priority: {
          in: this.priorities.map(p => p.value),
        },
      },
    };
  }
}

/**
 * Specification for overdue tasks
 */
export class OverdueTasksSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return task.isOverdue();
  }

  toQuery(): QueryExpression {
    return {
      where: {
        dueDate: {
          lt: new Date(),
        },
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
      },
    };
  }
}

/**
 * Specification for tasks due within specified days
 */
export class TasksDueSoonSpecification extends Specification<Task> {
  constructor(private days: number) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    if (!task.dueDate) return false;
    const daysUntilDue = task.getDaysUntilDue();
    return (
      daysUntilDue !== null && daysUntilDue <= this.days && daysUntilDue >= 0
    );
  }

  toQuery(): QueryExpression {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + this.days);

    return {
      where: {
        dueDate: {
          gte: new Date(),
          lte: futureDate,
        },
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
      },
    };
  }
}

/**
 * Specification for tasks with specific tags
 */
export class TasksByTagsSpecification extends Specification<Task> {
  constructor(
    private tags: string[],
    private matchAll: boolean = false
  ) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    if (this.matchAll) {
      return this.tags.every(tag => task.tags.includes(tag));
    } else {
      return this.tags.some(tag => task.tags.includes(tag));
    }
  }

  toQuery(): QueryExpression {
    if (this.matchAll) {
      return {
        where: {
          tags: {
            hasEvery: this.tags,
          },
        },
      };
    } else {
      return {
        where: {
          tags: {
            hasSome: this.tags,
          },
        },
      };
    }
  }
}

/**
 * Specification for tasks with specific labels
 */
export class TasksByLabelsSpecification extends Specification<Task> {
  constructor(
    private labels: string[],
    private matchAll: boolean = false
  ) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    if (this.matchAll) {
      return this.labels.every(label => task.labels.includes(label));
    } else {
      return this.labels.some(label => task.labels.includes(label));
    }
  }

  toQuery(): QueryExpression {
    if (this.matchAll) {
      return {
        where: {
          labels: {
            hasEvery: this.labels,
          },
        },
      };
    } else {
      return {
        where: {
          labels: {
            hasSome: this.labels,
          },
        },
      };
    }
  }
}

/**
 * Specification for subtasks of a parent task
 */
export class SubtasksSpecification extends Specification<Task> {
  constructor(private parentTaskId: TaskId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.parentTaskId?.equals(this.parentTaskId) || false;
  }

  toQuery(): QueryExpression {
    return {
      where: {
        parentTaskId: this.parentTaskId.value,
      },
    };
  }
}

/**
 * Specification for tasks in an epic
 */
export class EpicTasksSpecification extends Specification<Task> {
  constructor(private epicId: TaskId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.epicId?.equals(this.epicId) || false;
  }

  toQuery(): QueryExpression {
    return {
      where: {
        epicId: this.epicId.value,
      },
    };
  }
}

/**
 * Specification for tasks watched by a user
 */
export class TasksWatchedByUserSpecification extends Specification<Task> {
  constructor(private userId: UserId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.isWatchedBy(this.userId);
  }

  toQuery(): QueryExpression {
    return {
      where: {
        watchers: {
          has: this.userId.value,
        },
      },
    };
  }
}

/**
 * Specification for tasks with text search
 */
export class TasksTextSearchSpecification extends Specification<Task> {
  constructor(private searchText: string) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    const searchLower = this.searchText.toLowerCase();
    return (
      task.title.toLowerCase().includes(searchLower) ||
      (task.description && task.description.toLowerCase().includes(searchLower))
    );
  }

  toQuery(): QueryExpression {
    return {
      where: {
        OR: [
          {
            title: {
              contains: this.searchText,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: this.searchText,
              mode: 'insensitive',
            },
          },
        ],
      },
    };
  }
}

/**
 * Specification for tasks within a date range
 */
export class TasksInDateRangeSpecification extends Specification<Task> {
  constructor(
    private startDate: Date,
    private endDate: Date,
    private dateField:
      | 'createdAt'
      | 'updatedAt'
      | 'dueDate'
      | 'startDate' = 'createdAt'
  ) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    let dateValue: Date | undefined;

    switch (this.dateField) {
      case 'createdAt':
        dateValue = task.createdAt;
        break;
      case 'updatedAt':
        dateValue = task.updatedAt;
        break;
      case 'dueDate':
        dateValue = task.dueDate;
        break;
      case 'startDate':
        dateValue = task.startDate;
        break;
    }

    if (!dateValue) return false;
    return dateValue >= this.startDate && dateValue <= this.endDate;
  }

  toQuery(): QueryExpression {
    return {
      where: {
        [this.dateField]: {
          gte: this.startDate,
          lte: this.endDate,
        },
      },
    };
  }
}

/**
 * Specification for active tasks (not deleted, not cancelled)
 */
export class ActiveTasksSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return !task.isDeleted() && !task.status.equals(TaskStatus.cancelled());
  }

  toQuery(): QueryExpression {
    return {
      where: {
        deletedAt: null,
        status: {
          not: 'CANCELLED',
        },
      },
    };
  }
}

/**
 * Specification for tasks with effort estimation
 */
export class TasksWithEffortEstimationSpecification extends Specification<Task> {
  constructor(
    private minHours?: number,
    private maxHours?: number,
    private minStoryPoints?: number,
    private maxStoryPoints?: number
  ) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    if (
      this.minHours !== undefined &&
      (task.estimatedHours === undefined || task.estimatedHours < this.minHours)
    ) {
      return false;
    }
    if (
      this.maxHours !== undefined &&
      (task.estimatedHours === undefined || task.estimatedHours > this.maxHours)
    ) {
      return false;
    }
    if (
      this.minStoryPoints !== undefined &&
      (task.storyPoints === undefined || task.storyPoints < this.minStoryPoints)
    ) {
      return false;
    }
    if (
      this.maxStoryPoints !== undefined &&
      (task.storyPoints === undefined || task.storyPoints > this.maxStoryPoints)
    ) {
      return false;
    }
    return true;
  }

  toQuery(): QueryExpression {
    const where: any = {};

    if (this.minHours !== undefined || this.maxHours !== undefined) {
      where.estimatedHours = {};
      if (this.minHours !== undefined) where.estimatedHours.gte = this.minHours;
      if (this.maxHours !== undefined) where.estimatedHours.lte = this.maxHours;
    }

    if (
      this.minStoryPoints !== undefined ||
      this.maxStoryPoints !== undefined
    ) {
      where.storyPoints = {};
      if (this.minStoryPoints !== undefined)
        where.storyPoints.gte = this.minStoryPoints;
      if (this.maxStoryPoints !== undefined)
        where.storyPoints.lte = this.maxStoryPoints;
    }

    return { where };
  }
}
