import { AuditLog, AuditAction } from '../entities/audit-log';

export interface IAuditLogRepository {
  save(auditLog: AuditLog): Promise<void>;
  findById(id: string): Promise<AuditLog | null>;
  findByEntityId(
    entityId: string,
    limit?: number,
    offset?: number
  ): Promise<AuditLog[]>;
  findByEntityType(
    entityType: string,
    limit?: number,
    offset?: number
  ): Promise<AuditLog[]>;
  findByUserId(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<AuditLog[]>;
  findByAction(
    action: AuditAction,
    limit?: number,
    offset?: number
  ): Promise<AuditLog[]>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
    offset?: number
  ): Promise<AuditLog[]>;
  findSecurityEvents(limit?: number, offset?: number): Promise<AuditLog[]>;
  findByEntityAndAction(
    entityType: string,
    entityId: string,
    action: AuditAction
  ): Promise<AuditLog[]>;
  findRecentActivity(userId?: string, limit?: number): Promise<AuditLog[]>;
  getAuditTrail(entityType: string, entityId: string): Promise<AuditLog[]>;
  getSecuritySummary(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    securityEvents: number;
    uniqueUsers: number;
    topActions: Array<{ action: AuditAction; count: number }>;
    suspiciousActivity: number;
  }>;
  searchLogs(query: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  delete(id: string): Promise<void>;
  deleteOlderThan(date: Date): Promise<number>;
  deleteByEntityId(entityId: string): Promise<number>;
  archiveLogs(fromDate: Date, toDate: Date, archiveLocation: string): Promise<number>;
}
