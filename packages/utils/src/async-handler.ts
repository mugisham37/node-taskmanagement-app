import type { Request, Response, NextFunction } from 'express';

/**
 * Enhanced async handler wrapper to catch errors in async route handlers
 * Provides better type safety and error handling
 */

/**
 * Type for async route handler functions
 */
export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Type for async middleware functions
 */
export type AsyncMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param fn The async function to wrap
 * @returns Express middleware function
 */
export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Async middleware wrapper specifically for middleware functions
 * @param fn The async middleware function to wrap
 * @returns Express middleware function
 */
export const asyncMiddleware = (fn: AsyncMiddleware) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Async handler with timeout support
 * @param fn The async function to wrap
 * @param timeoutMs Timeout in milliseconds (default: 30 seconds)
 * @returns Express middleware function
 */
export const asyncHandlerWithTimeout = (
  fn: AsyncRouteHandler,
  timeoutMs: number = 30000
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    Promise.race([Promise.resolve(fn(req, res, next)), timeoutPromise]).catch(
      next
    );
  };
};

/**
 * Async handler with retry logic
 * @param fn The async function to wrap
 * @param maxRetries Maximum number of retries (default: 3)
 * @param retryDelay Delay between retries in milliseconds (default: 1000)
 * @returns Express middleware function
 */
export const asyncHandlerWithRetry = (
  fn: AsyncRouteHandler,
  maxRetries: number = 3,
  retryDelay: number = 1000
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const executeWithRetry = async (attempt: number = 1): Promise<any> => {
      try {
        return await fn(req, res, next);
      } catch (error) {
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return executeWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    executeWithRetry().catch(next);
  };
};

/**
 * Async handler with circuit breaker pattern
 * Simple implementation that fails fast after consecutive failures
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private maxFailures: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.maxFailures) {
      this.state = 'OPEN';
    }
  }
}

// Global circuit breaker instance
const globalCircuitBreaker = new CircuitBreaker();

/**
 * Async handler with circuit breaker pattern
 * @param fn The async function to wrap
 * @param circuitBreaker Optional custom circuit breaker instance
 * @returns Express middleware function
 */
export const asyncHandlerWithCircuitBreaker = (
  fn: AsyncRouteHandler,
  circuitBreaker: CircuitBreaker = globalCircuitBreaker
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    circuitBreaker.execute(() => fn(req, res, next)).catch(next);
  };
};

/**
 * Compose multiple async handlers into a single handler
 * @param handlers Array of async handlers to compose
 * @returns Single composed async handler
 */
export const composeAsyncHandlers = (...handlers: AsyncRouteHandler[]) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      for (const handler of handlers) {
        await handler(req, res, next);
        // If response was sent, break the chain
        if (res.headersSent) {
          break;
        }
      }
    }
  );
};

/**
 * Conditional async handler - only execute if condition is met
 * @param condition Function that returns boolean or Promise<boolean>
 * @param handler Handler to execute if condition is true
 * @param fallbackHandler Optional fallback handler if condition is false
 * @returns Express middleware function
 */
export const conditionalAsyncHandler = (
  condition: (req: Request) => boolean | Promise<boolean>,
  handler: AsyncRouteHandler,
  fallbackHandler?: AsyncRouteHandler
) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const shouldExecute = await Promise.resolve(condition(req));

      if (shouldExecute) {
        return handler(req, res, next);
      } else if (fallbackHandler) {
        return fallbackHandler(req, res, next);
      } else {
        next();
      }
    }
  );
};

/**
 * Legacy export for backward compatibility
 */
export default asyncHandler;
