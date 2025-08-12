import { BaseCommand } from './base-command';
import { ProjectId } from '../../domain/value-objects/project-id';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { UserId } from '../../domain/value-objects/user-id';
import { ProjectRole } from '../../shared/enums/common.enums';
import { ProjectStatus } from '../../shared/enums/common.enums';

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
