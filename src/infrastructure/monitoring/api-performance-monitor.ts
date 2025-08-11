import { FastifyRequest, FastifyReply } from 'fastify';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface APIPerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  requestSize: number;
  responseSize: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export interface EndpointStatistics {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number; // requests per second
  lastUpdated: Date;
}

export interface PerformanceAlert {
  type:
    | 'HIGH_RESPONSE_TIME'
    | 'HIGH_ERROR_RATE'
    | 'HIGH_THROUGHPUT'
    | 'MEMORY_USAGE';
  endpoint?: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PerformanceConfig {
  responseTimeThreshold: number;
  errorRateThreshold: number;
  throughputThreshold: number;
  memoryThreshold: number;
  enableCompression: boolean;
  enableCaching: boolean;
  maxRequestSize: number;
  maxResponseSize: number;
}

export class APIPerformanceMonitor {
  private metrics: APIPerformanceMetrics[] = [];
  private endpointStats: Map<string, EndpointStatistics> = new Map();
  private alerts: PerformanceAlert[] = [];
  private maxMetricsSize = 10000;

  constructor(private readonly config: PerformanceConfig) {}

  /**
   * Middleware to monitor API performance
   */
  createPerformanceMiddleware() {
    const self = this;
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();

      // Monitor request size
      const requestSize = self.calculateRequestSize(request);
      if (requestSize > self.config.maxRequestSize) {
        throw new InfrastructureError(
          `Request size exceeds limit: ${requestSize} bytes`
        );
      }

      // Add response time header
      reply.header('X-Response-Time-Start', startTime.toString());

      // Override the send method to capture metrics
      const originalSend = reply.send.bind(reply);
      reply.send = function(payload: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const responseSize = self.calculateResponseSize(payload);

        // Check response size limit
        if (responseSize > self.config.maxResponseSize) {
          console.warn(
            `Response size exceeds limit: ${responseSize} bytes for ${request.url || ''}`
          );
        }

        // Create performance metric
        const userId = self.extractUserId(request);
        const userAgent = request.headers['user-agent'];
        
        const metric: APIPerformanceMetrics = {
          endpoint: self.normalizeEndpoint(request.url || ''),
          method: request.method,
          responseTime,
          statusCode: reply.statusCode,
          requestSize,
          responseSize,
          timestamp: new Date(),
          ip: request.ip,
        };

        // Add optional properties only if they exist
        if (userId) metric.userId = userId;
        if (userAgent) metric.userAgent = userAgent;

        // Record metric
        self.recordMetric(metric);

        // Update endpoint statistics
        self.updateEndpointStatistics(metric);

        // Check for performance alerts
        self.checkPerformanceAlerts(metric);

        // Add performance headers
        reply.header('X-Response-Time', `${responseTime}ms`);
        reply.header('X-Response-Size', `${responseSize} bytes`);

        return originalSend(payload);
      };
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: APIPerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep metrics array size manageable
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }
  }

  /**
   * Update endpoint statistics
   */
  updateEndpointStatistics(metric: APIPerformanceMetrics): void {
    const key = `${metric.method}:${metric.endpoint}`;
    const existing = this.endpointStats.get(key);

    if (existing) {
      // Update existing statistics
      const totalRequests = existing.totalRequests + 1;
      const totalResponseTime =
        existing.averageResponseTime * existing.totalRequests +
        metric.responseTime;
      const averageResponseTime = totalResponseTime / totalRequests;
      const errorCount =
        existing.errorRate * existing.totalRequests +
        (metric.statusCode >= 400 ? 1 : 0);
      const errorRate = errorCount / totalRequests;

      const updated: EndpointStatistics = {
        ...existing,
        totalRequests,
        averageResponseTime,
        minResponseTime: Math.min(
          existing.minResponseTime,
          metric.responseTime
        ),
        maxResponseTime: Math.max(
          existing.maxResponseTime,
          metric.responseTime
        ),
        errorRate,
        lastUpdated: new Date(),
      };

      // Calculate percentiles
      const recentMetrics = this.getRecentMetricsForEndpoint(key, 1000);
      const responseTimes = recentMetrics
        .map(m => m.responseTime)
        .sort((a, b) => a - b);
      updated.p95ResponseTime = this.calculatePercentile(responseTimes, 95);
      updated.p99ResponseTime = this.calculatePercentile(responseTimes, 99);

      // Calculate throughput (requests per second over last minute)
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const recentRequests = recentMetrics.filter(
        m => m.timestamp > oneMinuteAgo
      );
      updated.throughput = recentRequests.length / 60;

      this.endpointStats.set(key, updated);
    } else {
      // Create new statistics
      const newStats: EndpointStatistics = {
        endpoint: metric.endpoint,
        method: metric.method,
        totalRequests: 1,
        averageResponseTime: metric.responseTime,
        minResponseTime: metric.responseTime,
        maxResponseTime: metric.responseTime,
        p95ResponseTime: metric.responseTime,
        p99ResponseTime: metric.responseTime,
        errorRate: metric.statusCode >= 400 ? 1 : 0,
        throughput: 1 / 60, // Assume 1 request per minute initially
        lastUpdated: new Date(),
      };

      this.endpointStats.set(key, newStats);
    }
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts(metric: APIPerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check response time threshold
    if (metric.responseTime > this.config.responseTimeThreshold) {
      alerts.push({
        type: 'HIGH_RESPONSE_TIME',
        endpoint: metric.endpoint,
        message: `High response time detected: ${metric.responseTime}ms`,
        value: metric.responseTime,
        threshold: this.config.responseTimeThreshold,
        timestamp: new Date(),
        severity:
          metric.responseTime > this.config.responseTimeThreshold * 2
            ? 'CRITICAL'
            : 'HIGH',
      });
    }

    // Check error rate
    const key = `${metric.method}:${metric.endpoint}`;
    const stats = this.endpointStats.get(key);
    if (stats && stats.errorRate > this.config.errorRateThreshold) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        endpoint: metric.endpoint,
        message: `High error rate detected: ${(stats.errorRate * 100).toFixed(2)}%`,
        value: stats.errorRate,
        threshold: this.config.errorRateThreshold,
        timestamp: new Date(),
        severity:
          stats.errorRate > this.config.errorRateThreshold * 2
            ? 'CRITICAL'
            : 'HIGH',
      });
    }

    // Check throughput
    if (stats && stats.throughput > this.config.throughputThreshold) {
      alerts.push({
        type: 'HIGH_THROUGHPUT',
        endpoint: metric.endpoint,
        message: `High throughput detected: ${stats.throughput.toFixed(2)} req/s`,
        value: stats.throughput,
        threshold: this.config.throughputThreshold,
        timestamp: new Date(),
        severity: 'MEDIUM',
      });
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    if (memoryUsagePercent > this.config.memoryThreshold) {
      alerts.push({
        type: 'MEMORY_USAGE',
        message: `High memory usage detected: ${(memoryUsagePercent * 100).toFixed(2)}%`,
        value: memoryUsagePercent,
        threshold: this.config.memoryThreshold,
        timestamp: new Date(),
        severity: memoryUsagePercent > 0.9 ? 'CRITICAL' : 'HIGH',
      });
    }

    // Add alerts to collection
    this.alerts.push(...alerts);

    // Log critical alerts
    alerts.forEach(alert => {
      if (alert.severity === 'CRITICAL') {
        console.error(`CRITICAL ALERT: ${alert.message}`);
      } else if (alert.severity === 'HIGH') {
        console.warn(`HIGH ALERT: ${alert.message}`);
      }
    });

    // Keep alerts array manageable
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * Get performance statistics for all endpoints
   */
  getEndpointStatistics(): EndpointStatistics[] {
    return Array.from(this.endpointStats.values()).sort(
      (a, b) => b.totalRequests - a.totalRequests
    );
  }

  /**
   * Get performance statistics for a specific endpoint
   */
  getEndpointStatistic(
    method: string,
    endpoint: string
  ): EndpointStatistics | null {
    const key = `${method}:${this.normalizeEndpoint(endpoint)}`;
    return this.endpointStats.get(key) || null;
  }

  /**
   * Get recent performance alerts
   */
  getRecentAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get overall system performance metrics
   */
  getSystemMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  } {
    const totalRequests = this.metrics.length;
    const averageResponseTime =
      totalRequests > 0
        ? this.metrics.reduce((sum, m) => sum + m.responseTime, 0) /
          totalRequests
        : 0;

    const errorCount = this.metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    // Calculate throughput over last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentRequests = this.metrics.filter(m => m.timestamp > oneMinuteAgo);
    const throughput = recentRequests.length / 60;

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      throughput,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: any;
    topEndpoints: EndpointStatistics[];
    slowestEndpoints: EndpointStatistics[];
    errorProneEndpoints: EndpointStatistics[];
    recentAlerts: PerformanceAlert[];
  } {
    const systemMetrics = this.getSystemMetrics();
    const allStats = this.getEndpointStatistics();

    return {
      summary: systemMetrics,
      topEndpoints: allStats.slice(0, 10),
      slowestEndpoints: allStats
        .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
        .slice(0, 10),
      errorProneEndpoints: allStats
        .filter(s => s.errorRate > 0)
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 10),
      recentAlerts: this.getRecentAlerts(20),
    };
  }

  /**
   * Clear old metrics and statistics
   */
  clearOldData(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    // Clear old metrics
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    // Clear old alerts
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime);

    console.log(`Cleared performance data older than ${olderThanHours} hours`);
  }

  private calculateRequestSize(request: FastifyRequest): number {
    let size = 0;

    // Add headers size
    size += JSON.stringify(request.headers).length;

    // Add URL size
    size += request.url.length;

    // Add body size if present
    if (request.body) {
      size += JSON.stringify(request.body).length;
    }

    return size;
  }

  private calculateResponseSize(payload: any): number {
    if (typeof payload === 'string') {
      return payload.length;
    }

    if (Buffer.isBuffer(payload)) {
      return payload.length;
    }

    if (typeof payload === 'object') {
      return JSON.stringify(payload).length;
    }

    return 0;
  }

  private normalizeEndpoint(url: string): string {
    // Remove query parameters
    const baseUrl = url.split('?')[0];

    // Replace IDs with placeholders
    return (baseUrl || '')
      .replace(/\/[0-9a-f-]{36}/g, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  private extractUserId(request: FastifyRequest): string | undefined {
    // Extract user ID from JWT token or session
    const user = (request as any).user;
    return user?.id || user?.userId;
  }

  private getRecentMetricsForEndpoint(
    key: string,
    limit: number
  ): APIPerformanceMetrics[] {
    const [method, endpoint] = key.split(':');
    return this.metrics
      .filter(m => m.method === method && m.endpoint === endpoint)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private calculatePercentile(
    sortedArray: number[],
    percentile: number
  ): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    const value = sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    return value || 0;
  }
}

export function createAPIPerformanceMonitor(
  config: PerformanceConfig
): APIPerformanceMonitor {
  return new APIPerformanceMonitor(config);
}
