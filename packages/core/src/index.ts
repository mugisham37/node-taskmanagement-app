// Core package main exports
export * from './base';
export * from './constants';
export * from './enums';
export * from './errors';
export * from './events';
export * from './guards';
export * from './utils';

// Specific type exports to avoid conflicts
export type { AuthenticatedUser, SecurityContext, TokenPayload } from './types/auth-types';
export type { ApiResponse, BaseEntity, PaginatedResponse } from './types/common.types';
export type {
  LogLevel as CoreLogLevel,
  LogContext,
  LogEntry,
  Logger,
  LoggerConfig,
} from './types/logger.interface';
export type {
  ValidationResult,
  ValidationRule,
  ValidationSchema,
} from './types/validator.interface';

// Middleware exports
export { CompressionMiddleware } from './middleware/compression-middleware';
export type { CompressionOptions } from './middleware/compression-middleware';
export { RequestBatchingMiddleware } from './middleware/request-batching';
export type { BatchRequest, BatchResponse, BatchingOptions } from './middleware/request-batching';
