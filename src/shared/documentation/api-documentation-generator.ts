import { OpenAPIGenerator, EndpointDocumentation } from './openapi-generator';
import { z } from 'zod';

export interface APIDocumentationOptions {
  includeExamples?: boolean;
  includeWebSocket?: boolean;
  includeDeprecated?: boolean;
  outputFormats?: ('json' | 'yaml' | 'html')[];
  customSchemas?: Record<string, z.ZodSchema>;
}

export class APIDocumentationGenerator {
  private readonly generator: OpenAPIGenerator;
  private readonly options: APIDocumentationOptions;

  constructor(options: APIDocumentationOptions = {}) {
    this.options = {
      includeExamples: true,
      includeWebSocket: true,
      includeDeprecated: false,
      outputFormats: ['json', 'yaml'],
      ...options,
    };

    this.generator = new OpenAPIGenerator();
    this.setupCommonEndpoints();
    this.setupCustomSchemas();
  }

  /**
   * Generate comprehensive API documentation
   */
  async generateDocumentation(outputDir: string = './docs/api'): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate different formats
    if (this.options.outputFormats?.includes('json')) {
      const jsonPath = path.join(outputDir, 'openapi.json');
      await this.generator.exportToFile('json', jsonPath);
      console.log(`✅ Generated OpenAPI JSON: ${jsonPath}`);
    }

    if (this.options.outputFormats?.includes('yaml')) {
      const yamlPath = path.join(outputDir, 'openapi.yaml');
      await this.generator.exportToFile('yaml', yamlPath);
      console.log(`✅ Generated OpenAPI YAML: ${yamlPath}`);
    }

    if (this.options.outputFormats?.includes('html')) {
      await this.generateHTMLDocumentation(outputDir);
    }

    // Generate interactive documentation
    await this.generateInteractiveDocumentation(outputDir);
  }

  /**
   * Add task-related endpoints
   */
  addTaskEndpoints(): void {
    // Define task schemas (these would typically come from your domain layer)
    const taskSchema = z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      assigneeId: z.string().uuid().optional(),
      projectId: z.string().uuid(),
      dueDate: z.date().optional(),
      estimatedHours: z.number().min(0).max(1000).optional(),
      actualHours: z.number().min(0).max(1000).optional(),
      tags: z.array(z.string()).max(10).optional(),
      createdAt: z.date(),
      updatedAt: z.date(),
      createdById: z.string().uuid(),
    });

    const createTaskSchema = taskSchema.omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
    });

    const updateTaskSchema = createTaskSchema.partial();

    const taskQuerySchema = z.object({
      status: z
        .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'])
        .optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      assigneeId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      dueBefore: z.date().optional(),
      dueAfter: z.date().optional(),
      tags: z.array(z.string()).optional(),
    });

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
      permissions: {
        read: 'read:tasks',
        create: 'write:tasks',
        update: 'write:tasks',
        delete: 'delete:tasks',
      },
      examples: this.options.includeExamples
        ? {
            entity: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              title: 'Implement user authentication',
              description:
                'Add JWT-based authentication system with proper security measures',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              assigneeId: '456e7890-e89b-12d3-a456-426614174001',
              projectId: '789e0123-e89b-12d3-a456-426614174002',
              dueDate: '2024-02-01T00:00:00Z',
              estimatedHours: 8,
              actualHours: 4,
              tags: ['authentication', 'security', 'backend'],
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-16T00:00:00Z',
              createdById: '789e0123-e89b-12d3-a456-426614174003',
            },
            create: {
              title: 'Implement user authentication',
              description:
                'Add JWT-based authentication system with proper security measures',
              priority: 'HIGH',
              assigneeId: '456e7890-e89b-12d3-a456-426614174001',
              projectId: '789e0123-e89b-12d3-a456-426614174002',
              dueDate: '2024-02-01T00:00:00Z',
              estimatedHours: 8,
              tags: ['authentication', 'security', 'backend'],
            },
            update: {
              status: 'IN_PROGRESS',
              actualHours: 4,
            },
          }
        : undefined,
    });

    // Add custom task endpoints
    this.addTaskSpecificEndpoints();
  }

  /**
   * Add project-related endpoints
   */
  addProjectEndpoints(): void {
    const projectSchema = z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      status: z.enum([
        'PLANNING',
        'ACTIVE',
        'ON_HOLD',
        'COMPLETED',
        'CANCELLED',
      ]),
      workspaceId: z.string().uuid(),
      managerId: z.string().uuid(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      budget: z.number().min(0).optional(),
      memberCount: z.number().min(0),
      taskCount: z.number().min(0),
      createdAt: z.date(),
      updatedAt: z.date(),
    });

    const createProjectSchema = projectSchema.omit({
      id: true,
      memberCount: true,
      taskCount: true,
      createdAt: true,
      updatedAt: true,
    });

    const updateProjectSchema = createProjectSchema.partial();

    this.generator.addCrudEndpoints({
      name: 'project',
      path: '/api/v1/projects',
      schemas: {
        entity: projectSchema,
        create: createProjectSchema,
        update: updateProjectSchema,
      },
      tags: ['Projects'],
      permissions: {
        read: 'read:projects',
        create: 'write:projects',
        update: 'write:projects',
        delete: 'delete:projects',
      },
    });
  }

  /**
   * Add authentication endpoints
   */
  addAuthEndpoints(): void {
    // Login endpoint
    this.generator.addEndpoint({
      path: '/api/v1/auth/login',
      method: 'post',
      summary: 'User login',
      description: 'Authenticate user and receive access tokens',
      tags: ['Authentication'],
      operationId: 'login',
      security: [], // No authentication required for login
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address',
                },
                password: {
                  type: 'string',
                  minLength: 8,
                  description: 'User password',
                },
                rememberMe: {
                  type: 'boolean',
                  default: false,
                  description: 'Whether to extend token expiration',
                },
              },
              required: ['email', 'password'],
            },
            examples: this.options.includeExamples
              ? {
                  login: {
                    summary: 'Login example',
                    value: {
                      email: 'user@example.com',
                      password: 'SecurePassword123!',
                      rememberMe: false,
                    },
                  },
                }
              : undefined,
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
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          accessToken: {
                            type: 'string',
                            description: 'JWT access token',
                          },
                          refreshToken: {
                            type: 'string',
                            description: 'JWT refresh token',
                          },
                          expiresIn: {
                            type: 'integer',
                            description: 'Token expiration time in seconds',
                          },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              email: { type: 'string', format: 'email' },
                              name: { type: 'string' },
                              role: { type: 'string' },
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
        '401': {
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    });

    // Register endpoint
    this.generator.addEndpoint({
      path: '/api/v1/auth/register',
      method: 'post',
      summary: 'User registration',
      description: 'Register a new user account',
      tags: ['Authentication'],
      operationId: 'register',
      security: [], // No authentication required for registration
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address',
                },
                password: {
                  type: 'string',
                  minLength: 8,
                  pattern:
                    '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
                  description:
                    'Strong password with mixed case, numbers, and symbols',
                },
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 100,
                  description: 'User full name',
                },
                acceptTerms: {
                  type: 'boolean',
                  enum: [true],
                  description: 'Must accept terms and conditions',
                },
              },
              required: ['email', 'password', 'name', 'acceptTerms'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'User registered successfully',
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
                          id: { type: 'string', format: 'uuid' },
                          email: { type: 'string', format: 'email' },
                          name: { type: 'string' },
                          isActive: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' },
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
        '409': {
          description: 'Email already exists',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    });

    // Logout endpoint
    this.generator.addEndpoint({
      path: '/api/v1/auth/logout',
      method: 'post',
      summary: 'User logout',
      description: 'Invalidate user session and tokens',
      tags: ['Authentication'],
      operationId: 'logout',
      responses: {
        '200': {
          description: 'Logout successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
            },
          },
        },
      },
    });

    // Refresh token endpoint
    this.generator.addEndpoint({
      path: '/api/v1/auth/refresh',
      method: 'post',
      summary: 'Refresh access token',
      description: 'Get a new access token using refresh token',
      tags: ['Authentication'],
      operationId: 'refreshToken',
      security: [], // Uses refresh token instead of access token
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: {
                  type: 'string',
                  description: 'Valid refresh token',
                },
              },
              required: ['refreshToken'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Token refreshed successfully',
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
                          accessToken: { type: 'string' },
                          expiresIn: { type: 'integer' },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        '401': {
          description: 'Invalid refresh token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    });
  }

  /**
   * Add health check endpoints
   */
  addHealthEndpoints(): void {
    this.generator.addEndpoint({
      path: '/health',
      method: 'get',
      summary: 'Basic health check',
      description: 'Check if the service is running',
      tags: ['Health'],
      operationId: 'healthCheck',
      security: [], // No authentication required
      responses: {
        '200': {
          description: 'Service is healthy',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthStatus' },
              examples: this.options.includeExamples
                ? {
                    healthy: {
                      summary: 'Healthy service',
                      value: {
                        status: 'healthy',
                        timestamp: '2024-01-15T12:00:00Z',
                        uptime: 3600,
                        version: '1.0.0',
                      },
                    },
                  }
                : undefined,
            },
          },
        },
      },
    });

    this.generator.addEndpoint({
      path: '/health/detailed',
      method: 'get',
      summary: 'Detailed health check',
      description: 'Check health of all system components',
      tags: ['Health'],
      operationId: 'detailedHealthCheck',
      security: [], // No authentication required
      responses: {
        '200': {
          description: 'Detailed health status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthStatus' },
              examples: this.options.includeExamples
                ? {
                    detailed: {
                      summary: 'Detailed health status',
                      value: {
                        status: 'healthy',
                        timestamp: '2024-01-15T12:00:00Z',
                        uptime: 3600,
                        version: '1.0.0',
                        checks: {
                          database: {
                            status: 'healthy',
                            responseTime: 15,
                            message: 'Database connection successful',
                          },
                          redis: {
                            status: 'healthy',
                            responseTime: 5,
                            message: 'Redis connection successful',
                          },
                          externalApi: {
                            status: 'healthy',
                            responseTime: 120,
                            message: 'External API accessible',
                          },
                        },
                      },
                    },
                  }
                : undefined,
            },
          },
        },
        '503': {
          description: 'Service unhealthy',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthStatus' },
            },
          },
        },
      },
    });
  }

  /**
   * Get the OpenAPI generator instance
   */
  getGenerator(): OpenAPIGenerator {
    return this.generator;
  }

  /**
   * Get the complete OpenAPI specification
   */
  getSpec(): any {
    return this.generator.getSpec();
  }

  /**
   * Setup common endpoints that every API should have
   */
  private setupCommonEndpoints(): void {
    this.addHealthEndpoints();
    this.addAuthEndpoints();
  }

  /**
   * Setup custom schemas from options
   */
  private setupCustomSchemas(): void {
    if (this.options.customSchemas) {
      Object.entries(this.options.customSchemas).forEach(([name, schema]) => {
        this.generator.zodToOpenAPI(schema, name);
      });
    }
  }

  /**
   * Add task-specific endpoints beyond CRUD
   */
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
                      data: {
                        type: 'object',
                        description: 'Updated task with new assignee',
                      },
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
    });

    // Bulk operations endpoint
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
    });
  }

  /**
   * Generate HTML documentation
   */
  private async generateHTMLDocumentation(outputDir: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: './openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`;

    const htmlPath = path.join(outputDir, 'index.html');
    await fs.writeFile(htmlPath, htmlTemplate, 'utf8');
    console.log(`✅ Generated HTML documentation: ${htmlPath}`);
  }

  /**
   * Generate interactive documentation with examples
   */
  private async generateInteractiveDocumentation(
    outputDir: string
  ): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    const readmePath = path.join(outputDir, 'README.md');
    const readmeContent = `# API Documentation

This directory contains the complete API documentation for the Task Management System.

## Files

- \`openapi.json\` - OpenAPI 3.0 specification in JSON format
- \`openapi.yaml\` - OpenAPI 3.0 specification in YAML format
- \`index.html\` - Interactive Swagger UI documentation

## Usage

### Viewing Documentation

Open \`index.html\` in a web browser to view the interactive API documentation.

### Using the Specification

The OpenAPI specification can be used with various tools:

- **Code Generation**: Generate client SDKs using OpenAPI Generator
- **Testing**: Import into Postman or Insomnia for API testing
- **Validation**: Validate API responses against the specification
- **Mock Servers**: Create mock servers for development

### Examples

#### Authentication
\`\`\`bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password"}'
\`\`\`

#### Creating a Task
\`\`\`bash
# Create a task
curl -X POST http://localhost:3000/api/v1/tasks \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "New Task",
    "description": "Task description",
    "projectId": "project-uuid",
    "priority": "HIGH"
  }'
\`\`\`

## Development

To regenerate the documentation, run:

\`\`\`bash
npm run generate:docs
\`\`\`

## Support

For API support, contact: api-support@taskmanagement.com
`;

    await fs.writeFile(readmePath, readmeContent, 'utf8');
    console.log(`✅ Generated documentation README: ${readmePath}`);
  }
}
