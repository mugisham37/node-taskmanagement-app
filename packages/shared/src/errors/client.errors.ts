// Client-specific error classes

import { AppError } from './base.errors';

/**
 * Client-side network error
 */
export class ClientNetworkError extends AppError {
  constructor(message: string = 'Network connection failed', details?: Record<string, any>) {
    super(message, 'CLIENT_NETWORK_ERROR', 0, undefined, details);
  }
}

/**
 * Client-side timeout error
 */
export class ClientTimeoutError extends AppError {
  constructor(timeout: number, operation?: string) {
    super(
      `Operation ${operation || 'request'} timed out after ${timeout}ms`,
      'CLIENT_TIMEOUT_ERROR',
      408,
      undefined,
      { timeout, operation }
    );
  }
}

/**
 * Client-side offline error
 */
export class OfflineError extends AppError {
  constructor(message: string = 'Application is offline') {
    super(message, 'OFFLINE_ERROR', 0);
  }
}

/**
 * Client-side storage error
 */
export class StorageError extends AppError {
  constructor(operation: string, storageType: 'localStorage' | 'sessionStorage' | 'indexedDB') {
    super(
      `Failed to ${operation} in ${storageType}`,
      'STORAGE_ERROR',
      500,
      undefined,
      { operation, storageType }
    );
  }
}

/**
 * Client-side component error
 */
export class ComponentError extends AppError {
  constructor(componentName: string, message: string, details?: Record<string, any>) {
    super(
      `Error in component ${componentName}: ${message}`,
      'COMPONENT_ERROR',
      500,
      undefined,
      { componentName, ...details }
    );
  }
}

/**
 * Client-side state synchronization error
 */
export class StateSyncError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'STATE_SYNC_ERROR', 500, undefined, details);
  }
}

/**
 * Client-side WebSocket connection error
 */
export class WebSocketConnectionError extends AppError {
  constructor(message: string = 'WebSocket connection failed', details?: Record<string, any>) {
    super(message, 'WEBSOCKET_CONNECTION_ERROR', 0, undefined, details);
  }
}

/**
 * Client-side cache error
 */
export class ClientCacheError extends AppError {
  constructor(operation: string, cacheType: string, details?: Record<string, any>) {
    super(
      `Cache ${operation} failed for ${cacheType}`,
      'CLIENT_CACHE_ERROR',
      500,
      undefined,
      { operation, cacheType, ...details }
    );
  }
}