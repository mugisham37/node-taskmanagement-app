#!/usr/bin/env node

/**
 * API Documentation Generator
 * Automatically generates API documentation from tRPC routers and schemas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ApiDocGenerator {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.outputDir = path.join(this.rootDir, 'docs', 'api');
    this.serverDir = path.join(this.rootDir, 'apps', 'server');
  }

  async generate() {
    console.log('📚 Generating API documentation...\n');

    this.ensureOutputDir();
    await this.generateTrpcDocs();
    await this.generateSchemasDocs();
    await this.generateWebSocketDocs();
    await this.generateErrorDocs();
    this.generateIndex();

    console.log('✅ API documentation generated successfully!');
    console.log(`📁 Documentation available at: ${this.outputDir}`);
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateTrpcDocs() {
    console.log('🔧 Generating tRPC router documentation...');

    const routersDir = path.join(this.serverDir, 'src', 'api');
    if (!fs.existsSync(routersDir)) {
      console.warn('⚠️  tRPC routers directory not found');
      return;
    }

    const routerFiles = fs.readdirSync(routersDir)
      .filter(file => file.endsWith('.ts') && !file.includes('.test.'));

    let trpcDocsContent = `# tRPC API Documentation

This document describes all available tRPC procedures and their usage.

## Overview

The API uses tRPC for type-safe communication between client and server. All procedures are organized into routers based on functionality.

## Authentication

Most procedures require authentication. Use the \`protectedProcedure\` for authenticated endpoints.

\`\`\`typescript
// Client authentication
const token = getAuthToken();
const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers: () => ({
            authorization: \`Bearer \${token}\`,
          }),
        }),
      ],
    };
  },
});
\`\`\`

## Routers

`;

    for (const routerFile of routerFiles) {
      const routerName = path.basename(routerFile, '.ts');
      const routerPath = path.join(routersDir, routerFile);
      
      try {
        const routerContent = fs.readFileSync(routerPath, 'utf8');
        const procedures = this.extractProcedures(routerContent);
        
        trpcDocsContent += `### ${this.capitalize(routerName)} Router

`;

        if (procedures.length > 0) {
          procedures.forEach(procedure => {
            trpcDocsContent += `#### \`${routerName}.${procedure.name}\`

- **Type**: ${procedure.type}
- **Description**: ${procedure.description || 'No description available'}

\`\`\`typescript
// Usage example
${this.generateUsageExample(routerName, procedure)}
\`\`\`

`;
          });
        } else {
          trpcDocsContent += `No procedures found in this router.

`;
        }
      } catch (error) {
        console.warn(`⚠️  Could not parse router: ${routerFile}`);
      }
    }

    fs.writeFileSync(path.join(this.outputDir, 'trpc.md'), trpcDocsContent);
    console.log('✅ tRPC documentation generated');
  }

  extractProcedures(content) {
    const procedures = [];
    
    // Simple regex to extract procedure definitions
    const procedureRegex = /(\w+):\s*(publicProcedure|protectedProcedure)\s*(?:\.input\([^)]+\))?\s*\.(query|mutation)/g;
    let match;

    while ((match = procedureRegex.exec(content)) !== null) {
      procedures.push({
        name: match[1],
        protection: match[2],
        type: match[3],
        description: this.extractDescription(content, match.index)
      });
    }

    return procedures;
  }

  extractDescription(content, index) {
    // Look for comments above the procedure
    const lines = content.substring(0, index).split('\n');
    const lastLines = lines.slice(-5);
    
    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i].trim();
      if (line.startsWith('//') || line.startsWith('*')) {
        return line.replace(/^\/\/\s*|\*\s*/, '');
      }
    }
    
    return null;
  }

  generateUsageExample(routerName, procedure) {
    if (procedure.type === 'query') {
      return `const { data, isLoading } = trpc.${routerName}.${procedure.name}.useQuery();`;
    } else {
      return `const { mutate } = trpc.${routerName}.${procedure.name}.useMutation();`;
    }
  }

  async generateSchemasDocs() {
    console.log('📋 Generating schemas documentation...');

    const sharedDir = path.join(this.rootDir, 'packages', 'shared', 'src', 'schemas');
    if (!fs.existsSync(sharedDir)) {
      console.warn('⚠️  Schemas directory not found');
      return;
    }

    const schemaFiles = fs.readdirSync(sharedDir)
      .filter(file => file.endsWith('.ts') && !file.includes('.test.'));

    let schemasContent = `# Validation Schemas

This document describes all Zod validation schemas used throughout the application.

## Overview

All input validation is handled using Zod schemas. These schemas ensure type safety and data validation across the entire stack.

## Schemas

`;

    for (const schemaFile of schemaFiles) {
      const schemaName = path.basename(schemaFile, '.ts').replace('.schemas', '');
      const schemaPath = path.join(sharedDir, schemaFile);
      
      try {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const schemas = this.extractSchemas(schemaContent);
        
        schemasContent += `### ${this.capitalize(schemaName)} Schemas

`;

        schemas.forEach(schema => {
          schemasContent += `#### \`${schema.name}\`

\`\`\`typescript
${schema.definition}
\`\`\`

`;
        });
      } catch (error) {
        console.warn(`⚠️  Could not parse schema: ${schemaFile}`);
      }
    }

    fs.writeFileSync(path.join(this.outputDir, 'schemas.md'), schemasContent);
    console.log('✅ Schemas documentation generated');
  }

  extractSchemas(content) {
    const schemas = [];
    
    // Extract schema exports
    const exportRegex = /export const (\w+Schema) = z\.([\s\S]*?)(?=export|$)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      schemas.push({
        name: match[1],
        definition: `export const ${match[1]} = z.${match[2].trim()}`
      });
    }

    return schemas;
  }

  async generateWebSocketDocs() {
    console.log('🔌 Generating WebSocket documentation...');

    const wsContent = `# WebSocket API Documentation

This document describes the real-time WebSocket API for live updates and collaboration features.

## Connection

Connect to the WebSocket server at \`ws://localhost:3001/ws\` (development) or your production WebSocket URL.

\`\`\`typescript
const socket = new WebSocket('ws://localhost:3001/ws');

socket.onopen = () => {
  console.log('Connected to WebSocket server');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleWebSocketMessage(data);
};
\`\`\`

## Authentication

WebSocket connections require authentication via JWT token:

\`\`\`typescript
const socket = new WebSocket('ws://localhost:3001/ws', [], {
  headers: {
    Authorization: \`Bearer \${token}\`
  }
});
\`\`\`

## Event Types

### Server to Client Events

#### \`task:created\`
Emitted when a new task is created.

\`\`\`typescript
{
  type: 'task:created',
  data: {
    task: Task,
    projectId: string
  }
}
\`\`\`

#### \`task:updated\`
Emitted when a task is updated.

\`\`\`typescript
{
  type: 'task:updated',
  data: {
    taskId: string,
    updates: Partial<Task>,
    projectId: string
  }
}
\`\`\`

#### \`task:deleted\`
Emitted when a task is deleted.

\`\`\`typescript
{
  type: 'task:deleted',
  data: {
    taskId: string,
    projectId: string
  }
}
\`\`\`

#### \`project:updated\`
Emitted when a project is updated.

\`\`\`typescript
{
  type: 'project:updated',
  data: {
    projectId: string,
    updates: Partial<Project>
  }
}
\`\`\`

#### \`user:online\` / \`user:offline\`
Emitted when users come online or go offline.

\`\`\`typescript
{
  type: 'user:online' | 'user:offline',
  data: {
    userId: string,
    timestamp: string
  }
}
\`\`\`

### Client to Server Events

#### \`join:project\`
Join a project room for real-time updates.

\`\`\`typescript
socket.send(JSON.stringify({
  type: 'join:project',
  data: { projectId: 'project-id' }
}));
\`\`\`

#### \`leave:project\`
Leave a project room.

\`\`\`typescript
socket.send(JSON.stringify({
  type: 'leave:project',
  data: { projectId: 'project-id' }
}));
\`\`\`

#### \`typing:start\` / \`typing:stop\`
Indicate typing status for collaborative editing.

\`\`\`typescript
socket.send(JSON.stringify({
  type: 'typing:start',
  data: { taskId: 'task-id' }
}));
\`\`\`

## Error Handling

Handle WebSocket errors gracefully:

\`\`\`typescript
socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

socket.onclose = (event) => {
  if (event.code !== 1000) {
    // Unexpected close, attempt to reconnect
    setTimeout(() => {
      connectWebSocket();
    }, 1000);
  }
};
\`\`\`

## Rate Limiting

WebSocket connections are rate-limited to prevent abuse:

- Maximum 100 messages per minute per connection
- Maximum 10 connections per IP address
- Automatic disconnection for violations

## Best Practices

1. **Reconnection Logic**: Implement exponential backoff for reconnections
2. **Message Queuing**: Queue messages when disconnected
3. **Heartbeat**: Send periodic ping messages to keep connection alive
4. **Error Handling**: Handle all error scenarios gracefully
5. **Resource Cleanup**: Always close connections when no longer needed
`;

    fs.writeFileSync(path.join(this.outputDir, 'websocket.md'), wsContent);
    console.log('✅ WebSocket documentation generated');
  }

  async generateErrorDocs() {
    console.log('❌ Generating error documentation...');

    const errorContent = `# Error Handling Documentation

This document describes the error handling patterns and error codes used throughout the application.

## Error Types

### Application Errors

All application errors extend the base \`AppError\` class:

\`\`\`typescript
abstract class AppError extends Error {
  abstract statusCode: number;
  abstract code: string;
}
\`\`\`

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| \`VALIDATION_ERROR\` | 400 | Input validation failed |
| \`UNAUTHORIZED\` | 401 | Authentication required |
| \`FORBIDDEN\` | 403 | Insufficient permissions |
| \`NOT_FOUND\` | 404 | Resource not found |
| \`CONFLICT\` | 409 | Resource conflict |
| \`RATE_LIMITED\` | 429 | Too many requests |
| \`INTERNAL_ERROR\` | 500 | Internal server error |

### Error Response Format

All API errors follow a consistent format:

\`\`\`typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
  }
}
\`\`\`

### Example Error Responses

#### Validation Error
\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/trpc/auth.register"
  }
}
\`\`\`

#### Authentication Error
\`\`\`json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication token required",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/trpc/tasks.create"
  }
}
\`\`\`

#### Not Found Error
\`\`\`json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found",
    "details": {
      "taskId": "task-123"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/trpc/tasks.getById"
  }
}
\`\`\`

## Client-Side Error Handling

### tRPC Error Handling

\`\`\`typescript
const { mutate: createTask } = trpc.tasks.create.useMutation({
  onError: (error) => {
    if (error.data?.code === 'VALIDATION_ERROR') {
      // Handle validation errors
      setFormErrors(error.data.details);
    } else if (error.data?.code === 'UNAUTHORIZED') {
      // Redirect to login
      router.push('/login');
    } else {
      // Show generic error message
      toast.error('An unexpected error occurred');
    }
  }
});
\`\`\`

### Global Error Handling

\`\`\`typescript
// Error boundary for React components
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    errorReportingService.report(error, errorInfo);
    
    // Show user-friendly error message
    this.setState({ hasError: true });
  }
}

// Global error handler for unhandled promises
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  errorReportingService.report(event.reason);
});
\`\`\`

## Server-Side Error Handling

### tRPC Error Handling

\`\`\`typescript
import { TRPCError } from '@trpc/server';

export const taskRouter = router({
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await ctx.taskService.createTask(input);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error
          });
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create task'
        });
      }
    })
});
\`\`\`

### Global Error Handler

\`\`\`typescript
// Express error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  } else {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
});
\`\`\`

## Best Practices

1. **Consistent Error Format**: Always use the standard error response format
2. **Meaningful Messages**: Provide clear, actionable error messages
3. **Error Logging**: Log all errors with sufficient context
4. **User Experience**: Show user-friendly error messages
5. **Security**: Don't expose sensitive information in error messages
6. **Monitoring**: Track error rates and patterns
7. **Recovery**: Provide ways for users to recover from errors
`;

    fs.writeFileSync(path.join(this.outputDir, 'errors.md'), errorContent);
    console.log('✅ Error documentation generated');
  }

  generateIndex() {
    console.log('📑 Generating API documentation index...');

    const indexContent = `# API Documentation Index

Welcome to the API documentation for the Task Management Platform.

## Documentation Sections

- **[tRPC API](./trpc.md)** - Complete tRPC router and procedure documentation
- **[Validation Schemas](./schemas.md)** - Zod validation schemas for all data types
- **[WebSocket API](./websocket.md)** - Real-time WebSocket event documentation
- **[Error Handling](./errors.md)** - Error codes and handling patterns

## Quick Links

### Authentication
- [Login/Register](./trpc.md#auth-router)
- [JWT Token Management](./trpc.md#auth-router)
- [User Profile](./trpc.md#users-router)

### Core Features
- [Task Management](./trpc.md#tasks-router)
- [Project Management](./trpc.md#projects-router)
- [User Management](./trpc.md#users-router)

### Real-time Features
- [WebSocket Connection](./websocket.md#connection)
- [Live Updates](./websocket.md#event-types)
- [Collaboration](./websocket.md#client-to-server-events)

### Development
- [Error Handling](./errors.md)
- [Validation](./schemas.md)
- [Testing](../DEVELOPMENT.md#testing-strategy)

## Getting Started

1. **Authentication**: Start with the auth router to understand login/registration
2. **Core APIs**: Explore task and project management endpoints
3. **Real-time**: Implement WebSocket connections for live updates
4. **Error Handling**: Implement proper error handling patterns

## API Base URL

- **Development**: \`http://localhost:3001/api/trpc\`
- **Production**: \`https://your-domain.com/api/trpc\`

## Support

For questions or issues with the API:

1. Check the relevant documentation section
2. Review the [Development Guide](../DEVELOPMENT.md)
3. Check the project's issue tracker
4. Contact the development team

---

*This documentation is automatically generated. Last updated: ${new Date().toISOString()}*
`;

    fs.writeFileSync(path.join(this.outputDir, 'README.md'), indexContent);
    console.log('✅ API documentation index generated');
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// CLI interface
if (require.main === module) {
  const generator = new ApiDocGenerator();
  generator.generate().catch(error => {
    console.error('❌ Failed to generate API documentation:', error);
    process.exit(1);
  });
}

module.exports = ApiDocGenerator;