import { FastifyRequest, FastifyReply } from 'fastify';
import { ILogger } from '../../shared/types/logger.interface';
import { IValidator } from '../../shared/types/validator.interface';

/**
 * Base controller providing common functionality for all controllers
 */
export abstract class BaseController {
  protected readonly logger: ILogger;
  protected readonly validator: IValidator;

  constructor(logger: ILogger, validator: IValidator) {
    this.logger = logger;
    this.validator = validator;
  }

  /**
   * Handle request with common error handling and response formatting
   */
  protected async handleRequest<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    handler: () => Promise<T>
  ): Promise<void> {
    try {
      const result = await handler();
      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Request failed', {
        error,
        url: request.url,
        method: request.method,
      });
      return this.handleError(reply, error as Error);
    }
  }

  /**
   * Handle errors with appropriate HTTP status codes
   */
  protected abstract handleError(reply: FastifyReply, error: Error): void;
}
