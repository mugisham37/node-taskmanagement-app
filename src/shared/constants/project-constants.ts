/**
 * Project-related constants and enums
 */

import { ProjectStatus, UserRole } from '../enums/common.enums';

// Re-export enums for convenience
export { ProjectStatus };
export const ProjectRole = UserRole;

/**
 * Project status transitions
 */
export const PROJECT_STATUS_TRANSITIONS: Record<
  ProjectStatus,
  ProjectStatus[]
> = {
  [ProjectStatus.PLANNING]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.ACTIVE]: [
    ProjectStatus.ON_HOLD,
    ProjectStatus.COMPLETED,
    ProjectStatus.CANCELLED,
  ],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.CANCELLED]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [], // Archived projects cannot transition
};

/**
 * Project role permissions
 */
export const PROJECT_ROLE_PERMISSIONS = {
  [ProjectRole.OWNER]: [
    'CREATE_TASK',
    'UPDATE_TASK',
    'DELETE_TASK',
    'ASSIGN_TASK',
    'MANAGE_MEMBERS',
    'UPDATE_PROJECT',
    'DELETE_PROJECT',
    'ARCHIVE_PROJECT',
  ],
  [ProjectRole.MANAGER]: [
    'CREATE_TASK',
    'UPDATE_TASK',
    'DELETE_TASK',
    'ASSIGN_TASK',
    'MANAGE_MEMBERS',
    'UPDATE_PROJECT',
  ],
  [ProjectRole.MEMBER]: ['CREATE_TASK', 'UPDATE_TASK', 'ASSIGN_TASK'],
  [ProjectRole.VIEWER]: ['VIEW_TASKS', 'VIEW_PROJECT'],
} as const;

/**
 * Project validation constants
 */
export const PROJECT_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 2000,
} as const;

/**
 * Project business rules
 */
export const PROJECT_BUSINESS_RULES = {
  MAX_MEMBERS_PER_PROJECT: 100,
  MAX_PROJECTS_PER_WORKSPACE: 50,
  MIN_MANAGERS_PER_PROJECT: 1,
} as const;
