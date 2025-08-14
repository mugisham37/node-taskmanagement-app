import { z } from 'zod';

// API response schema
export const apiResponseSchema = z.object({
  data: z.any(),
  success: z.boolean(),
  message: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

// API error schema
export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  statusCode: z.number().int().min(100).max(599),
  field: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

// Pagination params schema
export const paginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
  sortBy: z.string().min(1).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Paginated response schema
export const paginatedResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

// Filter params schema
export const filterParamsSchema = z.object({
  search: z.string().max(255).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// WebSocket event schema
export const webSocketEventSchema = z.object({
  type: z.string().min(1),
  payload: z.any(),
  timestamp: z.date(),
  userId: z.string().uuid().optional(),
  roomId: z.string().optional(),
});

// WebSocket message schema
export const webSocketMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['event', 'response', 'error']),
  data: z.any(),
  timestamp: z.date(),
});

// File upload schema
export const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.string().min(1),
  fileData: z.string().optional(), // Base64 encoded file data
});

// Bulk operation schema
export const bulkOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  items: z.array(z.any()).min(1).max(100),
  options: z.record(z.string(), z.any()).optional(),
});

// Search params schema
export const searchParamsSchema = z.object({
  query: z.string().min(1).max(255),
  filters: z.record(z.string(), z.any()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeArchived: z.boolean().default(false),
});

// Export params schema
export const exportParamsSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json', 'pdf']),
  filters: z.record(z.string(), z.any()).optional(),
  fields: z.array(z.string()).optional(),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }).optional(),
});