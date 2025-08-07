import type { Request, Response, NextFunction } from 'express'
import logger from '../config/logger'

/**
 * Performance monitoring utilities for tracking request performance
 * and system metrics
 */

interface PerformanceMetrics {
  requestId?: string
  method: string
  url: string
  statusCode: number
  duration: number
  timestamp: Date
  userId?: string
  userAgent?: string
  ip?: string
  memoryUsage?: NodeJS.MemoryUsage
  cpuUsage?: NodeJS.CpuUsage
}

interface SystemMetrics {
  timestamp: Date
  memoryUsage: NodeJS.MemoryUsage
  cpuUsage: NodeJS.CpuUsage
  uptime: number
  loadAverage?: number[]
}

// Store metrics in memory (in production, you'd want to use a proper metrics store)
const performanceMetrics: PerformanceMetrics[] = []
const systemMetrics: SystemMetrics[] = []
const MAX_METRICS_HISTORY = 1000

// Performance thresholds
const SLOW_REQUEST_THRESHOLD = 1000 // 1 second
const VERY_SLOW_REQUEST_THRESHOLD = 5000 // 5 seconds
const MEMORY_WARNING_THRESHOLD = 100 * 1024 * 1024 // 100MB

/**
 * Middleware to monitor request performance
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  // Skip for certain paths
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/metrics') {
    return next()
  }

  // Record start time and CPU usage
  const startTime = process.hrtime.bigint()
  const startCpuUsage = process.cpuUsage()
  const startMemory = process.memoryUsage()

  // Add request ID if not present
  const requestId = (req as any).requestId || 
                   req.headers['x-request-id'] || 
                   Math.random().toString(36).substring(2, 15)
  
  ;(req as any).requestId = requestId

  // Add response finish listener
  res.on('finish', () => {
    try {
      // Calculate duration in nanoseconds, then convert to milliseconds
      const endTime = process.hrtime.bigint()
      const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds

      // Calculate CPU usage
      const endCpuUsage = process.cpuUsage(startCpuUsage)
      const endMemory = process.memoryUsage()

      // Create performance metrics
      const metrics: PerformanceMetrics = {
        requestId: requestId as string,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date(),
        userId: (req as any).user?.id,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        memoryUsage: endMemory,
        cpuUsage: endCpuUsage,
      }

      // Store metrics (keep only last MAX_METRICS_HISTORY entries)
      performanceMetrics.push(metrics)
      if (performanceMetrics.length > MAX_METRICS_HISTORY) {
        performanceMetrics.shift()
      }

      // Log slow requests
      if (duration > VERY_SLOW_REQUEST_THRESHOLD) {
        logger.error('Very slow request detected', {
          ...metrics,
          severity: 'critical',
        })
      } else if (duration > SLOW_REQUEST_THRESHOLD) {
        logger.warn('Slow request detected', {
          ...metrics,
          severity: 'warning',
        })
      }

      // Log memory warnings
      if (endMemory.heapUsed > MEMORY_WARNING_THRESHOLD) {
        logger.warn('High memory usage detected', {
          memoryUsage: endMemory,
          requestId,
          url: req.originalUrl,
        })
      }

      // Add performance headers
      res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`)
      res.setHeader('X-Request-ID', requestId)

      // Add CPU and memory headers in development
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('X-CPU-User', `${endCpuUsage.user}μs`)
        res.setHeader('X-CPU-System', `${endCpuUsage.system}μs`)
        res.setHeader('X-Memory-Used', `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`)
      }
    } catch (error) {
      logger.error('Error in performance monitoring:', error)
    }
  })

  next()
}

/**
 * Get performance statistics
 */
export const getPerformanceStats = (): {
  totalRequests: number
  averageResponseTime: number
  slowRequests: number
  verySlowRequests: number
  errorRate: number
  requestsPerMinute: number
  memoryUsage: NodeJS.MemoryUsage
  uptime: number
} => {
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
  
  const recentMetrics = performanceMetrics.filter(m => m.timestamp >= oneMinuteAgo)
  const totalRequests = performanceMetrics.length
  
  const averageResponseTime = totalRequests > 0 
    ? performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
    : 0

  const slowRequests = performanceMetrics.filter(m => 
    m.duration > SLOW_REQUEST_THRESHOLD && m.duration <= VERY_SLOW_REQUEST_THRESHOLD
  ).length

  const verySlowRequests = performanceMetrics.filter(m => 
    m.duration > VERY_SLOW_REQUEST_THRESHOLD
  ).length

  const errorRequests = performanceMetrics.filter(m => m.statusCode >= 400).length
  const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0

  return {
    totalRequests,
    averageResponseTime: Math.round(averageResponseTime * 100) / 100,
    slowRequests,
    verySlowRequests,
    errorRate: Math.round(errorRate * 100) / 100,
    requestsPerMinute: recentMetrics.length,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  }
}

/**
 * Get detailed performance metrics
 */
export const getDetailedMetrics = (limit: number = 100): PerformanceMetrics[] => {
  return performanceMetrics
    .slice(-limit)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Get metrics for a specific time range
 */
export const getMetricsByTimeRange = (
  startTime: Date,
  endTime: Date
): PerformanceMetrics[] => {
  return performanceMetrics.filter(m => 
    m.timestamp >= startTime && m.timestamp <= endTime
  )
}

/**
 * Get metrics grouped by endpoint
 */
export const getMetricsByEndpoint = (): Record<string, {
  count: number
  averageResponseTime: number
  errorRate: number
  slowRequests: number
}> => {
  const endpointMetrics: Record<string, PerformanceMetrics[]> = {}
  
  // Group metrics by endpoint
  performanceMetrics.forEach(metric => {
    const endpoint = `${metric.method} ${metric.url.split('?')[0]}` // Remove query params
    if (!endpointMetrics[endpoint]) {
      endpointMetrics[endpoint] = []
    }
    endpointMetrics[endpoint].push(metric)
  })

  // Calculate statistics for each endpoint
  const result: Record<string, any> = {}
  Object.entries(endpointMetrics).forEach(([endpoint, metrics]) => {
    const count = metrics.length
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.duration, 0) / count
    const errorRequests = metrics.filter(m => m.statusCode >= 400).length
    const errorRate = (errorRequests / count) * 100
    const slowRequests = metrics.filter(m => m.duration > SLOW_REQUEST_THRESHOLD).length

    result[endpoint] = {
      count,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      slowRequests,
    }
  })

  return result
}

/**
 * Clear performance metrics
 */
export const clearMetrics = (): void => {
  performanceMetrics.length = 0
  systemMetrics.length = 0
}

/**
 * System metrics collector
 */
export const collectSystemMetrics = (): void => {
  const metrics: SystemMetrics = {
    timestamp: new Date(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: process.uptime(),
  }

  // Add load average on Unix systems
  if (process.platform !== 'win32') {
    try {
      const os = require('os')
      metrics.loadAverage = os.loadavg()
    } catch (error) {
      // Ignore error if os module is not available
    }
  }

  systemMetrics.push(metrics)
  if (systemMetrics.length > MAX_METRICS_HISTORY) {
    systemMetrics.shift()
  }
}

/**
 * Start system metrics collection
 */
export const startSystemMetricsCollection = (intervalMs: number = 30000): NodeJS.Timeout => {
  // Collect initial metrics
  collectSystemMetrics()
  
  // Set up interval collection
  return setInterval(collectSystemMetrics, intervalMs)
}

/**
 * Get system metrics
 */
export const getSystemMetrics = (limit: number = 100): SystemMetrics[] => {
  return systemMetrics
    .slice(-limit)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Performance profiler for specific functions
 */
export const profileFunction = <T extends any[], R>(
  fn: (...args: T) => R | Promise<R>,
  name: string
) => {
  return async (...args: T): Promise<R> => {
    const startTime = process.hrtime.bigint()
    const startCpuUsage = process.cpuUsage()
    
    try {
      const result = await Promise.resolve(fn(...args))
      const endTime = process.hrtime.bigint()
      const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds
      const cpuUsage = process.cpuUsage(startCpuUsage)
      
      logger.debug(`Function ${name} executed`, {
        duration: `${duration.toFixed(2)}ms`,
        cpuUser: `${cpuUsage.user}μs`,
        cpuSystem: `${cpuUsage.system}μs`,
      })
      
      return result
    } catch (error) {
      const endTime = process.hrtime.bigint()
      const duration = Number(endTime - startTime) / 1000000
      
      logger.error(`Function ${name} failed`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error),
      })
      
      throw error
    }
  }
}

/**
 * Memory usage tracker
 */
export const trackMemoryUsage = (label: string): void => {
  const usage = process.memoryUsage()
  logger.debug(`Memory usage - ${label}`, {
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
  })
}

/**
 * Create a performance timer
 */
export const createTimer = (label: string) => {
  const startTime = process.hrtime.bigint()
  
  return {
    end: () => {
      const endTime = process.hrtime.bigint()
      const duration = Number(endTime - startTime) / 1000000
      logger.debug(`Timer ${label}`, { duration: `${duration.toFixed(2)}ms` })
      return duration
    }
  }
}

export default {
  performanceMonitor,
  getPerformanceStats,
  getDetailedMetrics,
  getMetricsByTimeRange,
  getMetricsByEndpoint,
  clearMetrics,
  collectSystemMetrics,
  startSystemMetricsCollection,
  getSystemMetrics,
  profileFunction,
  trackMemoryUsage,
  createTimer,
}
