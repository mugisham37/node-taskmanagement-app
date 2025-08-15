// Error reporting service for monitoring and analytics

import { AppError, ErrorReport, ErrorSeverity, createErrorFingerprint } from '@taskmanagement/shared';

export interface ErrorReportingConfig {
  endpoint: string;
  apiKey?: string;
  environment: string;
  release?: string;
  userId?: string;
  sessionId?: string;
  enableConsoleCapture: boolean;
  enableBreadcrumbs: boolean;
  maxBreadcrumbs: number;
  sampleRate: number; // 0-1, percentage of errors to report
}

export interface BreadcrumbData {
  timestamp: Date;
  message: string;
  category: 'navigation' | 'user' | 'http' | 'error' | 'info';
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export class ErrorReportingService {
  private config: ErrorReportingConfig;
  private breadcrumbs: BreadcrumbData[] = [];
  private reportedErrors = new Set<string>();
  private isInitialized = false;

  constructor(config: Partial<ErrorReportingConfig>) {
    this.config = {
      endpoint: '/api/errors/report',
      environment: process.env.NODE_ENV || 'development',
      enableConsoleCapture: true,
      enableBreadcrumbs: true,
      maxBreadcrumbs: 50,
      sampleRate: 1.0,
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize error reporting service
   */
  private initialize(): void {
    if (this.isInitialized) return;

    // Capture console errors if enabled
    if (this.config.enableConsoleCapture) {
      this.setupConsoleCapture();
    }

    // Setup automatic breadcrumb collection
    if (this.config.enableBreadcrumbs) {
      this.setupBreadcrumbCollection();
    }

    this.isInitialized = true;
  }

  /**
   * Report error to monitoring service
   */
  async reportError(
    error: AppError,
    severity: ErrorSeverity,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      // Check sample rate
      if (Math.random() > this.config.sampleRate) {
        return;
      }

      // Create error fingerprint to avoid duplicate reports
      const fingerprint = createErrorFingerprint(error, context);
      if (this.reportedErrors.has(fingerprint)) {
        return;
      }

      // Mark as reported
      this.reportedErrors.add(fingerprint);

      // Create error report
      const report: ErrorReport = {
        error,
        severity,
        context: {
          userId: this.config.userId,
          sessionId: this.config.sessionId,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date(),
          environment: this.config.environment,
          release: this.config.release,
          ...context,
        },
        stackTrace: error.stack,
        breadcrumbs: this.getBreadcrumbs(),
      };

      // Send report
      await this.sendReport(report);

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  /**
   * Add breadcrumb for error context
   */
  addBreadcrumb(
    message: string,
    category: BreadcrumbData['category'] = 'info',
    level: BreadcrumbData['level'] = 'info',
    data?: Record<string, any>
  ): void {
    if (!this.config.enableBreadcrumbs) return;

    const breadcrumb: BreadcrumbData = {
      timestamp: new Date(),
      message,
      category,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Limit breadcrumbs to max count
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Set user context
   */
  setUser(userId: string, userData?: Record<string, any>): void {
    this.config.userId = userId;
    this.addBreadcrumb(`User set: ${userId}`, 'user', 'info', userData);
  }

  /**
   * Set session context
   */
  setSession(sessionId: string): void {
    this.config.sessionId = sessionId;
    this.addBreadcrumb(`Session set: ${sessionId}`, 'user', 'info');
  }

  /**
   * Set release version
   */
  setRelease(release: string): void {
    this.config.release = release;
  }

  /**
   * Clear reported errors cache
   */
  clearReportedErrors(): void {
    this.reportedErrors.clear();
  }

  /**
   * Get current breadcrumbs
   */
  getBreadcrumbs(): string[] {
    return this.breadcrumbs.map(b => 
      `[${b.timestamp.toISOString()}] ${b.category.toUpperCase()}: ${b.message}`
    );
  }

  /**
   * Send error report to monitoring service
   */
  private async sendReport(report: ErrorReport): Promise<void> {
    const payload = {
      ...report,
      fingerprint: createErrorFingerprint(report.error, report.context),
      environment: this.config.environment,
      release: this.config.release,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error reporting failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Setup console error capture
   */
  private setupConsoleCapture(): void {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args) => {
      this.addBreadcrumb(
        `Console error: ${args.join(' ')}`,
        'error',
        'error'
      );
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      this.addBreadcrumb(
        `Console warning: ${args.join(' ')}`,
        'error',
        'warning'
      );
      originalWarn.apply(console, args);
    };
  }

  /**
   * Setup automatic breadcrumb collection
   */
  private setupBreadcrumbCollection(): void {
    // Navigation breadcrumbs
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      errorReportingService.addBreadcrumb(
        `Navigation to: ${args[2]}`,
        'navigation',
        'info'
      );
      return originalPushState.apply(history, args);
    };

    history.replaceState = function(...args) {
      errorReportingService.addBreadcrumb(
        `Navigation replaced: ${args[2]}`,
        'navigation',
        'info'
      );
      return originalReplaceState.apply(history, args);
    };

    // Click breadcrumbs
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const text = target.textContent?.slice(0, 50) || '';
      
      this.addBreadcrumb(
        `Clicked ${tagName}: ${text}`,
        'user',
        'info',
        {
          tagName,
          className: target.className,
          id: target.id,
        }
      );
    });

    // HTTP request breadcrumbs (if using fetch)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const method = args[1]?.method || 'GET';
      
      this.addBreadcrumb(
        `HTTP ${method}: ${url}`,
        'http',
        'info'
      );

      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          this.addBreadcrumb(
            `HTTP ${method} failed: ${url} (${response.status})`,
            'http',
            'error'
          );
        }
        
        return response;
      } catch (error) {
        this.addBreadcrumb(
          `HTTP ${method} error: ${url}`,
          'http',
          'error'
        );
        throw error;
      }
    };
  }
}

// Global error reporting service instance
export const errorReportingService = new ErrorReportingService({
  endpoint: process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT || '/api/errors/report',
  apiKey: process.env.NEXT_PUBLIC_ERROR_REPORTING_API_KEY,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_APP_VERSION,
});

// Utility functions
export function reportError(
  error: AppError,
  severity: ErrorSeverity,
  context?: Record<string, any>
): void {
  errorReportingService.reportError(error, severity, context);
}

export function addBreadcrumb(
  message: string,
  category?: BreadcrumbData['category'],
  level?: BreadcrumbData['level'],
  data?: Record<string, any>
): void {
  errorReportingService.addBreadcrumb(message, category, level, data);
}

export function setUser(userId: string, userData?: Record<string, any>): void {
  errorReportingService.setUser(userId, userData);
}

export function setSession(sessionId: string): void {
  errorReportingService.setSession(sessionId);
}