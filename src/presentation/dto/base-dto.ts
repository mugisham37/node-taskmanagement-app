import { z } from 'zod';

// Base interfaces for DTOs
export interface BaseDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseRequestDto {
  // Common request properties
  correlationId?: string;
  requestId?: string;
  clientVersion?: string;
  locale?: string;
  timezone?: string;
}

export interface BaseResponseDto {
  success: boolean;
  data?: any;
  message?: string;
  timestamp: string;
  requestId?: string;
  version?: string;
}

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationDto;
  meta?: {
    totalCount?: number;
    filteredCount?: number;
    searchQuery?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  };
}

export interface ErrorResponseDto {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    requestId?: string;
    correlationId?: string;
    stack?: string; // Only in development
  };
}

export interface ValidationErrorResponseDto {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    requestId?: string;
    validationErrors: Array<{
      field: string;
      message: string;
      value?: any;
      code?: string;
      constraint?: string;
    }>;
  };
}

export interface SearchRequestDto {
  query?: string;
  filters?: Record<string, any>;
  facets?: string[];
  highlight?: boolean;
  fuzzy?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BulkOperationRequestDto<T> {
  operations: Array<{
    operation: 'create' | 'update' | 'delete';
    data: T;
    id?: string;
  }>;
  options?: {
    continueOnError?: boolean;
    validateOnly?: boolean;
    batchSize?: number;
  };
}

export interface BulkOperationResponseDto<T> {
  results: Array<{
    operation: 'create' | 'update' | 'delete';
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
    };
    id?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
}

export interface FileUploadDto {
  filename: string;
  mimetype: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface AuditDto {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  timestamp: Date;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

export interface HealthCheckDto {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  services: Record<
    string,
    {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    }
  >;
  system?: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

// Base validation schemas
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const SortQuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const BaseQuerySchema = PaginationQuerySchema.merge(SortQuerySchema);

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SortQuery = z.infer<typeof SortQuerySchema>;
export type BaseQuery = z.infer<typeof BaseQuerySchema>;

// Common validation patterns
export const IdSchema = z.string().min(1, 'ID is required');
export const EmailSchema = z.string().email('Invalid email format');
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');
export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name too long');
export const DescriptionSchema = z
  .string()
  .max(1000, 'Description too long')
  .optional();
export const DateSchema = z.coerce.date();
export const OptionalDateSchema = z.coerce.date().optional();
