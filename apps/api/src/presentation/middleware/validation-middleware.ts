import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../shared/errors/validation-error';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export class ValidationMiddleware {
  constructor(private readonly logger: LoggingService) {}

  validateBody = <T>(schema: ZodSchema<T>) => {
    return async (
      request: FastifyRequest,
      _reply: FastifyReply
    ): Promise<void> => {
      try {
        const validatedBody = schema.parse(request.body);
        (request as any).validatedBody = validatedBody;
      } catch (error) {
        if (error instanceof ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: (err as any).received || undefined,
          }));

          this.logger.warn('Request body validation failed', {
            url: request.url,
            method: request.method,
            validationErrors,
          });

          throw new ValidationError(validationErrors, 'Request body validation failed');
        }
        throw error;
      }
    };
  };

  validateQuery = <T>(schema: ZodSchema<T>) => {
    return async (
      request: FastifyRequest,
      _reply: FastifyReply
    ): Promise<void> => {
      try {
        const validatedQuery = schema.parse(request.query);
        (request as any).validatedQuery = validatedQuery;
      } catch (error) {
        if (error instanceof ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: (err as any).received || undefined,
          }));

          this.logger.warn('Query parameters validation failed', {
            url: request.url,
            method: request.method,
            validationErrors,
          });

          throw new ValidationError(validationErrors, 'Query parameters validation failed');
        }
        throw error;
      }
    };
  };

  validateParams = <T>(schema: ZodSchema<T>) => {
    return async (
      request: FastifyRequest,
      _reply: FastifyReply
    ): Promise<void> => {
      try {
        const validatedParams = schema.parse(request.params);
        (request as any).validatedParams = validatedParams;
      } catch (error) {
        if (error instanceof ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: (err as any).received || undefined,
          }));

          this.logger.warn('Path parameters validation failed', {
            url: request.url,
            method: request.method,
            validationErrors,
          });

          throw new ValidationError(validationErrors, 'Path parameters validation failed');
        }
        throw error;
      }
    };
  };
}

// Extend FastifyRequest to include validated data
declare module 'fastify' {
  interface FastifyRequest {
    validatedBody?: any;
    validatedQuery?: any;
    validatedParams?: any;
  }
}
