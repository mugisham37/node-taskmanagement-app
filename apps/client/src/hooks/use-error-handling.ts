// Comprehensive error handling hook for components

import React, { useCallback } from 'react';
import { useError, useErrorHandler } from '@/components/providers/error-provider';
import { TRPCErrorHandler } from '@/lib/trpc-error-handler';
import { AppError, normalizeError, ErrorSeverity } from '@taskmanagement/shared';
import { toast } from 'sonner';

export interface UseErrorHandlingOptions {
  showToast?: boolean;
  toastDuration?: number;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  context?: Record<string, any>;
}

export function useErrorHandling(options: UseErrorHandlingOptions = {}) {
  const {
    showToast = true,
    toastDuration = 5000,
    enableRetry = true,
    enableCircuitBreaker = true,
    context = {},
  } = options;

  const { handleError, handleAsync, executeWithCircuitBreaker, executeWithRetry } = useError();
  const { addBreadcrumb } = useErrorHandler();

  /**
   * Handle errors with optional toast notification
   */
  const handleErrorWithToast = useCallback((
    error: unknown,
    customMessage?: string,
    additionalContext?: Record<string, unknown>
  ) => {
    const normalizedError = normalizeError(error);
    const errorContext = { ...context, ...additionalContext };

    // Add breadcrumb
    addBreadcrumb(`Error handled: ${normalizedError.message}`, 'error', 'error');

    // Handle the error
    handleError(normalizedError, errorContext);

    // Show toast if enabled
    if (showToast) {
      const message = customMessage || normalizedError.message || 'An error occurred';
      
      if (normalizedError.statusCode >= 500) {
        toast.error(message, { duration: toastDuration });
      } else if (normalizedError.statusCode >= 400) {
        toast.warning(message, { duration: toastDuration });
      } else {
        toast.info(message, { duration: toastDuration });
      }
    }
  }, [handleError, addBreadcrumb, showToast, toastDuration, context]);

  /**
   * Execute async operation with comprehensive error handling
   */
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      onSuccess?: (result: T) => void;
      onError?: (error: AppError) => void;
      customErrorMessage?: string;
      showSuccessToast?: boolean;
      successMessage?: string;
    } = {}
  ): Promise<T | null> => {
    const {
      onSuccess,
      onError,
      customErrorMessage,
      showSuccessToast = false,
      successMessage,
    } = options;

    try {
      addBreadcrumb(`Starting operation: ${operationName}`, 'user', 'info');

      let result: T;

      // Choose execution strategy based on options
      if (enableCircuitBreaker && enableRetry) {
        result = await executeWithCircuitBreaker('default', () =>
          executeWithRetry(operationName, operation)
        );
      } else if (enableCircuitBreaker) {
        result = await executeWithCircuitBreaker('default', operation);
      } else if (enableRetry) {
        result = await executeWithRetry(operationName, operation);
      } else {
        result = await operation();
      }

      // Handle success
      addBreadcrumb(`Operation completed: ${operationName}`, 'user', 'info');
      onSuccess?.(result);

      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      return result;

    } catch (error) {
      const normalizedError = normalizeError(error);
      
      addBreadcrumb(`Operation failed: ${operationName} - ${normalizedError.message}`, 'error', 'error');
      
      handleErrorWithToast(normalizedError, customErrorMessage, {
        operation: operationName,
      });

      onError?.(normalizedError);
      return null;
    }
  }, [
    executeWithCircuitBreaker,
    executeWithRetry,
    enableCircuitBreaker,
    enableRetry,
    handleErrorWithToast,
    addBreadcrumb,
  ]);

  /**
   * Execute tRPC operation with error handling
   */
  const executeTRPCOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      onSuccess?: (result: T) => void;
      onError?: (error: AppError) => void;
      customErrorMessage?: string;
      showSuccessToast?: boolean;
      successMessage?: string;
    } = {}
  ): Promise<T | null> => {
    return executeWithErrorHandling(
      () => TRPCErrorHandler.handleTRPCOperation(operation, {
        operationName,
        enableCircuitBreaker,
        enableRetry,
        context,
      }),
      operationName,
      options
    );
  }, [executeWithErrorHandling, enableCircuitBreaker, enableRetry, context]);

  /**
   * Create error boundary for specific operations
   */
  const createOperationErrorBoundary = useCallback((operationName: string) => {
    return {
      onError: (error: unknown) => {
        handleErrorWithToast(error, undefined, {
          operation: operationName,
          boundary: true,
        });
      },
    };
  }, [handleErrorWithToast]);

  /**
   * Handle form submission errors
   */
  const handleFormError = useCallback((
    error: unknown,
    formName: string,
    fieldErrors?: Record<string, string>
  ) => {
    const normalizedError = normalizeError(error);
    
    // Handle validation errors specially
    if (normalizedError.code === 'VALIDATION_ERROR' && fieldErrors) {
      const field = normalizedError.field;
      if (field && fieldErrors[field]) {
        toast.error(fieldErrors[field], { duration: toastDuration });
        return;
      }
    }

    handleErrorWithToast(normalizedError, undefined, {
      form: formName,
      type: 'form_submission',
    });
  }, [handleErrorWithToast, toastDuration]);

  /**
   * Handle network errors specifically
   */
  const handleNetworkError = useCallback((
    error: unknown,
    operation: string,
    retryFn?: () => void
  ) => {
    const normalizedError = normalizeError(error);
    
    if (normalizedError.statusCode === 0 || normalizedError.code.includes('NETWORK')) {
      toast.error('Network connection lost', {
        duration: toastDuration,
        action: retryFn ? {
          label: 'Retry',
          onClick: retryFn,
        } : undefined,
      });
    } else {
      handleErrorWithToast(normalizedError, undefined, {
        operation,
        type: 'network',
      });
    }
  }, [handleErrorWithToast, toastDuration]);

  return {
    handleError: handleErrorWithToast,
    executeWithErrorHandling,
    executeTRPCOperation,
    createOperationErrorBoundary,
    handleFormError,
    handleNetworkError,
    addBreadcrumb,
  };
}

/**
 * Hook for handling async operations with loading state
 */
export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: UseErrorHandlingOptions & {
    onSuccess?: (result: T) => void;
    onError?: (error: AppError) => void;
    autoExecute?: boolean;
  } = {}
) {
  const { executeWithErrorHandling } = useErrorHandling(options);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<AppError | null>(null);
  const [data, setData] = React.useState<T | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await executeWithErrorHandling(
        operation,
        operationName,
        {
          onSuccess: (result) => {
            setData(result);
            options.onSuccess?.(result);
          },
          onError: (error) => {
            setError(error);
            options.onError?.(error);
          },
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  }, [executeWithErrorHandling, operation, operationName, options]);

  // Auto-execute if enabled
  React.useEffect(() => {
    if (options.autoExecute) {
      execute();
    }
  }, [execute, options.autoExecute]);

  return {
    execute,
    isLoading,
    error,
    data,
    reset: () => {
      setError(null);
      setData(null);
    },
  };
}