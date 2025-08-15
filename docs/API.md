# API Documentation

## Overview

This document describes the API endpoints and communication patterns for the task management platform. The API is built using tRPC for type-safe communication between the client and server.

## Base Configuration

### tRPC Setup

```typescript
// Server-side router setup
import { initTRPC } from '@trpc/server';
import { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);
```

### Client Configuration

```typescript
// Client-side tRPC setup
import { createTRPCNext } from '@trpc/next';
import { httpBatchLink } from '@trpc/client';

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers: () => ({
            authorization: `Bearer ${getToken()}`,
          }),
        }),
      ],
    };
  },
});
```

## Authentication API

### Auth Router

```typescript
export const authRouter = router({
  // Register new user
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Login user
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Logout user
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Implementation details
    }),

  // Get current user
  me: protectedProcedure
    .query(async ({ ctx }) => {
      // Implementation details
    }),

  // Refresh token
  refresh: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),
});
```

### Schemas

```typescript
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

### Usage Examples

```typescript
// Register user
const { mutate: register } = trpc.auth.register.useMutation({
  onSuccess: (data) => {
    console.log('User registered:', data);
  },
});

// Login user
const { mutate: login } = trpc.auth.login.useMutation({
  onSuccess: (data) => {
    setToken(data.token);
    router.push('/dashboard');
  },
});

// Get current user
const { data: user } = trpc.auth.me.useQuery();
```

## Tasks API

### Task Router

```typescript
export const tasksRouter = router({
  // Create new task
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Get task by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // List tasks with filters
  list: protectedProcedure
    .input(taskFilterSchema)
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Update task
  update: protectedProcedure
    .input(updateTaskSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Delete task
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Get tasks by project
  getByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Update task status
  updateStatus: protectedProcedure
    .input(updateTaskStatusSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Assign task to user
  assign: protectedProcedure
    .input(assignTaskSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),
});
```

### Schemas

```typescript
export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.date().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.date().optional(),
  tags: z.array(z.string()).optional(),
});

export const taskFilterSchema = z.object({
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});
```

### Usage Examples

```typescript
// Create task
const { mutate: createTask } = trpc.tasks.create.useMutation({
  onSuccess: () => {
    // Invalidate and refetch tasks
    trpc.tasks.list.invalidate();
  },
});

// List tasks with filters
const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
  status: 'todo',
  projectId: 'project-id',
  limit: 10,
});

// Update task
const { mutate: updateTask } = trpc.tasks.update.useMutation({
  onSuccess: () => {
    trpc.tasks.getById.invalidate({ id: taskId });
  },
});
```

## Projects API

### Project Router

```typescript
export const projectsRouter = router({
  // Create new project
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Get project by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // List user's projects
  list: protectedProcedure
    .input(projectFilterSchema)
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Update project
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Delete project
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Add member to project
  addMember: protectedProcedure
    .input(addProjectMemberSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Remove member from project
  removeMember: protectedProcedure
    .input(removeProjectMemberSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Get project statistics
  getStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),
});
```

### Schemas

```typescript
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isPublic: z.boolean().default(false),
});

export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isPublic: z.boolean().optional(),
});

export const projectFilterSchema = z.object({
  search: z.string().optional(),
  isPublic: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});
```

## Users API

### User Router

```typescript
export const usersRouter = router({
  // Get user profile
  getProfile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Search users
  search: protectedProcedure
    .input(searchUsersSchema)
    .query(async ({ input, ctx }) => {
      // Implementation details
    }),

  // Get user statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      // Implementation details
    }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(updatePreferencesSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation details
    }),
});
```

## Real-time Events

### WebSocket Events

```typescript
// Server-side event types
export interface ServerToClientEvents {
  'task:created': (data: { task: Task; projectId: string }) => void;
  'task:updated': (data: { taskId: string; updates: Partial<Task> }) => void;
  'task:deleted': (data: { taskId: string; projectId: string }) => void;
  'project:updated': (data: { projectId: string; updates: Partial<Project> }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
}

// Client-side event types
export interface ClientToServerEvents {
  'join:project': (data: { projectId: string }) => void;
  'leave:project': (data: { projectId: string }) => void;
  'typing:start': (data: { taskId: string }) => void;
  'typing:stop': (data: { taskId: string }) => void;
}
```

### Event Usage

```typescript
// Server-side event emission
await websocketService.broadcast('task:updated', {
  taskId: task.id,
  updates: { status: 'completed' },
});

// Client-side event handling
useEffect(() => {
  socket.on('task:updated', (data) => {
    queryClient.setQueryData(
      ['tasks', data.taskId],
      (oldData: Task) => ({ ...oldData, ...data.updates })
    );
  });

  return () => {
    socket.off('task:updated');
  };
}, [socket, queryClient]);
```

## Error Handling

### Error Types

```typescript
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### Error Responses

```typescript
// Standard error response format
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Example error responses
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    }
  }
}
```

## Rate Limiting

### Rate Limit Configuration

```typescript
// Rate limiting middleware
const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

// Apply to specific routes
export const publicProcedure = t.procedure.use(rateLimitMiddleware);
```

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Pagination

### Pagination Schema

```typescript
export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

### Usage Example

```typescript
const { data, fetchNextPage, hasNextPage } = trpc.tasks.list.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasMore 
        ? lastPage.pagination.offset + lastPage.pagination.limit 
        : undefined,
  }
);
```

## API Versioning

### Version Strategy

- **URL Versioning**: `/api/v1/trpc`
- **Header Versioning**: `API-Version: v1`
- **Backward Compatibility**: Maintain support for previous versions

### Migration Guide

When updating API versions:

1. **Deprecation Notice**: Mark old endpoints as deprecated
2. **Migration Period**: Support both versions simultaneously
3. **Documentation**: Provide clear migration instructions
4. **Client Updates**: Update client code to use new version

This API documentation provides a comprehensive guide for integrating with the task management platform's backend services.