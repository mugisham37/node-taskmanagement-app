import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { TaskId } from '../value-objects/task-id';
import { ProjectId } from '../value-objects/project-id';
import { WorkspaceId } from '../value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { TaskStatus } from '../value-objects/task-status';
import { Priority } from '../value-objects/priority';

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: UserId;
}

export interface TaskExternalLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  addedAt: Date;
  addedBy: UserId;
}

export interface TaskProps {
  id: TaskId;
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: UserId;
  creatorId: UserId;
  reporterId?: UserId;
  dueDate?: Date;
  startDate?: Date;
  completedAt?: Date;
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
  tags: string[];
  labels: string[];
  epicId?: TaskId;
  parentTaskId?: TaskId;
  attachments: TaskAttachment[];
  externalLinks: TaskExternalLink[];
  recurringTaskId?: string;
  recurrenceInstanceDate?: Date;
  watchers: UserId[];
  lastActivityAt: Date;
  customFields: Record<string, any>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Domain Events
export class TaskCreatedEvent extends BaseDomainEvent {
  constructor(
    taskId: TaskId,
    workspaceId: WorkspaceId,
    projectId: ProjectId | undefined,
    title: string,
    creatorId: UserId
  ) {
    super(taskId.value, 'TaskCreated', {
      taskId: taskId.value,
      workspaceId: workspaceId.value,
      projectId: projectId?.value,
      title,
      creatorId: creatorId.value,
    });
  }
}

export class TaskUpdatedEvent extends BaseDomainEvent {
  constructor(taskId: TaskId, changes: Partial<TaskProps>, updatedBy: UserId) {
    super(taskId.value, 'TaskUpdated', {
      taskId: taskId.value,
      changes,
      updatedBy: updatedBy.value,
    });
  }
}

export class TaskStatusChangedEvent extends BaseDomainEvent {
  constructor(
    taskId: TaskId,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
    changedBy: UserId
  ) {
    super(taskId.value, 'TaskStatusChanged', {
      taskId: taskId.value,
      oldStatus: oldStatus.value,
      newStatus: newStatus.value,
      changedBy: changedBy.value,
    });
  }
}

export class TaskAssignedEvent extends BaseDomainEvent {
  constructor(
    taskId: TaskId,
    assigneeId: UserId,
    assignedBy: UserId,
    previousAssigneeId?: UserId
  ) {
    super(taskId.value, 'TaskAssigned', {
      taskId: taskId.value,
      assigneeId: assigneeId.value,
      assignedBy: assignedBy.value,
      previousAssigneeId: previousAssigneeId?.value,
    });
  }
}

export class TaskUnassignedEvent extends BaseDomainEvent {
  constructor(
    taskId: TaskId,
    previousAssigneeId: UserId,
    unassignedBy: UserId
  ) {
    super(taskId.value, 'TaskUnassigned', {
      taskId: taskId.value,
      previousAssigneeId: previousAssigneeId.value,
      unassignedBy: unassignedBy.value,
    });
  }
}

export class TaskCompletedEvent extends BaseDomainEvent {
  constructor(taskId: TaskId, completedBy: UserId, completedAt: Date) {
    super(taskId.value, 'TaskCompleted', {
      taskId: taskId.value,
      completedBy: completedBy.value,
      completedAt: completedAt.toISOString(),
    });
  }
}

export class TaskDeletedEvent extends BaseDomainEvent {
  constructor(taskId: TaskId, deletedBy: UserId) {
    super(taskId.value, 'TaskDeleted', {
      taskId: taskId.value,
      deletedBy: deletedBy.value,
    });
  }
}

export class TaskWatcherAddedEvent extends BaseDomainEvent {
  constructor(taskId: TaskId, watcherId: UserId, addedBy: UserId) {
    super(taskId.value, 'TaskWatcherAdded', {
      taskId: taskId.value,
      watcherId: watcherId.value,
      addedBy: addedBy.value,
    });
  }
}

export class TaskAggregate extends AggregateRoot<TaskProps> {
  private constructor(props: TaskProps) {
    super(props, props.id.value, props.createdAt, props.updatedAt);
  }

  public static create(
    props: Omit<TaskProps, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>
  ): TaskAggregate {
    const now = new Date();
    const task = new TaskAggregate({
      ...props,
      id: TaskId.generate(),
      title: props.title.trim(),
      status: props.status || TaskStatus.todo(),
      priority: props.priority || Priority.medium(),
      tags: props.tags || [],
      labels: props.labels || [],
      attachments: props.attachments || [],
      externalLinks: props.externalLinks || [],
      watchers: props.watchers || [],
      customFields: props.customFields || {},
      position: props.position || 0,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    });

    task.addDomainEvent(
      new TaskCreatedEvent(
        task.id,
        task.workspaceId,
        task.projectId,
        task.title,
        task.creatorId
      )
    );

    return task;
  }

  public static fromPersistence(props: TaskProps): TaskAggregate {
    return new TaskAggregate(props);
  }

  // Getters
  get id(): TaskId {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get projectId(): ProjectId | undefined {
    return this.props.projectId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get priority(): Priority {
    return this.props.priority;
  }

  get assigneeId(): UserId | undefined {
    return this.props.assigneeId;
  }

  get creatorId(): UserId {
    return this.props.creatorId;
  }

  get reporterId(): UserId | undefined {
    return this.props.reporterId;
  }

  get dueDate(): Date | undefined {
    return this.props.dueDate;
  }

  get startDate(): Date | undefined {
    return this.props.startDate;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get estimatedHours(): number | undefined {
    return this.props.estimatedHours;
  }

  get actualHours(): number | undefined {
    return this.props.actualHours;
  }

  get storyPoints(): number | undefined {
    return this.props.storyPoints;
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get labels(): string[] {
    return [...this.props.labels];
  }

  get epicId(): TaskId | undefined {
    return this.props.epicId;
  }

  get parentTaskId(): TaskId | undefined {
    return this.props.parentTaskId;
  }

  get attachments(): TaskAttachment[] {
    return [...this.props.attachments];
  }

  get externalLinks(): TaskExternalLink[] {
    return [...this.props.externalLinks];
  }

  get recurringTaskId(): string | undefined {
    return this.props.recurringTaskId;
  }

  get recurrenceInstanceDate(): Date | undefined {
    return this.props.recurrenceInstanceDate;
  }

  get watchers(): UserId[] {
    return [...this.props.watchers];
  }

  get lastActivityAt(): Date {
    return this.props.lastActivityAt;
  }

  get customFields(): Record<string, any> {
    return { ...this.props.customFields };
  }

  get position(): number {
    return this.props.position;
  }

  get isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  // Business methods
  public updateTitle(title: string, updatedBy: UserId): void {
    this.props.title = title.trim();
    this.updateActivity(updatedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(this.id, { title: this.props.title }, updatedBy)
    );
  }

  public updateDescription(
    description: string | undefined,
    updatedBy: UserId
  ): void {
    this.props.description = description;
    this.updateActivity(updatedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(this.id, { description }, updatedBy)
    );
  }

  public changeStatus(newStatus: TaskStatus, changedBy: UserId): void {
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.props.status.value} to ${newStatus.value}`
      );
    }

    const oldStatus = this.props.status;
    this.props.status = newStatus;
    this.updateActivity(changedBy);

    // Publish status change event
    this.addDomainEvent(
      new TaskStatusChangedEvent(this.id, oldStatus, newStatus, changedBy)
    );

    // Publish completion event if task is completed
    if (newStatus.isCompleted() && !oldStatus.isCompleted()) {
      this.props.completedAt = new Date();
      this.addDomainEvent(
        new TaskCompletedEvent(this.id, changedBy, this.props.completedAt)
      );
    }
  }

  public updatePriority(priority: Priority, updatedBy: UserId): void {
    this.props.priority = priority;
    this.updateActivity(updatedBy);

    this.addDomainEvent(new TaskUpdatedEvent(this.id, { priority }, updatedBy));
  }

  public assignTo(assigneeId: UserId, assignedBy: UserId): void {
    const previousAssigneeId = this.props.assigneeId;
    this.props.assigneeId = assigneeId;
    this.updateActivity(assignedBy);

    // Add assignee as watcher if not already watching
    if (!this.props.watchers.some(w => w.equals(assigneeId))) {
      this.props.watchers.push(assigneeId);
    }

    this.addDomainEvent(
      new TaskAssignedEvent(this.id, assigneeId, assignedBy, previousAssigneeId)
    );
  }

  public unassign(unassignedBy: UserId): void {
    if (!this.props.assigneeId) {
      throw new Error('Task is not assigned to anyone');
    }

    const previousAssigneeId = this.props.assigneeId;
    this.props.assigneeId = undefined;
    this.updateActivity(unassignedBy);

    this.addDomainEvent(
      new TaskUnassignedEvent(this.id, previousAssigneeId, unassignedBy)
    );
  }

  public updateTimeline(
    startDate?: Date,
    dueDate?: Date,
    updatedBy?: UserId
  ): void {
    if (startDate && dueDate && startDate > dueDate) {
      throw new Error('Start date cannot be after due date');
    }

    this.props.startDate = startDate;
    this.props.dueDate = dueDate;

    if (updatedBy) {
      this.updateActivity(updatedBy);
      this.addDomainEvent(
        new TaskUpdatedEvent(this.id, { startDate, dueDate }, updatedBy)
      );
    }
  }

  public addWatcher(watcherId: UserId, addedBy: UserId): void {
    if (this.props.watchers.some(w => w.equals(watcherId))) {
      return; // Already watching
    }

    this.props.watchers.push(watcherId);
    this.updateActivity(addedBy);

    this.addDomainEvent(new TaskWatcherAddedEvent(this.id, watcherId, addedBy));
  }

  public removeWatcher(watcherId: UserId, removedBy: UserId): void {
    const index = this.props.watchers.findIndex(w => w.equals(watcherId));
    if (index === -1) {
      return; // Not watching
    }

    this.props.watchers.splice(index, 1);
    this.updateActivity(removedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(
        this.id,
        { watchers: this.props.watchers },
        removedBy
      )
    );
  }

  public delete(deletedBy: UserId): void {
    if (this.props.deletedAt) {
      throw new Error('Task is already deleted');
    }

    this.props.deletedAt = new Date();
    this.markAsModified();

    this.addDomainEvent(new TaskDeletedEvent(this.id, deletedBy));
  }

  private updateActivity(updatedBy?: UserId): void {
    this.props.lastActivityAt = new Date();
    this.markAsModified();
  }

  // Query methods
  public isAssignedTo(userId: UserId): boolean {
    return !!this.props.assigneeId && this.props.assigneeId.equals(userId);
  }

  public isCreatedBy(userId: UserId): boolean {
    return this.props.creatorId.equals(userId);
  }

  public isWatchedBy(userId: UserId): boolean {
    return this.props.watchers.some(w => w.equals(userId));
  }

  public isOverdue(): boolean {
    if (!this.props.dueDate || this.props.status.isCompleted()) {
      return false;
    }
    return new Date() > this.props.dueDate;
  }

  public isSubtask(): boolean {
    return !!this.props.parentTaskId;
  }

  public isEpic(): boolean {
    return !!this.props.epicId;
  }

  public isRecurring(): boolean {
    return !!this.props.recurringTaskId;
  }

  public getDaysUntilDue(): number | null {
    if (!this.props.dueDate) return null;
    const now = new Date();
    const diffTime = this.props.dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public canBeEditedBy(userId: UserId): boolean {
    return this.isCreatedBy(userId) || this.isAssignedTo(userId);
  }

  // Aggregate root implementation
  protected validate(): void {
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }

    if (this.props.title.length > 500) {
      throw new Error('Task title cannot exceed 500 characters');
    }

    if (
      this.props.startDate &&
      this.props.dueDate &&
      this.props.startDate > this.props.dueDate
    ) {
      throw new Error('Start date cannot be after due date');
    }

    if (
      this.props.estimatedHours !== undefined &&
      this.props.estimatedHours < 0
    ) {
      throw new Error('Estimated hours cannot be negative');
    }

    if (this.props.actualHours !== undefined && this.props.actualHours < 0) {
      throw new Error('Actual hours cannot be negative');
    }

    if (this.props.storyPoints !== undefined && this.props.storyPoints < 0) {
      throw new Error('Story points cannot be negative');
    }

    if (this.props.epicId && this.props.epicId.equals(this.props.id)) {
      throw new Error('Task cannot be its own epic');
    }

    if (
      this.props.parentTaskId &&
      this.props.parentTaskId.equals(this.props.id)
    ) {
      throw new Error('Task cannot be its own parent');
    }
  }

  protected applyBusinessRules(): void {
    // Ensure creator is always a watcher
    if (!this.props.watchers.some(w => w.equals(this.props.creatorId))) {
      this.props.watchers.push(this.props.creatorId);
    }

    // Ensure assignee is always a watcher (if assigned)
    if (
      this.props.assigneeId &&
      !this.props.watchers.some(w => w.equals(this.props.assigneeId))
    ) {
      this.props.watchers.push(this.props.assigneeId);
    }

    // Auto-set completion timestamp for completed tasks
    if (this.props.status.isCompleted() && !this.props.completedAt) {
      this.props.completedAt = new Date();
    } else if (!this.props.status.isCompleted() && this.props.completedAt) {
      this.props.completedAt = undefined;
    }

    // Update activity timestamp
    this.props.lastActivityAt = new Date();
    this.props.updatedAt = new Date();
  }
}
