import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import * as taskTemplateController from "../controllers/task-template.controller"
import { taskTemplateValidators } from "../validators"

const router = express.Router()

// Apply authentication middleware to all routes
router.use(authenticate())

/**
 * @swagger
 * /task-templates:
 *   post:
 *     summary: Create a new task template
 *     tags: [Task Templates]
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
 *               - taskData
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               project:
 *                 type: string
 *                 format: uuid
 *               workspace:
 *                 type: string
 *                 format: uuid
 *               team:
 *                 type: string
 *                 format: uuid
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *               category:
 *                 type: string
 *                 maxLength: 50
 *               tags:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 30
 *               taskData:
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
 *                     maxItems: 20
 *                     items:
 *                       type: string
 *                   estimatedHours:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1000
 *                   checklist:
 *                     type: array
 *                     maxItems: 50
 *                     items:
 *                       type: object
 *                       properties:
 *                         title:
 *                           type: string
 *                           maxLength: 100
 *                         completed:
 *                           type: boolean
 *                   attachments:
 *                     type: array
 *                     maxItems: 10
 *                     items:
 *                       type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Task template created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post("/", validate(taskTemplateValidators.createTaskTemplate), taskTemplateController.createTaskTemplate)

/**
 * @swagger
 * /task-templates:
 *   get:
 *     summary: Get all task templates for the authenticated user
 *     tags: [Task Templates]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isPublic
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
 *         name: createdBy
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: hasChecklist
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: hasAttachments
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: estimatedHoursMin
 *         schema:
 *           type: number
 *       - in: query
 *         name: estimatedHoursMax
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Task templates retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/", validate(taskTemplateValidators.getTaskTemplates), taskTemplateController.getTaskTemplates)

/**
 * @swagger
 * /task-templates/categories:
 *   get:
 *     summary: Get task template categories
 *     tags: [Task Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: includePublic
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Task template categories retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/categories", validate(taskTemplateValidators.getTaskTemplateCategories), taskTemplateController.getTaskTemplateCategories)

/**
 * @swagger
 * /task-templates/public:
 *   get:
 *     summary: Get public task templates
 *     tags: [Task Templates]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Public task templates retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/public", validate(taskTemplateValidators.getPublicTaskTemplates), taskTemplateController.getPublicTaskTemplates)

/**
 * @swagger
 * /task-templates/stats:
 *   get:
 *     summary: Get task template statistics
 *     tags: [Task Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isPublic
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
 *         name: createdBy
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
 *           enum: [day, week, month, category, creator, project, workspace, team]
 *     responses:
 *       200:
 *         description: Task template statistics retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/stats", validate(taskTemplateValidators.getTaskTemplateStats), taskTemplateController.getTaskTemplateStats)

/**
 * @swagger
 * /task-templates/{id}:
 *   get:
 *     summary: Get a task template by ID
 *     tags: [Task Templates]
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
 *         description: Task template retrieved successfully
 *       404:
 *         description: Task template not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id", validate(taskTemplateValidators.getTaskTemplate), taskTemplateController.getTaskTemplateById)

/**
 * @swagger
 * /task-templates/{id}:
 *   put:
 *     summary: Update a task template
 *     tags: [Task Templates]
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
 *                 maxLength: 500
 *               project:
 *                 type: string
 *                 format: uuid
 *               workspace:
 *                 type: string
 *                 format: uuid
 *               team:
 *                 type: string
 *                 format: uuid
 *               isPublic:
 *                 type: boolean
 *               category:
 *                 type: string
 *                 maxLength: 50
 *               tags:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 30
 *               taskData:
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
 *                   checklist:
 *                     type: array
 *                     items:
 *                       type: object
 *                   attachments:
 *                     type: array
 *                     items:
 *                       type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Task template updated successfully
 *       404:
 *         description: Task template not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.put("/:id", validate(taskTemplateValidators.updateTaskTemplate), taskTemplateController.updateTaskTemplate)

/**
 * @swagger
 * /task-templates/{id}:
 *   delete:
 *     summary: Delete a task template
 *     tags: [Task Templates]
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
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Task template deleted successfully
 *       404:
 *         description: Task template not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id", validate(taskTemplateValidators.deleteTaskTemplate), taskTemplateController.deleteTaskTemplate)

/**
 * @swagger
 * /task-templates/{id}/create-task:
 *   post:
 *     summary: Create a task from a template
 *     tags: [Task Templates]
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
 *               project:
 *                 type: string
 *                 format: uuid
 *               assignedTo:
 *                 type: string
 *                 format: uuid
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               tags:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 30
 *               customFields:
 *                 type: object
 *               overrides:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     maxLength: 100
 *                   description:
 *                     type: string
 *                     maxLength: 1000
 *                   estimatedHours:
 *                     type: number
 *                     minimum: 0
 *     responses:
 *       201:
 *         description: Task created from template successfully
 *       404:
 *         description: Task template not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post("/:id/create-task", validate(taskTemplateValidators.createTaskFromTemplate), taskTemplateController.createTaskFromTemplate)

/**
 * @swagger
 * /task-templates/{id}/duplicate:
 *   post:
 *     summary: Duplicate a task template
 *     tags: [Task Templates]
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
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               project:
 *                 type: string
 *                 format: uuid
 *               workspace:
 *                 type: string
 *                 format: uuid
 *               team:
 *                 type: string
 *                 format: uuid
 *               isPublic:
 *                 type: boolean
 *               category:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Task template duplicated successfully
 *       404:
 *         description: Task template not found
 *       401:
 *         description: Not authenticated
 */
router.post("/:id/duplicate", validate(taskTemplateValidators.duplicateTaskTemplate), taskTemplateController.duplicateTaskTemplate)

export default router
