import express from "express"
import * as exportImportController from "../controllers/export-import.controller"
import { authenticate } from "../middleware/auth"
import { authorize } from "../middleware/auth"
import { auditLogMiddleware } from "../middleware/audit-log.middleware"

const router = express.Router()

// Apply authentication and authorization middleware to all routes
router.use(authenticate())
router.use(authorize(["admin"]))

/**
 * @swagger
 * /api/v1/export-import/models:
 *   get:
 *     summary: Get available models for export/import
 *     tags: [Export/Import]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available models retrieved successfully
 */
router.get("/models", exportImportController.getAvailableModels)

/**
 * @swagger
 * /api/v1/export-import/export:
 *   post:
 *     summary: Export data
 *     tags: [Export/Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - format
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model name
 *               format:
 *                 type: string
 *                 enum: [csv, json]
 *                 description: Export format
 *               query:
 *                 type: object
 *                 description: Query to filter data
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post(
  "/export",
  auditLogMiddleware({
    action: "export",
    resource: "data",
    getDetails: (req) => ({ model: req.body.model, format: req.body.format }),
  }),
  exportImportController.exportData,
)

/**
 * @swagger
 * /api/v1/export-import/import:
 *   post:
 *     summary: Import data
 *     tags: [Export/Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - model
 *               - mode
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to import
 *               model:
 *                 type: string
 *                 description: Model name
 *               mode:
 *                 type: string
 *                 enum: [insert, update, upsert]
 *                 description: Import mode
 *               identifierField:
 *                 type: string
 *                 description: Field to use as identifier for update/upsert
 *     responses:
 *       200:
 *         description: Data imported successfully
 */
router.post(
  "/import",
  auditLogMiddleware({
    action: "import",
    resource: "data",
    getDetails: (req) => ({ model: req.body.model, mode: req.body.mode }),
  }),
  exportImportController.importData,
)

/**
 * @swagger
 * /api/v1/export-import/cleanup:
 *   post:
 *     summary: Clean up old export files
 *     tags: [Export/Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxAge:
 *                 type: number
 *                 description: Maximum age in days
 *     responses:
 *       200:
 *         description: Export files cleaned up successfully
 */
router.post("/cleanup", exportImportController.cleanupExportFiles)

export default router
