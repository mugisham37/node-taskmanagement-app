/**
 * Workspace-related constants and enums
 */

export enum WorkspaceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

/**
 * Workspace status transitions
 */
export const WORKSPACE_STATUS_TRANSITIONS: Record<
  WorkspaceStatus,
  WorkspaceStatus[]
> = {
  [WorkspaceStatus.ACTIVE]: [
    WorkspaceStatus.INACTIVE,
    WorkspaceStatus.SUSPENDED,
  ],
  [WorkspaceStatus.INACTIVE]: [WorkspaceStatus.ACTIVE],
  [WorkspaceStatus.SUSPENDED]: [
    WorkspaceStatus.ACTIVE,
    WorkspaceStatus.INACTIVE,
  ],
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
export const WORKSPACE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
} as const;

/**
 * Workspace business rules
 */
export const WORKSPACE_BUSINESS_RULES = {
  MAX_MEMBERS_PER_WORKSPACE: 500,
  MAX_PROJECTS_PER_WORKSPACE: 50,
  MIN_OWNERS_PER_WORKSPACE: 1,
  MAX_OWNERS_PER_WORKSPACE: 5,
} as const;
