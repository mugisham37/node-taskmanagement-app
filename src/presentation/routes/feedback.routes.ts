import express from "express"
import * as feedbackController from "../controllers/feedback.controller"
import { authenticate, authorize } from "../shared/middleware/auth"

const router = express.Router()

// Apply authentication middleware to all routes
router.use(authenticate)

/**
 * @swagger
 * /api/v1/feedback:
 *   post:
 *     summary: Create a new feedback
 *     tags: [Feedback]
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
 *               - title
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [bug, feature, improvement, other]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               screenshots:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *                 properties:
 *                   browser:
 *                     type: string
 *                   os:
 *                     type: string
 *                   device:
 *                     type: string
 *                   url:
 *                     type: string
 *     responses:
 *       201:
 *         description: Feedback created successfully
 */
router.post("/", feedbackController.createFeedback)

/**
 * @swagger
 * /api/v1/feedback:
 *   get:
 *     summary: Get all feedbacks for the authenticated user
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [bug, feature, improvement, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, resolved, rejected]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Feedbacks retrieved successfully
 */
router.get("/", feedbackController.getUserFeedbacks)

/**
 * @swagger
 * /api/v1/feedback/{id}:
 *   get:
 *     summary: Get feedback by ID
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
 *       404:
 *         description: Feedback not found
 */
router.get("/:id", feedbackController.getFeedbackById)

/**
 * @swagger
 * /api/v1/feedback/{id}:
 *   put:
 *     summary: Update feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [bug, feature, improvement, other]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               screenshots:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *                 properties:
 *                   browser:
 *                     type: string
 *                   os:
 *                     type: string
 *                   device:
 *                     type: string
 *                   url:
 *                     type: string
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 *       404:
 *         description: Feedback not found
 */
router.put("/:id", feedbackController.updateFeedback)

/**
 * @swagger
 * /api/v1/feedback/{id}:
 *   delete:
 *     summary: Delete feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback deleted successfully
 *       404:
 *         description: Feedback not found
 */
router.delete("/:id", feedbackController.deleteFeedback)

// Admin routes
router.use("/admin", authorize("admin"))

/**
 * @swagger
 * /api/v1/feedback/admin:
 *   get:
 *     summary: Get all feedbacks (admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [bug, feature, improvement, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, resolved, rejected]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Feedbacks retrieved successfully
 */
router.get("/admin", feedbackController.getAllFeedbacks)

/**
 * @swagger
 * /api/v1/feedback/admin/{id}:
 *   patch:
 *     summary: Update feedback status (admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, resolved, rejected]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               adminResponse:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback status updated successfully
 *       404:
 *         description: Feedback not found
 */
router.patch("/admin/:id", feedbackController.updateFeedbackStatus)

/**
 * @swagger
 * /api/v1/feedback/admin/statistics:
 *   get:
 *     summary: Get feedback statistics (admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback statistics retrieved successfully
 */
router.get("/admin/statistics", feedbackController.getFeedbackStatistics)

export default router
