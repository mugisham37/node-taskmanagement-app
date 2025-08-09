import { DomainEvent } from './domain-event';
import { WorkspaceId, UserId, ProjectId } from '../value-objects';

/**
 * Workspace Created Event
 */
export class WorkspaceCreatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly description: string,
    public readonly ownerId: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceCreated';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      name: this.name,
      description: this.description,
      ownerId: this.ownerId.toString(),
    };
  }
}

/**
 * Workspace Updated Event
 */
export class WorkspaceUpdatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly updatedBy: UserId,
    public readonly changes: Record<string, any>
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceUpdated';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      updatedBy: this.updatedBy.toString(),
      changes: this.changes,
    };
  }
}

/**
 * Workspace Member Added Event
 */
export class WorkspaceMemberAddedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly role: 'OWNER' | 'ADMIN' | 'MEMBER',
    public readonly addedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceMemberAdded';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      userId: this.userId.toString(),
      role: this.role,
      addedBy: this.addedBy.toString(),
    };
  }
}

/**
 * Workspace Member Removed Event
 */
export class WorkspaceMemberRemovedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly removedBy: UserId,
    public readonly previousRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceMemberRemoved';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      userId: this.userId.toString(),
      removedBy: this.removedBy.toString(),
      previousRole: this.previousRole,
    };
  }
}

/**
 * Workspace Member Role Updated Event
 */
export class WorkspaceMemberRoleUpdatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly oldRole: 'ADMIN' | 'MEMBER',
    public readonly newRole: 'ADMIN' | 'MEMBER',
    public readonly updatedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceMemberRoleUpdated';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      userId: this.userId.toString(),
      oldRole: this.oldRole,
      newRole: this.newRole,
      updatedBy: this.updatedBy.toString(),
    };
  }
}

/**
 * Workspace Project Added Event
 */
export class WorkspaceProjectAddedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly projectId: ProjectId,
    public readonly projectName: string,
    public readonly addedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceProjectAdded';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      projectId: this.projectId.toString(),
      projectName: this.projectName,
      addedBy: this.addedBy.toString(),
    };
  }
}

/**
 * Workspace Project Removed Event
 */
export class WorkspaceProjectRemovedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly projectId: ProjectId,
    public readonly projectName: string,
    public readonly removedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceProjectRemoved';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      projectId: this.projectId.toString(),
      projectName: this.projectName,
      removedBy: this.removedBy.toString(),
    };
  }
}

/**
 * Workspace Deactivated Event
 */
export class WorkspaceDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly deactivatedBy: UserId,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceDeactivated';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      deactivatedBy: this.deactivatedBy.toString(),
      reason: this.reason,
    };
  }
}

/**
 * Workspace Activated Event
 */
export class WorkspaceActivatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly activatedBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceActivated';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      activatedBy: this.activatedBy.toString(),
    };
  }
}

/**
 * Workspace Ownership Transferred Event
 */
export class WorkspaceOwnershipTransferredEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly previousOwnerId: UserId,
    public readonly newOwnerId: UserId,
    public readonly transferredBy: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'WorkspaceOwnershipTransferred';
  }

  getAggregateId(): string {
    return this.workspaceId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.toString(),
      previousOwnerId: this.previousOwnerId.toString(),
      newOwnerId: this.newOwnerId.toString(),
      transferredBy: this.transferredBy.toString(),
    };
  }
}
