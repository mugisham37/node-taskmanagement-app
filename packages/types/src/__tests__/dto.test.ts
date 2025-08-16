import { describe, expect, it } from 'vitest';
import {
    CreateProjectSchema,
    CreateTaskSchema,
    CreateUserSchema,
    LoginSchema,
    TaskFiltersSchema,
    UpdateProjectSchema,
    UpdateTaskSchema,
} from '../dto';

describe('DTO Validation Schemas', () => {
  describe('Task DTOs', () => {
    describe('CreateTaskSchema', () => {
      it('should validate valid task creation data', () => {
        const validData = {
          title: 'Test Task',
          description: 'Test Description',
          priority: 'HIGH' as const,
          projectId: 'project-123',
          assigneeId: 'user-123',
          dueDate: new Date(),
          estimatedHours: 8,
        };

        const result = CreateTaskSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid priority', () => {
        const invalidData = {
          title: 'Test Task',
          priority: 'INVALID' as any,
          projectId: 'project-123',
        };

        const result = CreateTaskSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty title', () => {
        const invalidData = {
          title: '',
          priority: 'HIGH' as const,
          projectId: 'project-123',
        };

        const result = CreateTaskSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('UpdateTaskSchema', () => {
      it('should validate partial updates', () => {
        const validData = {
          title: 'Updated Task',
          priority: 'LOW' as const,
        };

        const result = UpdateTaskSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject empty update object', () => {
        const invalidData = {};

        const result = UpdateTaskSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('TaskFiltersSchema', () => {
      it('should validate task filters', () => {
        const validFilters = {
          status: 'IN_PROGRESS' as const,
          priority: 'HIGH' as const,
          assigneeId: 'user-123',
          isOverdue: true,
        };

        const result = TaskFiltersSchema.safeParse(validFilters);
        expect(result.success).toBe(true);
      });

      it('should handle empty filters', () => {
        const emptyFilters = {};

        const result = TaskFiltersSchema.safeParse(emptyFilters);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Project DTOs', () => {
    describe('CreateProjectSchema', () => {
      it('should validate valid project creation data', () => {
        const validData = {
          name: 'Test Project',
          description: 'Test Description',
          workspaceId: 'workspace-123',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000), // Tomorrow
        };

        const result = CreateProjectSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject end date before start date', () => {
        const invalidData = {
          name: 'Test Project',
          workspaceId: 'workspace-123',
          startDate: new Date(),
          endDate: new Date(Date.now() - 86400000), // Yesterday
        };

        const result = CreateProjectSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('UpdateProjectSchema', () => {
      it('should validate project updates', () => {
        const validData = {
          name: 'Updated Project',
          status: 'COMPLETED' as const,
        };

        const result = UpdateProjectSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject empty update object', () => {
        const invalidData = {};

        const result = UpdateProjectSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('User DTOs', () => {
    describe('CreateUserSchema', () => {
      it('should validate valid user creation data', () => {
        const validData = {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'securePassword123',
        };

        const result = CreateUserSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email', () => {
        const invalidData = {
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe',
          password: 'securePassword123',
        };

        const result = CreateUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject short password', () => {
        const invalidData = {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: '123',
        };

        const result = CreateUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('LoginSchema', () => {
      it('should validate login credentials', () => {
        const validData = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = LoginSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email format', () => {
        const invalidData = {
          email: 'not-an-email',
          password: 'password123',
        };

        const result = LoginSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});