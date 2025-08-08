import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '@/infrastructure/logging/logger';
import { DomainError } from '@/shared/errors/domain-error';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = request.headers['x-correlation-id'] as string || 
                       request.headers['x-request-id'] as string ||
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log the error
  logger.error('Request error occurred', {
    error: error.message,
    stack: error.stack,
    method: request.method,
    url: request.url,
    correlationId,
    statusCode: error.statusCode,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString(),
        correlationId,
        path: request.url,
        method: request.method,
      },
      meta: {
        requestId: correlationId,
        version: '1.0.0',
      },
    });
    return;
  }

  // Handle domain errors
  if (error instanceof DomainError) {
    await reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.context,
        timestamp: error.timestamp.toISOString(),
        correlationId: error.correlationId || correlationId,
        path: request.url,
        method: request.method,
      },
      meta: {
        requestId: correlationId,
        version: '1.0.0',
      },
    });
    return;
  }

  // Handle Fastify validation errors
  if (error.validation) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
        timestamp: new Date().toISOString(),
        correlationId,
        path: request.url,
        method: request.method,
      },
      meta: {
        requestId: correlationId,
        version: '1.0.0',
      },
    });
    return;
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    await reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        timestamp: new Date().toISOString(),
        correlationId,
        path: request.url,
        method: request.method,
      },
      meta: {
        requestId: correlationId,
        version: '1.0.0',
      },
    });
    return;
  }

  // Handle generic HTTP errors
  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;

  await reply.status(statusCode).send({
    success: false,
    error: {
      code: isServerError ? 'INTERNAL_SERVER_ERROR' : 'CLIENT_ERROR',
      message: isServerError 
        ? 'An internal server error occurred' 
        : error.message || 'Bad request',
      timestamp: new Date().toISOString(),
      correlationId,
      path: request.url,
      method: request.method,
    },
    meta: {
      requestId: correlationId,
      version: '1.0.0',
    },
  });
}