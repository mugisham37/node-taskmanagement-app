import { EventEmitter } from 'events';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface BatchRequest {
  id: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface BatchResponse {
  id: string;
  status: number;
  headers?: Record<string, string>;
  body?: any;
  error?: string;
}

export interface BatchingOptions {
  maxBatchSize?: number;
  batchTimeout?: number;
  enableBatching?: boolean;
  allowedMethods?: string[];
  maxConcurrency?: number;
}

export class RequestBatchingMiddleware extends EventEmitter {
  private pendingBatches = new Map<string, {
    requests: BatchRequest[];
    resolve: (responses: BatchResponse[]) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private options: Required<BatchingOptions>;

  constructor(options: BatchingOptions = {}) {
    super();
    this.options = {
      maxBatchSize: options.maxBatchSize || 10,
      batchTimeout: options.batchTimeout || 100, // 100ms
      enableBatching: options.enableBatching !== false,
      allowedMethods: options.allowedMethods || ['GET', 'POST'],
      maxConcurrency: options.maxConcurrency || 5,
    };
  }

  middleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Check if this is a batch request
      if (request.url === '/batch' && request.method === 'POST') {
        await this.handleBatchRequest(request, reply);
        return;
      }

      // For individual requests, check if batching is enabled
      if (!this.options.enableBatching) {
        return;
      }

      // Add batching headers for client optimization
      reply.header('X-Batch-Endpoint', '/batch');
      reply.header('X-Batch-Max-Size', this.options.maxBatchSize.toString());
    };
  }

  private async handleBatchRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const batchRequests = request.body as BatchRequest[];
      
      if (!Array.isArray(batchRequests)) {
        reply.code(400).send({ error: 'Batch requests must be an array' });
        return;
      }

      if (batchRequests.length > this.options.maxBatchSize) {
        reply.code(400).send({ 
          error: `Batch size exceeds maximum of ${this.options.maxBatchSize}` 
        });
        return;
      }

      const responses = await this.executeBatch(batchRequests, request);
      reply.send(responses);
    } catch (error) {
      reply.code(500).send({ error: 'Batch processing failed' });
    }
  }

  private async executeBatch(
    requests: BatchRequest[], 
    originalRequest: FastifyRequest
  ): Promise<BatchResponse[]> {
    const responses: BatchResponse[] = [];
    const concurrencyLimit = Math.min(this.options.maxConcurrency, requests.length);
    
    // Process requests in chunks to limit concurrency
    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const chunk = requests.slice(i, i + concurrencyLimit);
      const chunkPromises = chunk.map(req => this.executeRequest(req, originalRequest));
      const chunkResponses = await Promise.all(chunkPromises);
      responses.push(...chunkResponses);
    }

    return responses;
  }

  private async executeRequest(
    batchRequest: BatchRequest,
    originalRequest: FastifyRequest
  ): Promise<BatchResponse> {
    try {
      // Validate method
      if (!this.options.allowedMethods.includes(batchRequest.method)) {
        return {
          id: batchRequest.id,
          status: 405,
          error: `Method ${batchRequest.method} not allowed in batch`,
        };
      }

      // Create a mock request/reply for internal processing
      const mockRequest = this.createMockRequest(batchRequest, originalRequest);
      const mockReply = this.createMockReply();

      // Execute the request through the application router
      await this.routeRequest(mockRequest, mockReply);

      return {
        id: batchRequest.id,
        status: mockReply.statusCode || 200,
        headers: mockReply.getHeaders(),
        body: mockReply.payload,
      };
    } catch (error) {
      return {
        id: batchRequest.id,
        status: 500,
        error: error.message,
      };
    }
  }

  private createMockRequest(batchRequest: BatchRequest, originalRequest: FastifyRequest): any {
    return {
      ...originalRequest,
      method: batchRequest.method,
      url: batchRequest.url,
      headers: { ...originalRequest.headers, ...batchRequest.headers },
      body: batchRequest.body,
      query: this.parseQuery(batchRequest.url),
      params: {},
    };
  }

  private createMockReply(): any {
    let statusCode = 200;
    let payload: any = null;
    const headers: Record<string, string> = {};

    return {
      statusCode,
      payload,
      code: (code: number) => {
        statusCode = code;
        return this;
      },
      header: (name: string, value: string) => {
        headers[name] = value;
        return this;
      },
      send: (data: any) => {
        payload = data;
        return this;
      },
      getHeaders: () => headers,
    };
  }

  private parseQuery(url: string): Record<string, string> {
    const queryString = url.split('?')[1];
    if (!queryString) return {};

    const params = new URLSearchParams(queryString);
    const query: Record<string, string> = {};
    
    for (const [key, value] of params) {
      query[key] = value;
    }
    
    return query;
  }

  private async routeRequest(request: any, reply: any): Promise<void> {
    // This would integrate with your application's router
    // For now, we'll emit an event that the application can handle
    this.emit('batch-request', { request, reply });
  }

  // DataLoader-style batching for database queries
  createDataLoader<K, V>(
    batchLoadFn: (keys: K[]) => Promise<V[]>,
    options: { cacheKeyFn?: (key: K) => string; maxBatchSize?: number } = {}
  ) {
    const cache = new Map<string, Promise<V>>();
    const batches = new Map<string, {
      keys: K[];
      resolvers: Array<{ resolve: (value: V) => void; reject: (error: Error) => void }>;
    }>();

    const getCacheKey = options.cacheKeyFn || ((key: K) => JSON.stringify(key));
    const maxBatchSize = options.maxBatchSize || this.options.maxBatchSize;

    return {
      load: async (key: K): Promise<V> => {
        const cacheKey = getCacheKey(key);
        
        // Check cache first
        if (cache.has(cacheKey)) {
          return cache.get(cacheKey)!;
        }

        // Create promise for this key
        const promise = new Promise<V>((resolve, reject) => {
          const batchKey = 'default'; // Could be more sophisticated
          
          if (!batches.has(batchKey)) {
            batches.set(batchKey, { keys: [], resolvers: [] });
            
            // Schedule batch execution
            process.nextTick(async () => {
              const batch = batches.get(batchKey)!;
              batches.delete(batchKey);
              
              try {
                const results = await batchLoadFn(batch.keys);
                batch.resolvers.forEach((resolver, index) => {
                  resolver.resolve(results[index]);
                });
              } catch (error) {
                batch.resolvers.forEach(resolver => {
                  resolver.reject(error);
                });
              }
            });
          }

          const batch = batches.get(batchKey)!;
          batch.keys.push(key);
          batch.resolvers.push({ resolve, reject });

          // If batch is full, execute immediately
          if (batch.keys.length >= maxBatchSize) {
            process.nextTick(async () => {
              batches.delete(batchKey);
              
              try {
                const results = await batchLoadFn(batch.keys);
                batch.resolvers.forEach((resolver, index) => {
                  resolver.resolve(results[index]);
                });
              } catch (error) {
                batch.resolvers.forEach(resolver => {
                  resolver.reject(error);
                });
              }
            });
          }
        });

        cache.set(cacheKey, promise);
        return promise;
      },

      loadMany: async (keys: K[]): Promise<V[]> => {
        return Promise.all(keys.map(key => this.load(key)));
      },

      clear: (key: K): void => {
        const cacheKey = getCacheKey(key);
        cache.delete(cacheKey);
      },

      clearAll: (): void => {
        cache.clear();
      },
    };
  }
}