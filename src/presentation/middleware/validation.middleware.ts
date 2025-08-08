import { FastifyRequest, FastifyReply } from 'fastify';
import { IValidator } from '../../shared/types/validator.interface';

/**
 * Request validation middleware
 */
export class ValidationMiddleware {
  constructor(private readonly validator: IValidator) {}

  /**
   * Validate request body against schema
   */
  validateBody<T>(schema: any) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const validatedData = await this.validator.validate<T>(
          request.body,
          schema
        );
        (request as any).validatedBody = validatedData;
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error,
            timestamp: new Date().toISOString(),
          },
        });
      }
    };
  }

  /**
   * Validate query parameters against schema
   */
  validateQuery<T>(schema: any) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const validatedData = await this.validator.validate<T>(
          request.query,
          schema
        );
        (request as any).validatedQuery = validatedData;
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed',
            details: error,
            timestamp: new Date().toISOString(),
          },
        });
      }
    };
  }

  /**
   * Validate route parameters against schema
   */
  validateParams<T>(schema: any) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const validatedData = await this.validator.validate<T>(
          request.params,
          schema
        );
        (request as any).validatedParams = validatedData;
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: error,
            timestamp: new Date().toISOString(),
          },
        });
      }
    };
  }
}
