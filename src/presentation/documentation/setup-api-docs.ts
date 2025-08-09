import { FastifyInstance } from 'fastify';
import { APIDocumentationGenerator } from './api-documentation-generator';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

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
  fastify.get('/docs/openapi.json', async (request, reply) => {
    const spec = docGenerator.generateOpenAPISpec();
    return reply.send(spec);
  });

  fastify.get('/docs/postman.json', async (request, reply) => {
    const collection = docGenerator.generatePostmanCollection();
    return reply.send(collection);
  });

  // Export documentation files in development
  if (process.env.NODE_ENV === 'development') {
    docGenerator.exportToFile('./docs/openapi.json');

    const fs = require('fs');
    const postmanCollection = docGenerator.generatePostmanCollection();
    fs.writeFileSync(
      './docs/postman-collection.json',
      JSON.stringify(postmanCollection, null, 2)
    );
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

  // Add more task endpoints...
}

/**
 * Register project endpoints
 */
function registerProjectEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
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

  // Add more project endpoints...
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

  // Add more user endpoints...
}

/**
 * Register workspace endpoints
 */
function registerWorkspaceEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for workspace endpoints...
}

/**
 * Register notification endpoints
 */
function registerNotificationEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
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

  // Add more notification endpoints...
}

/**
 * Register webhook endpoints
 */
function registerWebhookEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for webhook endpoints...
}

/**
 * Register analytics endpoints
 */
function registerAnalyticsEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for analytics endpoints...
}

/**
 * Register calendar endpoints
 */
function registerCalendarEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for calendar endpoints...
}

/**
 * Register file endpoints
 */
function registerFileEndpoints(docGenerator: APIDocumentationGenerator): void {
  // Implementation for file endpoints...
}

/**
 * Register search endpoints
 */
function registerSearchEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for search endpoints...
}

/**
 * Register collaboration endpoints
 */
function registerCollaborationEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for collaboration endpoints...
}

/**
 * Register monitoring endpoints
 */
function registerMonitoringEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for monitoring endpoints...
}

/**
 * Register bulk operation endpoints
 */
function registerBulkOperationEndpoints(
  docGenerator: APIDocumentationGenerator
): void {
  // Implementation for bulk operation endpoints...
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

  // Add more auth endpoints...
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
    required: [
      'id',
      'name',
      'status',
      'workspaceId',
      'ownerId',
      'createdAt',
      'updatedAt',
    ],
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
    required: [
      'id',
      'email',
      'firstName',
      'lastName',
      'role',
      'status',
      'createdAt',
      'updatedAt',
    ],
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
    required: [
      'id',
      'userId',
      'type',
      'title',
      'message',
      'isRead',
      'createdAt',
    ],
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
}
