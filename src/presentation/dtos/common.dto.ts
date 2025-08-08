/**
 * Pagination request DTO
 */
export interface PaginationRequestDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response DTO
 */
export interface PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Search request DTO
 */
export interface SearchRequestDto extends PaginationRequestDto {
  query?: string;
  filters?: Record<string, any>;
}
