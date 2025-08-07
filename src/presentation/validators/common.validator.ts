import { param, query, body } from "express-validator";

/**
 * Common validation utilities for reuse across validators
 */

/**
 * UUID validation for parameters
 */
export const validateUuidParam = (paramName: string, message?: string) =>
  param(paramName)
    .isUUID()
    .withMessage(message || `Invalid ${paramName}`);

/**
 * UUID validation for body fields
 */
export const validateUuidBody = (fieldName: string, message?: string) =>
  body(fieldName)
    .optional()
    .isUUID()
    .withMessage(message || `${fieldName} must be a valid UUID`);

/**
 * Pagination validation for query parameters
 */
export const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

/**
 * Sort validation for query parameters
 */
export const validateSort = (allowedFields: string[] = []) =>
  query("sort")
    .optional()
    .isString()
    .withMessage("Sort must be a string")
    .custom((value) => {
      if (allowedFields.length === 0) return true;
      const sortField = value.replace(/^-/, ""); // Remove descending prefix
      return allowedFields.includes(sortField);
    })
    .withMessage(`Sort field must be one of: ${allowedFields.join(", ")}`);

/**
 * Date range validation
 */
export const validateDateRange = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query?.startDate && endDate < new Date(req.query.startDate as string)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];

/**
 * Email validation with normalization
 */
export const validateEmail = (fieldName: string = "email", required: boolean = true) => {
  const validator = body(fieldName);
  
  if (required) {
    validator.notEmpty().withMessage(`${fieldName} is required`);
  } else {
    validator.optional();
  }
  
  return validator
    .isEmail()
    .withMessage(`Invalid ${fieldName} format`)
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    });
};

/**
 * Password validation with strength requirements
 */
export const validatePassword = (fieldName: string = "password", required: boolean = true) => {
  const validator = body(fieldName);
  
  if (required) {
    validator.notEmpty().withMessage(`${fieldName} is required`);
  } else {
    validator.optional();
  }
  
  return validator
    .isLength({ min: 8, max: 128 })
    .withMessage(`${fieldName} must be between 8 and 128 characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      `${fieldName} must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)`
    );
};

/**
 * Text content validation
 */
export const validateTextContent = (
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 2000,
  required: boolean = true
) => {
  const validator = body(fieldName);
  
  if (required) {
    validator.notEmpty().withMessage(`${fieldName} is required`);
  } else {
    validator.optional();
  }
  
  return validator
    .isString()
    .withMessage(`${fieldName} must be a string`)
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`);
};

/**
 * Array of UUIDs validation
 */
export const validateUuidArray = (fieldName: string, required: boolean = false) => {
  const validator = body(fieldName);
  
  if (!required) {
    validator.optional();
  }
  
  return validator
    .isArray()
    .withMessage(`${fieldName} must be an array`)
    .custom((value: any[]) => {
      if (!Array.isArray(value)) return false;
      return value.every((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
    })
    .withMessage(`Each ${fieldName} must be a valid UUID`);
};

/**
 * URL validation
 */
export const validateUrl = (fieldName: string, required: boolean = false) => {
  const validator = body(fieldName);
  
  if (!required) {
    validator.optional();
  } else {
    validator.notEmpty().withMessage(`${fieldName} is required`);
  }
  
  return validator
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage(`${fieldName} must be a valid URL`);
};

/**
 * Hex color validation
 */
export const validateHexColor = (fieldName: string, required: boolean = false) => {
  const validator = body(fieldName);
  
  if (!required) {
    validator.optional();
  } else {
    validator.notEmpty().withMessage(`${fieldName} is required`);
  }
  
  return validator
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage(`${fieldName} must be a valid hex color code (e.g., #4f46e5)`);
};

/**
 * File size validation (in bytes)
 */
export const validateFileSize = (maxSize: number = 5 * 1024 * 1024) => // 5MB default
  body("file")
    .custom((value, { req }) => {
      if (req.file && req.file.size > maxSize) {
        throw new Error(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      }
      return true;
    });

/**
 * MIME type validation
 */
export const validateMimeType = (allowedTypes: string[]) =>
  body("file")
    .custom((value, { req }) => {
      if (req.file && !allowedTypes.includes(req.file.mimetype)) {
        throw new Error(`File type must be one of: ${allowedTypes.join(", ")}`);
      }
      return true;
    });
