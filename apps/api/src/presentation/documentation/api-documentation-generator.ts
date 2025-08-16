import {
  EnvironmentUtils,
  PostmanOperation,
  isPostmanOperation,
} from '@taskmanagement/types/common';
import { FastifyInstance } from 'fastify';
import { ZodSchema } from 'zod';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface APIEndpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
  examples?: Record<string, Example>;
}

export interface Parameter {
  name?: string;
  in?: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: any;
  example?: any;
  $ref?: string;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
  $ref?: string;
}

export interface MediaType {
  schema: any;
  example?: any;
  examples?: Record<string, Example>;
}

export interface Response {
  description?: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
  $ref?: string;
}

export interface Header {
  description?: string;
  schema: any;
  example?: any;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

export interface Example {
  summary?: string;
  description?: string;
  value: any;
}

export interface OpenAPISpec {
  openapi: string;
  info: Info;
  servers: Server[];
  paths: Record<string, Record<string, any>>;
  components: Components;
  security: SecurityRequirement[];
  tags: Tag[];
}

export interface Info {
  title: string;
  description: string;
  version: string;
  contact?: Contact;
  license?: License;
}

export interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

export interface License {
  name: string;
  url?: string;
}

export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface Components {
  schemas: Record<string, any>;
  responses: Record<string, Response>;
  parameters: Record<string, Parameter>;
  examples: Record<string, Example>;
  requestBodies: Record<string, RequestBody>;
  headers: Record<string, Header>;
  securitySchemes: Record<string, SecurityScheme>;
}

export interface SecurityScheme {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
}

export interface ExternalDocumentation {
  description?: string;
  url: string;
}

export class APIDocumentationGenerator {
  private endpoints: APIEndpoint[] = [];
  private schemas: Record<string, any> = {};

  constructor(private readonly logger: LoggingService) {}

  /**
   * Register an API endpoint for documentation
   */
  registerEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.push(endpoint);
  }

  /**
   * Register a schema for documentation
   */
  registerSchema(name: string, schema: ZodSchema<any> | any): void {
    this.schemas[name] = this.convertZodSchemaToOpenAPI(schema);
  }

  /**
   * Generate complete OpenAPI specification
   */
  generateOpenAPISpec(): OpenAPISpec {
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: this.generateInfo(),
      servers: this.generateServers(),
      paths: this.generatePaths(),
      components: this.generateComponents(),
      security: this.generateGlobalSecurity(),
      tags: this.generateTags(),
    };

    return spec;
  }

  /**
   * Generate API info section
   */
  private generateInfo(): Info {
    return {
      title: 'Unified Enterprise Platform API',
      description: `
        A comprehensive task management and collaboration platform API.
        
        ## Features
        - Task and project management
        - Real-time collaboration
        - File management and sharing
        - Analytics and reporting
        - Webhook integrations
        - Advanced search capabilities
        
        ## Authentication
        This API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-token>\`
        
        ## Rate Limiting
        API requests are rate limited based on your subscription plan:
        - Free: 100 requests/hour
        - Pro: 1000 requests/hour  
        - Enterprise: 10000 requests/hour
        
        ## Pagination
        List endpoints support pagination with \`page\` and \`limit\` query parameters.
        Default page size is 20, maximum is 100.
        
        ## Error Handling
        All errors follow a consistent format with appropriate HTTP status codes.
        See the error response schemas for details.
      `,
      version: EnvironmentUtils.getEnvVar('API_VERSION', '1.0.0'),
      contact: {
        name: 'API Support',
        url: 'https://example.com/support',
        email: 'api-support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    };
  }

  /**
   * Generate servers section
   */
  private generateServers(): Server[] {
    return [
      {
        url: EnvironmentUtils.getEnvVar('API_BASE_URL', 'https://api.example.com'),
        description: 'Production server',
      },
      {
        url: EnvironmentUtils.getEnvVar('STAGING_API_URL', 'https://staging-api.example.com'),
        description: 'Staging server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ];
  }

  /**
   * Generate paths section
   */
  private generatePaths(): Record<string, Record<string, any>> {
    const paths: Record<string, Record<string, any>> = {};

    for (const endpoint of this.endpoints) {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      const pathObject = paths[endpoint.path];
      if (pathObject) {
        pathObject[endpoint.method.toLowerCase()] = {
          summary: endpoint.summary,
          description: endpoint.description,
          tags: endpoint.tags,
          parameters: endpoint.parameters,
          requestBody: endpoint.requestBody,
          responses: endpoint.responses,
          security: endpoint.security,
          examples: endpoint.examples,
        };
      }
    }

    return paths;
  }

  /**
   * Generate components section
   */
  private generateComponents(): Components {
    return {
      schemas: {
        ...this.schemas,
        ...this.generateStandardSchemas(),
      },
      responses: this.generateStandardResponses(),
      parameters: this.generateStandardParameters(),
      examples: this.generateStandardExamples(),
      requestBodies: {},
      headers: this.generateStandardHeaders(),
      securitySchemes: this.generateSecuritySchemes(),
    };
  }

  /**
   * Generate standard schemas
   */
  private generateStandardSchemas(): Record<string, any> {
    return {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          message: { type: 'string' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
          error: { $ref: '#/components/schemas/ErrorDetails' },
        },
        required: ['success'],
      },
      ResponseMeta: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' },
          version: { type: 'string' },
          pagination: { $ref: '#/components/schemas/PaginationMeta' },
          performance: { $ref: '#/components/schemas/PerformanceMeta' },
        },
        required: ['timestamp', 'requestId', 'version'],
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          total: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 0 },
          hasNext: { type: 'boolean' },
          hasPrevious: { type: 'boolean' },
        },
        required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrevious'],
      },
      PerformanceMeta: {
        type: 'object',
        properties: {
          responseTime: { type: 'number' },
          cacheHit: { type: 'boolean' },
          queryCount: { type: 'integer' },
        },
        required: ['responseTime'],
      },
      ErrorDetails: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
          stack: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          traceId: { type: 'string' },
          path: { type: 'string' },
          method: { type: 'string' },
        },
        required: ['code', 'message', 'timestamp', 'path', 'method'],
      },
      ValidationError: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
          received: { type: 'string' },
        },
        required: ['field', 'message', 'code'],
      },
    };
  }

  /**
   * Generate standard responses
   */
  private generateStandardResponses(): Record<string, Response> {
    return {
      Success: {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StandardResponse' },
          },
        },
      },
      Created: {
        description: 'Resource created successfully',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StandardResponse' },
          },
        },
      },
      NoContent: {
        description: 'Operation completed successfully with no content',
      },
      BadRequest: {
        description: 'Bad request - validation error or malformed request',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
      Forbidden: {
        description: 'Access denied - insufficient permissions',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
      Conflict: {
        description: 'Resource conflict',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/StandardResponse' },
                {
                  properties: {
                    success: { enum: [false] },
                    error: { $ref: '#/components/schemas/ErrorDetails' },
                  },
                },
              ],
            },
          },
        },
      },
    };
  }

  /**
   * Generate standard parameters
   */
  private generateStandardParameters(): Record<string, Parameter> {
    return {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
        example: 1,
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        example: 20,
      },
      SortByParam: {
        name: 'sortBy',
        in: 'query',
        description: 'Field to sort by',
        required: false,
        schema: { type: 'string' },
        example: 'createdAt',
      },
      SortOrderParam: {
        name: 'sortOrder',
        in: 'query',
        description: 'Sort order',
        required: false,
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        example: 'desc',
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Search query',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        example: 'task management',
      },
      IdParam: {
        name: 'id',
        in: 'path',
        description: 'Resource ID',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        example: '123e4567-e89b-12d3-a456-426614174000',
      },
    };
  }

  /**
   * Generate standard examples
   */
  private generateStandardExamples(): Record<string, Example> {
    return {
      SuccessResponse: {
        summary: 'Successful response',
        description: 'Example of a successful API response',
        value: {
          success: true,
          data: { id: '123', name: 'Example Resource' },
          message: 'Operation completed successfully',
          meta: {
            timestamp: '2023-12-01T10:00:00Z',
            requestId: 'req_123456789',
            version: '1.0.0',
            performance: {
              responseTime: 150,
              cacheHit: false,
              queryCount: 2,
            },
          },
        },
      },
      ErrorResponse: {
        summary: 'Error response',
        description: 'Example of an error response',
        value: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: [
              {
                field: 'email',
                message: 'Invalid email format',
                code: 'invalid_string',
              },
            ],
            timestamp: '2023-12-01T10:00:00Z',
            traceId: 'req_123456789',
            path: '/api/v1/users',
            method: 'POST',
          },
          meta: {
            timestamp: '2023-12-01T10:00:00Z',
            requestId: 'req_123456789',
            version: '1.0.0',
          },
        },
      },
      PaginatedResponse: {
        summary: 'Paginated response',
        description: 'Example of a paginated response',
        value: {
          success: true,
          data: [
            { id: '1', name: 'Item 1' },
            { id: '2', name: 'Item 2' },
          ],
          message: 'Data retrieved successfully',
          meta: {
            timestamp: '2023-12-01T10:00:00Z',
            requestId: 'req_123456789',
            version: '1.0.0',
            pagination: {
              page: 1,
              limit: 20,
              total: 100,
              totalPages: 5,
              hasNext: true,
              hasPrevious: false,
            },
          },
        },
      },
    };
  }

  /**
   * Generate standard headers
   */
  private generateStandardHeaders(): Record<string, Header> {
    return {
      RequestId: {
        description: 'Unique request identifier',
        schema: { type: 'string' },
        example: 'req_123456789',
      },
      ResponseTime: {
        description: 'Response time in milliseconds',
        schema: { type: 'string' },
        example: '150ms',
      },
      CacheStatus: {
        description: 'Cache hit/miss status',
        schema: { type: 'string', enum: ['HIT', 'MISS'] },
        example: 'MISS',
      },
    };
  }

  /**
   * Generate security schemes
   */
  private generateSecuritySchemes(): Record<string, SecurityScheme> {
    return {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token authentication',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key authentication',
      },
      OAuth2: {
        type: 'oauth2',
        description: 'OAuth2 authentication',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://example.com/oauth/authorize',
            tokenUrl: 'https://example.com/oauth/token',
            scopes: {
              read: 'Read access',
              write: 'Write access',
              admin: 'Admin access',
            },
          },
        },
      },
    };
  }

  /**
   * Generate global security requirements
   */
  private generateGlobalSecurity(): SecurityRequirement[] {
    return [{ BearerAuth: [] }, { ApiKeyAuth: [] }];
  }

  /**
   * Generate tags
   */
  private generateTags(): Tag[] {
    return [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Tasks',
        description: 'Task management endpoints',
      },
      {
        name: 'Projects',
        description: 'Project management endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Workspaces',
        description: 'Workspace management endpoints',
      },
      {
        name: 'Notifications',
        description: 'Notification management endpoints',
      },
      {
        name: 'Webhooks',
        description: 'Webhook management endpoints',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting endpoints',
      },
      {
        name: 'Calendar',
        description: 'Calendar and event management endpoints',
      },
      {
        name: 'Files',
        description: 'File management endpoints',
      },
      {
        name: 'Search',
        description: 'Search and discovery endpoints',
      },
      {
        name: 'Collaboration',
        description: 'Collaboration and communication endpoints',
      },
      {
        name: 'Monitoring',
        description: 'System monitoring and health endpoints',
      },
      {
        name: 'Bulk Operations',
        description: 'Bulk operation endpoints',
      },
    ];
  }

  /**
   * Convert Zod schema to OpenAPI schema
   */
  private convertZodSchemaToOpenAPI(schema: any): any {
    // This is a simplified conversion - in a real implementation,
    // you would use a library like zod-to-openapi
    if (schema._def) {
      const def = schema._def;

      switch (def.typeName) {
        case 'ZodString':
          return { type: 'string' };
        case 'ZodNumber':
          return { type: 'number' };
        case 'ZodBoolean':
          return { type: 'boolean' };
        case 'ZodArray':
          return {
            type: 'array',
            items: this.convertZodSchemaToOpenAPI(def.type),
          };
        case 'ZodObject':
          const properties: any = {};
          const required: string[] = [];

          for (const [key, value] of Object.entries(def.shape())) {
            properties[key] = this.convertZodSchemaToOpenAPI(value);
            if (!(value as any).isOptional()) {
              required.push(key);
            }
          }

          return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
          };
        default:
          return { type: 'object' };
      }
    }

    return schema;
  }

  /**
   * Setup Swagger UI
   */
  async setupSwaggerUI(fastify: FastifyInstance): Promise<void> {
    const spec = this.generateOpenAPISpec();

    // Register Swagger plugin
    await fastify.register(require('@fastify/swagger'), {
      openapi: spec,
    });

    await fastify.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        requestInterceptor: (request: any) => {
          // Add default headers
          request.headers['X-Request-ID'] =
            `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return request;
        },
      },
      staticCSP: true,
      transformStaticCSP: (header: string) => header,
    });

    this.logger.info('Swagger UI setup completed', {
      docsUrl: '/docs',
      specUrl: '/docs/json',
    });
  }

  /**
   * Export OpenAPI spec to file
   */
  exportToFile(filePath: string): void {
    const spec = this.generateOpenAPISpec();
    const fs = require('fs');

    fs.writeFileSync(filePath, JSON.stringify(spec, null, 2));

    this.logger.info('OpenAPI spec exported', { filePath });
  }

  /**
   * Generate Postman collection
   */
  generatePostmanCollection(): any {
    const spec = this.generateOpenAPISpec();

    // Convert OpenAPI spec to Postman collection format
    const collection = {
      info: {
        name: spec.info.title,
        description: spec.info.description,
        version: spec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{authToken}}',
            type: 'string',
          },
        ],
      },
      variable: [
        {
          key: 'baseUrl',
          value: spec.servers[0]?.url || 'https://api.example.com',
          type: 'string',
        },
        {
          key: 'authToken',
          value: '',
          type: 'string',
        },
      ],
      item: this.convertPathsToPostmanItems(spec.paths),
    };

    return collection;
  }

  /**
   * Convert OpenAPI paths to Postman items
   */
  private convertPathsToPostmanItems(paths: Record<string, any>): any[] {
    const items: any[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operationData] of Object.entries(methods)) {
        // Type guard to ensure operation has the expected structure
        if (!isPostmanOperation(operationData)) {
          continue;
        }

        const operation = operationData as PostmanOperation;

        const item = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
                type: 'text',
              },
            ],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(Boolean),
            },
            description: operation.description,
            body: undefined as any, // Initialize as undefined, will be set if requestBody exists
          },
          response: [],
        };

        // Add request body if present
        if (operation.requestBody) {
          const jsonContent = operation.requestBody.content?.['application/json'];
          if (jsonContent?.example) {
            item.request.body = {
              mode: 'raw',
              raw: JSON.stringify(jsonContent.example, null, 2),
              options: {
                raw: {
                  language: 'json',
                },
              },
            };
          }
        }

        items.push(item);
      }
    }

    return items;
  }
}
