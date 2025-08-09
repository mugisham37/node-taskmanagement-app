import { DomainEvent } from './domain-event';
import {
  TaskId,
  UserId,
  ProjectId,
  Priority,
  TaskStatusVO,
} from '../value-objects';

/**
 * Task Created Event
 */
export class TaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly title: string,
    public readonly description: string,
    public readonly projectId: ProjectId,
    public readonly createdById: UserId,
    public readonly priority: Priority,
    public readonly dueDate?: Date,
    public readonly estimatedHours?: number
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskCreated';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      title: this.title,
      description: this.description,
      projectId: this.projectId.toString(),
      createdById: this.createdById.toString(),
      priority: this.priority.value,
      dueDate: this.dueDate?.toISOString(),
      estimatedHours: this.estimatedHours,
    };
  }
}

/**
 * Task Assigned Event
 */
export class TaskAssignedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly assigneeId: UserId,
    public readonly assignedBy: UserId,
    public readonly projectId: ProjectId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskAssigned';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      assigneeId: this.assigneeId.toString(),
      assignedBy: this.assignedBy.toString(),
      projectId: this.projectId.toString(),
    };
  }
}

/**
 * Task Unassigned Event
 */
export class TaskUnassignedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly previousAssigneeId: UserId,
    public readonly unassignedBy: UserId,
    public readonly projectId: ProjectId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskUnassigned';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      previousAssigneeId: this.previousAssigneeId.toString(),
      unassignedBy: this.unassignedBy.toString(),
      projectId: this.projectId.toString(),
    };
  }
}

/**
 * Task Started Event
 */
export class TaskStartedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly startedBy: UserId,
    public readonly projectId: ProjectId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskStarted';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      startedBy: this.startedBy.toString(),
      projectId: this.projectId.toString(),
    };
  }
}

/**
 * Task Completed Event
 */
export class TaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly completedBy: UserId,
    public readonly projectId: ProjectId,
    public readonly actualHours?: number
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskCompleted';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      completedBy: this.completedBy.toString(),
      projectId: this.projectId.toString(),
      actualHours: this.actualHours,
    };
  }
}

/**
 * Task Cancelled Event
 */
export class TaskCancelledEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly cancelledBy: UserId,
    public readonly projectId: ProjectId,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskCancelled';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      cancelledBy: this.cancelledBy.toString(),
      projectId: this.projectId.toString(),
      reason: this.reason,
    };
  }
}

/**
 * Task Reopened Event
 */
export class TaskReopenedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly reopenedBy: UserId,
    public readonly projectId: ProjectId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskReopened';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      reopenedBy: this.reopenedBy.toString(),
      projectId: this.projectId.toString(),
    };
  }
}

/**
 * Task Priority Changed Event
 */
export class TaskPriorityChangedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly oldPriority: Priority,
    public readonly newPriority: Priority,
    public readonly changedBy: UserId,
    public readonly projectId: ProjectId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskPriorityChanged';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      oldPriority: this.oldPriority.value,
      newPriority: this.newPriority.value,
      changedBy: this.changedBy.toString(),
      projectId: this.projectId.toString(),
    };
  }
}

/**
 * Task Updated Event
 */
export class TaskUpdatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly updatedBy: UserId,
    public readonly projectId: ProjectId,
    public readonly changes: Record<string, any>
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskUpdated';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      updatedBy: this.updatedBy.toString(),
      projectId: this.projectId.toString(),
      changes: this.changes,
    };
  }
}

/**
 * Task Dependency Added Event
 */
export class TaskDependencyAddedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly dependsOnId: TaskId,
    public readonly projectId: ProjectId,
    public readonly addedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskDependencyAdded';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      dependsOnId: this.dependsOnId.toString(),
      projectId: this.projectId.toString(),
      addedBy: this.addedBy.toString(),
    };
  }
}

/**
 * Task Dependency Removed Event
 */
export class TaskDependencyRemovedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly dependsOnId: TaskId,
    public readonly projectId: ProjectId,
    public readonly removedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'TaskDependencyRemoved';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      taskId: this.taskId.toString(),
      dependsOnId: this.dependsOnId.toString(),
      projectId: this.projectId.toString(),
      removedBy: this.removedBy.toString(),
    };
  }
}
