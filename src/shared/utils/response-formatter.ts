import type { Response } from 'express';
import * as crypto from 'crypto';

/**
 * Enhanced API response formatting utilities
 * Provides consistent response structure with caching, ETags, and metadata
 */

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
 * Send a success response with enhanced features
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param data Response data
 * @param message Success message
 * @param meta Additional metadata
 */
export const successResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message: string = 'Success',
  meta?: any
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.req as any).requestId,
      version: process.env['API_VERSION'] || 'v1',
      ...meta,
    },
  };

  // Set caching headers for GET requests
  if (res.req.method === 'GET') {
    setCacheHeaders(res, statusCode, data);
  } else {
    // Don't cache non-GET requests
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Set security headers
  setSecurityHeaders(res);

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param message Error message
 * @param errors Detailed error information
 * @param code Error code
 */
export const errorResponse = (
  res: Response,
  statusCode: number,
  message: string = 'An error occurred',
  errors?: any,
  code?: string
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.req as any).requestId,
      version: process.env['API_VERSION'] || 'v1',
      ...(code && { code }),
    },
    ...(errors && { errors }),
  };

  // Don't cache error responses
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Set security headers
  setSecurityHeaders(res);

  return res.status(statusCode).json(response);
};

/**
 * Send a paginated response
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param data Response data array
 * @param pagination Pagination metadata
 * @param message Success message
 */
export const paginatedResponse = <T>(
  res: Response,
  statusCode: number,
  data: T[],
  pagination: PaginationMeta,
  message: string = 'Success'
): Response => {
  return successResponse(res, statusCode, data, message, {
    pagination,
  });
};

/**
 * Send a created response (201)
 * @param res Express response object
 * @param data Created resource data
 * @param message Success message
 * @param location Optional location header
 */
export const createdResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully',
  location?: string
): Response => {
  if (location) {
    res.setHeader('Location', location);
  }
  return successResponse(res, 201, data, message);
};

/**
 * Send a no content response (204)
 * @param res Express response object
 */
export const noContentResponse = (res: Response): Response => {
  setSecurityHeaders(res);
  return res.status(204).end();
};

/**
 * Send a not modified response (304)
 * @param res Express response object
 */
export const notModifiedResponse = (res: Response): Response => {
  setSecurityHeaders(res);
  return res.status(304).end();
};

/**
 * Send a validation error response (422)
 * @param res Express response object
 * @param errors Validation errors
 * @param message Error message
 */
export const validationErrorResponse = (
  res: Response,
  errors: any,
  message: string = 'Validation failed'
): Response => {
  return errorResponse(res, 422, message, errors, 'VALIDATION_ERROR');
};

/**
 * Send an unauthorized response (401)
 * @param res Express response object
 * @param message Error message
 */
export const unauthorizedResponse = (
  res: Response,
  message: string = 'Authentication required'
): Response => {
  return errorResponse(res, 401, message, null, 'UNAUTHORIZED');
};

/**
 * Send a forbidden response (403)
 * @param res Express response object
 * @param message Error message
 */
export const forbiddenResponse = (
  res: Response,
  message: string = 'Access forbidden'
): Response => {
  return errorResponse(res, 403, message, null, 'FORBIDDEN');
};

/**
 * Send a not found response (404)
 * @param res Express response object
 * @param message Error message
 */
export const notFoundResponse = (
  res: Response,
  message: string = 'Resource not found'
): Response => {
  return errorResponse(res, 404, message, null, 'NOT_FOUND');
};

/**
 * Send a conflict response (409)
 * @param res Express response object
 * @param message Error message
 */
export const conflictResponse = (
  res: Response,
  message: string = 'Resource conflict'
): Response => {
  return errorResponse(res, 409, message, null, 'CONFLICT');
};

/**
 * Send a too many requests response (429)
 * @param res Express response object
 * @param message Error message
 * @param retryAfter Retry after seconds
 */
export const tooManyRequestsResponse = (
  res: Response,
  message: string = 'Too many requests',
  retryAfter?: number
): Response => {
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter.toString());
  }
  return errorResponse(res, 429, message, null, 'RATE_LIMIT_EXCEEDED');
};

/**
 * Send an internal server error response (500)
 * @param res Express response object
 * @param message Error message
 */
export const internalServerErrorResponse = (
  res: Response,
  message: string = 'Internal server error'
): Response => {
  return errorResponse(res, 500, message, null, 'INTERNAL_SERVER_ERROR');
};

/**
 * Set cache headers for successful responses
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param data Response data
 */
const setCacheHeaders = (
  res: Response,
  statusCode: number,
  data: any
): void => {
  if (statusCode >= 200 && statusCode < 300) {
    // Generate ETag for caching
    if (data) {
      const etag = generateETag(data);
      res.setHeader('ETag', etag);

      // Check if client has the same ETag
      const clientETag = res.req.headers['if-none-match'];
      if (clientETag === etag) {
        notModifiedResponse(res);
        return;
      }
    }

    // Set cache control headers
    const cacheControl = getCacheControl(res.req.originalUrl);
    res.setHeader('Cache-Control', cacheControl);

    // Set Last-Modified header
    res.setHeader('Last-Modified', new Date().toUTCString());
  }
};

/**
 * Generate ETag for response data
 * @param data Response data
 * @returns ETag string
 */
const generateETag = (data: any): string => {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `"${hash}"`;
};

/**
 * Get cache control header based on URL
 * @param url Request URL
 * @returns Cache control string
 */
const getCacheControl = (url: string): string => {
  // Static resources - cache for 1 hour
  if (url.includes('/static/') || url.includes('/assets/')) {
    return 'public, max-age=3600';
  }

  // API data - cache for 5 minutes
  if (url.includes('/api/')) {
    return 'public, max-age=300';
  }

  // Default - cache for 1 minute
  return 'public, max-age=60';
};

/**
 * Set security headers
 * @param res Express response object
 */
const setSecurityHeaders = (res: Response): void => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Set content type
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
};

/**
 * Create pagination metadata
 * @param total Total number of items
 * @param page Current page number
 * @param limit Items per page
 * @returns Pagination metadata
 */
export const createPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
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
};

/**
 * Legacy response formatter for backward compatibility
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param message Response message
 * @param data Response data
 * @param meta Additional metadata
 */
export const responseFormatter = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
  meta?: any
): Response => {
  if (statusCode >= 400) {
    return errorResponse(res, statusCode, message, data);
  }
  return successResponse(res, statusCode, data, message, meta);
};

/**
 * Response builder class for fluent API
 */
export class ResponseBuilder {
  private res: Response;
  private statusCode: number = 200;
  private message: string = 'Success';
  private data: any;
  private meta: any = {};
  private errors: any;

  constructor(res: Response) {
    this.res = res;
  }

  status(code: number): ResponseBuilder {
    this.statusCode = code;
    return this;
  }

  withMessage(message: string): ResponseBuilder {
    this.message = message;
    return this;
  }

  withData(data: any): ResponseBuilder {
    this.data = data;
    return this;
  }

  withMeta(meta: any): ResponseBuilder {
    this.meta = { ...this.meta, ...meta };
    return this;
  }

  withErrors(errors: any): ResponseBuilder {
    this.errors = errors;
    return this;
  }

  send(): Response {
    if (this.statusCode >= 400) {
      return errorResponse(
        this.res,
        this.statusCode,
        this.message,
        this.errors
      );
    }
    return successResponse(
      this.res,
      this.statusCode,
      this.data,
      this.message,
      this.meta
    );
  }
}

/**
 * Create a response builder
 * @param res Express response object
 * @returns ResponseBuilder instance
 */
export const createResponseBuilder = (res: Response): ResponseBuilder => {
  return new ResponseBuilder(res);
};

// Export all response functions as default
export default {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
  notModifiedResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  tooManyRequestsResponse,
  internalServerErrorResponse,
  createPaginationMeta,
  responseFormatter,
  createResponseBuilder,
};
