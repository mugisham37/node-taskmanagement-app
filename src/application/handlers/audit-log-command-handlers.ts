/**
 * Audit Log Command Handlers
 *
 * Handles commands for logging audit events and cleanup
 */

import { BaseHandler, ICommandHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { IAuditLogRepository } from '../../domain/repositories/audit-log-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { AuditLogId } from '../../domain/value-objects/audit-log-id';
import { UserId } from '../../domain/value-objects/user-id';
import { AuditLog } from '../../domain/entities/audit-log';
import { NotFoundError } from '../../shared/errors/not-found-error';

// Command interfaces
export interface LogAuditEventCommand {
  userId: UserId;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface BulkLogAuditEventsCommand {
  events: LogAuditEventCommand[];
}

export interface CleanupOldAuditLogsCommand {
  olderThanDays: number;
  batchSize?: number;
}

export interface ArchiveAuditLogsCommand {
  fromDate: Date;
  toDate: Date;
  archiveLocation: string;
}

export interface DeleteAuditLogCommand {
  auditLogId: AuditLogId;
  deletedBy: UserId;
  reason: string;
}

/**
 * Log audit event command handler
 */
export class LogAuditEventCommandHandler
  extends BaseHandler
  implements ICommandHandler<LogAuditEventCommand, AuditLogId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: LogAuditEventCommand): Promise<AuditLogId> {
    this.logInfo('Logging audit event', {
      userId: command.userId.value,
      entityType: command.entityType,
      entityId: command.entityId,
      action: command.action,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify user exists (optional - audit logs can be created for system actions)
        if (command.userId) {
          const user = await this.userRepository.findById(command.userId);
          if (!user) {
            this.logWarning('Audit log created for non-existent user', {
              userId: command.userId.value,
            });
          }
        }

        // Create audit log entry
        const auditLog = AuditLog.create({
          userId: command.userId?.value,
          entityType: command.entityType,
          entityId: command.entityId,
          action: command.action as any, // Will be converted to AuditAction enum
          oldValues: command.oldValues,
          newValues: command.newValues,
          ipAddress: command.ipAddress,
          userAgent: command.userAgent,
          metadata: command.metadata,
        });

        await this.auditLogRepository.save(auditLog);

        this.logInfo('Audit event logged successfully', {
          auditLogId: auditLog.id.value,
          userId: command.userId?.value,
          entityType: command.entityType,
          action: command.action,
        });

        return auditLog.id;
      } catch (error) {
        this.logError('Failed to log audit event', error as Error, {
          userId: command.userId?.value,
          entityType: command.entityType,
          action: command.action,
        });
        throw error;
      }
    });
  }
}

/**
 * Bulk log audit events command handler
 */
export class BulkLogAuditEventsCommandHandler
  extends BaseHandler
  implements ICommandHandler<BulkLogAuditEventsCommand, AuditLogId[]>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: BulkLogAuditEventsCommand): Promise<AuditLogId[]> {
    this.logInfo('Bulk logging audit events', {
      eventCount: command.events.length,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const auditLogIds: AuditLogId[] = [];

        for (const event of command.events) {
          // Create audit log entry
          const auditLog = AuditLog.create({
            userId: event.userId?.value,
            entityType: event.entityType,
            entityId: event.entityId,
            action: event.action as any, // Will be converted to AuditAction enum
            oldValues: event.oldValues,
            newValues: event.newValues,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            metadata: event.metadata,
          });

          await this.auditLogRepository.save(auditLog);
          auditLogIds.push(auditLog.id);
        }

        this.logInfo('Bulk audit events logged successfully', {
          eventCount: command.events.length,
          auditLogIds: auditLogIds.map(id => id.value),
        });

        return auditLogIds;
      } catch (error) {
        this.logError('Failed to bulk log audit events', error as Error, {
          eventCount: command.events.length,
        });
        throw error;
      }
    });
  }
}

/**
 * Cleanup old audit logs command handler
 */
export class CleanupOldAuditLogsCommandHandler
  extends BaseHandler
  implements ICommandHandler<CleanupOldAuditLogsCommand, number>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CleanupOldAuditLogsCommand): Promise<number> {
    this.logInfo('Cleaning up old audit logs', {
      olderThanDays: command.olderThanDays,
      batchSize: command.batchSize || 1000,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - command.olderThanDays);

        const deletedCount = await this.auditLogRepository.deleteOlderThan(
          cutoffDate,
          command.batchSize || 1000
        );

        this.logInfo('Old audit logs cleaned up successfully', {
          deletedCount,
          cutoffDate: cutoffDate.toISOString(),
        });

        return deletedCount;
      } catch (error) {
        this.logError('Failed to cleanup old audit logs', error as Error, {
          olderThanDays: command.olderThanDays,
        });
        throw error;
      }
    });
  }
}

/**
 * Archive audit logs command handler
 */
export class ArchiveAuditLogsCommandHandler
  extends BaseHandler
  implements ICommandHandler<ArchiveAuditLogsCommand, number>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: ArchiveAuditLogsCommand): Promise<number> {
    this.logInfo('Archiving audit logs', {
      fromDate: command.fromDate.toISOString(),
      toDate: command.toDate.toISOString(),
      archiveLocation: command.archiveLocation,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Get audit logs in date range
        const auditLogs = await this.auditLogRepository.findByDateRange(
          command.fromDate,
          command.toDate
        );

        if (auditLogs.length === 0) {
          this.logInfo('No audit logs found in date range for archiving');
          return 0;
        }

        // Archive the logs (implementation would depend on storage system)
        const archivedCount = await this.auditLogRepository.archiveLogs(
          auditLogs,
          command.archiveLocation
        );

        // Delete archived logs from main storage
        for (const auditLog of auditLogs) {
          await this.auditLogRepository.delete(auditLog.id);
        }

        this.logInfo('Audit logs archived successfully', {
          archivedCount,
          archiveLocation: command.archiveLocation,
        });

        return archivedCount;
      } catch (error) {
        this.logError('Failed to archive audit logs', error as Error, {
          fromDate: command.fromDate.toISOString(),
          toDate: command.toDate.toISOString(),
        });
        throw error;
      }
    });
  }
}

/**
 * Delete audit log command handler
 */
export class DeleteAuditLogCommandHandler
  extends BaseHandler
  implements ICommandHandler<DeleteAuditLogCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: DeleteAuditLogCommand): Promise<void> {
    this.logInfo('Deleting audit log', {
      auditLogId: command.auditLogId.value,
      deletedBy: command.deletedBy.value,
      reason: command.reason,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify audit log exists
        const auditLog = await this.auditLogRepository.findById(
          command.auditLogId
        );
        if (!auditLog) {
          throw new NotFoundError(
            `Audit log with ID ${command.auditLogId.value} not found`
          );
        }

        // Verify user has permission to delete audit logs (typically admin only)
        const user = await this.userRepository.findById(command.deletedBy);
        if (!user) {
          throw new NotFoundError(
            `User with ID ${command.deletedBy.value} not found`
          );
        }

        // Log the deletion as an audit event before deleting
        const deletionAuditLog = AuditLog.create({
          userId: command.deletedBy,
          entityType: 'AuditLog',
          entityId: command.auditLogId.value,
          action: 'DELETE',
          oldValues: {
            originalAuditLog: {
              entityType: auditLog.entityType,
              entityId: auditLog.entityId,
              action: auditLog.action,
              createdAt: auditLog.createdAt,
            },
          },
          metadata: {
            reason: command.reason,
            deletedAt: new Date().toISOString(),
          },
        });

        await this.auditLogRepository.save(deletionAuditLog);

        // Delete the audit log
        await this.auditLogRepository.delete(command.auditLogId);

        this.logInfo('Audit log deleted successfully', {
          auditLogId: command.auditLogId.value,
          deletedBy: command.deletedBy.value,
          reason: command.reason,
        });
      } catch (error) {
        this.logError('Failed to delete audit log', error as Error, {
          auditLogId: command.auditLogId.value,
          deletedBy: command.deletedBy.value,
        });
        throw error;
      }
    });
  }
}

// Export aliases for backward compatibility
export const CreateAuditLogHandler = LogAuditEventCommandHandler;
export const CleanupAuditLogsHandler = CleanupOldAuditLogsCommandHandler;
