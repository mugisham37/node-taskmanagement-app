// Task constants
export {
  TASK_BUSINESS_RULES,
  TASK_PRIORITY_WEIGHTS,
  TASK_STATUS_TRANSITIONS,
  TaskPriority,
  TaskStatus,
} from './task-constants';

// Project constants
export {
  PROJECT_BUSINESS_RULES,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_STATUS_TRANSITIONS,
  ProjectRole,
  ProjectStatus,
} from './project-constants';

// User constants
export {
  USER_BUSINESS_RULES,
  USER_ROLE_PERMISSIONS,
  USER_STATUS_TRANSITIONS,
  UserRole,
  UserStatus,
} from './user-constants';

// Workspace constants
export {
  WORKSPACE_BUSINESS_RULES,
  WORKSPACE_ROLE_PERMISSIONS,
  WORKSPACE_STATUS_TRANSITIONS,
  WorkspaceRole,
  WorkspaceStatus,
} from './workspace-constants';

// Re-export validation constants from validation package
export {
  ERROR_SEVERITY,
  PROJECT_VALIDATION,
  TASK_VALIDATION,
  USER_VALIDATION,
  VALIDATION_ERROR_CODES,
  WORKSPACE_VALIDATION,
} from '@taskmanagement/validation';

// Application constants
export {
  CACHE_TTL,
  EMAIL_TEMPLATES,
  ENVIRONMENTS,
  FILE_UPLOAD,
  HTTP_STATUS,
  JWT,
  JWT_EXPIRATION,
  NOTIFICATION_TYPES,
  PAGINATION,
  RATE_LIMIT,
  RATE_LIMITS,
  WEBSOCKET_EVENTS,
} from './application-constants';

// Error constants
export {
  ALL_ERROR_CODES,
  APPLICATION_ERROR_CODES,
  AUTH_ERROR_CODES,
  BUSINESS_ERROR_CODES,
  DOMAIN_ERROR_CODES,
  ERROR_CATEGORIES,
  HTTP_ERROR_CODES,
  INFRASTRUCTURE_ERROR_CODES,
  INTEGRATION_ERROR_CODES,
  PERFORMANCE_ERROR_CODES,
  SECURITY_ERROR_CODES,
  SYSTEM_ERROR_CODES,
} from './error-constants';
