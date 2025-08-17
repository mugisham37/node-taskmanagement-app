import { AppError } from './app-error';

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(
    resource: string,
    identifier?: string | number,
    context?: Record<string, any>
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' was not found`
      : `${resource} was not found`;

    super(message, 'NOT_FOUND', { resource, identifier, ...context });
  }

  /**
   * Create a not found error for an entity by ID
   */
  static forEntity(
    entityName: string,
    id: string | number,
    context?: Record<string, any>
  ): NotFoundError {
    return new NotFoundError(entityName, id, context);
  }

  /**
   * Create a not found error for a resource without specific identifier
   */
  static forResource(
    resourceName: string,
    context?: Record<string, any>
  ): NotFoundError {
    return new NotFoundError(resourceName, undefined, context);
  }
}

/**
 * Error thrown when a user is not found
 */
export class UserNotFoundError extends NotFoundError {
  constructor(identifier: string | number, context?: Record<string, any>) {
    super('User', identifier, context);
  }
}

/**
 * Error thrown when a task is not found
 */
export class TaskNotFoundError extends NotFoundError {
  constructor(identifier: string | number, context?: Record<string, any>) {
    super('Task', identifier, context);
  }
}

/**
 * Error thrown when a project is not found
 */
export class ProjectNotFoundError extends NotFoundError {
  constructor(identifier: string | number, context?: Record<string, any>) {
    super('Project', identifier, context);
  }
}

/**
 * Error thrown when a workspace is not found
 */
export class WorkspaceNotFoundError extends NotFoundError {
  constructor(identifier: string | number, context?: Record<string, any>) {
    super('Workspace', identifier, context);
  }
}

