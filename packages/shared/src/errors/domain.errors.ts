// Domain-specific error classes

import { AppError } from './base.errors';

/**
 * Task-related errors
 */
export class TaskError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'TASK_ERROR', 400, undefined, details);
  }
}

export class TaskNotFoundError extends AppError {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND', 404, undefined, { taskId });
  }
}

export class TaskAssignmentError extends AppError {
  constructor(message: string, taskId: string, userId?: string) {
    super(message, 'TASK_ASSIGNMENT_ERROR', 400, undefined, { taskId, userId });
  }
}

export class TaskStatusTransitionError extends AppError {
  constructor(fromStatus: string, toStatus: string, taskId: string) {
    super(
      `Cannot transition task from ${fromStatus} to ${toStatus}`,
      'TASK_STATUS_TRANSITION_ERROR',
      400,
      undefined,
      { fromStatus, toStatus, taskId }
    );
  }
}

/**
 * Project-related errors
 */
export class ProjectError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'PROJECT_ERROR', 400, undefined, details);
  }
}

export class ProjectNotFoundError extends AppError {
  constructor(projectId: string) {
    super(`Project with ID ${projectId} not found`, 'PROJECT_NOT_FOUND', 404, undefined, { projectId });
  }
}

export class ProjectAccessError extends AppError {
  constructor(projectId: string, userId: string) {
    super(
      `User does not have access to project ${projectId}`,
      'PROJECT_ACCESS_ERROR',
      403,
      undefined,
      { projectId, userId }
    );
  }
}

export class ProjectMembershipError extends AppError {
  constructor(message: string, projectId: string, userId?: string) {
    super(message, 'PROJECT_MEMBERSHIP_ERROR', 400, undefined, { projectId, userId });
  }
}

/**
 * User-related errors
 */
export class UserError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'USER_ERROR', 400, undefined, details);
  }
}

export class UserNotFoundError extends AppError {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`, 'USER_NOT_FOUND', 404, undefined, { identifier });
  }
}

export class UserAlreadyExistsError extends AppError {
  constructor(field: string, value: string) {
    super(`User with ${field} '${value}' already exists`, 'USER_ALREADY_EXISTS', 409, field, { field, value });
  }
}

export class UserInactiveError extends AppError {
  constructor(userId: string) {
    super('User account is inactive', 'USER_INACTIVE', 403, undefined, { userId });
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(userId: string) {
    super('Email address not verified', 'EMAIL_NOT_VERIFIED', 403, undefined, { userId });
  }
}

/**
 * Authentication-related errors
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }
}

export class TokenExpiredError extends AppError {
  constructor(tokenType: string = 'token') {
    super(`${tokenType} has expired`, 'TOKEN_EXPIRED', 401, undefined, { tokenType });
  }
}

export class InvalidTokenError extends AppError {
  constructor(tokenType: string = 'token') {
    super(`Invalid ${tokenType}`, 'INVALID_TOKEN', 401, undefined, { tokenType });
  }
}

export class TwoFactorRequiredError extends AppError {
  constructor() {
    super('Two-factor authentication required', 'TWO_FACTOR_REQUIRED', 401);
  }
}

export class InvalidTwoFactorCodeError extends AppError {
  constructor() {
    super('Invalid two-factor authentication code', 'INVALID_TWO_FACTOR_CODE', 401);
  }
}

/**
 * Permission-related errors
 */
export class InsufficientPermissionsError extends AppError {
  constructor(requiredPermission: string, resource?: string) {
    super(
      `Insufficient permissions: ${requiredPermission}${resource ? ` for ${resource}` : ''}`,
      'INSUFFICIENT_PERMISSIONS',
      403,
      undefined,
      { requiredPermission, resource }
    );
  }
}

export class RoleNotAllowedError extends AppError {
  constructor(role: string, action: string) {
    super(`Role '${role}' is not allowed to perform action: ${action}`, 'ROLE_NOT_ALLOWED', 403, undefined, { role, action });
  }
}

/**
 * File-related errors
 */
export class FileNotFoundError extends AppError {
  constructor(fileName: string) {
    super(`File not found: ${fileName}`, 'FILE_NOT_FOUND', 404, undefined, { fileName });
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxSize: number, actualSize: number) {
    super(
      `File size exceeds maximum allowed size of ${maxSize} bytes`,
      'FILE_TOO_LARGE',
      413,
      undefined,
      { maxSize, actualSize }
    );
  }
}

export class UnsupportedFileTypeError extends AppError {
  constructor(fileType: string, allowedTypes: string[]) {
    super(
      `Unsupported file type: ${fileType}. Allowed types: ${allowedTypes.join(', ')}`,
      'UNSUPPORTED_FILE_TYPE',
      400,
      undefined,
      { fileType, allowedTypes }
    );
  }
}

/**
 * Integration-related errors
 */
export class WebSocketError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WEBSOCKET_ERROR', 500, undefined, details);
  }
}

export class CacheError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CACHE_ERROR', 500, undefined, details);
  }
}

export class EmailServiceError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'EMAIL_SERVICE_ERROR', 500, undefined, details);
  }
}