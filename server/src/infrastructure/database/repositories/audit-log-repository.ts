import {
  eq,
  and,
  desc,
  asc,
  count,
  sql,
  inArray,
  gte,
  lte,
  lt,
} from 'drizzle-orm';
import { AuditLog, AuditAction } from '../../../domain/entities/audit-log';
import { IAuditLogRepository } from '../../../domain/repositories/audit-log-repository';
import { auditLogs } from '../schema/audit-logs';
import { logger } from '../../monitoring/logging-service';
import { db } from '../connection';

// Drizzle model type
type DrizzleAuditLog = typeof auditLogs.$inferSelect;

export class AuditLogRepository implements IAuditLogRepository {
  private readonly database = db;

  constructor() {}

  protected toDomain(drizzleModel: DrizzleAuditLog): AuditLog {
    const props: any = {
      id: drizzleModel.id,
      entityType: drizzleModel.entityType,
      entityId: drizzleModel.entityId,
      action: drizzleModel.action as AuditAction,
      metadata: (drizzleModel.metadata as Record<string, any>) || {},
      createdAt: drizzleModel.createdAt,
    };

    if (drizzleModel.userId) {
      props.userId = drizzleModel.userId;
    }
    if (drizzleModel.userEmail) {
      props.userEmail = drizzleModel.userEmail;
    }
    if (drizzleModel.ipAddress) {
      props.ipAddress = drizzleModel.ipAddress;
    }
    if (drizzleModel.userAgent) {
      props.userAgent = drizzleModel.userAgent;
    }
    if (drizzleModel.oldValues) {
      props.oldValues = drizzleModel.oldValues as Record<string, any>;
    }
    if (drizzleModel.newValues) {
      props.newValues = drizzleModel.newValues as Record<string, any>;
    }
    if (drizzleModel.changes) {
      props.changes = drizzleModel.changes as Record<string, any>;
    }

    return AuditLog.fromPersistence(props);
  }

  protected toDrizzle(entity: AuditLog): Partial<DrizzleAuditLog> {
    return {
      id: entity.id,
      entityType: entity.entityType,
      entityId: entity.entityId,
      action: entity.action,
      userId: entity.userId || null,
      userEmail: entity.userEmail || null,
      ipAddress: entity.ipAddress || null,
      userAgent: entity.userAgent || null,
      oldValues: entity.oldValues || null,
      newValues: entity.newValues || null,
      changes: entity.changes || null,
      metadata: entity.metadata || {},
    };
  }

  async save(auditLog: AuditLog): Promise<void> {
    try {
      const data = this.toDrizzle(auditLog);
      await this.database.insert(auditLogs).values(data as any);
    } catch (error) {
      logger.error('Error saving audit log', error as Error, {
        entityId: auditLog.id,
        userId: '',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<AuditLog | null> {
    try {
      const results = await this.database
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, id))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      return this.toDomain(results[0] as DrizzleAuditLog);
    } catch (error) {
      logger.error('Error finding audit log by id', error as Error, {
        entityId: id,
        userId: '',
        timestamp: new Date(),
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
      logger.error('Error finding audit logs by entity ID', error as Error, {
        entityId,
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
      logger.error('Error finding audit logs by entity type', error as Error, {
        entityType,
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
      logger.error('Error finding audit logs by user ID', error as Error, { userId });
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
      logger.error('Error finding audit logs by action', error as Error, { action });
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
      logger.error('Error finding audit logs by date range', error as Error, {
        startDate,
        endDate,
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
      logger.error('Error finding security events', error as Error);
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
      logger.error('Error finding audit logs by entity and action', error as Error, {
        entityType,
        entityId,
        action,
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
      logger.error('Error finding recent activity', error as Error, 
        userId ? { userId, entityId: '', timestamp: new Date() } : undefined);
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
      logger.error('Error getting audit trail', error as Error, {
        entityId: entityType,
        userId: entityId, 
        timestamp: new Date(),
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
      logger.error('Error getting security summary', error as Error, 
        startDate ? { 
          entityId: startDate.toISOString(), 
          userId: endDate?.toISOString() || '',
          timestamp: new Date(),
        } : undefined);
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
      logger.error('Error searching audit logs', error as Error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.delete(auditLogs).where(eq(auditLogs.id, id));
    } catch (error) {
      logger.error('Error deleting audit log', error as Error, { 
        entityId: id,
        userId: '',
        timestamp: new Date(),
      });
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
      logger.error('Error deleting audit logs older than date', error as Error, {
        entityId: date.toISOString(),
        userId: '',
        timestamp: new Date(),
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
      logger.error('Error deleting audit logs by entity ID', error as Error, {
        entityId,
        userId: '',
        timestamp: new Date(),
      });
      throw error;
    }
  }
}
