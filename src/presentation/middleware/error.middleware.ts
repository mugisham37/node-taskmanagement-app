import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ILogger } from '../../shared/types/logger.interface';
import { BaseError } from '../../shared/domain/errors/base.error';

/**
 * Global error handling middleware
 */
export class ErrorMiddleware {
  constructor(private readonly logger: ILogger) {}

  /**
   * Handle all errors and format responses consistently
   */
  handle(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ): void {
    if (error instanceof BaseError) {
      this.handleKnownError(error, request, reply);
    } else {
      this.handleUnknownError(error, request, reply);
    }
  }

  private handleKnownError(
    error: BaseError,
    request: FastifyRequest,
    reply: FastifyReply
  ): void {
    this.logger.warn('Known error occurred', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      url: request.url,
      method: request.method,
    });

    reply.code(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp.toISOString(),
      },
    });
  }

  private handleUnknownError(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ): void {
    this.logger.error('Unknown error occurred', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
