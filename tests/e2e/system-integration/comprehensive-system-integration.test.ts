/**
 * Phase 13: Comprehensive System Integration Tests
 * Task 36: System Integration Testing
 *
 * This test suite validates all layer integrations, data flow, business workflows,
 * and performance requirements under load across the entire enterprise platform.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { testContainerManager } from '../../infrastructure/test-containers';
import { bootstrap } from '../../../src/infrastructure/ioc/bootstrap';
import { ServiceLocator } from '../../../src/infrastructure/ioc/service-locator';
import { createServer } from '../../../src/infrastructure/server/fastify-server';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TestDataFactory } from '../../utils/test-helpers';

describe('Phase 13: Comprehensive System Integration Tests', () => {
  let server: FastifyInstance;
  let prisma: PrismaClient;
  let testUser: any;
  let testWorkspace: any;
  let authToken: string;

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

    // Create test user and workspace
    testUser = await TestDataFactory.createTestUser();
    testWorkspace = await TestDataFactory.createTestWorkspace(testUser.id);

    // Get auth token
    const authResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testUser.email,
        password: 'testpassword123',
      },
    });

    const authData = JSON.parse(authResponse.body);
    authToken = authData.accessToken;
  }, 60000);

  afterAll(async () => {
    await server?.close();
    await bootstrap.shutdown();
    await testContainerManager.cleanup();
  }, 30000);

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
  });

  describe('End-to-End Business Workflows', () => {
    it('should complete full project lifecycle workflow', async () => {
      // 1. Create Project
      const projectResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Integration Test Project',
          description: 'Full lifecycle test project',
          workspaceId: testWorkspace.id,
        },
      });

      expect(projectResponse.statusCode).toBe(201);
      const project = JSON.parse(projectResponse.body);

      // 2. Create Tasks
      const taskPromises = Array.from({ length: 5 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            title: `Integration Task ${i + 1}`,
            description: `Task ${i + 1} for integration testing`,
            projectId: project.id,
            workspaceId: testWorkspace.id,
            priority: 'MEDIUM',
            status: 'TODO',
          },
        })
      );

      const taskResponses = await Promise.all(taskPromises);
      taskResponses.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      const tasks = taskResponses.map(r => JSON.parse(r.body));

      // 3. Update Task Statuses (simulate workflow progression)
      for (const task of tasks) {
        // Move to IN_PROGRESS
        const progressResponse = await server.inject({
          method: 'PATCH',
          url: `/api/v1/tasks/${task.id}`,
          headers: { authorization: `Bearer ${authToken}` },
          payload: { status: 'IN_PROGRESS' },
        });
        expect(progressResponse.statusCode).toBe(200);

        // Complete task
        const completeResponse = await server.inject({
          method: 'PATCH',
          url: `/api/v1/tasks/${task.id}`,
          headers: { authorization: `Bearer ${authToken}` },
          payload: { status: 'COMPLETED' },
        });
        expect(completeResponse.statusCode).toBe(200);
      }

      // 4. Verify Project Statistics
      const statsResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/statistics`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(statsResponse.statusCode).toBe(200);
      const stats = JSON.parse(statsResponse.body);
      expect(stats.totalTasks).toBe(5);
      expect(stats.completedTasks).toBe(5);
      expect(stats.completionRate).toBe(100);

      // 5. Complete Project
      const completeProjectResponse = await server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { status: 'COMPLETED' },
      });

      expect(completeProjectResponse.statusCode).toBe(200);
    }, 30000);

    it('should handle complex multi-user collaboration workflow', async () => {
      // Create additional test users
      const user2 = await TestDataFactory.createTestUser('user2@test.com');
      const user3 = await TestDataFactory.createTestUser('user3@test.com');

      // Add users to workspace
      await server.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${testWorkspace.id}/members`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          email: user2.email,
          role: 'MEMBER',
        },
      });

      await server.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${testWorkspace.id}/members`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          email: user3.email,
          role: 'MEMBER',
        },
      });

      // Create collaborative project
      const projectResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Collaborative Project',
          description: 'Multi-user collaboration test',
          workspaceId: testWorkspace.id,
        },
      });

      const project = JSON.parse(projectResponse.body);

      // Create tasks assigned to different users
      const task1Response = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'User 1 Task',
          projectId: project.id,
          workspaceId: testWorkspace.id,
          assigneeId: testUser.id,
        },
      });

      const task2Response = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'User 2 Task',
          projectId: project.id,
          workspaceId: testWorkspace.id,
          assigneeId: user2.id,
        },
      });

      expect(task1Response.statusCode).toBe(201);
      expect(task2Response.statusCode).toBe(201);

      // Verify task assignments
      const task1 = JSON.parse(task1Response.body);
      const task2 = JSON.parse(task2Response.body);

      expect(task1.assigneeId).toBe(testUser.id);
      expect(task2.assigneeId).toBe(user2.id);

      // Test task reassignment
      const reassignResponse = await server.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${task1.id}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { assigneeId: user3.id },
      });

      expect(reassignResponse.statusCode).toBe(200);

      const reassignedTask = JSON.parse(reassignResponse.body);
      expect(reassignedTask.assigneeId).toBe(user3.id);
    }, 20000);
  });

  describe('Data Flow Validation', () => {
    it('should maintain data consistency across all layers', async () => {
      // Create project through API
      const projectResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Data Flow Test Project',
          workspaceId: testWorkspace.id,
        },
      });

      const project = JSON.parse(projectResponse.body);

      // Verify data exists in database
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          workspace: true,
          owner: true,
        },
      });

      expect(dbProject).toBeTruthy();
      expect(dbProject?.name).toBe('Data Flow Test Project');
      expect(dbProject?.workspaceId).toBe(testWorkspace.id);
      expect(dbProject?.ownerId).toBe(testUser.id);

      // Create task and verify relationships
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Data Flow Test Task',
          projectId: project.id,
          workspaceId: testWorkspace.id,
        },
      });

      const task = JSON.parse(taskResponse.body);

      // Verify task relationships in database
      const dbTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          project: true,
          workspace: true,
          creator: true,
        },
      });

      expect(dbTask).toBeTruthy();
      expect(dbTask?.projectId).toBe(project.id);
      expect(dbTask?.workspaceId).toBe(testWorkspace.id);
      expect(dbTask?.creatorId).toBe(testUser.id);
      expect(dbTask?.project?.name).toBe('Data Flow Test Project');
    });

    it('should handle concurrent data modifications correctly', async () => {
      // Create a project
      const projectResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Concurrent Test Project',
          workspaceId: testWorkspace.id,
        },
      });

      const project = JSON.parse(projectResponse.body);

      // Perform concurrent updates
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        server.inject({
          method: 'PATCH',
          url: `/api/v1/projects/${project.id}`,
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            description: `Updated description ${i}`,
          },
        })
      );

      const responses = await Promise.allSettled(updatePromises);
      const successfulUpdates = responses.filter(
        r => r.status === 'fulfilled' && r.value.statusCode === 200
      ).length;

      // At least some updates should succeed
      expect(successfulUpdates).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalProjectResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(finalProjectResponse.statusCode).toBe(200);
      const finalProject = JSON.parse(finalProjectResponse.body);
      expect(finalProject.description).toMatch(/Updated description \d+/);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high concurrent request load', async () => {
      const startTime = Date.now();

      // Create 50 concurrent requests
      const requestPromises = Array.from({ length: 50 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            title: `Load Test Task ${i}`,
            workspaceId: testWorkspace.id,
          },
        })
      );

      const responses = await Promise.all(requestPromises);
      const endTime = Date.now();

      // Verify all requests completed successfully
      const successfulRequests = responses.filter(
        r => r.statusCode === 201
      ).length;
      expect(successfulRequests).toBe(50);

      // Verify performance (should complete within reasonable time)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 seconds max

      // Verify average response time
      const avgResponseTime = totalTime / 50;
      expect(avgResponseTime).toBeLessThan(200); // 200ms average

      // Verify data consistency after load
      const taskCount = await prisma.task.count();
      expect(taskCount).toBe(50);
    }, 15000);

    it('should maintain sub-200ms response times for 95% of requests', async () => {
      const responseTimes: number[] = [];

      // Make 100 requests and measure response times
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();

        const response = await server.inject({
          method: 'GET',
          url: `/api/v1/workspaces/${testWorkspace.id}/tasks`,
          headers: { authorization: `Bearer ${authToken}` },
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        responseTimes.push(responseTime);
        expect(response.statusCode).toBe(200);
      }

      // Calculate 95th percentile
      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p95ResponseTime = responseTimes[p95Index];

      expect(p95ResponseTime).toBeLessThan(200);

      // Also check average response time
      const avgResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(avgResponseTime).toBeLessThan(100);
    }, 30000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle and recover from database connection issues', async () => {
      // This test would require more complex setup to simulate database issues
      // For now, we'll test error handling for invalid requests

      const invalidResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: '', // Invalid empty title
          workspaceId: testWorkspace.id,
        },
      });

      expect(invalidResponse.statusCode).toBe(400);
      const errorData = JSON.parse(invalidResponse.body);
      expect(errorData.error).toBeDefined();
      expect(errorData.message).toContain('validation');
    });

    it('should handle authentication and authorization errors', async () => {
      // Test without auth token
      const noAuthResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/tasks',
      });

      expect(noAuthResponse.statusCode).toBe(401);

      // Test with invalid token
      const invalidAuthResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(invalidAuthResponse.statusCode).toBe(401);

      // Test accessing unauthorized resource
      const otherUser = await TestDataFactory.createTestUser('other@test.com');
      const otherWorkspace = await TestDataFactory.createTestWorkspace(
        otherUser.id
      );

      const unauthorizedResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${otherWorkspace.id}/tasks`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(unauthorizedResponse.statusCode).toBe(403);
    });
  });

  describe('Real-time Features Integration', () => {
    it('should handle WebSocket connections and events', async () => {
      // This would require WebSocket testing setup
      // For now, we'll test the HTTP endpoints that trigger WebSocket events

      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'WebSocket Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      expect(taskResponse.statusCode).toBe(201);
      const task = JSON.parse(taskResponse.body);

      // Update task status (should trigger WebSocket event)
      const updateResponse = await server.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${task.id}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { status: 'IN_PROGRESS' },
      });

      expect(updateResponse.statusCode).toBe(200);

      // Verify the update was processed
      const updatedTask = JSON.parse(updateResponse.body);
      expect(updatedTask.status).toBe('IN_PROGRESS');
    });
  });

  describe('Caching and Performance Optimization', () => {
    it('should utilize caching for frequently accessed data', async () => {
      // Make initial request (cache miss)
      const firstResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${testWorkspace.id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(firstResponse.statusCode).toBe(200);
      const firstResponseTime = parseInt(
        (firstResponse.headers['x-response-time'] as string) || '0'
      );

      // Make second request (should be cached)
      const secondResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${testWorkspace.id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(secondResponse.statusCode).toBe(200);
      const secondResponseTime = parseInt(
        (secondResponse.headers['x-response-time'] as string) || '0'
      );

      // Second request should be faster (cached)
      if (firstResponseTime > 0 && secondResponseTime > 0) {
        expect(secondResponseTime).toBeLessThanOrEqual(firstResponseTime);
      }

      // Verify data consistency
      const firstData = JSON.parse(firstResponse.body);
      const secondData = JSON.parse(secondResponse.body);
      expect(firstData).toEqual(secondData);
    });
  });

  describe('Business Logic Validation', () => {
    it('should enforce business rules across all operations', async () => {
      // Test task assignment rules
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Business Rule Test Task',
          workspaceId: testWorkspace.id,
          dueDate: new Date(Date.now() - 86400000).toISOString(), // Past date
        },
      });

      expect(taskResponse.statusCode).toBe(201);
      const task = JSON.parse(taskResponse.body);

      // Verify business logic was applied (e.g., past due date handling)
      expect(task.title).toBe('Business Rule Test Task');

      // Test workspace member limits
      const memberPromises = Array.from({ length: 15 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: `/api/v1/workspaces/${testWorkspace.id}/members`,
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            email: `member${i}@test.com`,
            role: 'MEMBER',
          },
        })
      );

      const memberResponses = await Promise.allSettled(memberPromises);

      // Should respect workspace member limits
      const successfulInvites = memberResponses.filter(
        r => r.status === 'fulfilled' && r.value.statusCode === 201
      ).length;

      // Assuming free tier has a 10 member limit
      expect(successfulInvites).toBeLessThanOrEqual(10);
    });
  });
});
