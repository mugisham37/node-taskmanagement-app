import { AuditContext, AuditEvent, AuditLoggingService } from './interfaces';

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',

  // Authorization events
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_ESCALATION = 'PERMISSION_ESCALATION',
  ROLE_CHANGE = 'ROLE_CHANGE',

  // Data access events
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  DATA_DELETION = 'DATA_DELETION',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',

  // Security events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  INPUT_SANITIZATION = 'INPUT_SANITIZATION',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',

  // Administrative events
  USER_CREATED = 'USER_CREATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',

  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SERVICE_START = 'SERVICE_START',
  SERVICE_STOP = 'SERVICE_STOP',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface LoggingService {
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
  log(level: string, message: string, context?: any): void;
}

export class DefaultAuditLogger implements AuditLoggingService {
  readonly name = 'audit-logger';

  constructor(private readonly logger: LoggingService) {}

  logEvent(event: Omit<AuditEvent, 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Log with appropriate level based on severity
    const logLevel = this.getLogLevel(event.severity);

    this.logger.log(logLevel, 'Audit Event', {
      audit: true,
      eventType: auditEvent.eventType,
      severity: auditEvent.severity,
      userId: auditEvent.userId || undefined,
      sessionId: auditEvent.sessionId || undefined,
      ipAddress: auditEvent.ipAddress || undefined,
      userAgent: auditEvent.userAgent || undefined,
      resource: auditEvent.resource || undefined,
      action: auditEvent.action || undefined,
      outcome: auditEvent.outcome,
      details: auditEvent.details || undefined,
      timestamp: auditEvent.timestamp.toISOString(),
      requestId: auditEvent.requestId || undefined,
    });

    // For critical events, also log as error for immediate attention
    if (event.severity === 'CRITICAL') {
      this.logger.error('Critical security event detected', undefined, {
        eventType: auditEvent.eventType,
        details: auditEvent.details,
      });
    }
  }

  logAuthenticationSuccess(context: AuditContext): void {
    this.logEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      severity: 'LOW',
      outcome: 'SUCCESS',
      ...context,
    });
  }

  logAuthenticationFailure(context: AuditContext, reason?: string): void {
    this.logEvent({
      eventType: AuditEventType.LOGIN_FAILURE,
      severity: 'MEDIUM',
      outcome: 'FAILURE',
      details: { reason },
      ...context,
    });
  }

  logAccessDenied(
    context: AuditContext,
    resource: string,
    action: string,
    reason?: string
  ): void {
    this.logEvent({
      eventType: AuditEventType.ACCESS_DENIED,
      severity: 'MEDIUM',
      outcome: 'BLOCKED',
      resource,
      action,
      details: { reason },
      ...context,
    });
  }

  logSuspiciousActivity(
    context: AuditContext,
    activity: string,
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: 'HIGH',
      outcome: 'BLOCKED',
      details: { activity, ...details },
      ...context,
    });
  }

  logDataAccess(
    context: AuditContext,
    resource: string,
    action: string,
    sensitive: boolean = false
  ): void {
    this.logEvent({
      eventType: sensitive
        ? AuditEventType.SENSITIVE_DATA_ACCESS
        : AuditEventType.DATA_ACCESS,
      severity: sensitive ? 'MEDIUM' : 'LOW',
      outcome: 'SUCCESS',
      resource,
      action,
      ...context,
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test if we can log an event
      this.logEvent({
        eventType: AuditEventType.SYSTEM_ERROR,
        severity: 'LOW',
        outcome: 'SUCCESS',
        details: { test: 'health-check' },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const isHealthy = await this.isHealthy();
    return {
      healthy: isHealthy,
      logger: this.logger ? 'configured' : 'missing',
    };
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(
    context: AuditContext,
    limit: number,
    window: number
  ): void {
    this.logEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      severity: 'HIGH',
      outcome: 'BLOCKED',
      details: { limit, window },
      ...context,
    });
  }

  /**
   * Log XSS attempt
   */
  logXSSAttempt(context: AuditContext, payload: string, field?: string): void {
    this.logEvent({
      eventType: AuditEventType.XSS_ATTEMPT,
      severity: 'CRITICAL',
      outcome: 'BLOCKED',
      details: {
        payload: payload.substring(0, 200), // Limit payload size in logs
        field,
      },
      ...context,
    });
  }

  /**
   * Log SQL injection attempt
   */
  logSQLInjectionAttempt(
    context: AuditContext,
    payload: string,
    field?: string
  ): void {
    this.logEvent({
      eventType: AuditEventType.SQL_INJECTION_ATTEMPT,
      severity: 'CRITICAL',
      outcome: 'BLOCKED',
      details: {
        payload: payload.substring(0, 200), // Limit payload size in logs
        field,
      },
      ...context,
    });
  }

  /**
   * Log data modification
   */
  logDataModification(
    context: AuditContext,
    resource: string,
    action: string,
    changes?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.DATA_MODIFICATION,
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      resource,
      action,
      details: { changes },
      ...context,
    });
  }

  /**
   * Log password change
   */
  logPasswordChange(context: AuditContext, forced: boolean = false): void {
    this.logEvent({
      eventType: AuditEventType.PASSWORD_CHANGE,
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      details: { forced },
      ...context,
    });
  }

  /**
   * Log role change
   */
  logRoleChange(
    context: AuditContext,
    targetUserId: string,
    oldRole: string,
    newRole: string
  ): void {
    this.logEvent({
      eventType: AuditEventType.ROLE_CHANGE,
      severity: 'HIGH',
      outcome: 'SUCCESS',
      details: { targetUserId, oldRole, newRole },
      ...context,
    });
  }

  /**
   * Log configuration change
   */
  logConfigurationChange(
    context: AuditContext,
    configKey: string,
    oldValue?: any,
    newValue?: any
  ): void {
    this.logEvent({
      eventType: AuditEventType.CONFIGURATION_CHANGE,
      severity: 'HIGH',
      outcome: 'SUCCESS',
      details: { configKey, oldValue, newValue },
      ...context,
    });
  }

  /**
   * Log system error
   */
  logSystemError(
    error: Error,
    context?: AuditContext,
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.SYSTEM_ERROR,
      severity: 'HIGH',
      outcome: 'FAILURE',
      details: {
        error: error.message,
        stack: error.stack,
        ...details,
      },
      ...context,
    });
  }

  private getLogLevel(severity: string): string {
    switch (severity) {
      case 'LOW':
        return 'info';
      case 'MEDIUM':
        return 'warn';
      case 'HIGH':
      case 'CRITICAL':
        return 'error';
      default:
        return 'info';
    }
  }
}