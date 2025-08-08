import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import config from '../infrastructure/config/environment';
import logger from '../infrastructure/config/logger';

// Define OpenAPI specification type
interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    license?: any;
    contact?: any;
    termsOfService?: string;
  };
  servers?: any[];
  paths: Record<string, any>;
  components?: any;
  security?: any[];
  tags?: any[];
  externalDocs?: any;
}

/**
 * Enhanced Swagger documentation setup with comprehensive API documentation
 */

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Task Management API',
    version: config.defaultApiVersion || '1.0.0',
    description: `
      A comprehensive Task Management System API built with Node.js, Express, and PostgreSQL.
      
      ## Features
      - User authentication and authorization
      - Task and project management
      - Team collaboration
      - Real-time notifications
      - File uploads and attachments
      - Advanced filtering and search
      - Analytics and reporting
      
      ## Authentication
      This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
    `,
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    contact: {
      name: 'API Support',
      email: 'support@taskmanagement.com',
      url: 'https://taskmanagement.com/support',
    },
    termsOfService: 'https://taskmanagement.com/terms',
  },
  servers: [
    {
      url: `http://localhost:${config.port}/api/${config.defaultApiVersion || 'v1'}`,
      description: 'Development server',
    },
    {
      url: `https://api.taskmanagement.com/api/${config.defaultApiVersion || 'v1'}`,
      description: 'Production server',
    },
    {
      url: `https://staging-api.taskmanagement.com/api/${config.defaultApiVersion || 'v1'}`,
      description: 'Staging server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service communication',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'An error occurred',
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
              requestId: {
                type: 'string',
              },
              version: {
                type: 'string',
              },
              code: {
                type: 'string',
              },
            },
          },
          errors: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      ValidationError: {
        allOf: [
          { $ref: '#/components/schemas/Error' },
          {
            type: 'object',
            properties: {
              errors: {
                type: 'object',
                additionalProperties: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
                example: {
                  email: ['Email is required', 'Email must be valid'],
                  password: ['Password must be at least 8 characters'],
                },
              },
            },
          },
        ],
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Total number of items',
            example: 100,
          },
          page: {
            type: 'integer',
            description: 'Current page number',
            example: 1,
          },
          limit: {
            type: 'integer',
            description: 'Number of items per page',
            example: 10,
          },
          pages: {
            type: 'integer',
            description: 'Total number of pages',
            example: 10,
          },
          hasNext: {
            type: 'boolean',
            description: 'Whether there is a next page',
            example: true,
          },
          hasPrev: {
            type: 'boolean',
            description: 'Whether there is a previous page',
            example: false,
          },
          nextPage: {
            type: 'integer',
            description: 'Next page number (if available)',
            example: 2,
          },
          prevPage: {
            type: 'integer',
            description: 'Previous page number (if available)',
            example: null,
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Operation completed successfully',
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
              requestId: {
                type: 'string',
              },
              version: {
                type: 'string',
              },
              pagination: {
                $ref: '#/components/schemas/PaginationMeta',
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
        required: false,
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
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description:
          'Sort fields (comma-separated). Prefix with - for descending order',
        required: false,
        schema: {
          type: 'string',
          example: '-createdAt,title',
        },
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Search term for text-based filtering',
        required: false,
        schema: {
          type: 'string',
        },
      },
      FieldsParam: {
        name: 'fields',
        in: 'query',
        description: 'Fields to include in response (comma-separated)',
        required: false,
        schema: {
          type: 'string',
          example: 'id,title,status',
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValidationError',
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Too Many Requests - Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints',
    },
    {
      name: 'Users',
      description: 'User management and profile endpoints',
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
      name: 'Teams',
      description: 'Team management and collaboration endpoints',
    },
    {
      name: 'Workspaces',
      description: 'Workspace management endpoints',
    },
    {
      name: 'Comments',
      description: 'Comment and discussion endpoints',
    },
    {
      name: 'Notifications',
      description: 'Notification management endpoints',
    },
    {
      name: 'Activities',
      description: 'Activity log and audit trail endpoints',
    },
    {
      name: 'Invitations',
      description: 'Team and project invitation endpoints',
    },
    {
      name: 'Recurring Tasks',
      description: 'Recurring task management endpoints',
    },
    {
      name: 'Task Templates',
      description: 'Task template management endpoints',
    },
    {
      name: 'Calendar',
      description: 'Calendar integration and event endpoints',
    },
    {
      name: 'Analytics',
      description: 'Analytics and reporting endpoints',
    },
    {
      name: 'Files',
      description: 'File upload and attachment endpoints',
    },
    {
      name: 'Health',
      description: 'System health and monitoring endpoints',
    },
  ],
  externalDocs: {
    description: 'Find more info here',
    url: 'https://taskmanagement.com/docs',
  },
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/models/*.ts',
    './src/db/schema/*.ts',
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options) as OpenAPISpec;

/**
 * Configure Swagger UI for the Express app
 * @param app Express application
 */
export const setupSwagger = (app: Express): void => {
  // Custom CSS for Swagger UI
  const customCss = `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #3b82f6 }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px }
  `;

  // Swagger UI options
  const swaggerUiOptions = {
    customCss,
    customSiteTitle: 'Task Management API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
  };

  // Serve swagger docs
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // Serve swagger spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve swagger spec as YAML
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    const yaml = require('js-yaml');
    res.send(yaml.dump(swaggerSpec));
  });

  // Health check endpoint for API docs
  app.get('/api-docs/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      swagger: {
        version: swaggerSpec.info.version,
        title: swaggerSpec.info.title,
      },
    });
  });

  logger.info(
    `Swagger UI available at http://localhost:${config.port}/api-docs`
  );
  logger.info(
    `Swagger JSON available at http://localhost:${config.port}/api-docs.json`
  );
  logger.info(
    `Swagger YAML available at http://localhost:${config.port}/api-docs.yaml`
  );
};

/**
 * Get the swagger specification
 * @returns Swagger specification object
 */
export const getSwaggerSpec = () => swaggerSpec;

/**
 * Validate swagger specification
 * @returns Validation result
 */
export const validateSwaggerSpec = (): { valid: boolean; errors?: any[] } => {
  try {
    // Basic validation - check if required fields are present
    if (
      !swaggerSpec.info ||
      !swaggerSpec.info.title ||
      !swaggerSpec.info.version
    ) {
      return {
        valid: false,
        errors: ['Missing required info fields (title, version)'],
      };
    }

    if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
      return {
        valid: false,
        errors: ['No API paths defined'],
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error ? error.message : 'Unknown validation error',
      ],
    };
  }
};

/**
 * Generate OpenAPI documentation for a specific route
 * @param method HTTP method
 * @param path Route path
 * @param summary Route summary
 * @param description Route description
 * @param tags Route tags
 * @param parameters Route parameters
 * @param responses Route responses
 * @returns OpenAPI documentation object
 */
export const generateRouteDoc = (options: {
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  security?: any[];
}) => {
  const {
    method,
    path,
    summary,
    description,
    tags = [],
    parameters = [],
    requestBody,
    responses = {},
    security,
  } = options;

  const doc: any = {
    [method.toLowerCase()]: {
      summary,
      description,
      tags,
      parameters,
      responses: {
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
        '422': { $ref: '#/components/responses/ValidationError' },
        '429': { $ref: '#/components/responses/TooManyRequests' },
        '500': { $ref: '#/components/responses/InternalServerError' },
        ...responses,
      },
    },
  };

  if (requestBody) {
    doc[method.toLowerCase()].requestBody = requestBody;
  }

  if (security) {
    doc[method.toLowerCase()].security = security;
  }

  return doc;
};

/**
 * Common parameter definitions
 */
export const commonParameters = {
  pagination: [
    { $ref: '#/components/parameters/PageParam' },
    { $ref: '#/components/parameters/LimitParam' },
  ],
  sorting: [{ $ref: '#/components/parameters/SortParam' }],
  search: [{ $ref: '#/components/parameters/SearchParam' }],
  fields: [{ $ref: '#/components/parameters/FieldsParam' }],
  all: [
    { $ref: '#/components/parameters/PageParam' },
    { $ref: '#/components/parameters/LimitParam' },
    { $ref: '#/components/parameters/SortParam' },
    { $ref: '#/components/parameters/SearchParam' },
    { $ref: '#/components/parameters/FieldsParam' },
  ],
};

/**
 * Common response definitions
 */
export const commonResponses = {
  success: (dataSchema?: any) => ({
    '200': {
      description: 'Success',
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: '#/components/schemas/SuccessResponse' },
              dataSchema ? { properties: { data: dataSchema } } : {},
            ],
          },
        },
      },
    },
  }),
  created: (dataSchema?: any) => ({
    '201': {
      description: 'Created',
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: '#/components/schemas/SuccessResponse' },
              dataSchema ? { properties: { data: dataSchema } } : {},
            ],
          },
        },
      },
    },
  }),
  noContent: () => ({
    '204': {
      description: 'No Content',
    },
  }),
};

export default {
  setupSwagger,
  getSwaggerSpec,
  validateSwaggerSpec,
  generateRouteDoc,
  commonParameters,
  commonResponses,
};
