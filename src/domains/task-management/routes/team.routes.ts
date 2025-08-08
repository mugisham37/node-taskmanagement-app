import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import { teamValidators, invitationValidators, activityValidators } from "../validators"
import * as teamController from "../controllers/team.controller"
import * as invitationController from "../controllers/invitation.controller"
import * as activityController from "../controllers/activity.controller"

const router = express.Router()

// All routes require authentication
router.use(authenticate())

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all teams for the authenticated user
 *     tags: [Teams]
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
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [private, public, invite_only]
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
 *         description: Teams retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get("/", validate(teamValidators.getTeams), teamController.getTeams)

/**
 * @swagger
 * /teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
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
 *                 maxLength: 500
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *               visibility:
 *                 type: string
 *                 enum: [private, public, invite_only]
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *               avatar:
 *                 type: string
 *                 format: uri
 *               settings:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post("/", validate(teamValidators.createTeam), teamController.createTeam)

/**
 * @swagger
 * /teams/{id}:
 *   get:
 *     summary: Get a team by ID
 *     tags: [Teams]
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
 *         name: includeMembers
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
 *         description: Team retrieved successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id", validate(teamValidators.getTeam), teamController.getTeam)

/**
 * @swagger
 * /teams/{id}:
 *   put:
 *     summary: Update a team
 *     tags: [Teams]
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
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *               visibility:
 *                 type: string
 *                 enum: [private, public, invite_only]
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *               avatar:
 *                 type: string
 *                 format: uri
 *               settings:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *               isArchived:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Team updated successfully
 *       404:
 *         description: Team not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.put("/:id", validate(teamValidators.updateTeam), teamController.updateTeam)

/**
 * @swagger
 * /teams/{id}:
 *   delete:
 *     summary: Delete a team
 *     tags: [Teams]
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
 *               transferProjectsTo:
 *                 type: string
 *                 format: uuid
 *               deleteAllProjects:
 *                 type: boolean
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id", validate(teamValidators.deleteTeam), teamController.deleteTeam)

/**
 * @swagger
 * /teams/{id}/members:
 *   get:
 *     summary: Get team members
 *     tags: [Teams]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [owner, admin, member, viewer]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team members retrieved successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id/members", validate(teamValidators.getTeamMembers), teamController.getTeamMembers)

/**
 * @swagger
 * /teams/{id}/members:
 *   post:
 *     summary: Add a member to a team
 *     tags: [Teams]
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member, viewer]
 *                 default: member
 *               sendInvitation:
 *                 type: boolean
 *                 default: true
 *               message:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Member added to team successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.post("/:id/members", validate(teamValidators.addTeamMember), teamController.addTeamMember)

/**
 * @swagger
 * /teams/{id}/members/{memberId}:
 *   delete:
 *     summary: Remove a member from a team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
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
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Member removed from team successfully
 *       404:
 *         description: Team or member not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id/members/:memberId", validate(teamValidators.removeTeamMember), teamController.removeTeamMember)

/**
 * @swagger
 * /teams/{id}/members/{memberId}/role:
 *   patch:
 *     summary: Update a team member's role
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member, viewer]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       404:
 *         description: Team or member not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.patch(
  "/:id/members/:memberId/role",
  validate(teamValidators.updateTeamMemberRole),
  teamController.updateTeamMemberRole,
)

/**
 * @swagger
 * /teams/{id}/leave:
 *   delete:
 *     summary: Leave a team
 *     tags: [Teams]
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
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Left team successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.delete("/:id/leave", validate(teamValidators.leaveTeam), teamController.leaveTeam)

/**
 * @swagger
 * /teams/{id}/transfer-ownership:
 *   patch:
 *     summary: Transfer team ownership
 *     tags: [Teams]
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
 *               - newOwnerId
 *             properties:
 *               newOwnerId:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Team ownership transferred successfully
 *       404:
 *         description: Team not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.patch(
  "/:id/transfer-ownership",
  validate(teamValidators.transferTeamOwnership),
  teamController.transferTeamOwnership,
)

/**
 * @swagger
 * /teams/{teamId}/invitations:
 *   get:
 *     summary: Get team invitations
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *           enum: [pending, accepted, declined, expired, cancelled]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [owner, admin, member, viewer]
 *     responses:
 *       200:
 *         description: Team invitations retrieved successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.get(
  "/:teamId/invitations",
  validate(invitationValidators.getTeamInvitations),
  invitationController.getTeamInvitations,
)

/**
 * @swagger
 * /teams/{teamId}/activities:
 *   get:
 *     summary: Get team activities
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *         description: Team activities retrieved successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:teamId/activities", validate(activityValidators.getTeamActivities), activityController.getTeamActivities)

/**
 * @swagger
 * /teams/{id}/stats:
 *   get:
 *     summary: Get team statistics
 *     tags: [Teams]
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
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year, all]
 *       - in: query
 *         name: includeProjects
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeTasks
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, member, project, status]
 *     responses:
 *       200:
 *         description: Team statistics retrieved successfully
 *       404:
 *         description: Team not found
 *       401:
 *         description: Not authenticated
 */
router.get("/:id/stats", validate(teamValidators.getTeamStats), teamController.getTeamStats)

export default router
