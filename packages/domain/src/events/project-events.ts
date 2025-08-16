import { BaseDomainEvent } from './domain-event';
import {
  ProjectId,
  UserId,
  WorkspaceId,
  ProjectRoleVO,
  ProjectStatusVO,
} from '../value-objects';

/**
 * Project Created Event
 */
export class ProjectCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly name: string,
    public readonly description: string,
    public readonly workspaceId: WorkspaceId,
    public readonly managerId: UserId,
    public readonly startDate?: Date,
    public readonly endDate?: Date
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectCreated';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      name: this.name,
      description: this.description,
      workspaceId: this.workspaceId.toString(),
      managerId: this.managerId.toString(),
      startDate: this.startDate?.toISOString(),
      endDate: this.endDate?.toISOString(),
    };
  }
}

/**
 * Project Updated Event
 */
export class ProjectUpdatedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly updatedBy: UserId,
    public readonly changes: Record<string, any>
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectUpdated';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      updatedBy: this.updatedBy.toString(),
      changes: this.changes,
    };
  }
}

/**
 * Project Member Added Event
 */
export class ProjectMemberAddedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly userId: UserId,
    public readonly memberId: UserId,
    public readonly role: ProjectRoleVO,
    public readonly addedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectMemberAdded';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      userId: this.userId.toString(),
      memberId: this.memberId.toString(),
      role: this.role.toString(),
      addedBy: this.addedBy.toString(),
    };
  }
}

/**
 * Project Member Removed Event
 */
export class ProjectMemberRemovedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly userId: UserId,
    public readonly memberId: UserId,
    public readonly removedBy: UserId,
    public readonly previousRole: ProjectRoleVO
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectMemberRemoved';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      userId: this.userId.toString(),
      memberId: this.memberId.toString(),
      removedBy: this.removedBy.toString(),
      previousRole: this.previousRole.value,
    };
  }
}

/**
 * Project Member Role Updated Event
 */
export class ProjectMemberRoleUpdatedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly userId: UserId,
    public readonly oldRole: ProjectRoleVO,
    public readonly newRole: ProjectRoleVO,
    public readonly updatedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectMemberRoleUpdated';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      userId: this.userId.toString(),
      oldRole: this.oldRole.value,
      newRole: this.newRole.value,
      updatedBy: this.updatedBy.toString(),
    };
  }
}

/**
 * Project Status Changed Event
 */
export class ProjectStatusChangedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly oldStatus: ProjectStatusVO,
    public readonly newStatus: ProjectStatusVO,
    public readonly changedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectStatusChanged';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      oldStatus: this.oldStatus.value,
      newStatus: this.newStatus.value,
      changedBy: this.changedBy.toString(),
    };
  }
}

/**
 * Project Put On Hold Event
 */
export class ProjectPutOnHoldEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly putOnHoldBy: UserId,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectPutOnHold';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      putOnHoldBy: this.putOnHoldBy.toString(),
      reason: this.reason,
    };
  }
}

/**
 * Project Activated Event
 */
export class ProjectActivatedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly activatedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectActivated';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      activatedBy: this.activatedBy.toString(),
    };
  }
}

/**
 * Project Completed Event
 */
export class ProjectCompletedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly completedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectCompleted';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      completedBy: this.completedBy.toString(),
    };
  }
}

/**
 * Project Cancelled Event
 */
export class ProjectCancelledEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly cancelledBy: UserId,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectCancelled';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      cancelledBy: this.cancelledBy.toString(),
      reason: this.reason,
    };
  }
}

/**
 * Project Archived Event
 */
export class ProjectArchivedEvent extends BaseDomainEvent {
  constructor(
    public readonly projectId: ProjectId,
    public readonly archivedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'ProjectArchived';
  }

  getAggregateId(): string {
    return this.projectId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      projectId: this.projectId.toString(),
      archivedBy: this.archivedBy.toString(),
    };
  }
}
