import { body, param, query } from "express-validator";
import { validateUuidParam, validatePagination, validateSort, validateTextContent, validateUrl } from "./common.validator";
import { feedbackTypeEnum, feedbackStatusEnum, feedbackPriorityEnum } from "../db/schema/feedback";

/**
 * Validation rules for creating feedback
 */
export const createFeedback = [
  body("type")
    .notEmpty()
    .withMessage("Feedback type is required")
    .isIn(feedbackTypeEnum)
    .withMessage(`Type must be one of: ${feedbackTypeEnum.join(", ")}`),

  validateTextContent("title", 5, 200, true),
  validateTextContent("description", 10, 2000, true),

  body("priority")
    .optional()
    .isIn(feedbackPriorityEnum)
    .withMessage(`Priority must be one of: ${feedbackPriorityEnum.join(", ")}`),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Category can only contain letters, numbers, spaces, hyphens, and underscores"),

  body("screenshots")
    .optional()
    .isArray()
    .withMessage("Screenshots must be an array")
    .custom((screenshots) => {
      if (Array.isArray(screenshots)) {
        if (screenshots.length > 5) {
          throw new Error("Maximum 5 screenshots allowed");
        }
        for (const screenshot of screenshots) {
          if (typeof screenshot !== "string") {
            throw new Error("Each screenshot must be a string URL");
          }
          try {
            new URL(screenshot);
          } catch {
            throw new Error("Each screenshot must be a valid URL");
          }
        }
      }
      return true;
    }),

  body("attachments")
    .optional()
    .isArray()
    .withMessage("Attachments must be an array")
    .custom((attachments) => {
      if (Array.isArray(attachments)) {
        if (attachments.length > 3) {
          throw new Error("Maximum 3 attachments allowed");
        }
        for (const attachment of attachments) {
          if (!attachment.filename || typeof attachment.filename !== "string") {
            throw new Error("Each attachment must have a valid filename");
          }
          if (!attachment.path || typeof attachment.path !== "string") {
            throw new Error("Each attachment must have a valid path");
          }
          if (!attachment.mimetype || typeof attachment.mimetype !== "string") {
            throw new Error("Each attachment must have a valid mimetype");
          }
          if (typeof attachment.size !== "number" || attachment.size <= 0) {
            throw new Error("Each attachment must have a valid size");
          }
          // Validate file size (max 25MB)
          if (attachment.size > 25 * 1024 * 1024) {
            throw new Error("Attachment size cannot exceed 25MB");
          }
          // Validate allowed file types for feedback
          const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'text/plain', 'text/csv',
            'application/json', 'text/html',
            'application/zip', 'application/x-zip-compressed',
            'video/mp4', 'video/webm', 'video/quicktime'
          ];
          if (!allowedTypes.includes(attachment.mimetype)) {
            throw new Error(`File type ${attachment.mimetype} is not allowed for feedback`);
          }
        }
      }
      return true;
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object")
    .custom((metadata) => {
      if (metadata) {
        const allowedKeys = ["browser", "os", "device", "url", "userAgent", "viewport"];
        const providedKeys = Object.keys(metadata);
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key));
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid metadata keys: ${invalidKeys.join(", ")}`);
        }

        if (metadata.browser && typeof metadata.browser !== "string") {
          throw new Error("Browser must be a string");
        }

        if (metadata.os && typeof metadata.os !== "string") {
          throw new Error("OS must be a string");
        }

        if (metadata.device && typeof metadata.device !== "string") {
          throw new Error("Device must be a string");
        }

        if (metadata.url) {
          try {
            new URL(metadata.url);
          } catch {
            throw new Error("URL in metadata must be valid");
          }
        }

        if (metadata.userAgent && typeof metadata.userAgent !== "string") {
          throw new Error("User agent must be a string");
        }

        if (metadata.viewport) {
          if (typeof metadata.viewport !== "object" || 
              typeof metadata.viewport.width !== "number" || 
              typeof metadata.viewport.height !== "number") {
            throw new Error("Viewport must be an object with width and height numbers");
          }
        }
      }
      return true;
    }),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error("Maximum 10 tags allowed");
        }
        for (const tag of tags) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string");
          }
          if (tag.length > 30) {
            throw new Error("Each tag must be 30 characters or less");
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for updating feedback (user)
 */
export const updateFeedback = [
  validateUuidParam("id", "Invalid feedback ID"),

  body("type")
    .optional()
    .isIn(feedbackTypeEnum)
    .withMessage(`Type must be one of: ${feedbackTypeEnum.join(", ")}`),

  validateTextContent("title", 5, 200, false),
  validateTextContent("description", 10, 2000, false),

  body("priority")
    .optional()
    .isIn(feedbackPriorityEnum)
    .withMessage(`Priority must be one of: ${feedbackPriorityEnum.join(", ")}`),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

  body("screenshots")
    .optional()
    .isArray()
    .withMessage("Screenshots must be an array")
    .custom((screenshots) => {
      if (Array.isArray(screenshots)) {
        if (screenshots.length > 5) {
          throw new Error("Maximum 5 screenshots allowed");
        }
        for (const screenshot of screenshots) {
          if (typeof screenshot !== "string") {
            throw new Error("Each screenshot must be a string URL");
          }
          try {
            new URL(screenshot);
          } catch {
            throw new Error("Each screenshot must be a valid URL");
          }
        }
      }
      return true;
    }),

  body("attachments")
    .optional()
    .isArray()
    .withMessage("Attachments must be an array")
    .custom((attachments) => {
      if (Array.isArray(attachments)) {
        if (attachments.length > 3) {
          throw new Error("Maximum 3 attachments allowed");
        }
        for (const attachment of attachments) {
          if (!attachment.filename || typeof attachment.filename !== "string") {
            throw new Error("Each attachment must have a valid filename");
          }
          if (!attachment.path || typeof attachment.path !== "string") {
            throw new Error("Each attachment must have a valid path");
          }
          if (!attachment.mimetype || typeof attachment.mimetype !== "string") {
            throw new Error("Each attachment must have a valid mimetype");
          }
          if (typeof attachment.size !== "number" || attachment.size <= 0) {
            throw new Error("Each attachment must have a valid size");
          }
          if (attachment.size > 25 * 1024 * 1024) {
            throw new Error("Attachment size cannot exceed 25MB");
          }
        }
      }
      return true;
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error("Maximum 10 tags allowed");
        }
        for (const tag of tags) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string");
          }
          if (tag.length > 30) {
            throw new Error("Each tag must be 30 characters or less");
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for admin updating feedback
 */
export const adminUpdateFeedback = [
  validateUuidParam("id", "Invalid feedback ID"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(feedbackStatusEnum)
    .withMessage(`Status must be one of: ${feedbackStatusEnum.join(", ")}`),

  body("priority")
    .optional()
    .isIn(feedbackPriorityEnum)
    .withMessage(`Priority must be one of: ${feedbackPriorityEnum.join(", ")}`),

  validateTextContent("adminResponse", 5, 2000, false),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error("Maximum 10 tags allowed");
        }
        for (const tag of tags) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string");
          }
          if (tag.length > 30) {
            throw new Error("Each tag must be 30 characters or less");
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for getting feedback with filtering and pagination
 */
export const getFeedbacks = [
  ...validatePagination,
  validateSort(["createdAt", "updatedAt", "priority", "status", "type", "title"]),

  query("type")
    .optional()
    .isIn(feedbackTypeEnum)
    .withMessage(`Type must be one of: ${feedbackTypeEnum.join(", ")}`),

  query("status")
    .optional()
    .isIn(feedbackStatusEnum)
    .withMessage(`Status must be one of: ${feedbackStatusEnum.join(", ")}`),

  query("priority")
    .optional()
    .isIn(feedbackPriorityEnum)
    .withMessage(`Priority must be one of: ${feedbackPriorityEnum.join(", ")}`),

  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

  query("userId")
    .optional()
    .isUUID()
    .withMessage("User ID must be a valid UUID"),

  query("adminUserId")
    .optional()
    .isUUID()
    .withMessage("Admin user ID must be a valid UUID"),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("hasScreenshots")
    .optional()
    .isBoolean()
    .withMessage("Has screenshots must be a boolean")
    .toBoolean(),

  query("hasAttachments")
    .optional()
    .isBoolean()
    .withMessage("Has attachments must be a boolean")
    .toBoolean(),

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

  query("tags")
    .optional()
    .isString()
    .withMessage("Tags filter must be a string")
    .custom((value) => {
      // Allow comma-separated tags
      const tags = value.split(',').map((tag: string) => tag.trim());
      for (const tag of tags) {
        if (tag.length === 0 || tag.length > 30) {
          throw new Error("Each tag must be between 1 and 30 characters");
        }
      }
      return true;
    }),
];

/**
 * Validation rules for getting feedback by ID
 */
export const getFeedback = [
  validateUuidParam("id", "Invalid feedback ID"),
];

/**
 * Validation rules for deleting feedback
 */
export const deleteFeedback = [
  validateUuidParam("id", "Invalid feedback ID"),
];

/**
 * Validation rules for voting on feedback
 */
export const voteFeedback = [
  validateUuidParam("id", "Invalid feedback ID"),
  
  body("vote")
    .notEmpty()
    .withMessage("Vote is required")
    .isIn(["up", "down", "remove"])
    .withMessage("Vote must be one of: up, down, remove"),
];

/**
 * Validation rules for getting feedback statistics
 */
export const getFeedbackStats = [
  query("type")
    .optional()
    .isIn(feedbackTypeEnum)
    .withMessage(`Type must be one of: ${feedbackTypeEnum.join(", ")}`),

  query("status")
    .optional()
    .isIn(feedbackStatusEnum)
    .withMessage(`Status must be one of: ${feedbackStatusEnum.join(", ")}`),

  query("priority")
    .optional()
    .isIn(feedbackPriorityEnum)
    .withMessage(`Priority must be one of: ${feedbackPriorityEnum.join(", ")}`),

  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

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

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "type", "status", "priority", "category"])
    .withMessage("Group by must be one of: day, week, month, type, status, priority, category"),
];

/**
 * Validation rules for bulk operations on feedback
 */
export const bulkUpdateFeedback = [
  body("feedbackIds")
    .notEmpty()
    .withMessage("Feedback IDs are required")
    .isArray({ min: 1, max: 50 })
    .withMessage("Feedback IDs must be an array with 1-50 items")
    .custom((feedbackIds) => {
      for (const id of feedbackIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each feedback ID must be a valid UUID");
        }
      }
      return true;
    }),

  body("updates")
    .notEmpty()
    .withMessage("Updates are required")
    .isObject()
    .withMessage("Updates must be an object")
    .custom((updates) => {
      const allowedFields = ["status", "priority", "category", "tags"];
      const providedFields = Object.keys(updates);
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        throw new Error(`Invalid update fields: ${invalidFields.join(", ")}`);
      }

      if (updates.status && !feedbackStatusEnum.includes(updates.status)) {
        throw new Error(`Status must be one of: ${feedbackStatusEnum.join(", ")}`);
      }

      if (updates.priority && !feedbackPriorityEnum.includes(updates.priority)) {
        throw new Error(`Priority must be one of: ${feedbackPriorityEnum.join(", ")}`);
      }

      if (updates.category && (typeof updates.category !== "string" || updates.category.length > 50)) {
        throw new Error("Category must be a string with maximum 50 characters");
      }

      if (updates.tags && (!Array.isArray(updates.tags) || updates.tags.length > 10)) {
        throw new Error("Tags must be an array with maximum 10 items");
      }

      return true;
    }),
];
