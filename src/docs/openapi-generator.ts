import { z } from 'zod';
import { OpenAPIV3 } from 'openapi-types';

export interface EndpointDocumentation {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  summary: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  parameters?: OpenAPIV3.ParameterObject[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  responses: Record<string, OpenAPIV3.ResponseObject>;
  security?: OpenAPIV3.SecurityRequirementObject[];
  deprecated?: boolean;
}

export class OpenAPIGenerator {
  private readonly spec: OpenAPIV3.Document;

  constructor() {
    this.spec = {
      openapi: '3.0.3',
      info: {
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
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.taskmanagement.com',
          description: 'Production server',
        },
      ],
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
        },
        responses: {
          UnauthorizedError: {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
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
              },
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

    this.spec.paths[endpoint.path][endpoint.method] = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags || ['General'],
      operationId: endpoint.operationId,
      parameters: endpoint.parameters,
      requestBody: endpoint.requestBody,
      responses: {
        ...endpoint.responses,
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' },
        '500': { $ref: '#/components/responses/InternalServerError' },
      },
      security: endpoint.security || [{ bearerAuth: [] }],
      deprecated: endpoint.deprecated,
    };
  }

  /**
   * Convert Zod schema to OpenAPI schema
   */
  zodToOpenAPI(schema: z.ZodSchema, name?: string): OpenAPIV3.SchemaObject {
    const openApiSchema = this.convertZodSchema(schema);

    if (name && openApiSchema) {
      this.spec.components!.schemas![name] = openApiSchema;
      return { $ref: `#/components/schemas/${name}` };
    }

    return openApiSchema || {};
  }

  /**
   * Add CRUD endpoints for a resource
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
  }): void {
    const { name, path, schemas, tags = [name] } = resource;
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
      description: `Retrieve a paginated list of ${name}s`,
      tags,
      operationId: `list${capitalizedName}s`,
      parameters: schemas.query
        ? [
            {
              name: 'query',
              in: 'query',
              schema: {
                $ref: `#/components/schemas/${capitalizedName}QueryParams`,
              },
            },
          ]
        : [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
          ],
      responses: {
        '200': {
          description: `List of ${name}s`,
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
                        items: {
                          $ref: `#/components/schemas/${capitalizedName}`,
                        },
                      },
                      meta: { $ref: '#/components/schemas/PaginationMeta' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    // POST /resources - Create
    this.addEndpoint({
      path,
      method: 'post',
      summary: `Create ${name}`,
      description: `Create a new ${name}`,
      tags,
      operationId: `create${capitalizedName}`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/Create${capitalizedName}Request`,
            },
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
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: `#/components/schemas/${capitalizedName}` },
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

    // GET /resources/:id - Get by ID
    this.addEndpoint({
      path: `${path}/{id}`,
      method: 'get',
      summary: `Get ${name} by ID`,
      description: `Retrieve a specific ${name} by its ID`,
      tags,
      operationId: `get${capitalizedName}ById`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: `${capitalizedName} ID`,
        },
      ],
      responses: {
        '200': {
          description: `${capitalizedName} details`,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: `#/components/schemas/${capitalizedName}` },
                    },
                  },
                ],
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
    });

    // PUT /resources/:id - Update
    this.addEndpoint({
      path: `${path}/{id}`,
      method: 'put',
      summary: `Update ${name}`,
      description: `Update an existing ${name}`,
      tags,
      operationId: `update${capitalizedName}`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: `${capitalizedName} ID`,
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/Update${capitalizedName}Request`,
            },
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
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: `#/components/schemas/${capitalizedName}` },
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

    // DELETE /resources/:id - Delete
    this.addEndpoint({
      path: `${path}/{id}`,
      method: 'delete',
      summary: `Delete ${name}`,
      description: `Delete a ${name}`,
      tags,
      operationId: `delete${capitalizedName}`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: `${capitalizedName} ID`,
        },
      ],
      responses: {
        '204': {
          description: `${capitalizedName} deleted successfully`,
        },
        '404': { $ref: '#/components/responses/NotFoundError' },
      },
    });
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
    // Simple YAML generation (in production, use a proper YAML library)
    return JSON.stringify(this.spec, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/{/g, '')
      .replace(/}/g, '');
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
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['success', 'timestamp'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
              correlationId: { type: 'string' },
            },
            required: ['message', 'code'],
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['success', 'error', 'timestamp'],
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                    received: {},
                  },
                },
              },
              correlationId: { type: 'string' },
            },
            required: ['message', 'code'],
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['success', 'error', 'timestamp'],
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1 },
          total: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 0 },
        },
        required: ['page', 'limit', 'total', 'totalPages'],
      },
    };
  }

  /**
   * Convert Zod schema to OpenAPI schema object
   */
  private convertZodSchema(schema: z.ZodSchema): OpenAPIV3.SchemaObject | null {
    if (schema instanceof z.ZodString) {
      return { type: 'string' };
    }

    if (schema instanceof z.ZodNumber) {
      return { type: 'number' };
    }

    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    if (schema instanceof z.ZodDate) {
      return { type: 'string', format: 'date-time' };
    }

    if (schema instanceof z.ZodArray) {
      const itemSchema = this.convertZodSchema(schema.element);
      return {
        type: 'array',
        items: itemSchema || {},
      };
    }

    if (schema instanceof z.ZodObject) {
      const properties: Record<string, OpenAPIV3.SchemaObject> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(schema.shape)) {
        const propSchema = this.convertZodSchema(value as z.ZodSchema);
        if (propSchema) {
          properties[key] = propSchema;

          // Check if field is required (not optional)
          if (!(value instanceof z.ZodOptional)) {
            required.push(key);
          }
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema.options,
      };
    }

    if (schema instanceof z.ZodOptional) {
      return this.convertZodSchema(schema.unwrap());
    }

    if (schema instanceof z.ZodNullable) {
      const innerSchema = this.convertZodSchema(schema.unwrap());
      return innerSchema ? { ...innerSchema, nullable: true } : null;
    }

    // Default fallback
    return { type: 'object' };
  }
}
