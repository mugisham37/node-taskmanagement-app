import { Logger } from 'winston';
import { StructuredLogger } from './structured-logger';

export interface AuditEvent {
  eventType: string;
  actor: {
    userId: string;
    userRole?: string;
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id?: string;
    name?: string;
  };
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  timestamp: Date;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditLoggerConfig {
  enabled: boolean;
  logLevel: string;
  includeStackTrace: boolean;
  sensitiveFields: string[];
  retentionDays: number;
}

export class AuditLogger {
  private logger: Logger;
  private config: AuditLoggerConfig;

  constructor(
    private structuredLogger: StructuredLogger,
    config: Partial<AuditLoggerConfig> = {}
  ) {
    this.config = {
      enabled: true,
      logLevel: 'info',
      includeStackTrace: false,
      sensitiveFields: ['password', 'token', 'secret', 'key'],
      retentionDays: 365,
      ...config,
    };

    this.logger = this.structuredLogger.getLogger();
  }

  public logAuditEvent(event: AuditEvent): void {
    if (!this.config.enabled) return;

    // Sanitize sensitive data
    const sanitizedEvent = this.sanitizeEvent(event);

    // Log the audit event
    this.logger.log(this.config.logLevel, 'Audit event', {
      eventType: 'audit',
      auditEvent: sanitizedEvent,
      timestamp: event.timestamp.toISOString(),
    });
  }

  public logUserAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    outcome: 'success' | 'failure' | 'partial' = 'success',
    details?: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const event: AuditEvent = {
      eventType: 'user_action',
      actor: {
        userId,
        userRole: metadata?.userRole,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      },
      resource: {
        type: resourceType,
        id: resourceId,
        name: metadata?.resourceName,
      },
      action,
      outcome,
      timestamp: new Date(),
      details,
      metadata,
    };

    this.logAuditEvent(event);
  }

  public logSystemEvent(
    action: string,
    resourceType: string,
    resourceId?: string,
    outcome: 'success' | 'failure' | 'partial' = 'success',
    details?: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const event: AuditEvent = {
      eventType: 'system_event',
      actor: {
        userId: 'system',
        userRole: 'system',
      },
      resource: {
        type: resourceType,
        id: resourceId,
        name: metadata?.resourceName,
      },
      action,
      outcome,
      timestamp: new Date(),
      details,
      metadata,
    };

    this.logAuditEvent(event);
  }

  public logSecurityEvent(
    action: string,
    userId: string,
    ip?: string,
    userAgent?: string,
    outcome: 'success' | 'failure' | 'partial' = 'failure',
    details?: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const event: AuditEvent = {
      eventType: 'security_event',
      actor: {
        userId,
        userRole: metadata?.userRole,
        ip,
        userAgent,
      },
      resource: {
        type: 'security',
        id: metadata?.resourceId,
        name: metadata?.resourceName,
      },
      action,
      outcome,
      timestamp: new Date(),
      details,
      metadata,
    };

    this.logAuditEvent(event);
  }

  public logDataAccess(
    userId: string,
    dataType: string,
    dataId?: string,
    action: string = 'read',
    outcome: 'success' | 'failure' | 'partial' = 'success',
    details?: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const event: AuditEvent = {
      eventType: 'data_access',
      actor: {
        userId,
        userRole: metadata?.userRole,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      },
      resource: {
        type: dataType,
        id: dataId,
        name: metadata?.resourceName,
      },
      action,
      outcome,
      timestamp: new Date(),
      details,
      metadata,
    };

    this.logAuditEvent(event);
  }

  public logAdminAction(
    adminId: string,
    action: string,
    targetType: string,
    targetId?: string,
    outcome: 'success' | 'failure' | 'partial' = 'success',
    details?: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const event: AuditEvent = {
      eventType: 'admin_action',
      actor: {
        userId: adminId,
        userRole: metadata?.adminRole || 'admin',
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      },
      resource: {
        type: targetType,
        id: targetId,
        name: metadata?.targetName,
      },
      action,
      outcome,
      timestamp: new Date(),
      details,
      metadata,
    };

    this.logAuditEvent(event);
  }

  private sanitizeEvent(event: AuditEvent): AuditEvent {
    const sanitized = JSON.parse(JSON.stringify(event));

    // Recursively sanitize sensitive fields
    this.sanitizeObject(sanitized);

    return sanitized;
  }

  private sanitizeObject(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (this.config.sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.sanitizeObject(obj[key]);
      }
    }
  }

  // Query methods for audit log analysis
  public async queryAuditLogs(
    query: {
      eventType?: string;
      userId?: string;
      resourceType?: string;
      action?: string;
      outcome?: 'success' | 'failure' | 'partial';
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<AuditEvent[]> {
    // This would integrate with your log storage system
    // For now, return empty array
    return [];
  }

  public async getAuditTrail(
    resourceType: string,
    resourceId: string,
    limit: number = 100
  ): Promise<AuditEvent[]> {
    // This would get the audit trail for a specific resource
    return [];
  }

  public async getUserActivity(
    userId: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<AuditEvent[]> {
    // This would get all activity for a specific user
    return [];
  }

  public getConfig(): AuditLoggerConfig {
    return { ...this.config };
  }
}

export default AuditLogger;