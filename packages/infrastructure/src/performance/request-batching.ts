import { BatchRequest, BatchResponse, BatchingConfig, BatchingStats, RequestBatchingService } from './interfaces';

export class DefaultRequestBatchingService implements RequestBatchingService {
  private stats: BatchingStats = {
    totalRequests: 0,
    batchedRequests: 0,
    averageBatchSize: 0,
    batchingEfficiency: 0,
  };

  private pendingRequests = new Map<string, BatchRequest[]>();
  private batchTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(private readonly config: BatchingConfig) {}

  /**
   * Batch multiple requests together
   */
  async batchRequests<T>(requests: BatchRequest[]): Promise<BatchResponse<T>[]> {
    if (!this.config.enableBatching || requests.length === 0) {
      return this.processIndividualRequests<T>(requests);
    }

    const startTime = Date.now();
    const responses: BatchResponse<T>[] = [];

    // Group requests by type for more efficient batching
    const requestGroups = this.groupRequestsByType(requests);

    for (const [requestType, groupRequests] of requestGroups) {
      const groupResponses = await this.processBatchGroup<T>(requestType, groupRequests);
      responses.push(...groupResponses);
    }

    // Update statistics
    const processingTime = Date.now() - startTime;
    this.updateStats(requests.length, processingTime);

    return responses;
  }

  /**
   * Configure batching strategy for a request type
   */
  configureBatching(requestType: string, config: BatchingConfig): void {
    // Store configuration for specific request types
    // This would be implemented based on specific requirements
  }

  /**
   * Get batching statistics
   */
  async getBatchingStats(): Promise<BatchingStats> {
    return { ...this.stats };
  }

  /**
   * Process individual requests without batching
   */
  private async processIndividualRequests<T>(requests: BatchRequest[]): Promise<BatchResponse<T>[]> {
    const responses: BatchResponse<T>[] = [];

    for (const request of requests) {
      const startTime = Date.now();
      
      try {
        const result = await this.executeRequest<T>(request);
        responses.push({
          id: request.id,
          status: 200,
          data: result,
        });
      } catch (error) {
        responses.push({
          id: request.id,
          status: 500,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return responses;
  }

  /**
   * Group requests by type for efficient batching
   */
  private groupRequestsByType(requests: BatchRequest[]): Map<string, BatchRequest[]> {
    const groups = new Map<string, BatchRequest[]>();

    for (const request of requests) {
      const requestType = `${request.method}:${this.extractResourceType(request.url)}`;
      
      if (!groups.has(requestType)) {
        groups.set(requestType, []);
      }
      
      groups.get(requestType)!.push(request);
    }

    return groups;
  }

  /**
   * Extract resource type from URL for grouping
   */
  private extractResourceType(url: string): string {
    const pathSegments = url.split('/').filter(Boolean);
    return pathSegments.length > 1 ? pathSegments[1] : 'unknown';
  }

  /**
   * Process a batch group of similar requests
   */
  private async processBatchGroup<T>(requestType: string, requests: BatchRequest[]): Promise<BatchResponse<T>[]> {
    const responses: BatchResponse<T>[] = [];

    // Split into chunks if batch size exceeds maximum
    const chunks = this.chunkArray(requests, this.config.maxBatchSize);

    for (const chunk of chunks) {
      const chunkResponses = await this.processBatchChunk<T>(chunk);
      responses.push(...chunkResponses);
    }

    return responses;
  }

  /**
   * Process a chunk of requests
   */
  private async processBatchChunk<T>(requests: BatchRequest[]): Promise<BatchResponse<T>[]> {
    const responses: BatchResponse<T>[] = [];

    // Process requests in parallel with concurrency control
    const concurrencyLimit = Math.min(10, requests.length);
    const chunks = this.chunkArray(requests, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request) => {
        try {
          const result = await this.executeRequest<T>(request);
          return {
            id: request.id,
            status: 200,
            data: result,
          };
        } catch (error) {
          return {
            id: request.id,
            status: 500,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const chunkResponses = await Promise.all(chunkPromises);
      responses.push(...chunkResponses);
    }

    return responses;
  }

  /**
   * Execute individual request (placeholder implementation)
   */
  private async executeRequest<T>(request: BatchRequest): Promise<T> {
    // This is a placeholder implementation
    // In a real application, this would route the request through your application
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          message: `Processed ${request.method} ${request.url}`,
          timestamp: new Date().toISOString(),
        } as T);
      }, Math.random() * 100); // Random delay 0-100ms
    });
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Update batching statistics
   */
  private updateStats(requestCount: number, processingTime: number): void {
    this.stats.totalRequests += requestCount;
    this.stats.batchedRequests += requestCount;

    const totalBatches = Math.ceil(this.stats.batchedRequests / this.config.maxBatchSize);
    this.stats.averageBatchSize = this.stats.batchedRequests / Math.max(totalBatches, 1);

    this.stats.batchingEfficiency = this.stats.totalRequests > 0
      ? (this.stats.batchedRequests / this.stats.totalRequests) * 100
      : 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      averageBatchSize: 0,
      batchingEfficiency: 0,
    };
  }
}

/**
 * Create default request batching service
 */
export function createRequestBatchingService(
  config?: Partial<BatchingConfig>
): DefaultRequestBatchingService {
  const defaultConfig: BatchingConfig = {
    maxBatchSize: 50,
    batchTimeout: 5000, // 5 seconds
    enableBatching: true,
    ...config,
  };

  return new DefaultRequestBatchingService(defaultConfig);
}