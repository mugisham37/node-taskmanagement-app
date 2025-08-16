import '@taskmanagement/types/common';
import { EnvironmentUtils } from '@taskmanagement/types/common';
import { FastifyInstance } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { APIDocumentationGenerator } from './api-documentation-generator';

/**
 * Setup comprehensive API documentation
 */
export async function setupAPIDocumentation(
  fastify: FastifyInstance,
  logger: LoggingService
): Promise<void> {
  const docGenerator = new APIDocumentationGenerator(logger);

  // Register all API endpoints for documentation
  registerTaskEndpoints(docGenerator);
  registerProjectEndpoints(docGenerator);
  registerUserEndpoints(docGenerator);
  registerWorkspaceEndpoints(docGenerator);
  registerNotificationEndpoints(docGenerator);
  registerWebhookEndpoints(docGenerator);
  registerAnalyticsEndpoints(docGenerator);
  registerCalendarEndpoints(docGenerator);
  registerFileEndpoints(docGenerator);
  registerSearchEndpoints(docGenerator);
  registerCollaborationEndpoints(docGenerator);
  registerMonitoringEndpoints(docGenerator);
  registerBulkOperationEndpoints(docGenerator);
  registerAuthEndpoints(docGenerator);

  // Register common schemas
  registerCommonSchemas(docGenerator);

  // Setup Swagger UI
  await docGenerator.setupSwaggerUI(fastify);

  // Add additional documentation routes
  fastify.get('/docs/openapi.json', async (_request, reply) => {
    const spec = docGenerator.generateOpenAPISpec();
    return reply.send(spec);
  });

  fastify.get('/docs/postman.json', async (_request, reply) => {
    const collection = docGenerator.generatePostmanCollection();
    return reply.send(collection);
  });

  // Export documentation files in development
  if (EnvironmentUtils.isDevelopment()) {
    docGenerator.exportToFile('./docs/openapi.json');

    const fs = require('fs');
    const postmanCollection = docGenerator.generatePostmanCollection();
    fs.writeFileSync('./docs/postman-collection.json', JSON.stringify(postmanCollection, null, 2));
  }

  logger.info('API documentation setup completed');
}

/**
 * Register task endpoints
 */
function registerTaskEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/tasks',
    summary: 'Create a new task',
    description: 'Creates a new task in the system',
    tags: ['Tasks'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateTaskRequest' },
          example: {
            title: 'Implement user authentication',
            description: 'Add JWT-based authentication to the API',
            priority: 'high',
            dueDate: '2023-12-31T23:59:59Z',
            projectId: '123e4567-e89b-12d3-a456-426614174000',
            assigneeId: '456e7890-e89b-12d3-a456-426614174001',
            estimatedHours: 8,
            tags: ['authentication', 'security'],
          },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '403': { $ref: '#/components/responses/Forbidden' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/tasks',
    summary: 'List tasks',
    description: 'Retrieve a paginated list of tasks with optional filtering',
    tags: ['Tasks'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
      { $ref: '#/components/parameters/SortByParam' },
      { $ref: '#/components/parameters/SortOrderParam' },
      {
        name: 'status',
        in: 'query',
        description: 'Filter by task status',
        required: false,
        schema: {
          type: 'string',
          enum: ['todo', 'in_progress', 'in_review', 'completed', 'cancelled'],
        },
      },
      {
        name: 'priority',
        in: 'query',
        description: 'Filter by task priority',
        required: false,
        schema: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
        },
      },
      {
        name: 'assigneeId',
        in: 'query',
        description: 'Filter by assignee ID',
        required: false,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'projectId',
        in: 'query',
        description: 'Filter by project ID',
        required: false,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      '200': {
        description: 'List of tasks',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Task' },
                    },
                  },
                },
              ],
            },
            example: { $ref: '#/components/examples/PaginatedResponse' },
          },
        },
      },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  // Add task update endpoint
  docGenerator.registerEndpoint({
    method: 'PUT',
    path: '/api/v1/tasks/{id}',
    summary: 'Update a task',
    description: 'Update an existing task by ID',
    tags: ['Tasks'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateTaskRequest' },
        },
      },
    },
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': { $ref: '#/components/responses/NotFound' },
    },
    security: [{ BearerAuth: [] }],
  });

  // Add task deletion endpoint
  docGenerator.registerEndpoint({
    method: 'DELETE',
    path: '/api/v1/tasks/{id}',
    summary: 'Delete a task',
    description: 'Delete a task by ID',
    tags: ['Tasks'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    responses: {
      '204': { $ref: '#/components/responses/NoContent' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': { $ref: '#/components/responses/NotFound' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register project endpoints
 */
function registerProjectEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/projects',
    summary: 'Create a new project',
    description: 'Creates a new project in the workspace',
    tags: ['Projects'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateProjectRequest' },
          example: {
            name: 'Mobile App Development',
            description: 'Develop a mobile application for task management',
            workspaceId: '123e4567-e89b-12d3-a456-426614174000',
            startDate: '2023-12-01',
            endDate: '2024-03-31',
            budget: 50000,
            status: 'planning',
          },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '403': { $ref: '#/components/responses/Forbidden' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/projects',
    summary: 'List projects',
    description: 'Retrieve a paginated list of projects',
    tags: ['Projects'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
      { $ref: '#/components/parameters/SortByParam' },
      { $ref: '#/components/parameters/SortOrderParam' },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/projects/{id}',
    summary: 'Get project by ID',
    description: 'Retrieve a specific project by its ID',
    tags: ['Projects'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': { $ref: '#/components/responses/NotFound' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register user endpoints
 */
function registerUserEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/users/{id}',
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their ID',
    tags: ['Users'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    responses: {
      '200': {
        description: 'User details',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              ],
            },
          },
        },
      },
      '404': { $ref: '#/components/responses/NotFound' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/users',
    summary: 'List users',
    description: 'Retrieve a paginated list of users',
    tags: ['Users'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
      { $ref: '#/components/parameters/SearchParam' },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'PUT',
    path: '/api/v1/users/{id}',
    summary: 'Update user',
    description: 'Update user information',
    tags: ['Users'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateUserRequest' },
        },
      },
    },
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': { $ref: '#/components/responses/NotFound' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register workspace endpoints
 */
function registerWorkspaceEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/workspaces',
    summary: 'List workspaces',
    description: 'Retrieve workspaces accessible to the authenticated user',
    tags: ['Workspaces'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/workspaces',
    summary: 'Create workspace',
    description: 'Create a new workspace',
    tags: ['Workspaces'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateWorkspaceRequest' },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register notification endpoints
 */
function registerNotificationEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/notifications',
    summary: 'Get user notifications',
    description: 'Retrieve notifications for the authenticated user',
    tags: ['Notifications'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
      {
        name: 'status',
        in: 'query',
        description: 'Filter by notification status',
        required: false,
        schema: {
          type: 'string',
          enum: ['read', 'unread', 'all'],
          default: 'all',
        },
      },
      {
        name: 'type',
        in: 'query',
        description: 'Filter by notification type',
        required: false,
        schema: { type: 'string' },
      },
    ],
    responses: {
      '200': {
        description: 'List of notifications',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Notification' },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'PATCH',
    path: '/api/v1/notifications/{id}/read',
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read',
    tags: ['Notifications'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': { $ref: '#/components/responses/NotFound' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register webhook endpoints
 */
function registerWebhookEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/webhooks',
    summary: 'Create webhook',
    description: 'Create a new webhook subscription',
    tags: ['Webhooks'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateWebhookRequest' },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/webhooks',
    summary: 'List webhooks',
    description: 'Retrieve webhook subscriptions',
    tags: ['Webhooks'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register analytics endpoints
 */
function registerAnalyticsEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/analytics/dashboard',
    summary: 'Get dashboard analytics',
    description: 'Retrieve analytics data for dashboard',
    tags: ['Analytics'],
    parameters: [
      {
        name: 'timeRange',
        in: 'query',
        description: 'Time range for analytics',
        required: false,
        schema: {
          type: 'string',
          enum: ['7d', '30d', '90d', '1y'],
          default: '30d',
        },
      },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/analytics/tasks',
    summary: 'Get task analytics',
    description: 'Retrieve task-specific analytics',
    tags: ['Analytics'],
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register calendar endpoints
 */
function registerCalendarEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/calendar/events',
    summary: 'Get calendar events',
    description: 'Retrieve calendar events for the authenticated user',
    tags: ['Calendar'],
    parameters: [
      {
        name: 'start',
        in: 'query',
        description: 'Start date for events',
        required: true,
        schema: { type: 'string', format: 'date' },
      },
      {
        name: 'end',
        in: 'query',
        description: 'End date for events',
        required: true,
        schema: { type: 'string', format: 'date' },
      },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register file endpoints
 */
function registerFileEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/files/upload',
    summary: 'Upload file',
    description: 'Upload a file to the system',
    tags: ['Files'],
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
              projectId: { type: 'string', format: 'uuid' },
              taskId: { type: 'string', format: 'uuid' },
            },
            required: ['file'],
          },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/files/{id}',
    summary: 'Download file',
    description: 'Download a file by ID',
    tags: ['Files'],
    parameters: [{ $ref: '#/components/parameters/IdParam' }],
    responses: {
      '200': {
        description: 'File content',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': { $ref: '#/components/responses/NotFound' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register search endpoints
 */
function registerSearchEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/search',
    summary: 'Global search',
    description: 'Search across tasks, projects, and users',
    tags: ['Search'],
    parameters: [
      { $ref: '#/components/parameters/SearchParam' },
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
      {
        name: 'type',
        in: 'query',
        description: 'Filter by entity type',
        required: false,
        schema: {
          type: 'string',
          enum: ['tasks', 'projects', 'users', 'all'],
          default: 'all',
        },
      },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register collaboration endpoints
 */
function registerCollaborationEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/collaboration/comments',
    summary: 'Add comment',
    description: 'Add a comment to a task or project',
    tags: ['Collaboration'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateCommentRequest' },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/collaboration/comments',
    summary: 'Get comments',
    description: 'Retrieve comments for a specific entity',
    tags: ['Collaboration'],
    parameters: [
      {
        name: 'entityId',
        in: 'query',
        description: 'ID of the entity (task or project)',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'entityType',
        in: 'query',
        description: 'Type of entity',
        required: true,
        schema: {
          type: 'string',
          enum: ['task', 'project'],
        },
      },
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
    ],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register monitoring endpoints
 */
function registerMonitoringEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/health',
    summary: 'Health check',
    description: 'Check the health status of the API',
    tags: ['Monitoring'],
    responses: {
      '200': {
        description: 'Service is healthy',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'healthy' },
                timestamp: { type: 'string', format: 'date-time' },
                uptime: { type: 'number' },
                version: { type: 'string' },
                environment: { type: 'string' },
                checks: {
                  type: 'object',
                  properties: {
                    database: { type: 'string' },
                    cache: { type: 'string' },
                    externalServices: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  docGenerator.registerEndpoint({
    method: 'GET',
    path: '/api/v1/metrics',
    summary: 'Get metrics',
    description: 'Retrieve application metrics',
    tags: ['Monitoring'],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register bulk operation endpoints
 */
function registerBulkOperationEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/bulk/tasks',
    summary: 'Bulk create tasks',
    description: 'Create multiple tasks in a single operation',
    tags: ['Bulk Operations'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: { $ref: '#/components/schemas/CreateTaskRequest' },
              },
            },
            required: ['tasks'],
          },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });

  docGenerator.registerEndpoint({
    method: 'PATCH',
    path: '/api/v1/bulk/tasks/status',
    summary: 'Bulk update task status',
    description: 'Update status for multiple tasks',
    tags: ['Bulk Operations'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              taskIds: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
              },
              status: {
                type: 'string',
                enum: ['todo', 'in_progress', 'in_review', 'completed', 'cancelled'],
              },
            },
            required: ['taskIds', 'status'],
          },
        },
      },
    },
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register authentication endpoints
 */
function registerAuthEndpoints(docGenerator: APIDocumentationGenerator): void {
  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/auth/login',
    summary: 'User login',
    description: 'Authenticate user and return JWT token',
    tags: ['Authentication'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8 },
            },
            required: ['email', 'password'],
          },
          example: {
            email: 'user@example.com',
            password: 'securePassword123',
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        refreshToken: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                        expiresIn: { type: 'number' },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '400': { $ref: '#/components/responses/BadRequest' },
    },
  });

  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/auth/register',
    summary: 'User registration',
    description: 'Register a new user account',
    tags: ['Authentication'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RegisterUserRequest' },
        },
      },
    },
    responses: {
      '201': { $ref: '#/components/responses/Created' },
      '400': { $ref: '#/components/responses/BadRequest' },
    },
  });

  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    summary: 'Refresh token',
    description: 'Refresh the JWT token using refresh token',
    tags: ['Authentication'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              refreshToken: { type: 'string' },
            },
            required: ['refreshToken'],
          },
        },
      },
    },
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
  });

  docGenerator.registerEndpoint({
    method: 'POST',
    path: '/api/v1/auth/logout',
    summary: 'User logout',
    description: 'Logout user and invalidate tokens',
    tags: ['Authentication'],
    responses: {
      '200': { $ref: '#/components/responses/Success' },
      '401': { $ref: '#/components/responses/Unauthorized' },
    },
    security: [{ BearerAuth: [] }],
  });
}

/**
 * Register common schemas
 */
function registerCommonSchemas(docGenerator: APIDocumentationGenerator): void {
  // Task schema
  docGenerator.registerSchema('Task', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: {
        type: 'string',
        enum: ['todo', 'in_progress', 'in_review', 'completed', 'cancelled'],
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
      },
      dueDate: { type: 'string', format: 'date-time' },
      estimatedHours: { type: 'number' },
      actualHours: { type: 'number' },
      projectId: { type: 'string', format: 'uuid' },
      assigneeId: { type: 'string', format: 'uuid' },
      creatorId: { type: 'string', format: 'uuid' },
      tags: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'title', 'status', 'priority', 'createdAt', 'updatedAt'],
  });

  // Project schema
  docGenerator.registerSchema('Project', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string' },
      status: {
        type: 'string',
        enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      },
      workspaceId: { type: 'string', format: 'uuid' },
      ownerId: { type: 'string', format: 'uuid' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      budget: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'name', 'status', 'workspaceId', 'ownerId', 'createdAt', 'updatedAt'],
  });

  // User schema
  docGenerator.registerSchema('User', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      role: {
        type: 'string',
        enum: ['admin', 'manager', 'member', 'viewer'],
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'suspended'],
      },
      avatar: { type: 'string', format: 'uri' },
      timezone: { type: 'string' },
      language: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'createdAt', 'updatedAt'],
  });

  // Notification schema
  docGenerator.registerSchema('Notification', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      type: { type: 'string' },
      title: { type: 'string' },
      message: { type: 'string' },
      data: { type: 'object' },
      isRead: { type: 'boolean' },
      readAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'userId', 'type', 'title', 'message', 'isRead', 'createdAt'],
  });

  // Request schemas
  docGenerator.registerSchema('CreateTaskRequest', {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
      dueDate: { type: 'string', format: 'date-time' },
      estimatedHours: { type: 'number', minimum: 0 },
      projectId: { type: 'string', format: 'uuid' },
      assigneeId: { type: 'string', format: 'uuid' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'projectId'],
  });

  docGenerator.registerSchema('UpdateTaskRequest', {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
      status: {
        type: 'string',
        enum: ['todo', 'in_progress', 'in_review', 'completed', 'cancelled'],
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
      },
      dueDate: { type: 'string', format: 'date-time' },
      estimatedHours: { type: 'number', minimum: 0 },
      actualHours: { type: 'number', minimum: 0 },
      assigneeId: { type: 'string', format: 'uuid' },
      tags: { type: 'array', items: { type: 'string' } },
    },
  });

  docGenerator.registerSchema('CreateProjectRequest', {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
      workspaceId: { type: 'string', format: 'uuid' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      budget: { type: 'number', minimum: 0 },
    },
    required: ['name', 'workspaceId'],
  });

  docGenerator.registerSchema('CreateWorkspaceRequest', {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
    },
    required: ['name'],
  });

  docGenerator.registerSchema('UpdateUserRequest', {
    type: 'object',
    properties: {
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      timezone: { type: 'string' },
      language: { type: 'string' },
    },
  });

  docGenerator.registerSchema('RegisterUserRequest', {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
    },
    required: ['email', 'password', 'firstName', 'lastName'],
  });

  docGenerator.registerSchema('CreateWebhookRequest', {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri' },
      events: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'task.created',
            'task.updated',
            'task.deleted',
            'project.created',
            'project.updated',
          ],
        },
      },
      secret: { type: 'string' },
    },
    required: ['url', 'events'],
  });

  docGenerator.registerSchema('CreateCommentRequest', {
    type: 'object',
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 2000 },
      entityId: { type: 'string', format: 'uuid' },
      entityType: {
        type: 'string',
        enum: ['task', 'project'],
      },
    },
    required: ['content', 'entityId', 'entityType'],
  });
}
