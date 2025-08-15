export interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  level: 'error' | 'warning' | 'fatal';
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  fingerprint?: string;
  count: number;
}

export interface ErrorTrackingService {
  /**
   * Capture an error
   */
  captureError(error: Error, context?: Record<string, any>): Promise<string>;

  /**
   * Capture an exception with additional context
   */
  captureException(
    error: Error,
    level?: 'error' | 'warning' | 'fatal',
    context?: Record<string, any>
  ): Promise<string>;

  /**
   * Capture a message
   */
  captureMessage(
    message: string,
    level?: 'error' | 'warning' | 'info',
    context?: Record<string, any>
  ): Promise<string>;

  /**
   * Get error statistics
   */
  getErrorStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalErrors: number;
    uniqueErrors: number;
    errorsByLevel: Record<string, number>;
  }>;

  /**
   * Get recent errors
   */
  getRecentErrors(limit?: number): Promise<ErrorEvent[]>;
}

export class DefaultErrorTrackingService implements ErrorTrackingService {
  private errors: Map<string, ErrorEvent> = new Map();
  private errorFingerprints: Map<string, string[]> = new Map();

  async captureError(error: Error, context?: Record<string, any>): Promise<string> {
    return this.captureException(error, 'error', context);
  }

  async captureException(
    error: Error,
    level: 'error' | 'warning' | 'fatal' = 'error',
    context?: Record<string, any>
  ): Promise<string> {
    const fingerprint = this.generateFingerprint(error);
    const existingErrorIds = this.errorFingerprints.get(fingerprint) || [];
    
    let errorEvent: ErrorEvent;

    if (existingErrorIds.length > 0) {
      // Update existing error
      const existingId = existingErrorIds[0];
      const existing = this.errors.get(existingId);
      if (existing) {
        existing.count++;
        existing.timestamp = new Date();
        errorEvent = existing;
      } else {
        errorEvent = this.createErrorEvent(error, level, context, fingerprint);
      }
    } else {
      errorEvent = this.createErrorEvent(error, level, context, fingerprint);
    }

    this.errors.set(errorEvent.id, errorEvent);
    
    if (!existingErrorIds.includes(errorEvent.id)) {
      existingErrorIds.push(errorEvent.id);
      this.errorFingerprints.set(fingerprint, existingErrorIds);
    }

    // In a real implementation, this would send to external error tracking service
    console.error(`[${level.toUpperCase()}] ${error.message}`, {
      errorId: errorEvent.id,
      fingerprint,
      count: errorEvent.count,
      context,
    });

    return errorEvent.id;
  }

  async captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info' = 'info',
    context?: Record<string, any>
  ): Promise<string> {
    const error = new Error(message);
    return this.captureException(error, level === 'info' ? 'warning' : level, context);
  }

  async getErrorStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalErrors: number;
    uniqueErrors: number;
    errorsByLevel: Record<string, number>;
  }> {
    let errors = Array.from(this.errors.values());

    if (timeRange) {
      errors = errors.filter(
        error => error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
      );
    }

    const errorsByLevel = errors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: errors.reduce((sum, error) => sum + error.count, 0),
      uniqueErrors: errors.length,
      errorsByLevel,
    };
  }

  async getRecentErrors(limit: number = 50): Promise<ErrorEvent[]> {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private createErrorEvent(
    error: Error,
    level: 'error' | 'warning' | 'fatal',
    context?: Record<string, any>,
    fingerprint?: string
  ): ErrorEvent {
    return {
      id: this.generateErrorId(),
      message: error.message,
      stack: error.stack,
      level,
      timestamp: new Date(),
      metadata: context,
      fingerprint,
      count: 1,
    };
  }

  private generateFingerprint(error: Error): string {
    // Simple fingerprinting based on error message and first few stack frames
    const stackLines = error.stack?.split('\n').slice(0, 3).join('\n') || '';
    const content = `${error.message}${stackLines}`;
    
    // Simple hash function (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}