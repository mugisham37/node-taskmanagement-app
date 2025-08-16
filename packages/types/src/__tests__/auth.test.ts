import { describe, expect, it } from 'vitest';
import {
    AccessContext,
    AuthContext,
    AuthenticatedUser,
    SecurityContext,
    TokenPayload,
    WorkspaceContext
} from '../auth';

describe('Auth Types', () => {
  describe('AuthenticatedUser', () => {
    it('should define complete user authentication data', () => {
      const user: AuthenticatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
        isActive: true,
        roles: ['user', 'admin'],
        permissions: ['read:tasks', 'write:tasks'],
        sessionId: 'session-456',
        workspaceId: 'workspace-789',
        riskScore: 0.2,
        deviceId: 'device-abc',
        mfaEnabled: true,
        emailVerified: true,
      };

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.roles).toContain('admin');
      expect(user.permissions).toContain('read:tasks');
      expect(user.mfaEnabled).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const user: AuthenticatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
        isActive: true,
        roles: ['user'],
        permissions: ['read:tasks'],
        sessionId: 'session-456',
      };

      expect(user.workspaceId).toBeUndefined();
      expect(user.riskScore).toBeUndefined();
      expect(user.deviceId).toBeUndefined();
    });
  });

  describe('SecurityContext', () => {
    it('should capture comprehensive security information', () => {
      const context: SecurityContext = {
        requestId: 'req-123',
        userId: 'user-456',
        sessionId: 'session-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date(),
        endpoint: '/api/tasks',
        method: 'GET',
        riskScore: 0.1,
        deviceFingerprint: 'fp-abc123',
        geoLocation: 'US-CA',
        previousLogins: 5,
        suspiciousActivity: false,
        rateLimitStatus: {
          remaining: 95,
          reset: new Date(Date.now() + 3600000),
        },
      };

      expect(context.requestId).toBe('req-123');
      expect(context.ipAddress).toBe('192.168.1.1');
      expect(context.suspiciousActivity).toBe(false);
      expect(context.rateLimitStatus.remaining).toBe(95);
    });
  });

  describe('WorkspaceContext', () => {
    it('should define workspace-specific context', () => {
      const context: WorkspaceContext = {
        workspaceId: 'ws-123',
        workspaceName: 'My Workspace',
        role: 'admin',
        permissions: ['manage:workspace', 'create:projects'],
      };

      expect(context.workspaceId).toBe('ws-123');
      expect(context.role).toBe('admin');
      expect(context.permissions).toContain('manage:workspace');
    });
  });

  describe('AuthContext', () => {
    it('should capture authentication context', () => {
      const context: AuthContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/91.0',
        deviceFingerprint: 'fp-xyz789',
        requestPath: '/api/users/profile',
        requestMethod: 'PUT',
        correlationId: 'corr-abc123',
        loginTime: new Date('2024-01-01T10:00:00Z'),
        lastActivity: new Date('2024-01-01T10:30:00Z'),
      };

      expect(context.userId).toBe('user-123');
      expect(context.requestPath).toBe('/api/users/profile');
      expect(context.requestMethod).toBe('PUT');
      expect(context.correlationId).toBe('corr-abc123');
    });

    it('should allow optional fields', () => {
      const context: AuthContext = {
        requestPath: '/api/public/health',
        requestMethod: 'GET',
        correlationId: 'corr-public-123',
      };

      expect(context.userId).toBeUndefined();
      expect(context.sessionId).toBeUndefined();
      expect(context.requestPath).toBe('/api/public/health');
    });
  });

  describe('TokenPayload', () => {
    it('should define JWT token structure', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user', 'admin'],
        permissions: ['read:tasks', 'write:tasks'],
        sessionId: 'session-456',
        workspaceId: 'workspace-789',
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(payload.userId).toBe('user-123');
      expect(payload.sub).toBe('user-123');
      expect(payload.roles).toContain('admin');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe('AccessContext', () => {
    it('should define RBAC access context', () => {
      const context: AccessContext = {
        userId: 'user-123',
        resource: 'tasks',
        action: 'read',
        resourceId: 'task-456',
        workspaceId: 'workspace-789',
      };

      expect(context.userId).toBe('user-123');
      expect(context.resource).toBe('tasks');
      expect(context.action).toBe('read');
      expect(context.resourceId).toBe('task-456');
    });

    it('should allow optional resource ID and workspace ID', () => {
      const context: AccessContext = {
        userId: 'user-123',
        resource: 'workspaces',
        action: 'create',
      };

      expect(context.resourceId).toBeUndefined();
      expect(context.workspaceId).toBeUndefined();
    });
  });
});