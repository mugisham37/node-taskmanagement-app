import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '@/app';
import { TestDataFactory, DatabaseHelpers } from '../../helpers/test-helpers';

describe('API Performance Tests', () => {
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

  describe('Task Creation Performance', () => {
    it('should create tasks within acceptable time limits', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create 50 tasks concurrently
      for (let i = 0; i < 50; i++) {
        const promise = app.inject({
          method: 'POST',
          url: '/api/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            projectId: testProject.id,
            assigneeId: testUser.id,
            title: `Performance Test Task ${i}`,
            description: `Task ${i} for performance testing`,
            priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4],
            estimatedHours: Math.floor(Math.random() * 20) + 1,
          },
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      // Should complete within 10 seconds
      expect(totalTime).toBeLessThan(10000);

      // Average response time should be less than 200ms
      const averageTime = totalTime / 50;
      expect(averageTime).toBeLessThan(200);

      console.log(
        `Created 50 tasks in ${totalTime}ms (avg: ${averageTime}ms per task)`
      );
    });

    it('should handle high-frequency task creation', async () => {
      const results: number[] = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await app.inject({
          method: 'POST',
          url: '/api/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            projectId: testProject.id,
            assigneeId: testUser.id,
            title: `High Frequency Task ${i}`,
            description: 'High frequency test',
            priority: 'MEDIUM',
            estimatedHours: 4,
          },
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        results.push(responseTime);

        expect(response.statusCode).toBe(201);
      }

      const averageTime =
        results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      console.log(
        `High frequency creation - Avg: ${averageTime}ms, Max: ${maxTime}ms, Min: ${minTime}ms`
      );

      // 95th percentile should be under 300ms
      const sortedResults = results.sort((a, b) => a - b);
      const p95Index = Math.floor(results.length * 0.95);
      const p95Time = sortedResults[p95Index];

      expect(p95Time).toBeLessThan(300);
      expect(averageTime).toBeLessThan(150);
    });
  });

  describe('Task Query Performance', () => {
    beforeAll(async () => {
      // Create a large dataset for querying
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 200; i++) {
        const promise = app.inject({
          method: 'POST',
          url: '/api/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            projectId: testProject.id,
            assigneeId: testUser.id,
            title: `Query Test Task ${i}`,
            description: `Task ${i} for query performance testing`,
            priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4],
            status: 'TODO',
            estimatedHours: Math.floor(Math.random() * 20) + 1,
          },
        });
        promises.push(promise);
      }

      await Promise.all(promises);
    });

    it('should query tasks efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks?limit=50&offset=0`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.data).toHaveLength(50);

      // Query should complete within 100ms
      expect(queryTime).toBeLessThan(100);

      console.log(`Queried 50 tasks in ${queryTime}ms`);
    });

    it('should handle complex filtered queries efficiently', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks?status=TODO&priority=HIGH&limit=20&offset=0&sort=createdAt&order=DESC`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.statusCode).toBe(200);

      // Complex query should complete within 150ms
      expect(queryTime).toBeLessThan(150);

      console.log(`Complex filtered query completed in ${queryTime}ms`);
    });

    it('should handle pagination efficiently', async () => {
      const pageSize = 25;
      const totalPages = 8; // 200 tasks / 25 per page
      const results: number[] = [];

      for (let page = 0; page < totalPages; page++) {
        const startTime = Date.now();

        const response = await app.inject({
          method: 'GET',
          url: `/api/projects/${testProject.id}/tasks?limit=${pageSize}&offset=${page * pageSize}`,
          headers: { authorization: `Bearer ${authToken}` },
        });

        const endTime = Date.now();
        const queryTime = endTime - startTime;
        results.push(queryTime);

        expect(response.statusCode).toBe(200);

        const responseData = JSON.parse(response.body);
        expect(responseData.data.length).toBeLessThanOrEqual(pageSize);
      }

      const averageTime =
        results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);

      console.log(
        `Pagination performance - Avg: ${averageTime}ms, Max: ${maxTime}ms`
      );

      // All pages should load within 100ms
      expect(maxTime).toBeLessThan(100);
      expect(averageTime).toBeLessThan(50);
    });
  });

  describe('Task Update Performance', () => {
    let taskIds: string[] = [];

    beforeAll(async () => {
      // Create tasks for update testing
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 50; i++) {
        const promise = app.inject({
          method: 'POST',
          url: '/api/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            projectId: testProject.id,
            assigneeId: testUser.id,
            title: `Update Test Task ${i}`,
            description: `Task ${i} for update performance testing`,
            priority: 'MEDIUM',
            estimatedHours: 4,
          },
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      taskIds = responses.map(response => JSON.parse(response.body).data.id);
    });

    it('should update tasks efficiently', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Update all tasks concurrently
      taskIds.forEach((taskId, index) => {
        const promise = app.inject({
          method: 'PUT',
          url: `/api/tasks/${taskId}`,
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            title: `Updated Task ${index}`,
            description: `Updated description ${index}`,
            priority: 'HIGH',
            estimatedHours: 8,
          },
        });
        promises.push(promise);
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All updates should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Should complete within 8 seconds
      expect(totalTime).toBeLessThan(8000);

      const averageTime = totalTime / taskIds.length;
      expect(averageTime).toBeLessThan(160);

      console.log(
        `Updated ${taskIds.length} tasks in ${totalTime}ms (avg: ${averageTime}ms per task)`
      );
    });

    it('should handle status transitions efficiently', async () => {
      const results: number[] = [];

      for (const taskId of taskIds.slice(0, 10)) {
        // Start task
        const startTime = Date.now();

        const startResponse = await app.inject({
          method: 'PATCH',
          url: `/api/tasks/${taskId}/start`,
          headers: { authorization: `Bearer ${authToken}` },
        });

        expect(startResponse.statusCode).toBe(200);

        // Complete task
        const completeResponse = await app.inject({
          method: 'PATCH',
          url: `/api/tasks/${taskId}/complete`,
          headers: { authorization: `Bearer ${authToken}` },
        });

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        results.push(totalTime);

        expect(completeResponse.statusCode).toBe(200);
      }

      const averageTime =
        results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);

      console.log(
        `Status transitions - Avg: ${averageTime}ms, Max: ${maxTime}ms`
      );

      // Status transitions should be fast
      expect(maxTime).toBeLessThan(200);
      expect(averageTime).toBeLessThan(100);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle mixed operations concurrently', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Mix of create, read, update operations
      for (let i = 0; i < 30; i++) {
        if (i % 3 === 0) {
          // Create operation
          promises.push(
            app.inject({
              method: 'POST',
              url: '/api/tasks',
              headers: { authorization: `Bearer ${authToken}` },
              payload: {
                projectId: testProject.id,
                assigneeId: testUser.id,
                title: `Concurrent Task ${i}`,
                description: 'Concurrent operation test',
                priority: 'MEDIUM',
                estimatedHours: 4,
              },
            })
          );
        } else if (i % 3 === 1) {
          // Read operation
          promises.push(
            app.inject({
              method: 'GET',
              url: `/api/projects/${testProject.id}/tasks?limit=10`,
              headers: { authorization: `Bearer ${authToken}` },
            })
          );
        } else {
          // Update operation (if we have tasks to update)
          if (taskIds.length > 0) {
            const taskId = taskIds[i % taskIds.length];
            promises.push(
              app.inject({
                method: 'PUT',
                url: `/api/tasks/${taskId}`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                  description: `Concurrent update ${i}`,
                },
              })
            );
          }
        }
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All operations should succeed
      responses.forEach(response => {
        expect([200, 201].includes(response.statusCode)).toBe(true);
      });

      // Should handle concurrent operations efficiently
      expect(totalTime).toBeLessThan(5000);

      const averageTime = totalTime / promises.length;
      expect(averageTime).toBeLessThan(167);

      console.log(
        `Handled ${promises.length} concurrent operations in ${totalTime}ms (avg: ${averageTime}ms per operation)`
      );
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during bulk operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let batch = 0; batch < 5; batch++) {
        const promises: Promise<any>[] = [];

        for (let i = 0; i < 20; i++) {
          promises.push(
            app.inject({
              method: 'POST',
              url: '/api/tasks',
              headers: { authorization: `Bearer ${authToken}` },
              payload: {
                projectId: testProject.id,
                assigneeId: testUser.id,
                title: `Memory Test Task ${batch}-${i}`,
                description: 'Memory leak test',
                priority: 'MEDIUM',
                estimatedHours: 4,
              },
            })
          );
        }

        await Promise.all(promises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Database Connection Performance', () => {
    it('should handle database connections efficiently', async () => {
      const connectionTests: Promise<any>[] = [];

      // Simulate many concurrent database operations
      for (let i = 0; i < 100; i++) {
        connectionTests.push(
          app.inject({
            method: 'GET',
            url: `/api/projects/${testProject.id}/tasks?limit=1`,
            headers: { authorization: `Bearer ${authToken}` },
          })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(connectionTests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Should handle 100 concurrent DB operations within 3 seconds
      expect(totalTime).toBeLessThan(3000);

      console.log(`Handled 100 concurrent DB operations in ${totalTime}ms`);
    });
  });
});
