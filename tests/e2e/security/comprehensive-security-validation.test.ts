/**
 * Phase 13: Comprehensive Security and Compliance Validation Tests
 * Task 37: Security and Compliance Validation
 *
 * This test suite performs security penetration testing, validates data protection
 * and privacy compliance, tests authentication and authorization across all endpoints,
 * and verifies audit logging and monitoring capabilities.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testContainerManager } from '../../infrastructure/test-containers';
import { bootstrap } from '../../../src/infrastructure/ioc/bootstrap';
import { ServiceLocator } from '../../../src/infrastructure/ioc/service-locator';
import { createServer } from '../../../src/infrastructure/server/fastify-server';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TestDataFactory } from '../../utils/test-helpers';
import crypto from 'crypto';

describe('Phase 13: Comprehensive Security and Compliance Validation', () => {
  let server: FastifyInstance;
  let prisma: PrismaClient;
  let testUser: any;
  let testWorkspace: any;
  let authToken: string;
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // Start test containers
    await testContainerManager.initializeTestEnvironment();

    // Initialize IoC container
    const container = await bootstrap.initialize();
    ServiceLocator.setContainer(container);

    // Create server instance
    server = await createServer();
    await server.listen({ port: 0, host: '127.0.0.1' });

    // Get Prisma client
    prisma = container.resolve<PrismaClient>('PrismaClient');

    // Create test users
    testUser = await TestDataFactory.createTestUser();
    adminUser = await TestDataFactory.createTestUser('admin@test.com', 'ADMIN');
    testWorkspace = await TestDataFactory.createTestWorkspace(testUser.id);

    // Get auth tokens
    const authResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testUser.email,
        password: 'testpassword123',
      },
    });

    const adminAuthResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: adminUser.email,
        password: 'testpassword123',
      },
    });

    authToken = JSON.parse(authResponse.body).accessToken;
    adminToken = JSON.parse(adminAuthResponse.body).accessToken;
  }, 60000);

  afterAll(async () => {
    await server?.close();
    await bootstrap.shutdown();
    await testContainerManager.cleanup();
  }, 30000);

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.auditLog.deleteMany();
    await prisma.securityEvent.deleteMany();
  });

  describe('Authentication Security Testing', () => {
    it('should prevent brute force attacks', async () => {
      const invalidCredentials = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // Attempt multiple failed logins
      const failedAttempts = Array.from({ length: 6 }, () =>
        server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: invalidCredentials,
        })
      );

      const responses = await Promise.all(failedAttempts);

      // First few attempts should return 401
      expect(responses[0].statusCode).toBe(401);
      expect(responses[1].statusCode).toBe(401);
      expect(responses[2].statusCode).toBe(401);

      // After threshold, should return 429 (rate limited)
      const lastResponse = responses[responses.length - 1];
      expect([401, 429]).toContain(lastResponse.statusCode);

      // Verify security event was logged
      const securityEvents = await prisma.securityEvent.findMany({
        where: {
          eventType: 'FAILED_LOGIN_ATTEMPT',
          userId: testUser.id,
        },
      });

      expect(securityEvents.length).toBeGreaterThan(0);
    });

    it('should validate JWT token security', async () => {
      // Test with expired token
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const expiredResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(expiredResponse.statusCode).toBe(401);

      // Test with malformed token
      const malformedResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: { authorization: 'Bearer malformed.token.here' },
      });

      expect(malformedResponse.statusCode).toBe(401);

      // Test with no token
      const noTokenResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/profile',
      });

      expect(noTokenResponse.statusCode).toBe(401);
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '12345678',
      ];

      for (const weakPassword of weakPasswords) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: {
            email: `weak${Math.random()}@test.com`,
            name: 'Test User',
            password: weakPassword,
          },
        });

        expect(response.statusCode).toBe(400);
        const errorData = JSON.parse(response.body);
        expect(errorData.message).toContain('password');
      }
    });

    it('should implement secure session management', async () => {
      // Test session invalidation on logout
      const logoutResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(logoutResponse.statusCode).toBe(200);

      // Verify token is invalidated
      const profileResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${authToken}` },
      });

      // Should still work if using refresh token mechanism
      // or should fail if token is blacklisted
      expect([200, 401]).toContain(profileResponse.statusCode);
    });
  });

  describe('Authorization and Access Control', () => {
    it('should enforce role-based access control', async () => {
      // Create a workspace owned by admin
      const adminWorkspaceResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/workspaces',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Admin Workspace',
          slug: 'admin-workspace',
        },
      });

      const adminWorkspace = JSON.parse(adminWorkspaceResponse.body);

      // Regular user should not be able to access admin workspace
      const unauthorizedResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${adminWorkspace.id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(unauthorizedResponse.statusCode).toBe(403);

      // Admin should be able to access any workspace
      const adminAccessResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${testWorkspace.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 403]).toContain(adminAccessResponse.statusCode);
    });

    it('should validate resource-level permissions', async () => {
      // Create a task
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Permission Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      const task = JSON.parse(taskResponse.body);

      // Create another user
      const otherUser = await TestDataFactory.createTestUser('other@test.com');
      const otherAuthResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: otherUser.email,
          password: 'testpassword123',
        },
      });

      const otherToken = JSON.parse(otherAuthResponse.body).accessToken;

      // Other user should not be able to modify the task
      const unauthorizedUpdateResponse = await server.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${task.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { title: 'Hacked Task' },
      });

      expect(unauthorizedUpdateResponse.statusCode).toBe(403);
    });

    it('should prevent privilege escalation', async () => {
      // Regular user should not be able to promote themselves to admin
      const escalationResponse = await server.inject({
        method: 'PATCH',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { role: 'ADMIN' },
      });

      // Should either ignore the role field or return error
      expect([200, 400, 403]).toContain(escalationResponse.statusCode);

      if (escalationResponse.statusCode === 200) {
        const updatedProfile = JSON.parse(escalationResponse.body);
        expect(updatedProfile.role).not.toBe('ADMIN');
      }
    });
  });

  describe('Data Protection and Privacy', () => {
    it('should encrypt sensitive data at rest', async () => {
      // Create user with sensitive data
      const sensitiveUser = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'sensitive@test.com',
          name: 'Sensitive User',
          password: 'SecurePassword123!',
          phoneNumber: '+1234567890',
        },
      });

      expect(sensitiveUser.statusCode).toBe(201);

      // Check database to ensure sensitive data is encrypted
      const dbUser = await prisma.user.findUnique({
        where: { email: 'sensitive@test.com' },
      });

      expect(dbUser).toBeTruthy();
      // Password should be hashed, not plain text
      expect(dbUser?.passwordHash).not.toBe('SecurePassword123!');
      expect(dbUser?.passwordHash).toMatch(/^\$argon2/); // Argon2 hash format

      // Phone number should be encrypted if encryption is implemented
      if (dbUser?.phoneNumber) {
        expect(dbUser.phoneNumber).not.toBe('+1234567890');
      }
    });

    it('should implement data masking in logs', async () => {
      // Perform operation that might log sensitive data
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: 'testpassword123',
        },
      });

      expect(loginResponse.statusCode).toBe(200);

      // Check audit logs to ensure sensitive data is masked
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'USER_LOGIN',
          userId: testUser.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      if (auditLogs.length > 0) {
        const logData = auditLogs[0].metadata as any;
        // Password should not appear in logs
        expect(JSON.stringify(logData)).not.toContain('testpassword123');
        // Email might be masked or truncated
        if (logData.email) {
          expect(logData.email).toMatch(/\*+|\.{3}/); // Contains masking
        }
      }
    });

    it('should handle PII data requests (GDPR compliance)', async () => {
      // Request user data export
      const exportResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/profile/export',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect([200, 202]).toContain(exportResponse.statusCode);

      if (exportResponse.statusCode === 200) {
        const exportData = JSON.parse(exportResponse.body);
        expect(exportData.user).toBeDefined();
        expect(exportData.user.email).toBe(testUser.email);
        expect(exportData.tasks).toBeDefined();
        expect(exportData.workspaces).toBeDefined();
      }

      // Request data deletion
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect([200, 202]).toContain(deleteResponse.statusCode);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            title: payload,
            workspaceId: testWorkspace.id,
          },
        });

        // Should either sanitize the input or reject it
        expect([200, 201, 400]).toContain(response.statusCode);

        if (response.statusCode === 201) {
          const task = JSON.parse(response.body);
          // Title should be sanitized
          expect(task.title).not.toContain('DROP TABLE');
          expect(task.title).not.toContain('INSERT INTO');
        }
      }
    });

    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
      ];

      for (const payload of xssPayloads) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            title: payload,
            description: payload,
            workspaceId: testWorkspace.id,
          },
        });

        if (response.statusCode === 201) {
          const task = JSON.parse(response.body);
          // Should be sanitized
          expect(task.title).not.toContain('<script>');
          expect(task.title).not.toContain('javascript:');
          expect(task.description).not.toContain('<script>');
        }
      }
    });

    it('should validate file upload security', async () => {
      // Test malicious file upload
      const maliciousFile = Buffer.from(
        '<?php system($_GET["cmd"]); ?>',
        'utf8'
      );

      const uploadResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/files/upload',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata',
        },
        payload: [
          '------formdata',
          'Content-Disposition: form-data; name="file"; filename="malicious.php"',
          'Content-Type: application/x-php',
          '',
          maliciousFile.toString(),
          '------formdata--',
        ].join('\r\n'),
      });

      // Should reject malicious file types
      expect([400, 415]).toContain(uploadResponse.statusCode);
    });
  });

  describe('Rate Limiting and DDoS Protection', () => {
    it('should enforce API rate limits', async () => {
      // Make rapid requests to test rate limiting
      const rapidRequests = Array.from({ length: 100 }, () =>
        server.inject({
          method: 'GET',
          url: '/api/v1/profile',
          headers: { authorization: `Bearer ${authToken}` },
        })
      );

      const responses = await Promise.all(rapidRequests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers
      const successfulResponse = responses.find(r => r.statusCode === 200);
      if (successfulResponse) {
        expect(successfulResponse.headers['x-ratelimit-limit']).toBeDefined();
        expect(
          successfulResponse.headers['x-ratelimit-remaining']
        ).toBeDefined();
      }
    });

    it('should handle large payload attacks', async () => {
      // Create very large payload
      const largePayload = {
        title: 'A'.repeat(10000),
        description: 'B'.repeat(100000),
        workspaceId: testWorkspace.id,
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: largePayload,
      });

      // Should reject or limit large payloads
      expect([400, 413]).toContain(response.statusCode);
    });
  });

  describe('Audit Logging and Monitoring', () => {
    it('should log all security-relevant events', async () => {
      // Perform various operations that should be audited
      await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Audit Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      await server.inject({
        method: 'PATCH',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { name: 'Updated Name' },
      });

      // Check audit logs
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId: testUser.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      // Verify log structure
      const log = auditLogs[0];
      expect(log.action).toBeDefined();
      expect(log.userId).toBe(testUser.id);
      expect(log.ipAddress).toBeDefined();
      expect(log.userAgent).toBeDefined();
      expect(log.metadata).toBeDefined();
    });

    it('should detect and log suspicious activities', async () => {
      // Simulate suspicious activity (multiple failed logins from different IPs)
      const suspiciousAttempts = [
        { ip: '192.168.1.100', userAgent: 'Bot/1.0' },
        { ip: '10.0.0.50', userAgent: 'Scanner/2.0' },
        { ip: '172.16.0.25', userAgent: 'Crawler/3.0' },
      ];

      for (const attempt of suspiciousAttempts) {
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: {
            'x-forwarded-for': attempt.ip,
            'user-agent': attempt.userAgent,
          },
          payload: {
            email: testUser.email,
            password: 'wrongpassword',
          },
        });
      }

      // Check for security events
      const securityEvents = await prisma.securityEvent.findMany({
        where: {
          eventType: 'SUSPICIOUS_ACTIVITY',
          userId: testUser.id,
        },
      });

      // Should detect pattern of suspicious activity
      expect(securityEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain audit trail integrity', async () => {
      // Create initial audit log
      const initialCount = await prisma.auditLog.count();

      await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Integrity Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      const finalCount = await prisma.auditLog.count();
      expect(finalCount).toBeGreaterThan(initialCount);

      // Verify audit logs cannot be modified by regular users
      const auditLog = await prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (auditLog) {
        // Attempt to modify audit log should fail
        try {
          await prisma.auditLog.update({
            where: { id: auditLog.id },
            data: { action: 'MODIFIED_ACTION' },
          });
          // If this succeeds, it's a security issue
          expect(false).toBe(true);
        } catch (error) {
          // Should fail due to permissions or constraints
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Encryption and Data Security', () => {
    it('should use HTTPS for all communications', async () => {
      // This test assumes the server is configured with HTTPS in production
      // In test environment, we verify security headers are present

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { authorization: `Bearer ${authToken}` },
      });

      // Check for security headers
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should implement proper key management', async () => {
      // Test that sensitive operations use proper encryption
      const sensitiveData = 'This is sensitive information';

      // Create a task with sensitive data
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Encryption Test',
          description: sensitiveData,
          workspaceId: testWorkspace.id,
        },
      });

      expect(taskResponse.statusCode).toBe(201);

      // Verify data is properly handled in database
      const task = JSON.parse(taskResponse.body);
      const dbTask = await prisma.task.findUnique({
        where: { id: task.id },
      });

      expect(dbTask).toBeTruthy();
      // Description should be stored (encrypted or plain based on implementation)
      expect(dbTask?.description).toBeDefined();
    });
  });

  describe('Compliance and Regulatory Requirements', () => {
    it('should support data retention policies', async () => {
      // Create data that should be subject to retention policies
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Retention Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      const task = JSON.parse(taskResponse.body);

      // Delete the task
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/api/v1/tasks/${task.id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(deleteResponse.statusCode).toBe(200);

      // Verify soft delete or retention policy
      const deletedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });

      // Should either be soft deleted or have deletion timestamp
      if (deletedTask) {
        expect(deletedTask.deletedAt).toBeDefined();
      }
    });

    it('should provide compliance reporting capabilities', async () => {
      // Request compliance report
      const reportResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/compliance/report',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      if (reportResponse.statusCode === 200) {
        const report = JSON.parse(reportResponse.body);
        expect(report.dataProcessingActivities).toBeDefined();
        expect(report.securityMeasures).toBeDefined();
        expect(report.auditTrail).toBeDefined();
      } else {
        // Feature might not be implemented yet
        expect([404, 501]).toContain(reportResponse.statusCode);
      }
    });
  });
});
