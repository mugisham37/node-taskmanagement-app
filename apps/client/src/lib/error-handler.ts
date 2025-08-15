// Client-side error handling utilities

import { AppError, normalizeError, createUserFriendlyMessage, ErrorSeverity, determineErrorSeverity, shouldReportError, ErrorContext, ErrorReport } from '@taskmanagement/shared';
import { toast } from 'sonner';

/**
 * Client error handler class
 */
export class ClientErrorHandler {
  private static breadcrumbs: string[] = [];
  private static maxBreadcrumbs = 20;

  /**
   * Add breadcrumb for error tracking
   */
  static addBreadcrumb(message: string): void {
    this.breadcrumbs.push(`${new Date().toISOString()}: ${message}`);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Handle error with appropriate user feedback and reporting
   */
  static handle(error: unknown, context?: Partial<ErrorContext>): void {
    const normalizedError = normalizeError(error);
    const severity = determineErrorSeverity(normalizedError);
    const userMessage = createUserFriendlyMessage(normalizedError);

    // Show user notification
    this.showUserNotification(normalizedError, userMessage, severity);

    // Log error
    this.logError(normalizedError, severity, context);

    // Report error if necessary
    if (shouldReportError(normalizedError)) {
      this.reportError(normalizedError, severity, context);
    }
  }

  /**
   * Handle async operation errors with retry capability
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    options: {
      retries?: number;
      retryDelay?: number;
      onRetry?: (attempt: number, error: AppError) => void;
      context?: Partial<ErrorContext>;
    } = {}
  ): Promise<T> {
    const { retries = 3, retryDelay = 1000, onRetry, context } = options;
    let lastError: AppError;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = normalizeError(error);

        // Don't retry if error is not retryable or it's the last attempt
        if (attempt > retries || !this.isRetryableError(lastError)) {
          this.handle(lastError, context);
          throw lastError;
        }

        // Call retry callback
        onRetry?.(attempt, lastError);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    throw lastError!;
  }

  /**
   * Show user notification based on error severity
   */
  private static showUserNotification(error: AppError, message: string, severity: ErrorSeverity): void {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        toast.error(message, {
          duration: 10000,
          action: {
            label: 'Report Issue',
            onClick: () => this.openReportDialog(error),
          },
        });
        break;

      case ErrorSeverity.HIGH:
        toast.error(message, {
          duration: 8000,
        });
        break;

      case ErrorSeverity.MEDIUM:
        toast.warning(message, {
          duration: 5000,
        });
        break;

      case ErrorSeverity.LOW:
        toast.info(message, {
          duration: 3000,
        });
        break;
    }
  }

  /**
   * Log error to console with appropriate level
   */
  private static logError(error: AppError, severity: ErrorSeverity, context?: Partial<ErrorContext>): void {
    const logData = {
      error: error.toJSON(),
      severity,
      context,
      breadcrumbs: [...this.breadcrumbs],
      timestamp: new Date().toISOString(),
    };

    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error('Error:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('Warning:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('Info:', logData);
        break;
    }
  }

  /**
   * Report error to monitoring service
   */
  private static reportError(error: AppError, severity: ErrorSeverity, context?: Partial<ErrorContext>): void {
    const report: ErrorReport = {
      error,
      severity,
      context: {
        userId: this.getCurrentUserId(),
        sessionId: this.getSessionId(),
        requestId: this.generateRequestId(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date(),
        ...context,
      },
      stackTrace: error.stack,
      breadcrumbs: [...this.breadcrumbs],
    };

    // Send to monitoring service (implement based on your monitoring solution)
    this.sendToMonitoringService(report);
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: AppError): boolean {
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
   * Open error report dialog
   */
  private static openReportDialog(error: AppError): void {
    // Implement error report dialog
    console.log('Opening error report dialog for:', error);
  }

  /**
   * Get current user ID from auth context
   */
  private static getCurrentUserId(): string | undefined {
    // Implement based on your auth system
    return undefined;
  }

  /**
   * Get session ID
   */
  private static getSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Generate request ID
   */
  private static generateRequestId(): string {
    return crypto.randomUUID();
  }

  /**
   * Send error report to monitoring service
   */
  private static sendToMonitoringService(report: ErrorReport): void {
    // Implement based on your monitoring solution (Sentry, LogRocket, etc.)
    try {
      // Example: Send to your error reporting endpoint
      fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      }).catch(err => {
        console.error('Failed to report error:', err);
      });
    } catch (err) {
      console.error('Failed to send error report:', err);
    }
  }
}

/**
 * Global error handler for unhandled promise rejections
 */
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    ClientErrorHandler.handle(event.reason, {
      additionalData: { type: 'unhandledrejection' },
    });
  });

  window.addEventListener('error', (event) => {
    ClientErrorHandler.handle(event.error, {
      additionalData: { 
        type: 'uncaughtException',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}