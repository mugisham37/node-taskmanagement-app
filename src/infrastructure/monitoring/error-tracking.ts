import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface ErrorTrackingConfig {
  enableConsoleLogging: boolean;
  enableFileLogging: boolean;
  enableExternalService: boolean;
  maxErrorsInMemory: number;
  errorRetentionDays: number;
  alertThresholds: {
    errorRate: number; // errors per minute
    criticalErrorRate: number; // critical errors per minute
  };
  externalService?: {
    apiKey: string;
    endpoint: string;
    projectId: string;
  };
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  operation?: string;
  resource?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
  [key: string]: any;
}

export interface TrackedError {
  id: string;
  timestamp: Date;
  level: 'error' | 'fatal' | 'warning';
  message: string;
  stack?: string;
  name: string;
  code?: string;
  context?: ErrorContext;
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ErrorSummary {
  totalErrors: number;
  errorRate: number; // errors per minute
  criticalErrors: number;
  criticalErrorRate: number;
  topErrors: TrackedError[];
  errorsByType: Record<string, number>;
  errorsByOperation: Record<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class ErrorTrackingService {
  private errors: Map<string, TrackedError> = new Map();
  private errorCounts: Map<string, { count: number; timestamp: Date }> =
    new Map();
  private alertCallbacks: Array<(error: TrackedError) => void> = [];

  constructor(private readonly config: ErrorTrackingConfig) {
    this.startCleanupInterval();
  }

  /**
   * Track an error
   */
  trackError(
    error: Error,
    level: 'error' | 'fatal' | 'warning' = 'error',
    context?: ErrorContext
  ): string {
    const fingerprint = this.generateFingerprint(error, context);
    const errorId = this.generateErrorId();
    const now = new Date();

    let trackedError = this.errors.get(fingerprint);

    if (trackedError) {
      // Update existing error
      trackedError.count++;
      trackedError.lastSeen = now;
      trackedError.context = { ...trackedError.context, ...context };
    } else {
      // Create new tracked error
      trackedError = {
        id: errorId,
        timestamp: now,
        level,
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: (error as any).code,
        context,
        fingerprint,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        resolved: false,
        tags: this.generateTags(error, context),
        metadata: this.extractMetadata(error, context),
      };

      this.errors.set(fingerprint, trackedError);
    }

    // Log to console if enabled
    if (this.config.enableConsoleLogging) {
      this.logToConsole(trackedError);
    }

    // Update error rate tracking
    this.updateErrorRateTracking(level);

    // Check alert thresholds
    this.checkAlertThresholds();

    // Send to external service if configured
    if (this.config.enableExternalService && this.config.externalService) {
      this.sendToExternalService(trackedError).catch(err => {
        console.error('Failed to send error to external service:', err);
      });
    }

    // Trigger alert callbacks
    this.triggerAlertCallbacks(trackedError);

    // Cleanup old errors if memory limit exceeded
    this.cleanupOldErrors();

    return errorId;
  }

  /**
   * Track a custom error with message
   */
  trackCustomError(
    message: string,
    level: 'error' | 'fatal' | 'warning' = 'error',
    context?: ErrorContext,
    metadata?: Record<string, any>
  ): string {
    const error = new Error(message);
    error.name = 'CustomError';

    const fingerprint = this.generateFingerprint(error, context);
    const errorId = this.generateErrorId();
    const now = new Date();

    let trackedError = this.errors.get(fingerprint);

    if (trackedError) {
      trackedError.count++;
      trackedError.lastSeen = now;
      trackedError.context = { ...trackedError.context, ...context };
      trackedError.metadata = { ...trackedError.metadata, ...metadata };
    } else {
      trackedError = {
        id: errorId,
        timestamp: now,
        level,
        message,
        name: 'CustomError',
        context,
        fingerprint,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        resolved: false,
        tags: this.generateTags(error, context),
        metadata: { ...this.extractMetadata(error, context), ...metadata },
      };

      this.errors.set(fingerprint, trackedError);
    }

    if (this.config.enableConsoleLogging) {
      this.logToConsole(trackedError);
    }

    this.updateErrorRateTracking(level);
    this.checkAlertThresholds();

    if (this.config.enableExternalService && this.config.externalService) {
      this.sendToExternalService(trackedError).catch(err => {
        console.error('Failed to send error to external service:', err);
      });
    }

    this.triggerAlertCallbacks(trackedError);
    this.cleanupOldErrors();

    return errorId;
  }

  /**
   * Get error by ID
   */
  getError(errorId: string): TrackedError | undefined {
    for (const error of this.errors.values()) {
      if (error.id === errorId) {
        return error;
      }
    }
    return undefined;
  }

  /**
   * Get error by fingerprint
   */
  getErrorByFingerprint(fingerprint: string): TrackedError | undefined {
    return this.errors.get(fingerprint);
  }

  /**
   * Get all errors
   */
  getAllErrors(): TrackedError[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get errors by level
   */
  getErrorsByLevel(level: 'error' | 'fatal' | 'warning'): TrackedError[] {
    return Array.from(this.errors.values()).filter(
      error => error.level === level
    );
  }

  /**
   * Get error summary
   */
  getErrorSummary(timeRangeMinutes: number = 60): ErrorSummary {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeRangeMinutes * 60 * 1000);

    const recentErrors = Array.from(this.errors.values()).filter(
      error => error.lastSeen >= startTime
    );

    const totalErrors = recentErrors.reduce(
      (sum, error) => sum + error.count,
      0
    );
    const criticalErrors = recentErrors
      .filter(error => error.level === 'fatal')
      .reduce((sum, error) => sum + error.count, 0);

    const errorRate = totalErrors / timeRangeMinutes;
    const criticalErrorRate = criticalErrors / timeRangeMinutes;

    const errorsByType: Record<string, number> = {};
    const errorsByOperation: Record<string, number> = {};

    recentErrors.forEach(error => {
      errorsByType[error.name] = (errorsByType[error.name] || 0) + error.count;

      if (error.context?.operation) {
        errorsByOperation[error.context.operation] =
          (errorsByOperation[error.context.operation] || 0) + error.count;
      }
    });

    const topErrors = recentErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorRate,
      criticalErrors,
      criticalErrorRate,
      topErrors,
      errorsByType,
      errorsByOperation,
      timeRange: {
        start: startTime,
        end: now,
      },
    };
  }

  /**
   * Mark error as resolved
   */
  resolveError(fingerprint: string): boolean {
    const error = this.errors.get(fingerprint);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Add alert callback
   */
  onError(callback: (error: TrackedError) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  removeErrorCallback(callback: (error: TrackedError) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors.clear();
    this.errorCounts.clear();
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalUniqueErrors: number;
    totalErrorOccurrences: number;
    resolvedErrors: number;
    unresolvedErrors: number;
    errorsByLevel: Record<string, number>;
  } {
    const errors = Array.from(this.errors.values());
    const totalUniqueErrors = errors.length;
    const totalErrorOccurrences = errors.reduce(
      (sum, error) => sum + error.count,
      0
    );
    const resolvedErrors = errors.filter(error => error.resolved).length;
    const unresolvedErrors = errors.filter(error => !error.resolved).length;

    const errorsByLevel: Record<string, number> = {};
    errors.forEach(error => {
      errorsByLevel[error.level] =
        (errorsByLevel[error.level] || 0) + error.count;
    });

    return {
      totalUniqueErrors,
      totalErrorOccurrences,
      resolvedErrors,
      unresolvedErrors,
      errorsByLevel,
    };
  }

  private generateFingerprint(error: Error, context?: ErrorContext): string {
    const parts = [
      error.name,
      error.message,
      context?.operation || '',
      context?.resource || '',
    ];

    // Create a simple hash of the parts
    const combined = parts.join('|');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTags(error: Error, context?: ErrorContext): string[] {
    const tags: string[] = [];

    tags.push(`type:${error.name}`);

    if (context?.operation) {
      tags.push(`operation:${context.operation}`);
    }

    if (context?.resource) {
      tags.push(`resource:${context.resource}`);
    }

    if (context?.userId) {
      tags.push('has_user');
    }

    if (error.stack?.includes('node_modules')) {
      tags.push('external_library');
    }

    return tags;
  }

  private extractMetadata(
    error: Error,
    context?: ErrorContext
  ): Record<string, any> {
    const metadata: Record<string, any> = {
      errorType: error.constructor.name,
      hasStack: !!error.stack,
    };

    if (context?.url) {
      metadata.url = context.url;
    }

    if (context?.method) {
      metadata.httpMethod = context.method;
    }

    if (context?.userAgent) {
      metadata.userAgent = context.userAgent;
    }

    return metadata;
  }

  private logToConsole(error: TrackedError): void {
    const logLevel = error.level === 'fatal' ? 'error' : error.level;
    const logMethod = console[logLevel] || console.log;

    logMethod(`[${error.level.toUpperCase()}] ${error.message}`, {
      id: error.id,
      fingerprint: error.fingerprint,
      count: error.count,
      context: error.context,
      stack: error.stack,
    });
  }

  private updateErrorRateTracking(level: 'error' | 'fatal' | 'warning'): void {
    const now = new Date();
    const key = `${level}_${Math.floor(now.getTime() / 60000)}`; // Per minute

    const existing = this.errorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.errorCounts.set(key, { count: 1, timestamp: now });
    }

    // Clean up old counts (older than 1 hour)
    const oneHourAgo = now.getTime() - 60 * 60 * 1000;
    for (const [key, value] of this.errorCounts.entries()) {
      if (value.timestamp.getTime() < oneHourAgo) {
        this.errorCounts.delete(key);
      }
    }
  }

  private checkAlertThresholds(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Count errors in the last minute
    let errorCount = 0;
    let criticalErrorCount = 0;

    for (const [key, value] of this.errorCounts.entries()) {
      if (value.timestamp >= oneMinuteAgo) {
        if (key.startsWith('fatal_')) {
          criticalErrorCount += value.count;
        }
        errorCount += value.count;
      }
    }

    // Check thresholds and log alerts
    if (errorCount >= this.config.alertThresholds.errorRate) {
      console.warn(
        `High error rate detected: ${errorCount} errors in the last minute`
      );
    }

    if (criticalErrorCount >= this.config.alertThresholds.criticalErrorRate) {
      console.error(
        `High critical error rate detected: ${criticalErrorCount} critical errors in the last minute`
      );
    }
  }

  private async sendToExternalService(error: TrackedError): Promise<void> {
    if (!this.config.externalService) {
      return;
    }

    try {
      const payload = {
        projectId: this.config.externalService.projectId,
        error: {
          id: error.id,
          message: error.message,
          name: error.name,
          stack: error.stack,
          level: error.level,
          timestamp: error.timestamp.toISOString(),
          context: error.context,
          tags: error.tags,
          metadata: error.metadata,
        },
      };

      const response = await fetch(this.config.externalService.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.externalService.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `External service responded with status ${response.status}`
        );
      }
    } catch (error) {
      throw new InfrastructureError(
        `Failed to send error to external service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private triggerAlertCallbacks(error: TrackedError): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in alert callback:', err);
      }
    });
  }

  private cleanupOldErrors(): void {
    if (this.errors.size <= this.config.maxErrorsInMemory) {
      return;
    }

    const now = new Date();
    const retentionTime = this.config.errorRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - retentionTime);

    // Remove old errors
    for (const [fingerprint, error] of this.errors.entries()) {
      if (error.lastSeen < cutoffTime) {
        this.errors.delete(fingerprint);
      }
    }

    // If still over limit, remove oldest errors
    if (this.errors.size > this.config.maxErrorsInMemory) {
      const sortedErrors = Array.from(this.errors.entries()).sort(
        ([, a], [, b]) => a.lastSeen.getTime() - b.lastSeen.getTime()
      );

      const toRemove = this.errors.size - this.config.maxErrorsInMemory;
      for (let i = 0; i < toRemove; i++) {
        this.errors.delete(sortedErrors[i][0]);
      }
    }
  }

  private startCleanupInterval(): void {
    // Run cleanup every hour
    setInterval(
      () => {
        this.cleanupOldErrors();
      },
      60 * 60 * 1000
    );
  }
}
