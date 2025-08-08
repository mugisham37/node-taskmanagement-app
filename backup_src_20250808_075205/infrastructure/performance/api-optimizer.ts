import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { logger } from '../logging/logger';
import { cache } from '../../utils/cache';

/**
 * API Performance Optimizer
 * Provides comprehensive API performance optimization including response compression,
 * caching, pagination optimization, and bulk operations
 */

export interface ApiPerformanceMetrics {
  endpoint: string;
  method: string;
  averageResponseTime: number;
  requestCount: number;
  errorRate: number;
  cacheHitRate: number;
  compressionRatio: number;
  lastOptimized: Date;
}

export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  allowUnlimited: boolean;
  optimizeForLargeDatasets: boolean;
}

export interface BulkOperationConfig {
  maxBatchSize: number;
  enableParallelProcessing: boolean;
  timeoutMs: number;
  retryAttempts: number;
}

export class ApiOptimizer {
  private performanceMetrics = new Map<string, ApiPerformanceMetrics>();
  private paginationConfig: PaginationConfig = {
    defaultLimit: 20,
    maxLimit: 100,
    allowUnlimited: false,
    optimizeForLargeDatasets: true,
  };
  private bulkConfig: BulkOperationConfig = {
    maxBatchSize: 1000,
    enableParallelProcessing: true,
    timeoutMs: 30000,
    retryAttempts: 3,
  };

  /**
   * Response compression middleware with intelligent compression
   */
  getCompressionMiddleware() {
    return compression({
      // Compress responses larger than 1KB
      threshold: 1024,

      // Compression level (1-9, 6 is default balance of speed/compression)
      level: 6,

      // Only compress specific content types
      filter: (req: Request, res: Response) => {
        // Don't compress if client doesn't support it
        if (!req.headers['accept-encoding']?.includes('gzip')) {
          return false;
        }

        // Don't compress already compressed content
        const contentType = res.getHeader('content-type') as string;
        if (
          contentType?.includes('image/') ||
          contentType?.includes('video/') ||
          contentType?.includes('audio/')
        ) {
          return false;
        }

        // Compress JSON, HTML, CSS, JS, and text
        return /json|text|javascript|css|html/.test(contentType || '');
      },

      // Custom compression for different content types
      strategy: compression.constants.Z_DEFAULT_STRATEGY,
    });
  }

  /**
   * Response caching middleware with intelligent cache headers
   */
  getCachingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const startTime = Date.now();

      res.send = function (data: any) {
        const responseTime = Date.now() - startTime;
        const endpoint = `${req.method} ${req.route?.path || req.path}`;

        // Update performance metrics
        const metrics = this.updatePerformanceMetrics(
          endpoint,
          responseTime,
          res.statusCode
        );

        // Set cache headers based on endpoint and response
        this.setCacheHeaders(req, res, data);

        // Set performance headers
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        res.setHeader(
          'X-Cache-Status',
          res.getHeader('X-Cache-Hit') ? 'HIT' : 'MISS'
        );

        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  /**
   * Set intelligent cache headers based on content and endpoint
   */
  private setCacheHeaders(req: Request, res: Response, data: any): void {
    const method = req.method;
    const path = req.path;
    const statusCode = res.statusCode;

    // Don't cache errors or non-GET requests
    if (statusCode >= 400 || method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }

    // Generate ETag for cache validation
    if (data) {
      const etag = this.generateETag(data);
      res.setHeader('ETag', etag);

      // Check if client has cached version
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
    }

    // Set cache duration based on endpoint type
    let maxAge = 60; // Default 1 minute

    if (path.includes('/static/') || path.includes('/assets/')) {
      maxAge = 3600; // 1 hour for static assets
    } else if (path.includes('/api/users/profile')) {
      maxAge = 300; // 5 minutes for user profiles
    } else if (path.includes('/api/tasks') || path.includes('/api/projects')) {
      maxAge = 180; // 3 minutes for task/project data
    } else if (
      path.includes('/api/analytics') ||
      path.includes('/api/dashboard')
    ) {
      maxAge = 600; // 10 minutes for analytics
    }

    res.setHeader(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=60`
    );
    res.setHeader('Last-Modified', new Date().toUTCString());
  }

  /**
   * Generate ETag for response data
   */
  private generateETag(data: any): string {
    const crypto = require('crypto');
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
  }

  /**
   * Pagination optimization middleware
   */
  getPaginationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Parse pagination parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        this.paginationConfig.maxLimit,
        Math.max(
          1,
          parseInt(req.query.limit as string) ||
            this.paginationConfig.defaultLimit
        )
      );
      const offset = (page - 1) * limit;

      // Add pagination info to request
      (req as any).pagination = {
        page,
        limit,
        offset,
        optimized: true,
      };

      // Optimize query for large datasets
      if (this.paginationConfig.optimizeForLargeDatasets) {
        // Add cursor-based pagination support
        const cursor = req.query.cursor as string;
        if (cursor) {
          (req as any).pagination.cursor = cursor;
          (req as any).pagination.useCursor = true;
        }
      }

      // Override response to add pagination metadata
      const originalJson = res.json;
      res.json = function (data: any) {
        if (
          Array.isArray(data) ||
          (data && data.items && Array.isArray(data.items))
        ) {
          const items = Array.isArray(data) ? data : data.items;
          const total = data.total || items.length;

          const paginationMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
            nextCursor: items.length > 0 ? items[items.length - 1].id : null,
          };

          const response = Array.isArray(data)
            ? {
                items: data,
                pagination: paginationMeta,
              }
            : {
                ...data,
                pagination: paginationMeta,
              };

          return originalJson.call(this, response);
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Bulk operations middleware for batch processing
   */
  getBulkOperationsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only apply to bulk endpoints
      if (!req.path.includes('/bulk') && !req.body?.bulk) {
        return next();
      }

      const operations = req.body.operations || req.body.items || [];

      // Validate batch size
      if (operations.length > this.bulkConfig.maxBatchSize) {
        return res.status(400).json({
          error: 'Batch size exceeds maximum allowed',
          maxBatchSize: this.bulkConfig.maxBatchSize,
          receivedSize: operations.length,
        });
      }

      // Add bulk processing context
      (req as any).bulk = {
        operations,
        batchSize: operations.length,
        enableParallel: this.bulkConfig.enableParallelProcessing,
        timeout: this.bulkConfig.timeoutMs,
      };

      // Set timeout for bulk operations
      req.setTimeout(this.bulkConfig.timeoutMs);

      next();
    };
  }

  /**
   * Process bulk operations with parallel processing
   */
  async processBulkOperations<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      parallel?: boolean;
      retryAttempts?: number;
    } = {}
  ): Promise<{
    results: R[];
    errors: Array<{ item: T; error: any }>;
    stats: {
      processed: number;
      failed: number;
      duration: number;
    };
  }> {
    const startTime = Date.now();
    const batchSize = options.batchSize || this.bulkConfig.maxBatchSize;
    const parallel =
      options.parallel ?? this.bulkConfig.enableParallelProcessing;
    const retryAttempts =
      options.retryAttempts || this.bulkConfig.retryAttempts;

    const results: R[] = [];
    const errors: Array<{ item: T; error: any }> = [];

    if (parallel) {
      // Process in parallel batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(async item => {
          let attempts = 0;
          while (attempts < retryAttempts) {
            try {
              return await processor(item);
            } catch (error) {
              attempts++;
              if (attempts >= retryAttempts) {
                errors.push({ item, error });
                return null;
              }
              // Exponential backoff
              await new Promise(resolve =>
                setTimeout(resolve, Math.pow(2, attempts) * 100)
              );
            }
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value !== null) {
            results.push(result.value);
          }
        });
      }
    } else {
      // Process sequentially
      for (const item of items) {
        let attempts = 0;
        while (attempts < retryAttempts) {
          try {
            const result = await processor(item);
            results.push(result);
            break;
          } catch (error) {
            attempts++;
            if (attempts >= retryAttempts) {
              errors.push({ item, error });
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      results,
      errors,
      stats: {
        processed: results.length,
        failed: errors.length,
        duration,
      },
    };
  }

  /**
   * Update performance metrics for endpoint
   */
  private updatePerformanceMetrics(
    endpoint: string,
    responseTime: number,
    statusCode: number
  ): ApiPerformanceMetrics {
    const existing = this.performanceMetrics.get(endpoint);

    if (existing) {
      existing.averageResponseTime =
        (existing.averageResponseTime * existing.requestCount + responseTime) /
        (existing.requestCount + 1);
      existing.requestCount++;

      if (statusCode >= 400) {
        existing.errorRate =
          (existing.errorRate * (existing.requestCount - 1) + 1) /
          existing.requestCount;
      }
    } else {
      const metrics: ApiPerformanceMetrics = {
        endpoint,
        method: endpoint.split(' ')[0],
        averageResponseTime: responseTime,
        requestCount: 1,
        errorRate: statusCode >= 400 ? 1 : 0,
        cacheHitRate: 0,
        compressionRatio: 0,
        lastOptimized: new Date(),
      };
      this.performanceMetrics.set(endpoint, metrics);
    }

    return this.performanceMetrics.get(endpoint)!;
  }

  /**
   * Get performance metrics for all endpoints
   */
  getPerformanceMetrics(): Map<string, ApiPerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Get optimization recommendations for slow endpoints
   */
  getOptimizationRecommendations(): Array<{
    endpoint: string;
    issues: string[];
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations: Array<{
      endpoint: string;
      issues: string[];
      recommendations: string[];
      priority: 'high' | 'medium' | 'low';
    }> = [];

    this.performanceMetrics.forEach((metrics, endpoint) => {
      const issues: string[] = [];
      const recs: string[] = [];
      let priority: 'high' | 'medium' | 'low' = 'low';

      // Check response time
      if (metrics.averageResponseTime > 1000) {
        issues.push('High average response time');
        recs.push('Optimize database queries and add caching');
        priority = 'high';
      } else if (metrics.averageResponseTime > 500) {
        issues.push('Moderate response time');
        recs.push('Consider adding response caching');
        priority = 'medium';
      }

      // Check error rate
      if (metrics.errorRate > 0.05) {
        issues.push('High error rate');
        recs.push('Review error handling and input validation');
        priority = 'high';
      }

      // Check cache hit rate
      if (metrics.cacheHitRate < 0.3 && metrics.requestCount > 100) {
        issues.push('Low cache hit rate');
        recs.push('Improve caching strategy and cache key design');
        if (priority === 'low') priority = 'medium';
      }

      if (issues.length > 0) {
        recommendations.push({
          endpoint,
          issues,
          recommendations: recs,
          priority,
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Configure pagination settings
   */
  configurePagination(config: Partial<PaginationConfig>): void {
    this.paginationConfig = { ...this.paginationConfig, ...config };
  }

  /**
   * Configure bulk operation settings
   */
  configureBulkOperations(config: Partial<BulkOperationConfig>): void {
    this.bulkConfig = { ...this.bulkConfig, ...config };
  }
}

export const apiOptimizer = new ApiOptimizer();
