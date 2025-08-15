/**
 * Platform-agnostic response utilities
 * Provides response formatting without framework dependencies
 */

import { PAGINATION } from '../constants';

/**
 * Standard API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    pages?: number;
    timestamp?: string;
    requestId?: string;
    version?: string;
    [key: string]: any;
  };
  errors?: any;
}

/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
}

/**
 * Response utilities class
 */
export class ResponseUtils {
  /**
   * Create a success response
   * @param data Response data
   * @param message Success message
   * @param meta Additional metadata
   * @returns Formatted success response
   */
  static success<T>(
    data: T,
    message: string = 'Success',
    meta?: any
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
  }

  /**
   * Create an error response
   * @param message Error message
   * @param errors Detailed error information
   * @param code Error code
   * @returns Formatted error response
   */
  static error(
    message: string = 'An error occurred',
    errors?: any,
    code?: string
  ): ApiResponse {
    return {
      success: false,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        ...(code && { code }),
      },
      ...(errors && { errors }),
    };
  }

  /**
   * Create a paginated response
   * @param data Response data array
   * @param pagination Pagination metadata
   * @param message Success message
   * @returns Formatted paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    message: string = 'Success'
  ): ApiResponse<T[]> {
    return this.success(data, message, { pagination });
  }

  /**
   * Create pagination metadata
   * @param total Total number of items
   * @param page Current page number
   * @param limit Items per page
   * @returns Pagination metadata
   */
  static createPaginationMeta(
    total: number,
    page: number,
    limit: number
  ): PaginationMeta {
    const pages = Math.ceil(total / limit) || 1;
    const hasNext = page < pages;
    const hasPrev = page > 1;

    return {
      total,
      page,
      limit,
      pages,
      hasNext,
      hasPrev,
      ...(hasNext && { nextPage: page + 1 }),
      ...(hasPrev && { prevPage: page - 1 }),
    };
  }

  /**
   * Normalize pagination parameters using constants
   * @param page Page number
   * @param limit Items per page
   * @returns Normalized pagination parameters
   */
  static normalizePaginationParams(page?: number, limit?: number) {
    const normalizedPage = Math.max(1, page || PAGINATION.DEFAULT_PAGE);
    const normalizedLimit = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(PAGINATION.MIN_PAGE_SIZE, limit || PAGINATION.DEFAULT_PAGE_SIZE)
    );
    
    return {
      page: normalizedPage,
      limit: normalizedLimit,
      offset: (normalizedPage - 1) * normalizedLimit,
    };
  }

  /**
   * Create validation error response
   * @param errors Validation errors
   * @param message Error message
   * @returns Formatted validation error response
   */
  static validationError(
    errors: any,
    message: string = 'Validation failed'
  ): ApiResponse {
    return this.error(message, errors, 'VALIDATION_ERROR');
  }

  /**
   * Create not found error response
   * @param message Error message
   * @returns Formatted not found response
   */
  static notFound(message: string = 'Resource not found'): ApiResponse {
    return this.error(message, null, 'NOT_FOUND');
  }

  /**
   * Create unauthorized error response
   * @param message Error message
   * @returns Formatted unauthorized response
   */
  static unauthorized(message: string = 'Authentication required'): ApiResponse {
    return this.error(message, null, 'UNAUTHORIZED');
  }

  /**
   * Create forbidden error response
   * @param message Error message
   * @returns Formatted forbidden response
   */
  static forbidden(message: string = 'Access forbidden'): ApiResponse {
    return this.error(message, null, 'FORBIDDEN');
  }

  /**
   * Create conflict error response
   * @param message Error message
   * @returns Formatted conflict response
   */
  static conflict(message: string = 'Resource conflict'): ApiResponse {
    return this.error(message, null, 'CONFLICT');
  }

  /**
   * Create internal server error response
   * @param message Error message
   * @returns Formatted internal server error response
   */
  static internalServerError(
    message: string = 'Internal server error'
  ): ApiResponse {
    return this.error(message, null, 'INTERNAL_SERVER_ERROR');
  }
}