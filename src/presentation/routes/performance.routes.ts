import { Router } from 'express';
import { performanceController } from '../controllers/performance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorization.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate());

// Validation schemas
const optimizationConfigSchema = z.object({
  tables: z.array(z.string()).optional(),
  createIndexes: z.boolean().optional(),
  optimizeQueries: z.boolean().optional(),
  maintainTables: z.boolean().optional(),
});

const thresholdsSchema = z.object({
  thresholds: z.object({
    cpu: z
      .object({
        warning: z.number().min(0).max(100).optional(),
        critical: z.number().min(0).max(100).optional(),
      })
      .optional(),
    memory: z
      .object({
        warning: z.number().min(0).max(100).optional(),
        critical: z.number().min(0).max(100).optional(),
      })
      .optional(),
    database: z
      .object({
        connectionUtilization: z
          .object({
            warning: z.number().min(0).max(100).optional(),
            critical: z.number().min(0).max(100).optional(),
          })
          .optional(),
        queryTime: z
          .object({
            warning: z.number().min(0).optional(),
            critical: z.number().min(0).optional(),
          })
          .optional(),
      })
      .optional(),
    api: z
      .object({
        responseTime: z
          .object({
            warning: z.number().min(0).optional(),
            critical: z.number().min(0).optional(),
          })
          .optional(),
        errorRate: z
          .object({
            warning: z.number().min(0).max(100).optional(),
            critical: z.number().min(0).max(100).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

const monitoringConfigSchema = z.object({
  interval: z.number().min(5000).max(300000).optional(), // 5 seconds to 5 minutes
});

/**
 * @swagger
 * /api/v1/performance/status:
 *   get:
 *     summary: Get current performance status
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: object
 *                     currentMetrics:
 *                       type: object
 *                     activeAlerts:
 *                       type: number
 *                     criticalAlerts:
 *                       type: number
 */
router.get('/status', performanceController.getPerformanceStatus);

/**
 * @swagger
 * /api/v1/performance/optimize:
 *   post:
 *     summary: Run full performance optimization
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance optimization completed successfully
 *       409:
 *         description: Optimization already in progress
 */
router.post(
  '/optimize',
  authorize(['admin']),
  performanceController.runOptimization
);

/**
 * @swagger
 * /api/v1/performance/history:
 *   get:
 *     summary: Get optimization history
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of history records to retrieve
 *     responses:
 *       200:
 *         description: Optimization history retrieved successfully
 */
router.get('/history', performanceController.getOptimizationHistory);

/**
 * @swagger
 * /api/v1/performance/metrics:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Number of metrics records to retrieve
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, prometheus]
 *           default: json
 *         description: Response format
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 */
router.get('/metrics', performanceController.getPerformanceMetrics);

/**
 * @swagger
 * /api/v1/performance/alerts:
 *   get:
 *     summary: Get performance alerts
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of alerts to retrieve
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only active alerts
 *     responses:
 *       200:
 *         description: Performance alerts retrieved successfully
 */
router.get('/alerts', performanceController.getPerformanceAlerts);

/**
 * @swagger
 * /api/v1/performance/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve a performance alert
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID to resolve
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 *       404:
 *         description: Alert not found
 */
router.post(
  '/alerts/:alertId/resolve',
  authorize(['admin']),
  performanceController.resolveAlert
);

/**
 * @swagger
 * /api/v1/performance/database:
 *   get:
 *     summary: Get database performance metrics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database performance metrics retrieved successfully
 */
router.get('/database', performanceController.getDatabaseMetrics);

/**
 * @swagger
 * /api/v1/performance/database/optimize:
 *   post:
 *     summary: Optimize database performance
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tables:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific tables to optimize
 *               createIndexes:
 *                 type: boolean
 *                 description: Create recommended indexes
 *               optimizeQueries:
 *                 type: boolean
 *                 description: Analyze and optimize slow queries
 *               maintainTables:
 *                 type: boolean
 *                 description: Run table maintenance (VACUUM ANALYZE)
 *     responses:
 *       200:
 *         description: Database optimization completed successfully
 */
router.post(
  '/database/optimize',
  authorize(['admin']),
  validateRequest(optimizationConfigSchema),
  performanceController.optimizeDatabase
);

/**
 * @swagger
 * /api/v1/performance/api:
 *   get:
 *     summary: Get API performance metrics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API performance metrics retrieved successfully
 */
router.get('/api', performanceController.getApiMetrics);

/**
 * @swagger
 * /api/v1/performance/recommendations:
 *   get:
 *     summary: Get performance optimization recommendations
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance recommendations retrieved successfully
 */
router.get('/recommendations', performanceController.getRecommendations);

/**
 * @swagger
 * /api/v1/performance/thresholds:
 *   put:
 *     summary: Update performance alert thresholds
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               thresholds:
 *                 type: object
 *                 properties:
 *                   cpu:
 *                     type: object
 *                     properties:
 *                       warning:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *                       critical:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *                   memory:
 *                     type: object
 *                     properties:
 *                       warning:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *                       critical:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *     responses:
 *       200:
 *         description: Performance thresholds updated successfully
 */
router.put(
  '/thresholds',
  authorize(['admin']),
  validateRequest(thresholdsSchema),
  performanceController.updateThresholds
);

/**
 * @swagger
 * /api/v1/performance/monitoring/start:
 *   post:
 *     summary: Start performance monitoring
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interval:
 *                 type: number
 *                 minimum: 5000
 *                 maximum: 300000
 *                 description: Monitoring interval in milliseconds
 *     responses:
 *       200:
 *         description: Performance monitoring started successfully
 */
router.post(
  '/monitoring/start',
  authorize(['admin']),
  validateRequest(monitoringConfigSchema),
  performanceController.startMonitoring
);

/**
 * @swagger
 * /api/v1/performance/monitoring/stop:
 *   post:
 *     summary: Stop performance monitoring
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance monitoring stopped successfully
 */
router.post(
  '/monitoring/stop',
  authorize(['admin']),
  performanceController.stopMonitoring
);

export default router;
