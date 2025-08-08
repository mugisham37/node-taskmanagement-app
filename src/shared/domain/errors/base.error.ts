/**
 * Base error class for all application errors
 */
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();
    this.correlationId = correlationId;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      stack: this.stack,
    };
  }
}

/**
 * Domain layer errors
 */
export class DomainError extends BaseError {
  constructor(
    message: string,
    code: string = 'DOMAIN_ERROR',
    correlationId?: string
  ) {
    super(message, code, 400, correlationId);
  }
}

/**
 * Application layer errors
 */
export class ApplicationError extends BaseError {
  constructor(
    message: string,
    code: string = 'APPLICATION_ERROR',
    correlationId?: string
  ) {
    super(message, code, 400, correlationId);
  }
}

/**
 * Infrastructure layer errors
 */
export class InfrastructureError extends BaseError {
  constructor(
    message: string,
    code: string = 'INFRASTRUCTURE_ERROR',
    correlationId?: string
  ) {
    super(message, code, 500, correlationId);
  }
}

/**
 * Presentation layer errors
 */
export class PresentationError extends BaseError {
  constructor(
    message: string,
    code: string = 'PRESENTATION_ERROR',
    correlationId?: string
  ) {
    super(message, code, 400, correlationId);
  }
}
