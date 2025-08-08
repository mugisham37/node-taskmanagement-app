import { z } from 'zod';

// Common validation patterns
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Filter schemas
export const dateRangeSchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .refine(
    data => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo);
      }
      return true;
    },
    {
      message: 'dateFrom must be before dateTo',
    }
  );

export const searchSchema = z.object({
  search: z.string().min(1).max(255).optional(),
});

// Common entity fields
export const timestampSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const auditSchema = timestampSchema.extend({
  createdBy: uuidSchema,
  updatedBy: uuidSchema.optional(),
});

// Status enums
export const taskStatusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
]);
export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const projectStatusSchema = z.enum([
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
]);
export const userRoleSchema = z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']);
export const workspaceRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER',
]);

// Response schemas
export const standardResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    error: z
      .object({
        message: z.string(),
        code: z.string(),
        details: z.any().optional(),
        correlationId: z.string().optional(),
      })
      .optional(),
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        totalPages: z.number().optional(),
      })
      .optional(),
    timestamp: z.string().datetime(),
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  standardResponseSchema(z.array(itemSchema)).extend({
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

// Error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.any().optional(),
    correlationId: z.string().optional(),
  }),
  timestamp: z.string().datetime(),
});

// Validation helpers
export const createValidationSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict();

export const updateValidationSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).partial().strict();

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const workspaceContextSchema = z.object({
  workspaceId: uuidSchema,
});

// File upload schemas
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  buffer: z.instanceof(Buffer),
});

export const imageUploadSchema = fileUploadSchema.extend({
  mimetype: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|gif|webp)$/, 'Invalid image format'),
});

// Bulk operation schemas
export const bulkOperationSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
  operation: z.enum(['delete', 'update', 'archive']),
});

export const bulkUpdateSchema = <T extends z.ZodTypeAny>(updateSchema: T) =>
  z.object({
    ids: z.array(uuidSchema).min(1).max(100),
    data: updateSchema,
  });

export type PaginationParams = z.infer<typeof paginationSchema>;
export type DateRangeFilter = z.infer<typeof dateRangeSchema>;
export type SearchFilter = z.infer<typeof searchSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
