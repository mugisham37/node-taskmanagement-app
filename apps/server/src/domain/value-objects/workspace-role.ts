/**
 * Workspace Role Value Object
 * Represents the different roles a user can have in a workspace
 */
export class WorkspaceRole {
  public static readonly OWNER = 'OWNER';
  public static readonly ADMIN = 'ADMIN';
  public static readonly MEMBER = 'MEMBER';

  private static readonly VALID_ROLES = [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER
  ];

  private constructor(private readonly value: string) {}

  public static fromString(value: string): WorkspaceRole {
    if (!WorkspaceRole.VALID_ROLES.includes(value)) {
      throw new Error(`Invalid workspace role: ${value}`);
    }
    return new WorkspaceRole(value);
  }

  public static owner(): WorkspaceRole {
    return new WorkspaceRole(WorkspaceRole.OWNER);
  }

  public static admin(): WorkspaceRole {
    return new WorkspaceRole(WorkspaceRole.ADMIN);
  }

  public static member(): WorkspaceRole {
    return new WorkspaceRole(WorkspaceRole.MEMBER);
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: WorkspaceRole): boolean {
    return this.value === other.value;
  }

  public isOwner(): boolean {
    return this.value === WorkspaceRole.OWNER;
  }

  public isAdmin(): boolean {
    return this.value === WorkspaceRole.ADMIN || this.value === WorkspaceRole.OWNER;
  }

  public isMember(): boolean {
    return this.value === WorkspaceRole.MEMBER;
  }

  public canManageMembers(): boolean {
    return this.isAdmin();
  }

  public canManageWorkspace(): boolean {
    return this.isOwner();
  }

  public getPermissions(): string[] {
    switch (this.value) {
      case WorkspaceRole.OWNER:
        return [
          'workspace:read',
          'workspace:update',
          'workspace:delete',
          'workspace:manage-members',
          'workspace:transfer-ownership',
          'project:create',
          'project:read',
          'project:update',
          'project:delete',
          'task:create',
          'task:read',
          'task:update',
          'task:delete'
        ];
      case WorkspaceRole.ADMIN:
        return [
          'workspace:read',
          'workspace:update',
          'workspace:manage-members',
          'project:create',
          'project:read',
          'project:update',
          'project:delete',
          'task:create',
          'task:read',
          'task:update',
          'task:delete'
        ];
      case WorkspaceRole.MEMBER:
        return [
          'workspace:read',
          'project:read',
          'task:create',
          'task:read',
          'task:update'
        ];
      default:
        return [];
    }
  }
}
