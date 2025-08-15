import { ProjectRole, ProjectStatus } from '@project/core/enums/common.enums';
import { ProjectId } from '@project/domain/value-objects/project-id';
import { UserId } from '@project/domain/value-objects/user-id';
import { WorkspaceId } from '@project/domain/value-objects/workspace-id';
import { BaseCommand } from './base-command';

export class CreateProjectCommand extends BaseCommand {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly workspaceId: WorkspaceId,
    public readonly managerId: UserId,
    userId: UserId,
    public readonly startDate?: Date,
    public readonly endDate?: Date
  ) {
    super(userId);
  }
}

export class UpdateProjectCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    userId: UserId,
    public readonly name?: string,
    public readonly description?: string,
    public readonly startDate?: Date,
    public readonly endDate?: Date
  ) {
    super(userId);
  }
}

export class AddProjectMemberCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    public readonly memberId: UserId,
    public readonly role: ProjectRole,
    public readonly addedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class RemoveProjectMemberCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    public readonly memberId: UserId,
    public readonly removedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class UpdateProjectMemberRoleCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    public readonly memberId: UserId,
    public readonly newRole: ProjectRole,
    public readonly updatedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class ArchiveProjectCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    public readonly archivedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class RestoreProjectCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    public readonly restoredBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class UpdateProjectStatusCommand extends BaseCommand {
  constructor(
    public readonly projectId: ProjectId,
    public readonly status: ProjectStatus,
    public readonly updatedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}