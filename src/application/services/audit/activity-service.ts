import { AuditService } from './audit.service';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditAction } from '../schemas/audit-logs';

export interface IActivityService {
  logTaskActivity(
    taskId: string,
    action: AuditAction,
    userId: string,
    userEmail: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    changes?: Record<string, any>
  ): Promise<void>;

  logProjectActivity(
    projectId: string,
    action: AuditAction,
    userId: string,
    userEmail: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    changes?: Record<string, any>
  ): Promise<void>;

  logUserActivity(
    userId: string,
    action: AuditAction,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  getEntityActivity(
    entityType: string,
    entityId: string
  ): Promise<AuditLogEntity[]>;
  getUserActivity(userId: string): Promise<AuditLogEntity[]>;
}

export class ActivityService implements IActivityService {
  constructor(private auditService: AuditService) {}

  async logTaskActivity(
    taskId: string,
    action: AuditAction,
    userId: string,
    userEmail: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    changes?: Record<string, any>
  ): Promise<void> {
    await this.auditService.logActivity({
      entityType: 'task',
      entityId: taskId,
      action,
      userId,
      userEmail,
      oldValues,
      newValues,
      changes,
      metadata: {
        activityType: 'task_management',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logProjectActivity(
    projectId: string,
    action: AuditAction,
    userId: string,
    userEmail: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    changes?: Record<string, any>
  ): Promise<void> {
    await this.auditService.logActivity({
      entityType: 'project',
      entityId: projectId,
      action,
      userId,
      userEmail,
      oldValues,
      newValues,
      changes,
      metadata: {
        activityType: 'project_management',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logUserActivity(
    userId: string,
    action: AuditAction,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.auditService.logActivity({
      entityType: 'user',
      entityId: userId,
      action,
      userId,
      userEmail,
      metadata: {
        activityType: 'user_management',
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  }

  async getEntityActivity(
    entityType: string,
    entityId: string
  ): Promise<AuditLogEntity[]> {
    const result = await this.auditService.getEntityHistory(
      entityType,
      entityId,
      {
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }
    );

    return result.data;
  }

  async getUserActivity(userId: string): Promise<AuditLogEntity[]> {
    const result = await this.auditService.getUserActivity(userId, undefined, {
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    return result.data;
  }

  // Convenience methods for common activities
  async logTaskCreated(
    taskId: string,
    userId: string,
    userEmail: string,
    taskData: Record<string, any>
  ): Promise<void> {
    await this.logTaskActivity(
      taskId,
      'CREATE',
      userId,
      userEmail,
      undefined,
      taskData
    );
  }

  async logTaskUpdated(
    taskId: string,
    userId: string,
    userEmail: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    changes: Record<string, any>
  ): Promise<void> {
    await this.logTaskActivity(
      taskId,
      'UPDATE',
      userId,
      userEmail,
      oldData,
      newData,
      changes
    );
  }

  async logTaskDeleted(
    taskId: string,
    userId: string,
    userEmail: string,
    taskData: Record<string, any>
  ): Promise<void> {
    await this.logTaskActivity(taskId, 'DELETE', userId, userEmail, taskData);
  }

  async logProjectCreated(
    projectId: string,
    userId: string,
    userEmail: string,
    projectData: Record<string, any>
  ): Promise<void> {
    await this.logProjectActivity(
      projectId,
      'CREATE',
      userId,
      userEmail,
      undefined,
      projectData
    );
  }

  async logProjectUpdated(
    projectId: string,
    userId: string,
    userEmail: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    changes: Record<string, any>
  ): Promise<void> {
    await this.logProjectActivity(
      projectId,
      'UPDATE',
      userId,
      userEmail,
      oldData,
      newData,
      changes
    );
  }

  async logProjectDeleted(
    projectId: string,
    userId: string,
    userEmail: string,
    projectData: Record<string, any>
  ): Promise<void> {
    await this.logProjectActivity(
      projectId,
      'DELETE',
      userId,
      userEmail,
      projectData
    );
  }

  async logUserLogin(
    userId: string,
    userEmail: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditService.logUserLogin(
      userId,
      userEmail,
      ipAddress,
      userAgent
    );
  }

  async logUserLogout(
    userId: string,
    userEmail: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditService.logUserLogout(
      userId,
      userEmail,
      ipAddress,
      userAgent
    );
  }

  async logPasswordChange(
    userId: string,
    userEmail: string,
    ipAddress?: string
  ): Promise<void> {
    await this.logUserActivity(userId, 'PASSWORD_CHANGE', userEmail, {
      securityEvent: true,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  }

  async logEmailVerification(userId: string, userEmail: string): Promise<void> {
    await this.logUserActivity(userId, 'EMAIL_VERIFICATION', userEmail, {
      securityEvent: true,
      timestamp: new Date().toISOString(),
    });
  }

  async logPermissionChange(
    userId: string,
    userEmail: string,
    changedBy: string,
    changes: Record<string, any>
  ): Promise<void> {
    await this.logUserActivity(userId, 'PERMISSION_CHANGE', userEmail, {
      securityEvent: true,
      changedBy,
      changes,
      timestamp: new Date().toISOString(),
    });
  }
}
