/**
 * Common enumerations used across the application
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
