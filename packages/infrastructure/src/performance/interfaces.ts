/**
 * Performance optimization service interfaces
 */

export interface APIOptimizationService {
  /**
   * Optimize API response for performance
   */
  optimizeResponse<T>(data: T, options?: OptimizationOptions): Promise<T>;
  
  /**
   * Apply caching strategies to API endpoints
   */
  applyCachingStrategy(endpoint: string, strategy: CachingStrategy): void;
  
  /**
   * Get performance metrics for an endpoint
   */
  getPerformanceMetrics(endpoint: string): Promise<PerformanceMetrics>;
}

export interface RequestBatchingService {
  /**
   * Batch multiple requests together
   */
  batchRequests<T>(requests: BatchRequest[]): Promise<BatchResponse<T>[]>;
  
  /**
   * Configure batching strategy for a request type
   */
  configureBatching(requestType: string, config: BatchingConfig): void;
  
  /**
   * Get batching statistics
   */
  getBatchingStats(): Promise<BatchingStats>;
}

export interface ResponseCompressionService {
  /**
   * Compress response data
   */
  compress(data: any, algorithm?: CompressionAlgorithm): Promise<Buffer>;
  
  /**
   * Decompress response data
   */
  decompress(data: Buffer, algorithm?: CompressionAlgorithm): Promise<any>;
  
  /**
   * Get compression ratio for data
   */
  getCompressionRatio(originalSize: number, compressedSize: number): number;
}

// Supporting types
export interface OptimizationOptions {
  enableCompression?: boolean;
  enableCaching?: boolean;
  enableMinification?: boolean;
  customOptimizations?: Record<string, any>;
}

export interface CachingStrategy {
  ttl: number;
  strategy: 'memory' | 'redis' | 'hybrid';
  invalidationRules?: string[];
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cacheHitRate?: number;
  compressionRatio?: number;
}

export interface BatchRequest {
  id: string;
  method: string;
  url: string;
  data?: any;
  headers?: Record<string, string>;
}

export interface BatchResponse<T> {
  id: string;
  status: number;
  data?: T;
  error?: string;
}

export interface BatchingConfig {
  maxBatchSize: number;
  batchTimeout: number;
  enableBatching: boolean;
}

export interface BatchingStats {
  totalRequests: number;
  batchedRequests: number;
  averageBatchSize: number;
  batchingEfficiency: number;
}

export type CompressionAlgorithm = 'gzip' | 'deflate' | 'brotli';