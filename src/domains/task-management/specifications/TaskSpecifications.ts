import { BaseSpecification } from '../../../shared/domain/repositories/IRepository';
import { Task } from '../entities/Task';
import { TaskStatus } from '../value-objects/TaskStatus';
import { Priority } from '../value-objects/Priority';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';

// Status-based specifications
export class TaskByStatusSpecification extends BaseSpecification<Task> {
  constructor(private readonly status: TaskStatus) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.status.equals(this.status);
  }
}

export class CompletedTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.status.isCompleted();
  }
}

export class ActiveTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.status.isActive();
  }
}

// Priority-based specifications
export class TaskByPrioritySpecification extends BaseSpecification<Task> {
  constructor(private readonly priority: Priority) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.priority.equals(this.priority);
  }
}

export class HighPriorityTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.priority.isHigherThan(Priority.medium());
  }
}

export class UrgentTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.priority.equals(Priority.urgent());
  }
}

// Assignment-based specifications
export class TaskByAssigneeSpecification extends BaseSpecification<Task> {
  constructor(private readonly assigneeId: UserId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.assigneeId?.equals(this.assigneeId) || false;
  }
}

export class UnassignedTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return !task.assigneeId;
  }
}

export class TaskByCreatorSpecification extends BaseSpecification<Task> {
  constructor(private readonly creatorId: UserId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.creatorId.equals(this.creatorId);
  }
}

// Project and workspace specifications
export class TaskByProjectSpecification extends BaseSpecification<Task> {
  constructor(private readonly projectId: ProjectId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.projectId?.equals(this.projectId) || false;
  }
}

export class TaskByWorkspaceSpecification extends BaseSpecification<Task> {
  constructor(private readonly workspaceId: WorkspaceId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.workspaceId.equals(this.workspaceId);
  }
}

export class TasksWithoutProjectSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return !task.projectId;
  }
}

// Date-based specifications
export class OverdueTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.isOverdue();
  }
}

export class TasksDueTodaySpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    if (!task.dueDate) return false;

    const today = new Date();
    const dueDate = task.dueDate;

    return (
      dueDate.getFullYear() === today.getFullYear() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getDate() === today.getDate()
    );
  }
}

export class TasksDueThisWeekSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    if (!task.dueDate) return false;

    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return task.dueDate >= today && task.dueDate <= weekFromNow;
  }
}

export class TasksByDateRangeSpecification extends BaseSpecification<Task> {
  constructor(
    private readonly startDate: Date,
    private readonly endDate: Date,
    private readonly dateField:
      | 'dueDate'
      | 'startDate'
      | 'createdAt' = 'dueDate'
  ) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    let dateToCheck: Date | undefined;

    switch (this.dateField) {
      case 'dueDate':
        dateToCheck = task.dueDate;
        break;
      case 'startDate':
        dateToCheck = task.startDate;
        break;
      case 'createdAt':
        dateToCheck = task.createdAt;
        break;
    }

    if (!dateToCheck) return false;

    return dateToCheck >= this.startDate && dateToCheck <= this.endDate;
  }
}

// Hierarchy specifications
export class SubtasksSpecification extends BaseSpecification<Task> {
  constructor(private readonly parentTaskId: TaskId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.parentTaskId?.equals(this.parentTaskId) || false;
  }
}

export class EpicTasksSpecification extends BaseSpecification<Task> {
  constructor(private readonly epicId: TaskId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.epicId?.equals(this.epicId) || false;
  }
}

export class RootTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return !task.parentTaskId && !task.epicId;
  }
}

// Tag and label specifications
export class TaskByTagsSpecification extends BaseSpecification<Task> {
  constructor(private readonly tags: string[]) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return this.tags.some(tag => task.tags.includes(tag));
  }
}

export class TaskByLabelsSpecification extends BaseSpecification<Task> {
  constructor(private readonly labels: string[]) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return this.labels.some(label => task.labels.includes(label));
  }
}

// Search specifications
export class TaskSearchSpecification extends BaseSpecification<Task> {
  constructor(private readonly query: string) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    const searchQuery = this.query.toLowerCase();

    return (
      task.title.toLowerCase().includes(searchQuery) ||
      (task.description &&
        task.description.toLowerCase().includes(searchQuery)) ||
      task.tags.some(tag => tag.toLowerCase().includes(searchQuery)) ||
      task.labels.some(label => label.toLowerCase().includes(searchQuery))
    );
  }
}

// Watcher specifications
export class TaskByWatcherSpecification extends BaseSpecification<Task> {
  constructor(private readonly watcherId: UserId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return task.watchers.some(watcher => watcher.equals(this.watcherId));
  }
}

// Effort specifications
export class TasksWithEstimateSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.estimatedHours !== undefined || task.storyPoints !== undefined;
  }
}

export class TasksWithoutEstimateSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return task.estimatedHours === undefined && task.storyPoints === undefined;
  }
}

export class TasksByEffortRangeSpecification extends BaseSpecification<Task> {
  constructor(
    private readonly minHours: number,
    private readonly maxHours: number
  ) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    if (!task.estimatedHours) return false;
    return (
      task.estimatedHours >= this.minHours &&
      task.estimatedHours <= this.maxHours
    );
  }
}

// Composite specifications for common use cases
export class MyActiveTasksSpecification extends BaseSpecification<Task> {
  constructor(private readonly userId: UserId) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    return (
      (task.assigneeId?.equals(this.userId) || false) &&
      task.status.isActive() &&
      !task.isDeleted()
    );
  }
}

export class OverdueHighPriorityTasksSpecification extends BaseSpecification<Task> {
  public isSatisfiedBy(task: Task): boolean {
    return (
      task.isOverdue() &&
      task.priority.isHigherThan(Priority.medium()) &&
      task.status.isActive()
    );
  }
}

export class RecentlyCompletedTasksSpecification extends BaseSpecification<Task> {
  constructor(private readonly days: number = 7) {
    super();
  }

  public isSatisfiedBy(task: Task): boolean {
    if (!task.completedAt || !task.status.isCompleted()) return false;

    const daysAgo = new Date(Date.now() - this.days * 24 * 60 * 60 * 1000);
    return task.completedAt >= daysAgo;
  }
}

// Import TaskId
import { TaskId } from '../value-objects/TaskId';
