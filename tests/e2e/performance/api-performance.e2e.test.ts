import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  createCompleteTestScenario,
  assertResponseTime,
  simulateConcurrentRequests,
} from '../test-server';
import { TestScenarios } from '../../infrastructure/test-scenarios';
import { TestAssertions } from '../../infrastructure/test-assertions';

describe('API Performance E2E', () => {
  let app: FastifyInstance;
  let scenarios: TestScenarios;
  let testData: any;

  beforeAll(async () => {
    app = await createTestServer();
    scenarios = new TestScenarios(globalThis.testContext.clients.prisma!);

    // Create performance test scenario with large dataset
    await scenarios.createPerformanceScenario();
    testData = await createCompleteTestScenario(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache to ensure consistent performance testing
    if (globalThis.testContext.clients.redis) {
      await globalThis.testContext.clients.redis.flushall();
    }
  });

  describe('authentication performance', () => {
    it('should handle login requests within acceptable time', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@example.com',
          password: 'Password123!',
        },
      });

      assertResponseTime(startTime, 200, 'Login request');
      expect(response.statusCode).toBe(200);
    });

    it('should handle concurrent login requests efficiently', async () => {
      const startTime = Date.now();

      const responses = await simulateConcurrentRequests(
        () =>
          app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
              email: 'owner@example.com',
              password: 'Password123!',
            },
          }),
        20
      );

      assertResponseTime(startTime, 2000, '20 concurrent login requests');

      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });

    it('should handle token refresh efficiently', async () => {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@example.com',
          password: 'Password123!',
        },
      });

      const { refreshToken } = loginResponse.json();
      const startTime = Date.now();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      });

      assertResponseTime(startTime, 100, 'Token refresh');
      expect(response.statusCode).toBe(200);
    });
  });

  describe('task management performance', () => {
    it('should list tasks with pagination efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/tasks?limit=50&offset=0`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      assertResponseTime(startTime, 300, 'Task list with pagination');
      expect(response.statusCode).toBe(200);

      const data = response.json();
      expect(data.items).toBeDefined();
      expect(data.totalCount).toBeDefined();
      expect(data.page).toBeDefined();
    });

    it('should handle task search with filters efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/tasks?search=test&status=TODO&priority=HIGH`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      assertResponseTime(startTime, 400, 'Task search with filters');
      expect(response.statusCode).toBe(200);
    });

    it('should create tasks efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'POST',
        url: `/api/workspaces/${testData.workspace.id}/projects/${testData.projects[0].id}/tasks`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: {
          title: 'Performance Test Task',
          description: 'Task created for performance testing',
          priority: 'MEDIUM',
        },
      });

      assertResponseTime(startTime, 200, 'Task creation');
      expect(response.statusCode).toBe(201);
    });

    it('should handle bulk task operations efficiently', async () => {
      const taskIds = testData.tasks.map((task: any) => task.id);
      const startTime = Date.now();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/workspaces/${testData.workspace.id}/tasks/bulk`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: {
          taskIds,
          updates: {
            status: 'IN_PROGRESS',
          },
        },
      });

      assertResponseTime(startTime, 500, 'Bulk task update');
      expect(response.statusCode).toBe(200);
    });

    it('should handle concurrent task updates without conflicts', async () => {
      const taskId = testData.tasks[0].id;
      const startTime = Date.now();

      const responses = await simulateConcurrentRequests(
        () =>
          app.inject({
            method: 'PATCH',
            url: `/api/workspaces/${testData.workspace.id}/tasks/${taskId}`,
            headers: {
              authorization: `Bearer ${testData.users[0].accessToken}`,
            },
            payload: {
              description: `Updated at ${Date.now()}`,
            },
          }),
        10
      );

      assertResponseTime(startTime, 1000, '10 concurrent task updates');

      // At least one should succeed
      const successfulResponses = responses.filter(r => r.statusCode === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('workspace and project performance', () => {
    it('should load workspace dashboard efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/dashboard`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      assertResponseTime(startTime, 500, 'Workspace dashboard load');
      expect(response.statusCode).toBe(200);

      const data = response.json();
      expect(data.stats).toBeDefined();
      expect(data.recentActivity).toBeDefined();
    });

    it('should handle project listing with statistics efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/projects?includeStats=true`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      assertResponseTime(startTime, 300, 'Project listing with statistics');
      expect(response.statusCode).toBe(200);

      const data = response.json();
      expect(Array.isArray(data.items)).toBe(true);
      data.items.forEach((project: any) => {
        expect(project.stats).toBeDefined();
      });
    });

    it('should handle workspace member operations efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'POST',
        url: `/api/workspaces/${testData.workspace.id}/members`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: {
          email: 'newmember@example.com',
          role: 'MEMBER',
        },
      });

      assertResponseTime(startTime, 300, 'Workspace member invitation');
      expect(response.statusCode).toBe(201);
    });
  });

  describe('real-time features performance', () => {
    it('should handle WebSocket connections efficiently', async () => {
      // This would test WebSocket connection establishment time
      // For now, we'll test the HTTP endpoint that provides real-time data
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/presence`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      assertResponseTime(startTime, 100, 'Presence data retrieval');
      expect(response.statusCode).toBe(200);
    });

    it('should handle notification delivery efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'POST',
        url: `/api/notifications`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: {
          type: 'TASK_ASSIGNED',
          recipientId: testData.users[1].user.id,
          data: {
            taskId: testData.tasks[0].id,
            taskTitle: testData.tasks[0].title,
          },
        },
      });

      assertResponseTime(startTime, 200, 'Notification delivery');
      expect(response.statusCode).toBe(201);
    });
  });

  describe('file upload performance', () => {
    it('should handle small file uploads efficiently', async () => {
      const fileContent = Buffer.from('Small test file content');
      const startTime = Date.now();

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([fileContent], { type: 'text/plain' }),
        'small-test.txt'
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/files/upload',
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: formData,
      });

      assertResponseTime(startTime, 500, 'Small file upload');
      expect(response.statusCode).toBe(201);
    });

    it('should handle medium file uploads within reasonable time', async () => {
      const fileContent = Buffer.alloc(1024 * 1024, 'x'); // 1MB file
      const startTime = Date.now();

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([fileContent], { type: 'application/octet-stream' }),
        'medium-test.bin'
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/files/upload',
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: formData,
      });

      assertResponseTime(startTime, 5000, 'Medium file upload (1MB)');
      expect(response.statusCode).toBe(201);
    });
  });

  describe('database query performance', () => {
    it('should handle complex aggregation queries efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/analytics/tasks`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        query: {
          groupBy: 'status,priority',
          dateRange: '30d',
        },
      });

      assertResponseTime(startTime, 800, 'Complex analytics query');
      expect(response.statusCode).toBe(200);

      const data = response.json();
      expect(data.aggregations).toBeDefined();
    });

    it('should handle full-text search efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/search`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        query: {
          q: 'test task performance',
          type: 'tasks',
          limit: '20',
        },
      });

      assertResponseTime(startTime, 400, 'Full-text search');
      expect(response.statusCode).toBe(200);

      const data = response.json();
      expect(data.results).toBeDefined();
      expect(data.totalCount).toBeDefined();
    });
  });

  describe('cache performance', () => {
    it('should benefit from caching on repeated requests', async () => {
      const url = `/api/workspaces/${testData.workspace.id}/projects`;
      const headers = {
        authorization: `Bearer ${testData.users[0].accessToken}`,
      };

      // First request (cache miss)
      const startTime1 = Date.now();
      const response1 = await app.inject({
        method: 'GET',
        url,
        headers,
      });
      const duration1 = Date.now() - startTime1;

      expect(response1.statusCode).toBe(200);

      // Second request (cache hit)
      const startTime2 = Date.now();
      const response2 = await app.inject({
        method: 'GET',
        url,
        headers,
      });
      const duration2 = Date.now() - startTime2;

      expect(response2.statusCode).toBe(200);

      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.8);

      // Verify same data
      expect(response1.json()).toEqual(response2.json());
    });

    it('should handle cache invalidation efficiently', async () => {
      const projectId = testData.projects[0].id;

      // Cache the project data
      await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      // Update the project (should invalidate cache)
      const startTime = Date.now();
      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/workspaces/${testData.workspace.id}/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
        payload: {
          description: 'Updated description for cache test',
        },
      });

      assertResponseTime(
        startTime,
        300,
        'Project update with cache invalidation'
      );
      expect(updateResponse.statusCode).toBe(200);

      // Verify cache was invalidated by checking updated data
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${testData.workspace.id}/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${testData.users[0].accessToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json().description).toBe(
        'Updated description for cache test'
      );
    });
  });

  describe('memory and resource usage', () => {
    it('should not leak memory during bulk operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      const operations = Array.from({ length: 100 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: `/api/workspaces/${testData.workspace.id}/projects/${testData.projects[0].id}/tasks`,
          headers: {
            authorization: `Bearer ${testData.users[0].accessToken}`,
          },
          payload: {
            title: `Bulk Task ${i}`,
            description: `Task created for memory test ${i}`,
            priority: 'LOW',
          },
        })
      );

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB for 100 operations)
      TestAssertions.assertMemoryUsage(memoryIncrease, 50 * 1024 * 1024);
    });

    it('should handle high concurrency without resource exhaustion', async () => {
      const startTime = Date.now();

      // Simulate high concurrency
      const responses = await simulateConcurrentRequests(
        () =>
          app.inject({
            method: 'GET',
            url: `/api/workspaces/${testData.workspace.id}/tasks?limit=10`,
            headers: {
              authorization: `Bearer ${testData.users[0].accessToken}`,
            },
          }),
        50
      );

      assertResponseTime(startTime, 3000, '50 concurrent requests');

      // All requests should succeed or fail gracefully
      responses.forEach(response => {
        expect([200, 429, 503]).toContain(response.statusCode);
      });

      // Majority should succeed
      const successfulResponses = responses.filter(r => r.statusCode === 200);
      expect(successfulResponses.length).toBeGreaterThan(
        responses.length * 0.7
      );
    });
  });

  describe('rate limiting performance', () => {
    it('should enforce rate limits without significant performance impact', async () => {
      const startTime = Date.now();

      // Make requests up to the rate limit
      const responses = await simulateConcurrentRequests(
        () =>
          app.inject({
            method: 'GET',
            url: `/api/workspaces/${testData.workspace.id}/tasks`,
            headers: {
              authorization: `Bearer ${testData.users[0].accessToken}`,
            },
          }),
        30
      );

      assertResponseTime(startTime, 2000, 'Rate limiting enforcement');

      const successfulResponses = responses.filter(r => r.statusCode === 200);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);

      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
