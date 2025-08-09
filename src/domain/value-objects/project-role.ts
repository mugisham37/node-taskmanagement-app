import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import {
  ProjectRole,
  PROJECT_ROLE_PERMISSIONS,
} from '../../shared/constants/project-constants';

/**
 * Project Role value object
 * Represents a user's role within a project with permission checking
 */
export class ProjectRoleVO extends ValueObject<ProjectRole> {
  protected validate(value: ProjectRole): void {
    if (!value) {
      throw new ValidationError('Project role cannot be empty');
    }

    if (!Object.values(ProjectRole).includes(value)) {
      throw new ValidationError(
        `Invalid project role. Must be one of: ${Object.values(ProjectRole).join(', ')}`
      );
    }
  }

  /**
   * Create a new ProjectRoleVO from a ProjectRole enum
   */
  static create(role: ProjectRole): ProjectRoleVO {
    return new ProjectRoleVO(role);
  }

  /**
   * Create a ProjectRoleVO from a string
   */
  static fromString(role: string): ProjectRoleVO {
    const upperRole = role.toUpperCase() as ProjectRole;
    return new ProjectRoleVO(upperRole);
  }

  /**
   * Check if this role has a specific permission
   */
  hasPermission(permission: string): boolean {
    const permissions = PROJECT_ROLE_PERMISSIONS[this._value];
    return permissions.includes(permission as any);
  }

  /**
   * Get all permissions for this role
   */
  getPermissions(): readonly string[] {
    return PROJECT_ROLE_PERMISSIONS[this._value];
  }

  /**
   * Check if this role is owner
   */
  isOwner(): boolean {
    return this._value === ProjectRole.OWNER;
  }

  /**
   * Check if this role is manager
   */
  isManager(): boolean {
    return this._value === ProjectRole.MANAGER;
  }

  /**
   * Check if this role is member
   */
  isMember(): boolean {
    return this._value === ProjectRole.MEMBER;
  }

  /**
   * Check if this role is viewer
   */
  isViewer(): boolean {
    return this._value === ProjectRole.VIEWER;
  }

  /**
   * Check if this role can manage members (owner or manager)
   */
  canManageMembers(): boolean {
    return this.hasPermission('MANAGE_MEMBERS');
  }

  /**
   * Check if this role can create tasks
   */
  canCreateTasks(): boolean {
    return this.hasPermission('CREATE_TASK');
  }

  /**
   * Check if this role can update tasks
   */
  canUpdateTasks(): boolean {
    return this.hasPermission('UPDATE_TASK');
  }

  /**
   * Check if this role can delete tasks
   */
  canDeleteTasks(): boolean {
    return this.hasPermission('DELETE_TASK');
  }

  /**
   * Check if this role can assign tasks
   */
  canAssignTasks(): boolean {
    return this.hasPermission('ASSIGN_TASK');
  }

  /**
   * Check if this role can update the project
   */
  canUpdateProject(): boolean {
    return this.hasPermission('UPDATE_PROJECT');
  }

  /**
   * Check if this role can delete the project
   */
  canDeleteProject(): boolean {
    return this.hasPermission('DELETE_PROJECT');
  }

  /**
   * Check if this role has higher privileges than another role
   */
  hasHigherPrivilegesThan(other: ProjectRoleVO): boolean {
    const roleHierarchy = {
      [ProjectRole.VIEWER]: 1,
      [ProjectRole.MEMBER]: 2,
      [ProjectRole.MANAGER]: 3,
      [ProjectRole.OWNER]: 4,
    };

    return roleHierarchy[this._value] > roleHierarchy[other._value];
  }

  /**
   * Check if this role has equal or higher privileges than another role
   */
  hasEqualOrHigherPrivilegesThan(other: ProjectRoleVO): boolean {
    const roleHierarchy = {
      [ProjectRole.VIEWER]: 1,
      [ProjectRole.MEMBER]: 2,
      [ProjectRole.MANAGER]: 3,
      [ProjectRole.OWNER]: 4,
    };

    return roleHierarchy[this._value] >= roleHierarchy[other._value];
  }

  /**
   * Get a human-readable description of the role
   */
  getDescription(): string {
    switch (this._value) {
      case ProjectRole.OWNER:
        return 'Project Owner';
      case ProjectRole.MANAGER:
        return 'Project Manager';
      case ProjectRole.MEMBER:
        return 'Project Member';
      case ProjectRole.VIEWER:
        return 'Project Viewer';
      default:
        return this._value;
    }
  }
}
