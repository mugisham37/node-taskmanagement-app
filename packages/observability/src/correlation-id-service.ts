import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class CorrelationIdService {
  private asyncStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return randomUUID();
  }

  /**
   * Get the current correlation context
   */
  getCurrentContext(): CorrelationContext | undefined {
    return this.asyncStorage.getStore();
  }

  /**
   * Get the current correlation ID
   */
  getCurrentCorrelationId(): string | undefined {
    return this.getCurrentContext()?.correlationId;
  }

  /**
   * Run a function with correlation context
   */
  async runWithContext<T>(
    context: CorrelationContext,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.asyncStorage.run(context, fn);
  }

  /**
   * Run a synchronous function with correlation context
   */
  runWithContextSync<T>(context: CorrelationContext, fn: () => T): T {
    return this.asyncStorage.run(context, fn);
  }

  /**
   * Create correlation context from HTTP request
   */
  createContextFromRequest(req: Request): CorrelationContext {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['correlation-id'] as string) ||
      this.generateCorrelationId();

    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['request-id'] as string) ||
      this.generateCorrelationId();

    const context: CorrelationContext = {
      correlationId,
      requestId,
      timestamp: new Date(),
      metadata: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
      },
    };

    // Add optional properties only if they exist
    const userId = (req as any).user?.id;
    if (userId) {
      (context as any).userId = userId;
    }

    const sessionId = (req as any).sessionID;
    if (sessionId) {
      (context as any).sessionId = sessionId;
    }

    const userAgent = req.headers['user-agent'];
    if (userAgent) {
      (context as any).userAgent = userAgent;
    }

    const ip = req.ip || req.connection.remoteAddress;
    if (ip) {
      (context as any).ip = ip;
    }

    return context;
  }

  /**
   * Express middleware to set up correlation context
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = this.createContextFromRequest(req);

      // Set response headers
      res.setHeader('x-correlation-id', context.correlationId);
      res.setHeader('x-request-id', context.requestId!);

      // Store context in request for later use
      (req as any).correlationContext = context;

      // Run the rest of the request in the correlation context
      this.asyncStorage.run(context, () => {
        next();
      });
    };
  }

  /**
   * Update the current context with additional data
   */
  updateContext(updates: Partial<CorrelationContext>): void {
    const currentContext = this.getCurrentContext();
    if (currentContext) {
      Object.assign(currentContext, updates);
    }
  }

  /**
   * Add metadata to the current context
   */
  addMetadata(key: string, value: any): void {
    const currentContext = this.getCurrentContext();
    if (currentContext) {
      if (!currentContext.metadata) {
        currentContext.metadata = {};
      }
      currentContext.metadata[key] = value;
    }
  }

  /**
   * Get correlation headers for outgoing requests
   */
  getCorrelationHeaders(): Record<string, string> {
    const context = this.getCurrentContext();
    if (!context) {
      return {};
    }

    const headers: Record<string, string> = {
      'x-correlation-id': context.correlationId,
    };

    if (context.requestId) {
      headers['x-request-id'] = context.requestId;
    }

    if (context.userId) {
      headers['x-user-id'] = context.userId;
    }

    return headers;
  }

  /**
   * Create a child context (for spawned operations)
   */
  createChildContext(metadata?: Record<string, any>): CorrelationContext {
    const parentContext = this.getCurrentContext();

    const context: CorrelationContext = {
      correlationId:
        parentContext?.correlationId || this.generateCorrelationId(),
      requestId: this.generateCorrelationId(), // New request ID for child
      timestamp: new Date(),
      metadata: {
        ...parentContext?.metadata,
        ...metadata,
        isChildContext: true,
        parentRequestId: parentContext?.requestId,
      },
    };

    // Add optional properties only if they exist
    if (parentContext?.userId) {
      (context as any).userId = parentContext.userId;
    }

    if (parentContext?.sessionId) {
      (context as any).sessionId = parentContext.sessionId;
    }

    if (parentContext?.userAgent) {
      (context as any).userAgent = parentContext.userAgent;
    }

    if (parentContext?.ip) {
      (context as any).ip = parentContext.ip;
    }

    return context;
  }

  /**
   * Extract correlation context from headers
   */
  extractContextFromHeaders(
    headers: Record<string, string>
  ): CorrelationContext {
    const context: CorrelationContext = {
      correlationId:
        headers['x-correlation-id'] || this.generateCorrelationId(),
      requestId: headers['x-request-id'] || this.generateCorrelationId(),
      timestamp: new Date(),
      metadata: {
        extractedFromHeaders: true,
      },
    };

    // Add optional properties only if they exist
    const userId = headers['x-user-id'];
    if (userId) {
      (context as any).userId = userId;
    }

    return context;
  }

  /**
   * Get context for logging
   */
  getLoggingContext(): Record<string, any> {
    const context = this.getCurrentContext();
    if (!context) {
      return {};
    }

    return {
      correlationId: context.correlationId,
      requestId: context.requestId,
      userId: context.userId,
      sessionId: context.sessionId,
      ip: context.ip,
      userAgent: context.userAgent,
      ...context.metadata,
    };
  }
}

// Export singleton instance
export const correlationIdService = new CorrelationIdService();
