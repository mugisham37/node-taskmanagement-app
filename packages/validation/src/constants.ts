/**
 * Validation constants extracted from the API
 */

/**
 * Task validation constants
 */
export const TASK_VALIDATION = {
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 5000,
  MIN_ESTIMATED_HOURS: 0.25, // 15 minutes
  MAX_ESTIMATED_HOURS: 999,
  MIN_ACTUAL_HOURS: 0,
  MAX_ACTUAL_HOURS: 999,
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
 * Workspace validation constants
 */
export const WORKSPACE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
} as const;

/**
 * Validation error codes
 */
export const VALIDATION_ERROR_CODES = {
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  VALUE_TOO_SHORT: 'VALUE_TOO_SHORT',
  VALUE_TOO_LONG: 'VALUE_TOO_LONG',
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_URL: 'INVALID_URL',
  INVALID_UUID: 'INVALID_UUID',
  INVALID_DATE: 'INVALID_DATE',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
} as const;

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

/**
 * All validation constants combined for easy access
 */
export const ALL_VALIDATION_CONSTANTS = {
  TASK: TASK_VALIDATION,
  PROJECT: PROJECT_VALIDATION,
  USER: USER_VALIDATION,
  WORKSPACE: WORKSPACE_VALIDATION,
} as const;