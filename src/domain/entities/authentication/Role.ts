import { BaseEntity } from '../../shared/entities/BaseEntity';
import { RoleId } from '../value-objects/RoleId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { Permission } from './Permission';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface RoleProps {
  id: RoleId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
}

export class RoleCreatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly isSystemRole: boolean
  ) {
    super('RoleCreated', {
      roleId: roleId.value,
      workspaceId: workspaceId.value,
      name,
      isSystemRole,
    });
  }
}

export class RolePermissionsUpdatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly addedPermissions: string[],
    public readonly removedPermissions: string[]
  ) {
    super('RolePermissionsUpdated', {
      roleId: roleId.value,
      addedPermissions,
      removedPermissions,
    });
  }
}

export class RoleDeletedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly workspaceId: WorkspaceId
  ) {
    super('RoleDeleted', {
      roleId: roleId.value,
      workspaceId: workspaceId.value,
    });
  }
}

export class Role extends BaseEntity<RoleProps> {
  private constructor(props: RoleProps) {
    super(props);
  }

  public static create(props: Omit<RoleProps, 'id' | 'createdAt'>): Role {
    const role = new Role({
      ...props,
      id: RoleId.generate(),
      createdAt: new Date(),
    });

    role.addDomainEvent(
      new RoleCreatedEvent(
        role.id,
        role.workspaceId,
        role.name,
        role.isSystemRole
      )
    );

    return role;
  }

  public static fromPersistence(props: RoleProps): Role {
    return new Role(props);
  }

  // Getters
  get id(): RoleId {
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

  get permissions(): string[] {
    return [...this.props.permissions];
  }

  get isSystemRole(): boolean {
    return this.props.isSystemRole;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // Business methods
  public hasPermission(permission: string): boolean {
    return this.props.permissions.includes(permission);
  }

  public hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  public hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  public addPermission(permission: string): void {
    if (this.props.isSystemRole) {
      throw new Error('Cannot modify system role permissions');
    }

    if (this.hasPermission(permission)) {
      return; // Already has permission
    }

    this.props.permissions.push(permission);

    this.addDomainEvent(
      new RolePermissionsUpdatedEvent(this.id, [permission], [])
    );
  }

  public addPermissions(permissions: string[]): void {
    if (this.props.isSystemRole) {
      throw new Error('Cannot modify system role permissions');
    }

    const newPermissions = permissions.filter(p => !this.hasPermission(p));

    if (newPermissions.length === 0) {
      return;
    }

    this.props.permissions.push(...newPermissions);

    this.addDomainEvent(
      new RolePermissionsUpdatedEvent(this.id, newPermissions, [])
    );
  }

  public removePermission(permission: string): void {
    if (this.props.isSystemRole) {
      throw new Error('Cannot modify system role permissions');
    }

    const index = this.props.permissions.indexOf(permission);
    if (index === -1) {
      return; // Permission not found
    }

    this.props.permissions.splice(index, 1);

    this.addDomainEvent(
      new RolePermissionsUpdatedEvent(this.id, [], [permission])
    );
  }

  public removePermissions(permissions: string[]): void {
    if (this.props.isSystemRole) {
      throw new Error('Cannot modify system role permissions');
    }

    const removedPermissions = permissions.filter(p => this.hasPermission(p));

    if (removedPermissions.length === 0) {
      return;
    }

    this.props.permissions = this.props.permissions.filter(
      p => !removedPermissions.includes(p)
    );

    this.addDomainEvent(
      new RolePermissionsUpdatedEvent(this.id, [], removedPermissions)
    );
  }

  public updateDescription(description?: string): void {
    if (this.props.isSystemRole) {
      throw new Error('Cannot modify system role');
    }

    this.props.description = description;
  }

  public canBeDeleted(): boolean {
    return !this.props.isSystemRole;
  }

  public delete(): void {
    if (!this.canBeDeleted()) {
      throw new Error('Cannot delete system role');
    }

    this.addDomainEvent(new RoleDeletedEvent(this.id, this.workspaceId));
  }

  public getRoleInfo(): {
    id: string;
    workspaceId: string;
    name: string;
    description?: string;
    permissionCount: number;
    isSystemRole: boolean;
    canBeModified: boolean;
    canBeDeleted: boolean;
  } {
    return {
      id: this.id.value,
      workspaceId: this.workspaceId.value,
      name: this.name,
      description: this.description,
      permissionCount: this.props.permissions.length,
      isSystemRole: this.isSystemRole,
      canBeModified: !this.isSystemRole,
      canBeDeleted: this.canBeDeleted(),
    };
  }

  // Static factory methods for system roles
  public static createOwnerRole(workspaceId: WorkspaceId): Role {
    return new Role({
      id: RoleId.generate(),
      workspaceId,
      name: 'Owner',
      description: 'Full access to workspace and all resources',
      permissions: Permission.getAllPermissions(),
      isSystemRole: true,
      createdAt: new Date(),
    });
  }

  public static createAdminRole(workspaceId: WorkspaceId): Role {
    return new Role({
      id: RoleId.generate(),
      workspaceId,
      name: 'Admin',
      description: 'Administrative access to workspace resources',
      permissions: Permission.getAdminPermissions(),
      isSystemRole: true,
      createdAt: new Date(),
    });
  }

  public static createMemberRole(workspaceId: WorkspaceId): Role {
    return new Role({
      id: RoleId.generate(),
      workspaceId,
      name: 'Member',
      description: 'Standard member access to workspace resources',
      permissions: Permission.getMemberPermissions(),
      isSystemRole: true,
      createdAt: new Date(),
    });
  }

  public static createViewerRole(workspaceId: WorkspaceId): Role {
    return new Role({
      id: RoleId.generate(),
      workspaceId,
      name: 'Viewer',
      description: 'Read-only access to workspace resources',
      permissions: Permission.getViewerPermissions(),
      isSystemRole: true,
      createdAt: new Date(),
    });
  }
}
