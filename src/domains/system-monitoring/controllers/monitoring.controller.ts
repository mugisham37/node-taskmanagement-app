import type { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { successResponse } from '../../../shared/utils/response-formatter';
import { systemMonitoringService } from '../services';
import type { AuthRequest } from '../../../shared/middleware/auth';
import os from 'os';

/**
 * @desc    Basic health check
 * @route   GET /health
 * @access  Public
 */
export const basicHealth = asyncHandler(async (req: Request, res: Response) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };

  res.status(200).json({
    success: true,
    data: healthData,
  });
});

/**
 * @desc    Detailed health check
 * @route   GET /health/detailed
 * @access  Private (Admin)
 */
export const detailedHealth = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const metrics = await systemMonitoringService.getCurrentMetrics({
      userId,
      userRole,
      timestamp: new Date(),
    });

    // Determine overall health status
    let status = 'healthy';
    if (metrics.cpu.usage > 90 || metrics.memory.usedPercent > 95) {
      status = 'critical';
    } else if (metrics.cpu.usage > 70 || metrics.memory.usedPercent > 80) {
      status = 'degraded';
    }

    const health = {
      status,
      timestamp: new Date().toISOString(),
      metrics,
      checks: {
        database: metrics.database.status === 'connected',
        memory: metrics.memory.usedPercent < 90,
        cpu: metrics.cpu.usage < 90,
        disk: metrics.disk.usedPercent < 90,
      },
    };

    // Set appropriate status code based on health status
    const statusCode =
      status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health,
    });
  }
);

/**
 * @desc    Get system metrics
 * @route   GET /health/metrics
 * @access  Private (Admin)
 */
export const getMetrics = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const metrics = await systemMonitoringService.getCurrentMetrics({
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(res, 200, metrics, 'System metrics retrieved successfully');
  }
);

/**
 * @desc    Get metrics history
 * @route   GET /health/metrics/history
 * @access  Private (Admin)
 */
export const getMetricsHistory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const startTime = req.query.startTime
      ? new Date(req.query.startTime as string)
      : undefined;
    const endTime = req.query.endTime
      ? new Date(req.query.endTime as string)
      : undefined;

    const history = await systemMonitoringService.getMetricsHistory(
      startTime,
      endTime,
      {
        userId,
        userRole,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      200,
      history,
      'Metrics history retrieved successfully'
    );
  }
);

/**
 * @desc    Get active alerts
 * @route   GET /health/alerts
 * @access  Private (Admin)
 */
export const getActiveAlerts = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const alerts = await systemMonitoringService.getActiveAlerts({
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(res, 200, alerts, 'Active alerts retrieved successfully');
  }
);

/**
 * @desc    Get alerts history
 * @route   GET /health/alerts/history
 * @access  Private (Admin)
 */
export const getAlertsHistory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const startTime = req.query.startTime
      ? new Date(req.query.startTime as string)
      : undefined;
    const endTime = req.query.endTime
      ? new Date(req.query.endTime as string)
      : undefined;

    const history = await systemMonitoringService.getAlertsHistory(
      startTime,
      endTime,
      {
        userId,
        userRole,
        timestamp: new Date(),
      }
    );

    successResponse(res, 200, history, 'Alerts history retrieved successfully');
  }
);

/**
 * @desc    Resolve an alert
 * @route   PATCH /health/alerts/:id/resolve
 * @access  Private (Admin)
 */
export const resolveAlert = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;
    const alertId = req.params.id;

    await systemMonitoringService.resolveAlert(alertId, {
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(res, 200, {}, 'Alert resolved successfully');
  }
);

/**
 * @desc    Get system thresholds
 * @route   GET /health/thresholds
 * @access  Private (Admin)
 */
export const getThresholds = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const thresholds = await systemMonitoringService.getThresholds({
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(
      res,
      200,
      thresholds,
      'System thresholds retrieved successfully'
    );
  }
);

/**
 * @desc    Update system thresholds
 * @route   PUT /health/thresholds
 * @access  Private (Admin)
 */
export const updateThresholds = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const thresholds = await systemMonitoringService.updateThresholds(
      req.body,
      {
        userId,
        userRole,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      200,
      thresholds,
      'System thresholds updated successfully'
    );
  }
);

/**
 * @desc    Reset system thresholds to defaults
 * @route   POST /health/thresholds/reset
 * @access  Private (Admin)
 */
export const resetThresholds = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    const thresholds = await systemMonitoringService.resetThresholds({
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(
      res,
      200,
      thresholds,
      'System thresholds reset to defaults'
    );
  }
);

/**
 * @desc    Generate performance report
 * @route   POST /health/reports/performance
 * @access  Private (Admin)
 */
export const generatePerformanceReport = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required',
      });
    }

    const report = await systemMonitoringService.generatePerformanceReport(
      new Date(startTime),
      new Date(endTime),
      { userId, userRole, timestamp: new Date() }
    );

    successResponse(
      res,
      200,
      report,
      'Performance report generated successfully'
    );
  }
);

/**
 * @desc    Get database status
 * @route   GET /health/database
 * @access  Private (Admin)
 */
export const getDatabaseStatus = asyncHandler(
  async (req: Request, res: Response) => {
    // Note: This assumes you're using a database connection
    // Adjust based on your actual database setup
    const dbStatus = {
      status: 'connected', // This would be determined by actual DB connection check
      host: process.env.DATABASE_HOST || 'localhost',
      name: process.env.DATABASE_NAME || 'task_management',
      connections: 0, // Would get from actual connection pool
      uptime: process.uptime(),
    };

    successResponse(
      res,
      200,
      dbStatus,
      'Database status retrieved successfully'
    );
  }
);

/**
 * @desc    Get system information
 * @route   GET /health/system
 * @access  Private (Admin)
 */
export const getSystemInfo = asyncHandler(
  async (req: Request, res: Response) => {
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      processUptime: process.uptime(),
      hostname: os.hostname(),
      loadAverage: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces()),
    };

    successResponse(
      res,
      200,
      systemInfo,
      'System information retrieved successfully'
    );
  }
);

/**
 * @desc    Start system monitoring
 * @route   POST /health/monitoring/start
 * @access  Private (Admin)
 */
export const startMonitoring = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;
    const { interval = 60000 } = req.body;

    await systemMonitoringService.startMonitoring(interval, {
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(res, 200, {}, 'System monitoring started successfully');
  }
);

/**
 * @desc    Stop system monitoring
 * @route   POST /health/monitoring/stop
 * @access  Private (Admin)
 */
export const stopMonitoring = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    await systemMonitoringService.stopMonitoring({
      userId,
      userRole,
      timestamp: new Date(),
    });

    successResponse(res, 200, {}, 'System monitoring stopped successfully');
  }
);
