export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  received?: any;
}

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly validationErrors: ValidationErrorDetail[]
  ) {
    super(message);
  }
}

export class DomainError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly isOperational = true;
}

export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;
}

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly isOperational = true;
}

export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly isOperational = true;
}
