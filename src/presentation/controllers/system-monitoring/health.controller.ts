import type { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { successResponse } from '../../../shared/utils/response-formatter';
import { systemMonitoringService } from '../services';
import os from 'os';

/**
 * Basic health check
 * @route GET /health
 */
export const basicHealth = asyncHandler(async (req: Request, res: Response) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  };

  successResponse(res, 200, healthData, 'Health check successful');
});

/**
 * Detailed health check
 * @route GET /health/detailed
 */
export const detailedHealth = asyncHandler(
  async (req: Request, res: Response) => {
    const health = await systemMonitoringService.getCurrentMetrics();

    // Set appropriate status code based on health status
    const statusCode =
      health.cpu.usage < 90 && health.memory.usedPercent < 90 ? 200 : 503;

    successResponse(res, statusCode, health, 'Detailed health check completed');
  }
);

/**
 * Get system metrics
 * @route GET /health/metrics
 */
export const getMetrics = asyncHandler(async (req: Request, res: Response) => {
  const metrics = await systemMonitoringService.getCurrentMetrics();
  successResponse(res, 200, metrics, 'System metrics retrieved successfully');
});

/**
 * Get metrics history
 * @route GET /health/metrics/history
 */
export const getMetricsHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const startTime = req.query.startTime
      ? new Date(req.query.startTime as string)
      : undefined;
    const endTime = req.query.endTime
      ? new Date(req.query.endTime as string)
      : undefined;

    const history = await systemMonitoringService.getMetricsHistory(
      startTime,
      endTime
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
 * Get database status
 * @route GET /health/database
 */
export const getDatabaseStatus = asyncHandler(
  async (req: Request, res: Response) => {
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
 * Get system information
 * @route GET /health/system
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
    };

    successResponse(
      res,
      200,
      systemInfo,
      'System information retrieved successfully'
    );
  }
);
