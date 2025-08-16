import { FastifyReply, FastifyRequest } from 'fastify';
import { z, ZodError, ZodSchema } from 'zod';
// Removed LoggingService import as it will be injected

export interface ValidationOptions {
  sanitize?: boolean;
  stripUnknown?: boolean;
  allowExtraFields?: boolean;
  customValidators?: Record<string, (value: any) => boolean | string>;
}

export class ComprehensiveValidationMiddleware {
  constructor(private readonly logger?: any) {}

  /**
   * Create validation middleware for request body
   */
  validateBody<T>(schema: ZodSchema<T>, options: ValidationOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Pre-validation sanitization
        if (options.sanitize && request.body) {
          request.body = this.sanitizeInput(request.body);
        }

        // Apply custom validators
        if (options.customValidators && request.body) {
          this.applyCustomValidators(request.body, options.customValidators);
        }

        // Validate with Zod schema
        const validatedData = schema.parse(request.body);

        // Replace request body with validated data
        request.body = validatedData;
      } catch (error) {
        return this.handleValidationError(error, reply, 'body');
      }
    };
  }

  /**
   * Create validation middleware for query parameters
   */
  validateQuery<T>(schema: ZodSchema<T>, options: ValidationOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Pre-validation sanitization
        if (options.sanitize && request.query) {
          request.query = this.sanitizeInput(request.query);
        }

        // Apply custom validators
        if (options.customValidators && request.query) {
          this.applyCustomValidators(request.query, options.customValidators);
        }

        // Validate with Zod schema
        const validatedData = schema.parse(request.query);

        // Replace request query with validated data
        request.query = validatedData;
      } catch (error) {
        return this.handleValidationError(error, reply, 'query');
      }
    };
  }

  /**
   * Create validation middleware for route parameters
   */
  validateParams<T>(schema: ZodSchema<T>, options: ValidationOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Pre-validation sanitization
        if (options.sanitize && request.params) {
          request.params = this.sanitizeInput(request.params);
        }

        // Apply custom validators
        if (options.customValidators && request.params) {
          this.applyCustomValidators(request.params, options.customValidators);
        }

        // Validate with Zod schema
        const validatedData = schema.parse(request.params);

        // Replace request params with validated data
        request.params = validatedData;
      } catch (error) {
        return this.handleValidationError(error, reply, 'params');
      }
    };
  }

  /**
   * Create validation middleware for headers
   */
  validateHeaders<T>(schema: ZodSchema<T>, options: ValidationOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Pre-validation sanitization
        if (options.sanitize && request.headers) {
          request.headers = this.sanitizeInput(request.headers);
        }

        // Validate with Zod schema
        const validatedData = schema.parse(request.headers);

        // Replace request headers with validated data
        request.headers = { ...request.headers, ...validatedData };
      } catch (error) {
        return this.handleValidationError(error, reply, 'headers');
      }
    };
  }

  /**
   * Comprehensive validation for all request parts
   */
  validateRequest<
    T extends {
      body?: ZodSchema<any>;
      query?: ZodSchema<any>;
      params?: ZodSchema<any>;
      headers?: ZodSchema<any>;
    },
  >(schemas: T, options: ValidationOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validationResults: any = {};

        // Validate body
        if (schemas.body && request.body) {
          if (options.sanitize) {
            request.body = this.sanitizeInput(request.body);
          }
          validationResults.body = schemas.body.parse(request.body);
          request.body = validationResults.body;
        }

        // Validate query
        if (schemas.query && request.query) {
          if (options.sanitize) {
            request.query = this.sanitizeInput(request.query);
          }
          validationResults.query = schemas.query.parse(request.query);
          request.query = validationResults.query;
        }

        // Validate params
        if (schemas.params && request.params) {
          if (options.sanitize) {
            request.params = this.sanitizeInput(request.params);
          }
          validationResults.params = schemas.params.parse(request.params);
          request.params = validationResults.params;
        }

        // Validate headers
        if (schemas.headers && request.headers) {
          if (options.sanitize) {
            request.headers = this.sanitizeInput(request.headers);
          }
          validationResults.headers = schemas.headers.parse(request.headers);
          request.headers = {
            ...request.headers,
            ...validationResults.headers,
          };
        }

        // Store validation results for later use
        (request as any).validatedData = validationResults;
      } catch (error) {
        return this.handleValidationError(error, reply, 'request');
      }
    };
  }

  /**
   * File upload validation middleware
   */
  validateFileUpload(
    options: {
      maxSize?: number;
      allowedTypes?: string[];
      maxFiles?: number;
      required?: boolean;
    } = {}
  ) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const files = (request as any).files;

        if (options.required && (!files || files.length === 0)) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'File upload is required',
              details: { field: 'files', issue: 'required' },
            },
          });
        }

        if (files && files.length > 0) {
          // Check file count
          if (options.maxFiles && files.length > options.maxFiles) {
            return reply.status(400).send({
              error: {
                code: 'VALIDATION_ERROR',
                message: `Too many files. Maximum allowed: ${options.maxFiles}`,
                details: { field: 'files', issue: 'max_count_exceeded' },
              },
            });
          }

          // Validate each file
          for (const file of files) {
            // Check file size
            if (options.maxSize && file.size > options.maxSize) {
              return reply.status(400).send({
                error: {
                  code: 'VALIDATION_ERROR',
                  message: `File size too large. Maximum allowed: ${options.maxSize} bytes`,
                  details: {
                    field: 'files',
                    issue: 'size_exceeded',
                    filename: file.filename,
                  },
                },
              });
            }

            // Check file type
            if (
              options.allowedTypes &&
              !options.allowedTypes.includes(file.mimetype)
            ) {
              return reply.status(400).send({
                error: {
                  code: 'VALIDATION_ERROR',
                  message: `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
                  details: {
                    field: 'files',
                    issue: 'invalid_type',
                    filename: file.filename,
                  },
                },
              });
            }
          }
        }
      } catch (error) {
        this.logger?.error('File validation error', { error: error.message });
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'File validation failed',
          },
        });
      }
    };
  }

  /**
   * Business rule validation middleware
   */
  validateBusinessRules<T>(
    rules: Array<{
      name: string;
      validator: (
        data: T,
        request: FastifyRequest
      ) => Promise<boolean | string>;
      message?: string;
    }>
  ) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = request.body as T;

        for (const rule of rules) {
          const result = await rule.validator(data, request);

          if (result !== true) {
            const message =
              typeof result === 'string'
                ? result
                : rule.message || `Business rule '${rule.name}' failed`;

            return reply.status(422).send({
              error: {
                code: 'BUSINESS_RULE_VIOLATION',
                message,
                details: { rule: rule.name },
              },
            });
          }
        }
      } catch (error) {
        this.logger?.error('Business rule validation error', {
          error: error.message,
        });
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Business rule validation failed',
          },
        });
      }
    };
  }

  /**
   * Sanitize input data
   */
  private sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Apply custom validators
   */
  private applyCustomValidators(
    data: any,
    validators: Record<string, (value: any) => boolean | string>
  ): void {
    for (const [field, validator] of Object.entries(validators)) {
      if (data[field] !== undefined) {
        const result = validator(data[field]);
        if (result !== true) {
          throw new Error(
            `Custom validation failed for field '${field}': ${result}`
          );
        }
      }
    }
  }

  /**
   * Handle validation errors
   */
  private async handleValidationError(
    error: any,
    reply: FastifyReply,
    source: string
  ): Promise<void> {
    this.logger?.warn('Validation error', {
      source,
      error: error.message,
      issues: error instanceof ZodError ? error.issues : undefined,
    });

    if (error instanceof ZodError) {
      const formattedErrors = error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
        received: issue.received,
      }));

      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed for ${source}`,
          details: formattedErrors,
        },
      });
    }

    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message || `Invalid ${source}`,
      },
    });
  }
}

// Common validation schemas
export const CommonValidationSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // Search
  search: z.object({
    query: z.string().min(1).max(255),
    filters: z.record(z.any()).optional(),
  }),

  // ID parameter
  idParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Bulk operation
  bulkOperation: z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    operation: z.string().min(1),
    data: z.record(z.any()).optional(),
  }),

  // File upload
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimetype: z.string().min(1),
    size: z.number().min(1),
  }),
};

// Custom validators
export const CustomValidators = {
  // Email validation
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) || 'Invalid email format';
  },

  // Password strength
  strongPassword: (value: string) => {
    if (value.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(value))
      return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(value))
      return 'Password must contain at least one lowercase letter';
    if (!/\d/.test(value)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
      return 'Password must contain at least one special character';
    return true;
  },

  // URL validation
  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return 'Invalid URL format';
    }
  },

  // Phone number validation
  phoneNumber: (value: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(value) || 'Invalid phone number format';
  },

  // Slug validation
  slug: (value: string) => {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return (
      slugRegex.test(value) ||
      'Invalid slug format (use lowercase letters, numbers, and hyphens only)'
    );
  },

  // Color hex validation
  hexColor: (value: string) => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(value) || 'Invalid hex color format';
  },

  // JSON validation
  json: (value: string) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return 'Invalid JSON format';
    }
  },
};
