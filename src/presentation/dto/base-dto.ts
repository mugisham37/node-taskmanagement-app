import { z } from 'zod';

// Base interfaces for DTOs
export interface BaseDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
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
