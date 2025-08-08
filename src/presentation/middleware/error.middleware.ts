import type { Request, Response, NextFunction } from "express";
import { 
  AppError, 
  isAppError, 
  isOperationalError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError
} from "../utils/app-error";
import logger from "../config/logger";

/**
 * Global error handler middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  // Log the error with context
  logger.error(`${err.name}: ${err.message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
    userAgent: req.get('User-Agent'),
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
  });

  // Handle specific error types
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Drizzle/PostgreSQL errors
  if (err.name === "PostgresError" || err.name === "DrizzleError") {
    const pgError = err as any;
    let message = "Database error";
    let statusCode = 500;

    switch (pgError.code) {
      case "23505": // Unique violation
        message = "Resource already exists";
        statusCode = 409;
        break;
      case "23503": // Foreign key violation
        message = "Referenced resource not found";
        statusCode = 400;
        break;
      case "23502": // Not null violation
        message = "Required field is missing";
        statusCode = 400;
        break;
      case "22001": // String data right truncation
        message = "Data too long for field";
        statusCode = 400;
        break;
      default:
        message = process.env.NODE_ENV === "development" ? pgError.message : "Database error";
    }

    res.status(statusCode).json({
      success: false,
      message,
      code: pgError.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Mongoose validation errors (for compatibility)
  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: formatMongooseValidationError(err),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Mongoose cast errors (invalid IDs)
  if (err.name === "CastError") {
    res.status(400).json({
      success: false,
      message: "Invalid ID format",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Mongoose duplicate key errors
  if (err.name === "MongoError" && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
      field,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      code: "INVALID_TOKEN",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Token expired",
      code: "TOKEN_EXPIRED",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle rate limit errors
  if (err.name === "RateLimitError") {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
      code: "RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle multer errors
  if (err.name === "MulterError") {
    let message = "File upload error";
    let statusCode = 400;

    switch ((err as any).code) {
      case "LIMIT_FILE_SIZE":
        message = "File too large";
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field";
        break;
      case "LIMIT_PART_COUNT":
        message = "Too many parts";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Field name too long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Field value too long";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Too many fields";
        break;
      default:
        message = (err as any).message;
    }

    res.status(statusCode).json({
      success: false,
      message,
      code: (err as any).code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle SyntaxError (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      message: "Invalid JSON format",
      code: "INVALID_JSON",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    res.status(403).json({
      success: false,
      message: "CORS policy violation",
      code: "CORS_ERROR",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Default error response
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  const message = process.env.NODE_ENV === "production" 
    ? "Something went wrong" 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    code: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

/**
 * Format Mongoose validation errors into a more user-friendly format
 */
const formatMongooseValidationError = (err: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (err.errors) {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
  }

  return errors;
};

/**
 * Handle 404 errors for routes that don't exist
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`);
  
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  res.status(404).json({
    success: false,
    message: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Development error handler with detailed stack traces
 */
export const developmentErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error(`Development Error: ${err.name}: ${err.message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      code: err.code,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Production error handler with minimal information exposure
 */
export const productionErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error(`Production Error: ${err.name}: ${err.message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  if (isAppError(err) && isOperationalError(err)) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Don't leak error details in production
  res.status(500).json({
    success: false,
    message: "Something went wrong",
    code: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
  });
};

/**
 * Error handler factory based on environment
 */
export const createErrorHandler = () => {
  return process.env.NODE_ENV === "production" 
    ? productionErrorHandler 
    : developmentErrorHandler;
};
