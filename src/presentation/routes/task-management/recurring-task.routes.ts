import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import * as recurringTaskController from "../controllers/recurring-task.controller"
import { recurringTaskValidators } from "../validators"

const router = express.Router()

// Apply authentication middleware to all routes
router.use(authenticate())

/**
 * @swagger
 * /recurring-tasks:
 *   post:
 *     summary: Create a new recurring task
 *     tags: [Recurring Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - frequency
 *               - startDate
 *               - taskTemplate
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               project:
 *                 type: string
 *                 format: uuid
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly, yearly]
 *               interval:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *               daysOfWeek:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *               daysOfMonth:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 31
 *               monthsOfYear:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 11
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               active:
 *                 type: boolean
 *                 default: true
 *               taskTemplate:
 *                 type: object
 *                 required:
 *                   - title
 *                 properties:
 *                   title:
 *                     type: string
 *                     maxLength: 100
 *                   description:
 *                     type: string
 *                     maxLength: 1000
 *                   priority:
 *                     type: string
 *                     enum: [low, medium, high, urgent]
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                   estimatedHours:
 *                     type: number
 *                     minimum: 0
 *                   attachments:
 *                     type: array
 *                     items:
 *                       type: object
 *               workspace:
 *                 type: string
 *                 format: uuid
 *               team:
 *                 type: string
 *                 format: uuid
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Recurring task created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post("/", validate(recurringTaskValidators.createRecurringTask), recurringTaskController.createRecurringTask)

/**
 * @swagger
 * /recurring-tasks:
 *   get:
 *     summary: Get all recurring tasks for the authenticated user
 *     tags: [Recurring Tasks]
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
 *         name: frequency
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: workspace
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: team
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: startDateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: hasEndDate
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Recurring tasks retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/", validate(recurringTaskValidators.getRecurringTasks), recurringTaskController.getRecurringTasks)

/**
 * @swagger
 * /recurring-tasks/{id}:
 *   get:
 *     summary: Get a recurring task by ID
 *     tags: [Recurring Tasks]
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
 *         description: Recurring task retrieved successfully
 *       404:
 *         description: Recurring task not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id", validate(recurringTaskValidators.getRecurringTask), recurringTaskController.getRecurringTaskById)

/**
 * @swagger
 * /recurring-tasks/{id}:
 *   put:
 *     summary: Update a recurring task
 *     tags: [Recurring Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               project:
 *                 type: string
 *                 format: uuid
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly, yearly]
 *               interval:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *               daysOfWeek:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *               daysOfMonth:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 31
 *               monthsOfYear:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 11
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               active:
 *                 type: boolean
 *               taskTemplate:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     maxLength: 100
 *                   description:
 *                     type: string
 *                     maxLength: 1000
 *                   priority:
 *                     type: string
 *                     enum: [low, medium, high, urgent]
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                   estimatedHours:
 *                     type: number
 *                     minimum: 0
 *                   attachments:
 *                     type: array
 *                     items:
 *                       type: object
 *               workspace:
 *                 type: string
 *                 format: uuid
 *               team:
 *                 type: string
 *                 format: uuid
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Recurring task updated successfully
 *       404:
 *         description: Recurring task not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.put("/:id", validate(recurringTaskValidators.updateRecurringTask), recurringTaskController.updateRecurringTask)

/**
 * @swagger
 * /recurring-tasks/{id}:
 *   delete:
 *     summary: Delete a recurring task
 *     tags: [Recurring Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteGeneratedTasks:
 *                 type: boolean
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Recurring task deleted successfully
 *       404:
 *         description: Recurring task not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id", validate(recurringTaskValidators.deleteRecurringTask), recurringTaskController.deleteRecurringTask)

/**
 * @swagger
 * /recurring-tasks/{id}/toggle-active:
 *   patch:
 *     summary: Toggle recurring task active status
 *     tags: [Recurring Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - active
 *             properties:
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Recurring task status toggled successfully
 *       404:
 *         description: Recurring task not found
 *       401:
 *         description: Not authenticated
 */
router.patch("/:id/toggle-active", validate(recurringTaskValidators.toggleRecurringTaskActive), recurringTaskController.toggleRecurringTaskActive)

/**
 * @swagger
 * /recurring-tasks/stats:
 *   get:
 *     summary: Get recurring task statistics
 *     tags: [Recurring Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: frequency
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: workspace
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: team
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
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, frequency, project, workspace, team]
 *     responses:
 *       200:
 *         description: Recurring task statistics retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/stats", validate(recurringTaskValidators.getRecurringTaskStats), recurringTaskController.getRecurringTaskStats)

/**
 * @swagger
 * /recurring-tasks/process:
 *   post:
 *     summary: Process recurring tasks (Admin only)
 *     tags: [Recurring Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *               maxTasks:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *               recurringTaskIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               processUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Recurring tasks processed successfully
 *       403:
 *         description: Only administrators can process recurring tasks
 *       401:
 *         description: Not authenticated
 */
router.post("/process", validate(recurringTaskValidators.processRecurringTasks), recurringTaskController.processRecurringTasks)

export default router
