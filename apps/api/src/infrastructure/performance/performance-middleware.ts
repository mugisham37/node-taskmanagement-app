import { MultiLayerCache } from '@taskmanagement/cache';
import { CompressionMiddleware, Logger, RequestBatchingMiddleware } from '@taskmanagement/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import { performance } from 'perf_hooks';

export interface PerformanceConfig {
  enableCaching: boolean;
  enableCompression: boolean;
  enableBatching: boolean;
  enableMetrics: boolean;
  slowQueryThreshold: number;
  cacheConfig: {
    defaultTtl: number;
    maxSize: number;
  };
}

export class PerformanceMiddleware {
  private cache?: MultiLayerCache;
  private compression?: CompressionMiddleware;
  private batching?: RequestBatchingMiddleware;
  private metrics: Map<string, number[]> = new Map();

  constructor(
    private config: PerformanceConfig,
    private logger: Logger
  ) {
    // Initialize cache
    if (config.enableCaching) {
      this.cache = new MultiLayerCache(config.cacheConfig);
    }

    // Initialize compression
    if (config.enableCompression) {
      this.compression = new CompressionMiddleware({
        threshold: 1024,
        level: 6,
        enableBrotli: true,
      });
    }

    // Initialize batching
    if (config.enableBatching) {
      this.batching = new RequestBatchingMiddleware({
        maxBatchSize: 10,
        batchTimeout: 100,
      });
    }
  }

  // Main performance middleware
  middleware() {
    return async (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      const startTime = performance.now();

      // Add performance tracking
      request.performance = {
        startTime,
        marks: new Map(),
        measures: new Map(),
      };

      // Mark request start
      this.mark(request, 'request-start');

      // Add response time header
      reply.header('X-Response-Time-Start', startTime.toString());

      // Override reply.send to measure total time
      const originalSend = reply.send.bind(reply);
      reply.send = (payload: any) => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Add response time header
        reply.header('X-Response-Time', `${duration.toFixed(2)}ms`);

        // Record metrics
        if (this.config.enableMetrics) {
          this.recordMetric(`${request.method}:${request.url}`, duration);

          // Log slow requests
          if (duration > this.config.slowQueryThreshold) {
            this.logger.warn('Slow request detected', {
              method: request.method,
              url: request.url,
              duration: `${duration.toFixed(2)}ms`,
              userAgent: request.headers['user-agent'],
            });
          }
        }

        return originalSend(payload);
      };

      done();
    };
  }

  // Caching middleware
  cacheMiddleware(options: { ttl?: number; keyGenerator?: (req: FastifyRequest) => string } = {}) {
    if (!this.cache) {
      return async (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
        done();
      };
    }

    return async (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      // Only cache GET requests
      if (request.method !== 'GET') {
        done();
        return;
      }

      const cacheKey = options.keyGenerator
        ? options.keyGenerator(request)
        : `${request.method}:${request.url}`;

      this.mark(request, 'cache-check-start');

      // Try to get from cache
      const cached = await this.cache.get(cacheKey);

      this.mark(request, 'cache-check-end');
      this.measure(request, 'cache-check', 'cache-check-start', 'cache-check-end');

      if (cached) {
        reply.header('X-Cache', 'HIT');
        reply.header('X-Cache-Key', cacheKey);
        reply.send(cached);
        return;
      }

      reply.header('X-Cache', 'MISS');
      reply.header('X-Cache-Key', cacheKey);

      // Override reply.send to cache the response
      const originalSend = reply.send.bind(reply);
      reply.send = (payload: any) => {
        if (reply.statusCode === 200 && payload) {
          this.mark(request, 'cache-set-start');
          this.cache
            .set(cacheKey, payload, options.ttl)
            .then(() => {
              this.mark(request, 'cache-set-end');
              this.measure(request, 'cache-set', 'cache-set-start', 'cache-set-end');
            })
            .catch((error: Error) => {
              this.logger.warn('Cache set failed', { cacheKey, error: error.message });
            });
        }
        return originalSend(payload);
      };

      done();
    };
  }

  // Database query optimization middleware
  queryOptimizationMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      // Add query tracking to request context
      request.queryMetrics = {
        queries: [],
        totalTime: 0,
        slowQueries: [],
      };

      // Override reply.send to analyze queries after response
      const originalSend = reply.send.bind(reply);
      reply.send = (payload: any) => {
        const queryMetrics = request.queryMetrics;

        if (queryMetrics && queryMetrics.queries.length > 0) {
          reply.header('X-Query-Count', queryMetrics.queries.length.toString());
          reply.header('X-Query-Time', `${queryMetrics.totalTime.toFixed(2)}ms`);

          // Log slow queries
          if (queryMetrics.slowQueries.length > 0) {
            this.logger.warn('Slow queries detected', {
              url: request.url,
              slowQueries: queryMetrics.slowQueries,
            });
          }
        }

        return originalSend(payload);
      };

      done();
    };
  }

  // Rate limiting middleware
  rateLimitingMiddleware(options: {
    windowMs: number;
    max: number;
    keyGenerator?: (req: FastifyRequest) => string;
  }) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return async (request: FastifyRequest, reply: FastifyReply) => {
      const key = options.keyGenerator ? options.keyGenerator(request) : request.ip;

      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Clean up old entries
      for (const [k, v] of requests.entries()) {
        if (v.resetTime < windowStart) {
          requests.delete(k);
        }
      }

      // Get or create request count
      let requestData = requests.get(key);
      if (!requestData || requestData.resetTime < windowStart) {
        requestData = { count: 0, resetTime: now + options.windowMs };
        requests.set(key, requestData);
      }

      requestData.count++;

      // Add rate limit headers
      reply.header('X-RateLimit-Limit', options.max.toString());
      reply.header(
        'X-RateLimit-Remaining',
        Math.max(0, options.max - requestData.count).toString()
      );
      reply.header('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());

      // Check if rate limit exceeded
      if (requestData.count > options.max) {
        reply.code(429).send({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
        });
        return;
      }
    };
  }

  // Memory usage monitoring
  memoryMonitoringMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      const memBefore = process.memoryUsage();

      // Override reply.send to monitor memory usage
      const originalSend = reply.send.bind(reply);
      reply.send = (payload: any) => {
        const memAfter = process.memoryUsage();
        const memDiff = {
          rss: memAfter.rss - memBefore.rss,
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          heapTotal: memAfter.heapTotal - memBefore.heapTotal,
          external: memAfter.external - memBefore.external,
        };

        // Add memory usage headers (in development)
        if (process.env.NODE_ENV === 'development') {
          reply.header('X-Memory-RSS', `${(memAfter.rss / 1024 / 1024).toFixed(2)}MB`);
          reply.header('X-Memory-Heap', `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }

        // Log high memory usage
        if (memAfter.heapUsed > 500 * 1024 * 1024) {
          // 500MB
          this.logger.warn('High memory usage detected', {
            url: request.url,
            memoryUsage: memAfter,
            memoryDiff: memDiff,
          });
        }

        return originalSend(payload);
      };

      done();
    };
  }

  // Performance marks and measures
  mark(request: FastifyRequest, name: string): void {
    if (request.performance) {
      request.performance.marks.set(name, performance.now());
    }
  }

  measure(request: FastifyRequest, name: string, startMark: string, endMark: string): number {
    if (!request.performance) return 0;

    const startTime = request.performance.marks.get(startMark);
    const endTime = request.performance.marks.get(endMark);

    if (startTime && endTime) {
      const duration = endTime - startTime;
      request.performance.measures.set(name, duration);
      return duration;
    }

    return 0;
  }

  // Record performance metrics
  private recordMetric(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const values = this.metrics.get(key)!;
    values.push(value);

    // Keep only last 100 values
    if (values.length > 100) {
      values.splice(0, values.length - 100);
    }
  }

  // Get performance statistics
  getPerformanceStats(): Record<
    string,
    {
      count: number;
      avg: number;
      min: number;
      max: number;
      p95: number;
    }
  > {
    const stats: Record<string, any> = {};

    for (const [key, values] of this.metrics.entries()) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);

      stats[key] = {
        count: values.length,
        avg: sum / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      };
    }

    return stats;
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Extend FastifyRequest interface
declare module 'fastify' {
  interface FastifyRequest {
    performance?: {
      startTime: number;
      marks: Map<string, number>;
      measures: Map<string, number>;
    };
    queryMetrics?: {
      queries: Array<{ query: string; duration: number }>;
      totalTime: number;
      slowQueries: Array<{ query: string; duration: number }>;
    };
  }
}
