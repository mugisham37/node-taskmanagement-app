import { UserId } from '../value-objects/UserId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface AuditLogEntry {
  id: string;
  userId?: UserId;
  workspaceId?: WorkspaceId;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data' | 'system' | 'security';
  outcome: 'success' | 'failure' | 'error';
  riskScore?: number;
}

export interface SecurityEvent {
  type: string;
  userId?: UserId;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditQuery {
  userId?: UserId;
  workspaceId?: WorkspaceId;
  action?: string;
  resource?: string;
  category?: string;
  severity?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  criticalEvents: number;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  riskDistribution: Record<string, number>;
}

export class SecurityEventDetectedEvent extends DomainEvent {
  constructor(
    public readonly eventType: string,
    public readonly severity: string,
    public readonly userId: UserId | undefined,
    public readonly details: Record<string, any>
  ) {
    super('SecurityEventDetected', {
      eventType,
      severity,
      userId: userId?.value,
      details,
    });
  }
}

export class AuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: string,
    public readonly action: string,
    public readonly resource: string,
    public readonly userId: UserId | undefined
  ) {
    super('AuditLogCreated', {
      auditLogId,
      action,
      resource,
      userId: userId?.value,
    });
  }
}

/**
 * Comprehensive Audit Logging Service
 * Tracks all security-relevant events and provides audit trails
 */
export class AuditLoggingService {
  constructor(
    private readonly auditLogRepository: any,
    private readonly securityEventRepository: any,
    private readonly eventBus: any,
    private readonly config: {
      retentionDays: number;
      enableRealTimeAlerts: boolean;
      criticalEventThreshold: number;
    }
  ) {}

  /**
   * Log authentication event
   */
  async logAuthenticationEvent(
    action:
      | 'login'
      | 'logout'
      | 'login_failed'
      | 'mfa_required'
      | 'mfa_success'
      | 'mfa_failed',
    userId: UserId | undefined,
    details: {
      email?: string;
      method?: string;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      riskScore?: number;
    }
  ): Promise<void> {
    const severity = this.getAuthenticationSeverity(action, details);
    const outcome = this.getAuthenticationOutcome(action);

    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      userId,
      action,
      resource: 'authentication',
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      sessionId: details.sessionId,
      timestamp: new Date(),
      severity,
      category: 'authentication',
      outcome,
      riskScore: details.riskScore,
    };

    await this.createAuditLog(auditEntry);

    // Check for security events
    if (severity === 'high' || severity === 'critical') {
      await this.recordSecurityEvent({
        type: `authentication_${action}`,
        userId,
        severity,
        details,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Log authorization event
   */
  async logAuthorizationEvent(
    action:
      | 'permission_granted'
      | 'permission_denied'
      | 'role_assigned'
      | 'role_revoked',
    userId: UserId,
    details: {
      permission?: string;
      resource?: string;
      resourceId?: string;
      workspaceId?: WorkspaceId;
      roleId?: string;
      assignedBy?: UserId;
      ipAddress?: string;
      userAgent?: string;
      requestPath?: string;
    }
  ): Promise<void> {
    const severity = this.getAuthorizationSeverity(action, details);
    const outcome = action.includes('denied') ? 'failure' : 'success';

    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      userId,
      workspaceId: details.workspaceId,
      action,
      resource: details.resource || 'authorization',
      resourceId: details.resourceId,
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: new Date(),
      severity,
      category: 'authorization',
      outcome,
    };

    await this.createAuditLog(auditEntry);

    // Log repeated permission denials as security events
    if (action === 'permission_denied') {
      await this.checkForRepeatedDenials(userId, details);
    }
  }

  /**
   * Log data access event
   */
  async logDataAccessEvent(
    action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
    userId: UserId,
    resource: string,
    resourceId: string,
    details: {
      workspaceId?: WorkspaceId;
      changes?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    const severity = this.getDataAccessSeverity(action, resource, details);
    const outcome = 'success'; // Assume success if we're logging it

    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      userId,
      workspaceId: details.workspaceId,
      action,
      resource,
      resourceId,
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      sessionId: details.sessionId,
      timestamp: new Date(),
      severity,
      category: 'data',
      outcome,
    };

    await this.createAuditLog(auditEntry);

    // Log sensitive data operations
    if (this.isSensitiveDataOperation(action, resource)) {
      await this.recordSecurityEvent({
        type: `sensitive_data_${action}`,
        userId,
        severity,
        details: {
          resource,
          resourceId,
          ...details,
        },
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Log system event
   */
  async logSystemEvent(
    action: string,
    details: {
      userId?: UserId;
      component?: string;
      error?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const severity = this.getSystemEventSeverity(action, details);
    const outcome = details.error ? 'error' : 'success';

    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      userId: details.userId,
      action,
      resource: 'system',
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: new Date(),
      severity,
      category: 'system',
      outcome,
    };

    await this.createAuditLog(auditEntry);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType: string,
    userId: UserId | undefined,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ): Promise<void> {
    await this.recordSecurityEvent({
      type: eventType,
      userId,
      severity,
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: new Date(),
    });

    // Also create audit log entry
    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      userId,
      action: eventType,
      resource: 'security',
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: new Date(),
      severity,
      category: 'security',
      outcome: 'success',
    };

    await this.createAuditLog(auditEntry);
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(query: AuditQuery): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const result = await this.auditLogRepository.query(query);

      return {
        logs: result.logs,
        total: result.total,
        hasMore: result.hasMore,
      };
    } catch (error) {
      console.error('Audit log query failed:', error);
      return {
        logs: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Get audit summary
   */
  async getAuditSummary(
    startDate: Date,
    endDate: Date,
    workspaceId?: WorkspaceId
  ): Promise<AuditSummary> {
    try {
      return await this.auditLogRepository.getSummary(
        startDate,
        endDate,
        workspaceId
      );
    } catch (error) {
      console.error('Audit summary generation failed:', error);
      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        criticalEvents: 0,
        topActions: [],
        topUsers: [],
        riskDistribution: {},
      };
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(
    startDate: Date,
    endDate: Date,
    severity?: string
  ): Promise<SecurityEvent[]> {
    try {
      return await this.securityEventRepository.query({
        startDate,
        endDate,
        severity,
      });
    } catch (error) {
      console.error('Security events query failed:', error);
      return [];
    }
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    query: AuditQuery,
    format: 'json' | 'csv' | 'xlsx' = 'json'
  ): Promise<Buffer> {
    try {
      const logs = await this.auditLogRepository.queryAll(query);

      switch (format) {
        case 'csv':
          return this.exportToCsv(logs);
        case 'xlsx':
          return this.exportToXlsx(logs);
        default:
          return Buffer.from(JSON.stringify(logs, null, 2));
      }
    } catch (error) {
      throw new Error(`Audit log export failed: ${error.message}`);
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const deletedCount =
        await this.auditLogRepository.deleteOlderThan(cutoffDate);

      await this.logSystemEvent('audit_cleanup', {
        details: { deletedCount, cutoffDate },
      });

      return deletedCount;
    } catch (error) {
      console.error('Audit log cleanup failed:', error);
      return 0;
    }
  }

  // Private helper methods

  private async createAuditLog(
    entry: Omit<AuditLogEntry, 'id'>
  ): Promise<void> {
    try {
      const auditLog = await this.auditLogRepository.create(entry);

      await this.eventBus.publish(
        new AuditLogCreatedEvent(
          auditLog.id,
          entry.action,
          entry.resource,
          entry.userId
        )
      );
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  private async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await this.securityEventRepository.create(event);

      await this.eventBus.publish(
        new SecurityEventDetectedEvent(
          event.type,
          event.severity,
          event.userId,
          event.details
        )
      );

      // Send real-time alerts for critical events
      if (this.config.enableRealTimeAlerts && event.severity === 'critical') {
        await this.sendCriticalEventAlert(event);
      }
    } catch (error) {
      console.error('Failed to record security event:', error);
    }
  }

  private getAuthenticationSeverity(
    action: string,
    details: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (action) {
      case 'login':
        return details.riskScore > 0.8 ? 'high' : 'low';
      case 'login_failed':
        return 'medium';
      case 'mfa_failed':
        return 'high';
      case 'logout':
        return 'low';
      default:
        return 'medium';
    }
  }

  private getAuthenticationOutcome(
    action: string
  ): 'success' | 'failure' | 'error' {
    if (action.includes('failed')) {
      return 'failure';
    }
    return 'success';
  }

  private getAuthorizationSeverity(
    action: string,
    details: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (action === 'permission_denied') {
      return details.permission?.includes('admin') ? 'high' : 'medium';
    }
    if (action === 'role_assigned' && details.roleId?.includes('admin')) {
      return 'high';
    }
    return 'low';
  }

  private getDataAccessSeverity(
    action: string,
    resource: string,
    details: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (action === 'delete' || action === 'export') {
      return 'high';
    }
    if (this.isSensitiveResource(resource)) {
      return 'medium';
    }
    return 'low';
  }

  private getSystemEventSeverity(
    action: string,
    details: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (details.error) {
      return action.includes('security') ? 'critical' : 'high';
    }
    return 'low';
  }

  private isSensitiveDataOperation(action: string, resource: string): boolean {
    const sensitiveActions = ['delete', 'export'];
    const sensitiveResources = ['user', 'workspace', 'payment'];

    return (
      sensitiveActions.includes(action) || sensitiveResources.includes(resource)
    );
  }

  private isSensitiveResource(resource: string): boolean {
    const sensitiveResources = ['user', 'workspace', 'payment', 'integration'];
    return sensitiveResources.includes(resource);
  }

  private async checkForRepeatedDenials(
    userId: UserId,
    details: any
  ): Promise<void> {
    try {
      const recentDenials = await this.auditLogRepository.countRecentEvents(
        userId,
        'permission_denied',
        new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      );

      if (recentDenials >= 5) {
        await this.recordSecurityEvent({
          type: 'repeated_permission_denials',
          userId,
          severity: 'high',
          details: {
            denialCount: recentDenials,
            lastDenial: details,
          },
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to check repeated denials:', error);
    }
  }

  private async sendCriticalEventAlert(event: SecurityEvent): Promise<void> {
    // TODO: Implement real-time alerting (email, Slack, etc.)
    console.warn('CRITICAL SECURITY EVENT:', event);
  }

  private exportToCsv(logs: AuditLogEntry[]): Buffer {
    // TODO: Implement CSV export
    const csv = logs
      .map(log =>
        [
          log.timestamp.toISOString(),
          log.userId?.value || '',
          log.action,
          log.resource,
          log.outcome,
          log.severity,
          log.ipAddress || '',
        ].join(',')
      )
      .join('\n');

    const header =
      'Timestamp,User ID,Action,Resource,Outcome,Severity,IP Address\n';
    return Buffer.from(header + csv);
  }

  private exportToXlsx(logs: AuditLogEntry[]): Buffer {
    // TODO: Implement XLSX export using a library like xlsx
    return Buffer.from(JSON.stringify(logs));
  }
}
