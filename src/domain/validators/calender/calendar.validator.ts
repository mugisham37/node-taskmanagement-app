import { body, param, query } from 'express-validator';
import {
  validateUuidParam,
  validatePagination,
  validateSort,
  validateHexColor,
  validateUrl,
} from '../../../shared/validators/common.validator';
import { eventTypeEnum } from '../schemas/calendar-events';

/**
 * Validation rules for creating a calendar event
 */
export const createCalendarEvent = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot be more than 1000 characters'),

  body('type')
    .optional()
    .isIn(eventTypeEnum)
    .withMessage(`Type must be one of: ${eventTypeEnum.join(', ')}`),

  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate()
    .custom(value => {
      const now = new Date();
      if (value < now) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (endDate && req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),

  body('allDay')
    .optional()
    .isBoolean()
    .withMessage('All day must be a boolean'),

  body('location')
    .optional()
    .isString()
    .withMessage('Location must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Location cannot be more than 500 characters'),

  validateUrl('url', false),
  validateHexColor('color', false),

  body('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  body('projectId')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),

  body('workspaceId')
    .optional()
    .isUUID()
    .withMessage('Workspace ID must be a valid UUID'),

  body('teamId')
    .optional()
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),

  body('isRecurring')
    .optional()
    .isBoolean()
    .withMessage('Is recurring must be a boolean'),

  body('recurrenceRule')
    .optional()
    .isString()
    .withMessage('Recurrence rule must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Recurrence rule cannot be more than 500 characters'),

  body('attendeeIds')
    .optional()
    .isArray()
    .withMessage('Attendee IDs must be an array')
    .custom(attendeeIds => {
      if (Array.isArray(attendeeIds)) {
        for (const id of attendeeIds) {
          if (
            typeof id !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              id
            )
          ) {
            throw new Error('Each attendee ID must be a valid UUID');
          }
        }
      }
      return true;
    }),

  body('reminderMinutes')
    .optional()
    .isArray()
    .withMessage('Reminder minutes must be an array')
    .custom(reminderMinutes => {
      if (Array.isArray(reminderMinutes)) {
        for (const minutes of reminderMinutes) {
          if (typeof minutes !== 'number' || minutes < 0) {
            throw new Error(
              'Each reminder minute must be a non-negative number'
            );
          }
        }
      }
      return true;
    }),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

/**
 * Validation rules for updating a calendar event
 */
export const updateCalendarEvent = [
  validateUuidParam('id', 'Invalid event ID'),

  body('title')
    .optional()
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot be more than 1000 characters'),

  body('type')
    .optional()
    .isIn(eventTypeEnum)
    .withMessage(`Type must be one of: ${eventTypeEnum.join(', ')}`),

  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (endDate && req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),

  body('allDay')
    .optional()
    .isBoolean()
    .withMessage('All day must be a boolean'),

  body('location')
    .optional()
    .isString()
    .withMessage('Location must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Location cannot be more than 500 characters'),

  validateUrl('url', false),
  validateHexColor('color', false),

  body('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  body('projectId')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),

  body('workspaceId')
    .optional()
    .isUUID()
    .withMessage('Workspace ID must be a valid UUID'),

  body('teamId')
    .optional()
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),

  body('isRecurring')
    .optional()
    .isBoolean()
    .withMessage('Is recurring must be a boolean'),

  body('recurrenceRule')
    .optional()
    .isString()
    .withMessage('Recurrence rule must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Recurrence rule cannot be more than 500 characters'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

/**
 * Validation rules for getting a calendar event by ID
 */
export const getCalendarEvent = [validateUuidParam('id', 'Invalid event ID')];

/**
 * Validation rules for deleting a calendar event
 */
export const deleteCalendarEvent = [
  validateUuidParam('id', 'Invalid event ID'),
];

/**
 * Validation rules for getting calendar events with filtering and pagination
 */
export const getCalendarEvents = [
  ...validatePagination,
  validateSort(['startDate', 'endDate', 'title', 'type', 'createdAt']),

  query('type')
    .optional()
    .isIn(eventTypeEnum)
    .withMessage(`Type must be one of: ${eventTypeEnum.join(', ')}`),

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

  query('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  query('projectId')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),

  query('workspaceId')
    .optional()
    .isUUID()
    .withMessage('Workspace ID must be a valid UUID'),

  query('teamId')
    .optional()
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),

  query('allDay')
    .optional()
    .isBoolean()
    .withMessage('All day must be a boolean')
    .toBoolean(),

  query('isRecurring')
    .optional()
    .isBoolean()
    .withMessage('Is recurring must be a boolean')
    .toBoolean(),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
];

/**
 * Validation rules for getting calendar event statistics
 */
export const getCalendarEventStats = [
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
 * Validation rules for processing event reminders
 * This endpoint typically doesn't require body validation as it's a trigger operation
 */
export const processEventReminders = [
  // No specific validation needed for this endpoint as it's a system operation
  // Could add admin role validation here if needed
];
