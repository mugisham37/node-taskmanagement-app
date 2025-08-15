import { APIOptimizationService, CachingStrategy, OptimizationOptions, PerformanceMetrics } from './interfaces';

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

export class DefaultAPIOptimizationService implements APIOptimizationService {
  private stats: OptimizationStats = {
    totalRequests: 0,
    cachedResponses: 0,
    compressedResponses: 0,
    batchedRequests: 0,
    averageResponseTime: 0,
    bytesTransferred: 0,
    bytesSaved: 0,
  };

  private cachingStrategies = new Map<string, CachingStrategy>();

  constructor(private readonly config: APIOptimizationConfig) {}

  /**
   * Optimize API response for performance
   */
  async optimizeResponse<T>(data: T, options?: OptimizationOptions): Promise<T> {
    let optimizedData = data;

    if (options?.enableMinification && typeof data === 'object') {
      optimizedData = this.minifyResponse(optimizedData);
    }

    if (options?.enableCompression) {
      // Compression would be handled at the transport layer
      // This is a placeholder for compression logic
    }

    return optimizedData;
  }

  /**
   * Apply caching strategy to API endpoints
   */
  applyCachingStrategy(endpoint: string, strategy: CachingStrategy): void {
    this.cachingStrategies.set(endpoint, strategy);
  }

  /**
   * Get performance metrics for an endpoint
   */
  async getPerformanceMetrics(endpoint: string): Promise<PerformanceMetrics> {
    const strategy = this.cachingStrategies.get(endpoint);
    
    return {
      responseTime: this.stats.averageResponseTime,
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate(),
      cacheHitRate: strategy ? this.getCacheHitRate() : undefined,
      compressionRatio: this.getCompressionRatio(),
    };
  }

  /**
   * Minify response by removing unnecessary fields
   */
  private minifyResponse<T>(data: T): T {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.minifyResponse(item)) as T;
    }

    const minified = { ...data } as any;

    // Remove null and undefined values
    Object.keys(minified).forEach(key => {
      if (minified[key] === null || minified[key] === undefined) {
        delete minified[key];
      } else if (typeof minified[key] === 'object') {
        minified[key] = this.minifyResponse(minified[key]);
      }
    });

    return minified;
  }

  /**
   * Calculate throughput (requests per second)
   */
  private calculateThroughput(): number {
    // This would be calculated based on actual request timing
    return this.stats.totalRequests / (this.stats.averageResponseTime / 1000);
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    // This would be calculated based on actual error tracking
    return 0; // Placeholder
  }

  /**
   * Get cache hit rate
   */
  private getCacheHitRate(): number {
    return this.stats.totalRequests > 0
      ? (this.stats.cachedResponses / this.stats.totalRequests) * 100
      : 0;
  }

  /**
   * Get compression ratio
   */
  private getCompressionRatio(): number {
    return this.stats.bytesTransferred > 0
      ? (this.stats.bytesSaved / this.stats.bytesTransferred) * 100
      : 0;
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
}

/**
 * Create default API optimization service
 */
export function createAPIOptimizationService(
  config?: Partial<APIOptimizationConfig>
): DefaultAPIOptimizationService {
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

  return new DefaultAPIOptimizationService(defaultConfig);
}