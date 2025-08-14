/**
 * Enhanced Query Bus Implementation
 *
 * The query bus is responsible for routing queries to their appropriate handlers,
 * providing caching, validation, performance monitoring, and read optimization.
 */

import {
  IQuery,
  IQueryHandler,
  IQueryBus,
  QueryHandlerNotFoundError,
} from './query';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { PerformanceMonitor } from '../../shared/utils/performance-monitor';
import { Cache } from '../../shared/utils/cache';
import { injectable } from '../../shared/decorators/injectable.decorator';

@injectable()
export class QueryBus implements IQueryBus {
  private handlers = new Map<string, IQueryHandler<any, any>>();
  private performanceMonitor = new PerformanceMonitor();
  private cache = new Cache();

  constructor(private readonly logger: LoggingService) {}

  async send<TResult>(query: IQuery): Promise<TResult> {
    const queryType = query.constructor.name;
    const handler = this.findHandler(query);

    if (!handler) {
      throw new QueryHandlerNotFoundError(queryType);
    }

    // Check cache first for cacheable queries
    const cacheKey = this.generateCacheKey(query);
    if (this.isCacheable(query)) {
      const cachedResult = await this.cache.get(cacheKey) as TResult;
      if (cachedResult !== null) {
        this.logger.debug('Query result served from cache', {
          queryType,
          queryId: query.queryId,
          cacheKey,
        });
        this.performanceMonitor.recordMetric(`query.${queryType}.cache_hit`, 1);
        return cachedResult;
      }
    }

    this.logger.debug('Executing query', {
      queryType,
      queryId: query.queryId,
      userId: query.userId?.value,
      ...(query.correlationId && { correlationId: query.correlationId }),
    });

    const timer = this.performanceMonitor.startTimer(`query.${queryType}`);

    try {
      const result = await handler.handle(query);
      const duration = timer.end();

      this.logger.debug('Query executed successfully', {
        queryType,
        queryId: query.queryId,
        duration,
        userId: query.userId?.value,
        ...(query.correlationId && { correlationId: query.correlationId }),
      });

      // Cache the result if cacheable
      if (this.isCacheable(query)) {
        await this.cache.set(cacheKey, result, this.getCacheTTL(query));
        this.performanceMonitor.recordMetric(
          `query.${queryType}.cache_miss`,
          1
        );
      }

      // Record performance metrics
      this.performanceMonitor.recordMetric(`query.${queryType}.success`, 1);
      this.performanceMonitor.recordMetric(
        `query.${queryType}.duration`,
        duration
      );

      return result;
    } catch (error) {
      const duration = timer.end();

      this.logger.error('Query execution failed', error as Error, {
        queryType,
        queryId: query.queryId,
        duration,
        userId: query.userId?.value,
        ...(query.correlationId && { correlationId: query.correlationId }),
      });

      // Record error metrics
      this.performanceMonitor.recordMetric(`query.${queryType}.error`, 1);

      throw error;
    }
  }

  register<TQuery extends IQuery, TResult>(
    handler: IQueryHandler<TQuery, TResult>
  ): void {
    const handlerName = handler.constructor.name;

    // Extract query type from handler name (e.g., GetTaskByIdQueryHandler -> GetTaskByIdQuery)
    const queryType = handlerName.replace('Handler', '');

    if (this.handlers.has(queryType)) {
      throw new Error(
        `Handler for query type '${queryType}' is already registered`
      );
    }

    this.handlers.set(queryType, handler);

    this.logger.debug('Query handler registered', {
      queryType,
      handlerName,
    });
  }

  private findHandler(query: IQuery): IQueryHandler<any, any> | undefined {
    const queryType = query.constructor.name;
    const handler = this.handlers.get(queryType);

    if (handler && handler.canHandle(query)) {
      return handler;
    }

    // Fallback: search through all handlers
    for (const [, registeredHandler] of this.handlers) {
      if (registeredHandler.canHandle(query)) {
        return registeredHandler;
      }
    }

    return undefined;
  }

  private generateCacheKey(query: IQuery): string {
    const queryType = query.constructor.name;
    const queryData = JSON.stringify(query);
    return `query:${queryType}:${Buffer.from(queryData).toString('base64')}`;
  }

  private isCacheable(query: IQuery): boolean {
    // Implement caching logic based on query type or properties
    // For now, cache all read queries except those with real-time requirements
    const nonCacheableQueries = [
      'GetRealtimeDataQuery',
      'GetCurrentStatusQuery',
    ];
    return !nonCacheableQueries.includes(query.constructor.name);
  }

  private getCacheTTL(query: IQuery): number {
    // Return cache TTL in seconds based on query type
    const queryType = query.constructor.name;

    // Different TTL for different query types
    const ttlMap: Record<string, number> = {
      GetTaskByIdQuery: 300, // 5 minutes
      GetTasksQuery: 60, // 1 minute
      GetTaskStatsQuery: 600, // 10 minutes
      GetUserProfileQuery: 1800, // 30 minutes
    };

    return ttlMap[queryType] || 300; // Default 5 minutes
  }

  // Cache management
  async invalidateCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cache.flush();
    } else {
      await this.cache.flush();
    }
  }

  // For testing and debugging
  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  clear(): void {
    this.handlers.clear();
  }

  // Performance monitoring
  getPerformanceMetrics(): Record<string, any> {
    return this.performanceMonitor.getMetrics();
  }
}
