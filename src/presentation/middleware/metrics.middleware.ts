import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../../infrastructure/monitoring/metrics.service';
import { logError } from '../../config/logger';

export interface MetricsRequest extends Request {
  startTime?: number;
  metricsLabels?: {
    userId?: string;
    workspaceId?: string;
    route?: string;
  };
}

/**
 * Middleware to collect HTTP request metrics
 */
export const metricsMiddleware = (
  req: MetricsRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip metrics collection for metrics endpoints to avoid recursion
  if (req.path.startsWith('/metrics') || req.path.startsWith('/health')) {
    return next();
  }

  // Record request start time
  req.startTime = Date.now();

  // Extract route pattern (remove IDs and query params)
  const route = extractRoutePattern(req.path);

  // Set up metrics labels
  req.metricsLabels = {
    route,
    userId: (req as any).user?.id,
    workspaceId: (req as any).user?.workspaceId,
  };

  // Hook into response finish event
  res.on('finish', () => {
    try {
      const duration = Date.now() - (req.startTime || Date.now());

      // Record HTTP request metrics
      metricsService.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration,
        req.metricsLabels?.userId,
        req.metricsLabels?.workspaceId
      );

      // Record error if status code indicates error
      if (res.statusCode >= 400) {
        const errorType =
          res.statusCode >= 500 ? 'server_error' : 'client_error';
        const severity = res.statusCode >= 500 ? 'high' : 'medium';

        metricsService.recordError(errorType, severity, 'http_request');
      }

      // Record user action if authenticated
      if (req.metricsLabels?.userId && req.method !== 'GET') {
        const action = `${req.method.toLowerCase()}_${route.replace(/\//g, '_')}`;
        metricsService.recordUserAction(
          action,
          req.metricsLabels.userId,
          req.metricsLabels.workspaceId,
          {
            method: req.method,
            status_code: res.statusCode.toString(),
          }
        );
      }
    } catch (error) {
      logError(error as Error, 'Failed to record request metrics');
    }
  });

  next();
};

/**
 * Extract route pattern from request path
 * Converts /api/v1/tasks/123/comments/456 to /api/v1/tasks/:id/comments/:id
 */
function extractRoutePattern(path: string): string {
  return (
    path
      // Replace UUIDs and numeric IDs with :id
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id'
      )
      .replace(/\/\d+/g, '/:id')
      // Remove query parameters
      .split('?')[0]
      // Normalize trailing slashes
      .replace(/\/$/, '') || '/'
  );
}

/**
 * Middleware to record business operation metrics
 */
export const recordBusinessOperation = (operation: string, entity: string) => {
  return (req: MetricsRequest, res: Response, next: NextFunction): void => {
    // Hook into response finish event
    res.on('finish', () => {
      try {
        const result = res.statusCode < 400 ? 'success' : 'failure';

        metricsService.recordBusinessOperation(
          operation,
          entity,
          result,
          req.metricsLabels?.userId,
          req.metricsLabels?.workspaceId
        );
      } catch (error) {
        logError(error as Error, 'Failed to record business operation metrics');
      }
    });

    next();
  };
};

/**
 * Middleware to record cache operation metrics
 */
export const recordCacheMetrics = (
  operation: 'get' | 'set' | 'delete',
  result: 'hit' | 'miss' | 'error',
  duration: number
): void => {
  try {
    metricsService.recordCacheOperation(operation, result, duration);
  } catch (error) {
    logError(error as Error, 'Failed to record cache metrics');
  }
};

/**
 * Middleware to record database connection metrics
 */
export const recordDatabaseMetrics = (
  state: 'active' | 'idle' | 'waiting',
  count: number
): void => {
  try {
    metricsService.recordDatabaseConnection(state, count);
  } catch (error) {
    logError(error as Error, 'Failed to record database metrics');
  }
};

/**
 * Function to record custom business metrics
 */
export const recordCustomMetric = (
  name: string,
  value: number,
  labels?: Record<string, string | number>,
  help?: string
): void => {
  try {
    metricsService.recordBusinessMetric({
      name,
      value,
      labels,
      help,
    });
  } catch (error) {
    logError(error as Error, 'Failed to record custom metric');
  }
};
