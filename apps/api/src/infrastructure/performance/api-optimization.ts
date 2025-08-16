import { CacheService } from '@taskmanagement/cache';
import { NextFunction, Request, Response } from 'express';
import { RequestBatchingService } from './request-batching';
import { ResponseCompressionService } from './response-compression';

export interface APIOptimizationConfig {
  caching: {
    enabled: boolean;
    defaultTTL: number;
    cacheableStatusCodes: number[];
    cacheableMethods: string[];
    excludePaths: string[];
  };
  compression: {
    enabled: boolean;
    threshold: number;
    level: number;
  };
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    batchTimeout: number;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  pagination: {
    enabled: boolean;
    defaultLimit: number;
    maxLimit: number;
  };
  fieldSelection: {
    enabled: boolean;
    defaultFields: string[];
  };
}

export interface OptimizationStats {
  totalRequests: number;
  cachedResponses: number;
  compressedResponses: number;
  batchedRequests: number;
  averageResponseTime: number;
  bytesTransferred: number;
  bytesSaved: number;
}

export class APIOptimizationService {
  private stats: OptimizationStats = {
    totalRequests: 0,
    cachedResponses: 0,
    compressedResponses: 0,
    batchedRequests: 0,
    averageResponseTime: 0,
    bytesTransferred: 0,
    bytesSaved: 0,
  };

  constructor(
    private readonly config: APIOptimizationConfig,
    private readonly cacheService: CacheService,
    private readonly compressionService: ResponseCompressionService,
    private readonly batchingService: RequestBatchingService
  ) {}

  /**
   * Create comprehensive API optimization middleware
   */
  createOptimizationMiddleware() {
    return [
      this.createRequestTrackingMiddleware(),
      this.createCachingMiddleware(),
      this.createFieldSelectionMiddleware(),
      this.createPaginationMiddleware(),
      this.compressionService.createMiddleware(),
      this.batchingService.createMiddleware(),
    ];
  }

  /**
   * Create request tracking middleware
   */
  private createRequestTrackingMiddleware() {
    return (_req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      // Track response completion
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.updateResponseTimeStats(responseTime);

        // Track bytes transferred
        const contentLength = parseInt((res.getHeader('content-length') as string) || '0');
        this.stats.bytesTransferred += contentLength;
      });

      next();
    };
  }

  /**
   * Create response caching middleware
   */
  private createCachingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.caching.enabled) {
        return next();
      }

      // Only cache GET requests by default
      if (!this.config.caching.cacheableMethods.includes(req.method)) {
        return next();
      }

      // Check if path should be excluded
      if (this.isPathExcluded(req.path)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req);

      try {
        // Try to get cached response
        const cachedResponse = await this.cacheService.get(cacheKey);
        if (cachedResponse) {
          this.stats.cachedResponses++;

          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Key', cacheKey);

          return res.json(cachedResponse);
        }

        // Cache miss - intercept response to cache it
        const originalJson = res.json;
        const self = this;

        res.json = function (this: Response, body: any) {
          // Only cache successful responses
          if (
            this.statusCode &&
            self.config.caching.cacheableStatusCodes.includes(this.statusCode)
          ) {
            self.cacheService
              .set(cacheKey, body, {
                ttl: self.config.caching.defaultTTL,
                tags: self.generateCacheTags(req),
              })
              .catch((error: any) => {
                console.error('Failed to cache response:', error);
              });
          }

          this.setHeader('X-Cache', 'MISS');
          this.setHeader('X-Cache-Key', cacheKey);

          return originalJson.call(this, body);
        };
      } catch (error) {
        console.error('Caching middleware error:', error);
      }

      next();
    };
  }

  /**
   * Create field selection middleware
   */
  private createFieldSelectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.fieldSelection.enabled) {
        return next();
      }

      const fields = req.query['fields'] as string;
      if (!fields) {
        return next();
      }

      const selectedFields = fields.split(',').map((f) => f.trim());

      // Store selected fields in request for use by controllers
      (req as any).selectedFields = selectedFields;

      // Intercept response to filter fields
      const originalJson = res.json;
      const self = this;

      res.json = function (this: Response, body: any) {
        const filteredBody = self.filterResponseFields(body, selectedFields);
        return originalJson.call(this, filteredBody);
      };

      next();
    };
  }

  /**
   * Create pagination middleware
   */
  private createPaginationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.pagination.enabled) {
        return next();
      }

      // Parse pagination parameters
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(
        parseInt(req.query['limit'] as string) || this.config.pagination.defaultLimit,
        this.config.pagination.maxLimit
      );
      const offset = (page - 1) * limit;

      // Add pagination info to request
      (req as any).pagination = {
        page,
        limit,
        offset,
      };

      // Add pagination headers to response
      res.setHeader('X-Pagination-Page', page.toString());
      res.setHeader('X-Pagination-Limit', limit.toString());

      next();
    };
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(req: Request): string {
    const baseKey = `api:${req.method}:${req.path}`;

    // Include query parameters in cache key
    const queryString = new URLSearchParams(req.query as any).toString();
    const queryKey = queryString ? `:${Buffer.from(queryString).toString('base64')}` : '';

    // Include user context if available
    const userId = (req as any).user?.id;
    const userKey = userId ? `:user:${userId}` : '';

    return `${baseKey}${queryKey}${userKey}`;
  }

  /**
   * Generate cache tags for request
   */
  private generateCacheTags(req: Request): string[] {
    const tags: string[] = [];

    // Add path-based tags
    const pathSegments = req.path.split('/').filter(Boolean);
    if (pathSegments.length > 1 && pathSegments[1]) {
      tags.push(pathSegments[1]); // e.g., 'tasks', 'projects'
    }

    // Add user-based tag if available
    const userId = (req as any).user?.id;
    if (userId) {
      tags.push(`user:${userId}`);
    }

    return tags;
  }

  /**
   * Check if path should be excluded from caching
   */
  private isPathExcluded(path: string): boolean {
    return this.config.caching.excludePaths.some((excludePath) => {
      if (excludePath.endsWith('*')) {
        return path.startsWith(excludePath.slice(0, -1));
      }
      return path === excludePath;
    });
  }

  /**
   * Filter response fields based on selection
   */
  private filterResponseFields(body: any, fields: string[]): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    if (Array.isArray(body)) {
      return body.map((item) => this.filterObjectFields(item, fields));
    }

    // Handle paginated responses
    if (body.data && Array.isArray(body.data)) {
      return {
        ...body,
        data: body.data.map((item: any) => this.filterObjectFields(item, fields)),
      };
    }

    return this.filterObjectFields(body, fields);
  }

  /**
   * Filter fields from a single object
   */
  private filterObjectFields(obj: any, fields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const filtered: any = {};

    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields
        const [parent, ...nested] = field.split('.');
        if (parent && obj[parent]) {
          if (!filtered[parent]) {
            filtered[parent] = {};
          }
          const nestedValue = this.getNestedValue(obj[parent], nested.join('.'));
          if (nestedValue !== undefined) {
            this.setNestedValue(filtered[parent], nested.join('.'), nestedValue);
          }
        }
      } else if (obj.hasOwnProperty(field)) {
        filtered[field] = obj[field];
      }
    }

    return filtered;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }

  /**
   * Update response time statistics
   */
  private updateResponseTimeStats(responseTime: number): void {
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime) /
      this.stats.totalRequests;
  }

  /**
   * Get optimization statistics
   */
  getStats(): OptimizationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cachedResponses: 0,
      compressedResponses: 0,
      batchedRequests: 0,
      averageResponseTime: 0,
      bytesTransferred: 0,
      bytesSaved: 0,
    };
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    return this.stats.totalRequests > 0
      ? (this.stats.cachedResponses / this.stats.totalRequests) * 100
      : 0;
  }

  /**
   * Get compression rate
   */
  getCompressionRate(): number {
    return this.stats.totalRequests > 0
      ? (this.stats.compressedResponses / this.stats.totalRequests) * 100
      : 0;
  }

  /**
   * Get bytes saved percentage
   */
  getBytesSavedPercentage(): number {
    return this.stats.bytesTransferred > 0
      ? (this.stats.bytesSaved / this.stats.bytesTransferred) * 100
      : 0;
  }
}

/**
 * Create default API optimization service
 */
export function createAPIOptimizationService(
  cacheService: CacheService,
  compressionService: ResponseCompressionService,
  batchingService: RequestBatchingService,
  config?: Partial<APIOptimizationConfig>
): APIOptimizationService {
  const defaultConfig: APIOptimizationConfig = {
    caching: {
      enabled: true,
      defaultTTL: 300, // 5 minutes
      cacheableStatusCodes: [200, 201, 204],
      cacheableMethods: ['GET'],
      excludePaths: ['/api/auth/*', '/api/health', '/api/metrics'],
    },
    compression: {
      enabled: true,
      threshold: 1024, // 1KB
      level: 6,
    },
    batching: {
      enabled: true,
      maxBatchSize: 50,
      batchTimeout: 5000,
    },
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    },
    pagination: {
      enabled: true,
      defaultLimit: 20,
      maxLimit: 100,
    },
    fieldSelection: {
      enabled: true,
      defaultFields: [],
    },
    ...config,
  };

  return new APIOptimizationService(
    defaultConfig,
    cacheService,
    compressionService,
    batchingService
  );
}
