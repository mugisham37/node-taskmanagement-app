import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditService } from '../services/audit.service';
import { ActivityService } from '../services/activity-service';
import { AuditContext } from '../value-objects/audit-context';
import { EntityReference } from '../value-objects/entity-reference';
import { AuditAction } from '../schemas/audit-logs';

// Mock the repository
const mockAuditRepository = {
  logActivity: vi.fn(),
  getEntityHistory: vi.fn(),
  findUserActivity: vi.fn(),
  findRecentActivity: vi.fn(),
  getSecurityEvents: vi.fn(),
  getUserLoginHistory: vi.fn(),
  getActivityStats: vi.fn(),
  search: vi.fn(),
  findByAction: vi.fn(),
  findByEntityType: vi.fn(),
  findByDateRange: vi.fn(),
  cleanupOldLogs: vi.fn(),
};

describe('Audit Domain', () => {
  let auditService: AuditService;
  let activityService: ActivityService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new AuditService(mockAuditRepository as any);
    activityService = new ActivityService(auditService);
  });

  describe('AuditLogEntity', () => {
    it('should create a valid audit log entity', () => {
      const auditLog = AuditLogEntity.create({
        entityType: 'task',
        entityId: 'task-123',
        action: 'CREATE',
        userId: 'user-123',
        userEmail: 'test@example.com',
      });

      expect(auditLog.entityType).toBe('task');
      expect(auditLog.entityId).toBe('task-123');
      expect(auditLog.action).toBe('CREATE');
      expect(auditLog.userId).toBe('user-123');
      expect(auditLog.userEmail).toBe('test@example.com');
      expect(auditLog.isUserAction()).toBe(true);
      expect(auditLog.isSecurityEvent()).toBe(false);
    });

    it('should identify security events correctly', () => {
      const loginLog = AuditLogEntity.create({
        entityType: 'user',
        entityId: 'user-123',
        action: 'LOGIN',
        userId: 'user-123',
        userEmail: 'test@example.com',
      });

      expect(loginLog.isSecurityEvent()).toBe(true);
    });

    it('should validate required fields', () => {
      expect(() => {
        AuditLogEntity.create({
          entityType: '',
          entityId: 'task-123',
          action: 'CREATE',
        });
      }).toThrow('Entity type is required');

      expect(() => {
        AuditLogEntity.create({
          entityType: 'task',
          entityId: '',
          action: 'CREATE',
        });
      }).toThrow('Entity ID is required');
    });

    it('should detect changes correctly', () => {
      const auditLog = AuditLogEntity.create({
        entityType: 'task',
        entityId: 'task-123',
        action: 'UPDATE',
        changes: { title: { old: 'Old Title', new: 'New Title' } },
      });

      expect(auditLog.hasChanges()).toBe(true);
      expect(auditLog.getChangedFields()).toEqual(['title']);
      expect(auditLog.getFieldChange('title')).toEqual({
        oldValue: undefined,
        newValue: undefined,
      });
    });
  });

  describe('AuditService', () => {
    it('should log activity correctly', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        entityType: 'task',
        entityId: 'task-123',
        action: 'CREATE' as AuditAction,
        userId: 'user-123',
        userEmail: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuditRepository.logActivity.mockResolvedValue(mockAuditLog);

      const result = await auditService.logActivity({
        entityType: 'task',
        entityId: 'task-123',
        action: 'CREATE',
        userId: 'user-123',
        userEmail: 'test@example.com',
      });

      expect(mockAuditRepository.logActivity).toHaveBeenCalledWith({
        entityType: 'task',
        entityId: 'task-123',
        action: 'CREATE',
        userId: 'user-123',
        userEmail: 'test@example.com',
      });

      expect(result).toBeInstanceOf(AuditLogEntity);
      expect(result.entityType).toBe('task');
    });

    it('should get entity history', async () => {
      const mockHistory = {
        data: [
          {
            id: 'audit-123',
            entityType: 'task',
            entityId: 'task-123',
            action: 'CREATE' as AuditAction,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockAuditRepository.getEntityHistory.mockResolvedValue(mockHistory);

      const result = await auditService.getEntityHistory('task', 'task-123');

      expect(mockAuditRepository.getEntityHistory).toHaveBeenCalledWith(
        'task',
        'task-123',
        {}
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toBeInstanceOf(AuditLogEntity);
    });
  });

  describe('ActivityService', () => {
    it('should log task activity', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        entityType: 'task',
        entityId: 'task-123',
        action: 'CREATE' as AuditAction,
        userId: 'user-123',
        userEmail: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuditRepository.logActivity.mockResolvedValue(mockAuditLog);

      await activityService.logTaskCreated(
        'task-123',
        'user-123',
        'test@example.com',
        {
          title: 'New Task',
          description: 'Task description',
        }
      );

      expect(mockAuditRepository.logActivity).toHaveBeenCalledWith({
        entityType: 'task',
        entityId: 'task-123',
        action: 'CREATE',
        userId: 'user-123',
        userEmail: 'test@example.com',
        oldValues: undefined,
        newValues: {
          title: 'New Task',
          description: 'Task description',
        },
        changes: undefined,
        metadata: {
          activityType: 'task_management',
          timestamp: expect.any(String),
        },
      });
    });

    it('should log user login', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        entityType: 'user',
        entityId: 'user-123',
        action: 'LOGIN' as AuditAction,
        userId: 'user-123',
        userEmail: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuditRepository.logActivity.mockResolvedValue(mockAuditLog);

      await activityService.logUserLogin(
        'user-123',
        'test@example.com',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockAuditRepository.logActivity).toHaveBeenCalledWith({
        entityType: 'user',
        entityId: 'user-123',
        action: 'LOGIN',
        userId: 'user-123',
        userEmail: 'test@example.com',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { loginTime: expect.any(String) },
      });
    });
  });

  describe('AuditContext', () => {
    it('should create audit context from request', () => {
      const request = {
        user: { id: 'user-123', email: 'test@example.com' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
        sessionId: 'session-123',
        requestId: 'req-123',
      };

      const context = AuditContext.fromRequest(request);

      expect(context.userId).toBe('user-123');
      expect(context.userEmail).toBe('test@example.com');
      expect(context.ipAddress).toBe('192.168.1.1');
      expect(context.userAgent).toBe('Mozilla/5.0');
      expect(context.sessionId).toBe('session-123');
      expect(context.requestId).toBe('req-123');
      expect(context.hasUser()).toBe(true);
    });

    it('should handle request without user', () => {
      const request = {
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      };

      const context = AuditContext.fromRequest(request);

      expect(context.userId).toBeUndefined();
      expect(context.userEmail).toBeUndefined();
      expect(context.hasUser()).toBe(false);
    });
  });

  describe('EntityReference', () => {
    it('should create entity reference', () => {
      const ref = EntityReference.create('task', 'task-123');

      expect(ref.type).toBe('task');
      expect(ref.id).toBe('task-123');
      expect(ref.toString()).toBe('task:task-123');
    });

    it('should create from string', () => {
      const ref = EntityReference.fromString('task:task-123');

      expect(ref.type).toBe('task');
      expect(ref.id).toBe('task-123');
    });

    it('should validate format when creating from string', () => {
      expect(() => {
        EntityReference.fromString('invalid-format');
      }).toThrow('Invalid entity reference format');
    });

    it('should provide convenience methods for common entities', () => {
      const taskRef = EntityReference.task('task-123');
      const projectRef = EntityReference.project('project-123');
      const userRef = EntityReference.user('user-123');

      expect(taskRef.type).toBe('task');
      expect(projectRef.type).toBe('project');
      expect(userRef.type).toBe('user');
    });

    it('should compare references correctly', () => {
      const ref1 = EntityReference.task('task-123');
      const ref2 = EntityReference.task('task-123');
      const ref3 = EntityReference.task('task-456');

      expect(ref1.equals(ref2)).toBe(true);
      expect(ref1.equals(ref3)).toBe(false);
    });
  });
});
