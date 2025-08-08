import { eq, desc, asc, count, SQL } from 'drizzle-orm';
import { db } from '../db/connection';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';

export interface ServiceOptions {
  enableCache?: boolean;
  cacheTimeout?: number;
  enableAudit?: boolean;
  enableMetrics?: boolean;
}

export interface ServiceContext {
  userId?: string;
  userRole?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ServiceError extends Error {
  code: string;
  statusCode: number;
  context?: Record<string, any>;
  retryable: boolean;
}

export class ServiceException extends Error implements ServiceError {
  public readonly code: string;
  public readonly statusCode: number;
  public context?: Record<string, any>;
  public readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'ServiceException';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.retryable = retryable;
  }
}

export abstract class BaseService {
  protected readonly options: ServiceOptions;
  protected readonly serviceName: string;

  constructor(serviceName: string, options: ServiceOptions = {}) {
    this.serviceName = serviceName;
    this.options = {
      enableCache: false,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true,
      ...options
    };
  }

  protected createContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
    return {
      timestamp: new Date(),
      ...overrides
    };
  }

  protected handleError(error: unknown, operation: string, context?: ServiceContext): never {
    const errorContext = {
      service: this.serviceName,
      operation,
      timestamp: context?.timestamp || new Date(),
      userId: context?.userId,
      requestId: context?.requestId
    };

    if (error instanceof ServiceException) {
      error.context = { ...error.context, ...errorContext };
      throw error;
    }

    if (error instanceof Error) {
      throw new ServiceException(
        'INTERNAL_ERROR',
        `${this.serviceName}.${operation}: ${error.message}`,
        500,
        { ...errorContext, originalError: error.message },
        false
      );
    }

    throw new ServiceException(
      'UNKNOWN_ERROR',
      `${this.serviceName}.${operation}: Unknown error occurred`,
      500,
      errorContext,
      false
    );
  }

  protected validateRequired<T>(value: T | null | undefined, fieldName: string): T {
    if (value === null || value === undefined) {
      throw new ServiceException(
        'VALIDATION_ERROR',
        `${fieldName} is required`,
        400,
        { field: fieldName }
      );
    }
    return value;
  }

  protected validatePagination(options: PaginationOptions): Required<PaginationOptions> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    return { page, limit, sortBy, sortOrder };
  }

  protected async withTransaction<T>(
    callback: (tx: typeof db) => Promise<T>,
    context?: ServiceContext
  ): Promise<T> {
    try {
      return await db.transaction(callback);
    } catch (error) {
      this.handleError(error, 'transaction', context);
    }
  }

  protected logOperation(operation: string, context: ServiceContext, data?: any): void {
    if (this.options.enableAudit) {
      console.log(`[${this.serviceName}] ${operation}`, {
        ...context,
        data: data ? JSON.stringify(data) : undefined
      });
    }
  }

  protected async recordMetric(metric: string, value: number, tags?: Record<string, string>): Promise<void> {
    if (this.options.enableMetrics) {
      // In a real implementation, this would send to a metrics service like DataDog, Prometheus, etc.
      console.log(`[METRIC] ${this.serviceName}.${metric}`, { value, tags });
    }
  }
}

// Common service errors
export class NotFoundError extends ServiceException {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      404
    );
  }
}

export class ForbiddenError extends ServiceException {
  constructor(message: string = 'Access denied') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends ServiceException {
  constructor(message: string, field?: string) {
    super(
      'VALIDATION_ERROR',
      message,
      400,
      field ? { field } : undefined
    );
  }
}

export class ConflictError extends ServiceException {
  constructor(message: string, resource?: string) {
    super(
      'CONFLICT',
      message,
      409,
      resource ? { resource } : undefined
    );
  }
}

export class RateLimitError extends ServiceException {
  constructor(limit: number, window: string) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded: ${limit} requests per ${window}`,
      429,
      { limit, window },
      true
    );
  }
}

// Export the database connection for services
export { db };
