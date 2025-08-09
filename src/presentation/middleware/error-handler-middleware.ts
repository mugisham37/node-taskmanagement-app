import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AppError } from '../../shared/errors/app-error';
import { ValidationError } from '../../shared/errors/validation-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { ErrorResponseDto, ValidationErrorResponseDto } from '../dto/error-dto';

export class ErrorHandlerMiddleware {
  constructor(private readonly logger: LoggingService) {}

  handle = async (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const requestId = request.id;
    const userId = this.tryGetUserId(request);

    // Log the error with context
    this.logger.error('Request error', error, {
      requestId,
      userId,
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Handle different error types
    if (error instanceof ValidationError) {
      await this.sendValidationError(reply, error, request.url, requestId);
    } else if (error instanceof NotFoundError) {
      await this.sendNotFoundError(reply, error, request.url, requestId);
    } else if (error instanceof AuthorizationError) {
      await this.sendAuthorizationError(reply, error, request.url, requestId);
    } else if (error instanceof AppError) {
      await this.sendAppError(reply, error, request.url, requestId);
    } else if (error.statusCode === 400) {
      await this.sendBadRequestError(reply, error, request.url, requestId);
    } else if (error.statusCode === 404) {
      await this.sendNotFoundError(
        reply,
        new NotFoundError('Resource not found'),
        request.url,
        requestId
      );
    } else if (error.statusCode === 413) {
      await this.sendPayloadTooLargeError(reply, error, request.url, requestId);
    } else if (error.statusCode === 429) {
      await this.sendRateLimitError(reply, error, request.url, requestId);
    } else {
      await this.sendInternalError(reply, error, request.url, requestId);
    }
  };

  private tryGetUserId(request: FastifyRequest): string | undefined {
    try {
      const user = (request as any).user;
      return user?.id;
    } catch {
      return undefined;
    }
  }

  private async sendValidationError(
    reply: FastifyReply,
    error: ValidationError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ValidationErrorResponseDto = {
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: { ...error.details, requestId },
        timestamp: new Date().toISOString(),
        path,
        validationErrors: error.details?.validationErrors || [],
      },
    };
    await reply.status(400).send(response);
  }

  private async sendNotFoundError(
    reply: FastifyReply,
    error: NotFoundError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'NOT_FOUND',
        message: error.message,
        details: { ...error.details, requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(404).send(response);
  }

  private async sendAuthorizationError(
    reply: FastifyReply,
    error: AuthorizationError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: error.message,
        details: { requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(403).send(response);
  }

  private async sendAppError(
    reply: FastifyReply,
    error: AppError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: error.code || 'APP_ERROR',
        message: error.message,
        details: { ...error.details, requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(error.statusCode || 500).send(response);
  }

  private async sendBadRequestError(
    reply: FastifyReply,
    error: FastifyError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'BAD_REQUEST',
        message: error.message || 'Bad request',
        details: { requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(400).send(response);
  }

  private async sendPayloadTooLargeError(
    reply: FastifyReply,
    error: FastifyError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large',
        details: { requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(413).send(response);
  }

  private async sendRateLimitError(
    reply: FastifyReply,
    error: FastifyError,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: { requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(429).send(response);
  }

  private async sendInternalError(
    reply: FastifyReply,
    error: Error,
    path: string,
    requestId: string
  ): Promise<void> {
    const response: ErrorResponseDto = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: { requestId },
        timestamp: new Date().toISOString(),
        path,
      },
    };
    await reply.status(500).send(response);
  }
}
