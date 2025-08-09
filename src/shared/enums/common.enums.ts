/**
 * Common enumerations used across the application
 * Enhanced with comprehensive enums from older version migration
 */

/**
 * Environment types
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test',
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Cache types
 */
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis',
  HYBRID = 'hybrid',
}

/**
 * Event types
 */
export enum EventType {
  DOMAIN_EVENT = 'domain_event',
  INTEGRATION_EVENT = 'integration_event',
  SYSTEM_EVENT = 'system_event',
}

/**
 * Priority levels
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Status types
 */
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * Task status enumeration
 */
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

/**
 * Project status enumeration
 */
export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

/**
 * User role enumeration
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
  VIEWER = 'viewer',
  GUEST = 'guest',
}

/**
 * Permission enumeration
 */
export enum Permission {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
  ADMIN = 'admin',
}

/**
 * Notification type enumeration
 */
export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

/**
 * Notification delivery method
 */
export enum NotificationDeliveryMethod {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  WEBHOOK = 'webhook',
}

/**
 * File type enumeration
 */
export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  SPREADSHEET = 'spreadsheet',
  PRESENTATION = 'presentation',
  ARCHIVE = 'archive',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other',
}

/**
 * Sort direction enumeration
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * HTTP method enumeration
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

/**
 * Content type enumeration
 */
export enum ContentType {
  JSON = 'application/json',
  XML = 'application/xml',
  HTML = 'text/html',
  TEXT = 'text/plain',
  CSV = 'text/csv',
  PDF = 'application/pdf',
  FORM_DATA = 'multipart/form-data',
  URL_ENCODED = 'application/x-www-form-urlencoded',
}

/**
 * Database operation enumeration
 */
export enum DatabaseOperation {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  BULK_CREATE = 'bulk_create',
  BULK_UPDATE = 'bulk_update',
  BULK_DELETE = 'bulk_delete',
}

/**
 * Job status enumeration
 */
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
}

/**
 * Job type enumeration
 */
export enum JobType {
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled',
  RECURRING = 'recurring',
  DELAYED = 'delayed',
}

/**
 * Webhook event type enumeration
 */
export enum WebhookEventType {
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_DELETED = 'task.deleted',
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
}

/**
 * Audit action enumeration
 */
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
}

/**
 * Integration type enumeration
 */
export enum IntegrationType {
  CALENDAR = 'calendar',
  EMAIL = 'email',
  SLACK = 'slack',
  TEAMS = 'teams',
  JIRA = 'jira',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  TRELLO = 'trello',
}

/**
 * Recurrence pattern enumeration
 */
export enum RecurrencePattern {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

/**
 * Time zone enumeration (common ones)
 */
export enum TimeZone {
  UTC = 'UTC',
  EST = 'America/New_York',
  PST = 'America/Los_Angeles',
  GMT = 'Europe/London',
  CET = 'Europe/Paris',
  JST = 'Asia/Tokyo',
  AEST = 'Australia/Sydney',
}

/**
 * Currency enumeration
 */
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  CAD = 'CAD',
  AUD = 'AUD',
  CHF = 'CHF',
  CNY = 'CNY',
}

/**
 * Language enumeration
 */
export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  RU = 'ru',
  JA = 'ja',
  KO = 'ko',
  ZH = 'zh',
}

/**
 * Theme enumeration
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

/**
 * Device type enumeration
 */
export enum DeviceType {
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  MOBILE = 'mobile',
  UNKNOWN = 'unknown',
}

/**
 * Browser enumeration
 */
export enum Browser {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  SAFARI = 'safari',
  EDGE = 'edge',
  OPERA = 'opera',
  UNKNOWN = 'unknown',
}
