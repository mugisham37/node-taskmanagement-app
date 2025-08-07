import { OpenAPIGenerator } from './openapi-generator';
import {
  taskSchema,
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskStatsSchema,
  taskCommentSchema,
  taskAttachmentSchema,
  taskActivitySchema,
} from '../schemas/task.schemas';

export class TaskAPIDocumentation {
  private readonly generator: OpenAPIGenerator;

  constructor() {
    this.generator = new OpenAPIGenerator();
    this.setupTaskDocumentation();
  }

  private setupTaskDocumentation(): void {
    // Add task-related schemas
    this.generator.zodToOpenAPI(taskSchema, 'Task');
    this.generator.zodToOpenAPI(createTaskSchema, 'CreateTaskRequest');
    this.generator.zodToOpenAPI(updateTaskSchema, 'UpdateTaskRequest');
    this.generator.zodToOpenAPI(taskQuerySchema, 'TaskQueryParams');
    this.generator.zodToOpenAPI(taskStatsSchema, 'TaskStats');
    this.generator.zodToOpenAPI(taskCommentSchema, 'TaskComment');
    this.generator.zodToOpenAPI(taskAttachmentSchema, 'TaskAttachment');
    this.generator.zodToOpenAPI(taskActivitySchema, 'TaskActivity');

    // Add CRUD endpoints
    this.generator.addCrudEndpoints({
      name: 'task',
      path: '/api/v1/tasks',
      schemas: {
        entity: taskSchema,
        create: createTaskSchema,
        update: updateTaskSchema,
        query: taskQuerySchema,
      },
      tags: ['Tasks'],
    });

    // Add custom task endpoints
    this.addTaskSpecificEndpoints();
  }

  private addTaskSpecificEndpoints(): void {
    // Task assignment endpoint
    this.generator.addEndpoint({
      path: '/api/v1/tasks/{id}/assign',
      method: 'patch',
      summary: 'Assign task to user',
      description: 'Assign a task to a specific user',
      tags: ['Tasks'],
      operationId: 'assignTask',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Task ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                assigneeId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'ID of the user to assign the task to',
                },
              },
              required: ['assigneeId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Task assigned successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Task' },
                    },
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
      security: [{ bearerAuth: [] }],
    });

    // Task status update endpoint
    this.generator.addEndpoint({
      path: '/api/v1/tasks/{id}/status',
      method: 'patch',
      summary: 'Update task status',
      description: 'Update the status of a task',
      tags: ['Tasks'],
      operationId: 'updateTaskStatus',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Task ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: [
                    'TODO',
                    'IN_PROGRESS',
                    'IN_REVIEW',
                    'DONE',
                    'CANCELLED',
                  ],
                  description: 'New task status',
                },
                actualHours: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1000,
                  description: 'Actual hours spent on the task',
                },
              },
              required: ['status'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Task status updated successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Task' },
                    },
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
      security: [{ bearerAuth: [] }],
    });

    // Task statistics endpoint
    this.generator.addEndpoint({
      path: '/api/v1/tasks/stats',
      method: 'get',
      summary: 'Get task statistics',
      description: 'Retrieve task statistics for the current user or workspace',
      tags: ['Tasks', 'Analytics'],
      operationId: 'getTaskStats',
      parameters: [
        {
          name: 'workspaceId',
          in: 'query',
          schema: { type: 'string', format: 'uuid' },
          description: 'Workspace ID to filter statistics',
        },
        {
          name: 'dateFrom',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'Start date for statistics calculation',
        },
        {
          name: 'dateTo',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'End date for statistics calculation',
        },
      ],
      responses: {
        '200': {
          description: 'Task statistics retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/TaskStats' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    });

    // Bulk task operations endpoint
    this.generator.addEndpoint({
      path: '/api/v1/tasks/bulk',
      method: 'patch',
      summary: 'Bulk update tasks',
      description: 'Update multiple tasks at once',
      tags: ['Tasks'],
      operationId: 'bulkUpdateTasks',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ids: {
                  type: 'array',
                  items: { type: 'string', format: 'uuid' },
                  minItems: 1,
                  maxItems: 100,
                  description: 'Array of task IDs to update',
                },
                data: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: [
                        'TODO',
                        'IN_PROGRESS',
                        'IN_REVIEW',
                        'DONE',
                        'CANCELLED',
                      ],
                    },
                    priority: {
                      type: 'string',
                      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                    },
                    assigneeId: {
                      type: 'string',
                      format: 'uuid',
                    },
                    projectId: {
                      type: 'string',
                      format: 'uuid',
                    },
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                      maxItems: 10,
                    },
                  },
                  description: 'Data to update for all selected tasks',
                },
              },
              required: ['ids', 'data'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Bulk update completed',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          updated: { type: 'integer', minimum: 0 },
                          failed: { type: 'integer', minimum: 0 },
                          errors: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                taskId: { type: 'string', format: 'uuid' },
                                error: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
      },
      security: [{ bearerAuth: [] }],
    });

    // Task comments endpoints
    this.generator.addEndpoint({
      path: '/api/v1/tasks/{id}/comments',
      method: 'get',
      summary: 'Get task comments',
      description: 'Retrieve all comments for a specific task',
      tags: ['Tasks', 'Comments'],
      operationId: 'getTaskComments',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Task ID',
        },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        },
      ],
      responses: {
        '200': {
          description: 'Task comments retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TaskComment' },
                      },
                      meta: { $ref: '#/components/schemas/PaginationMeta' },
                    },
                  },
                ],
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
      security: [{ bearerAuth: [] }],
    });

    this.generator.addEndpoint({
      path: '/api/v1/tasks/{id}/comments',
      method: 'post',
      summary: 'Add task comment',
      description: 'Add a new comment to a task',
      tags: ['Tasks', 'Comments'],
      operationId: 'addTaskComment',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Task ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 2000,
                  description: 'Comment content',
                },
                parentCommentId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'ID of parent comment for replies',
                },
              },
              required: ['content'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Comment added successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/TaskComment' },
                    },
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
      security: [{ bearerAuth: [] }],
    });

    // Task attachments endpoint
    this.generator.addEndpoint({
      path: '/api/v1/tasks/{id}/attachments',
      method: 'get',
      summary: 'Get task attachments',
      description: 'Retrieve all attachments for a specific task',
      tags: ['Tasks', 'Attachments'],
      operationId: 'getTaskAttachments',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Task ID',
        },
      ],
      responses: {
        '200': {
          description: 'Task attachments retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TaskAttachment' },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
      security: [{ bearerAuth: [] }],
    });

    // Task activity log endpoint
    this.generator.addEndpoint({
      path: '/api/v1/tasks/{id}/activity',
      method: 'get',
      summary: 'Get task activity log',
      description: 'Retrieve activity log for a specific task',
      tags: ['Tasks', 'Activity'],
      operationId: 'getTaskActivity',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Task ID',
        },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        },
      ],
      responses: {
        '200': {
          description: 'Task activity retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TaskActivity' },
                      },
                      meta: { $ref: '#/components/schemas/PaginationMeta' },
                    },
                  },
                ],
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
      security: [{ bearerAuth: [] }],
    });
  }

  public getOpenAPISpec() {
    return this.generator.getSpec();
  }

  public generateJSON(): string {
    return this.generator.generateJSON();
  }

  public generateYAML(): string {
    return this.generator.generateYAML();
  }
}

// Export singleton instance
export const taskAPIDocumentation = new TaskAPIDocumentation();
