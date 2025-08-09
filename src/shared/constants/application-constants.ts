/**
 * General application constants
 */

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Pagination constants
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
  DEFAULT_PAGE: 1,
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

/**
 * Rate limiting constants
 */
export const RATE_LIMITS = {
  AUTH_ATTEMPTS_PER_MINUTE: 5,
  API_REQUESTS_PER_MINUTE: 100,
  PASSWORD_RESET_ATTEMPTS_PER_HOUR: 3,
  EMAIL_VERIFICATION_ATTEMPTS_PER_HOUR: 5,
} as const;

/**
 * JWT token constants
 */
export const JWT = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  PASSWORD_RESET_TOKEN_EXPIRY: '1h',
  EMAIL_VERIFICATION_TOKEN_EXPIRY: '24h',
} as const;

/**
 * File upload constants
 */
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
} as const;

/**
 * WebSocket event types
 */
export const WEBSOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Task events
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_ASSIGNED: 'task:assigned',
  TASK_COMPLETED: 'task:completed',
  TASK_DELETED: 'task:deleted',

  // Project events
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_MEMBER_ADDED: 'project:member_added',
  PROJECT_MEMBER_REMOVED: 'project:member_removed',

  // User presence events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_TYPING: 'user:typing',

  // Notification events
  NOTIFICATION_RECEIVED: 'notification:received',
  NOTIFICATION_READ: 'notification:read',
} as const;

/**
 * Email template types
 */
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  PROJECT_INVITATION: 'project_invitation',
  WORKSPACE_INVITATION: 'workspace_invitation',
} as const;

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_OVERDUE: 'task_overdue',
  PROJECT_INVITATION: 'project_invitation',
  WORKSPACE_INVITATION: 'workspace_invitation',
  MENTION: 'mention',
  COMMENT: 'comment',
} as const;

/**
 * Environment types
 */
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;
