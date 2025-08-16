/**
 * Common types used across the application
 * Enhanced with additional types from older version migration
 */

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type UUID = string;
export type Timestamp = Date;

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: {
    timestamp?: string;
    requestId?: string;
    version?: string;
    [key: string]: any;
  };
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
  search?: string;
  fields?: string[];
}

// Enhanced types for better type safety
// Note: DomainEvent, IntegrationEvent, and EventMetadata are defined in event.interface.ts

// SQL types for Drizzle ORM
export type OptionalSQL = import('drizzle-orm').SQL | null | undefined;

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type NonEmptyArray<T> = [T, ...T[]];

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Error types
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

// Note: ValidationError is defined in validator.interface.ts

// Request/Response types
export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorDetails;
  metadata?: Record<string, any>;
}

// Configuration types
// Note: DatabaseConfig is defined in config/app-config.ts

export interface CacheConfig {
  type: 'memory' | 'redis' | 'hybrid';
  ttl: number;
  maxSize?: number;
  redisUrl?: string;
}

// Note: LoggerConfig is defined in logger.interface.ts

// Audit types
export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
  userId?: string;
  changes?: Record<string, { from: any; to: any }>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Health check types
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  services: HealthCheck[];
  uptime: number;
  version: string;
}

// Metrics types
export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// File types
export interface FileUpload {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  userId: string;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// Search types
export interface SearchQuery {
  term: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: PaginationParams;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
  suggestions?: string[];
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

// Job/Task types
export interface JobDefinition {
  id: string;
  name: string;
  type: 'immediate' | 'scheduled' | 'recurring';
  payload: Record<string, any>;
  priority?: number;
  maxRetries?: number;
  delay?: number;
  cronExpression?: string;
}

export interface JobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'retrying';
  result?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  attempts: number;
}

// Feature flag types
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  conditions?: Array<{
    property: string;
    operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt';
    value: any;
  }>;
  rolloutPercentage?: number;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: string;
  payload: Record<string, any>;
  timestamp: Date;
  source: string;
  version: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  url: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  response?: {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };
}