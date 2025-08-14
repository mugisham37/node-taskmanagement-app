// Application-wide constants

export const APP_CONFIG = {
  NAME: 'Task Management Platform',
  VERSION: '1.0.0',
  DESCRIPTION: 'A comprehensive task and project management platform',
  AUTHOR: 'Task Management Team',
} as const;

// API Configuration
export const API_CONFIG = {
  VERSION: 'v1',
  BASE_PATH: '/api',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  ALLOWED_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.csv'
  ],
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 300, // 5 minutes
  SHORT_TTL: 60, // 1 minute
  LONG_TTL: 3600, // 1 hour
  KEYS: {
    USER_PROFILE: 'user:profile',
    USER_PERMISSIONS: 'user:permissions',
    PROJECT_DETAILS: 'project:details',
    TASK_DETAILS: 'task:details',
    PROJECT_MEMBERS: 'project:members',
  },
} as const;

// WebSocket events
export const WS_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Task events
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_ASSIGNED: 'task:assigned',
  TASK_STATUS_CHANGED: 'task:status_changed',
  
  // Project events
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_DELETED: 'project:deleted',
  PROJECT_MEMBER_ADDED: 'project:member_added',
  PROJECT_MEMBER_REMOVED: 'project:member_removed',
  
  // User events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_TYPING: 'user:typing',
  
  // Notification events
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
} as const;

// Date and time formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm:ss',
  DISPLAY_DATE: 'MMM DD, YYYY',
  DISPLAY_DATETIME: 'MMM DD, YYYY HH:mm',
  RELATIVE: 'relative', // For libraries like date-fns
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  USERNAME: { MIN: 3, MAX: 50 },
  PASSWORD: { MIN: 8, MAX: 128 },
  EMAIL: { MAX: 255 },
  TASK_TITLE: { MIN: 1, MAX: 255 },
  TASK_DESCRIPTION: { MAX: 2000 },
  PROJECT_NAME: { MIN: 1, MAX: 255 },
  PROJECT_DESCRIPTION: { MAX: 2000 },
  COMMENT_CONTENT: { MIN: 1, MAX: 2000 },
  TAG_NAME: { MIN: 1, MAX: 50 },
  BIO: { MAX: 500 },
} as const;