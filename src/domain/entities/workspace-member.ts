import { WorkspaceId, UserId } from '../value-objects';
import { nanoid } from 'nanoid';

/**
 * Workspace Member entity
 * Represents a member's association with a workspace
 */
export class WorkspaceMember {
  public readonly id: string;
  public readonly userId: UserId;
  public readonly workspaceId: WorkspaceId;
  public role: 'OWNER' | 'ADMIN' | 'MEMBER';
  public readonly joinedAt: Date;
  public lastActiveAt: Date | undefined;

  constructor(
    userId: UserId,
    workspaceId: WorkspaceId,
    role: 'OWNER' | 'ADMIN' | 'MEMBER',
    joinedAt?: Date,
    id?: string,
    lastActiveAt?: Date
  ) {
    this.id = id || nanoid();
    this.userId = userId;
    this.workspaceId = workspaceId;
    this.role = role;
    this.joinedAt = joinedAt || new Date();
    this.lastActiveAt = lastActiveAt;
  }

  /**
   * Get permissions based on role
   */
  getPermissions(): string[] {
    switch (this.role) {
      case 'OWNER':
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
          'task:delete',
          'task:assign',
          'settings:update',
        ];
      case 'ADMIN':
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
          'task:delete',
          'task:assign',
        ];
      case 'MEMBER':
        return [
          'workspace:read',
          'project:read',
          'task:create',
          'task:read',
          'task:update',
          'task:delete',
        ];
      default:
        return [];
    }
  }

  /**
   * Update last active timestamp
   */
  updateLastActive(): void {
    this.lastActiveAt = new Date();
  }

  /**
   * Check if member has specific permission
   */
  hasPermission(permission: string): boolean {
    return this.getPermissions().includes(permission);
  }

  /**
   * Update member role
   */
  updateRole(newRole: 'ADMIN' | 'MEMBER'): void {
    if (this.role === 'OWNER') {
      throw new Error('Cannot change owner role');
    }
    this.role = newRole;
  }

  /**
   * Check if member is admin
   */
  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  /**
   * Check if member is owner
   */
  isOwner(): boolean {
    return this.role === 'OWNER';
  }

  /**
   * Check if member is regular member
   */
  isMember(): boolean {
    return this.role === 'MEMBER';
  }

  /**
   * Check if member can manage webhooks
   */
  canManageWebhooks(): boolean {
    return this.role === 'OWNER' || this.role === 'ADMIN';
  }
}
