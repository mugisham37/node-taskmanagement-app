import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  sql,
  inArray,
  gte,
  lte,
  lt,
} from 'drizzle-orm';
import { BaseDrizzleRepository } from './base-drizzle-repository';
import { AuditLog, AuditAction } from '../../../domain/entities/audit-log';
import { IAuditLogRepository } from '../../../domain/repositories/audit-log-repository';
import { ISpecification } from '../../../domain/base/repository.interface';
import { auditLogs, auditActionEnum } from '../schema/audit-logs';
import { logger } from '../../monitoring/logging-service';

// Drizzle model type
type DrizzleAuditLog = typeof auditLogs.$inferSelect;

export class AuditLogRepository
  extends BaseDrizzleRepository<
    AuditLog,
    string,
    DrizzleAuditLog,
    typeof auditLogs
  >
  implements IAuditLogRepository
{
  constructor() {
    super(auditLogs, 'AuditLog');
  }

  protected toDomain(drizzleModel: DrizzleAuditLog): AuditLog {
    return AuditLog.fromPersistence({
      id: drizzleModel.id,
      entityType: drizzleModel.entityType,
      entityId: drizzleModel.entityId,
      action: drizzleModel.action as AuditAction,
      userId: drizzleModel.userId || undefined,
      userEmail: drizzleModel.userEmail || undefined,
      ipAddress: drizzleModel.ipAddress || undefined,
      userAgent: drizzleModel.userAgent || undefined,
      oldValues: (drizzleModel.oldValues as Record<string, any>) || undefined,
      newValues: (drizzleModel.newValues as Record<string, any>) || undefined,
      changes: (drizzleModel.changes as Record<string, any>) || undefined,
      metadata: (drizzleModel.metadata as Record<string, any>) || {},
      createdAt: drizzleModel.createdAt,
    });
  }

  protected toDrizzle(entity: AuditLog): Partial<DrizzleAuditLog> {
    return {
      id: entity.id,
      entityType: entity.entityType,
      entityId: entity.entityId,
      action: entity.action,
      userId: entity.userId,
      userEmail: entity.userEmail,
      ipAddress: entity.ipAddress,
      userAgent: entity.userAgent,
      oldValues: entity.oldValues,
      newValues: entity.newValues,
      changes: entity.changes,
      metadata: entity.metadata,
    };
  }

  protected buildWhereClause(specification: ISpecification<AuditLog>): any {
    // This would be implemented based on your specification pattern
    return undefined;
  }

  async save(auditLog: AuditLog): Promise<void> {
    try {
      const data = this.toDrizzle(auditLog);
      await this.database.insert(auditLogs).values(data as any);
    } catch (error) {
      logger.error('Error saving audit log', {
        auditLogId: auditLog.id,
        error,
      });
      throw error;
    }
  }

  async findByEntityId(
    entityId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, entityId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding audit logs by entity ID', {
        entityId,
        error,
      });
      throw error;
    }
  }

  async findByEntityType(
    entityType: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityType, entityType))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding audit logs by entity type', {
        entityType,
        error,
      });
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding audit logs by user ID', { userId, error });
      throw error;
    }
  }

  async findByAction(
    action: AuditAction,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, action))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding audit logs by action', { action, error });
      throw error;
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.createdAt, startDate),
            lte(auditLogs.createdAt, endDate)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding audit logs by date range', {
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  async findSecurityEvents(
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLog[]> {
    try {
      const securityActions: AuditAction[] = [
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'EMAIL_VERIFICATION',
        'PERMISSION_CHANGE',
      ];

      const results = await this.database
        .select()
        .from(auditLogs)
        .where(inArray(auditLogs.action, securityActions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding security events', { error });
      throw error;
    }
  }

  async findByEntityAndAction(
    entityType: string,
    entityId: string,
    action: AuditAction
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, entityType),
            eq(auditLogs.entityId, entityId),
            eq(auditLogs.action, action)
          )
        )
        .orderBy(desc(auditLogs.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding audit logs by entity and action', {
        entityType,
        entityId,
        action,
        error,
      });
      throw error;
    }
  }

  async findRecentActivity(
    userId?: string,
    limit: number = 20
  ): Promise<AuditLog[]> {
    try {
      let whereClause = undefined;
      if (userId) {
        whereClause = eq(auditLogs.userId, userId);
      }

      const results = await this.database
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error finding recent activity', { userId, error });
      throw error;
    }
  }

  async getAuditTrail(
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, entityType),
            eq(auditLogs.entityId, entityId)
          )
        )
        .orderBy(asc(auditLogs.createdAt));

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error getting audit trail', {
        entityType,
        entityId,
        error,
      });
      throw error;
    }
  }

  async getSecuritySummary(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    securityEvents: number;
    uniqueUsers: number;
    topActions: Array<{ action: AuditAction; count: number }>;
    suspiciousActivity: number;
  }> {
    try {
      let dateFilter = undefined;
      if (startDate && endDate) {
        dateFilter = and(
          gte(auditLogs.createdAt, startDate),
          lte(auditLogs.createdAt, endDate)
        );
      } else if (startDate) {
        dateFilter = gte(auditLogs.createdAt, startDate);
      } else if (endDate) {
        dateFilter = lte(auditLogs.createdAt, endDate);
      }

      const securityActions: AuditAction[] = [
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'EMAIL_VERIFICATION',
        'PERMISSION_CHANGE',
      ];

      const [
        totalEventsResult,
        securityEventsResult,
        uniqueUsersResult,
        topActionsResult,
        suspiciousActivityResult,
      ] = await Promise.all([
        // Total events
        this.database
          .select({ count: count() })
          .from(auditLogs)
          .where(dateFilter),

        // Security events
        this.database
          .select({ count: count() })
          .from(auditLogs)
          .where(
            dateFilter
              ? and(dateFilter, inArray(auditLogs.action, securityActions))
              : inArray(auditLogs.action, securityActions)
          ),

        // Unique users
        this.database
          .select({ count: sql<number>`COUNT(DISTINCT ${auditLogs.userId})` })
          .from(auditLogs)
          .where(dateFilter),

        // Top actions
        this.database
          .select({
            action: auditLogs.action,
            count: count(),
          })
          .from(auditLogs)
          .where(dateFilter)
          .groupBy(auditLogs.action)
          .orderBy(desc(count()))
          .limit(10),

        // Suspicious activity (multiple failed logins, etc.)
        this.database
          .select({ count: count() })
          .from(auditLogs)
          .where(
            dateFilter
              ? and(
                  dateFilter,
                  eq(auditLogs.action, 'LOGIN'),
                  sql`${auditLogs.metadata}->>'success' = 'false'`
                )
              : and(
                  eq(auditLogs.action, 'LOGIN'),
                  sql`${auditLogs.metadata}->>'success' = 'false'`
                )
          ),
      ]);

      return {
        totalEvents: totalEventsResult[0]?.count || 0,
        securityEvents: securityEventsResult[0]?.count || 0,
        uniqueUsers: uniqueUsersResult[0]?.count || 0,
        topActions: topActionsResult.map(row => ({
          action: row.action as AuditAction,
          count: row.count,
        })),
        suspiciousActivity: suspiciousActivityResult[0]?.count || 0,
      };
    } catch (error) {
      logger.error('Error getting security summary', {
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  async searchLogs(query: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    try {
      const conditions = [];

      if (query.entityType) {
        conditions.push(eq(auditLogs.entityType, query.entityType));
      }
      if (query.entityId) {
        conditions.push(eq(auditLogs.entityId, query.entityId));
      }
      if (query.userId) {
        conditions.push(eq(auditLogs.userId, query.userId));
      }
      if (query.action) {
        conditions.push(eq(auditLogs.action, query.action));
      }
      if (query.startDate) {
        conditions.push(gte(auditLogs.createdAt, query.startDate));
      }
      if (query.endDate) {
        conditions.push(lte(auditLogs.createdAt, query.endDate));
      }
      if (query.ipAddress) {
        conditions.push(eq(auditLogs.ipAddress, query.ipAddress));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const results = await this.database
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit || 50)
        .offset(query.offset || 0);

      return results.map(result => this.toDomain(result));
    } catch (error) {
      logger.error('Error searching audit logs', { query, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.delete(auditLogs).where(eq(auditLogs.id, id));
    } catch (error) {
      logger.error('Error deleting audit log', { id, error });
      throw error;
    }
  }

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const results = await this.database
        .delete(auditLogs)
        .where(lt(auditLogs.createdAt, date))
        .returning({ id: auditLogs.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting audit logs older than date', {
        date,
        error,
      });
      throw error;
    }
  }

  async deleteByEntityId(entityId: string): Promise<number> {
    try {
      const results = await this.database
        .delete(auditLogs)
        .where(eq(auditLogs.entityId, entityId))
        .returning({ id: auditLogs.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting audit logs by entity ID', {
        entityId,
        error,
      });
      throw error;
    }
  }
}
