/**
 * Centralized Validation Service
 * Utilizes all validation constants from the constants folder
 */

import {
    ERROR_SEVERITY,
    PROJECT_VALIDATION,
    TASK_VALIDATION,
    USER_VALIDATION,
    VALIDATION_ERROR_CODES,
    WORKSPACE_VALIDATION
} from './constants';
import { ValidationError } from './validation-error';

export interface ServiceValidationResult {
  isValid: boolean;
  errors: ServiceValidationErrorDetail[];
}

export interface ServiceValidationErrorDetail {
  field: string;
  code: string;
  message: string;
  severity: string;
  value?: any;
}

export class ValidationService {
  /**
   * Validate task data using centralized constants
   */
  static validateTask(data: {
    title?: string;
    description?: string;
    estimatedHours?: number;
    actualHours?: number;
  }): ServiceValidationResult {
    const errors: ServiceValidationErrorDetail[] = [];

    // Title validation
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length < TASK_VALIDATION.TITLE_MIN_LENGTH) {
        errors.push({
          field: 'title',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_SHORT,
          message: `Title must be at least ${TASK_VALIDATION.TITLE_MIN_LENGTH} character(s)`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.title,
        });
      }

      if (data.title && data.title.length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
        errors.push({
          field: 'title',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
          message: `Title must not exceed ${TASK_VALIDATION.TITLE_MAX_LENGTH} characters`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.title,
        });
      }
    }

    // Description validation
    if (data.description !== undefined && data.description.length > TASK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
      errors.push({
        field: 'description',
        code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
        message: `Description must not exceed ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
        severity: ERROR_SEVERITY.MEDIUM,
        value: data.description,
      });
    }

    // Estimated hours validation
    if (data.estimatedHours !== undefined) {
      if (data.estimatedHours < TASK_VALIDATION.MIN_ESTIMATED_HOURS) {
        errors.push({
          field: 'estimatedHours',
          code: VALIDATION_ERROR_CODES.VALUE_OUT_OF_RANGE,
          message: `Estimated hours must be at least ${TASK_VALIDATION.MIN_ESTIMATED_HOURS}`,
          severity: ERROR_SEVERITY.MEDIUM,
          value: data.estimatedHours,
        });
      }

      if (data.estimatedHours > TASK_VALIDATION.MAX_ESTIMATED_HOURS) {
        errors.push({
          field: 'estimatedHours',
          code: VALIDATION_ERROR_CODES.VALUE_OUT_OF_RANGE,
          message: `Estimated hours must not exceed ${TASK_VALIDATION.MAX_ESTIMATED_HOURS}`,
          severity: ERROR_SEVERITY.MEDIUM,
          value: data.estimatedHours,
        });
      }
    }

    // Actual hours validation
    if (data.actualHours !== undefined) {
      if (data.actualHours < TASK_VALIDATION.MIN_ACTUAL_HOURS) {
        errors.push({
          field: 'actualHours',
          code: VALIDATION_ERROR_CODES.VALUE_OUT_OF_RANGE,
          message: `Actual hours must be at least ${TASK_VALIDATION.MIN_ACTUAL_HOURS}`,
          severity: ERROR_SEVERITY.MEDIUM,
          value: data.actualHours,
        });
      }

      if (data.actualHours > TASK_VALIDATION.MAX_ACTUAL_HOURS) {
        errors.push({
          field: 'actualHours',
          code: VALIDATION_ERROR_CODES.VALUE_OUT_OF_RANGE,
          message: `Actual hours must not exceed ${TASK_VALIDATION.MAX_ACTUAL_HOURS}`,
          severity: ERROR_SEVERITY.MEDIUM,
          value: data.actualHours,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate project data using centralized constants
   */
  static validateProject(data: {
    name?: string;
    description?: string;
  }): ServiceValidationResult {
    const errors: ServiceValidationErrorDetail[] = [];

    // Name validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < PROJECT_VALIDATION.NAME_MIN_LENGTH) {
        errors.push({
          field: 'name',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_SHORT,
          message: `Project name must be at least ${PROJECT_VALIDATION.NAME_MIN_LENGTH} character(s)`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.name,
        });
      }

      if (data.name && data.name.length > PROJECT_VALIDATION.NAME_MAX_LENGTH) {
        errors.push({
          field: 'name',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
          message: `Project name must not exceed ${PROJECT_VALIDATION.NAME_MAX_LENGTH} characters`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.name,
        });
      }
    }

    // Description validation
    if (data.description !== undefined && data.description.length > PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH) {
      errors.push({
        field: 'description',
        code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
        message: `Project description must not exceed ${PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
        severity: ERROR_SEVERITY.MEDIUM,
        value: data.description,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate user data using centralized constants
   */
  static validateUser(data: {
    name?: string;
    email?: string;
    password?: string;
  }): ServiceValidationResult {
    const errors: ServiceValidationErrorDetail[] = [];

    // Name validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < USER_VALIDATION.NAME_MIN_LENGTH) {
        errors.push({
          field: 'name',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_SHORT,
          message: `Name must be at least ${USER_VALIDATION.NAME_MIN_LENGTH} character(s)`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.name,
        });
      }

      if (data.name && data.name.length > USER_VALIDATION.NAME_MAX_LENGTH) {
        errors.push({
          field: 'name',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
          message: `Name must not exceed ${USER_VALIDATION.NAME_MAX_LENGTH} characters`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.name,
        });
      }
    }

    // Email validation
    if (data.email !== undefined) {
      if (data.email.length > USER_VALIDATION.EMAIL_MAX_LENGTH) {
        errors.push({
          field: 'email',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
          message: `Email must not exceed ${USER_VALIDATION.EMAIL_MAX_LENGTH} characters`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.email,
        });
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push({
          field: 'email',
          code: VALIDATION_ERROR_CODES.INVALID_EMAIL,
          message: 'Invalid email format',
          severity: ERROR_SEVERITY.HIGH,
          value: data.email,
        });
      }
    }

    // Password validation
    if (data.password !== undefined) {
      if (data.password.length < USER_VALIDATION.PASSWORD_MIN_LENGTH) {
        errors.push({
          field: 'password',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_SHORT,
          message: `Password must be at least ${USER_VALIDATION.PASSWORD_MIN_LENGTH} characters`,
          severity: ERROR_SEVERITY.CRITICAL,
          value: '***',
        });
      }

      if (data.password.length > USER_VALIDATION.PASSWORD_MAX_LENGTH) {
        errors.push({
          field: 'password',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
          message: `Password must not exceed ${USER_VALIDATION.PASSWORD_MAX_LENGTH} characters`,
          severity: ERROR_SEVERITY.HIGH,
          value: '***',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate workspace data using centralized constants
   */
  static validateWorkspace(data: {
    name?: string;
    description?: string;
  }): ServiceValidationResult {
    const errors: ServiceValidationErrorDetail[] = [];

    // Name validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < WORKSPACE_VALIDATION.NAME_MIN_LENGTH) {
        errors.push({
          field: 'name',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_SHORT,
          message: `Workspace name must be at least ${WORKSPACE_VALIDATION.NAME_MIN_LENGTH} character(s)`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.name,
        });
      }

      if (data.name && data.name.length > WORKSPACE_VALIDATION.NAME_MAX_LENGTH) {
        errors.push({
          field: 'name',
          code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
          message: `Workspace name must not exceed ${WORKSPACE_VALIDATION.NAME_MAX_LENGTH} characters`,
          severity: ERROR_SEVERITY.HIGH,
          value: data.name,
        });
      }
    }

    // Description validation
    if (data.description !== undefined && data.description.length > WORKSPACE_VALIDATION.DESCRIPTION_MAX_LENGTH) {
      errors.push({
        field: 'description',
        code: VALIDATION_ERROR_CODES.VALUE_TOO_LONG,
        message: `Workspace description must not exceed ${WORKSPACE_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
        severity: ERROR_SEVERITY.MEDIUM,
        value: data.description,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Throw validation error if validation fails
   */
  static validateAndThrow<T>(data: T, validator: (data: T) => ServiceValidationResult): void {
    const result = validator(data);
    if (!result.isValid) {
      // Convert our ServiceValidationErrorDetail to the expected format
      const validationErrors = result.errors.map((error: ServiceValidationErrorDetail) => ({
        field: error.field,
        message: error.message,
        value: error.value,
        constraint: error.code,
      }));

      throw new ValidationError(
        validationErrors,
        'Validation failed',
        {
          errors: result.errors,
          data,
        }
      );
    }
  }

  /**
   * Get all validation constants for reference
   */
  static getValidationConstants() {
    return {
      task: TASK_VALIDATION,
      project: PROJECT_VALIDATION,
      user: USER_VALIDATION,
      workspace: WORKSPACE_VALIDATION,
    };
  }
}
