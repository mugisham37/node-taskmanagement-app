import { z } from 'zod';
import { OpenAPIV3 } from 'openapi-types';

export interface EndpointDocumentation {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  summary: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  parameters?: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  responses: Record<string, OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject>;
  security?: OpenAPIV3.SecurityRequirementObject[];
  deprecated?: boolean;
  examples?: Record<string, any>;
}

export interface APIDocumentationConfig {
  title: string;
  description: string;
  version: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
}

export class OpenAPIGenerator {
  private readonly spec: OpenAPIV3.Document;

  constructor(config?: Partial<APIDocumentationConfig>) {
    const defaultConfig: APIDocumentationConfig = {
      title: 'Task Management API',
      description:
        'Comprehensive task management system with enterprise features',
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'api-support@taskmanagement.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      servers: [
        {
          url: process.env['API_BASE_URL'] || 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.taskmanagement.com',
          description: 'Production server',
        },
      ],
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.spec = {
      openapi: '3.0.3',
      info: {
        title: finalConfig.title,
        description: finalConfig.description,
        version: finalConfig.version,
        ...(finalConfig.contact && { contact: finalConfig.contact }),
        ...(finalConfig.license && { license: finalConfig.license }),
      },
      servers: finalConfig.servers,
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token for authentication',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for service-to-service authentication',
          },
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: '/oauth/authorize',
                tokenUrl: '/oauth/token',
                scopes: {
                  'read:tasks': 'Read tasks',
                  'write:tasks': 'Create and update tasks',
                  'delete:tasks': 'Delete tasks',
                  'read:projects': 'Read projects',
                  'write:projects': 'Create and update projects',
                  admin: 'Administrative access',
                },
              },
            },
          },
        },
        responses: {
          UnauthorizedError: {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                examples: {
                  tokenMissing: {
                    summary: 'Missing token',
                    value: {
                      success: false,
                      error: {
                        message: 'Authentication token is required',
                        code: 'AUTH_TOKEN_MISSING',
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                  tokenExpired: {
                    summary: 'Expired token',
                    value: {
                      success: false,
                      error: {
                        message: 'Authentication token has expired',
                        code: 'AUTH_TOKEN_EXPIRED',
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              },
            },
          },
          ForbiddenError: {
            description: 'Access denied',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                examples: {
                  insufficientPermissions: {
                    summary: 'Insufficient permissions',
                    value: {
                      success: false,
                      error: {
                        message:
                          'Insufficient permissions to access this resource',
                        code: 'INSUFFICIENT_PERMISSIONS',
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              },
            },
          },
          NotFoundError: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                examples: {
                  resourceNotFound: {
                    summary: 'Resource not found',
                    value: {
                      success: false,
                      error: {
                        message: 'The requested resource was not found',
                        code: 'RESOURCE_NOT_FOUND',
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              },
            },
          },
          ValidationError: {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationErrorResponse',
                },
                examples: {
                  validationFailed: {
                    summary: 'Validation failed',
                    value: {
                      success: false,
                      error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: [
                          {
                            field: 'email',
                            message: 'Invalid email format',
                            code: 'INVALID_FORMAT',
                            received: 'invalid-email',
                          },
                        ],
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              },
            },
          },
          RateLimitError: {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                examples: {
                  rateLimitExceeded: {
                    summary: 'Rate limit exceeded',
                    value: {
                      success: false,
                      error: {
                        message: 'Rate limit exceeded. Please try again later.',
                        code: 'RATE_LIMIT_EXCEEDED',
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              },
            },
            headers: {
              'X-RateLimit-Limit': {
                description: 'Request limit per window',
                schema: { type: 'integer' },
              },
              'X-RateLimit-Remaining': {
                description: 'Remaining requests in current window',
                schema: { type: 'integer' },
              },
              'X-RateLimit-Reset': {
                description: 'Time when the rate limit resets (Unix timestamp)',
                schema: { type: 'integer' },
              },
            },
          },
          InternalServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                examples: {
                  internalError: {
                    summary: 'Internal server error',
                    value: {
                      success: false,
                      error: {
                        message: 'An internal server error occurred',
                        code: 'INTERNAL_SERVER_ERROR',
                        correlationId: 'req_123456',
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              },
            },
          },
        },
        parameters: {
          PageParam: {
            name: 'page',
            in: 'query',
            description: 'Page number for pagination',
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
          },
          LimitParam: {
            name: 'limit',
            in: 'query',
            description: 'Number of items per page',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
          SortParam: {
            name: 'sort',
            in: 'query',
            description: 'Sort field and direction (e.g., "createdAt:desc")',
            schema: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*:(asc|desc)$',
            },
          },
          SearchParam: {
            name: 'search',
            in: 'query',
            description: 'Search query string',
            schema: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    };

    this.addCommonSchemas();
  }

  /**
   * Add an endpoint to the OpenAPI specification
   */
  addEndpoint(endpoint: EndpointDocumentation): void {
    if (!this.spec.paths[endpoint.path]) {
      this.spec.paths[endpoint.path] = {};
    }

    const operation: OpenAPIV3.OperationObject = {
      summary: endpoint.summary,
      tags: endpoint.tags || ['General'],
      responses: {
        ...endpoint.responses,
        '401': { $ref: '#/components/responses/UnauthorizedError' } as OpenAPIV3.ReferenceObject,
        '403': { $ref: '#/components/responses/ForbiddenError' } as OpenAPIV3.ReferenceObject,
        '429': { $ref: '#/components/responses/RateLimitError' } as OpenAPIV3.ReferenceObject,
        '500': { $ref: '#/components/responses/InternalServerError' } as OpenAPIV3.ReferenceObject,
      },
      security: endpoint.security || [{ bearerAuth: [] }],
      ...(endpoint.description && { description: endpoint.description }),
      ...(endpoint.operationId && { operationId: endpoint.operationId }),
      ...(endpoint.parameters && { parameters: endpoint.parameters }),
      ...(endpoint.requestBody && { requestBody: endpoint.requestBody }),
      ...(endpoint.deprecated && { deprecated: endpoint.deprecated }),
    };

    // Add examples if provided
    if (endpoint.examples && operation.requestBody && 'content' in operation.requestBody) {
      const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
      if (requestBody.content?.['application/json']) {
        requestBody.content['application/json'].examples = endpoint.examples;
      }
    }

    // Ensure the path object exists
    const pathObject = this.spec.paths[endpoint.path];
    if (pathObject) {
      pathObject[endpoint.method] = operation;
    }
  }

  /**
   * Convert Zod schema to OpenAPI schema
   */
  zodToOpenAPI(schema: z.ZodSchema, name?: string): OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject {
    const openApiSchema = this.convertZodSchema(schema);

    if (name && openApiSchema) {
      this.spec.components!.schemas![name] = openApiSchema;
      return { $ref: `#/components/schemas/${name}` } as OpenAPIV3.ReferenceObject;
    }

    return openApiSchema || {};
  }

  /**
   * Add CRUD endpoints for a resource with enhanced features
   */
  addCrudEndpoints(resource: {
    name: string;
    path: string;
    schemas: {
      entity: z.ZodSchema;
      create: z.ZodSchema;
      update: z.ZodSchema;
      query?: z.ZodSchema;
    };
    tags?: string[];
    permissions?: {
      read?: string;
      create?: string;
      update?: string;
      delete?: string;
    };
    examples?: {
      entity?: any;
      create?: any;
      update?: any;
    };
  }): void {
    const {
      name,
      path,
      schemas,
      tags = [name],
      permissions = {},
      examples = {},
    } = resource;
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

    // Add schemas to components
    this.zodToOpenAPI(schemas.entity, capitalizedName);
    this.zodToOpenAPI(schemas.create, `Create${capitalizedName}Request`);
    this.zodToOpenAPI(schemas.update, `Update${capitalizedName}Request`);
    if (schemas.query) {
      this.zodToOpenAPI(schemas.query, `${capitalizedName}QueryParams`);
    }

    // GET /resources - List all
    this.addEndpoint({
      path,
      method: 'get',
      summary: `List ${name}s`,
      description: `Retrieve a paginated list of ${name}s with optional filtering and sorting`,
      tags,
      operationId: `list${capitalizedName}s`,
      parameters: [
        { $ref: '#/components/parameters/PageParam' } as OpenAPIV3.ReferenceObject,
        { $ref: '#/components/parameters/LimitParam' } as OpenAPIV3.ReferenceObject,
        { $ref: '#/components/parameters/SortParam' } as OpenAPIV3.ReferenceObject,
        { $ref: '#/components/parameters/SearchParam' } as OpenAPIV3.ReferenceObject,
        ...(schemas.query
          ? [
              {
                name: 'filter',
                in: 'query' as const,
                description: `Additional filtering options for ${name}s`,
                style: 'deepObject' as const,
                explode: true,
                schema: {
                  $ref: `#/components/schemas/${capitalizedName}QueryParams`,
                } as OpenAPIV3.ReferenceObject,
              } as OpenAPIV3.ParameterObject,
            ]
          : []),
      ],
      responses: {
        '200': {
          description: `List of ${name}s retrieved successfully`,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' } as OpenAPIV3.ReferenceObject,
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${capitalizedName}`,
                        } as OpenAPIV3.ReferenceObject,
                      },
                      meta: { $ref: '#/components/schemas/PaginationMeta' } as OpenAPIV3.ReferenceObject,
                    },
                  },
                ],
              },
              ...(examples.entity && {
                examples: {
                  success: {
                    summary: `Successful ${name} list`,
                    value: {
                      success: true,
                      data: [examples.entity],
                      meta: {
                        page: 1,
                        limit: 20,
                        total: 1,
                        totalPages: 1,
                      },
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              }),
            },
          },
        },
      },
      ...(permissions.read && {
        security: [{ bearerAuth: [], oauth2: [permissions.read] }],
      }),
    });

    // POST /resources - Create
    this.addEndpoint({
      path,
      method: 'post',
      summary: `Create ${name}`,
      description: `Create a new ${name} with the provided data`,
      tags,
      operationId: `create${capitalizedName}`,
      requestBody: {
        required: true,
        description: `${capitalizedName} data to create`,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/Create${capitalizedName}Request`,
            } as OpenAPIV3.ReferenceObject,
            ...(examples.create && {
              examples: {
                example: {
                  summary: `Create ${name} example`,
                  value: examples.create,
                },
              },
            }),
          },
        },
      },
      responses: {
        '201': {
          description: `${capitalizedName} created successfully`,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' } as OpenAPIV3.ReferenceObject,
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: `#/components/schemas/${capitalizedName}` } as OpenAPIV3.ReferenceObject,
                    },
                  },
                ],
              },
              ...(examples.entity && {
                examples: {
                  success: {
                    summary: `Successfully created ${name}`,
                    value: {
                      success: true,
                      data: examples.entity,
                      message: `${capitalizedName} created successfully`,
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              }),
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' } as OpenAPIV3.ReferenceObject,
      },
      ...(permissions.create && {
        security: [{ bearerAuth: [], oauth2: [permissions.create] }],
      }),
    });

    // GET /resources/:id - Get by ID
    this.addEndpoint({
      path: `${path}/{id}`,
      method: 'get',
      summary: `Get ${name} by ID`,
      description: `Retrieve a specific ${name} by its unique identifier`,
      tags,
      operationId: `get${capitalizedName}ById`,
      parameters: [
        {
          name: 'id',
          in: 'path' as const,
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: `Unique identifier for the ${name}`,
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
      responses: {
        '200': {
          description: `${capitalizedName} retrieved successfully`,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' } as OpenAPIV3.ReferenceObject,
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: `#/components/schemas/${capitalizedName}` } as OpenAPIV3.ReferenceObject,
                    },
                  },
                ],
              },
              ...(examples.entity && {
                examples: {
                  success: {
                    summary: `Successfully retrieved ${name}`,
                    value: {
                      success: true,
                      data: examples.entity,
                      timestamp: '2024-01-15T12:00:00Z',
                    },
                  },
                },
              }),
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFoundError' } as OpenAPIV3.ReferenceObject,
      },
      ...(permissions.read && {
        security: [{ bearerAuth: [], oauth2: [permissions.read] }],
      }),
    });

    // PUT /resources/:id - Update
    this.addEndpoint({
      path: `${path}/{id}`,
      method: 'put',
      summary: `Update ${name}`,
      description: `Update an existing ${name} with new data`,
      tags,
      operationId: `update${capitalizedName}`,
      parameters: [
        {
          name: 'id',
          in: 'path' as const,
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: `Unique identifier for the ${name}`,
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
      requestBody: {
        required: true,
        description: `Updated ${name} data`,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/Update${capitalizedName}Request`,
            } as OpenAPIV3.ReferenceObject,
            ...(examples.update && {
              examples: {
                example: {
                  summary: `Update ${name} example`,
                  value: examples.update,
                },
              },
            }),
          },
        },
      },
      responses: {
        '200': {
          description: `${capitalizedName} updated successfully`,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' } as OpenAPIV3.ReferenceObject,
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: `#/components/schemas/${capitalizedName}` } as OpenAPIV3.ReferenceObject,
                    },
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' } as OpenAPIV3.ReferenceObject,
        '404': { $ref: '#/components/responses/NotFoundError' } as OpenAPIV3.ReferenceObject,
      },
      ...(permissions.update && {
        security: [{ bearerAuth: [], oauth2: [permissions.update] }],
      }),
    });

    // DELETE /resources/:id - Delete
    this.addEndpoint({
      path: `${path}/{id}`,
      method: 'delete',
      summary: `Delete ${name}`,
      description: `Permanently delete a ${name}`,
      tags,
      operationId: `delete${capitalizedName}`,
      parameters: [
        {
          name: 'id',
          in: 'path' as const,
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: `Unique identifier for the ${name}`,
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
      responses: {
        '204': {
          description: `${capitalizedName} deleted successfully`,
        },
        '404': { $ref: '#/components/responses/NotFoundError' } as OpenAPIV3.ReferenceObject,
      },
      ...(permissions.delete && {
        security: [{ bearerAuth: [], oauth2: [permissions.delete] }],
      }),
    });
  }

  /**
   * Add WebSocket documentation
   */
  addWebSocketDocumentation(
    events: Array<{
      name: string;
      description: string;
      schema: z.ZodSchema;
      example?: any;
    }>
  ): void {
    // Add WebSocket schemas
    events.forEach(event => {
      this.zodToOpenAPI(event.schema, `${event.name}Event`);
    });

    // Add WebSocket info to the spec
    if (!this.spec.info.description?.includes('WebSocket')) {
      this.spec.info.description +=
        '\n\nThis API also supports real-time communication via WebSocket connections.';
    }
  }

  /**
   * Get the complete OpenAPI specification
   */
  getSpec(): OpenAPIV3.Document {
    return this.spec;
  }

  /**
   * Generate OpenAPI JSON
   */
  generateJSON(): string {
    return JSON.stringify(this.spec, null, 2);
  }

  /**
   * Generate OpenAPI YAML
   */
  generateYAML(): string {
    // Note: In production, use a proper YAML library like js-yaml
    const yaml = require('js-yaml');
    return yaml.dump(this.spec, { indent: 2, lineWidth: 120 });
  }

  /**
   * Export specification to file
   */
  async exportToFile(format: 'json' | 'yaml', filePath: string): Promise<void> {
    const fs = require('fs').promises;
    const content =
      format === 'json' ? this.generateJSON() : this.generateYAML();
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Add common schemas used across the API
   */
  private addCommonSchemas(): void {
    this.spec.components!.schemas! = {
      ...this.spec.components!.schemas!,
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Indicates if the request was successful',
          },
          message: {
            type: 'string',
            description: 'Human-readable success message',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp of the response',
          },
          requestId: {
            type: 'string',
            description: 'Unique identifier for request tracing',
          },
        },
        required: ['success', 'timestamp'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
            description: 'Indicates if the request was successful',
          },
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Human-readable error message',
              },
              code: {
                type: 'string',
                description: 'Machine-readable error code',
              },
              correlationId: {
                type: 'string',
                description: 'Unique identifier for error tracking',
              },
              details: {
                type: 'object',
                description: 'Additional error context',
                additionalProperties: true,
              },
            },
            required: ['message', 'code'],
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp of the response',
          },
        },
        required: ['success', 'error', 'timestamp'],
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
            description: 'Indicates if the request was successful',
          },
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Human-readable error message',
              },
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
                description: 'Machine-readable error code',
              },
              details: {
                type: 'array',
                description: 'Detailed validation errors',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                      description: 'Field that failed validation',
                    },
                    message: {
                      type: 'string',
                      description: 'Validation error message',
                    },
                    code: {
                      type: 'string',
                      description: 'Validation error code',
                    },
                    received: {
                      description: 'Value that was received',
                    },
                    expected: {
                      description: 'Expected value or format',
                    },
                  },
                  required: ['field', 'message', 'code'],
                },
              },
              correlationId: {
                type: 'string',
                description: 'Unique identifier for error tracking',
              },
            },
            required: ['message', 'code'],
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp of the response',
          },
        },
        required: ['success', 'error', 'timestamp'],
      },
      PaginationMeta: {
        type: 'object',
        description: 'Pagination metadata',
        properties: {
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Current page number',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            description: 'Number of items per page',
          },
          total: {
            type: 'integer',
            minimum: 0,
            description: 'Total number of items',
          },
          totalPages: {
            type: 'integer',
            minimum: 0,
            description: 'Total number of pages',
          },
          hasNext: {
            type: 'boolean',
            description: 'Whether there are more pages available',
          },
          hasPrev: {
            type: 'boolean',
            description: 'Whether there are previous pages available',
          },
        },
        required: ['page', 'limit', 'total', 'totalPages'],
      },
      HealthStatus: {
        type: 'object',
        description: 'System health status',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Overall system health status',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp',
          },
          uptime: {
            type: 'integer',
            description: 'System uptime in seconds',
          },
          version: {
            type: 'string',
            description: 'Application version',
          },
          checks: {
            type: 'object',
            description: 'Individual health check results',
            additionalProperties: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['healthy', 'unhealthy'],
                },
                responseTime: {
                  type: 'number',
                  description: 'Response time in milliseconds',
                },
                message: {
                  type: 'string',
                  description: 'Additional status information',
                },
              },
            },
          },
        },
        required: ['status', 'timestamp'],
      },
    };
  }

  /**
   * Convert Zod schema to OpenAPI schema object with enhanced support
   */
  private convertZodSchema(schema: z.ZodSchema): OpenAPIV3.SchemaObject | null {
    // Handle ZodString
    if (schema instanceof z.ZodString) {
      const stringSchema: OpenAPIV3.SchemaObject = { type: 'string' };

      // Add string-specific constraints
      const checks = (schema as any)._def.checks || [];
      checks.forEach((check: any) => {
        switch (check.kind) {
          case 'min':
            stringSchema.minLength = check.value;
            break;
          case 'max':
            stringSchema.maxLength = check.value;
            break;
          case 'email':
            stringSchema.format = 'email';
            break;
          case 'url':
            stringSchema.format = 'uri';
            break;
          case 'uuid':
            stringSchema.format = 'uuid';
            break;
          case 'regex':
            stringSchema.pattern = check.regex.source;
            break;
        }
      });

      return stringSchema;
    }

    // Handle ZodNumber
    if (schema instanceof z.ZodNumber) {
      const numberSchema: OpenAPIV3.SchemaObject = { type: 'number' };

      const checks = (schema as any)._def.checks || [];
      checks.forEach((check: any) => {
        switch (check.kind) {
          case 'min':
            numberSchema.minimum = check.value;
            break;
          case 'max':
            numberSchema.maximum = check.value;
            break;
          case 'int':
            numberSchema.type = 'integer';
            break;
        }
      });

      return numberSchema;
    }

    // Handle ZodBoolean
    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    // Handle ZodDate
    if (schema instanceof z.ZodDate) {
      return { type: 'string', format: 'date-time' };
    }

    // Handle ZodArray
    if (schema instanceof z.ZodArray) {
      const itemSchema = this.convertZodSchema(schema.element);
      const arraySchema: OpenAPIV3.SchemaObject = {
        type: 'array',
        items: itemSchema || {},
      };

      const def = (schema as any)._def;
      if (def.minLength) arraySchema.minItems = def.minLength.value;
      if (def.maxLength) arraySchema.maxItems = def.maxLength.value;

      return arraySchema;
    }

    // Handle ZodObject
    if (schema instanceof z.ZodObject) {
      const properties: Record<string, OpenAPIV3.SchemaObject> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(schema.shape)) {
        const propSchema = this.convertZodSchema(value as z.ZodSchema);
        if (propSchema) {
          properties[key] = propSchema;

          // Check if field is required (not optional)
          if (
            !(value instanceof z.ZodOptional) &&
            !(value instanceof z.ZodDefault)
          ) {
            required.push(key);
          }
        }
      }

      const result: OpenAPIV3.SchemaObject = {
        type: 'object',
        properties,
      };

      if (required.length > 0) {
        result.required = required;
      }

      return result;
    }

    // Handle ZodEnum
    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema.options,
      };
    }

    // Handle ZodLiteral
    if (schema instanceof z.ZodLiteral) {
      return {
        type: typeof schema.value as any,
        enum: [schema.value],
      };
    }

    // Handle ZodUnion
    if (schema instanceof z.ZodUnion) {
      const options = schema.options
        .map((option: z.ZodSchema) => this.convertZodSchema(option))
        .filter(Boolean);

      return {
        oneOf: options,
      };
    }

    // Handle ZodOptional
    if (schema instanceof z.ZodOptional) {
      const innerSchema = this.convertZodSchema(schema.unwrap());
      return innerSchema ? { ...innerSchema, nullable: true } : null;
    }

    // Handle ZodNullable
    if (schema instanceof z.ZodNullable) {
      const innerSchema = this.convertZodSchema(schema.unwrap());
      return innerSchema ? { ...innerSchema, nullable: true } : null;
    }

    // Handle ZodDefault
    if (schema instanceof z.ZodDefault) {
      const innerSchema = this.convertZodSchema(schema.removeDefault());
      if (innerSchema) {
        innerSchema.default = schema._def.defaultValue();
      }
      return innerSchema;
    }

    // Default fallback
    return { type: 'object' };
  }
}
