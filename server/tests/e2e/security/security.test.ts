import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '@/app';
import { TestDataFactory, DatabaseHelpers } from '../../helpers/test-helpers';

describe('Security Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUser: any;
  let testProject: any;
  let testWorkspace: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    await DatabaseHelpers.seedTestData();

    // Setup test data
    testUser = TestDataFactory.createUserData();
    testWorkspace = TestDataFactory.createWorkspaceData();
    testProject = TestDataFactory.createProjectData(
      testWorkspace.id,
      testUser.id
    );

    // Register and login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testUser.email,
        password: 'TestPassword123!',
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'TestPassword123!',
      },
    });

    authToken = JSON.parse(loginResponse.body).data.accessToken;

    // Create workspace and project
    const workspaceResponse = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: testWorkspace.name,
        description: testWorkspace.description,
      },
    });

    testWorkspace.id = JSON.parse(workspaceResponse.body).data.id;

    const projectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        workspaceId: testWorkspace.id,
        name: testProject.name,
        description: testProject.description,
        startDate: testProject.startDate,
        endDate: testProject.endDate,
      },
    });

    testProject.id = JSON.parse(projectResponse.body).data.id;
  });

  afterAll(async () => {
    await DatabaseHelpers.cleanupDatabase();
    await app.close();
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks',
      });

      expect(response.statusCode).toBe(401);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain('authentication');
    });

    it('should reject requests with invalid authentication token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with malformed authentication header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: {
          authorization: 'InvalidFormat token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject expired tokens', async () => {
      // This would require creating an expired token
      // For now, we'll test with a clearly invalid token structure
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Authorization Security', () => {
    let otherUserToken: string;
    let otherUserProject: any;

    beforeAll(async () => {
      // Create another user
      const otherUser = TestDataFactory.createUserData();

      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: otherUser.email,
          password: 'OtherPassword123!',
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
        },
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: otherUser.email,
          password: 'OtherPassword123!',
        },
      });

      otherUserToken = JSON.parse(loginResponse.body).data.accessToken;

      // Create workspace and project for other user
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        headers: { authorization: `Bearer ${otherUserToken}` },
        payload: {
          name: 'Other Workspace',
          description: 'Other user workspace',
        },
      });

      const otherWorkspaceId = JSON.parse(workspaceResponse.body).data.id;

      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { authorization: `Bearer ${otherUserToken}` },
        payload: {
          workspaceId: otherWorkspaceId,
          name: 'Other Project',
          description: 'Other user project',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      otherUserProject = JSON.parse(projectResponse.body).data;
    });

    it('should prevent access to other users projects', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${otherUserProject.id}/tasks`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should prevent creating tasks in other users projects', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: otherUserProject.id,
          assigneeId: testUser.id,
          title: 'Unauthorized Task',
          description: 'This should fail',
          priority: 'MEDIUM',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should prevent updating other users tasks', async () => {
      // Create a task with the other user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${otherUserToken}`,
        },
        payload: {
          projectId: otherUserProject.id,
          assigneeId: testUser.id, // Note: using testUser.id as assignee
          title: 'Other User Task',
          description: 'Task created by other user',
          priority: 'MEDIUM',
        },
      });

      const task = JSON.parse(createResponse.body).data;

      // Try to update with first user's token
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/tasks/${task.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Hacked Task',
        },
      });

      expect(updateResponse.statusCode).toBe(403);
    });

    it('should prevent deleting other users tasks', async () => {
      // Create a task with the other user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${otherUserToken}`,
        },
        payload: {
          projectId: otherUserProject.id,
          assigneeId: testUser.id,
          title: 'Task to Delete',
          description: 'This task should not be deletable by other user',
          priority: 'MEDIUM',
        },
      });

      const task = JSON.parse(createResponse.body).data;

      // Try to delete with first user's token
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/tasks/${task.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(deleteResponse.statusCode).toBe(403);
    });
  });

  describe('Input Validation Security', () => {
    it('should sanitize HTML input', async () => {
      const maliciousInput = '<script>alert("XSS")</script>Malicious Task';

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: maliciousInput,
          description: '<img src="x" onerror="alert(1)">',
          priority: 'MEDIUM',
        },
      });

      expect(response.statusCode).toBe(201);

      const task = JSON.parse(response.body).data;
      // The malicious script should be sanitized
      expect(task.title).not.toContain('<script>');
      expect(task.title).not.toContain('alert');
      expect(task.description).not.toContain('onerror');
    });

    it('should reject SQL injection attempts', async () => {
      const sqlInjection = "'; DROP TABLE tasks; --";

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: sqlInjection,
          description: 'SQL injection test',
          priority: 'MEDIUM',
        },
      });

      // Should either succeed with sanitized input or fail validation
      if (response.statusCode === 201) {
        const task = JSON.parse(response.body).data;
        expect(task.title).not.toContain('DROP TABLE');
      } else {
        expect(response.statusCode).toBe(400);
      }
    });

    it('should validate input lengths', async () => {
      const veryLongTitle = 'A'.repeat(1000);
      const veryLongDescription = 'B'.repeat(10000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: veryLongTitle,
          description: veryLongDescription,
          priority: 'MEDIUM',
        },
      });

      expect(response.statusCode).toBe(400);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toMatch(/length|size|long/i);
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          // Missing required fields
          priority: 'MEDIUM',
        },
      });

      expect(response.statusCode).toBe(400);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toMatch(/required|missing/i);
    });

    it('should validate data types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: 'Type Test Task',
          description: 'Testing invalid types',
          priority: 'INVALID_PRIORITY',
          estimatedHours: 'not-a-number',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const promises: Promise<any>[] = [];

      // Make many requests quickly
      for (let i = 0; i < 100; i++) {
        promises.push(
          app.inject({
            method: 'GET',
            url: `/api/projects/${testProject.id}/tasks`,
            headers: {
              authorization: `Bearer ${authToken}`,
            },
          })
        );
      }

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should enforce rate limits on authentication endpoints', async () => {
      const promises: Promise<any>[] = [];

      // Make many login attempts
      for (let i = 0; i < 20; i++) {
        promises.push(
          app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
              email: 'nonexistent@example.com',
              password: 'wrongpassword',
            },
          })
        );
      }

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Security', () => {
    it('should include proper CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/tasks',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: {
          origin: 'https://malicious-site.com',
          authorization: `Bearer ${authToken}`,
        },
      });

      // Should either reject the request or not include CORS headers for unauthorized origin
      if (response.statusCode === 200) {
        expect(response.headers['access-control-allow-origin']).not.toBe(
          'https://malicious-site.com'
        );
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should not expose sensitive server information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      // Should not expose server version or other sensitive info
      expect(response.headers.server).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/non-existent-task',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);

      const responseData = JSON.parse(response.body);
      // Error message should not contain database details, file paths, etc.
      expect(responseData.error.message).not.toMatch(
        /database|sql|file|path|stack/i
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: '{"invalid": json}',
      });

      expect(response.statusCode).toBe(400);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(false);
      // Should not expose JSON parsing details
      expect(responseData.error.message).not.toContain('JSON.parse');
    });
  });

  describe('Session Security', () => {
    it('should invalidate tokens after logout', async () => {
      // First, verify the token works
      const beforeLogout = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(beforeLogout.statusCode).toBe(200);

      // Logout
      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);

      // Try to use the token after logout
      const afterLogout = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(afterLogout.statusCode).toBe(401);
    });
  });

  describe('Data Exposure Security', () => {
    it('should not expose sensitive user data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const userData = JSON.parse(response.body).data;
      // Should not expose password hash or other sensitive data
      expect(userData.password).toBeUndefined();
      expect(userData.passwordHash).toBeUndefined();
      expect(userData.salt).toBeUndefined();
    });

    it('should not expose internal IDs in error messages', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: 'invalid-project-id',
          assigneeId: testUser.id,
          title: 'Test Task',
          description: 'Test',
          priority: 'MEDIUM',
        },
      });

      expect(response.statusCode).toBe(404);

      const responseData = JSON.parse(response.body);
      // Should not expose internal database IDs or structure
      expect(responseData.error.message).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
    });
  });
});
