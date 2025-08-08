import { Router } from 'express';
import { metricsService } from '../../../infrastructure/monitoring/metrics.service';
import { healthMonitor } from '../../../infrastructure/monitoring/health-check.service';
import { monitoringDashboard } from '../services/monitoring-dashboard.service';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { successResponse } from '../../../shared/utils/response-formatter';

const router = Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     description: Returns metrics in Prometheus format for scraping
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  })
);

/**
 * @swagger
 * /metrics/json:
 *   get:
 *     summary: Get metrics in JSON format
 *     description: Returns all metrics in JSON format for dashboard consumption
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics in JSON format
 */
router.get(
  '/json',
  authenticate,
  asyncHandler(async (req, res) => {
    const metrics = await metricsService.getMetricsJSON();
    successResponse(res, 200, metrics, 'Metrics retrieved successfully');
  })
);

/**
 * @swagger
 * /metrics/dashboard:
 *   get:
 *     summary: Get dashboard metrics
 *     description: Returns aggregated metrics for monitoring dashboard
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of recent metrics to return
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const metrics = monitoringDashboard.getMetrics(limit);
    const latest = monitoringDashboard.getLatestMetrics();

    successResponse(
      res,
      200,
      {
        latest,
        history: metrics,
        count: metrics.length,
      },
      'Dashboard metrics retrieved successfully'
    );
  })
);

/**
 * @swagger
 * /metrics/health:
 *   get:
 *     summary: Get health check results
 *     description: Returns current health status of all system components
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check results
 *       503:
 *         description: System is unhealthy
 */
router.get(
  '/health',
  authenticate,
  asyncHandler(async (req, res) => {
    const healthStatus = await healthMonitor.runAllChecks();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    successResponse(res, statusCode, healthStatus, 'Health check completed');
  })
);

/**
 * @swagger
 * /metrics/alerts:
 *   get:
 *     summary: Get active alerts
 *     description: Returns all currently active alerts
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active alerts
 */
router.get(
  '/alerts',
  authenticate,
  asyncHandler(async (req, res) => {
    const activeAlerts = monitoringDashboard.getActiveAlerts();

    successResponse(
      res,
      200,
      {
        alerts: activeAlerts,
        count: activeAlerts.length,
      },
      'Active alerts retrieved successfully'
    );
  })
);

/**
 * @swagger
 * /metrics/alerts/history:
 *   get:
 *     summary: Get alert history
 *     description: Returns historical alert data
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of recent alerts to return
 *     responses:
 *       200:
 *         description: Alert history
 */
router.get(
  '/alerts/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const alertHistory = monitoringDashboard.getAlertHistory(limit);

    successResponse(
      res,
      200,
      {
        alerts: alertHistory,
        count: alertHistory.length,
      },
      'Alert history retrieved successfully'
    );
  })
);

/**
 * @swagger
 * /metrics/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve an alert
 *     description: Mark an alert as resolved
 *     tags: [Monitoring]
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
  authenticate,
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const userId = req.user?.id || 'unknown';

    await monitoringDashboard.resolveAlert(alertId, userId);

    successResponse(res, 200, null, 'Alert resolved successfully');
  })
);

/**
 * @swagger
 * /metrics/performance-report:
 *   get:
 *     summary: Generate performance report
 *     description: Generate a comprehensive performance report for a time period
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for the report
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for the report
 *     responses:
 *       200:
 *         description: Performance report generated successfully
 *       400:
 *         description: Invalid time parameters
 */
router.get(
  '/performance-report',
  authenticate,
  asyncHandler(async (req, res) => {
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'startTime and endTime parameters are required',
      });
    }

    const start = new Date(startTime as string);
    const end = new Date(endTime as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for startTime or endTime',
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'startTime must be before endTime',
      });
    }

    const report = await monitoringDashboard.generatePerformanceReport(
      start,
      end
    );

    successResponse(
      res,
      200,
      report,
      'Performance report generated successfully'
    );
  })
);

export default router;
