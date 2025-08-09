import { LoggingService } from '../monitoring/logging-service';

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

export interface AuditEvent {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  details?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export class AuditLogger {
  constructor(private readonly logger: LoggingService) {}

  /**
   * Log an audit event
   */
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
      userId: auditEvent.userId,
      sessionId: auditEvent.sessionId,
      ipAddress: auditEvent.ipAddress,
      userAgent: auditEvent.userAgent,
      resource: auditEvent.resource,
      action: auditEvent.action,
      outcome: auditEvent.outcome,
      details: auditEvent.details,
      timestamp: auditEvent.timestamp.toISOString(),
      requestId: auditEvent.requestId,
    });

    // For critical events, also log as error for immediate attention
    if (event.severity === AuditSeverity.CRITICAL) {
      this.logger.error('Critical security event detected', {
        eventType: auditEvent.eventType,
        details: auditEvent.details,
      });
    }
  }

  /**
   * Log authentication success
   */
  logAuthenticationSuccess(context: AuditContext): void {
    this.logEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      severity: AuditSeverity.LOW,
      outcome: 'SUCCESS',
      ...context,
    });
  }

  /**
   * Log authentication failure
   */
  logAuthenticationFailure(context: AuditContext, reason?: string): void {
    this.logEvent({
      eventType: AuditEventType.LOGIN_FAILURE,
      severity: AuditSeverity.MEDIUM,
      outcome: 'FAILURE',
      details: { reason },
      ...context,
    });
  }

  /**
   * Log access denied
   */
  logAccessDenied(
    context: AuditContext,
    resource: string,
    action: string,
    reason?: string
  ): void {
    this.logEvent({
      eventType: AuditEventType.ACCESS_DENIED,
      severity: AuditSeverity.MEDIUM,
      outcome: 'BLOCKED',
      resource,
      action,
      details: { reason },
      ...context,
    });
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
      severity: AuditSeverity.HIGH,
      outcome: 'BLOCKED',
      details: { limit, window },
      ...context,
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    context: AuditContext,
    activity: string,
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.HIGH,
      outcome: 'BLOCKED',
      details: { activity, ...details },
      ...context,
    });
  }

  /**
   * Log XSS attempt
   */
  logXSSAttempt(context: AuditContext, payload: string, field?: string): void {
    this.logEvent({
      eventType: AuditEventType.XSS_ATTEMPT,
      severity: AuditSeverity.CRITICAL,
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
      severity: AuditSeverity.CRITICAL,
      outcome: 'BLOCKED',
      details: {
        payload: payload.substring(0, 200), // Limit payload size in logs
        field,
      },
      ...context,
    });
  }

  /**
   * Log data access
   */
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
      severity: sensitive ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
      outcome: 'SUCCESS',
      resource,
      action,
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
      severity: AuditSeverity.MEDIUM,
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
      severity: AuditSeverity.MEDIUM,
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
      severity: AuditSeverity.HIGH,
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
      severity: AuditSeverity.HIGH,
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
      severity: AuditSeverity.HIGH,
      outcome: 'FAILURE',
      details: {
        error: error.message,
        stack: error.stack,
        ...details,
      },
      ...context,
    });
  }

  private getLogLevel(severity: AuditSeverity): string {
    switch (severity) {
      case AuditSeverity.LOW:
        return 'info';
      case AuditSeverity.MEDIUM:
        return 'warn';
      case AuditSeverity.HIGH:
      case AuditSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }
}
