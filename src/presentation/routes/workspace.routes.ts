import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import { workspaceValidators, activityValidators } from "../validators"
import * as workspaceController from "../controllers/workspace.controller"
import * as activityController from "../controllers/activity.controller"

const router = express.Router()

// All routes require authentication
router.use(authenticate())

/**
 * @swagger
 * /api/v1/workspaces:
 *   get:
 *     summary: Get all workspaces for the authenticated user
 *     description: Retrieve all workspaces that the authenticated user has access to
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [personal, team, organization]
 *         description: Filter by workspace type
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [private, public, team_only]
 *         description: Filter by workspace visibility
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search workspaces by name or description
 *       - in: query
 *         name: includeArchived
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include archived workspaces in results
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, memberCount, projectCount]
 *           default: updatedAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Workspaces retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Workspaces retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [personal, team, organization]
 *                       visibility:
 *                         type: string
 *                         enum: [private, public, team_only]
 *                       color:
 *                         type: string
 *                         pattern: "^#[0-9A-F]{6}$"
 *                       avatar:
 *                         type: string
 *                         format: uri
 *                       memberCount:
 *                         type: integer
 *                       projectCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       401:
 *         description: Not authenticated
 */
router.get("/", validate(workspaceValidators.getWorkspaces), workspaceController.getWorkspaces)

/**
 * @swagger
 * /api/v1/workspaces:
 *   post:
 *     summary: Create a new workspace
 *     description: Create a new workspace for the authenticated user
 *     tags: [Workspaces]
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
 *                 example: "My Workspace"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "A workspace for managing my projects"
 *               type:
 *                 type: string
 *                 enum: [personal, team, organization]
 *                 default: team
 *               visibility:
 *                 type: string
 *                 enum: [private, public, team_only]
 *                 default: private
 *               color:
 *                 type: string
 *                 pattern: "^#[0-9A-F]{6}$"
 *                 example: "#4f46e5"
 *               avatar:
 *                 type: string
 *                 format: uri
 *               settings:
 *                 type: object
 *                 properties:
 *                   allowPublicProjects:
 *                     type: boolean
 *                     default: false
 *                   requireApproval:
 *                     type: boolean
 *                     default: true
 *                   defaultProjectVisibility:
 *                     type: string
 *                     enum: [private, public, team]
 *                     default: private
 *               tags:
 *                 type: array
 *                 maxItems: 15
 *                 items:
 *                   type: string
 *                   maxLength: 30
 *               maxMembers:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10000
 *               maxProjects:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *     responses:
 *       201:
 *         description: Workspace created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Workspace created successfully"
 *                 data:
 *                   type: object
 *                   description: "Created workspace data"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post("/", validate(workspaceValidators.createWorkspace), workspaceController.createWorkspace)

/**
 * @swagger
 * /api/v1/workspaces/personal:
 *   post:
 *     summary: Create a personal workspace
 *     description: Create a personal workspace for the authenticated user
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal workspace created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Personal workspace created successfully"
 *                 data:
 *                   type: object
 *                   description: "Created personal workspace data"
 *       409:
 *         description: Personal workspace already exists
 *       401:
 *         description: Not authenticated
 */
router.post("/personal", workspaceController.createPersonalWorkspace)

/**
 * @swagger
 * /api/v1/workspaces/{id}:
 *   get:
 *     summary: Get a workspace by ID
 *     description: Retrieve detailed information about a specific workspace
 *     tags: [Workspaces]
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
 *         name: includeTeams
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeProjects
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Workspace retrieved successfully
 *       404:
 *         description: Workspace not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id", validate(workspaceValidators.getWorkspace), workspaceController.getWorkspace)

/**
 * @swagger
 * /api/v1/workspaces/{id}:
 *   put:
 *     summary: Update a workspace
 *     description: Update workspace information
 *     tags: [Workspaces]
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
 *               visibility:
 *                 type: string
 *                 enum: [private, public, team_only]
 *               color:
 *                 type: string
 *                 pattern: "^#[0-9A-F]{6}$"
 *               avatar:
 *                 type: string
 *                 format: uri
 *               settings:
 *                 type: object
 *               tags:
 *                 type: array
 *                 maxItems: 15
 *                 items:
 *                   type: string
 *                   maxLength: 30
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Workspace not found
 *       401:
 *         description: Not authenticated
 */
router.put("/:id", validate(workspaceValidators.updateWorkspace), workspaceController.updateWorkspace)

/**
 * @swagger
 * /api/v1/workspaces/{id}:
 *   delete:
 *     summary: Delete a workspace
 *     description: Delete a workspace and optionally transfer data
 *     tags: [Workspaces]
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
 *               transferDataTo:
 *                 type: string
 *                 format: uuid
 *               deleteAllData:
 *                 type: boolean
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Workspace deleted successfully
 *       404:
 *         description: Workspace not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id", validate(workspaceValidators.deleteWorkspace), workspaceController.deleteWorkspace)

/**
 * @swagger
 * /api/v1/workspaces/{id}/projects:
 *   get:
 *     summary: Get workspace projects
 *     description: Retrieve all projects in a workspace
 *     tags: [Workspaces]
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
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planning, active, on_hold, completed, cancelled]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *     responses:
 *       200:
 *         description: Workspace projects retrieved successfully
 *       404:
 *         description: Workspace not found
 *       401:
 *         description: Not authenticated
 */
router.get(
  "/:id/projects",
  validate(workspaceValidators.getWorkspaceProjects),
  workspaceController.getWorkspaceProjects,
)

/**
 * @swagger
 * /api/v1/workspaces/{id}/tasks:
 *   get:
 *     summary: Get workspace tasks
 *     description: Retrieve all tasks in a workspace
 *     tags: [Workspaces]
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
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
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
 *           maxLength: 100
 *     responses:
 *       200:
 *         description: Workspace tasks retrieved successfully
 *       404:
 *         description: Workspace not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id/tasks", validate(workspaceValidators.getWorkspaceTasks), workspaceController.getWorkspaceTasks)

/**
 * @swagger
 * /api/v1/workspaces/{workspaceId}/activities:
 *   get:
 *     summary: Get workspace activities
 *     description: Retrieve activity log for a workspace
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
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
 *         description: Workspace activities retrieved successfully
 *       404:
 *         description: Workspace not found
 *       401:
 *         description: Not authenticated
 */
router.get(
  "/:workspaceId/activities",
  validate(activityValidators.getWorkspaceActivities),
  activityController.getWorkspaceActivities,
)

export default router
