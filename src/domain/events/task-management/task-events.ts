import { DomainEvent } from '@/shared/events/domain-event';

export class TaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly title: string,
    public readonly description: string,
    public readonly creatorId: string,
    public readonly workspaceId: string,
    public readonly projectId?: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      title: this.title,
      description: this.description,
      creatorId: this.creatorId,
      workspaceId: this.workspaceId,
      projectId: this.projectId,
    };
  }
}

export class TaskUpdatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly changes: Record<string, { from: any; to: any }>,
    public readonly updatedBy: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      changes: this.changes,
      updatedBy: this.updatedBy,
    };
  }
}

export class TaskAssignedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly assigneeId: string,
    public readonly previousAssigneeId: string | null,
    public readonly assignedBy: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      assigneeId: this.assigneeId,
      previousAssigneeId: this.previousAssigneeId,
      assignedBy: this.assignedBy,
    };
  }
}

export class TaskStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly newStatus: string,
    public readonly previousStatus: string,
    public readonly changedBy: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      newStatus: this.newStatus,
      previousStatus: this.previousStatus,
      changedBy: this.changedBy,
    };
  }
}

export class TaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly completedBy: string,
    public readonly completedAt: Date,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      completedBy: this.completedBy,
      completedAt: this.completedAt.toISOString(),
    };
  }
}

export class TaskDeletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly deletedBy: string,
    public readonly reason?: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      deletedBy: this.deletedBy,
      reason: this.reason,
    };
  }
}

export class TaskCommentAddedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly commentId: string,
    public readonly content: string,
    public readonly authorId: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      commentId: this.commentId,
      content: this.content,
      authorId: this.authorId,
    };
  }
}

export class TaskDueDateChangedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly newDueDate: Date | null,
    public readonly previousDueDate: Date | null,
    public readonly changedBy: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      newDueDate: this.newDueDate?.toISOString() || null,
      previousDueDate: this.previousDueDate?.toISOString() || null,
      changedBy: this.changedBy,
    };
  }
}

export class TaskPriorityChangedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly newPriority: string,
    public readonly previousPriority: string,
    public readonly changedBy: string,
    correlationId?: string,
    causationId?: string
  ) {
    super(correlationId, causationId);
  }

  getAggregateId(): string {
    return this.taskId;
  }

  getAggregateType(): string {
    return 'Task';
  }

  getEventData(): Record<string, any> {
    return {
      taskId: this.taskId,
      newPriority: this.newPriority,
      previousPriority: this.previousPriority,
      changedBy: this.changedBy,
    };
  }
}
