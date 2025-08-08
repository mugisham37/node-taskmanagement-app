import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
  ServiceUnavailableError,
} from '../../shared/errors/app-errors';
import { ILogger } from '../../shared/interfaces/logger.interface';

export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  operation?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
}

export class EnhancedErrorHandler {
  constructor(private readonly logger: ILogger) {}

  /**
   * Global error handling middleware
   */
  handle() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const context: ErrorContext = {
        correlationId:
          (req as any).correlationId || this.generateCorrelationId(),
        userId: (req as any).user?.id,
        workspaceId: (req as any).user?.currentWorkspaceId,
        operation: `${req.method} ${req.path}`,
        requestId: (req as any).requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };

      // Log the error with context
      this.logError(error, context);

      // Handle specific error types
      if (error instanceof ValidationError) {
        return this.handleValidationError(error, res, context);
      }

      if (error instanceof NotFoundError) {
        return this.handleNotFoundError(error, res, context);
      }

      if (error instanceof UnauthorizedError) {
        return this.handleUnauthorizedError(error, res, context);
      }

      if (error instanceof ForbiddenError) {
        return this.handleForbiddenError(error, res, context);
      }

      if (error instanceof ConflictError) {
        return this.handleConflictError(error, res, context);
      }

      if (error instanceof TooManyRequestsError) {
        return this.handleTooManyRequestsError(error, res, context);
      }

      if (error instanceof ServiceUnavailableError) {
        return this.handleServiceUnavailableError(error, res, context);
      }

      // Handle operational vs programming errors
      if (error instanceof AppError && error.isOperational) {
        return this.handleOperationalError(error, res, context);
      }

      // Handle unexpected errors
      return this.handleUnexpectedError(error, res, context);
    };
  }

  private logError(error: Error, context: ErrorContext): void {
    const logContext = {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };

    if (error instanceof AppError && error.isOperational) {
      this.logger.warn('Operational error occurred', logContext);
    } else {
      this.logger.error('Unexpected error occurred', logContext);
    }
  }

  private handleValidationError(
    error: ValidationError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(400).json({
      success: false,
      error: {
        message: error.message,
        code: 'VALIDATION_ERROR',
        details: error.validationErrors,
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleNotFoundError(
    error: NotFoundError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(404).json({
      success: false,
      error: {
        message: error.message,
        code: 'NOT_FOUND',
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleUnauthorizedError(
    error: UnauthorizedError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(401).json({
      success: false,
      error: {
        message: error.message,
        code: 'UNAUTHORIZED',
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleForbiddenError(
    error: ForbiddenError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(403).json({
      success: false,
      error: {
        message: error.message,
        code: 'FORBIDDEN',
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleConflictError(
    error: ConflictError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(409).json({
      success: false,
      error: {
        message: error.message,
        code: 'CONFLICT',
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleTooManyRequestsError(
    error: TooManyRequestsError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(429).json({
      success: false,
      error: {
        message: error.message,
        code: 'TOO_MANY_REQUESTS',
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleServiceUnavailableError(
    error: ServiceUnavailableError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(503).json({
      success: false,
      error: {
        message: error.message,
        code: 'SERVICE_UNAVAILABLE',
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleOperationalError(
    error: AppError,
    res: Response,
    context: ErrorContext
  ): void {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.name.toUpperCase().replace('ERROR', ''),
        correlationId: context.correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleUnexpectedError(
    error: Error,
    res: Response,
    context: ErrorContext
  ): void {
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      error: {
        message: isDevelopment ? error.message : 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        correlationId: context.correlationId,
        ...(isDevelopment && { stack: error.stack }),
      },
      timestamp: new Date().toISOString(),
    });
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

/**
 * Request timeout handler
 */
export const timeoutHandler = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = new ServiceUnavailableError('Request timeout');
        next(error);
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
};

/**
 * Graceful shutdown handler
 */
export const gracefulShutdownHandler = (server: any) => {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close((err: any) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }

      console.log('Server closed successfully');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

/**
 * Unhandled rejection and exception handlers
 */
export const setupProcessErrorHandlers = (logger: ILogger) => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });

    // Don't exit in production, just log
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });

    // Always exit on uncaught exceptions
    process.exit(1);
  });
};
