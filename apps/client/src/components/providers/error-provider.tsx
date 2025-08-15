"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppError, ErrorSeverity, normalizeError, determineErrorSeverity } from '@taskmanagement/shared';
import { ClientErrorHandler } from '@/lib/error-handler';
import { circuitBreakerManager } from '@/lib/circuit-breaker';
import { retryManager } from '@/lib/retry-mechanism';
import { errorReportingService } from '@/lib/error-reporting';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { toast } from 'sonner';

interface ErrorContextValue {
  // Error handling
  handleError: (error: unknown, context?: Record<string, any>) => void;
  handleAsync: <T>(
    operation: () => Promise<T>,
    options?: {
      retries?: number;
      retryDelay?: number;
      onRetry?: (attempt: number, error: AppError) => void;
      context?: Record<string, any>;
    }
  ) => Promise<T>;

  // Circuit breaker
  executeWithCircuitBreaker: <T>(
    serviceName: string,
    operation: () => Promise<T>
  ) => Promise<T>;
  getCircuitBreakerStats: () => Record<string, any>;

  // Retry mechanism
  executeWithRetry: <T>(
    operationName: string,
    operation: () => Promise<T>
  ) => Promise<T>;
  getRetryStats: () => Record<string, any>;

  // Error reporting
  reportError: (error: AppError, severity: ErrorSeverity, context?: Record<string, any>) => void;
  addBreadcrumb: (message: string, category?: string, level?: string) => void;

  // Error state
  errors: AppError[];
  clearErrors: () => void;
  removeError: (errorId: string) => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

interface ErrorProviderProps {
  children: React.ReactNode;
  maxErrors?: number;
  enableGlobalErrorHandling?: boolean;
}

export function ErrorProvider({ 
  children, 
  maxErrors = 10,
  enableGlobalErrorHandling = true 
}: ErrorProviderProps) {
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    // Initialize error reporting with user context if available
    const initializeErrorReporting = () => {
      // Get user info from auth context or localStorage
      const userId = localStorage.getItem('userId');
      const sessionId = sessionStorage.getItem('sessionId') || crypto.randomUUID();
      
      if (userId) {
        errorReportingService.setUser(userId);
      }
      
      errorReportingService.setSession(sessionId);
      sessionStorage.setItem('sessionId', sessionId);
    };

    initializeErrorReporting();

    // Global error handlers
    if (enableGlobalErrorHandling) {
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const error = normalizeError(event.reason);
        handleError(error, { type: 'unhandledRejection' });
        event.preventDefault(); // Prevent default browser behavior
      };

      const handleError = (event: ErrorEvent) => {
        const error = normalizeError(event.error);
        handleError(error, {
          type: 'uncaughtException',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      window.addEventListener('error', handleError);

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        window.removeEventListener('error', handleError);
      };
    }
  }, [enableGlobalErrorHandling]);

  const handleError = (error: unknown, context?: Record<string, any>) => {
    const normalizedError = normalizeError(error);
    const severity = determineErrorSeverity(normalizedError);

    // Add to error state
    setErrors(prev => {
      const newErrors = [normalizedError, ...prev].slice(0, maxErrors);
      return newErrors;
    });

    // Handle with ClientErrorHandler
    ClientErrorHandler.handle(normalizedError, context);

    // Report error
    errorReportingService.reportError(normalizedError, severity, context);
  };

  const handleAsync = async <T,>(
    operation: () => Promise<T>,
    options: {
      retries?: number;
      retryDelay?: number;
      onRetry?: (attempt: number, error: AppError) => void;
      context?: Record<string, any>;
    } = {}
  ): Promise<T> => {
    return ClientErrorHandler.handleAsync(operation, options);
  };

  const executeWithCircuitBreaker = async <T,>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    return circuitBreakerManager.execute(serviceName, operation);
  };

  const getCircuitBreakerStats = () => {
    return circuitBreakerManager.getAllStats();
  };

  const executeWithRetry = async <T,>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    return retryManager.execute(operationName, operation);
  };

  const getRetryStats = () => {
    return retryManager.getAllStats();
  };

  const reportError = (error: AppError, severity: ErrorSeverity, context?: Record<string, any>) => {
    errorReportingService.reportError(error, severity, context);
  };

  const addBreadcrumb = (message: string, category?: string, level?: string) => {
    errorReportingService.addBreadcrumb(
      message,
      category as any,
      level as any
    );
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const removeError = (errorId: string) => {
    setErrors(prev => prev.filter(error => 
      `${error.code}_${error.timestamp?.getTime()}` !== errorId
    ));
  };

  const contextValue: ErrorContextValue = {
    handleError,
    handleAsync,
    executeWithCircuitBreaker,
    getCircuitBreakerStats,
    executeWithRetry,
    getRetryStats,
    reportError,
    addBreadcrumb,
    errors,
    clearErrors,
    removeError,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      <ErrorBoundary level="page">
        {children}
      </ErrorBoundary>
    </ErrorContext.Provider>
  );
}

// Hook to use error context
export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

// Hook for error handling with automatic context
export function useErrorHandler() {
  const { handleError, handleAsync, addBreadcrumb } = useError();

  const handleErrorWithContext = (error: unknown, additionalContext?: Record<string, any>) => {
    const context = {
      component: 'useErrorHandler',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...additionalContext,
    };

    handleError(error, context);
  };

  const handleAsyncWithContext = <T,>(
    operation: () => Promise<T>,
    operationName?: string,
    additionalContext?: Record<string, any>
  ) => {
    const context = {
      operation: operationName || 'anonymous',
      component: 'useErrorHandler',
      ...additionalContext,
    };

    return handleAsync(operation, { context });
  };

  return {
    handleError: handleErrorWithContext,
    handleAsync: handleAsyncWithContext,
    addBreadcrumb,
  };
}

// Hook for circuit breaker operations
export function useCircuitBreaker() {
  const { executeWithCircuitBreaker, getCircuitBreakerStats } = useError();

  return {
    execute: executeWithCircuitBreaker,
    getStats: getCircuitBreakerStats,
  };
}

// Hook for retry operations
export function useRetry() {
  const { executeWithRetry, getRetryStats } = useError();

  return {
    execute: executeWithRetry,
    getStats: getRetryStats,
  };
}

// Hook for error state management
export function useErrorState() {
  const { errors, clearErrors, removeError } = useError();

  const getErrorsByType = (errorCode: string) => {
    return errors.filter(error => error.code === errorCode);
  };

  const getErrorsBySeverity = (severity: ErrorSeverity) => {
    return errors.filter(error => determineErrorSeverity(error) === severity);
  };

  const hasErrors = errors.length > 0;
  const hasHighSeverityErrors = getErrorsBySeverity(ErrorSeverity.HIGH).length > 0 ||
                                getErrorsBySeverity(ErrorSeverity.CRITICAL).length > 0;

  return {
    errors,
    hasErrors,
    hasHighSeverityErrors,
    getErrorsByType,
    getErrorsBySeverity,
    clearErrors,
    removeError,
  };
}