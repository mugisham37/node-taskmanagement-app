import { FastifyReply } from 'fastify';
import { z } from 'zod';
import logger from '../utils/logger';

export abstract class BaseController {
  protected readonly controllerName: string;

  constructor(controllerName: string) {
    this.controllerName = controllerName;
  }

  /**
   * Validate input data against a Zod schema
   */
  protected validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new Error(
          `Validation failed: ${JSON.stringify(validationErrors)}`
        );
      }
      throw error;
    }
  }

  /**
   * Handle errors consistently across controllers
   */
  protected handleError(
    reply: FastifyReply,
    error: any,
    defaultMessage: string = 'An error occurred'
  ): void {
    logger.error(`${this.controllerName} error:`, error);

    let statusCode = 500;
    let message = defaultMessage;

    if (error.message) {
      message = error.message;
    }

    if (error.statusCode) {
      statusCode = error.statusCode;
    } else if (error.message?.includes('Validation failed')) {
      statusCode = 400;
    } else if (error.message?.includes('Authentication required')) {
      statusCode = 401;
    } else if (error.message?.includes('Access denied')) {
      statusCode = 403;
    } else if (error.message?.includes('not found')) {
      statusCode = 404;
    }

    reply.status(statusCode).send({
      success: false,
      error: {
        message,
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Send success response
   */
  protected sendSuccess(
    reply: FastifyReply,
    data: any,
    message?: string,
    statusCode: number = 200
  ): void {
    reply.status(statusCode).send({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
