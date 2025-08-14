import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '@/app';
import { TestDataFactory, DatabaseHelpers } from '../../helpers/test-helpers';

describe('Task API E2E Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUser: any;
  let testProject: any;
  let testWorkspace: any;

  beforeAll(async () => {
    // Build the application
    app = await buildApp();
    await app.ready();

    // Setup test data
    await DatabaseHelpers.seedTestData();

    // Create test user and authenticate
    testUser = TestDataFactory.createUserData();
    testWorkspace = TestDataFactory.createWorkspaceData();
    testProject = TestDataFactory.createProjectData(
      testWorkspace.id,
      testUser.id
    );

    // Register test user
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testUser.email,
        password: 'TestPassword123!',
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      },
    });

    expect(registerResponse.statusCode).toBe(201);

    // Login to get auth token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'TestPassword123!',
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.data.accessToken;

    // Create test workspace and project
    const workspaceResponse = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: testWorkspace.name,
        description: testWorkspace.description,
      },
    });

    expect(workspaceResponse.statusCode).toBe(201);
    const workspaceData = JSON.parse(workspaceResponse.body);
    testWorkspace.id = workspaceData.data.id;

    const projectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        workspaceId: testWorkspace.id,
        name: testProject.name,
        description: testProject.description,
        startDate: testProject.startDate,
        endDate: testProject.endDate,
      },
    });

    expect(projectResponse.statusCode).toBe(201);
    const projectData = JSON.parse(projectResponse.body);
    testProject.id = projectData.data.id;
  });

  afterAll(async () => {
    await DatabaseHelpers.cleanupDatabase();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up tasks before each test
    await app.inject({
      method: 'DELETE',
      url: `/api/projects/${testProject.id}/tasks`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        projectId: testProject.id,
        assigneeId: testUser.id,
        title: 'E2E Test Task',
        description: 'This is a test task created via E2E testing',
        priority: 'HIGH',
        dueDate: '2024-12-31T23:59:59.000Z',
        estimatedHours: 8,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: taskData,
      });

      expect(response.statusCode).toBe(201);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        projectId: taskData.projectId,
        assigneeId: taskData.assigneeId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: 'TODO',
        estimatedHours: taskData.estimatedHours,
        actualHours: 0,
      });
      expect(responseData.data.id).toBeDefined();
      expect(responseData.data.createdAt).toBeDefined();
      expect(responseData.data.updatedAt).toBeDefined();
    });

    it('should return 400 for invalid task data', async () => {
      const invalidTaskData = {
        projectId: testProject.id,
        assigneeId: testUser.id,
        title: '', // Empty title should be invalid
        description: 'This task has an empty title',
        priority: 'HIGH',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: invalidTaskData,
      });

      expect(response.statusCode).toBe(400);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain('title');
    });

    it('should return 401 without authentication', async () => {
      const taskData = {
        projectId: testProject.id,
        assigneeId: testUser.id,
        title: 'Unauthorized Task',
        description: 'This should fail',
        priority: 'MEDIUM',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: taskData,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent project', async () => {
      const taskData = {
        projectId: 'non-existent-project',
        assigneeId: testUser.id,
        title: 'Task for Non-existent Project',
        description: 'This should fail',
        priority: 'MEDIUM',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: taskData,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/tasks/:id', () => {
    let createdTask: any;

    beforeEach(async () => {
      // Create a task for testing
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: 'Task for GET test',
          description: 'This task will be retrieved',
          priority: 'MEDIUM',
          estimatedHours: 4,
        },
      });

      createdTask = JSON.parse(createResponse.body).data;
    });

    it('should retrieve a task by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tasks/${createdTask.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: createdTask.id,
        title: 'Task for GET test',
        description: 'This task will be retrieved',
        priority: 'MEDIUM',
        status: 'TODO',
        estimatedHours: 4,
      });
    });

    it('should return 404 for non-existent task', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/non-existent-task',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tasks/${createdTask.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let createdTask: any;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: 'Task for UPDATE test',
          description: 'This task will be updated',
          priority: 'LOW',
          estimatedHours: 2,
        },
      });

      createdTask = JSON.parse(createResponse.body).data;
    });

    it('should update a task', async () => {
      const updateData = {
        title: 'Updated Task Title',
        description: 'Updated task description',
        priority: 'CRITICAL',
        estimatedHours: 12,
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/tasks/${createdTask.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: createdTask.id,
        title: updateData.title,
        description: updateData.description,
        priority: updateData.priority,
        estimatedHours: updateData.estimatedHours,
      });
      expect(responseData.data.updatedAt).not.toBe(createdTask.updatedAt);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidUpdateData = {
        title: '', // Empty title should be invalid
        priority: 'INVALID_PRIORITY',
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/tasks/${createdTask.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: invalidUpdateData,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/tasks/non-existent-task',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    let createdTask: any;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: 'Task for status test',
          description: 'This task status will be changed',
          priority: 'MEDIUM',
        },
      });

      createdTask = JSON.parse(createResponse.body).data;
    });

    it('should start a task', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${createdTask.id}/start`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('IN_PROGRESS');
    });

    it('should complete a task', async () => {
      // First start the task
      await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${createdTask.id}/start`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Then complete it
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${createdTask.id}/complete`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('COMPLETED');
    });

    it('should not complete a task that is not in progress', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${createdTask.id}/complete`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/tasks', () => {
    beforeEach(async () => {
      // Create multiple tasks for the project
      const tasks = [
        {
          title: 'Task 1',
          description: 'First task',
          priority: 'HIGH',
          status: 'TODO',
        },
        {
          title: 'Task 2',
          description: 'Second task',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
        },
        {
          title: 'Task 3',
          description: 'Third task',
          priority: 'LOW',
          status: 'COMPLETED',
        },
      ];

      for (const task of tasks) {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/tasks',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            projectId: testProject.id,
            assigneeId: testUser.id,
            ...task,
          },
        });

        if (task.status === 'IN_PROGRESS') {
          const createdTask = JSON.parse(createResponse.body).data;
          await app.inject({
            method: 'PATCH',
            url: `/api/tasks/${createdTask.id}/start`,
            headers: {
              authorization: `Bearer ${authToken}`,
            },
          });
        } else if (task.status === 'COMPLETED') {
          const createdTask = JSON.parse(createResponse.body).data;
          await app.inject({
            method: 'PATCH',
            url: `/api/tasks/${createdTask.id}/start`,
            headers: {
              authorization: `Bearer ${authToken}`,
            },
          });
          await app.inject({
            method: 'PATCH',
            url: `/api/tasks/${createdTask.id}/complete`,
            headers: {
              authorization: `Bearer ${authToken}`,
            },
          });
        }
      }
    });

    it('should get all tasks for a project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveLength(3);
      expect(
        responseData.data.every(
          (task: any) => task.projectId === testProject.id
        )
      ).toBe(true);
    });

    it('should filter tasks by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks?status=TODO`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(
        responseData.data.every((task: any) => task.status === 'TODO')
      ).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks?priority=HIGH`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(
        responseData.data.every((task: any) => task.priority === 'HIGH')
      ).toBe(true);
    });

    it('should paginate tasks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${testProject.id}/tasks?limit=2&offset=0`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const responseData = JSON.parse(response.body);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveLength(2);
      expect(responseData.pagination).toMatchObject({
        limit: 2,
        offset: 0,
        total: 3,
      });
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let createdTask: any;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: 'Task for DELETE test',
          description: 'This task will be deleted',
          priority: 'MEDIUM',
        },
      });

      createdTask = JSON.parse(createResponse.body).data;
    });

    it('should delete a task', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/tasks/${createdTask.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify task is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${createdTask.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tasks/non-existent-task',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/tasks/${createdTask.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Task Workflow E2E', () => {
    it('should complete full task lifecycle', async () => {
      // 1. Create task
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          projectId: testProject.id,
          assigneeId: testUser.id,
          title: 'Full Lifecycle Task',
          description: 'This task will go through the complete lifecycle',
          priority: 'HIGH',
          estimatedHours: 8,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const task = JSON.parse(createResponse.body).data;
      expect(task.status).toBe('TODO');

      // 2. Start task
      const startResponse = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${task.id}/start`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(startResponse.statusCode).toBe(200);
      const startedTask = JSON.parse(startResponse.body).data;
      expect(startedTask.status).toBe('IN_PROGRESS');

      // 3. Update task details
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/tasks/${task.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          description: 'Updated description during progress',
          actualHours: 4,
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updatedTask = JSON.parse(updateResponse.body).data;
      expect(updatedTask.description).toBe(
        'Updated description during progress'
      );

      // 4. Complete task
      const completeResponse = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${task.id}/complete`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(completeResponse.statusCode).toBe(200);
      const completedTask = JSON.parse(completeResponse.body).data;
      expect(completedTask.status).toBe('COMPLETED');

      // 5. Verify final state
      const finalResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(finalResponse.statusCode).toBe(200);
      const finalTask = JSON.parse(finalResponse.body).data;
      expect(finalTask).toMatchObject({
        id: task.id,
        title: 'Full Lifecycle Task',
        description: 'Updated description during progress',
        status: 'COMPLETED',
        priority: 'HIGH',
        estimatedHours: 8,
      });
    });
  });
});
