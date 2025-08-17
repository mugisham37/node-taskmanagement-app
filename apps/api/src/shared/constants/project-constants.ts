/**
 * Project-related constants and enums
 */

import { ProjectStatus, ProjectRole } from '../enums/common.enums';

// Re-export enums for convenience
export { ProjectStatus, ProjectRole };

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
 * Project permission types
 */
export type ProjectPermission = 
  | 'CREATE_TASK'
  | 'UPDATE_TASK' 
  | 'DELETE_TASK'
  | 'ASSIGN_TASK'
  | 'MANAGE_MEMBERS'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'ARCHIVE_PROJECT'
  | 'VIEW_TASKS'
  | 'VIEW_PROJECT';

/**
 * Project role permissions
 */
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, readonly ProjectPermission[]> = {
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


/**
 * Project business rules
 */
export const PROJECT_BUSINESS_RULES = {
  MAX_MEMBERS_PER_PROJECT: 100,
  MAX_PROJECTS_PER_WORKSPACE: 50,
  MIN_MANAGERS_PER_PROJECT: 1,
} as const;


