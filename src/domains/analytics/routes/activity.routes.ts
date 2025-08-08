import express from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import { authenticate } from '../../../shared/middleware/auth';
import { activityValidators } from '../validators';
import * as activityController from '../controllers/activity.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate());

/**
 * @swagger
 * /activities:
 *   get:
 *     summary: Get activities for the authenticated user
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Activities retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/',
  validate(activityValidators.getUserActivities),
  activityController.getUserActivities
);

/**
 * @swagger
 * /activities/{id}:
 *   get:
 *     summary: Get activity by ID
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Activity retrieved successfully
 *       404:
 *         description: Activity not found
 */
router.get(
  '/:id',
  validate(activityValidators.getActivityById),
  activityController.getActivityById
);

/**
 * @swagger
 * /activities/stats:
 *   get:
 *     summary: Get activity statistics
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, type, user]
 *     responses:
 *       200:
 *         description: Activity statistics retrieved successfully
 */
router.get(
  '/stats',
  validate(activityValidators.getActivityStats),
  activityController.getActivityStats
);

/**
 * @swagger
 * /activities:
 *   post:
 *     summary: Create a new activity (Admin only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - userId
 *             properties:
 *               type:
 *                 type: string
 *               userId:
 *                 type: string
 *                 format: uuid
 *               taskId:
 *                 type: string
 *                 format: uuid
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Activity created successfully
 *       403:
 *         description: Only administrators can manually create activities
 */
router.post(
  '/',
  validate(activityValidators.createActivity),
  activityController.createActivity
);

/**
 * @swagger
 * /activities/cleanup:
 *   delete:
 *     summary: Cleanup old activities (Admin only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *     responses:
 *       200:
 *         description: Old activities cleaned up successfully
 *       403:
 *         description: Only administrators can cleanup old activities
 */
router.delete(
  '/cleanup',
  validate(activityValidators.cleanupOldActivities),
  activityController.cleanupOldActivities
);

export default router;
