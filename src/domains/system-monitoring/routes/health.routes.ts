import express from 'express';
import * as healthController from '../controllers/health.controller';
import { authenticate } from '../../../shared/middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns basic health status of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 */
router.get('/', healthController.basicHealth);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health status of all system components
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health details
 *       503:
 *         description: System is unhealthy
 */
router.get('/detailed', authenticate, healthController.detailedHealth);

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Current system metrics
 *     description: Returns current system metrics
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current system metrics
 */
router.get('/metrics', authenticate, healthController.getMetrics);

/**
 * @swagger
 * /health/metrics/history:
 *   get:
 *     summary: System metrics history
 *     description: Returns historical system metrics
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historical system metrics
 */
router.get(
  '/metrics/history',
  authenticate,
  healthController.getMetricsHistory
);

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database status
 *     description: Returns database connection status
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database status
 */
router.get('/database', authenticate, healthController.getDatabaseStatus);

/**
 * @swagger
 * /health/system:
 *   get:
 *     summary: System information
 *     description: Returns system information
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System information
 */
router.get('/system', authenticate, healthController.getSystemInfo);

export default router;
