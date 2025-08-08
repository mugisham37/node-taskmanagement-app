import { Router } from 'express';
import { monitoringDashboard } from '../../infrastructure/monitoring/monitoring-dashboard.service';
import { alertingService } from '../../infrastructure/monitoring/alerting.service';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { successResponse } from '../utils/response-formatter';

const router = Router();

/**
 * @swagger
 * /monitoring/dashboard:
 *   get:
 *     summary: Get monitoring dashboard data
 *     description: Returns comprehensive monitoring dashboard data
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for metrics
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req, res) => {
    const timeRange = (req.query.timeRange as string) || '24h';

    // Calculate time range
    const now = new Date();
    const timeRangeMs =
      {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      }[timeRange] || 24 * 60 * 60 * 1000;

    const startTime = new Date(now.getTime() - timeRangeMs);

    // Get dashboard data
    const latestMetrics = monitoringDashboard.getLatestMetrics();
    const metricsHistory = monitoringDashboard.getMetrics();
    const activeAlerts = monitoringDashboard.getActiveAlerts();
    const healthStatus = await monitoringDashboard.getHealthStatus();

    // Filter metrics by time range
    const filteredMetrics = metricsHistory.filter(
      m => m.timestamp >= startTime
    );

    const dashboardData = {
      current: latestMetrics,
      history: filteredMetrics,
      alerts: {
        active: activeAlerts,
        count: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
      },
      health: healthStatus,
      summary: {
        timeRange,
        dataPoints: filteredMetrics.length,
        lastUpdate: latestMetrics?.timestamp || null,
      },
    };

    successResponse(
      res,
      200,
      dashboardData,
      'Dashboard data retrieved successfully'
    );
  })
);

/**
 * @swagger
 * /monitoring/alerts:
 *   get:
 *     summary: Get alert management data
 *     description: Returns alerts and alert rules for management
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert data retrieved successfully
 */
router.get(
  '/alerts',
  authenticate,
  asyncHandler(async (req, res) => {
    const activeAlerts = monitoringDashboard.getActiveAlerts();
    const alertHistory = monitoringDashboard.getAlertHistory(50);
    const alertRules = monitoringDashboard.getAlertRules();

    const alertData = {
      active: activeAlerts,
      history: alertHistory,
      rules: alertRules,
      summary: {
        activeCount: activeAlerts.length,
        criticalCount: activeAlerts.filter(a => a.severity === 'critical')
          .length,
        rulesCount: alertRules.length,
        enabledRulesCount: alertRules.filter(r => r.enabled).length,
      },
    };

    successResponse(res, 200, alertData, 'Alert data retrieved successfully');
  })
);

/**
 * @swagger
 * /monitoring/alerts/rules:
 *   post:
 *     summary: Create alert rule
 *     description: Create a new alert rule
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, metric, operator, threshold, severity]
 *             properties:
 *               name:
 *                 type: string
 *               metric:
 *                 type: string
 *               operator:
 *                 type: string
 *                 enum: [gt, lt, eq, gte, lte]
 *               threshold:
 *                 type: number
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Alert rule created successfully
 */
router.post(
  '/alerts/rules',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, metric, operator, threshold, severity, description } =
      req.body;

    const alertRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      metric,
      operator,
      threshold,
      severity,
      enabled: true,
      description,
    };

    monitoringDashboard.addAlertRule(alertRule);

    successResponse(res, 201, alertRule, 'Alert rule created successfully');
  })
);

/**
 * @swagger
 * /monitoring/alerts/rules/{ruleId}:
 *   put:
 *     summary: Update alert rule
 *     description: Update an existing alert rule
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleId
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
 *               name:
 *                 type: string
 *               threshold:
 *                 type: number
 *               enabled:
 *                 type: boolean
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Alert rule updated successfully
 */
router.put(
  '/alerts/rules/:ruleId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { ruleId } = req.params;
    const updates = req.body;

    monitoringDashboard.updateAlertRule(ruleId, updates);
    const updatedRule = monitoringDashboard.getAlertRule(ruleId);

    successResponse(res, 200, updatedRule, 'Alert rule updated successfully');
  })
);

/**
 * @swagger
 * /monitoring/alerts/rules/{ruleId}:
 *   delete:
 *     summary: Delete alert rule
 *     description: Delete an alert rule
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert rule deleted successfully
 */
router.delete(
  '/alerts/rules/:ruleId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { ruleId } = req.params;

    monitoringDashboard.removeAlertRule(ruleId);

    successResponse(res, 200, null, 'Alert rule deleted successfully');
  })
);

/**
 * @swagger
 * /monitoring/runbooks:
 *   get:
 *     summary: Get operational runbooks
 *     description: Returns all operational runbooks
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags to filter by
 *     responses:
 *       200:
 *         description: Runbooks retrieved successfully
 */
router.get(
  '/runbooks',
  authenticate,
  asyncHandler(async (req, res) => {
    const tagsParam = req.query.tags as string;
    let runbooks;

    if (tagsParam) {
      const tags = tagsParam.split(',').map(tag => tag.trim());
      runbooks = alertingService.searchRunbooks(tags);
    } else {
      runbooks = alertingService.getRunbooks();
    }

    successResponse(
      res,
      200,
      {
        runbooks,
        count: runbooks.length,
      },
      'Runbooks retrieved successfully'
    );
  })
);

/**
 * @swagger
 * /monitoring/runbooks/{runbookId}:
 *   get:
 *     summary: Get specific runbook
 *     description: Returns a specific operational runbook with detailed steps
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runbookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Runbook retrieved successfully
 *       404:
 *         description: Runbook not found
 */
router.get(
  '/runbooks/:runbookId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { runbookId } = req.params;
    const runbook = alertingService.getRunbook(runbookId);

    if (!runbook) {
      return res.status(404).json({
        success: false,
        message: 'Runbook not found',
      });
    }

    successResponse(res, 200, runbook, 'Runbook retrieved successfully');
  })
);

/**
 * @swagger
 * /monitoring/notifications/channels:
 *   get:
 *     summary: Get notification channels
 *     description: Returns all configured notification channels
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification channels retrieved successfully
 */
router.get(
  '/notifications/channels',
  authenticate,
  asyncHandler(async (req, res) => {
    const channels = alertingService.getNotificationChannels();

    // Remove sensitive configuration data
    const sanitizedChannels = channels.map(channel => ({
      ...channel,
      config: {
        ...channel.config,
        // Remove sensitive fields
        smtpPassword: channel.config.smtpPassword ? '***' : undefined,
        apiKey: channel.config.apiKey ? '***' : undefined,
        token: channel.config.token ? '***' : undefined,
      },
    }));

    successResponse(
      res,
      200,
      {
        channels: sanitizedChannels,
        count: channels.length,
        enabled: channels.filter(c => c.enabled).length,
      },
      'Notification channels retrieved successfully'
    );
  })
);

/**
 * @swagger
 * /monitoring/notifications/channels:
 *   post:
 *     summary: Create notification channel
 *     description: Create a new notification channel
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, config]
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [email, slack, webhook, sms]
 *               config:
 *                 type: object
 *               enabled:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Notification channel created successfully
 */
router.post(
  '/notifications/channels',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, type, config, enabled = true } = req.body;

    const channel = {
      id: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      config,
      enabled,
    };

    alertingService.addNotificationChannel(channel);

    successResponse(
      res,
      201,
      channel,
      'Notification channel created successfully'
    );
  })
);

/**
 * @swagger
 * /monitoring/performance-report:
 *   get:
 *     summary: Generate performance report
 *     description: Generate a comprehensive performance report
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
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Performance report generated successfully
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

/**
 * @swagger
 * /monitoring/start:
 *   post:
 *     summary: Start monitoring
 *     description: Start the monitoring system
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interval:
 *                 type: integer
 *                 default: 60000
 *                 description: Monitoring interval in milliseconds
 *     responses:
 *       200:
 *         description: Monitoring started successfully
 */
router.post(
  '/start',
  authenticate,
  asyncHandler(async (req, res) => {
    const { interval = 60000 } = req.body;

    await monitoringDashboard.startMonitoring(interval);

    successResponse(
      res,
      200,
      {
        status: 'started',
        interval,
      },
      'Monitoring started successfully'
    );
  })
);

/**
 * @swagger
 * /monitoring/stop:
 *   post:
 *     summary: Stop monitoring
 *     description: Stop the monitoring system
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring stopped successfully
 */
router.post(
  '/stop',
  authenticate,
  asyncHandler(async (req, res) => {
    monitoringDashboard.stopMonitoring();

    successResponse(
      res,
      200,
      {
        status: 'stopped',
      },
      'Monitoring stopped successfully'
    );
  })
);

export default router;
