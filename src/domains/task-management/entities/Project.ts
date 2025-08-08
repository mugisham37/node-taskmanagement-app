import { BaseEntity } from '../../shared/entities/BaseEntity';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import {
  ProjectStatus,
  ProjectStatusEnum,
} from '../value-objects/ProjectStatus';
import { Priority, PriorityEnum } from '../value-objects/Priority';

export interface ProjectSettings {
  allowTaskCreation?: boolean;
  requireTaskApproval?: boolean;
  enableTimeTracking?: boolean;
  defaultTaskPriority?: PriorityEnum;
  autoAssignTasks?: boolean;
  notifyOnTaskUpdates?: boolean;
  customFields?: Record<string, any>;
}

export interface ProjectProps {
  id: ProjectId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  color: string;
  ownerId: UserId;
  status: ProjectStatus;
  priority: Priority;
  startDate?: Date;
  endDate?: Date;
  budgetAmount?: number;
  budgetCurrency: string;
  settings: ProjectSettings;
  templateId?: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: UserId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Domain Events
export class ProjectCreatedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly ownerId: UserId
  ) {
    super('ProjectCreated', {
      projectId: projectId.value,
      workspaceId: workspaceId.value,
      name,
      ownerId: ownerId.value,
    });
  }
}

export class ProjectUpdatedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly changes: Partial<ProjectProps>
  ) {
    super('ProjectUpdated', {
      projectId: projectId.value,
      changes,
    });
  }
}

export class ProjectStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly oldStatus: ProjectStatus,
    public readonly newStatus: ProjectStatus,
    public readonly changedBy: UserId
  ) {
    super('ProjectStatusChanged', {
      projectId: projectId.value,
      oldStatus: oldStatus.value,
      newStatus: newStatus.value,
      changedBy: changedBy.value,
    });
  }
}

export class ProjectArchivedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly archivedBy: UserId,
    public readonly reason?: string
  ) {
    super('ProjectArchived', {
      projectId: projectId.value,
      archivedBy: archivedBy.value,
      reason,
    });
  }
}

export class ProjectDeletedEvent extends DomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly deletedBy: UserId
  ) {
    super('ProjectDeleted', {
      projectId: projectId.value,
      deletedBy: deletedBy.value,
    });
  }
}

export class Project extends BaseEntity<ProjectProps> {
  private constructor(props: ProjectProps) {
    super(props);
  }

  public static create(
    props: Omit<ProjectProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Project {
    // Validate project name
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Project name cannot be empty');
    }

    if (props.name.length > 200) {
      throw new Error('Project name cannot exceed 200 characters');
    }

    // Validate dates
    if (props.startDate && props.endDate && props.startDate > props.endDate) {
      throw new Error('Start date cannot be after end date');
    }

    // Validate budget
    if (props.budgetAmount !== undefined && props.budgetAmount < 0) {
      throw new Error('Budget amount cannot be negative');
    }

    const project = new Project({
      ...props,
      id: ProjectId.generate(),
      color: props.color || '#3B82F6',
      status: props.status || ProjectStatus.planning(),
      priority: props.priority || Priority.medium(),
      budgetCurrency: props.budgetCurrency || 'USD',
      settings: {
        allowTaskCreation: true,
        requireTaskApproval: false,
        enableTimeTracking: true,
        defaultTaskPriority: PriorityEnum.MEDIUM,
        autoAssignTasks: false,
        notifyOnTaskUpdates: true,
        customFields: {},
        ...props.settings,
      },
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    project.addDomainEvent(
      new ProjectCreatedEvent(
        project.id,
        project.workspaceId,
        project.name,
        project.ownerId
      )
    );

    return project;
  }

  public static fromPersistence(props: ProjectProps): Project {
    return new Project(props);
  }

  // Getters
  get id(): ProjectId {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get color(): string {
    return this.props.color;
  }

  get ownerId(): UserId {
    return this.props.ownerId;
  }

  get status(): ProjectStatus {
    return this.props.status;
  }

  get priority(): Priority {
    return this.props.priority;
  }

  get startDate(): Date | undefined {
    return this.props.startDate;
  }

  get endDate(): Date | undefined {
    return this.props.endDate;
  }

  get budgetAmount(): number | undefined {
    return this.props.budgetAmount;
  }

  get budgetCurrency(): string {
    return this.props.budgetCurrency;
  }

  get settings(): ProjectSettings {
    return { ...this.props.settings };
  }

  get templateId(): string | undefined {
    return this.props.templateId;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get archivedAt(): Date | undefined {
    return this.props.archivedAt;
  }

  get archivedBy(): UserId | undefined {
    return this.props.archivedBy;
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
  public updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Project name cannot be empty');
    }

    if (name.length > 200) {
      throw new Error('Project name cannot exceed 200 characters');
    }

    this.props.name = name.trim();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ProjectUpdatedEvent(this.id, { name: this.props.name })
    );
  }

  public updateDescription(description?: string): void {
    this.props.description = description;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ProjectUpdatedEvent(this.id, { description }));
  }

  public updateColor(color: string): void {
    if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
      throw new Error('Invalid color format. Use hex format like #3B82F6');
    }

    this.props.color = color;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ProjectUpdatedEvent(this.id, { color }));
  }

  public changeStatus(newStatus: ProjectStatus, changedBy: UserId): void {
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.props.status.value} to ${newStatus.value}`
      );
    }

    const oldStatus = this.props.status;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ProjectStatusChangedEvent(this.id, oldStatus, newStatus, changedBy)
    );
  }

  public updatePriority(priority: Priority): void {
    this.props.priority = priority;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ProjectUpdatedEvent(this.id, { priority }));
  }

  public updateTimeline(startDate?: Date, endDate?: Date): void {
    if (startDate && endDate && startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    this.props.startDate = startDate;
    this.props.endDate = endDate;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ProjectUpdatedEvent(this.id, { startDate, endDate })
    );
  }

  public updateBudget(amount?: number, currency?: string): void {
    if (amount !== undefined && amount < 0) {
      throw new Error('Budget amount cannot be negative');
    }

    this.props.budgetAmount = amount;
    if (currency) {
      this.props.budgetCurrency = currency;
    }
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ProjectUpdatedEvent(this.id, {
        budgetAmount: amount,
        budgetCurrency: this.props.budgetCurrency,
      })
    );
  }

  public updateSettings(settings: Partial<ProjectSettings>): void {
    this.props.settings = {
      ...this.props.settings,
      ...settings,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ProjectUpdatedEvent(this.id, { settings: this.props.settings })
    );
  }

  public archive(archivedBy: UserId, reason?: string): void {
    if (this.props.isArchived) {
      throw new Error('Project is already archived');
    }

    this.props.isArchived = true;
    this.props.archivedAt = new Date();
    this.props.archivedBy = archivedBy;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ProjectArchivedEvent(this.id, archivedBy, reason));
  }

  public unarchive(): void {
    if (!this.props.isArchived) {
      throw new Error('Project is not archived');
    }

    this.props.isArchived = false;
    this.props.archivedAt = undefined;
    this.props.archivedBy = undefined;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ProjectUpdatedEvent(this.id, {
        isArchived: false,
        archivedAt: undefined,
        archivedBy: undefined,
      })
    );
  }

  public delete(deletedBy: UserId): void {
    if (this.props.deletedAt) {
      throw new Error('Project is already deleted');
    }

    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ProjectDeletedEvent(this.id, deletedBy));
  }

  public isOwner(userId: UserId): boolean {
    return this.props.ownerId.equals(userId);
  }

  public canAcceptTasks(): boolean {
    return (
      this.props.status.canAcceptTasks() &&
      !this.props.isArchived &&
      !this.props.deletedAt
    );
  }

  public isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  public isOverdue(): boolean {
    if (!this.props.endDate) return false;
    return new Date() > this.props.endDate && !this.props.status.isCompleted();
  }

  public getDuration(): number | null {
    if (!this.props.startDate || !this.props.endDate) return null;
    return this.props.endDate.getTime() - this.props.startDate.getTime();
  }

  public getProgress(): number {
    // This would typically be calculated based on completed tasks
    // For now, return a basic calculation based on status
    switch (this.props.status.value) {
      case ProjectStatusEnum.PLANNING:
        return 0;
      case ProjectStatusEnum.ACTIVE:
        return 50; // Would be calculated from actual task completion
      case ProjectStatusEnum.ON_HOLD:
        return 25; // Partial progress
      case ProjectStatusEnum.COMPLETED:
        return 100;
      case ProjectStatusEnum.CANCELLED:
        return 0;
      default:
        return 0;
    }
  }
}
