/**
 * Common types used across the application
 */

/**
 * Generic ID type
 */
export type ID = string;

/**
 * Timestamp type
 */
export type Timestamp = Date;

/**
 * Optional properties helper
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Required properties helper
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Sort options
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter options
 */
export interface FilterOptions {
  [key: string]: any;
}

/**
 * Search options
 */
export interface SearchOptions extends PaginationOptions {
  query?: string;
  filters?: FilterOptions;
  sort?: SortOptions[];
}
