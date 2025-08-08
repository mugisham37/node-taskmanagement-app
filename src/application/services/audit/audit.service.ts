import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditRepository } from '../repositories/audit.repository';
import { AuditAction } from '../schemas/audit-logs';
import {
  PaginationOptions,
  PaginatedResult,
} from '../../../infrastructure/database/drizzle/repositories/base/interfaces';

export interface LogActivityData {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ActivityStats {
  totalActivities: number;
  activitiesByAction: Record<string, number>;
  activitiesByUser: Record<string, number>;
  recentActivity: number;
}

export class AuditService {
  constructor(private auditRepository: AuditRepository) {}

  async logActivity(data: LogActivityData): Promise<AuditLogEntity> {
    const auditLog = AuditLogEntity.create(data);
    const savedLog = await this.auditRepository.logActivity(data);
    return AuditLogEntity.fromPersistence(savedLog);
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.getEntityHistory(
      entityType,
      entityId,
      options
    );

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getUserActivity(
    userId: string,
    entityType?: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.findUserActivity(
      userId,
      entityType,
      options
    );

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getRecentActivity(
    hours: number = 24,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.findRecentActivity(
      hours,
      options
    );

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getSecurityEvents(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.getSecurityEvents(options);

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getUserLoginHistory(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.getUserLoginHistory(
      userId,
      options
    );

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getActivityStats(entityType?: string): Promise<ActivityStats> {
    return await this.auditRepository.getActivityStats(entityType);
  }

  async searchAuditLogs(
    query: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.search({ query, ...options });

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getActivitiesByAction(
    action: AuditAction,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.findByAction(action, options);

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getActivitiesByEntityType(
    entityType: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.findByEntityType(
      entityType,
      options
    );

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async getActivitiesByDateRange(
    startDate: Date,
    endDate: Date,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLogEntity>> {
    const result = await this.auditRepository.findByDateRange(
      startDate,
      endDate,
      options
    );

    return {
      ...result,
      data: result.data.map(log => AuditLogEntity.fromPersistence(log)),
    };
  }

  async cleanupOldLogs(
    daysToKeep: number = 90
  ): Promise<{ success: boolean; deletedCount: number }> {
    return await this.auditRepository.cleanupOldLogs(daysToKeep);
  }

  // Helper methods for common audit scenarios
  async logUserLogin(
    userId: string,
    userEmail: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogEntity> {
    return this.logActivity({
      entityType: 'user',
      entityId: userId,
      action: 'LOGIN',
      userId,
      userEmail,
      ipAddress,
      userAgent,
      metadata: { loginTime: new Date().toISOString() },
    });
  }

  async logUserLogout(
    userId: string,
    userEmail: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogEntity> {
    return this.logActivity({
      entityType: 'user',
      entityId: userId,
      action: 'LOGOUT',
      userId,
      userEmail,
      ipAddress,
      userAgent,
      metadata: { logoutTime: new Date().toISOString() },
    });
  }

  async logEntityCreation(
    entityType: string,
    entityId: string,
    userId: string,
    userEmail: string,
    newValues: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<AuditLogEntity> {
    return this.logActivity({
      entityType,
      entityId,
      action: 'CREATE',
      userId,
      userEmail,
      newValues,
      metadata,
    });
  }

  async logEntityUpdate(
    entityType: string,
    entityId: string,
    userId: string,
    userEmail: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    changes: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<AuditLogEntity> {
    return this.logActivity({
      entityType,
      entityId,
      action: 'UPDATE',
      userId,
      userEmail,
      oldValues,
      newValues,
      changes,
      metadata,
    });
  }

  async logEntityDeletion(
    entityType: string,
    entityId: string,
    userId: string,
    userEmail: string,
    oldValues: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<AuditLogEntity> {
    return this.logActivity({
      entityType,
      entityId,
      action: 'DELETE',
      userId,
      userEmail,
      oldValues,
      metadata,
    });
  }
}
