"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, normalizeError, determineErrorSeverity, ErrorSeverity } from '@taskmanagement/shared';
import { ClientErrorHandler } from '@/lib/error-handler';
import { ErrorFallback } from './error-fallback';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: AppError | null;
  errorId: string | null;
  severity: ErrorSeverity | null;
}

export interface ErrorFallbackProps {
  error: AppError;
  errorId: string;
  severity: ErrorSeverity;
  resetError: () => void;
  level: 'page' | 'section' | 'component';
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      severity: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const normalizedError = normalizeError(error);
    const severity = determineErrorSeverity(normalizedError);
    const errorId = crypto.randomUUID();

    return {
      hasError: true,
      error: normalizedError,
      errorId,
      severity,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const normalizedError = normalizeError(error);
    
    // Add breadcrumb
    ClientErrorHandler.addBreadcrumb(
      `Error boundary caught error in ${this.props.level || 'component'}: ${normalizedError.message}`
    );

    // Handle error
    ClientErrorHandler.handle(normalizedError, {
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundaryLevel: this.props.level || 'component',
      },
    });

    // Call custom error handler
    this.props.onError?.(normalizedError, errorInfo);

    // Auto-reset for non-critical errors after delay
    if (this.state.severity !== ErrorSeverity.CRITICAL) {
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetError();
      }, 10000);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      severity: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorId && this.state.severity) {
      const FallbackComponent = this.props.fallback || ErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorId={this.state.errorId}
          severity={this.state.severity}
          resetError={this.resetError}
          level={this.props.level || 'component'}
        />
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual error reporting
export function useErrorHandler() {
  return {
    handleError: ClientErrorHandler.handle,
    addBreadcrumb: ClientErrorHandler.addBreadcrumb,
    handleAsync: ClientErrorHandler.handleAsync,
  };
}