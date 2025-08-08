import { eq, and, or, desc, asc, gte, lte, inArray, ilike } from 'drizzle-orm';
import { BaseRepository } from '../../../infrastructure/database/drizzle/repositories/base/base.repository';
import {
  auditLogs,
  AuditLog,
  NewAuditLog,
  AuditAction,
} from '../schemas/audit-logs';
import {
  PaginationOptions,
  PaginatedResult,
  SearchOptions,
} from '../../../infrastructure/database/drizzle/repositories/base/interfaces';
import { RepositoryException } from '../../../infrastructure/database/drizzle/repositories/base/types';

export class AuditRepository extends BaseRepository<AuditLog, NewAuditLog> {
  protected table = auditLogs;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: false }, // Don't cache audit logs
      { enabled: false } // Don't audit the audit logs
    );
  }

  // Audit-specific methods
  async findByEntity(
    entityType: string,
    entityId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findByEntity');
    }
  }

  async findByUser(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: eq(auditLogs.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByAction(
    action: AuditAction,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: eq(auditLogs.action, action),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findByAction');
    }
  }

  async findByEntityType(
    entityType: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: eq(auditLogs.entityType, entityType),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findByEntityType');
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: and(
          gte(auditLogs.createdAt, startDate),
          lte(auditLogs.createdAt, endDate)
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findByDateRange');
    }
  }

  async findRecentActivity(
    hours: number = 24,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      return await this.findMany({
        where: gte(auditLogs.createdAt, since),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentActivity');
    }
  }

  async findUserActivity(
    userId: string,
    entityType?: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      const whereCondition = entityType
        ? and(
            eq(auditLogs.userId, userId),
            eq(auditLogs.entityType, entityType)
          )
        : eq(auditLogs.userId, userId);

      return await this.findMany({
        where: whereCondition,
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findUserActivity');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<AuditLog>> {
    try {
      const {
        query,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(auditLogs.entityType, searchPattern),
        ilike(auditLogs.action, searchPattern),
        ilike(auditLogs.userEmail, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder,
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  async logActivity(data: {
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
  }): Promise<AuditLog> {
    try {
      return await this.create({
        ...data,
        metadata: data.metadata || {},
      } as NewAuditLog);
    } catch (error) {
      throw this.handleError(error, 'logActivity');
    }
  }

  async getActivityStats(entityType?: string): Promise<{
    totalActivities: number;
    activitiesByAction: Record<string, number>;
    activitiesByUser: Record<string, number>;
    recentActivity: number;
  }> {
    try {
      const baseWhere = entityType
        ? eq(auditLogs.entityType, entityType)
        : undefined;
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const [totalActivities, recentActivity] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({
          where: baseWhere
            ? and(baseWhere, gte(auditLogs.createdAt, last24Hours))
            : gte(auditLogs.createdAt, last24Hours),
        }),
      ]);

      // Get activities by action (simplified for now)
      const activitiesByAction: Record<string, number> = {};
      const activitiesByUser: Record<string, number> = {};

      return {
        totalActivities,
        activitiesByAction,
        activitiesByUser,
        recentActivity,
      };
    } catch (error) {
      throw this.handleError(error, 'getActivityStats');
    }
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findByEntity(entityType, entityId, {
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'asc', // Show history in chronological order
      });
    } catch (error) {
      throw this.handleError(error, 'getEntityHistory');
    }
  }

  async getUserLoginHistory(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: and(
          eq(auditLogs.userId, userId),
          or(eq(auditLogs.action, 'LOGIN'), eq(auditLogs.action, 'LOGOUT'))
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'getUserLoginHistory');
    }
  }

  async getSecurityEvents(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AuditLog>> {
    try {
      return await this.findMany({
        where: or(
          eq(auditLogs.action, 'PASSWORD_CHANGE'),
          eq(auditLogs.action, 'EMAIL_VERIFICATION'),
          eq(auditLogs.action, 'PERMISSION_CHANGE'),
          eq(auditLogs.action, 'LOGIN'),
          eq(auditLogs.action, 'LOGOUT')
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'getSecurityEvents');
    }
  }

  async cleanupOldLogs(
    daysToKeep: number = 90
  ): Promise<{ success: boolean; deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Get count of logs to be deleted
      const toDeleteCount = await this.count({
        where: lte(auditLogs.createdAt, cutoffDate),
      });

      if (toDeleteCount === 0) {
        return { success: true, deletedCount: 0 };
      }

      // Delete old logs in batches to avoid performance issues
      const batchSize = 1000;
      let totalDeleted = 0;

      while (totalDeleted < toDeleteCount) {
        const batch = await this.findMany({
          where: lte(auditLogs.createdAt, cutoffDate),
          limit: batchSize,
          sortBy: 'createdAt',
          sortOrder: 'asc',
        });

        if (batch.data.length === 0) break;

        const ids = batch.data.map(log => log.id);
        const result = await this.deleteMany(ids);

        if (!result.success) {
          throw new Error('Failed to delete batch of audit logs');
        }

        totalDeleted += result.count;
      }

      return { success: true, deletedCount: totalDeleted };
    } catch (error) {
      throw this.handleError(error, 'cleanupOldLogs');
    }
  }
}

// Export singleton instance
export const auditRepository = new AuditRepository();
