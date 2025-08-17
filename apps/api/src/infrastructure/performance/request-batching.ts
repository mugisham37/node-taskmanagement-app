import { Request, Response, NextFunction } from 'express';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface BatchRequest {
  id: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timestamp: number;
}

export interface BatchResponse {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  duration: number;
}

export interface BatchConfig {
  enabled: boolean;
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  allowedMethods: string[];
  allowedPaths: string[];
  maxRequestSize: number; // bytes
}

export interface BatchStats {
  totalBatches: number;
  totalRequests: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  successRate: number;
}

export class RequestBatchingService {
  private stats: BatchStats = {
    totalBatches: 0,
    totalRequests: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    successRate: 0,
  };

  constructor(private readonly config: BatchConfig) {}

  /**
   * Create batching middleware
   */
  createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      // Check if this is a batch request
      if (req.path === '/api/batch' && req.method === 'POST') {
        return this.handleBatchRequest(req, res);
      }

      // For individual requests, check if they can be batched
      if (this.canBeBatched(req)) {
        // Add batching headers to indicate support
        res.setHeader('X-Batch-Supported', 'true');
        res.setHeader('X-Batch-Endpoint', '/api/batch');
      }

      next();
    };
  }

  /**
   * Handle batch request
   */
  private async handleBatchRequest(req: Request, res: Response): Promise<void> {
    try {
      const batchRequests = this.validateBatchRequest(req.body);
      const responses = await this.processBatch(batchRequests);

      res.json({
        success: true,
        responses,
        meta: {
          batchSize: batchRequests.length,
          processedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Batch processing failed',
      });
    }
  }

  /**
   * Validate batch request format
   */
  private validateBatchRequest(body: any): BatchRequest[] {
    if (!Array.isArray(body.requests)) {
      throw new InfrastructureError(
        'Batch request must contain requests array'
      );
    }

    if (body.requests.length === 0) {
      throw new InfrastructureError('Batch request cannot be empty');
    }

    if (body.requests.length > this.config.maxBatchSize) {
      throw new InfrastructureError(
        `Batch size exceeds maximum allowed (${this.config.maxBatchSize})`
      );
    }

    const requests: BatchRequest[] = [];

    for (let i = 0; i < body.requests.length; i++) {
      const req = body.requests[i];

      if (!req.id || !req.method || !req.url) {
        throw new InfrastructureError(
          `Request at index ${i} missing required fields (id, method, url)`
        );
      }

      if (!this.config.allowedMethods.includes(req.method.toUpperCase())) {
        throw new InfrastructureError(
          `Method ${req.method} not allowed in batch requests`
        );
      }

      if (!this.isPathAllowed(req.url)) {
        throw new InfrastructureError(
          `Path ${req.url} not allowed in batch requests`
        );
      }

      const requestSize = JSON.stringify(req).length;
      if (requestSize > this.config.maxRequestSize) {
        throw new InfrastructureError(
          `Request ${req.id} exceeds maximum size (${this.config.maxRequestSize} bytes)`
        );
      }

      requests.push({
        id: req.id,
        method: req.method.toUpperCase(),
        url: req.url,
        headers: req.headers || {},
        body: req.body,
        timestamp: Date.now(),
      });
    }

    return requests;
  }

  /**
   * Process batch of requests
   */
  private async processBatch(
    requests: BatchRequest[]
  ): Promise<BatchResponse[]> {
    const startTime = Date.now();
    const responses: BatchResponse[] = [];
    let successCount = 0;

    // Process requests in parallel with concurrency limit
    const concurrencyLimit = Math.min(10, requests.length);
    const chunks = this.chunkArray(requests, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async request => {
        const requestStartTime = Date.now();

        try {
          const response = await this.executeRequest(request);
          if (response.status < 400) {
            successCount++;
          }

          return {
            ...response,
            duration: Date.now() - requestStartTime,
          };
        } catch (error) {
          return {
            id: request.id,
            status: 500,
            headers: {},
            body: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Internal server error',
            },
            duration: Date.now() - requestStartTime,
          };
        }
      });

      const chunkResponses = await Promise.all(chunkPromises);
      responses.push(...chunkResponses);
    }

    // Update statistics
    const processingTime = Date.now() - startTime;
    this.updateStats(requests.length, processingTime, successCount);

    return responses;
  }

  /**
   * Execute individual request within batch
   */
  private async executeRequest(request: BatchRequest): Promise<BatchResponse> {
    // This is a simplified implementation
    // In a real application, you would route the request through your application
    // and capture the response

    return new Promise(resolve => {
      // Simulate request processing
      setTimeout(() => {
        resolve({
          id: request.id,
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
          body: {
            message: `Processed ${request.method} ${request.url}`,
            timestamp: new Date().toISOString(),
          },
          duration: 0, // Will be set by caller
        });
      }, Math.random() * 100); // Random delay 0-100ms
    });
  }

  /**
   * Check if request can be batched
   */
  private canBeBatched(req: Request): boolean {
    if (!this.config.allowedMethods.includes(req.method.toUpperCase())) {
      return false;
    }

    return this.isPathAllowed(req.path);
  }

  /**
   * Check if path is allowed for batching
   */
  private isPathAllowed(path: string): boolean {
    if (this.config.allowedPaths.length === 0) {
      return true; // Allow all paths if none specified
    }

    return this.config.allowedPaths.some(allowedPath => {
      if (allowedPath.endsWith('*')) {
        return path.startsWith(allowedPath.slice(0, -1));
      }
      return path === allowedPath;
    });
  }

  /**
   * Update batch processing statistics
   */
  private updateStats(
    batchSize: number,
    processingTime: number,
    successCount: number
  ): void {
    this.stats.totalBatches++;
    this.stats.totalRequests += batchSize;

    this.stats.averageBatchSize =
      (this.stats.averageBatchSize * (this.stats.totalBatches - 1) +
        batchSize) /
      this.stats.totalBatches;

    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.totalBatches - 1) +
        processingTime) /
      this.stats.totalBatches;

    this.stats.successRate =
      (this.stats.successRate * (this.stats.totalRequests - batchSize) +
        successCount) /
      this.stats.totalRequests;
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
   * Get batching statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalBatches: 0,
      totalRequests: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      successRate: 0,
    };
  }

  /**
   * Create batch request helper for clients
   */
  static createBatchRequest(requests: Omit<BatchRequest, 'timestamp'>[]): {
    requests: BatchRequest[];
  } {
    return {
      requests: requests.map(req => ({
        ...req,
        timestamp: Date.now(),
      })),
    };
  }
}

/**
 * Create default batching service
 */
export function createBatchingService(
  config?: Partial<BatchConfig>
): RequestBatchingService {
  const defaultConfig: BatchConfig = {
    enabled: true,
    maxBatchSize: 50,
    batchTimeout: 5000, // 5 seconds
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedPaths: [
      '/api/tasks*',
      '/api/projects*',
      '/api/users*',
      '/api/workspaces*',
      '/api/notifications*',
    ],
    maxRequestSize: 1024 * 1024, // 1MB per request
    ...config,
  };

  return new RequestBatchingService(defaultConfig);
}

