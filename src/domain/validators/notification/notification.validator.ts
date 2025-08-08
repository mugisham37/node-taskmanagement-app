import { param, query, body } from 'express-validator';
import {
  validateUuidParam,
  validatePagination,
  validateSort,
} from '../../../shared/validators/common.validator';
import { notificationTypeEnum } from '../schemas/notifications';

/**
 * Validation rules for getting notifications with filtering and pagination
 */
export const getNotifications = [
  ...validatePagination,
  validateSort(['createdAt', 'updatedAt', 'type', 'isRead', 'priority']),

  query('isRead')
    .optional()
    .isBoolean()
    .withMessage('isRead must be a boolean')
    .toBoolean(),

  query('type')
    .optional()
    .isIn(notificationTypeEnum)
    .withMessage(`Type must be one of: ${notificationTypeEnum.join(', ')}`),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),

  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),

  query('taskId')
    .optional()
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),

  query('projectId')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),

  query('teamId')
    .optional()
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),

  query('workspaceId')
    .optional()
    .isUUID()
    .withMessage('Workspace ID must be a valid UUID'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

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
 * Validation rules for getting a notification by ID
 */
export const getNotificationById = [
  validateUuidParam('id', 'Invalid notification ID'),
];

/**
 * Validation rules for marking a notification as read
 */
export const markNotificationAsRead = [
  validateUuidParam('id', 'Invalid notification ID'),
];

/**
 * Validation rules for marking all notifications as read
 */
export const markAllNotificationsAsRead = [
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object')
    .custom(filters => {
      if (filters) {
        const allowedKeys = [
          'type',
          'category',
          'priority',
          'taskId',
          'projectId',
          'teamId',
          'workspaceId',
        ];
        const providedKeys = Object.keys(filters);
        const invalidKeys = providedKeys.filter(
          key => !allowedKeys.includes(key)
        );

        if (invalidKeys.length > 0) {
          throw new Error(`Invalid filter keys: ${invalidKeys.join(', ')}`);
        }

        if (filters.type && !notificationTypeEnum.includes(filters.type)) {
          throw new Error(
            `Type must be one of: ${notificationTypeEnum.join(', ')}`
          );
        }

        if (
          filters.priority &&
          !['low', 'medium', 'high', 'urgent'].includes(filters.priority)
        ) {
          throw new Error('Priority must be one of: low, medium, high, urgent');
        }

        if (
          filters.category &&
          (typeof filters.category !== 'string' || filters.category.length > 50)
        ) {
          throw new Error(
            'Category must be a string with maximum 50 characters'
          );
        }

        // Validate UUID fields
        const uuidFields = ['taskId', 'projectId', 'teamId', 'workspaceId'];
        for (const field of uuidFields) {
          if (
            filters[field] &&
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              filters[field]
            )
          ) {
            throw new Error(`${field} must be a valid UUID`);
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for deleting a notification
 */
export const deleteNotification = [
  validateUuidParam('id', 'Invalid notification ID'),
];

/**
 * Validation rules for creating a notification (Admin only)
 */
export const createNotification = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(notificationTypeEnum)
    .withMessage(`Type must be one of: ${notificationTypeEnum.join(', ')}`),

  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),

  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),

  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object')
    .custom(data => {
      if (data) {
        // Validate common data fields
        const allowedKeys = [
          'taskId',
          'projectId',
          'teamId',
          'workspaceId',
          'url',
          'actionType',
          'metadata',
        ];
        const providedKeys = Object.keys(data);
        const invalidKeys = providedKeys.filter(
          key => !allowedKeys.includes(key)
        );

        if (invalidKeys.length > 0) {
          throw new Error(`Invalid data keys: ${invalidKeys.join(', ')}`);
        }

        // Validate UUID fields in data
        const uuidFields = ['taskId', 'projectId', 'teamId', 'workspaceId'];
        for (const field of uuidFields) {
          if (
            data[field] &&
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              data[field]
            )
          ) {
            throw new Error(`${field} in data must be a valid UUID`);
          }
        }

        if (data.url) {
          try {
            new URL(data.url);
          } catch {
            throw new Error('URL in data must be valid');
          }
        }

        if (data.actionType && typeof data.actionType !== 'string') {
          throw new Error('Action type must be a string');
        }
      }
      return true;
    }),

  body('scheduledFor')
    .optional()
    .isISO8601()
    .withMessage('Scheduled for must be a valid ISO 8601 date')
    .toDate()
    .custom(value => {
      const now = new Date();
      if (value < now) {
        throw new Error('Scheduled for cannot be in the past');
      }
      return true;
    }),

  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date')
    .toDate()
    .custom((value, { req }) => {
      const now = new Date();
      if (value < now) {
        throw new Error('Expiration date cannot be in the past');
      }

      // If scheduledFor is provided, expiresAt must be after it
      if (req.body.scheduledFor) {
        const scheduledDate = new Date(req.body.scheduledFor);
        if (value <= scheduledDate) {
          throw new Error('Expiration date must be after scheduled date');
        }
      }
      return true;
    }),
];

/**
 * Validation rules for creating a system notification (Admin only)
 */
export const createSystemNotification = [
  body('targetUserId')
    .notEmpty()
    .withMessage('Target user ID is required')
    .isUUID()
    .withMessage('Target user ID must be a valid UUID'),

  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),

  body('data').optional().isObject().withMessage('Data must be an object'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
];

/**
 * Validation rules for getting notification statistics
 */
export const getNotificationStats = [
  query('type')
    .optional()
    .isIn(notificationTypeEnum)
    .withMessage(`Type must be one of: ${notificationTypeEnum.join(', ')}`),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),

  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),

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
    .isIn(['day', 'week', 'month', 'type', 'priority', 'category'])
    .withMessage(
      'Group by must be one of: day, week, month, type, priority, category'
    ),
];

/**
 * Validation rules for bulk operations on notifications
 */
export const bulkMarkAsRead = [
  body('notificationIds')
    .notEmpty()
    .withMessage('Notification IDs are required')
    .isArray({ min: 1, max: 100 })
    .withMessage('Notification IDs must be an array with 1-100 items')
    .custom(notificationIds => {
      for (const id of notificationIds) {
        if (
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
          )
        ) {
          throw new Error('Each notification ID must be a valid UUID');
        }
      }
      return true;
    }),
];

/**
 * Validation rules for bulk delete notifications
 */
export const bulkDeleteNotifications = [
  body('notificationIds')
    .notEmpty()
    .withMessage('Notification IDs are required')
    .isArray({ min: 1, max: 100 })
    .withMessage('Notification IDs must be an array with 1-100 items')
    .custom(notificationIds => {
      for (const id of notificationIds) {
        if (
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
          )
        ) {
          throw new Error('Each notification ID must be a valid UUID');
        }
      }
      return true;
    }),

  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object')
    .custom(filters => {
      if (filters) {
        const allowedKeys = [
          'type',
          'category',
          'priority',
          'isRead',
          'olderThan',
        ];
        const providedKeys = Object.keys(filters);
        const invalidKeys = providedKeys.filter(
          key => !allowedKeys.includes(key)
        );

        if (invalidKeys.length > 0) {
          throw new Error(`Invalid filter keys: ${invalidKeys.join(', ')}`);
        }

        if (filters.type && !notificationTypeEnum.includes(filters.type)) {
          throw new Error(
            `Type must be one of: ${notificationTypeEnum.join(', ')}`
          );
        }

        if (
          filters.priority &&
          !['low', 'medium', 'high', 'urgent'].includes(filters.priority)
        ) {
          throw new Error('Priority must be one of: low, medium, high, urgent');
        }

        if (
          filters.isRead !== undefined &&
          typeof filters.isRead !== 'boolean'
        ) {
          throw new Error('isRead must be a boolean');
        }

        if (filters.olderThan) {
          const olderThanDate = new Date(filters.olderThan);
          if (isNaN(olderThanDate.getTime())) {
            throw new Error('olderThan must be a valid date');
          }
        }
      }
      return true;
    }),
];

/**
 * Validation rules for notification preferences
 */
export const updateNotificationPreferences = [
  body('preferences')
    .notEmpty()
    .withMessage('Preferences are required')
    .isObject()
    .withMessage('Preferences must be an object')
    .custom(preferences => {
      const allowedKeys = [
        'email',
        'push',
        'inApp',
        'sms',
        'types',
        'frequency',
        'quietHours',
      ];
      const providedKeys = Object.keys(preferences);
      const invalidKeys = providedKeys.filter(
        key => !allowedKeys.includes(key)
      );

      if (invalidKeys.length > 0) {
        throw new Error(`Invalid preference keys: ${invalidKeys.join(', ')}`);
      }

      // Validate boolean preferences
      const booleanFields = ['email', 'push', 'inApp', 'sms'];
      for (const field of booleanFields) {
        if (
          preferences[field] !== undefined &&
          typeof preferences[field] !== 'boolean'
        ) {
          throw new Error(`${field} must be a boolean`);
        }
      }

      // Validate types array
      if (preferences.types) {
        if (!Array.isArray(preferences.types)) {
          throw new Error('Types must be an array');
        }
        for (const type of preferences.types) {
          if (!notificationTypeEnum.includes(type)) {
            throw new Error(
              `Each type must be one of: ${notificationTypeEnum.join(', ')}`
            );
          }
        }
      }

      // Validate frequency
      if (
        preferences.frequency &&
        !['immediate', 'hourly', 'daily', 'weekly'].includes(
          preferences.frequency
        )
      ) {
        throw new Error(
          'Frequency must be one of: immediate, hourly, daily, weekly'
        );
      }

      // Validate quiet hours
      if (preferences.quietHours) {
        if (typeof preferences.quietHours !== 'object') {
          throw new Error('Quiet hours must be an object');
        }
        if (
          preferences.quietHours.enabled !== undefined &&
          typeof preferences.quietHours.enabled !== 'boolean'
        ) {
          throw new Error('Quiet hours enabled must be a boolean');
        }
        if (
          preferences.quietHours.start &&
          !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(preferences.quietHours.start)
        ) {
          throw new Error('Quiet hours start must be in HH:MM format');
        }
        if (
          preferences.quietHours.end &&
          !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(preferences.quietHours.end)
        ) {
          throw new Error('Quiet hours end must be in HH:MM format');
        }
      }

      return true;
    }),
];
