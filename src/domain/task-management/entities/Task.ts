import { BaseEntity } from '../../shared/entities/BaseEntity';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { TaskId } from '../value-objects/TaskId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskStatus, TaskStatusEnum } from '../value-objects/TaskStatus';
import { Priority, PriorityEnum } from '../value-objects/Priority';

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
export class TaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly workspaceId: WorkspaceId,
    public readonly projectId: ProjectId | undefined,
    public readonly title: string,
    public readonly creatorId: UserId
  ) {
    super('TaskCreated', {
      taskId: taskId.value,
      workspaceId: workspaceId.value,
      projectId: projectId?.value,
      title,
      creatorId: creatorId.value,
    });
  }
}

export class TaskUpdatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly changes: Partial<TaskProps>,
    public readonly updatedBy: UserId
  ) {
    super('TaskUpdated', {
      taskId: taskId.value,
      changes,
      updatedBy: updatedBy.value,
    });
  }
}

export class TaskStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly oldStatus: TaskStatus,
    public readonly newStatus: TaskStatus,
    public readonly changedBy: UserId
  ) {
    super('TaskStatusChanged', {
      taskId: taskId.value,
      oldStatus: oldStatus.value,
      newStatus: newStatus.value,
      changedBy: changedBy.value,
    });
  }
}

export class TaskAssignedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly assigneeId: UserId,
    public readonly assignedBy: UserId,
    public readonly previousAssigneeId?: UserId
  ) {
    super('TaskAssigned', {
      taskId: taskId.value,
      assigneeId: assigneeId.value,
      assignedBy: assignedBy.value,
      previousAssigneeId: previousAssigneeId?.value,
    });
  }
}

export class TaskUnassignedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly previousAssigneeId: UserId,
    public readonly unassignedBy: UserId
  ) {
    super('TaskUnassigned', {
      taskId: taskId.value,
      previousAssigneeId: previousAssigneeId.value,
      unassignedBy: unassignedBy.value,
    });
  }
}

export class TaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly completedBy: UserId,
    public readonly completedAt: Date
  ) {
    super('TaskCompleted', {
      taskId: taskId.value,
      completedBy: completedBy.value,
      completedAt: completedAt.toISOString(),
    });
  }
}

export class TaskDeletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly deletedBy: UserId
  ) {
    super('TaskDeleted', {
      taskId: taskId.value,
      deletedBy: deletedBy.value,
    });
  }
}

export class TaskWatcherAddedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly watcherId: UserId,
    public readonly addedBy: UserId
  ) {
    super('TaskWatcherAdded', {
      taskId: taskId.value,
      watcherId: watcherId.value,
      addedBy: addedBy.value,
    });
  }
}

export class Task extends BaseEntity<TaskProps> {
  private constructor(props: TaskProps) {
    super(props);
  }

  public static create(
    props: Omit<TaskProps, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>
  ): Task {
    // Validate task title
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }

    if (props.title.length > 500) {
      throw new Error('Task title cannot exceed 500 characters');
    }

    // Validate dates
    if (props.startDate && props.dueDate && props.startDate > props.dueDate) {
      throw new Error('Start date cannot be after due date');
    }

    // Validate effort estimates
    if (props.estimatedHours !== undefined && props.estimatedHours < 0) {
      throw new Error('Estimated hours cannot be negative');
    }

    if (props.actualHours !== undefined && props.actualHours < 0) {
      throw new Error('Actual hours cannot be negative');
    }

    if (props.storyPoints !== undefined && props.storyPoints < 0) {
      throw new Error('Story points cannot be negative');
    }

    // Validate self-referential relationships
    const taskId = TaskId.generate();
    if (props.epicId && props.epicId.equals(taskId)) {
      throw new Error('Task cannot be its own epic');
    }

    if (props.parentTaskId && props.parentTaskId.equals(taskId)) {
      throw new Error('Task cannot be its own parent');
    }

    const now = new Date();
    const task = new Task({
      ...props,
      id: taskId,
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

  public static fromPersistence(props: TaskProps): Task {
    return new Task(props);
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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  // Business methods
  public updateTitle(title: string, updatedBy: UserId): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }

    if (title.length > 500) {
      throw new Error('Task title cannot exceed 500 characters');
    }

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

    // Set completion timestamp if task is completed
    if (newStatus.isCompleted() && !this.props.completedAt) {
      this.props.completedAt = new Date();
      this.addDomainEvent(
        new TaskCompletedEvent(this.id, changedBy, this.props.completedAt)
      );
    } else if (!newStatus.isCompleted() && this.props.completedAt) {
      // Clear completion timestamp if task is reopened
      this.props.completedAt = undefined;
    }

    this.updateActivity(changedBy);

    this.addDomainEvent(
      new TaskStatusChangedEvent(this.id, oldStatus, newStatus, changedBy)
    );
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

  public updateEffortEstimate(
    estimatedHours?: number,
    storyPoints?: number,
    updatedBy?: UserId
  ): void {
    if (estimatedHours !== undefined && estimatedHours < 0) {
      throw new Error('Estimated hours cannot be negative');
    }

    if (storyPoints !== undefined && storyPoints < 0) {
      throw new Error('Story points cannot be negative');
    }

    this.props.estimatedHours = estimatedHours;
    this.props.storyPoints = storyPoints;

    if (updatedBy) {
      this.updateActivity(updatedBy);
      this.addDomainEvent(
        new TaskUpdatedEvent(
          this.id,
          { estimatedHours, storyPoints },
          updatedBy
        )
      );
    }
  }

  public recordActualHours(hours: number, updatedBy: UserId): void {
    if (hours < 0) {
      throw new Error('Actual hours cannot be negative');
    }

    this.props.actualHours = (this.props.actualHours || 0) + hours;
    this.updateActivity(updatedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(
        this.id,
        { actualHours: this.props.actualHours },
        updatedBy
      )
    );
  }

  public updateTags(tags: string[], updatedBy: UserId): void {
    this.props.tags = [...new Set(tags)]; // Remove duplicates
    this.updateActivity(updatedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(this.id, { tags: this.props.tags }, updatedBy)
    );
  }

  public updateLabels(labels: string[], updatedBy: UserId): void {
    this.props.labels = [...new Set(labels)]; // Remove duplicates
    this.updateActivity(updatedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(this.id, { labels: this.props.labels }, updatedBy)
    );
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

  public updateCustomFields(
    fields: Record<string, any>,
    updatedBy: UserId
  ): void {
    this.props.customFields = { ...this.props.customFields, ...fields };
    this.updateActivity(updatedBy);

    this.addDomainEvent(
      new TaskUpdatedEvent(
        this.id,
        { customFields: this.props.customFields },
        updatedBy
      )
    );
  }

  public updatePosition(position: number, updatedBy: UserId): void {
    this.props.position = position;
    this.updateActivity(updatedBy);

    this.addDomainEvent(new TaskUpdatedEvent(this.id, { position }, updatedBy));
  }

  public delete(deletedBy: UserId): void {
    if (this.props.deletedAt) {
      throw new Error('Task is already deleted');
    }

    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new TaskDeletedEvent(this.id, deletedBy));
  }

  private updateActivity(updatedBy?: UserId): void {
    this.props.lastActivityAt = new Date();
    this.props.updatedAt = new Date();
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

  public isDeleted(): boolean {
    return !!this.props.deletedAt;
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

  public getEffortVariance(): number | null {
    if (!this.props.estimatedHours || !this.props.actualHours) return null;
    return this.props.actualHours - this.props.estimatedHours;
  }

  public canBeEditedBy(userId: UserId): boolean {
    return this.isCreatedBy(userId) || this.isAssignedTo(userId);
  }
}
