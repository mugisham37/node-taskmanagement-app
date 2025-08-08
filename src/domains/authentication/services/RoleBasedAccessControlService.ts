import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { UserId } from '../value-objects/UserId';
import { RoleId } from '../value-objects/RoleId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface RoleAssignment {
  userId: UserId;
  roleId: RoleId;
  workspaceId?: WorkspaceId;
  assignedBy: UserId;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface PermissionCheck {
  permission: string;
  resource?: string;
  resourceId?: string;
  workspaceId?: WorkspaceId;
}

export interface AccessControlContext {
  userId: UserId;
  workspaceId?: WorkspaceId;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  workspaceScoped: boolean;
  priority: number;
}

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  scope: 'system' | 'workspace' | 'project' | 'task';
}

export class RoleAssignedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly roleId: RoleId,
    public readonly workspaceId: WorkspaceId | undefined,
    public readonly assignedBy: UserId
  ) {
    super('RoleAssigned', {
      userId: userId.value,
      roleId: roleId.value,
      workspaceId: workspaceId?.value,
      assignedBy: assignedBy.value,
    });
  }
}

export class RoleRevokedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly roleId: RoleId,
    public readonly workspaceId: WorkspaceId | undefined,
    public readonly revokedBy: UserId
  ) {
    super('RoleRevoked', {
      userId: userId.value,
      roleId: roleId.value,
      workspaceId: workspaceId?.value,
      revokedBy: revokedBy.value,
    });
  }
}

export class PermissionDeniedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly permission: string,
    public readonly resource: string | undefined,
    public readonly workspaceId: WorkspaceId | undefined,
    public readonly context: AccessControlContext
  ) {
    super('PermissionDenied', {
      userId: userId.value,
      permission,
      resource,
      workspaceId: workspaceId?.value,
      context: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestPath: context.requestPath,
        requestMethod: context.requestMethod,
      },
    });
  }
}

/**
 * Role-Based Access Control Service
 * Manages roles, permissions, and access control decisions
 */
export class RoleBasedAccessControlService {
  private readonly systemRoles: Map<string, RoleDefinition> = new Map();
  private readonly permissions: Map<string, PermissionDefinition> = new Map();

  constructor(
    private readonly userRepository: any,
    private readonly roleRepository: any,
    private readonly permissionRepository: any,
    private readonly roleAssignmentRepository: any,
    private readonly workspaceRepository: any,
    private readonly eventBus: any
  ) {
    this.initializeSystemRoles();
    this.initializePermissions();
  }

  /**
   * Check if user has permission
   */
  async checkPermission(
    context: AccessControlContext,
    permissionCheck: PermissionCheck
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(context.userId);
      if (!user) {
        return false;
      }

      // System admin has all permissions
      if (await this.isSystemAdmin(context.userId)) {
        return true;
      }

      // Get user's roles in the specified context
      const roles = await this.getUserRoles(
        context.userId,
        permissionCheck.workspaceId
      );

      // Check if any role grants the permission
      for (const role of roles) {
        if (await this.roleHasPermission(role, permissionCheck)) {
          return true;
        }
      }

      // Log permission denial
      await this.eventBus.publish(
        new PermissionDeniedEvent(
          context.userId,
          permissionCheck.permission,
          permissionCheck.resource,
          permissionCheck.workspaceId,
          context
        )
      );

      return false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * Check multiple permissions at once
   */
  async checkPermissions(
    context: AccessControlContext,
    permissionChecks: PermissionCheck[]
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const check of permissionChecks) {
      const key = this.getPermissionKey(check);
      results[key] = await this.checkPermission(context, check);
    }

    return results;
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(
    userId: UserId,
    workspaceId?: WorkspaceId
  ): Promise<string[]> {
    try {
      // System admin has all permissions
      if (await this.isSystemAdmin(userId)) {
        return Array.from(this.permissions.keys());
      }

      const roles = await this.getUserRoles(userId, workspaceId);
      const permissions = new Set<string>();

      for (const role of roles) {
        const rolePermissions = await this.getRolePermissions(role.id);
        rolePermissions.forEach(permission => permissions.add(permission));
      }

      return Array.from(permissions);
    } catch (error) {
      console.error('Get user permissions failed:', error);
      return [];
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: UserId,
    roleId: RoleId,
    assignedBy: UserId,
    options: {
      workspaceId?: WorkspaceId;
      expiresAt?: Date;
    } = {}
  ): Promise<RoleAssignment> {
    try {
      // Validate user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Validate workspace if specified
      if (options.workspaceId) {
        const workspace = await this.workspaceRepository.findById(
          options.workspaceId
        );
        if (!workspace) {
          throw new Error('Workspace not found');
        }

        // Check if role is workspace-scoped
        if (!role.workspaceScoped) {
          throw new Error('Cannot assign system role to workspace');
        }
      } else if (role.workspaceScoped) {
        throw new Error('Workspace-scoped role requires workspace context');
      }

      // Check if assignment already exists
      const existingAssignment =
        await this.roleAssignmentRepository.findByUserAndRole(
          userId,
          roleId,
          options.workspaceId
        );

      if (existingAssignment && existingAssignment.isActive) {
        throw new Error('Role already assigned to user');
      }

      // Create role assignment
      const assignment: RoleAssignment = {
        userId,
        roleId,
        workspaceId: options.workspaceId,
        assignedBy,
        assignedAt: new Date(),
        expiresAt: options.expiresAt,
        isActive: true,
      };

      await this.roleAssignmentRepository.save(assignment);

      // Publish event
      await this.eventBus.publish(
        new RoleAssignedEvent(userId, roleId, options.workspaceId, assignedBy)
      );

      return assignment;
    } catch (error) {
      throw new Error(`Role assignment failed: ${error.message}`);
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(
    userId: UserId,
    roleId: RoleId,
    revokedBy: UserId,
    workspaceId?: WorkspaceId
  ): Promise<void> {
    try {
      const assignment = await this.roleAssignmentRepository.findByUserAndRole(
        userId,
        roleId,
        workspaceId
      );

      if (!assignment || !assignment.isActive) {
        throw new Error('Role assignment not found');
      }

      // Deactivate assignment
      assignment.isActive = false;
      await this.roleAssignmentRepository.save(assignment);

      // Publish event
      await this.eventBus.publish(
        new RoleRevokedEvent(userId, roleId, workspaceId, revokedBy)
      );
    } catch (error) {
      throw new Error(`Role revocation failed: ${error.message}`);
    }
  }

  /**
   * Get user's roles
   */
  async getUserRoles(
    userId: UserId,
    workspaceId?: WorkspaceId
  ): Promise<Role[]> {
    try {
      const assignments = await this.roleAssignmentRepository.findByUser(
        userId,
        workspaceId
      );

      const activeAssignments = assignments.filter(
        (assignment: RoleAssignment) =>
          assignment.isActive &&
          (!assignment.expiresAt || assignment.expiresAt > new Date())
      );

      const roleIds = activeAssignments.map(
        (assignment: RoleAssignment) => assignment.roleId
      );

      return await this.roleRepository.findByIds(roleIds);
    } catch (error) {
      console.error('Get user roles failed:', error);
      return [];
    }
  }

  /**
   * Create custom role
   */
  async createRole(
    roleDefinition: Omit<RoleDefinition, 'id'>,
    createdBy: UserId
  ): Promise<Role> {
    try {
      // Validate permissions exist
      for (const permission of roleDefinition.permissions) {
        if (!this.permissions.has(permission)) {
          throw new Error(`Permission '${permission}' does not exist`);
        }
      }

      const role = Role.create({
        name: roleDefinition.name,
        description: roleDefinition.description,
        permissions: roleDefinition.permissions,
        isSystemRole: false,
        workspaceScoped: roleDefinition.workspaceScoped,
        priority: roleDefinition.priority,
        createdBy,
      });

      await this.roleRepository.save(role);
      return role;
    } catch (error) {
      throw new Error(`Role creation failed: ${error.message}`);
    }
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(
    roleId: RoleId,
    permissions: string[],
    updatedBy: UserId
  ): Promise<void> {
    try {
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.isSystemRole) {
        throw new Error('Cannot modify system role');
      }

      // Validate permissions exist
      for (const permission of permissions) {
        if (!this.permissions.has(permission)) {
          throw new Error(`Permission '${permission}' does not exist`);
        }
      }

      role.updatePermissions(permissions, updatedBy);
      await this.roleRepository.save(role);
    } catch (error) {
      throw new Error(`Role update failed: ${error.message}`);
    }
  }

  /**
   * Get workspace members with roles
   */
  async getWorkspaceMembers(workspaceId: WorkspaceId): Promise<
    Array<{
      user: User;
      roles: Role[];
      permissions: string[];
    }>
  > {
    try {
      const assignments =
        await this.roleAssignmentRepository.findByWorkspace(workspaceId);

      const userRoleMap = new Map<string, RoleAssignment[]>();
      assignments.forEach((assignment: RoleAssignment) => {
        const userId = assignment.userId.value;
        if (!userRoleMap.has(userId)) {
          userRoleMap.set(userId, []);
        }
        userRoleMap.get(userId)!.push(assignment);
      });

      const members = [];
      for (const [userId, userAssignments] of userRoleMap) {
        const user = await this.userRepository.findById(UserId.create(userId));
        if (!user) continue;

        const roleIds = userAssignments.map(assignment => assignment.roleId);
        const roles = await this.roleRepository.findByIds(roleIds);
        const permissions = await this.getUserPermissions(user.id, workspaceId);

        members.push({
          user,
          roles,
          permissions,
        });
      }

      return members;
    } catch (error) {
      console.error('Get workspace members failed:', error);
      return [];
    }
  }

  /**
   * Check if user is system admin
   */
  async isSystemAdmin(userId: UserId): Promise<boolean> {
    try {
      const roles = await this.getUserRoles(userId);
      return roles.some(role => role.name === 'system_admin');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user is workspace admin
   */
  async isWorkspaceAdmin(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    try {
      const roles = await this.getUserRoles(userId, workspaceId);
      return roles.some(role => role.name === 'workspace_admin');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available roles for assignment
   */
  async getAvailableRoles(
    workspaceScoped: boolean = false
  ): Promise<RoleDefinition[]> {
    const roles = Array.from(this.systemRoles.values());
    return roles.filter(role => role.workspaceScoped === workspaceScoped);
  }

  /**
   * Get permission definitions
   */
  getPermissionDefinitions(): PermissionDefinition[] {
    return Array.from(this.permissions.values());
  }

  // Private helper methods

  private async roleHasPermission(
    role: Role,
    permissionCheck: PermissionCheck
  ): Promise<boolean> {
    const rolePermissions = await this.getRolePermissions(role.id);

    // Check exact permission match
    if (rolePermissions.includes(permissionCheck.permission)) {
      return true;
    }

    // Check wildcard permissions
    const permissionParts = permissionCheck.permission.split(':');
    if (permissionParts.length >= 2) {
      const wildcardPermission = `${permissionParts[0]}:*`;
      if (rolePermissions.includes(wildcardPermission)) {
        return true;
      }
    }

    return false;
  }

  private async getRolePermissions(roleId: RoleId): Promise<string[]> {
    try {
      const role = await this.roleRepository.findById(roleId);
      return role ? role.permissions : [];
    } catch (error) {
      return [];
    }
  }

  private getPermissionKey(check: PermissionCheck): string {
    let key = check.permission;
    if (check.resource) {
      key += `:${check.resource}`;
    }
    if (check.resourceId) {
      key += `:${check.resourceId}`;
    }
    return key;
  }

  private initializeSystemRoles(): void {
    const systemRoles: RoleDefinition[] = [
      {
        id: 'system_admin',
        name: 'System Administrator',
        description: 'Full system access',
        permissions: ['*'],
        isSystemRole: true,
        workspaceScoped: false,
        priority: 1000,
      },
      {
        id: 'workspace_admin',
        name: 'Workspace Administrator',
        description: 'Full workspace access',
        permissions: [
          'workspace:*',
          'project:*',
          'task:*',
          'user:read',
          'user:invite',
        ],
        isSystemRole: true,
        workspaceScoped: true,
        priority: 900,
      },
      {
        id: 'project_manager',
        name: 'Project Manager',
        description: 'Manage projects and tasks',
        permissions: [
          'project:read',
          'project:write',
          'project:delete',
          'task:*',
          'user:read',
        ],
        isSystemRole: true,
        workspaceScoped: true,
        priority: 800,
      },
      {
        id: 'team_lead',
        name: 'Team Lead',
        description: 'Lead team members and manage tasks',
        permissions: ['project:read', 'task:*', 'user:read', 'comment:*'],
        isSystemRole: true,
        workspaceScoped: true,
        priority: 700,
      },
      {
        id: 'member',
        name: 'Member',
        description: 'Basic workspace member',
        permissions: [
          'project:read',
          'task:read',
          'task:write',
          'task:assign_self',
          'comment:read',
          'comment:write',
          'comment:delete_own',
        ],
        isSystemRole: true,
        workspaceScoped: true,
        priority: 600,
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['project:read', 'task:read', 'comment:read'],
        isSystemRole: true,
        workspaceScoped: true,
        priority: 500,
      },
    ];

    systemRoles.forEach(role => {
      this.systemRoles.set(role.id, role);
    });
  }

  private initializePermissions(): void {
    const permissions: PermissionDefinition[] = [
      // System permissions
      {
        id: 'system:admin',
        name: 'System Administration',
        description: 'Full system access',
        resource: 'system',
        action: 'admin',
        scope: 'system',
      },
      {
        id: 'system:read',
        name: 'System Read',
        description: 'Read system information',
        resource: 'system',
        action: 'read',
        scope: 'system',
      },

      // User permissions
      {
        id: 'user:read',
        name: 'Read Users',
        description: 'View user information',
        resource: 'user',
        action: 'read',
        scope: 'workspace',
      },
      {
        id: 'user:write',
        name: 'Write Users',
        description: 'Modify user information',
        resource: 'user',
        action: 'write',
        scope: 'workspace',
      },
      {
        id: 'user:delete',
        name: 'Delete Users',
        description: 'Delete users',
        resource: 'user',
        action: 'delete',
        scope: 'workspace',
      },
      {
        id: 'user:invite',
        name: 'Invite Users',
        description: 'Invite new users',
        resource: 'user',
        action: 'invite',
        scope: 'workspace',
      },

      // Workspace permissions
      {
        id: 'workspace:read',
        name: 'Read Workspace',
        description: 'View workspace information',
        resource: 'workspace',
        action: 'read',
        scope: 'workspace',
      },
      {
        id: 'workspace:write',
        name: 'Write Workspace',
        description: 'Modify workspace settings',
        resource: 'workspace',
        action: 'write',
        scope: 'workspace',
      },
      {
        id: 'workspace:delete',
        name: 'Delete Workspace',
        description: 'Delete workspace',
        resource: 'workspace',
        action: 'delete',
        scope: 'workspace',
      },
      {
        id: 'workspace:manage_members',
        name: 'Manage Members',
        description: 'Add/remove workspace members',
        resource: 'workspace',
        action: 'manage_members',
        scope: 'workspace',
      },
      {
        id: 'workspace:manage_roles',
        name: 'Manage Roles',
        description: 'Assign/revoke roles',
        resource: 'workspace',
        action: 'manage_roles',
        scope: 'workspace',
      },

      // Project permissions
      {
        id: 'project:read',
        name: 'Read Projects',
        description: 'View projects',
        resource: 'project',
        action: 'read',
        scope: 'project',
      },
      {
        id: 'project:write',
        name: 'Write Projects',
        description: 'Create/modify projects',
        resource: 'project',
        action: 'write',
        scope: 'project',
      },
      {
        id: 'project:delete',
        name: 'Delete Projects',
        description: 'Delete projects',
        resource: 'project',
        action: 'delete',
        scope: 'project',
      },
      {
        id: 'project:manage_members',
        name: 'Manage Project Members',
        description: 'Add/remove project members',
        resource: 'project',
        action: 'manage_members',
        scope: 'project',
      },

      // Task permissions
      {
        id: 'task:read',
        name: 'Read Tasks',
        description: 'View tasks',
        resource: 'task',
        action: 'read',
        scope: 'task',
      },
      {
        id: 'task:write',
        name: 'Write Tasks',
        description: 'Create/modify tasks',
        resource: 'task',
        action: 'write',
        scope: 'task',
      },
      {
        id: 'task:delete',
        name: 'Delete Tasks',
        description: 'Delete tasks',
        resource: 'task',
        action: 'delete',
        scope: 'task',
      },
      {
        id: 'task:assign',
        name: 'Assign Tasks',
        description: 'Assign tasks to users',
        resource: 'task',
        action: 'assign',
        scope: 'task',
      },
      {
        id: 'task:assign_self',
        name: 'Self-Assign Tasks',
        description: 'Assign tasks to self',
        resource: 'task',
        action: 'assign_self',
        scope: 'task',
      },

      // Comment permissions
      {
        id: 'comment:read',
        name: 'Read Comments',
        description: 'View comments',
        resource: 'comment',
        action: 'read',
        scope: 'task',
      },
      {
        id: 'comment:write',
        name: 'Write Comments',
        description: 'Create comments',
        resource: 'comment',
        action: 'write',
        scope: 'task',
      },
      {
        id: 'comment:delete',
        name: 'Delete Comments',
        description: 'Delete any comments',
        resource: 'comment',
        action: 'delete',
        scope: 'task',
      },
      {
        id: 'comment:delete_own',
        name: 'Delete Own Comments',
        description: 'Delete own comments',
        resource: 'comment',
        action: 'delete_own',
        scope: 'task',
      },
    ];

    permissions.forEach(permission => {
      this.permissions.set(permission.id, permission);
    });
  }
}
