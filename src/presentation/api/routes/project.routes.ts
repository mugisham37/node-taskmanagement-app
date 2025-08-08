import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import { projectValidators, activityValidators } from "../validators"
import * as projectController from "../controllers/project.controller"
import * as activityController from "../controllers/activity.controller"

const router = express.Router()

// All routes require authentication
router.use(authenticate())

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects for the authenticated user
 *     tags: [Projects]
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
 *         name: workspaceId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planning, active, on_hold, completed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeArchived
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/", validate(projectValidators.getProjects), projectController.getProjects)

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *               teamId:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [planning, active, on_hold, completed, cancelled]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               budget:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *                 pattern: '^[A-Z]{3}$'
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 20
 *               visibility:
 *                 type: string
 *                 enum: [private, team, public]
 *               settings:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post("/", validate(projectValidators.createProject), projectController.createProject)

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get a project by ID
 *     tags: [Projects]
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
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeTasks
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeMembers
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *       404:
 *         description: Project not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id", validate(projectValidators.getProject), projectController.getProject)

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
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
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *               teamId:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [planning, active, on_hold, completed, cancelled]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               budget:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *                 pattern: '^[A-Z]{3}$'
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 20
 *               visibility:
 *                 type: string
 *                 enum: [private, team, public]
 *               settings:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       404:
 *         description: Project not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.put("/:id", validate(projectValidators.updateProject), projectController.updateProject)

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
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
 *               transferTasksTo:
 *                 type: string
 *                 format: uuid
 *               deleteAllTasks:
 *                 type: boolean
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *       404:
 *         description: Project not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id", validate(projectValidators.deleteProject), projectController.deleteProject)

/**
 * @swagger
 * /projects/{id}/tasks:
 *   get:
 *     summary: Get project tasks
 *     tags: [Projects]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in_progress, review, done, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project tasks retrieved successfully
 *       404:
 *         description: Project not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id/tasks", validate(projectValidators.getProjectTasks), projectController.getProjectTasks)

/**
 * @swagger
 * /projects/{projectId}/activities:
 *   get:
 *     summary: Get project activities
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Project activities retrieved successfully
 *       404:
 *         description: Project not found
 *       401:
 *         description: Not authenticated
 */
router.get(
  "/:projectId/activities",
  validate(activityValidators.getProjectActivities),
  activityController.getProjectActivities,
)

export default router
