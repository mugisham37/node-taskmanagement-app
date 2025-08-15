// tRPC error handling integration

import { TRPCClientError } from '@trpc/client';
import { AppError, normalizeError, ErrorSeverity, determineErrorSeverity } from '@taskmanagement/shared';
import { ClientErrorHandler } from './error-handler';
import { circuitBreakerManager } from './circuit-breaker';
import { retryManager } from './retry-mechanism';

/**
 * Enhanced tRPC error handler with circuit breaker and retry logic
 */
export class TRPCErrorHandler {
  /**
   * Handle tRPC errors with automatic retry and circuit breaker
   */
  static async handleTRPCOperation<T>(
    operation: () => Promise<T>,
    options: {
      operationName: string;
      serviceName?: string;
      enableCircuitBreaker?: boolean;
      enableRetry?: boolean;
      context?: Record<string, any>;
    }
  ): Promise<T> {
    const {
      operationName,
      serviceName = 'trpc',
      enableCircuitBreaker = true,
      enableRetry = true,
      context = {},
    } = options;

    try {
      let result: T;

      if (enableCircuitBreaker) {
        result = await circuitBreakerManager.execute(serviceName, async () => {
          if (enableRetry) {
            return await retryManager.execute(operationName, operation);
          } else {
            return await operation();
          }
        });
      } else if (enableRetry) {
        result = await retryManager.execute(operationName, operation);
      } else {
        result = await operation();
      }

      return result;

    } catch (error) {
      const normalizedError = this.normalizeTRPCError(error);
      
      ClientErrorHandler.handle(normalizedError, {
        operation: operationName,
        service: serviceName,
        ...context,
      });

      throw normalizedError;
    }
  }

  /**
   * Normalize tRPC errors to AppError format
   */
  static normalizeTRPCError(error: unknown): AppError {
    if (error instanceof TRPCClientError) {
      // Extract error details from tRPC error
      const data = error.data;
      const statusCode = data?.httpStatus || 500;
      
      // Try to parse the error message for structured errors
      let code = 'TRPC_ERROR';
      let message = error.message;
      let field: string | undefined;
      let details: Record<string, any> | undefined;

      if (data?.code) {
        code = data.code;
      }

      if (data?.zodError) {
        // Handle Zod validation errors
        code = 'VALIDATION_ERROR';
        const zodError = data.zodError;
        if (zodError.issues && zodError.issues.length > 0) {
          const firstIssue = zodError.issues[0];
          message = firstIssue.message;
          field = firstIssue.path?.join('.');
          details = { issues: zodError.issues };
        }
      }

      return new AppError(message, code, statusCode, field, details);
    }

    // Fallback to generic error normalization
    return normalizeError(error);
  }

  /**
   * Create tRPC query error handler
   */
  static createQueryErrorHandler(operationName: string) {
    return (error: unknown) => {
      const normalizedError = this.normalizeTRPCError(error);
      const severity = determineErrorSeverity(normalizedError);

      ClientErrorHandler.handle(normalizedError, {
        operation: operationName,
        type: 'query',
      });

      // Don't throw for queries, just log
      console.error(`tRPC Query Error [${operationName}]:`, normalizedError);
    };
  }

  /**
   * Create tRPC mutation error handler
   */
  static createMutationErrorHandler(operationName: string) {
    return (error: unknown) => {
      const normalizedError = this.normalizeTRPCError(error);
      
      ClientErrorHandler.handle(normalizedError, {
        operation: operationName,
        type: 'mutation',
      });

      // Re-throw for mutations so they can be handled by the component
      throw normalizedError;
    };
  }

  /**
   * Create optimistic update error handler
   */
  static createOptimisticUpdateErrorHandler(
    operationName: string,
    rollbackFn: () => void
  ) {
    return (error: unknown) => {
      const normalizedError = this.normalizeTRPCError(error);
      
      // Rollback optimistic update
      rollbackFn();

      ClientErrorHandler.handle(normalizedError, {
        operation: operationName,
        type: 'optimistic_update',
      });

      throw normalizedError;
    };
  }
}

/**
 * tRPC client configuration with error handling
 */
export const trpcErrorConfig = {
  /**
   * Default error handler for tRPC client
   */
  onError: (error: TRPCClientError<any>) => {
    const normalizedError = TRPCErrorHandler.normalizeTRPCError(error);
    
    ClientErrorHandler.handle(normalizedError, {
      source: 'trpc_client',
      procedure: error.data?.path,
    });
  },

  /**
   * Retry configuration for tRPC
   */
  retry: (failureCount: number, error: TRPCClientError<any>) => {
    const normalizedError = TRPCErrorHandler.normalizeTRPCError(error);
    
    // Don't retry validation errors or client errors
    if (normalizedError.statusCode < 500) {
      return false;
    }

    // Retry up to 3 times for server errors
    return failureCount < 3;
  },

  /**
   * Retry delay with exponential backoff
   */
  retryDelay: (attemptIndex: number) => {
    return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
  },
};

/**
 * Utility function to wrap tRPC procedures with error handling
 */
export function withTRPCErrorHandling<T extends (...args: any[]) => Promise<any>>(
  procedure: T,
  operationName: string,
  options: {
    enableCircuitBreaker?: boolean;
    enableRetry?: boolean;
    serviceName?: string;
  } = {}
): T {
  return ((...args: Parameters<T>) => {
    return TRPCErrorHandler.handleTRPCOperation(
      () => procedure(...args),
      {
        operationName,
        ...options,
      }
    );
  }) as T;
}