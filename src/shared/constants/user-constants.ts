/**
 * User-related constants and enums
 */

import { Status, UserRole } from '../enums/common.enums';

// Re-export enums for convenience
export const UserStatus = Status;
export { UserRole };

/**
 * User validation constants
 */
export const USER_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  EMAIL_MAX_LENGTH: 255,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
} as const;

/**
 * User business rules
 */
export const USER_BUSINESS_RULES = {
  MAX_WORKSPACES_PER_USER: 10,
  MAX_PROJECTS_PER_USER: 100,
  MAX_TASKS_PER_USER: 500,
  SESSION_TIMEOUT_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS: 1,
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
} as const;

/**
 * User status transitions
 */
export const USER_STATUS_TRANSITIONS: Record<Status, Status[]> = {
  [UserStatus.PENDING_VERIFICATION]: [UserStatus.ACTIVE, UserStatus.INACTIVE],
  [UserStatus.ACTIVE]: [UserStatus.INACTIVE, UserStatus.SUSPENDED],
  [UserStatus.INACTIVE]: [UserStatus.ACTIVE],
  [UserStatus.SUSPENDED]: [UserStatus.ACTIVE, UserStatus.INACTIVE],
  [UserStatus.PENDING]: [UserStatus.ACTIVE, UserStatus.INACTIVE],
  [UserStatus.DELETED]: [],
};

/**
 * User role permissions
 */
export const USER_ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: [
    'MANAGE_USERS',
    'MANAGE_WORKSPACES',
    'MANAGE_PROJECTS',
    'MANAGE_TASKS',
    'VIEW_ANALYTICS',
    'MANAGE_SYSTEM_SETTINGS',
  ],
  [UserRole.USER]: [
    'CREATE_WORKSPACE',
    'MANAGE_OWN_WORKSPACES',
    'MANAGE_OWN_PROJECTS',
    'MANAGE_OWN_TASKS',
    'VIEW_OWN_ANALYTICS',
  ],
} as const;
