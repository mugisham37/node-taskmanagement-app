// Error handling utilities

import { AppError } from '../errors/base.errors';
import { ZodError } from 'zod';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error context interface
 */
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

/**
 * Error report interface
 */
export interface ErrorReport {
  error: AppError;
  severity: ErrorSeverity;
  context: ErrorContext;
  stackTrace?: string;
  breadcrumbs?: string[];
}

/**
 * Determines error severity based on error type and status code
 */
export function determineErrorSeverity(error: AppError): ErrorSeverity {
  // Critical errors
  if (error.statusCode >= 500 || error.code.includes('DATABASE') || error.code.includes('EXTERNAL_SERVICE')) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors
  if (error.statusCode === 401 || error.statusCode === 403 || error.code.includes('AUTHENTICATION')) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity errors
  if (error.statusCode === 404 || error.statusCode === 409 || error.code.includes('VALIDATION')) {
    return ErrorSeverity.MEDIUM;
  }

  // Low severity errors (client-side, network issues)
  return ErrorSeverity.LOW;
}

/**
 * Converts unknown error to AppError
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return new AppError(
      firstIssue?.message || 'Validation failed',
      'VALIDATION_ERROR',
      400,
      firstIssue?.path?.join('.'),
      { issues: error.issues }
    );
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      undefined,
      { originalError: error.name, stack: error.stack }
    );
  }

  return new AppError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    undefined,
    { originalError: String(error) }
  );
}

/**
 * Checks if error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  const retryableCodes = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'SERVICE_UNAVAILABLE_ERROR',
    'CLIENT_NETWORK_ERROR',
    'CLIENT_TIMEOUT_ERROR',
    'WEBSOCKET_CONNECTION_ERROR',
  ];

  return retryableCodes.includes(error.code) || 
         error.statusCode === 429 || // Rate limit
         error.statusCode === 502 || // Bad gateway
         error.statusCode === 503 || // Service unavailable
         error.statusCode === 504;   // Gateway timeout
}

/**
 * Checks if error should be reported to monitoring service
 */
export function shouldReportError(error: AppError): boolean {
  const nonReportableCodes = [
    'VALIDATION_ERROR',
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'NOT_FOUND_ERROR',
    'CONFLICT_ERROR',
  ];

  return !nonReportableCodes.includes(error.code) && error.statusCode >= 500;
}

/**
 * Sanitizes error for client consumption (removes sensitive data)
 */
export function sanitizeErrorForClient(error: AppError): Partial<AppError> {
  const sanitized: Partial<AppError> = {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    field: error.field,
    timestamp: error.timestamp,
  };

  // Only include details for client-safe errors
  if (error.statusCode < 500) {
    sanitized.details = error.details;
  }

  return sanitized;
}

/**
 * Creates user-friendly error message
 */
export function createUserFriendlyMessage(error: AppError): string {
  const friendlyMessages: Record<string, string> = {
    VALIDATION_ERROR: 'Please check your input and try again.',
    AUTHENTICATION_ERROR: 'Please log in to continue.',
    AUTHORIZATION_ERROR: 'You don\'t have permission to perform this action.',
    NOT_FOUND_ERROR: 'The requested item could not be found.',
    CONFLICT_ERROR: 'This action conflicts with existing data.',
    RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
    NETWORK_ERROR: 'Connection problem. Please check your internet connection.',
    TIMEOUT_ERROR: 'The request took too long. Please try again.',
    SERVICE_UNAVAILABLE_ERROR: 'Service is temporarily unavailable. Please try again later.',
    INTERNAL_SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
    OFFLINE_ERROR: 'You appear to be offline. Please check your connection.',
    WEBSOCKET_CONNECTION_ERROR: 'Real-time connection lost. Attempting to reconnect...',
  };

  return friendlyMessages[error.code] || error.message || 'An unexpected error occurred.';
}

/**
 * Extracts error chain from nested errors
 */
export function extractErrorChain(error: Error): Error[] {
  const chain: Error[] = [error];
  let current = error;

  while (current.cause && current.cause instanceof Error) {
    chain.push(current.cause);
    current = current.cause;
  }

  return chain;
}

/**
 * Creates error fingerprint for deduplication
 */
export function createErrorFingerprint(error: AppError, context?: ErrorContext): string {
  const components = [
    error.code,
    error.message,
    error.statusCode.toString(),
    context?.url || '',
    error.stack?.split('\n')[1] || '', // First line of stack trace
  ];

  return btoa(components.join('|')).slice(0, 16);
}