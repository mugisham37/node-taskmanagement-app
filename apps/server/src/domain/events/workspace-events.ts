import { BaseDomainEvent } from './domain-event';
import { WorkspaceId } from '../value-objects/workspace-id';
import { UserId } from '../value-objects/user-id';
import { WorkspaceRole } from '../value-objects/workspace-role';

/**
 * Workspace Created Event
 */
export class WorkspaceCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly description: string,
    public readonly ownerId: UserId,
    public readonly plan: string,
    public readonly settings: Record<string, any>,
    public readonly createdAt: Date
  ) {
    super({ workspaceId: workspaceId.value, name, ownerId: ownerId.value });
  }

  getEventName(): string {
    return 'workspace.created';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      name: this.name,
      description: this.description,
      ownerId: this.ownerId.value,
      plan: this.plan,
      settings: this.settings,
      createdAt: this.createdAt
    };
  }
}

/**
 * Workspace Updated Event
 */
export class WorkspaceUpdatedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly changes: {
      name?: string;
      description?: string;
      plan?: string;
      settings?: Record<string, any>;
    },
    public readonly updatedBy: UserId,
    public readonly updatedAt: Date
  ) {
    super({ workspaceId: workspaceId.value, changes, updatedBy: updatedBy.value });
  }

  getEventName(): string {
    return 'workspace.updated';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      changes: this.changes,
      updatedBy: this.updatedBy.value,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Workspace Deleted Event
 */
export class WorkspaceDeletedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly deletedBy: UserId,
    public readonly deletedAt: Date
  ) {
    super({ workspaceId: workspaceId.value, name, deletedBy: deletedBy.value });
  }

  getEventName(): string {
    return 'workspace.deleted';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      name: this.name,
      deletedBy: this.deletedBy.value,
      deletedAt: this.deletedAt
    };
  }
}

/**
 * Workspace Member Added Event
 */
export class WorkspaceMemberAddedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly role: WorkspaceRole,
    public readonly addedBy: UserId,
    public readonly addedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      userId: userId.value, 
      role: role.getValue(),
      addedBy: addedBy.value 
    });
  }

  getEventName(): string {
    return 'workspace.member.added';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      userId: this.userId.value,
      role: this.role.getValue(),
      addedBy: this.addedBy.value,
      addedAt: this.addedAt
    };
  }
}

/**
 * Workspace Member Removed Event
 */
export class WorkspaceMemberRemovedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly removedBy: UserId,
    public readonly removedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      userId: userId.value, 
      removedBy: removedBy.value 
    });
  }

  getEventName(): string {
    return 'workspace.member.removed';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      userId: this.userId.value,
      removedBy: this.removedBy.value,
      removedAt: this.removedAt
    };
  }
}

/**
 * Workspace Member Role Updated Event
 */
export class WorkspaceMemberRoleUpdatedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly oldRole: WorkspaceRole,
    public readonly newRole: WorkspaceRole,
    public readonly updatedBy: UserId,
    public readonly updatedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      userId: userId.value, 
      oldRole: oldRole.getValue(),
      newRole: newRole.getValue(),
      updatedBy: updatedBy.value 
    });
  }

  getEventName(): string {
    return 'workspace.member.role.updated';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      userId: this.userId.value,
      oldRole: this.oldRole.getValue(),
      newRole: this.newRole.getValue(),
      updatedBy: this.updatedBy.value,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Workspace Settings Updated Event
 */
export class WorkspaceSettingsUpdatedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly oldSettings: Record<string, any>,
    public readonly newSettings: Record<string, any>,
    public readonly updatedBy: UserId,
    public readonly updatedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      oldSettings, 
      newSettings, 
      updatedBy: updatedBy.value 
    });
  }

  getEventName(): string {
    return 'workspace.settings.updated';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      oldSettings: this.oldSettings,
      newSettings: this.newSettings,
      updatedBy: this.updatedBy.value,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Workspace Plan Changed Event
 */
export class WorkspacePlanChangedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly oldPlan: string,
    public readonly newPlan: string,
    public readonly changedBy: UserId,
    public readonly changedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      oldPlan, 
      newPlan, 
      changedBy: changedBy.value 
    });
  }

  getEventName(): string {
    return 'workspace.plan.changed';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      oldPlan: this.oldPlan,
      newPlan: this.newPlan,
      changedBy: this.changedBy.value,
      changedAt: this.changedAt
    };
  }
}

/**
 * Workspace Invitation Sent Event
 */
export class WorkspaceInvitationSentEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly email: string,
    public readonly role: WorkspaceRole,
    public readonly invitedBy: UserId,
    public readonly invitationToken: string,
    public readonly expiresAt: Date,
    public readonly sentAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      email, 
      role: role.getValue(),
      invitedBy: invitedBy.value,
      invitationToken
    });
  }

  getEventName(): string {
    return 'workspace.invitation.sent';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      email: this.email,
      role: this.role.getValue(),
      invitedBy: this.invitedBy.value,
      invitationToken: this.invitationToken,
      expiresAt: this.expiresAt,
      sentAt: this.sentAt
    };
  }
}

/**
 * Workspace Invitation Accepted Event
 */
export class WorkspaceInvitationAcceptedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly email: string,
    public readonly role: WorkspaceRole,
    public readonly invitationToken: string,
    public readonly acceptedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      userId: userId.value,
      email, 
      role: role.getValue(),
      invitationToken
    });
  }

  getEventName(): string {
    return 'workspace.invitation.accepted';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      userId: this.userId.value,
      email: this.email,
      role: this.role.getValue(),
      invitationToken: this.invitationToken,
      acceptedAt: this.acceptedAt
    };
  }
}

/**
 * Workspace Invitation Rejected Event
 */
export class WorkspaceInvitationRejectedEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly email: string,
    public readonly invitationToken: string,
    public readonly rejectedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      email, 
      invitationToken
    });
  }

  getEventName(): string {
    return 'workspace.invitation.rejected';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      email: this.email,
      invitationToken: this.invitationToken,
      rejectedAt: this.rejectedAt
    };
  }
}

/**
 * User Invited To Workspace Event
 * This event is fired when a user is invited to join a workspace
 */
export class UserInvitedToWorkspaceEvent extends BaseDomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly email: string,
    public readonly role: WorkspaceRole,
    public readonly invitedBy: UserId,
    public readonly invitationToken: string,
    public readonly invitedAt: Date
  ) {
    super({ 
      workspaceId: workspaceId.value, 
      email, 
      role: role.getValue(),
      invitedBy: invitedBy.value,
      invitationToken
    });
  }

  getEventName(): string {
    return 'user.invited.to.workspace';
  }

  getAggregateId(): string {
    return this.workspaceId.value;
  }

  protected getPayload(): Record<string, any> {
    return {
      workspaceId: this.workspaceId.value,
      email: this.email,
      role: this.role.getValue(),
      invitedBy: this.invitedBy.value,
      invitationToken: this.invitationToken,
      invitedAt: this.invitedAt
    };
  }
}
