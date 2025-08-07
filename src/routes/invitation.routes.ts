import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import { invitationValidators } from "../validators"
import * as invitationController from "../controllers/invitation.controller"

const router = express.Router()

/**
 * @swagger
 * /invitations/{token}:
 *   get:
 *     summary: Get invitation by token
 *     tags: [Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation retrieved successfully
 *       404:
 *         description: Invitation not found
 */
router.get("/:token", validate(invitationValidators.getInvitationByToken), invitationController.getInvitationByToken)

// Routes that require authentication
router.use(authenticate())

/**
 * @swagger
 * /invitations:
 *   post:
 *     summary: Create a new invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - teamId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               teamId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member, viewer]
 *               message:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: User already invited or is a member
 */
router.post("/", validate(invitationValidators.createInvitation), invitationController.createInvitation)

/**
 * @swagger
 * /invitations/me:
 *   get:
 *     summary: Get invitations for the authenticated user
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, declined, expired, cancelled]
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
 *     responses:
 *       200:
 *         description: User invitations retrieved successfully
 */
router.get("/me", invitationController.getUserInvitations)

/**
 * @swagger
 * /invitations/{token}/accept:
 *   post:
 *     summary: Accept an invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               acceptTerms:
 *                 type: boolean
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *       400:
 *         description: Invalid invitation or already processed
 *       404:
 *         description: Invitation not found
 */
router.post("/:token/accept", validate(invitationValidators.acceptInvitation), invitationController.acceptInvitation)

/**
 * @swagger
 * /invitations/{token}/decline:
 *   post:
 *     summary: Decline an invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 *       400:
 *         description: Invalid invitation or already processed
 *       404:
 *         description: Invitation not found
 */
router.post("/:token/decline", validate(invitationValidators.declineInvitation), invitationController.declineInvitation)

/**
 * @swagger
 * /invitations/{id}:
 *   delete:
 *     summary: Cancel an invitation
 *     tags: [Invitations]
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
 *         description: Invitation cancelled successfully
 *       403:
 *         description: Not authorized to cancel this invitation
 *       404:
 *         description: Invitation not found
 */
router.delete("/:id", validate(invitationValidators.cancelInvitation), invitationController.cancelInvitation)

/**
 * @swagger
 * /invitations/{id}/resend:
 *   post:
 *     summary: Resend an invitation
 *     tags: [Invitations]
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
 *               message:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 *       403:
 *         description: Not authorized to resend this invitation
 *       404:
 *         description: Invitation not found
 */
router.post("/:id/resend", validate(invitationValidators.resendInvitation), invitationController.resendInvitation)

export default router
