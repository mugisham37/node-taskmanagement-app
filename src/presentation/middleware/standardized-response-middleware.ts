import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
    pagination?: PaginationMeta;
    performance?: PerformanceMeta;
  };
  error?: ErrorDetails;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PerformanceMeta {
  responseTime: number;
  cacheHit?: boolean;
  queryCount?: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  timestamp: string;
  traceId?: string;
  path: string;
  method: string;
}

export class StandardizedResponseMiddleware {
  constructor(private readonly logger: LoggingService) {}

  /**
   * Initialize response standardization
   */
  initialize() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Add request start time for performance tracking
      (request as any).startTime = Date.now();

      // Generate request ID if not present
      if (!request.headers['x-request-id']) {
        (request as any).requestId = this.generateRequestId();
      } else {
        (request as any).requestId = request.headers['x-request-id'];
      }

      // Add standardized response methods to reply
      this.addResponseMethods(reply, request);
    };
  }

  /**
   * Add standardized response methods to Fastify reply
   */
  private addResponseMethods(reply: FastifyReply, request: FastifyRequest) {
    // Success response
    (reply as any).success = (
      data?: any,
      message?: string,
      statusCode = 200
    ) => {
      const response = this.createSuccessResponse(data, message, request);
      return reply.status(statusCode).send(response);
    };

    // Created response
    (reply as any).created = (
      data?: any,
      message = 'Resource created successfully'
    ) => {
      const response = this.createSuccessResponse(data, message, request);
      return reply.status(201).send(response);
    };

    // No content response
    (reply as any).noContent = (
      message = 'Operation completed successfully'
    ) => {
      const response = this.createSuccessResponse(null, message, request);
      return reply.status(204).send(response);
    };

    // Paginated response
    (reply as any).paginated = (
      data: any[],
      total: number,
      page: number,
      limit: number,
      message = 'Data retrieved successfully'
    ) => {
      const paginationMeta = this.createPaginationMeta(total, page, limit);
      const response = this.createSuccessResponse(
        data,
        message,
        request,
        paginationMeta
      );
      return reply.status(200).send(response);
    };

    // Error response
    (reply as any).error = (
      code: string,
      message: string,
      statusCode = 400,
      details?: any
    ) => {
      const response = this.createErrorResponse(
        code,
        message,
        request,
        details
      );
      return reply.status(statusCode).send(response);
    };

    // Validation error response
    (reply as any).validationError = (
      errors: any[],
      message = 'Validation failed'
    ) => {
      const response = this.createErrorResponse(
        'VALIDATION_ERROR',
        message,
        request,
        errors
      );
      return reply.status(400).send(response);
    };

    // Not found response
    (reply as any).notFound = (message = 'Resource not found') => {
      const response = this.createErrorResponse('NOT_FOUND', message, request);
      return reply.status(404).send(response);
    };

    // Unauthorized response
    (reply as any).unauthorized = (message = 'Authentication required') => {
      const response = this.createErrorResponse(
        'UNAUTHORIZED',
        message,
        request
      );
      return reply.status(401).send(response);
    };

    // Forbidden response
    (reply as any).forbidden = (message = 'Access denied') => {
      const response = this.createErrorResponse('FORBIDDEN', message, request);
      return reply.status(403).send(response);
    };

    // Conflict response
    (reply as any).conflict = (
      message = 'Resource conflict',
      details?: any
    ) => {
      const response = this.createErrorResponse(
        'CONFLICT',
        message,
        request,
        details
      );
      return reply.status(409).send(response);
    };

    // Too many requests response
    (reply as any).tooManyRequests = (message = 'Rate limit exceeded') => {
      const response = this.createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        message,
        request
      );
      return reply.status(429).send(response);
    };

    // Internal server error response
    (reply as any).internalError = (
      message = 'Internal server error',
      details?: any
    ) => {
      const response = this.createErrorResponse(
        'INTERNAL_ERROR',
        message,
        request,
        details
      );
      return reply.status(500).send(response);
    };

    // Service unavailable response
    (reply as any).serviceUnavailable = (
      message = 'Service temporarily unavailable'
    ) => {
      const response = this.createErrorResponse(
        'SERVICE_UNAVAILABLE',
        message,
        request
      );
      return reply.status(503).send(response);
    };
  }

  /**
   * Create standardized success response
   */
  private createSuccessResponse(
    data: any,
    message: string | undefined,
    request: FastifyRequest,
    paginationMeta?: PaginationMeta
  ): StandardResponse {
    const meta = this.createResponseMeta(request, paginationMeta);

    return {
      success: true,
      data,
      message: message || '',
      meta,
    };
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(
    code: string,
    message: string,
    request: FastifyRequest,
    details?: any
  ): StandardResponse {
    const meta = this.createResponseMeta(request);

    const error: ErrorDetails = {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      traceId: (request as any).requestId,
    };

    // Add stack trace in development
    if (process.env['NODE_ENV'] === 'development' && details instanceof Error) {
      (error as any).stack = details.stack;
    }

    return {
      success: false,
      error,
      meta,
    };
  }

  /**
   * Create response metadata
   */
  private createResponseMeta(
    request: FastifyRequest,
    paginationMeta?: PaginationMeta
  ) {
    const responseTime =
      Date.now() - ((request as any).startTime || Date.now());

    const meta: any = {
      timestamp: new Date().toISOString(),
      requestId: (request as any).requestId,
      version: process.env['API_VERSION'] || '1.0.0',
      performance: {
        responseTime,
        cacheHit: (request as any).cacheHit || false,
        queryCount: (request as any).queryCount || 0,
      },
    };

    if (paginationMeta) {
      meta.pagination = paginationMeta;
    }

    return meta;
  }

  /**
   * Create pagination metadata
   */
  private createPaginationMeta(
    total: number,
    page: number,
    limit: number
  ): PaginationMeta {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Global error handler
   */
  createGlobalErrorHandler() {
    return async (
      error: Error,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      this.logger.error('Unhandled error', error, {
        url: request.url,
        method: request.method,
        requestId: (request as any).requestId,
      });

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return (reply as any).validationError(
          (error as any).details || [],
          error.message
        );
      }

      if (error.name === 'UnauthorizedError') {
        return (reply as any).unauthorized(error.message);
      }

      if (error.name === 'ForbiddenError') {
        return (reply as any).forbidden(error.message);
      }

      if (error.name === 'NotFoundError') {
        return (reply as any).notFound(error.message);
      }

      if (error.name === 'ConflictError') {
        return (reply as any).conflict(error.message);
      }

      if (error.name === 'RateLimitError') {
        return (reply as any).tooManyRequests(error.message);
      }

      // Default to internal server error
      return (reply as any).internalError(
        process.env['NODE_ENV'] === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        process.env['NODE_ENV'] === 'development' ? error : undefined
      );
    };
  }

  /**
   * Response transformation hook
   */
  createResponseTransformHook() {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
      payload: any
    ) => {
      // Skip transformation for already standardized responses
      if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload;
      }

      // Transform non-standardized responses
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        return this.createSuccessResponse(payload, undefined, request);
      }

      return payload;
    };
  }

  /**
   * Add CORS headers
   */
  addCorsHeaders() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header(
        'Access-Control-Allow-Origin',
        process.env['CORS_ORIGIN'] || '*'
      );
      reply.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Request-ID'
      );
      reply.header(
        'Access-Control-Expose-Headers',
        'X-Request-ID, X-Response-Time'
      );
      reply.header('Access-Control-Max-Age', '86400');

      if (request.method === 'OPTIONS') {
        return reply.status(204).send();
      }
    };
  }

  /**
   * Add security headers
   */
  addSecurityHeaders() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      reply.header('Content-Security-Policy', "default-src 'self'");
      reply.header('X-Request-ID', (request as any).requestId);
    };
  }

  /**
   * Add performance headers
   */
  addPerformanceHeaders() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const responseTime =
        Date.now() - ((request as any).startTime || Date.now());
      reply.header('X-Response-Time', `${responseTime}ms`);

      if ((request as any).cacheHit) {
        reply.header('X-Cache', 'HIT');
      } else {
        reply.header('X-Cache', 'MISS');
      }
    };
  }
}

// HTTP Status Code Constants
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error Code Constants
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Business Logic
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;
