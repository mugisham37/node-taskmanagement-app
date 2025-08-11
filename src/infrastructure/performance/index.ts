// Performance optimization services
export {
  ResponseCompressionService,
  createCompressionService,
} from './response-compression';
export type {
  CompressionConfig,
  CompressionStats,
} from './response-compression';

export {
  RequestBatchingService,
  createBatchingService,
} from './request-batching';
export type {
  BatchRequest,
  BatchResponse,
  BatchConfig,
  BatchStats,
} from './request-batching';

export {
  APIOptimizationService,
  createAPIOptimizationService,
} from './api-optimization';
export type {
  APIOptimizationConfig,
  OptimizationStats,
} from './api-optimization';

// Re-export performance optimization service from infrastructure root
export { PerformanceOptimizationService } from '../performance-optimization-service';
export type {
  PerformanceOptimizationConfig,
  PerformanceReport,
} from '../performance-optimization-service';

// Import for factory function
import { createCompressionService, CompressionConfig } from './response-compression';
import { createBatchingService, BatchConfig } from './request-batching';
import { APIOptimizationConfig } from './api-optimization';

// Factory function to create complete performance optimization stack
export function createPerformanceStack(config?: {
  compression?: Partial<CompressionConfig>;
  batching?: Partial<BatchConfig>;
  apiOptimization?: Partial<APIOptimizationConfig>;
}) {
  const compressionService = createCompressionService(config?.compression);
  const batchingService = createBatchingService(config?.batching);

  // Note: APIOptimizationService requires CacheService which should be injected
  // This is a simplified factory - in practice, use dependency injection

  return {
    compressionService,
    batchingService,
    // apiOptimizationService would be created with proper dependencies
  };
}
