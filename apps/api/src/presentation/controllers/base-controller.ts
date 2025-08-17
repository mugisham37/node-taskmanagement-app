import { ValidationError } from '@taskmanagement/validation';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, ZodSchema } from 'zod';
import { LoggingService } from '@taskmanagement/observability';
import { AppError } from '../../shared/errors/app-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { ErrorResponseDto, PaginatedResponseDto, ValidationErrorResponseDto } from '../dto';

export abstract class BaseController {
  constructor(protected readonly logger: LoggingService) {}

  protected async handleRequest<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    handler: () => Promise<T>
  ): Promise<void> {
    try {
      const result = await handler();
      await this.sendSuccess(reply, result);
    } catch (error) {
      await this.handleError(request, reply, error);
    }
  }

  protected validateBody<T>(body: unknown, schema: ZodSchema<T>): T {
    try {
      return schema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          value: (err as any).received,
        }));
        throw new ValidationError(validationErrors, 'Validation failed');
      }
      throw error;
    }
  }

  protected validateQuery<T>(query: unknown, schema: ZodSchema<T>): T {
    try {
      return schema.parse(query);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          value: (err as any).received,
        }));
        throw new ValidationError(validationErrors, 'Query validation failed');
      }
      throw error;
    }
  }

  protected validateParams<T>(params: unknown, schema: ZodSchema<T>): T {
    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          value: (err as any).received,
        }));
        throw new ValidationError(validationErrors, 'Parameter validation failed');
      }
      throw error;
    }
  }

  protected getUserId(request: FastifyRequest): string {
    // Extract user ID from JWT token (set by auth middleware)
    const user = (request as any).user;
    if (!user || !user.id) {
      throw new AuthorizationError('User not authenticated');
    }
    return user.id;
  }

  protected async sendSuccess<T>(
    reply: FastifyReply,
    data: T,
    statusCode: number = 200
  ): Promise<void> {
    await reply.status(statusCode).send(data);
  }

  protected async sendCreated<T>(reply: FastifyReply, data: T): Promise<void> {
    await reply.status(201).send(data);
  }

  protected async sendNoContent(reply: FastifyReply): Promise<void> {
    await reply.status(204).send();
  }

  protected async sendPaginated<T>(
    reply: FastifyReply,
    data: T[],
    total: number,
    page: number,
    limit: number
  ): Promise<void> {
    const response: PaginatedResponseDto<T> = {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
    await reply.send(response);
  }

  private async handleError(
    request: FastifyRequest,
    reply: FastifyReply,
    error: unknown
  ): Promise<void> {
    this.logger.error('Controller error', error as Error, {
      url: request.url,
      method: request.method,
      userId: this.tryGetUserId(request),
    });

    if (error instanceof ValidationError) {
      await this.sendValidationError(reply, error, request.url);
    } else if (error instanceof NotFoundError) {
      await this.sendNotFoundError(reply, error, request.url);
    } else if (error instanceof AuthorizationError) {
      await this.sendAuthorizationError(reply, error, request.url);
    } else if (error instanceof AppError) {
      await this.sendAppError(reply, error, request.url);
    } else {
      await this.sendInternalError(reply, error as Error, request.url);
    }
  }

  private tryGetUserId(request: FastifyRequest): string | undefined {
    try {
      return this.getUserId(request);
    } catch {
      return undefined;
    }
  }

  private async sendValidationError(
    reply: FastifyReply,
    error: ValidationError,
    path: string
  ): Promise<void> {
    const response: ValidationErrorResponseDto = {
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.context,
        timestamp: new Date().toISOString(),
        path,
        validationErrors: error.errors,
      },
    };
    await reply.status(400).send(response);
  }

  private async sendNotFoundError(
    reply: FastifyReply,
    error: NotFoundError,
    path: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'NOT_FOUND',
        message: error.message,
        details: error.context,
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(404).send(response);
  }

  private async sendAuthorizationError(
    reply: FastifyReply,
    error: AuthorizationError,
    path: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: error.message,
        details: error.context,
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(403).send(response);
  }

  private async sendAppError(reply: FastifyReply, error: AppError, path: string): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: error.errorCode || 'APP_ERROR',
        message: error.message,
        details: error.context,
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(error.statusCode || 500).send(response);
  }

  private async sendInternalError(reply: FastifyReply, _error: Error, path: string): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(500).send(response);
  }
}

