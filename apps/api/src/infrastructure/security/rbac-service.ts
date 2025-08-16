/**
 * Role-Based Access Control (RBAC) Service
 *
 * Handles role and permission management with hierarchical roles,
 * resource-level permissions, and workspace-level tenant isolation
 */

import { ValidationError } from '@taskmanagement/validation';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';
import { CacheService } from '../caching/cache-service';
import { LoggingService } from '../monitoring/logging-service';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  parentRoles: string[];
  isSystemRole: boolean;
  workspaceId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
  isSystemPermission: boolean;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
}

export interface UserRole {
  userId: string;
  roleId: string;
  workspaceId?: string | undefined;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date | undefined;
  isActive: boolean;
}

export interface ResourcePermission {
  userId: string;
  resource: string;
  resourceId: string;
  permissions: string[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date | undefined;
  isActive: boolean;
}

export interface AccessContext {
  userId: string;
  workspaceId?: string;
  resource: string;
  resourceId?: string;
  action: string;
  metadata?: Record<string, any>;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  matchedPermissions: string[];
  effectiveRoles: string[];
  conditions?: PermissionCondition[];
}

export interface RoleHierarchy {
  roleId: string;
  parentRoles: string[];
  childRoles: string[];
  allAncestors: string[];
  allDescendants: string[];
  level: number;
}

export class RBACService {
  private readonly systemRoles = new Map<string, Role>();
  private readonly systemPermissions = new Map<string, Permission>();
  private roleHierarchyCache = new Map<string, RoleHierarchy>();

  constructor(
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService
  ) {
    this.initializeSystemRoles();
    this.initializeSystemPermissions();
  }

  /**
   * Check if user has permission to perform action on resource
   */
  async checkAccess(context: AccessContext): Promise<AccessResult> {
    try {
      const userRoles = await this.getUserRoles(context.userId, context.workspaceId);
      const effectiveRoles = await this.getEffectiveRoles(userRoles);
      const userPermissions = await this.getUserPermissions(context.userId, effectiveRoles);

      // Check direct resource permissions first
      const resourcePermissions = await this.getResourcePermissions(
        context.userId,
        context.resource,
        context.resourceId
      );

      const allPermissions = [...userPermissions, ...resourcePermissions];
      const matchedPermissions: string[] = [];

      // Check permissions
      for (const permission of allPermissions) {
        if (this.matchesPermission(permission, context)) {
          matchedPermissions.push(permission);
        }
      }

      // Check for wildcard permissions
      const wildcardPermissions = allPermissions.filter(
        (p) => p === '*:*' || p === `${context.resource}:*` || p === `*:${context.action}`
      );

      const allowed = matchedPermissions.length > 0 || wildcardPermissions.length > 0;

      if (!allowed) {
        this.logger.warn('Access denied', {
          userId: context.userId,
          resource: context.resource,
          action: context.action,
          workspaceId: context.workspaceId,
          effectiveRoles,
          userPermissions: userPermissions.length,
        });
      }

      return {
        allowed,
        reason: allowed ? 'Access granted' : 'Insufficient permissions',
        matchedPermissions: [...matchedPermissions, ...wildcardPermissions],
        effectiveRoles,
      };
    } catch (error) {
      this.logger.error('Failed to check access', error as Error, {
        userId: context.userId,
        resource: context.resource,
        action: context.action,
      });

      return {
        allowed: false,
        reason: 'Access check failed',
        matchedPermissions: [],
        effectiveRoles: [],
      };
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    workspaceId?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      // Validate role exists
      const role = await this.getRole(roleId, workspaceId);
      if (!role) {
        throw new ValidationError([
          {
            field: 'roleId',
            message: `Role ${roleId} not found`,
            value: roleId,
          },
        ]);
      }

      // Check if assignment already exists
      const existingAssignment = await this.getUserRoleAssignment(userId, roleId, workspaceId);

      if (existingAssignment && existingAssignment.isActive) {
        throw new ValidationError([
          {
            field: 'roleAssignment',
            message: 'Role already assigned to user',
            value: { userId, roleId, workspaceId },
          },
        ]);
      }

      const userRole: UserRole = {
        userId,
        roleId,
        workspaceId,
        assignedBy,
        assignedAt: new Date(),
        expiresAt,
        isActive: true,
      };

      await this.storeUserRole(userRole);
      await this.invalidateUserCache(userId);

      this.logger.info('Role assigned to user', {
        userId,
        roleId,
        assignedBy,
        workspaceId,
        expiresAt,
      });
    } catch (error) {
      this.logger.error('Failed to assign role', error as Error, {
        userId,
        roleId,
        assignedBy,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to assign role: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(
    userId: string,
    roleId: string,
    revokedBy: string,
    workspaceId?: string
  ): Promise<void> {
    try {
      const userRole = await this.getUserRoleAssignment(userId, roleId, workspaceId);

      if (!userRole || !userRole.isActive) {
        throw new ValidationError([
          {
            field: 'roleAssignment',
            message: 'Role assignment not found or already inactive',
            value: { userId, roleId, workspaceId },
          },
        ]);
      }

      userRole.isActive = false;
      await this.storeUserRole(userRole);
      await this.invalidateUserCache(userId);

      this.logger.info('Role revoked from user', {
        userId,
        roleId,
        revokedBy,
        workspaceId,
      });
    } catch (error) {
      this.logger.error('Failed to revoke role', error as Error, {
        userId,
        roleId,
        revokedBy,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to revoke role: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Grant resource-specific permission to user
   */
  async grantResourcePermission(
    userId: string,
    resource: string,
    resourceId: string,
    permissions: string[],
    grantedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const resourcePermission: ResourcePermission = {
        userId,
        resource,
        resourceId,
        permissions,
        grantedBy,
        grantedAt: new Date(),
        expiresAt,
        isActive: true,
      };

      await this.storeResourcePermission(resourcePermission);
      await this.invalidateUserCache(userId);

      this.logger.info('Resource permission granted', {
        userId,
        resource,
        resourceId,
        permissions,
        grantedBy,
      });
    } catch (error) {
      this.logger.error('Failed to grant resource permission', error as Error, {
        userId,
        resource,
        resourceId,
      });

      throw new InfrastructureError(
        `Failed to grant resource permission: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke resource-specific permission from user
   */
  async revokeResourcePermission(
    userId: string,
    resource: string,
    resourceId: string,
    permissions?: string[]
  ): Promise<void> {
    try {
      const existingPermissions = await this.getResourcePermissions(userId, resource, resourceId);

      if (permissions) {
        // Revoke specific permissions
        const updatedPermissions = existingPermissions.filter((p) => !permissions.includes(p));

        if (updatedPermissions.length > 0) {
          const resourcePermission: ResourcePermission = {
            userId,
            resource,
            resourceId,
            permissions: updatedPermissions,
            grantedBy: 'system',
            grantedAt: new Date(),
            isActive: true,
          };

          await this.storeResourcePermission(resourcePermission);
        } else {
          await this.removeResourcePermission(userId, resource, resourceId);
        }
      } else {
        // Revoke all permissions for the resource
        await this.removeResourcePermission(userId, resource, resourceId);
      }

      await this.invalidateUserCache(userId);

      this.logger.info('Resource permission revoked', {
        userId,
        resource,
        resourceId,
        permissions,
      });
    } catch (error) {
      this.logger.error('Failed to revoke resource permission', error as Error, {
        userId,
        resource,
        resourceId,
      });

      throw new InfrastructureError(
        `Failed to revoke resource permission: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create custom role
   */
  async createRole(
    name: string,
    description: string,
    permissions: string[],
    parentRoles: string[] = [],
    workspaceId?: string
  ): Promise<Role> {
    try {
      // Validate permissions exist
      for (const permission of permissions) {
        if (!this.systemPermissions.has(permission) && !permission.includes(':')) {
          throw new ValidationError([
            {
              field: 'permission',
              message: `Invalid permission: ${permission}`,
              value: permission,
            },
          ]);
        }
      }

      // Validate parent roles exist
      for (const parentRoleId of parentRoles) {
        const parentRole = await this.getRole(parentRoleId, workspaceId);
        if (!parentRole) {
          throw new ValidationError([
            {
              field: 'parentRole',
              message: `Parent role not found: ${parentRoleId}`,
              value: parentRoleId,
            },
          ]);
        }
      }

      const role: Role = {
        id: this.generateRoleId(),
        name,
        description,
        permissions,
        parentRoles,
        isSystemRole: false,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.storeRole(role);
      this.invalidateRoleHierarchyCache();

      this.logger.info('Custom role created', {
        roleId: role.id,
        name,
        workspaceId,
        permissions: permissions.length,
        parentRoles: parentRoles.length,
      });

      return role;
    } catch (error) {
      this.logger.error('Failed to create role', error as Error, {
        name,
        workspaceId,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to create role: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update role
   */
  async updateRole(
    roleId: string,
    updates: Partial<Pick<Role, 'name' | 'description' | 'permissions' | 'parentRoles'>>,
    workspaceId?: string
  ): Promise<void> {
    try {
      const role = await this.getRole(roleId, workspaceId);
      if (!role) {
        throw new ValidationError([
          {
            field: 'roleId',
            message: `Role ${roleId} not found`,
            value: roleId,
          },
        ]);
      }

      if (role.isSystemRole) {
        throw new ValidationError([
          {
            field: 'role',
            message: 'Cannot modify system role',
            value: roleId,
          },
        ]);
      }

      // Validate permissions if provided
      if (updates.permissions) {
        for (const permission of updates.permissions) {
          if (!this.systemPermissions.has(permission) && !permission.includes(':')) {
            throw new ValidationError([
              {
                field: 'permission',
                message: `Invalid permission: ${permission}`,
                value: permission,
              },
            ]);
          }
        }
      }

      // Validate parent roles if provided
      if (updates.parentRoles) {
        for (const parentRoleId of updates.parentRoles) {
          const parentRole = await this.getRole(parentRoleId, workspaceId);
          if (!parentRole) {
            throw new ValidationError([
              {
                field: 'parentRole',
                message: `Parent role not found: ${parentRoleId}`,
                value: parentRoleId,
              },
            ]);
          }
        }
      }

      const updatedRole: Role = {
        ...role,
        ...updates,
        updatedAt: new Date(),
      };

      await this.storeRole(updatedRole);
      this.invalidateRoleHierarchyCache();

      this.logger.info('Role updated', {
        roleId,
        workspaceId,
        updates: Object.keys(updates),
      });
    } catch (error) {
      this.logger.error('Failed to update role', error as Error, {
        roleId,
        workspaceId,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to update role: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string, workspaceId?: string): Promise<void> {
    try {
      const role = await this.getRole(roleId, workspaceId);
      if (!role) {
        throw new ValidationError([
          {
            field: 'roleId',
            message: `Role ${roleId} not found`,
            value: roleId,
          },
        ]);
      }

      if (role.isSystemRole) {
        throw new ValidationError([
          {
            field: 'role',
            message: 'Cannot delete system role',
            value: roleId,
          },
        ]);
      }

      // Check if role is assigned to any users
      const assignments = await this.getRoleAssignments(roleId, workspaceId);
      if (assignments.length > 0) {
        throw new ValidationError([
          {
            field: 'roleAssignments',
            message: `Cannot delete role: ${assignments.length} users still have this role assigned`,
            value: { roleId, assignmentCount: assignments.length },
          },
        ]);
      }

      await this.removeRole(roleId, workspaceId);
      this.invalidateRoleHierarchyCache();

      this.logger.info('Role deleted', {
        roleId,
        workspaceId,
      });
    } catch (error) {
      this.logger.error('Failed to delete role', error as Error, {
        roleId,
        workspaceId,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to delete role: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get user's effective roles (including inherited roles)
   */
  async getEffectiveRoles(userRoles: string[]): Promise<string[]> {
    const effectiveRoles = new Set<string>(userRoles);

    for (const roleId of userRoles) {
      const hierarchy = await this.getRoleHierarchy(roleId);
      hierarchy.allAncestors.forEach((ancestorId) => effectiveRoles.add(ancestorId));
    }

    return Array.from(effectiveRoles);
  }

  /**
   * Get user's permissions from roles
   */
  async getUserPermissions(_userId: string, effectiveRoles: string[]): Promise<string[]> {
    const permissions = new Set<string>();

    for (const roleId of effectiveRoles) {
      const role = await this.getRole(roleId);
      if (role) {
        role.permissions.forEach((permission) => permissions.add(permission));
      }
    }

    return Array.from(permissions);
  }

  // Private helper methods

  private initializeSystemRoles(): void {
    const systemRoles: Role[] = [
      {
        id: 'super-admin',
        name: 'Super Administrator',
        description: 'Full system access',
        permissions: ['*:*'],
        parentRoles: [],
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'workspace-admin',
        name: 'Workspace Administrator',
        description: 'Full workspace access',
        permissions: [
          'workspace:*',
          'project:*',
          'task:*',
          'user:read',
          'user:invite',
          'notification:*',
        ],
        parentRoles: [],
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'project-manager',
        name: 'Project Manager',
        description: 'Manage projects and tasks',
        permissions: [
          'project:read',
          'project:create',
          'project:update',
          'project:delete',
          'task:*',
          'user:read',
          'notification:read',
        ],
        parentRoles: [],
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'team-member',
        name: 'Team Member',
        description: 'Basic team member access',
        permissions: [
          'project:read',
          'task:read',
          'task:create',
          'task:update',
          'notification:read',
          'user:read',
        ],
        parentRoles: [],
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['project:read', 'task:read', 'user:read', 'notification:read'],
        parentRoles: [],
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    systemRoles.forEach((role) => {
      this.systemRoles.set(role.id, role);
    });
  }

  private initializeSystemPermissions(): void {
    const resources = [
      'workspace',
      'project',
      'task',
      'user',
      'notification',
      'webhook',
      'calendar',
    ];
    const actions = ['create', 'read', 'update', 'delete', 'invite', 'manage'];

    resources.forEach((resource) => {
      actions.forEach((action) => {
        const permission: Permission = {
          id: `${resource}:${action}`,
          name: `${resource}:${action}`,
          resource,
          action,
          description: `${action} ${resource}`,
          isSystemPermission: true,
        };
        this.systemPermissions.set(permission.id, permission);
      });

      // Add wildcard permission for resource
      const wildcardPermission: Permission = {
        id: `${resource}:*`,
        name: `${resource}:*`,
        resource,
        action: '*',
        description: `All actions on ${resource}`,
        isSystemPermission: true,
      };
      this.systemPermissions.set(wildcardPermission.id, wildcardPermission);
    });

    // Add global wildcard permission
    const globalWildcard: Permission = {
      id: '*:*',
      name: '*:*',
      resource: '*',
      action: '*',
      description: 'All actions on all resources',
      isSystemPermission: true,
    };
    this.systemPermissions.set(globalWildcard.id, globalWildcard);
  }

  private matchesPermission(permission: string, context: AccessContext): boolean {
    const [resource, action] = permission.split(':');

    return (
      (resource === '*' || resource === context.resource) &&
      (action === '*' || action === context.action)
    );
  }

  private generateRoleId(): string {
    return `role_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private async getUserRoles(_userId: string, _workspaceId?: string): Promise<string[]> {
    // This would typically query the database
    // For now, return empty array as placeholder
    return [];
  }

  private async getRole(roleId: string, _workspaceId?: string): Promise<Role | null> {
    // Check system roles first
    if (this.systemRoles.has(roleId)) {
      return this.systemRoles.get(roleId)!;
    }

    // This would typically query the database for custom roles
    // For now, return null as placeholder
    return null;
  }

  private async getUserRoleAssignment(
    _userId: string,
    _roleId: string,
    _workspaceId?: string
  ): Promise<UserRole | null> {
    // This would typically query the database
    // For now, return null as placeholder
    return null;
  }

  private async getResourcePermissions(
    _userId: string,
    _resource: string,
    _resourceId?: string
  ): Promise<string[]> {
    // This would typically query the database
    // For now, return empty array as placeholder
    return [];
  }

  private async getRoleHierarchy(roleId: string): Promise<RoleHierarchy> {
    if (this.roleHierarchyCache.has(roleId)) {
      return this.roleHierarchyCache.get(roleId)!;
    }

    // Build hierarchy (simplified implementation)
    const hierarchy: RoleHierarchy = {
      roleId,
      parentRoles: [],
      childRoles: [],
      allAncestors: [],
      allDescendants: [],
      level: 0,
    };

    this.roleHierarchyCache.set(roleId, hierarchy);
    return hierarchy;
  }

  private async storeUserRole(userRole: UserRole): Promise<void> {
    // This would typically store in database
    // For now, just log
    this.logger.debug('Storing user role', userRole);
  }

  private async storeResourcePermission(permission: ResourcePermission): Promise<void> {
    // This would typically store in database
    // For now, just log
    this.logger.debug('Storing resource permission', permission);
  }

  private async storeRole(role: Role): Promise<void> {
    // This would typically store in database
    // For now, just log
    this.logger.debug('Storing role', role);
  }

  private async removeRole(roleId: string, workspaceId?: string): Promise<void> {
    // This would typically remove from database
    // For now, just log
    this.logger.debug('Removing role', { roleId, workspaceId });
  }

  private async removeResourcePermission(
    userId: string,
    resource: string,
    resourceId: string
  ): Promise<void> {
    // This would typically remove from database
    // For now, just log
    this.logger.debug('Removing resource permission', {
      userId,
      resource,
      resourceId,
    });
  }

  private async getRoleAssignments(_roleId: string, _workspaceId?: string): Promise<UserRole[]> {
    // This would typically query the database
    // For now, return empty array as placeholder
    return [];
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    const cacheKeys = [
      `user-roles:${userId}`,
      `user-permissions:${userId}`,
      `user-effective-roles:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheService.del(key);
    }
  }

  private invalidateRoleHierarchyCache(): void {
    this.roleHierarchyCache.clear();
  }
}
