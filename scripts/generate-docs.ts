#!/usr/bin/env tsx

/**
 * API Documentation Generator
 * Generates comprehensive API documentation from the implemented system
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  authentication?: boolean;
  authorization?: string[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  location: 'path' | 'query' | 'header';
}

interface RequestBody {
  contentType: string;
  schema: any;
  example: any;
}

interface Response {
  statusCode: number;
  description: string;
  schema?: any;
  example?: any;
}

class APIDocumentationGenerator {
  private projectRoot: string;
  private endpoints: APIEndpoint[] = [];

  constructor() {
    this.projectRoot = join(__dirname, '..');
    this.initializeEndpoints();
  }

  private initializeEndpoints(): void {
    // Authentication endpoints
    this.endpoints.push({
      method: 'POST',
      path: '/api/auth/register',
      description: 'Register a new user account',
      requestBody: {
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2 },
          },
        },
        example: {
          email: 'user@example.com',
          password: 'SecurePassword123!',
          name: 'John Doe',
        },
      },
      responses: [
        {
          statusCode: 201,
          description: 'User registered successfully',
          example: {
            id: 'user_123',
            email: 'user@example.com',
            name: 'John Doe',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          statusCode: 400,
          description: 'Validation error',
          example: {
            error: 'ValidationError',
            message: 'Invalid input data',
            details: [{ field: 'email', message: 'Invalid email format' }],
          },
        },
      ],
      authentication: false,
    });

    this.endpoints.push({
      method: 'POST',
      path: '/api/auth/login',
      description: 'Authenticate user and receive access tokens',
      requestBody: {
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        example: {
          email: 'user@example.com',
          password: 'SecurePassword123!',
        },
      },
      responses: [
        {
          statusCode: 200,
          description: 'Login successful',
          example: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: 900,
            user: {
              id: 'user_123',
              email: 'user@example.com',
              name: 'John Doe',
            },
          },
        },
        {
          statusCode: 401,
          description: 'Invalid credentials',
          example: {
            error: 'AuthenticationError',
            message: 'Invalid email or password',
          },
        },
      ],
      authentication: false,
    });

    // Task endpoints
    this.endpoints.push({
      method: 'GET',
      path: '/api/tasks',
      description: 'Retrieve tasks with optional filtering and pagination',
      parameters: [
        {
          name: 'projectId',
          type: 'string',
          required: false,
          description: 'Filter tasks by project ID',
          location: 'query',
        },
        {
          name: 'status',
          type: 'string',
          required: false,
          description:
            'Filter tasks by status (TODO, IN_PROGRESS, COMPLETED, etc.)',
          location: 'query',
        },
        {
          name: 'assigneeId',
          type: 'string',
          required: false,
          description: 'Filter tasks by assignee ID',
          location: 'query',
        },
        {
          name: 'page',
          type: 'number',
          required: false,
          description: 'Page number for pagination (default: 1)',
          location: 'query',
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Number of items per page (default: 20, max: 100)',
          location: 'query',
        },
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Tasks retrieved successfully',
          example: {
            data: [
              {
                id: 'task_123',
                title: 'Implement user authentication',
                description: 'Add JWT-based authentication system',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
                assigneeId: 'user_456',
                projectId: 'project_789',
                dueDate: '2024-02-01T00:00:00Z',
                createdAt: '2024-01-15T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
      ],
      authentication: true,
      authorization: ['read:tasks'],
    });

    this.endpoints.push({
      method: 'POST',
      path: '/api/tasks',
      description: 'Create a new task',
      requestBody: {
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['title', 'projectId'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000 },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            },
            assigneeId: { type: 'string' },
            projectId: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
            estimatedHours: { type: 'number', minimum: 0 },
          },
        },
        example: {
          title: 'Implement user authentication',
          description:
            'Add JWT-based authentication system with proper security measures',
          priority: 'HIGH',
          assigneeId: 'user_456',
          projectId: 'project_789',
          dueDate: '2024-02-01T00:00:00Z',
          estimatedHours: 8,
        },
      },
      responses: [
        {
          statusCode: 201,
          description: 'Task created successfully',
          example: {
            id: 'task_123',
            title: 'Implement user authentication',
            description:
              'Add JWT-based authentication system with proper security measures',
            status: 'TODO',
            priority: 'HIGH',
            assigneeId: 'user_456',
            projectId: 'project_789',
            createdById: 'user_789',
            dueDate: '2024-02-01T00:00:00Z',
            estimatedHours: 8,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      ],
      authentication: true,
      authorization: ['create:tasks'],
    });

    // Add more endpoints for projects, workspaces, etc.
    this.addProjectEndpoints();
    this.addWorkspaceEndpoints();
    this.addHealthEndpoints();
  }

  private addProjectEndpoints(): void {
    this.endpoints.push({
      method: 'GET',
      path: '/api/projects',
      description: 'Retrieve projects accessible to the authenticated user',
      parameters: [
        {
          name: 'workspaceId',
          type: 'string',
          required: false,
          description: 'Filter projects by workspace ID',
          location: 'query',
        },
        {
          name: 'status',
          type: 'string',
          required: false,
          description: 'Filter projects by status',
          location: 'query',
        },
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Projects retrieved successfully',
          example: {
            data: [
              {
                id: 'project_123',
                name: 'Task Management System',
                description: 'A comprehensive task management platform',
                status: 'ACTIVE',
                workspaceId: 'workspace_456',
                managerId: 'user_789',
                memberCount: 5,
                taskCount: 23,
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        },
      ],
      authentication: true,
      authorization: ['read:projects'],
    });

    this.endpoints.push({
      method: 'POST',
      path: '/api/projects',
      description: 'Create a new project',
      requestBody: {
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['name', 'workspaceId'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000 },
            workspaceId: { type: 'string' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
        example: {
          name: 'Task Management System',
          description: 'A comprehensive task management platform',
          workspaceId: 'workspace_456',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-06-01T00:00:00Z',
        },
      },
      responses: [
        {
          statusCode: 201,
          description: 'Project created successfully',
        },
      ],
      authentication: true,
      authorization: ['create:projects'],
    });
  }

  private addWorkspaceEndpoints(): void {
    this.endpoints.push({
      method: 'GET',
      path: '/api/workspaces',
      description: 'Retrieve workspaces accessible to the authenticated user',
      responses: [
        {
          statusCode: 200,
          description: 'Workspaces retrieved successfully',
          example: {
            data: [
              {
                id: 'workspace_123',
                name: 'Acme Corporation',
                description: 'Main workspace for Acme Corp projects',
                ownerId: 'user_456',
                memberCount: 15,
                projectCount: 8,
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        },
      ],
      authentication: true,
      authorization: ['read:workspaces'],
    });
  }

  private addHealthEndpoints(): void {
    this.endpoints.push({
      method: 'GET',
      path: '/health',
      description: 'Basic health check endpoint',
      responses: [
        {
          statusCode: 200,
          description: 'Service is healthy',
          example: {
            status: 'healthy',
            timestamp: '2024-01-15T12:00:00Z',
            uptime: 3600,
            version: '1.0.0',
          },
        },
      ],
      authentication: false,
    });

    this.endpoints.push({
      method: 'GET',
      path: '/health/database',
      description: 'Database connectivity health check',
      responses: [
        {
          statusCode: 200,
          description: 'Database is healthy',
          example: {
            status: 'healthy',
            database: 'connected',
            responseTime: 15,
          },
        },
      ],
      authentication: false,
    });
  }

  generateMarkdownDocumentation(): string {
    let markdown = `# Task Management System API Documentation

## Overview

This document provides comprehensive documentation for the Task Management System REST API. The API follows RESTful principles and uses JSON for data exchange.

## Base URL

\`\`\`
Production: https://api.taskmanagement.com
Staging: https://staging-api.taskmanagement.com
Development: http://localhost:3000
\`\`\`

## Authentication

The API uses JWT (JSON Web Token) based authentication. Include the access token in the Authorization header:

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Rate Limiting

API requests are rate limited to prevent abuse:
- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
- \`X-RateLimit-Limit\`: Request limit per window
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Time when the rate limit resets

## Error Handling

The API uses standard HTTP status codes and returns error details in JSON format:

\`\`\`json
{
  "error": "ValidationError",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-01-15T12:00:00Z",
  "requestId": "req_123456"
}
\`\`\`

### Common Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## Pagination

List endpoints support pagination using query parameters:

- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 20, max: 100)

Paginated responses include metadata:

\`\`\`json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
\`\`\`

## Endpoints

`;

    // Group endpoints by category
    const categories = this.groupEndpointsByCategory();

    for (const [category, endpoints] of Object.entries(categories)) {
      markdown += `### ${category}\n\n`;

      for (const endpoint of endpoints) {
        markdown += this.generateEndpointDocumentation(endpoint);
      }
    }

    markdown += `
## WebSocket API

The system supports real-time updates via WebSocket connections.

### Connection

\`\`\`javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};
\`\`\`

### Events

#### Task Updates
\`\`\`json
{
  "type": "task_updated",
  "data": {
    "taskId": "task_123",
    "changes": {
      "status": "COMPLETED"
    },
    "updatedBy": "user_456",
    "timestamp": "2024-01-15T12:00:00Z"
  }
}
\`\`\`

#### User Presence
\`\`\`json
{
  "type": "user_presence",
  "data": {
    "userId": "user_123",
    "status": "online",
    "lastSeen": "2024-01-15T12:00:00Z"
  }
}
\`\`\`

## SDK Examples

### JavaScript/TypeScript

\`\`\`typescript
import { TaskManagementAPI } from '@taskmanagement/sdk';

const api = new TaskManagementAPI({
  baseUrl: 'https://api.taskmanagement.com',
  apiKey: 'your_api_key'
});

// Create a task
const task = await api.tasks.create({
  title: 'New Task',
  description: 'Task description',
  projectId: 'project_123',
  priority: 'HIGH'
});

// Get tasks with filtering
const tasks = await api.tasks.list({
  projectId: 'project_123',
  status: 'IN_PROGRESS',
  page: 1,
  limit: 20
});
\`\`\`

### cURL Examples

\`\`\`bash
# Login
curl -X POST https://api.taskmanagement.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password"}'

# Create a task
curl -X POST https://api.taskmanagement.com/api/tasks \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "New Task",
    "description": "Task description",
    "projectId": "project_123",
    "priority": "HIGH"
  }'

# Get tasks
curl -X GET "https://api.taskmanagement.com/api/tasks?projectId=project_123&status=IN_PROGRESS" \\
  -H "Authorization: Bearer <token>"
\`\`\`

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial API release
- Authentication and authorization
- Task management endpoints
- Project management endpoints
- Workspace management endpoints
- Real-time WebSocket support
- Comprehensive error handling
- Rate limiting and security measures

---

For support or questions, please contact: api-support@taskmanagement.com
`;

    return markdown;
  }

  private groupEndpointsByCategory(): Record<string, APIEndpoint[]> {
    const categories: Record<string, APIEndpoint[]> = {};

    for (const endpoint of this.endpoints) {
      const category = this.getCategoryFromPath(endpoint.path);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(endpoint);
    }

    return categories;
  }

  private getCategoryFromPath(path: string): string {
    if (path.includes('/auth')) return 'Authentication';
    if (path.includes('/tasks')) return 'Tasks';
    if (path.includes('/projects')) return 'Projects';
    if (path.includes('/workspaces')) return 'Workspaces';
    if (path.includes('/users')) return 'Users';
    if (path.includes('/health')) return 'Health Checks';
    return 'Other';
  }

  private generateEndpointDocumentation(endpoint: APIEndpoint): string {
    let doc = `#### ${endpoint.method} ${endpoint.path}\n\n`;
    doc += `${endpoint.description}\n\n`;

    if (endpoint.authentication) {
      doc += `**Authentication Required**: Yes\n\n`;
      if (endpoint.authorization) {
        doc += `**Required Permissions**: ${endpoint.authorization.join(', ')}\n\n`;
      }
    } else {
      doc += `**Authentication Required**: No\n\n`;
    }

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      doc += `**Parameters**:\n\n`;
      doc += `| Name | Type | Required | Location | Description |\n`;
      doc += `|------|------|----------|----------|-------------|\n`;

      for (const param of endpoint.parameters) {
        doc += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.location} | ${param.description} |\n`;
      }
      doc += `\n`;
    }

    if (endpoint.requestBody) {
      doc += `**Request Body** (${endpoint.requestBody.contentType}):\n\n`;
      doc += `\`\`\`json\n${JSON.stringify(endpoint.requestBody.example, null, 2)}\n\`\`\`\n\n`;
    }

    doc += `**Responses**:\n\n`;
    for (const response of endpoint.responses) {
      doc += `**${response.statusCode}** - ${response.description}\n\n`;
      if (response.example) {
        doc += `\`\`\`json\n${JSON.stringify(response.example, null, 2)}\n\`\`\`\n\n`;
      }
    }

    doc += `---\n\n`;
    return doc;
  }

  async generateDocumentation(): Promise<void> {
    const docsDir = join(this.projectRoot, 'docs');

    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    const markdown = this.generateMarkdownDocumentation();
    const outputPath = join(docsDir, 'api-documentation.md');

    writeFileSync(outputPath, markdown, 'utf8');

    console.log(`✅ API documentation generated: ${outputPath}`);
    console.log(`📄 Documentation contains ${this.endpoints.length} endpoints`);
  }
}

// Main execution
async function main() {
  const generator = new APIDocumentationGenerator();
  await generator.generateDocumentation();
}

main().catch(error => {
  console.error(`Documentation generation failed: ${error.message}`);
  process.exit(1);
});
