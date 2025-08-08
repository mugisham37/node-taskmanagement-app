import { param, query } from 'express-validator';
import {
  validateUuidParam,
  validatePagination,
  validateSort,
} from '../../../shared/utils/common.validator';
import { activityTypeEnum } from '../schemas/activities';

/**
 * Validation rules for getting user activities with filtering and pagination
 */
export const getUserActivities = [
  ...validatePagination,
  validateSort(['createdAt', 'type', 'userId']),
  query('type')
    .optional()
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('task').optional().isUUID().withMessage('Task ID must be a valid UUID'),
  query('project')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),
  query('workspace')
    .optional()
    .isUUID()
    .withMessage('Workspace ID must be a valid UUID'),
  query('team').optional().isUUID().withMessage('Team ID must be a valid UUID'),
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
 * Validation rules for getting team activities with filtering and pagination
 */
export const getTeamActivities = [
  validateUuidParam('teamId', 'Invalid team ID'),
  ...validatePagination,
  validateSort(['createdAt', 'type', 'userId']),
  query('type')
    .optional()
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  query('task').optional().isUUID().withMessage('Task ID must be a valid UUID'),
  query('project')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),
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
 * Validation rules for getting workspace activities with filtering and pagination
 */
export const getWorkspaceActivities = [
  validateUuidParam('workspaceId', 'Invalid workspace ID'),
  ...validatePagination,
  validateSort(['createdAt', 'type', 'userId']),
  query('type')
    .optional()
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  query('task').optional().isUUID().withMessage('Task ID must be a valid UUID'),
  query('project')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),
  query('team').optional().isUUID().withMessage('Team ID must be a valid UUID'),
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
 * Validation rules for getting project activities with filtering and pagination
 */
export const getProjectActivities = [
  validateUuidParam('projectId', 'Invalid project ID'),
  ...validatePagination,
  validateSort(['createdAt', 'type', 'userId']),
  query('type')
    .optional()
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  query('task').optional().isUUID().withMessage('Task ID must be a valid UUID'),
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
 * Validation rules for getting task activities with filtering and pagination
 */
export const getTaskActivities = [
  validateUuidParam('taskId', 'Invalid task ID'),
  ...validatePagination,
  validateSort(['createdAt', 'type', 'userId']),
  query('type')
    .optional()
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
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
 * Validation rules for getting activity by ID
 */
export const getActivityById = [validateUuidParam('id', 'Invalid activity ID')];

/**
 * Validation rules for getting activity statistics
 */
export const getActivityStats = [
  query('type')
    .optional()
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  query('task').optional().isUUID().withMessage('Task ID must be a valid UUID'),
  query('project')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),
  query('workspace')
    .optional()
    .isUUID()
    .withMessage('Workspace ID must be a valid UUID'),
  query('team').optional().isUUID().withMessage('Team ID must be a valid UUID'),
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
    .isIn(['day', 'week', 'month', 'type', 'user'])
    .withMessage('Group by must be one of: day, week, month, type, user'),
];

/**
 * Validation rules for creating activity (admin only)
 */
export const createActivity = [
  query('type')
    .notEmpty()
    .withMessage('Activity type is required')
    .isIn(activityTypeEnum)
    .withMessage(`Type must be one of: ${activityTypeEnum.join(', ')}`),
  query('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
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
  query('data')
    .optional()
    .isObject()
    .withMessage('Data must be a valid JSON object'),
  query('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be a valid JSON object'),
  query('ipAddress').optional().isIP().withMessage('IP address must be valid'),
  query('userAgent')
    .optional()
    .isString()
    .withMessage('User agent must be a string')
    .isLength({ max: 500 })
    .withMessage('User agent must be less than 500 characters'),
];

/**
 * Validation rules for cleanup old activities (admin only)
 */
export const cleanupOldActivities = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
    .toInt(),
];
