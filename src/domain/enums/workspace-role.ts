/**
 * Workspace Role Enumeration
 * Defines the possible roles within a workspace
 */
export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

/**
 * Workspace Role Helper Class
 * Provides utility methods for role checking and validation
 */
export class WorkspaceRoleHelper {
  /**
   * Check if a role string is an admin role
   */
  static isAdmin(role: string): boolean {
    return role === WorkspaceRole.ADMIN;
  }

  /**
   * Check if a role string is an owner role
   */
  static isOwner(role: string): boolean {
    return role === WorkspaceRole.OWNER;
  }

  /**
   * Check if a role string is a member role
   */
  static isMember(role: string): boolean {
    return role === WorkspaceRole.MEMBER;
  }

  /**
   * Check if a role can manage webhooks (owner or admin)
   */
  static canManageWebhooks(role: string): boolean {
    return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
  }

  /**
   * Check if a role is valid
   */
  static isValidRole(role: string): role is WorkspaceRole {
    return Object.values(WorkspaceRole).includes(role as WorkspaceRole);
  }

  /**
   * Get all valid workspace roles
   */
  static getAllRoles(): WorkspaceRole[] {
    return Object.values(WorkspaceRole);
  }
}
