import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

export interface FileAuditEvent {
  id: string;
  fileId: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  workspaceId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'access' | 'modification' | 'sharing' | 'security' | 'workflow';
}

export interface FileAuditQuery {
  fileId?: string;
  userId?: string;
  workspaceId?: string;
  actions?: string[];
  categories?: string[];
  severities?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface FileAuditReport {
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    uniqueFiles: number;
    topActions: Array<{ action: string; count: number }>;
    securityEvents: number;
  };
  events: FileAuditEvent[];
  trends: {
    dailyActivity: Array<{ date: string; count: number }>;
    userActivity: Array<{ userId: string; count: number }>;
    actionDistribution: Array<{ action: string; count: number }>;
  };
}

export interface FileSecurityAlert {
  id: string;
  fileId: string;
  userId: string;
  alertType:
    | 'suspicious_access'
    | 'bulk_download'
    | 'permission_escalation'
    | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: Record<string, any>;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class FileAuditService {
  private auditEvents: Map<string, FileAuditEvent> = new Map();
  private securityAlerts: Map<string, FileSecurityAlert> = new Map();

  async logFileEvent(
    fileId: string,
    userId: string,
    action: string,
    details: Record<string, any>,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      workspaceId: string;
    }
  ): Promise<void> {
    try {
      const event: FileAuditEvent = {
        id: crypto.randomUUID(),
        fileId,
        userId,
        action,
        details,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        sessionId: context?.sessionId,
        workspaceId: context?.workspaceId || '',
        timestamp: new Date(),
        severity: this.determineSeverity(action, details),
        category: this.categorizeAction(action),
      };

      // Store event (in real implementation, this would go to database)
      this.auditEvents.set(event.id, event);

      // Check for security anomalies
      await this.analyzeForSecurityThreats(event);

      // Log to system logger
      logger.info('File audit event logged', {
        eventId: event.id,
        fileId,
        userId,
        action,
        severity: event.severity,
        category: event.category,
      });

      // Send to external audit systems if configured
      await this.sendToExternalAuditSystems(event);
    } catch (error) {
      logger.error('Failed to log file audit event', {
        fileId,
        userId,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async queryAuditEvents(query: FileAuditQuery): Promise<FileAuditEvent[]> {
    try {
      let events = Array.from(this.auditEvents.values());

      // Apply filters
      if (query.fileId) {
        events = events.filter(e => e.fileId === query.fileId);
      }

      if (query.userId) {
        events = events.filter(e => e.userId === query.userId);
      }

      if (query.workspaceId) {
        events = events.filter(e => e.workspaceId === query.workspaceId);
      }

      if (query.actions && query.actions.length > 0) {
        events = events.filter(e => query.actions!.includes(e.action));
      }

      if (query.categories && query.categories.length > 0) {
        events = events.filter(e => query.categories!.includes(e.category));
      }

      if (query.severities && query.severities.length > 0) {
        events = events.filter(e => query.severities!.includes(e.severity));
      }

      if (query.dateRange) {
        events = events.filter(
          e =>
            e.timestamp >= query.dateRange!.from &&
            e.timestamp <= query.dateRange!.to
        );
      }

      if (query.ipAddress) {
        events = events.filter(e => e.ipAddress === query.ipAddress);
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      events = events.slice(offset, offset + limit);

      return events;
    } catch (error) {
      logger.error('Failed to query audit events', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async generateAuditReport(query: FileAuditQuery): Promise<FileAuditReport> {
    try {
      const events = await this.queryAuditEvents({
        ...query,
        limit: undefined,
        offset: undefined,
      });

      // Generate summary
      const uniqueUsers = new Set(events.map(e => e.userId)).size;
      const uniqueFiles = new Set(events.map(e => e.fileId)).size;
      const securityEvents = events.filter(
        e => e.severity === 'high' || e.severity === 'critical'
      ).length;

      // Count actions
      const actionCounts = new Map<string, number>();
      events.forEach(e => {
        actionCounts.set(e.action, (actionCounts.get(e.action) || 0) + 1);
      });

      const topActions = Array.from(actionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      // Generate daily activity trend
      const dailyActivity = this.generateDailyActivityTrend(events);

      // Generate user activity
      const userCounts = new Map<string, number>();
      events.forEach(e => {
        userCounts.set(e.userId, (userCounts.get(e.userId) || 0) + 1);
      });

      const userActivity = Array.from(userCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([userId, count]) => ({ userId, count }));

      // Generate action distribution
      const actionDistribution = Array.from(actionCounts.entries()).map(
        ([action, count]) => ({ action, count })
      );

      const report: FileAuditReport = {
        summary: {
          totalEvents: events.length,
          uniqueUsers,
          uniqueFiles,
          topActions,
          securityEvents,
        },
        events: events.slice(0, query.limit || 100),
        trends: {
          dailyActivity,
          userActivity,
          actionDistribution,
        },
      };

      logger.info('Audit report generated', {
        totalEvents: events.length,
        uniqueUsers,
        uniqueFiles,
        securityEvents,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate audit report', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getSecurityAlerts(
    workspaceId?: string,
    status?: string,
    severity?: string
  ): Promise<FileSecurityAlert[]> {
    try {
      let alerts = Array.from(this.securityAlerts.values());

      if (workspaceId) {
        // Filter by workspace (would need to join with file data)
        // alerts = alerts.filter(a => a.workspaceId === workspaceId);
      }

      if (status) {
        alerts = alerts.filter(a => a.status === status);
      }

      if (severity) {
        alerts = alerts.filter(a => a.severity === severity);
      }

      // Sort by creation date (newest first)
      alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return alerts;
    } catch (error) {
      logger.error('Failed to get security alerts', {
        workspaceId,
        status,
        severity,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async resolveSecurityAlert(
    alertId: string,
    userId: string,
    resolution: 'resolved' | 'false_positive'
  ): Promise<void> {
    try {
      const alert = this.securityAlerts.get(alertId);
      if (!alert) {
        throw new Error('Security alert not found');
      }

      alert.status = resolution;
      alert.resolvedAt = new Date();
      alert.resolvedBy = userId;

      this.securityAlerts.set(alertId, alert);

      logger.info('Security alert resolved', {
        alertId,
        userId,
        resolution,
        alertType: alert.alertType,
      });
    } catch (error) {
      logger.error('Failed to resolve security alert', {
        alertId,
        userId,
        resolution,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async exportAuditData(
    query: FileAuditQuery,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<string> {
    try {
      const events = await this.queryAuditEvents(query);

      switch (format) {
        case 'json':
          return JSON.stringify(events, null, 2);

        case 'csv':
          return this.convertToCsv(events);

        case 'xml':
          return this.convertToXml(events);

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error('Failed to export audit data', {
        query,
        format,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async validateDataIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    totalEvents: number;
    checkedEvents: number;
  }> {
    try {
      const events = Array.from(this.auditEvents.values());
      const issues: string[] = [];

      let checkedEvents = 0;

      for (const event of events) {
        checkedEvents++;

        // Check required fields
        if (!event.id || !event.fileId || !event.userId || !event.action) {
          issues.push(`Event ${event.id} missing required fields`);
        }

        // Check timestamp validity
        if (!event.timestamp || event.timestamp > new Date()) {
          issues.push(`Event ${event.id} has invalid timestamp`);
        }

        // Check severity values
        if (!['low', 'medium', 'high', 'critical'].includes(event.severity)) {
          issues.push(
            `Event ${event.id} has invalid severity: ${event.severity}`
          );
        }

        // Check category values
        if (
          ![
            'access',
            'modification',
            'sharing',
            'security',
            'workflow',
          ].includes(event.category)
        ) {
          issues.push(
            `Event ${event.id} has invalid category: ${event.category}`
          );
        }
      }

      const result = {
        isValid: issues.length === 0,
        issues,
        totalEvents: events.length,
        checkedEvents,
      };

      logger.info('Data integrity validation completed', result);

      return result;
    } catch (error) {
      logger.error('Failed to validate data integrity', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Private helper methods
  private determineSeverity(
    action: string,
    details: Record<string, any>
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Define severity based on action type and context
    const highSeverityActions = [
      'file_deleted_permanently',
      'permissions_changed',
      'file_shared_externally',
      'bulk_download',
      'admin_access_granted',
    ];

    const criticalSeverityActions = [
      'security_breach_detected',
      'unauthorized_access_attempt',
      'malware_detected',
      'data_exfiltration_suspected',
    ];

    if (criticalSeverityActions.includes(action)) {
      return 'critical';
    }

    if (highSeverityActions.includes(action)) {
      return 'high';
    }

    if (action.includes('delete') || action.includes('share')) {
      return 'medium';
    }

    return 'low';
  }

  private categorizeAction(
    action: string
  ): 'access' | 'modification' | 'sharing' | 'security' | 'workflow' {
    if (
      action.includes('access') ||
      action.includes('view') ||
      action.includes('download')
    ) {
      return 'access';
    }

    if (action.includes('share') || action.includes('permission')) {
      return 'sharing';
    }

    if (
      action.includes('security') ||
      action.includes('breach') ||
      action.includes('malware')
    ) {
      return 'security';
    }

    if (
      action.includes('workflow') ||
      action.includes('approval') ||
      action.includes('review')
    ) {
      return 'workflow';
    }

    return 'modification';
  }

  private async analyzeForSecurityThreats(
    event: FileAuditEvent
  ): Promise<void> {
    try {
      // Detect suspicious patterns
      const recentEvents = Array.from(this.auditEvents.values()).filter(
        e =>
          e.userId === event.userId &&
          e.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      );

      // Check for bulk downloads
      const downloadEvents = recentEvents.filter(e =>
        e.action.includes('download')
      );
      if (downloadEvents.length > 10) {
        await this.createSecurityAlert(
          event.fileId,
          event.userId,
          'bulk_download',
          'high',
          'User performed excessive downloads in short time period',
          { downloadCount: downloadEvents.length, timeWindow: '1 hour' }
        );
      }

      // Check for unusual access patterns
      const accessEvents = recentEvents.filter(e =>
        e.action.includes('access')
      );
      const uniqueFiles = new Set(accessEvents.map(e => e.fileId));
      if (uniqueFiles.size > 50) {
        await this.createSecurityAlert(
          event.fileId,
          event.userId,
          'unusual_activity',
          'medium',
          'User accessed unusually high number of files',
          { fileCount: uniqueFiles.size, timeWindow: '1 hour' }
        );
      }

      // Check for permission escalation
      if (event.action.includes('permission') && event.details.newPermissions) {
        const oldPermissions = event.details.oldPermissions || [];
        const newPermissions = event.details.newPermissions || [];

        if (newPermissions.length > oldPermissions.length) {
          await this.createSecurityAlert(
            event.fileId,
            event.userId,
            'permission_escalation',
            'high',
            'User permissions were escalated',
            { oldPermissions, newPermissions }
          );
        }
      }
    } catch (error) {
      logger.error('Failed to analyze security threats', {
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async createSecurityAlert(
    fileId: string,
    userId: string,
    alertType: FileSecurityAlert['alertType'],
    severity: FileSecurityAlert['severity'],
    description: string,
    details: Record<string, any>
  ): Promise<void> {
    const alert: FileSecurityAlert = {
      id: crypto.randomUUID(),
      fileId,
      userId,
      alertType,
      severity,
      description,
      details,
      status: 'open',
      createdAt: new Date(),
    };

    this.securityAlerts.set(alert.id, alert);

    logger.warn('Security alert created', {
      alertId: alert.id,
      alertType,
      severity,
      fileId,
      userId,
    });

    // In real implementation, this would trigger notifications
    // to security team, send emails, etc.
  }

  private generateDailyActivityTrend(
    events: FileAuditEvent[]
  ): Array<{ date: string; count: number }> {
    const dailyCounts = new Map<string, number>();

    events.forEach(event => {
      const date = event.timestamp.toISOString().split('T')[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    });

    return Array.from(dailyCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }

  private convertToCsv(events: FileAuditEvent[]): string {
    const headers = [
      'ID',
      'File ID',
      'User ID',
      'Action',
      'Severity',
      'Category',
      'Timestamp',
      'IP Address',
      'User Agent',
      'Details',
    ];

    const rows = events.map(event => [
      event.id,
      event.fileId,
      event.userId,
      event.action,
      event.severity,
      event.category,
      event.timestamp.toISOString(),
      event.ipAddress || '',
      event.userAgent || '',
      JSON.stringify(event.details),
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private convertToXml(events: FileAuditEvent[]): string {
    const xmlEvents = events
      .map(
        event => `
    <event>
      <id>${event.id}</id>
      <fileId>${event.fileId}</fileId>
      <userId>${event.userId}</userId>
      <action>${event.action}</action>
      <severity>${event.severity}</severity>
      <category>${event.category}</category>
      <timestamp>${event.timestamp.toISOString()}</timestamp>
      <ipAddress>${event.ipAddress || ''}</ipAddress>
      <userAgent>${event.userAgent || ''}</userAgent>
      <details>${JSON.stringify(event.details)}</details>
    </event>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<auditEvents>
  ${xmlEvents}
</auditEvents>`;
  }

  private async sendToExternalAuditSystems(
    event: FileAuditEvent
  ): Promise<void> {
    // Placeholder for sending to external audit systems
    // This would integrate with SIEM systems, compliance tools, etc.
    logger.debug('Sending audit event to external systems', {
      eventId: event.id,
      action: event.action,
      severity: event.severity,
    });
  }
}
