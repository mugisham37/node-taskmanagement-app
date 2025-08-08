import { body, param, query } from 'express-validator';
import {
  validateUuidParam,
  validatePagination,
  validateSort,
  validateTextContent,
  validateUuidArray,
} from '../../../shared/validators/common.validator';

/**
 * Validation rules for creating a comment
 */
export const createComment = [
  validateUuidParam('taskId', 'Invalid task ID'),

  validateTextContent('content', 1, 2000, true),

  body('parentId')
    .optional()
    .isUUID()
    .withMessage('Parent ID must be a valid UUID'),

  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array')
    .custom((value: any[]) => {
      if (!Array.isArray(value)) return false;
      return value.every(
        id =>
          typeof id === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
          )
      );
    })
    .withMessage('Each mention must be a valid UUID'),

  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
    .custom(attachments => {
      if (Array.isArray(attachments)) {
        for (const attachment of attachments) {
          if (!attachment.filename || typeof attachment.filename !== 'string') {
            throw new Error('Each attachment must have a valid filename');
          }
          if (!attachment.path || typeof attachment.path !== 'string') {
            throw new Error('Each attachment must have a valid path');
          }
          if (!attachment.mimetype || typeof attachment.mimetype !== 'string') {
            throw new Error('Each attachment must have a valid mimetype');
          }
          if (typeof attachment.size !== 'number' || attachment.size <= 0) {
            throw new Error('Each attachment must have a valid size');
          }
          // Validate file size (max 10MB)
          if (attachment.size > 10 * 1024 * 1024) {
            throw new Error('Attachment size cannot exceed 10MB');
          }
          // Validate allowed file types
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/x-zip-compressed',
          ];
          if (!allowedTypes.includes(attachment.mimetype)) {
            throw new Error(`File type ${attachment.mimetype} is not allowed`);
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for updating a comment
 */
export const updateComment = [
  validateUuidParam('id', 'Invalid comment ID'),

  validateTextContent('content', 1, 2000, true),

  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array')
    .custom((value: any[]) => {
      if (!Array.isArray(value)) return false;
      return value.every(
        id =>
          typeof id === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
          )
      );
    })
    .withMessage('Each mention must be a valid UUID'),

  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
    .custom(attachments => {
      if (Array.isArray(attachments)) {
        for (const attachment of attachments) {
          if (!attachment.filename || typeof attachment.filename !== 'string') {
            throw new Error('Each attachment must have a valid filename');
          }
          if (!attachment.path || typeof attachment.path !== 'string') {
            throw new Error('Each attachment must have a valid path');
          }
          if (!attachment.mimetype || typeof attachment.mimetype !== 'string') {
            throw new Error('Each attachment must have a valid mimetype');
          }
          if (typeof attachment.size !== 'number' || attachment.size <= 0) {
            throw new Error('Each attachment must have a valid size');
          }
          if (attachment.size > 10 * 1024 * 1024) {
            throw new Error('Attachment size cannot exceed 10MB');
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for getting a comment by ID
 */
export const getComment = [validateUuidParam('id', 'Invalid comment ID')];

/**
 * Validation rules for deleting a comment
 */
export const deleteComment = [validateUuidParam('id', 'Invalid comment ID')];

/**
 * Validation rules for getting task comments with pagination
 */
export const getTaskComments = [
  validateUuidParam('taskId', 'Invalid task ID'),
  ...validatePagination,
  validateSort(['createdAt', 'updatedAt', 'authorId']),

  query('includeReplies')
    .optional()
    .isBoolean()
    .withMessage('Include replies must be a boolean')
    .toBoolean(),

  query('authorId')
    .optional()
    .isUUID()
    .withMessage('Author ID must be a valid UUID'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('hasAttachments')
    .optional()
    .isBoolean()
    .withMessage('Has attachments must be a boolean')
    .toBoolean(),

  query('hasMentions')
    .optional()
    .isBoolean()
    .withMessage('Has mentions must be a boolean')
    .toBoolean(),
];

/**
 * Validation rules for getting project comments with pagination
 */
export const getProjectComments = [
  validateUuidParam('projectId', 'Invalid project ID'),
  ...validatePagination,
  validateSort(['createdAt', 'updatedAt', 'authorId']),

  query('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  query('authorId')
    .optional()
    .isUUID()
    .withMessage('Author ID must be a valid UUID'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('hasAttachments')
    .optional()
    .isBoolean()
    .withMessage('Has attachments must be a boolean')
    .toBoolean(),

  query('hasMentions')
    .optional()
    .isBoolean()
    .withMessage('Has mentions must be a boolean')
    .toBoolean(),
];

/**
 * Validation rules for getting all comments with filtering
 */
export const getComments = [
  ...validatePagination,
  validateSort(['createdAt', 'updatedAt', 'authorId', 'taskId']),

  query('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  query('projectId')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),

  query('authorId')
    .optional()
    .isUUID()
    .withMessage('Author ID must be a valid UUID'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('hasAttachments')
    .optional()
    .isBoolean()
    .withMessage('Has attachments must be a boolean')
    .toBoolean(),

  query('hasMentions')
    .optional()
    .isBoolean()
    .withMessage('Has mentions must be a boolean')
    .toBoolean(),

  query('includeReplies')
    .optional()
    .isBoolean()
    .withMessage('Include replies must be a boolean')
    .toBoolean(),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (
        req.query?.startDate &&
        endDate < new Date(req.query.startDate as string)
      ) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

/**
 * Validation rules for adding an attachment to a comment
 */
export const addCommentAttachment = [
  validateUuidParam('id', 'Invalid comment ID'),
  // File validation will be handled by multer middleware and common validators
];

/**
 * Validation rules for removing an attachment from a comment
 */
export const removeCommentAttachment = [
  validateUuidParam('id', 'Invalid comment ID'),
  validateUuidParam('attachmentId', 'Invalid attachment ID'),
];

/**
 * Validation rules for adding a reaction to a comment
 */
export const addCommentReaction = [
  validateUuidParam('id', 'Invalid comment ID'),

  body('emoji')
    .notEmpty()
    .withMessage('Emoji is required')
    .isString()
    .withMessage('Emoji must be a string')
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters')
    .matches(
      /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u
    )
    .withMessage('Invalid emoji format'),
];

/**
 * Validation rules for removing a reaction from a comment
 */
export const removeCommentReaction = [
  validateUuidParam('id', 'Invalid comment ID'),

  param('emoji')
    .notEmpty()
    .withMessage('Emoji is required')
    .isString()
    .withMessage('Emoji must be a string')
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters'),
];

/**
 * Validation rules for getting comment statistics
 */
export const getCommentStats = [
  query('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  query('projectId')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),

  query('authorId')
    .optional()
    .isUUID()
    .withMessage('Author ID must be a valid UUID'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (
        req.query?.startDate &&
        endDate < new Date(req.query.startDate as string)
      ) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month', 'author', 'task'])
    .withMessage('Group by must be one of: day, week, month, author, task'),
];

/**
 * Validation rules for bulk operations on comments
 */
export const bulkDeleteComments = [
  body('commentIds')
    .notEmpty()
    .withMessage('Comment IDs are required')
    .isArray({ min: 1, max: 50 })
    .withMessage('Comment IDs must be an array with 1-50 items')
    .custom(commentIds => {
      for (const id of commentIds) {
        if (
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
          )
        ) {
          throw new Error('Each comment ID must be a valid UUID');
        }
      }
      return true;
    }),
];

/**
 * Validation rules for reporting a comment
 */
export const reportComment = [
  validateUuidParam('id', 'Invalid comment ID'),

  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn(['spam', 'inappropriate', 'harassment', 'misinformation', 'other'])
    .withMessage(
      'Reason must be one of: spam, inappropriate, harassment, misinformation, other'
    ),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),
];

/**
 * Validation rules for pinning/unpinning a comment
 */
export const toggleCommentPin = [
  validateUuidParam('id', 'Invalid comment ID'),

  body('pinned')
    .notEmpty()
    .withMessage('Pinned status is required')
    .isBoolean()
    .withMessage('Pinned must be a boolean'),
];
