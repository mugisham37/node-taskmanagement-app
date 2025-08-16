/**
 * Workspace-related constants and enums
 */

import { Status, UserRole } from '../enums/common.enums';

// Re-export enums for convenience
export const WorkspaceStatus = Status;
export const WorkspaceRole = UserRole;

/**
 * Workspace status transitions
 */
export const WORKSPACE_STATUS_TRANSITIONS: Record<Status, Status[]> = {
  [WorkspaceStatus.ACTIVE]: [
    WorkspaceStatus.INACTIVE,
    WorkspaceStatus.SUSPENDED,
  ],
  [WorkspaceStatus.INACTIVE]: [WorkspaceStatus.ACTIVE],
  [WorkspaceStatus.SUSPENDED]: [
    WorkspaceStatus.ACTIVE,
    WorkspaceStatus.INACTIVE,
  ],
  [WorkspaceStatus.PENDING]: [WorkspaceStatus.ACTIVE],
  [WorkspaceStatus.PENDING_VERIFICATION]: [
    WorkspaceStatus.ACTIVE,
    WorkspaceStatus.INACTIVE,
  ],
  [WorkspaceStatus.DELETED]: [],
};

/**
 * Workspace role permissions
 */
export const WORKSPACE_ROLE_PERMISSIONS = {
  [WorkspaceRole.OWNER]: [
    'MANAGE_WORKSPACE',
    'DELETE_WORKSPACE',
    'MANAGE_MEMBERS',
    'CREATE_PROJECT',
    'MANAGE_ALL_PROJECTS',
    'VIEW_ANALYTICS',
    'MANAGE_BILLING',
  ],
  [WorkspaceRole.ADMIN]: [
    'MANAGE_WORKSPACE',
    'MANAGE_MEMBERS',
    'CREATE_PROJECT',
    'MANAGE_ALL_PROJECTS',
    'VIEW_ANALYTICS',
  ],
  [WorkspaceRole.MEMBER]: [
    'CREATE_PROJECT',
    'MANAGE_OWN_PROJECTS',
    'VIEW_WORKSPACE',
  ],
  [WorkspaceRole.GUEST]: ['VIEW_WORKSPACE', 'VIEW_ASSIGNED_PROJECTS'],
} as const;

/**
 * Workspace validation constants
 */


/**
 * Workspace business rules
 */
export const WORKSPACE_BUSINESS_RULES = {
  MAX_MEMBERS_PER_WORKSPACE: 500,
  MAX_PROJECTS_PER_WORKSPACE: 50,
  MIN_OWNERS_PER_WORKSPACE: 1,
  MAX_OWNERS_PER_WORKSPACE: 5,
} as const;

