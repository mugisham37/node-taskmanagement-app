import express from "express"
import { authenticate } from "../middleware/auth"
import * as analyticsController from "../controllers/analytics.controller"

const router = express.Router()

// Apply authentication middleware to all routes
router.use(authenticate())

/**
 * @swagger
 * /analytics/tasks/completion:
 *   get:
 *     summary: Get task completion analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Task completion analytics retrieved successfully
 */
router.get("/tasks/completion", analyticsController.getTaskAnalytics)

/**
 * @swagger
 * /analytics/projects:
 *   get:
 *     summary: Get project analytics
 *     tags: [Analytics]
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
 *     responses:
 *       200:
 *         description: Project analytics retrieved successfully
 */
router.get("/projects", analyticsController.getProjectAnalytics)

/**
 * @swagger
 * /analytics/projects/{id}:
 *   get:
 *     summary: Get specific project analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Specific project analytics retrieved successfully
 */
router.get("/projects/:id", analyticsController.getProjectAnalytics)

/**
 * @swagger
 * /analytics/teams/{id}:
 *   get:
 *     summary: Get team analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Team analytics retrieved successfully
 */
router.get("/teams/:id", analyticsController.getProjectAnalytics)

/**
 * @swagger
 * /analytics/productivity:
 *   get:
 *     summary: Get user productivity analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: User productivity analytics retrieved successfully
 */
router.get("/productivity", analyticsController.getUserProductivityAnalytics)

/**
 * @swagger
 * /analytics/recurring-tasks:
 *   get:
 *     summary: Get recurring task analytics
 *     tags: [Analytics]
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
 *     responses:
 *       200:
 *         description: Recurring task analytics retrieved successfully
 */
router.get("/recurring-tasks", analyticsController.getDashboardAnalytics)

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 */
router.get("/dashboard", analyticsController.getDashboardAnalytics)

export default router
