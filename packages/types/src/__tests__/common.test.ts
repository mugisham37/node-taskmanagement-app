import { describe, expect, it } from 'vitest';
import {
    ApiResponse,
    DeepPartial,
    NonEmptyArray,
    Nullable,
    Optional,
    PaginatedResponse,
    PaginationParams,
    Priority,
    RequiredFields,
    Result,
    TaskStatus,
    UnifiedTaskFilters
} from '../common';

describe('Common Types', () => {
  describe('PaginationParams', () => {
    it('should define correct pagination structure', () => {
      const pagination: PaginationParams = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(20);
      expect(pagination.sortBy).toBe('createdAt');
      expect(pagination.sortOrder).toBe('desc');
    });

    it('should allow optional sort parameters', () => {
      const pagination: PaginationParams = {
        page: 1,
        limit: 10,
      };

      expect(pagination.sortBy).toBeUndefined();
      expect(pagination.sortOrder).toBeUndefined();
    });
  });

  describe('PaginatedResponse', () => {
    it('should structure paginated data correctly', () => {
      const response: PaginatedResponse<string> = {
        data: ['item1', 'item2'],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      };

      expect(response.data).toHaveLength(2);
      expect(response.pagination.hasNext).toBe(true);
      expect(response.pagination.hasPrev).toBe(false);
    });
  });

  describe('ApiResponse', () => {
    it('should handle successful responses', () => {
      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id: '123' },
        message: 'Success',
      };

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe('123');
    });

    it('should handle error responses', () => {
      const response: ApiResponse = {
        success: false,
        errors: ['Validation failed'],
        message: 'Error occurred',
      };

      expect(response.success).toBe(false);
      expect(response.errors).toContain('Validation failed');
    });
  });

  describe('Result Type', () => {
    it('should handle successful results', () => {
      const result: Result<string> = {
        success: true,
        data: 'test data',
      };

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test data');
      }
    });

    it('should handle error results', () => {
      const result: Result<string, string> = {
        success: false,
        error: 'Something went wrong',
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Something went wrong');
      }
    });
  });

  describe('Utility Types', () => {
    describe('DeepPartial', () => {
      it('should make all properties optional recursively', () => {
        interface TestInterface {
          name: string;
          nested: {
            value: number;
            deep: {
              flag: boolean;
            };
          };
        }

        const partial: DeepPartial<TestInterface> = {
          nested: {
            deep: {},
          },
        };

        expect(partial.name).toBeUndefined();
        expect(partial.nested?.value).toBeUndefined();
        expect(partial.nested?.deep?.flag).toBeUndefined();
      });
    });

    describe('NonEmptyArray', () => {
      it('should ensure array has at least one element', () => {
        const array: NonEmptyArray<string> = ['first', 'second'];
        expect(array.length).toBeGreaterThan(0);
        expect(array[0]).toBe('first');
      });
    });

    describe('Nullable', () => {
      it('should allow null values', () => {
        const nullable: Nullable<string> = null;
        const notNull: Nullable<string> = 'value';

        expect(nullable).toBeNull();
        expect(notNull).toBe('value');
      });
    });

    describe('Optional', () => {
      it('should make specified keys optional', () => {
        interface TestInterface {
          required: string;
          optional: number;
        }

        const obj: Optional<TestInterface, 'optional'> = {
          required: 'test',
        };

        expect(obj.required).toBe('test');
        expect(obj.optional).toBeUndefined();
      });
    });

    describe('RequiredFields', () => {
      it('should make specified keys required', () => {
        interface TestInterface {
          optional?: string;
          alsoOptional?: number;
        }

        const obj: RequiredFields<TestInterface, 'optional'> = {
          optional: 'now required',
        };

        expect(obj.optional).toBe('now required');
      });
    });
  });

  describe('Task Filter Types', () => {
    describe('TaskStatus', () => {
      it('should include all valid task statuses', () => {
        const statuses: TaskStatus[] = [
          'TODO',
          'IN_PROGRESS',
          'IN_REVIEW',
          'COMPLETED',
          'CANCELLED',
        ];

        statuses.forEach(status => {
          expect(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']).toContain(status);
        });
      });
    });

    describe('Priority', () => {
      it('should include all valid priorities', () => {
        const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

        priorities.forEach(priority => {
          expect(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).toContain(priority);
        });
      });
    });

    describe('UnifiedTaskFilters', () => {
      it('should allow comprehensive task filtering', () => {
        const filters: UnifiedTaskFilters = {
          status: ['TODO', 'IN_PROGRESS'],
          priority: ['HIGH', 'URGENT'],
          assigneeId: 'user-123',
          createdById: 'user-456',
          dueDateFrom: new Date('2024-01-01'),
          dueDateTo: new Date('2024-12-31'),
          isOverdue: true,
          hasAssignee: true,
          hasEstimatedHours: false,
          search: 'important task',
        };

        expect(filters.status).toContain('TODO');
        expect(filters.priority).toContain('HIGH');
        expect(filters.assigneeId).toBe('user-123');
        expect(filters.isOverdue).toBe(true);
        expect(filters.search).toBe('important task');
      });

      it('should allow empty filters', () => {
        const filters: UnifiedTaskFilters = {};
        expect(Object.keys(filters)).toHaveLength(0);
      });
    });
  });
});