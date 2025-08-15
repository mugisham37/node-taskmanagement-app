import { UserId } from '@project/domain/value-objects/user-id';
import { WorkspaceId } from '@project/domain/value-objects/workspace-id';
import { BaseCommand } from './base-command';

export class CreateWorkspaceCommand extends BaseCommand {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly ownerId: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class UpdateWorkspaceCommand extends BaseCommand {
  constructor(
    public readonly workspaceId: WorkspaceId,
    userId: UserId,
    public readonly name?: string,
    public readonly description?: string
  ) {
    super(userId);
  }
}

export class InviteUserToWorkspaceCommand extends BaseCommand {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly inviteeEmail: string,
    public readonly invitedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class RemoveUserFromWorkspaceCommand extends BaseCommand {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly userToRemove: UserId,
    public readonly removedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class TransferWorkspaceOwnershipCommand extends BaseCommand {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly newOwnerId: UserId,
    public readonly currentOwnerId: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class ArchiveWorkspaceCommand extends BaseCommand {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly archivedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}