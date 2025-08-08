import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../../../shared/middleware/auth';
import { authorize } from '../../../shared/middleware/auth';

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticate());
router.use(authorize(['admin']));

/**
 * @swagger
 * /api/v1/dashboard/system-overview:
 *   get:
 *     summary: Get system overview
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System overview retrieved successfully
 */
router.get('/system-overview', dashboardController.getSystemOverview);

/**
 * @swagger
 * /api/v1/dashboard/user-activity:
 *   get:
 *     summary: Get user activity
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: User activity retrieved successfully
 */
router.get('/user-activity', dashboardController.getUserActivity);

/**
 * @swagger
 * /api/v1/dashboard/task-statistics:
 *   get:
 *     summary: Get task statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: Task statistics retrieved successfully
 */
router.get('/task-statistics', dashboardController.getTaskStatistics);

/**
 * @swagger
 * /api/v1/dashboard/project-statistics:
 *   get:
 *     summary: Get project statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: Project statistics retrieved successfully
 */
router.get('/project-statistics', dashboardController.getProjectStatistics);

/**
 * @swagger
 * /api/v1/dashboard/team-workspace-statistics:
 *   get:
 *     summary: Get team and workspace statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team and workspace statistics retrieved successfully
 */
router.get(
  '/team-workspace-statistics',
  dashboardController.getTeamWorkspaceStatistics
);

/**
 * @swagger
 * /api/v1/dashboard/invalidate-cache:
 *   post:
 *     summary: Invalidate dashboard cache
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 description: Cache key to invalidate (optional, invalidates all dashboard cache if not provided)
 *     responses:
 *       200:
 *         description: Dashboard cache invalidated successfully
 */
router.post('/invalidate-cache', dashboardController.invalidateDashboardCache);

export default router;
