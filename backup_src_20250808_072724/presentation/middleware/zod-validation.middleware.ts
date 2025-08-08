import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../shared/errors/app-errors';

export interface ValidationOptions {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
  headers?: z.ZodSchema;
  files?: z.ZodSchema;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Enhanced validation middleware with comprehensive error handling
 */
export const validate = (options: ValidationOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationErrors: any[] = [];

      // Validate request body
      if (options.body) {
        try {
          req.body = options.body.parse(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.push(
              ...error.errors.map(err => ({
                field: `body.${err.path.join('.')}`,
                message: err.message,
                code: err.code,
                received: err.received,
                location: 'body',
              }))
            );
          }
        }
      }

      // Validate request parameters
      if (options.params) {
        try {
          req.params = options.params.parse(req.params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.push(
              ...error.errors.map(err => ({
                field: `params.${err.path.join('.')}`,
                message: err.message,
                code: err.code,
                received: err.received,
                location: 'params',
              }))
            );
          }
        }
      }

      // Validate query parameters
      if (options.query) {
        try {
          req.query = options.query.parse(req.query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.push(
              ...error.errors.map(err => ({
                field: `query.${err.path.join('.')}`,
                message: err.message,
                code: err.code,
                received: err.received,
                location: 'query',
              }))
            );
          }
        }
      }

      // Validate headers
      if (options.headers) {
        try {
          req.headers = options.headers.parse(req.headers);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.push(
              ...error.errors.map(err => ({
                field: `headers.${err.path.join('.')}`,
                message: err.message,
                code: err.code,
                received: err.received,
                location: 'headers',
              }))
            );
          }
        }
      }

      // Validate files
      if (options.files && req.files) {
        try {
          req.files = options.files.parse(req.files);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.push(
              ...error.errors.map(err => ({
                field: `files.${err.path.join('.')}`,
                message: err.message,
                code: err.code,
                received: err.received,
                location: 'files',
              }))
            );
          }
        }
      }

      // If there are validation errors, throw ValidationError
      if (validationErrors.length > 0) {
        throw new ValidationError(
          'Request validation failed',
          validationErrors
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate request body only
 */
export const validateBody = (schema: z.ZodSchema) => validate({ body: schema });

/**
 * Validate request parameters only
 */
export const validateParams = (schema: z.ZodSchema) =>
  validate({ params: schema });

/**
 * Validate query parameters only
 */
export const validateQuery = (schema: z.ZodSchema) =>
  validate({ query: schema });

/**
 * Validate headers only
 */
export const validateHeaders = (schema: z.ZodSchema) =>
  validate({ headers: schema });

/**
 * Validate file uploads only
 */
export const validateFiles = (schema: z.ZodSchema) =>
  validate({ files: schema });

/**
 * Create validation middleware for CRUD operations
 */
export const createCrudValidation = (schemas: {
  create?: z.ZodSchema;
  update?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) => ({
  create: schemas.create
    ? validate({
        body: schemas.create,
        params: schemas.params,
      })
    : undefined,

  update: schemas.update
    ? validate({
        body: schemas.update,
        params: schemas.params,
      })
    : undefined,

  getAll: schemas.query
    ? validate({
        query: schemas.query,
      })
    : undefined,

  getById: schemas.params
    ? validate({
        params: schemas.params,
      })
    : undefined,

  delete: schemas.params
    ? validate({
        params: schemas.params,
      })
    : undefined,
});

/**
 * Sanitize input data by removing potentially dangerous content
 */
export const sanitizeInput = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Remove potentially dangerous keys
        if (
          key.startsWith('__') ||
          key.includes('prototype') ||
          key.includes('constructor')
        ) {
          continue;
        }

        if (typeof value === 'string') {
          // Basic XSS prevention
          sanitized[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        } else {
          sanitized[key] = sanitizeObject(value);
        }
      }
      return sanitized;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  };
};

/**
 * Content type validation
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.headers['content-type'];
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Content-Type header is required',
          code: 'MISSING_CONTENT_TYPE',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const isAllowed = allowedTypes.some(type =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isAllowed) {
      return res.status(415).json({
        success: false,
        error: {
          message: `Unsupported content type. Allowed types: ${allowedTypes.join(', ')}`,
          code: 'UNSUPPORTED_CONTENT_TYPE',
        },
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};
