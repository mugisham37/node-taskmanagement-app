/**
 * Query Bus Implementation
 *
 * The query bus is responsible for routing queries to their appropriate handlers,
 * providing caching, validation, and performance monitoring for read operations.
 */

import {
  IQuery,
  IQueryHandler,
  IQueryBus,
  QueryHandlerNotFoundError,
} from './query';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';

@injectable()
export class QueryBus implements IQueryBus {
  private handlers = new Map<string, IQueryHandler<any, any>>();

  constructor(private readonly logger: ILogger) {}

  async send<TResult>(query: IQuery): Promise<TResult> {
    const queryType = query.constructor.name;
    const handler = this.findHandler(query);

    if (!handler) {
      throw new QueryHandlerNotFoundError(queryType);
    }

    this.logger.debug('Executing query', {
      queryType,
      queryId: query.queryId,
      userId: query.userId,
      correlationId: query.correlationId,
    });

    try {
      const startTime = Date.now();
      const result = await handler.handle(query);
      const duration = Date.now() - startTime;

      this.logger.debug('Query executed successfully', {
        queryType,
        queryId: query.queryId,
        duration,
        userId: query.userId,
        correlationId: query.correlationId,
      });

      return result;
    } catch (error) {
      this.logger.error('Query execution failed', {
        queryType,
        queryId: query.queryId,
        error: error instanceof Error ? error.message : String(error),
        userId: query.userId,
        correlationId: query.correlationId,
      });

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

  // For testing and debugging
  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  clear(): void {
    this.handlers.clear();
  }
}
