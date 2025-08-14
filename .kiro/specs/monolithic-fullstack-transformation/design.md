# Monolithic Full-Stack Architecture Transformation - Design Document

## Overview

This design document outlines the transformation of the current project structure into a unified monolithic full-stack architecture that seamlessly integrates the sophisticated Node.js backend with a modern Next.js frontend. The architecture prioritizes high-performance communication, shared resources, unified development experience, and enterprise-level scalability while preserving all existing backend capabilities.

## Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Monorepo Root"
        subgraph "Apps"
            Client[Next.js Client App]
            Server[Node.js Server App]
        end

        subgraph "Packages"
            Shared[Shared Package]
            Database[Database Package]
            UI[UI Components Package]
            Config[Config Package]
        end

        subgraph "Tools"
            ESLint[ESLint Config]
            TypeScript[TypeScript Config]
            Scripts[Build Scripts]
        end
    end

    Client --> Shared
    Server --> Shared
    Client --> Database
    Server --> Database
    Client --> UI
    Client --> Config
    Server --> Config

    Client -.->|tRPC| Server
    Client -.->|WebSocket| Server
    Server --> Redis[(Redis Cache)]
    Server --> PostgreSQL[(PostgreSQL)]
```

### Project Structure

```
taskmanagement-fullstack/
├── package.json                          # Root workspace configuration
├── turbo.json                           # Turborepo build orchestration
├── tsconfig.json                        # Root TypeScript configuration
├── .env.example                         # Environment template
├── docker-compose.yml                   # Full-stack deployment
├── README.md                           # Project documentation
│
├── apps/                               # Applications
│   ├── client/                         # Next.js Frontend
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── app/                    # App Router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── globals.css
│   │   │   │   ├── (auth)/
│   │   │   │   ├── dashboard/
│   │   │   │   └── api/trpc/[trpc]/route.ts
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── forms/
│   │   │   │   ├── layout/
│   │   │   │   ├── features/
│   │   │   │   └── providers/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   ├── trpc.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── websocket.ts
│   │   │   ├── store/
│   │   │   └── types/
│   │   └── __tests__/
│   │
│   └── server/                         # Existing Node.js Backend (Enhanced)
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── app.ts
│       │   ├── trpc/                   # New tRPC integration
│       │   │   ├── router.ts
│       │   │   ├── context.ts
│       │   │   └── routers/
│       │   ├── api/                    # tRPC routers
│       │   │   ├── auth.ts
│       │   │   ├── tasks.ts
│       │   │   ├── projects.ts
│       │   │   └── users.ts
│       │   ├── application/            # Existing application layer
│       │   ├── domain/                 # Existing domain layer
│       │   ├── infrastructure/         # Existing infrastructure layer
│       │   └── presentation/           # Enhanced presentation layer
│       └── __tests__/
│
├── packages/                           # Shared Packages
│   ├── shared/                         # Core shared logic
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── api.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   └── index.ts
│   │   │   ├── schemas/                # Zod validation schemas
│   │   │   │   ├── auth.schemas.ts
│   │   │   │   ├── task.schemas.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   ├── utils/
│   │   │   ├── errors/
│   │   │   └── config/
│   │   └── __tests__/
│   │
│   ├── database/                       # Database package
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── schema/
│   │   │   ├── migrations/
│   │   │   ├── seeds/
│   │   │   └── queries/
│   │   └── scripts/
│   │
│   ├── ui/                             # Shared UI components
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── utils/
│   │   │   └── styles/
│   │   └── storybook/
│   │
│   └── config/                         # Shared configuration
│       ├── package.json
│       └── src/
│           ├── database.config.ts
│           ├── auth.config.ts
│           └── app.config.ts
│
├── tools/                              # Development tools
│   ├── eslint-config/
│   ├── typescript-config/
│   └── scripts/
│
└── docs/                               # Documentation
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEVELOPMENT.md
```

## Components and Interfaces

### 1. Communication Layer

#### tRPC Integration

The communication layer uses tRPC for type-safe API calls between client and server:

```typescript
// packages/shared/src/types/api.ts
export interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
  priority: TaskPriority;
  dueDate?: Date;
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
}

// apps/server/src/api/tasks.ts
import { z } from "zod";
import { createTaskSchema } from "@taskmanagement/shared";
import { protectedProcedure, router } from "../trpc/router";

export const tasksRouter = router({
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ input, ctx }) => {
      // Leverage existing application services
      const taskService = ctx.container.resolve("TaskApplicationService");
      return await taskService.createTask(input, ctx.user.id);
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        status: z.enum(["todo", "in-progress", "done"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve("TaskApplicationService");
      return await taskService.getTasks(input, ctx.user.id);
    }),
});

// apps/client/src/lib/trpc.ts
import { createTRPCNext } from "@trpc/next";
import { type AppRouter } from "@taskmanagement/server/api";

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: "/api/trpc",
          headers: () => ({
            authorization: `Bearer ${getToken()}`,
          }),
        }),
      ],
    };
  },
});
```

#### WebSocket Integration

Real-time communication using the existing WebSocket infrastructure:

```typescript
// apps/server/src/websocket/realtime-manager.ts
export class RealtimeManager {
  constructor(private container: Container) {}

  async broadcastTaskUpdate(taskId: string, update: Partial<Task>) {
    // Leverage existing WebSocket service
    const websocketService = this.container.resolve("WebSocketService");
    await websocketService.broadcast("task:updated", { taskId, update });
  }
}

// apps/client/src/hooks/use-realtime.ts
export function useRealtime() {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws`);
    setSocket(ws);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle real-time updates
    };

    return () => ws.close();
  }, []);

  return { socket };
}
```

### 2. Shared Package Architecture

#### Type Definitions

```typescript
// packages/shared/src/types/tasks.ts
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in-progress",
  DONE = "done",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}
```

#### Validation Schemas

```typescript
// packages/shared/src/schemas/task.schemas.ts
import { z } from "zod";
import { TaskStatus, TaskPriority } from "../types/tasks";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  priority: z.nativeEnum(TaskPriority),
  dueDate: z.date().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});
```

### 3. Database Package Integration

The database package wraps the existing sophisticated database infrastructure:

```typescript
// packages/database/src/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Leverage existing database configuration
const connection = postgres(process.env.DATABASE_URL!);
export const db = drizzle(connection, { schema });

// packages/database/src/queries/tasks.queries.ts
import { eq, and } from "drizzle-orm";
import { db } from "../client";
import { tasks, projects } from "../schema";

export const taskQueries = {
  async getByProject(projectId: string, userId: string) {
    return await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(tasks.projectId, projectId), eq(projects.ownerId, userId)));
  },

  async create(data: InsertTask) {
    return await db.insert(tasks).values(data).returning();
  },
};
```

### 4. Frontend Architecture

#### Component Structure

```typescript
// apps/client/src/components/features/tasks/task-list.tsx
"use client";

import { trpc } from "@/lib/trpc";
import { TaskCard } from "./task-card";
import { useRealtime } from "@/hooks/use-realtime";

export function TaskList({ projectId }: { projectId: string }) {
  const { data: tasks, refetch } = trpc.tasks.list.useQuery({ projectId });
  const { socket } = useRealtime();

  useEffect(() => {
    if (!socket) return;

    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "task:updated") {
        refetch();
      }
    });
  }, [socket, refetch]);

  return (
    <div className="space-y-4">
      {tasks?.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
```

#### State Management

```typescript
// apps/client/src/store/task-store.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { Task, TaskFilter } from "@taskmanagement/shared";

interface TaskState {
  tasks: Task[];
  filters: TaskFilter;
  selectedTasks: Set<string>;

  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setFilters: (filters: Partial<TaskFilter>) => void;
}

export const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      (set, get) => ({
        tasks: [],
        filters: {},
        selectedTasks: new Set(),

        setTasks: (tasks) => set({ tasks }),
        addTask: (task) =>
          set((state) => ({
            tasks: [...state.tasks, task],
          })),
        updateTask: (id, updates) =>
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          })),
        removeTask: (id) =>
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
            selectedTasks: new Set(
              [...state.selectedTasks].filter((tid) => tid !== id)
            ),
          })),
        setFilters: (filters) =>
          set((state) => ({
            filters: { ...state.filters, ...filters },
          })),
      }),
      { name: "task-store" }
    )
  )
);
```

## Data Models

### Shared Type System

The shared package provides a unified type system that both client and server use:

```typescript
// packages/shared/src/types/index.ts
export * from "./auth";
export * from "./tasks";
export * from "./projects";
export * from "./users";
export * from "./api";

// Unified error handling
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
} as const;
```

### Database Schema Integration

The database package integrates with the existing Drizzle schema:

```typescript
// packages/database/src/schema/index.ts
// Re-export existing schemas from server
export * from "../../../apps/server/src/infrastructure/database/schema";

// Add any additional client-specific schemas if needed
export const clientPreferences = pgTable("client_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  theme: varchar("theme", { length: 20 }).default("light"),
  language: varchar("language", { length: 10 }).default("en"),
  notifications: jsonb("notifications").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

## Error Handling

### Unified Error System

```typescript
// packages/shared/src/errors/index.ts
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, ErrorCodes.VALIDATION_ERROR, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, ErrorCodes.UNAUTHORIZED, 401);
  }
}

// apps/client/src/lib/error-handler.ts
export class ClientErrorHandler {
  static handle(error: unknown) {
    if (error instanceof AppError) {
      // Handle known application errors
      toast.error(error.message);
      return;
    }

    // Handle unknown errors
    console.error("Unexpected error:", error);
    toast.error("An unexpected error occurred");
  }
}

// Error boundary for React components
export class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ClientErrorHandler.handle(error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

## Testing Strategy

### Cross-Package Testing

```typescript
// tests/integration/full-stack.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "@taskmanagement/server";
import { createTRPCClient } from "@trpc/client";

describe("Full-Stack Integration", () => {
  let server: any;
  let trpcClient: any;

  beforeAll(async () => {
    server = await createApp();
    await server.start();

    trpcClient = createTRPCClient({
      url: "http://localhost:3001/trpc",
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should create and retrieve task end-to-end", async () => {
    const task = await trpcClient.tasks.create.mutate({
      title: "Test Task",
      projectId: "test-project-id",
      priority: "high",
    });

    expect(task.title).toBe("Test Task");

    const retrievedTask = await trpcClient.tasks.getById.query({
      id: task.id,
    });

    expect(retrievedTask.id).toBe(task.id);
  });
});
```

### Component Testing

```typescript
// apps/client/__tests__/components/task-list.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { TaskList } from "@/components/features/tasks/task-list";
import { trpc } from "@/lib/trpc";

// Mock tRPC
jest.mock("@/lib/trpc");

describe("TaskList", () => {
  it("renders tasks from API", async () => {
    const mockTasks = [
      { id: "1", title: "Test Task 1", status: "todo" },
      { id: "2", title: "Test Task 2", status: "in-progress" },
    ];

    (trpc.tasks.list.useQuery as jest.Mock).mockReturnValue({
      data: mockTasks,
      isLoading: false,
    });

    render(<TaskList projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Test Task 1")).toBeInTheDocument();
      expect(screen.getByText("Test Task 2")).toBeInTheDocument();
    });
  });
});
```

## Performance Optimization

### Caching Strategy

```typescript
// packages/shared/src/cache/cache-manager.ts
export class MultiLayerCache {
  constructor(
    private memoryCache: LRUCache<string, any>,
    private redisCache: Redis
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // Level 1: Memory cache
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) return memoryResult;

    // Level 2: Redis cache
    const redisResult = await this.redisCache.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult);
      this.memoryCache.set(key, parsed);
      return parsed;
    }

    return null;
  }

  async set(key: string, value: any, ttl = 300): Promise<void> {
    this.memoryCache.set(key, value);
    await this.redisCache.setex(key, ttl, JSON.stringify(value));
  }
}
```

### Query Optimization

```typescript
// apps/client/src/lib/query-optimization.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
    },
  },
});

// Prefetching strategy
export class QueryPrefetcher {
  static async prefetchProjectData(projectId: string) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["projects", projectId],
        queryFn: () => trpc.projects.getById.query({ id: projectId }),
      }),
      queryClient.prefetchQuery({
        queryKey: ["tasks", "project", projectId],
        queryFn: () => trpc.tasks.getByProject.query({ projectId }),
      }),
    ]);
  }
}
```

## Deployment Architecture

### Docker Configuration

```yaml
# docker-compose.yml
version: "3.8"
services:
  database:
    image: postgres:15
    environment:
      POSTGRES_DB: taskmanagement
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@database:5432/taskmanagement
      - REDIS_URL=redis://redis:6379
    depends_on:
      - database
      - redis
    ports:
      - "3001:3001"

  client:
    build:
      context: .
      dockerfile: apps/client/Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://server:3001
    depends_on:
      - server
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

### Build Configuration

```json
// turbo.json
{
  "pipeline": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

This design provides a comprehensive foundation for transforming your project into a unified full-stack architecture while preserving all existing backend capabilities and adding powerful frontend integration with type safety, real-time communication, and optimal developer experience.
