import { DatabaseConnection } from '../connection';
import { AuditLogRepository } from '../repositories/audit-log-repository';
import { AuditLog, AuditAction } from '../../../domain/entities/audit-log';

export class AuditLogSeeder {
  private connection: DatabaseConnection;
  private auditLogRepository: AuditLogRepository;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
    this.auditLogRepository = new AuditLogRepository();
  }

  async seed(
    userIds: string[],
    workspaceIds: string[],
    projectIds: string[],
    taskIds: string[],
    count: number = 200
  ): Promise<AuditLog[]> {
    const auditLogs: AuditLog[] = [];

    const actions = Object.values(AuditAction);
    const entityTypes = [
      'user',
      'workspace',
      'project',
      'task',
      'notification',
    ];

    const sampleDescriptions = {
      [AuditAction.CREATE]: [
        'Created new user account',
        'Created new workspace',
        'Created new project',
        'Created new task',
        'Created new notification',
      ],
      [AuditAction.UPDATE]: [
        'Updated user profile',
        'Updated workspace settings',
        'Updated project details',
        'Updated task status',
        'Updated notification preferences',
      ],
      [AuditAction.DELETE]: [
        'Deleted user account',
        'Deleted workspace',
        'Deleted project',
        'Deleted task',
        'Deleted notification',
      ],
      [AuditAction.LOGIN]: [
        'User logged in successfully',
        'User logged in from new device',
        'User logged in with 2FA',
      ],
      [AuditAction.LOGOUT]: [
        'User logged out',
        'User session expired',
        'User logged out from all devices',
      ],
      [AuditAction.ACCESS]: [
        'Accessed user profile',
        'Accessed workspace dashboard',
        'Accessed project details',
        'Accessed task list',
        'Accessed notification center',
      ],
    };

    for (let i = 0; i < count; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const workspaceId =
        workspaceIds[Math.floor(Math.random() * workspaceIds.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const entityType =
        entityTypes[Math.floor(Math.random() * entityTypes.length)];

      // Get appropriate entity ID based on type
      let entityId: string;
      switch (entityType) {
        case 'user':
          entityId = userIds[Math.floor(Math.random() * userIds.length)];
          break;
        case 'workspace':
          entityId =
            workspaceIds[Math.floor(Math.random() * workspaceIds.length)];
          break;
        case 'project':
          entityId = projectIds[Math.floor(Math.random() * projectIds.length)];
          break;
        case 'task':
          entityId = taskIds[Math.floor(Math.random() * taskIds.length)];
          break;
        default:
          entityId = `${entityType}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const descriptions = sampleDescriptions[action];
      const description =
        descriptions[Math.floor(Math.random() * descriptions.length)];

      // Generate sample changes based on action
      let changes: Record<string, any> = {};
      if (action === AuditAction.UPDATE) {
        changes = {
          before: { status: 'pending', priority: 'medium' },
          after: { status: 'in_progress', priority: 'high' },
        };
      } else if (action === AuditAction.CREATE) {
        changes = {
          created: { id: entityId, type: entityType, timestamp: new Date() },
        };
      }

      // Generate sample metadata
      const metadata = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        source: 'web_app',
        sessionId: `session-${Math.random().toString(36).substr(2, 16)}`,
        requestId: `req-${Math.random().toString(36).substr(2, 12)}`,
      };

      const auditLog = AuditLog.create({
        action,
        entityType,
        entityId,
        userId,
        workspaceId,
        description,
        changes,
        metadata,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      auditLogs.push(auditLog);
    }

    // Save audit logs in batches
    const batchSize = 50;
    for (let i = 0; i < auditLogs.length; i += batchSize) {
      const batch = auditLogs.slice(i, i + batchSize);
      await Promise.all(
        batch.map(auditLog => this.auditLogRepository.save(auditLog))
      );
    }

    console.log(`Seeded ${auditLogs.length} audit logs`);
    return auditLogs;
  }

  async getExistingAuditLogs(): Promise<AuditLog[]> {
    // This would need to be implemented based on your repository's findAll method
    return [];
  }
}
