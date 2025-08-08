import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../shared/errors/app-errors';

/**
 * Enhanced validation middleware that processes express-validator results
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = formatValidationErrors(errors.array());

      logger.warn('Validation failed', {
        url: req.originalUrl,
        method: req.method,
        errors: formattedErrors,
        body: sanitizeRequestData(req.body),
        query: req.query,
        params: req.params,
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Alternative validation middleware for single validation chain
 */
export const validateSingle = (validation: ValidationChain) => {
  return validate([validation]);
};

/**
 * Middleware to handle validation errors in a more detailed format
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = formatValidationErrors(errors.array());
    const groupedErrors = groupErrorsByField(errors.array());

    logger.warn('Detailed validation failed', {
      url: req.originalUrl,
      method: req.method,
      errors: formattedErrors,
      groupedErrors,
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: groupedErrors,
      details: formattedErrors,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Format validation errors into a more user-friendly format
 */
const formatValidationErrors = (errors: any[]): any[] => {
  return errors.map(error => ({
    field: error.type === 'field' ? error.path : error.type,
    message: error.msg,
    value: error.type === 'field' ? error.value : undefined,
    location: error.location,
  }));
};

/**
 * Group errors by field name
 */
const groupErrorsByField = (errors: any[]): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {};

  errors.forEach(error => {
    const field = error.type === 'field' ? error.path : error.type;
    if (!grouped[field]) {
      grouped[field] = [];
    }
    grouped[field].push(error.msg);
  });

  return grouped;
};

/**
 * Sanitize request data for logging (remove sensitive fields)
 */
const sanitizeRequestData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'secret',
    'apiKey',
    'privateKey',
    'accessToken',
    'sessionId',
    'creditCard',
    'ssn',
    'socialSecurityNumber',
  ];

  const sanitized = { ...data };

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

/**
 * Common validation chains
 */

// ID validation
export const validateId = (fieldName: string = 'id') => [
  param(fieldName)
    .isUUID()
    .withMessage(`${fieldName} must be a valid UUID`)
    .notEmpty()
    .withMessage(`${fieldName} is required`),
];

// Email validation
export const validateEmail = (
  fieldName: string = 'email',
  required: boolean = true
) => {
  const chain = body(fieldName)
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail();

  return required
    ? [chain.notEmpty().withMessage('Email is required')]
    : [chain.optional()];
};

// Password validation
export const validatePassword = (
  fieldName: string = 'password',
  required: boolean = true
) => {
  const chain = body(fieldName)
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    );

  return required
    ? [chain.notEmpty().withMessage('Password is required')]
    : [chain.optional()];
};

// Name validation
export const validateName = (fieldName: string, required: boolean = true) => {
  const chain = body(fieldName)
    .isLength({ min: 1, max: 100 })
    .withMessage(`${fieldName} must be between 1 and 100 characters`)
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage(
      `${fieldName} can only contain letters, spaces, hyphens, apostrophes, and periods`
    )
    .trim();

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// Username validation
export const validateUsername = (
  fieldName: string = 'username',
  required: boolean = true
) => {
  const chain = body(fieldName)
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      'Username can only contain letters, numbers, underscores, and hyphens'
    )
    .trim();

  return required
    ? [chain.notEmpty().withMessage('Username is required')]
    : [chain.optional()];
};

// Phone number validation
export const validatePhone = (
  fieldName: string = 'phone',
  required: boolean = false
) => {
  const chain = body(fieldName)
    .isMobilePhone('any')
    .withMessage('Must be a valid phone number');

  return required
    ? [chain.notEmpty().withMessage('Phone number is required')]
    : [chain.optional()];
};

// Date validation
export const validateDate = (fieldName: string, required: boolean = true) => {
  const chain = body(fieldName)
    .isISO8601()
    .withMessage(`${fieldName} must be a valid ISO 8601 date`)
    .toDate();

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// URL validation
export const validateUrl = (fieldName: string, required: boolean = false) => {
  const chain = body(fieldName)
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${fieldName} must be a valid URL`);

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// Enum validation
export const validateEnum = (
  fieldName: string,
  allowedValues: string[],
  required: boolean = true
) => {
  const chain = body(fieldName)
    .isIn(allowedValues)
    .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}`);

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// Array validation
export const validateArray = (
  fieldName: string,
  minLength: number = 0,
  maxLength: number = 100
) => [
  body(fieldName)
    .isArray({ min: minLength, max: maxLength })
    .withMessage(
      `${fieldName} must be an array with ${minLength}-${maxLength} items`
    ),
];

// Pagination validation
export const validatePagination = () => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('sortBy')
    .optional()
    .isString()
    .withMessage('SortBy must be a string')
    .trim(),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage("SortOrder must be 'asc' or 'desc'"),
];

// Search validation
export const validateSearch = () => [
  query('q')
    .optional()
    .isString()
    .withMessage('Search query must be a string')
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .trim(),
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .trim(),
];

// File upload validation
export const validateFileUpload = (fieldName: string = 'file') => [
  body(fieldName).custom((value, { req }) => {
    const file = (req as any).file || (req as any).files?.[fieldName];
    if (!file) {
      throw new Error('File is required');
    }
    return true;
  }),
];

// JSON validation
export const validateJson = (fieldName: string, required: boolean = true) => {
  const chain = body(fieldName).custom(value => {
    try {
      if (typeof value === 'string') {
        JSON.parse(value);
      } else if (typeof value === 'object') {
        JSON.stringify(value);
      } else {
        throw new Error('Invalid JSON');
      }
      return true;
    } catch (error) {
      throw new Error(`${fieldName} must be valid JSON`);
    }
  });

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// Color validation (hex)
export const validateColor = (fieldName: string, required: boolean = false) => {
  const chain = body(fieldName)
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage(`${fieldName} must be a valid hex color`);

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// Priority validation
export const validatePriority = (
  fieldName: string = 'priority',
  required: boolean = false
) => {
  const priorities = ['low', 'medium', 'high', 'urgent'];
  return validateEnum(fieldName, priorities, required);
};

// Status validation
export const validateStatus = (
  fieldName: string = 'status',
  allowedStatuses: string[],
  required: boolean = true
) => {
  return validateEnum(fieldName, allowedStatuses, required);
};

// Text content validation
export const validateTextContent = (
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 1000,
  required: boolean = true
) => {
  const chain = body(fieldName)
    .isLength({ min: minLength, max: maxLength })
    .withMessage(
      `${fieldName} must be between ${minLength} and ${maxLength} characters`
    )
    .trim()
    .escape(); // Escape HTML entities

  return required
    ? [chain.notEmpty().withMessage(`${fieldName} is required`)]
    : [chain.optional()];
};

// Tags validation
export const validateTags = (
  fieldName: string = 'tags',
  maxTags: number = 10
) => [
  body(fieldName)
    .optional()
    .isArray({ max: maxTags })
    .withMessage(`Maximum ${maxTags} tags allowed`),
  body(`${fieldName}.*`)
    .isString()
    .withMessage('Each tag must be a string')
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
    .trim(),
];

// Coordinates validation
export const validateCoordinates = (
  latField: string = 'latitude',
  lngField: string = 'longitude'
) => [
  body(latField)
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body(lngField)
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];

// API key validation
export const validateApiKey = () => [
  header('x-api-key')
    .notEmpty()
    .withMessage('API key is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('API key must be between 32 and 64 characters'),
];

// Rate limit validation
export const validateRateLimit = () => [
  header('x-rate-limit-remaining')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Rate limit remaining must be a non-negative integer'),
];

/**
 * Conditional validation - only validate if condition is met
 */
export const validateIf = (
  condition: (req: Request) => boolean,
  validations: ValidationChain[]
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      return validate(validations)(req, res, next);
    }
    next();
  };
};

/**
 * Custom validation middleware for complex business logic
 */
export const customValidation = (
  validator: (req: Request) => Promise<string | null> | string | null
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const error = await validator(req);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'custom', message: error }],
          timestamp: new Date().toISOString(),
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Sanitization middleware
 */
export const sanitizeInput = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        // Basic sanitization
        req.body[field] = req.body[field]
          .trim()
          .replace(/[<>]/g, '') // Remove potential HTML tags
          .substring(0, 10000); // Limit length
      }
    });
    next();
  };
};

/**
 * Validation summary middleware - logs validation statistics
 */
export const validationSummary = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);

    logger.debug('Validation summary', {
      url: req.originalUrl,
      method: req.method,
      hasErrors: !errors.isEmpty(),
      errorCount: errors.array().length,
      fields: Object.keys(req.body || {}),
    });

    next();
  };
};
