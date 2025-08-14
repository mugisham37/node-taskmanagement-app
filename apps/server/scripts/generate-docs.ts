#!/usr/bin/env ts-node

import { APIDocumentationGenerator } from '../src/shared/documentation/api-documentation-generator';
import { OpenAPIGenerator } from '../src/shared/documentation/openapi-generator';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GenerateDocsOptions {
  outputDir?: string;
  formats?: ('json' | 'yaml' | 'html')[];
  includeExamples?: boolean;
  includeWebSocket?: boolean;
  verbose?: boolean;
}

async function generateDocumentation(
  options: GenerateDocsOptions = {}
): Promise<void> {
  const {
    outputDir = './docs/api',
    formats = ['json', 'yaml', 'html'],
    includeExamples = true,
    includeWebSocket = true,
    verbose = false,
  } = options;

  if (verbose) {
    console.log('🚀 Starting API documentation generation...');
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`📄 Formats: ${formats.join(', ')}`);
  }

  try {
    // Create documentation generator
    const docGenerator = new APIDocumentationGenerator({
      includeExamples,
      includeWebSocket,
      outputFormats: formats,
    });

    // Add all endpoint documentation
    if (verbose) console.log('📝 Adding task endpoints...');
    docGenerator.addTaskEndpoints();

    if (verbose) console.log('📝 Adding project endpoints...');
    docGenerator.addProjectEndpoints();

    // Add additional endpoints for comprehensive coverage
    await addAdditionalEndpoints(docGenerator, verbose);

    // Generate documentation
    if (verbose) console.log('🔨 Generating documentation files...');
    await docGenerator.generateDocumentation(outputDir);

    // Generate additional documentation files
    await generateAdditionalDocs(outputDir, docGenerator, verbose);

    console.log('✅ API documentation generated successfully!');
    console.log(`📂 Documentation available at: ${path.resolve(outputDir)}`);
  } catch (error) {
    console.error('❌ Failed to generate documentation:', error);
    process.exit(1);
  }
}

async function addAdditionalEndpoints(
  docGenerator: APIDocumentationGenerator,
  verbose: boolean
): Promise<void> {
  const generator = docGenerator.getGenerator();

  // Add workspace endpoints
  if (verbose) console.log('📝 Adding workspace endpoints...');
  generator.addEndpoint({
    path: '/api/v1/workspaces',
    method: 'get',
    summary: 'List workspaces',
    description: 'Retrieve workspaces accessible to the authenticated user',
    tags: ['Workspaces'],
    operationId: 'listWorkspaces',
    responses: {
      '200': {
        description: 'Workspaces retrieved successfully',
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
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          ownerId: { type: 'string', format: 'uuid' },
                          memberCount: { type: 'integer' },
                          projectCount: { type: 'integer' },
                          isActive: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' },
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
    },
  });

  // Add analytics endpoints
  if (verbose) console.log('📝 Adding analytics endpoints...');
  generator.addEndpoint({
    path: '/api/v1/analytics/dashboard',
    method: 'get',
    summary: 'Get dashboard analytics',
    description: 'Retrieve analytics data for the dashboard',
    tags: ['Analytics'],
    operationId: 'getDashboardAnalytics',
    parameters: [
      {
        name: 'period',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['day', 'week', 'month', 'quarter', 'year'],
          default: 'month',
        },
        description: 'Time period for analytics',
      },
      {
        name: 'workspaceId',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
        description: 'Workspace ID to filter analytics',
      },
    ],
    responses: {
      '200': {
        description: 'Analytics data retrieved successfully',
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
                        taskStats: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            completed: { type: 'integer' },
                            inProgress: { type: 'integer' },
                            overdue: { type: 'integer' },
                          },
                        },
                        projectStats: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            active: { type: 'integer' },
                            completed: { type: 'integer' },
                          },
                        },
                        userActivity: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              date: { type: 'string', format: 'date' },
                              tasksCompleted: { type: 'integer' },
                              hoursWorked: { type: 'number' },
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
    },
  });

  // Add notification endpoints
  if (verbose) console.log('📝 Adding notification endpoints...');
  generator.addEndpoint({
    path: '/api/v1/notifications',
    method: 'get',
    summary: 'List notifications',
    description: 'Retrieve notifications for the authenticated user',
    tags: ['Notifications'],
    operationId: 'listNotifications',
    parameters: [
      { $ref: '#/components/parameters/PageParam' },
      { $ref: '#/components/parameters/LimitParam' },
      {
        name: 'unreadOnly',
        in: 'query',
        schema: { type: 'boolean', default: false },
        description: 'Filter to show only unread notifications',
      },
    ],
    responses: {
      '200': {
        description: 'Notifications retrieved successfully',
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
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          type: { type: 'string' },
                          title: { type: 'string' },
                          message: { type: 'string' },
                          isRead: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' },
                          data: { type: 'object' },
                        },
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

  // Add file management endpoints
  if (verbose) console.log('📝 Adding file management endpoints...');
  generator.addEndpoint({
    path: '/api/v1/files/upload',
    method: 'post',
    summary: 'Upload file',
    description: 'Upload a file to the system',
    tags: ['Files'],
    operationId: 'uploadFile',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                format: 'binary',
                description: 'File to upload',
              },
              taskId: {
                type: 'string',
                format: 'uuid',
                description: 'Task ID to attach file to (optional)',
              },
              projectId: {
                type: 'string',
                format: 'uuid',
                description: 'Project ID to attach file to (optional)',
              },
            },
            required: ['file'],
          },
        },
      },
    },
    responses: {
      '201': {
        description: 'File uploaded successfully',
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
                        filename: { type: 'string' },
                        originalName: { type: 'string' },
                        mimeType: { type: 'string' },
                        size: { type: 'integer' },
                        url: { type: 'string', format: 'uri' },
                        uploadedAt: { type: 'string', format: 'date-time' },
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
      '413': {
        description: 'File too large',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  });
}

async function generateAdditionalDocs(
  outputDir: string,
  docGenerator: APIDocumentationGenerator,
  verbose: boolean
): Promise<void> {
  // Generate API changelog
  if (verbose) console.log('📝 Generating API changelog...');
  const changelog = `# API Changelog

## Version 1.0.0 (${new Date().toISOString().split('T')[0]})

### Added
- Initial API release
- Authentication and authorization endpoints
- Task management CRUD operations
- Project management endpoints
- Workspace management
- User management
- File upload and management
- Notification system
- Analytics and reporting
- Real-time WebSocket support
- Comprehensive error handling
- Rate limiting and security measures
- Multi-language support
- Audit logging

### Features
- RESTful API design
- OpenAPI 3.0 specification
- JWT-based authentication
- Role-based access control
- Pagination support
- Advanced filtering and sorting
- Bulk operations
- Real-time updates via WebSocket
- File attachments
- Comment system
- Activity tracking
- Dashboard analytics
- Notification preferences
- Multi-tenant workspace support

### Security
- JWT token authentication
- API key support for service-to-service communication
- Rate limiting per user and endpoint
- Input validation and sanitization
- CORS protection
- Security headers
- Audit logging for all operations

### Performance
- Database query optimization
- Response caching
- Pagination for large datasets
- Efficient bulk operations
- Connection pooling
- Background job processing

---

For support or questions, please contact: api-support@taskmanagement.com
`;

  await fs.writeFile(path.join(outputDir, 'CHANGELOG.md'), changelog, 'utf8');

  // Generate API testing guide
  if (verbose) console.log('📝 Generating API testing guide...');
  const testingGuide = `# API Testing Guide

This guide provides examples and best practices for testing the Task Management API.

## Authentication

First, obtain an access token by logging in:

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
\`\`\`

Use the returned access token in subsequent requests:

\`\`\`bash
export TOKEN="your_access_token_here"
\`\`\`

## Basic Operations

### Create a Task

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/tasks \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Test Task",
    "description": "This is a test task",
    "priority": "HIGH",
    "projectId": "project-uuid-here"
  }'
\`\`\`

### List Tasks

\`\`\`bash
curl -X GET "http://localhost:3000/api/v1/tasks?page=1&limit=10" \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

### Update a Task

\`\`\`bash
curl -X PUT http://localhost:3000/api/v1/tasks/task-uuid-here \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "IN_PROGRESS",
    "actualHours": 2
  }'
\`\`\`

### Delete a Task

\`\`\`bash
curl -X DELETE http://localhost:3000/api/v1/tasks/task-uuid-here \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## Advanced Operations

### Bulk Update Tasks

\`\`\`bash
curl -X PATCH http://localhost:3000/api/v1/tasks/bulk \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ids": ["task-uuid-1", "task-uuid-2"],
    "data": {
      "status": "DONE",
      "priority": "LOW"
    }
  }'
\`\`\`

### Upload File

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/files/upload \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@/path/to/your/file.pdf" \\
  -F "taskId=task-uuid-here"
\`\`\`

### Get Analytics

\`\`\`bash
curl -X GET "http://localhost:3000/api/v1/analytics/dashboard?period=month" \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## Testing with Postman

1. Import the OpenAPI specification (\`openapi.json\`) into Postman
2. Set up environment variables for base URL and token
3. Use the pre-request scripts to automatically refresh tokens
4. Create test collections for different scenarios

## Testing with Insomnia

1. Import the OpenAPI specification
2. Set up environment variables
3. Use plugins for authentication flows
4. Create test suites for regression testing

## Error Handling

The API returns consistent error responses:

\`\`\`json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      }
    ],
    "correlationId": "req_123456"
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
\`\`\`

## Rate Limiting

Monitor rate limit headers in responses:

- \`X-RateLimit-Limit\`: Request limit per window
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Reset time (Unix timestamp)

## WebSocket Testing

Connect to WebSocket for real-time updates:

\`\`\`javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
\`\`\`

## Best Practices

1. Always include proper error handling
2. Use appropriate HTTP methods
3. Include correlation IDs for debugging
4. Test edge cases and error scenarios
5. Validate response schemas
6. Test rate limiting behavior
7. Verify authentication and authorization
8. Test pagination with large datasets
9. Validate file upload limits and types
10. Test WebSocket connection handling

For more examples and advanced testing scenarios, see the test collection in the \`tests/\` directory.
`;

  await fs.writeFile(path.join(outputDir, 'TESTING.md'), testingGuide, 'utf8');

  if (verbose) console.log('✅ Additional documentation files generated');
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: GenerateDocsOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--formats':
      case '-f':
        options.formats = args[++i].split(',') as ('json' | 'yaml' | 'html')[];
        break;
      case '--no-examples':
        options.includeExamples = false;
        break;
      case '--no-websocket':
        options.includeWebSocket = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npm run generate:docs [options]

Options:
  -o, --output <dir>     Output directory (default: ./docs/api)
  -f, --formats <list>   Comma-separated list of formats: json,yaml,html (default: json,yaml,html)
  --no-examples          Exclude examples from documentation
  --no-websocket         Exclude WebSocket documentation
  -v, --verbose          Verbose output
  -h, --help             Show this help message

Examples:
  npm run generate:docs
  npm run generate:docs --output ./public/docs --formats json,html
  npm run generate:docs --verbose --no-examples
        `);
        process.exit(0);
        break;
    }
  }

  await generateDocumentation(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { generateDocumentation };
