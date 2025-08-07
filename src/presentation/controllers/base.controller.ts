import { Request, Response } from 'express';
import { z } from 'zod';
import { ILogger } from '../../shared/interfaces/logger.interface';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '../../shared/errors/app-errors';

export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code: string;
    details?: any;
    correlationId?: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

export abstract class BaseController {
  protected readonly controllerName: string;
  protected readonly logger: ILogger;

  constructor(controllerName: string, logger: ILogger) {
    this.controllerName = controllerName;
    this.logger = logger;
  }

  /**
   * Validate input data against a Zod schema with enhanced error details
   */
  protected validateInput<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context?: string
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received,
        }));

        this.logger.warn(
          `Validation failed in ${this.controllerName}${context ? ` - ${context}` : ''}`,
          {
            errors: validationErrors,
            data,
          }
        );

        throw new ValidationError('Input validation failed', validationErrors);
      }
      throw error;
    }
  }

  /**
   * Extract and validate pagination parameters
   */
  protected extractPaginationParams(req: Request): PaginationParams {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    );
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder =
      (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    return { page, limit, sortBy, sortOrder };
  }

  /**
   * Extract filter parameters from request
   */
  protected extractFilterParams(
    req: Request,
    allowedFilters: string[] = []
  ): FilterParams {
    const filters: FilterParams = {};

    // Common filters
    if (req.query.search) filters.search = req.query.search as string;
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom as string;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo as string;

    // Additional allowed filters
    allowedFilters.forEach(filter => {
      if (req.query[filter]) {
        filters[filter] = req.query[filter];
      }
    });

    return filters;
  }

  /**
   * Handle errors consistently across controllers with correlation ID
   */
  protected handleError(
    res: Response,
    error: any,
    defaultMessage: string = 'An error occurred',
    correlationId?: string
  ): void {
    const errorId = correlationId || this.generateCorrelationId();

    this.logger.error(`${this.controllerName} error:`, {
      error: error.message,
      stack: error.stack,
      correlationId: errorId,
      name: error.name,
    });

    let statusCode = 500;
    let message = defaultMessage;
    let code = 'INTERNAL_ERROR';

    if (error instanceof ValidationError) {
      statusCode = 400;
      message = error.message;
      code = 'VALIDATION_ERROR';
    } else if (error instanceof NotFoundError) {
      statusCode = 404;
      message = error.message;
      code = 'NOT_FOUND';
    } else if (error instanceof UnauthorizedError) {
      statusCode = 401;
      message = error.message;
      code = 'UNAUTHORIZED';
    } else if (error instanceof ForbiddenError) {
      statusCode = 403;
      message = error.message;
      code = 'FORBIDDEN';
    } else if (error.statusCode) {
      statusCode = error.statusCode;
      message = error.message;
      code = error.code || code;
    }

    const response: StandardResponse = {
      success: false,
      error: {
        message,
        code,
        correlationId: errorId,
        details:
          error instanceof ValidationError ? error.validationErrors : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  /**
   * Send standardized success response
   */
  protected sendSuccess<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200,
    meta?: StandardResponse['meta']
  ): void {
    const response: StandardResponse<T> = {
      success: true,
      data,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   */
  protected sendPaginatedResponse<T>(
    res: Response,
    data: T[],
    total: number,
    pagination: PaginationParams,
    message?: string
  ): void {
    const totalPages = Math.ceil(total / (pagination.limit || 10));

    this.sendSuccess(res, data, message, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
    });
  }

  /**
   * Send created response
   */
  protected sendCreated<T>(res: Response, data: T, message?: string): void {
    this.sendSuccess(
      res,
      data,
      message || 'Resource created successfully',
      201
    );
  }

  /**
   * Send no content response
   */
  protected sendNoContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Validate resource ownership or access permissions
   */
  protected async validateResourceAccess(
    userId: string,
    resourceOwnerId: string,
    workspaceId?: string,
    requiredPermission?: string
  ): Promise<void> {
    // Basic ownership check
    if (userId !== resourceOwnerId) {
      // TODO: Implement workspace-based permission checking
      // This would integrate with the authorization service
      throw new ForbiddenError('Access denied to this resource');
    }
  }

  /**
   * Extract user context from request
   */
  protected getUserContext(req: Request): {
    userId: string;
    workspaceId?: string;
    role?: string;
  } {
    const user = (req as any).user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    return {
      userId: user.id,
      workspaceId: user.currentWorkspaceId,
      role: user.role,
    };
  }

  /**
   * Standard CRUD operation handlers that can be overridden
   */
  protected async handleCreate(req: Request, res: Response): Promise<void> {
    throw new Error('Create operation not implemented');
  }

  protected async handleGetById(req: Request, res: Response): Promise<void> {
    throw new Error('Get by ID operation not implemented');
  }

  protected async handleGetAll(req: Request, res: Response): Promise<void> {
    throw new Error('Get all operation not implemented');
  }

  protected async handleUpdate(req: Request, res: Response): Promise<void> {
    throw new Error('Update operation not implemented');
  }

  protected async handleDelete(req: Request, res: Response): Promise<void> {
    throw new Error('Delete operation not implemented');
  }

  /**
   * Bind standard CRUD routes to controller methods
   */
  protected bindCrudRoutes() {
    return {
      create: this.handleCreate.bind(this),
      getById: this.handleGetById.bind(this),
      getAll: this.handleGetAll.bind(this),
      update: this.handleUpdate.bind(this),
      delete: this.handleDelete.bind(this),
    };
  }
}
