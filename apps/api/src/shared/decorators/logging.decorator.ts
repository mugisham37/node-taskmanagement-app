/**
 * Logging decorators for methods
 * Enhanced with performance monitoring and error tracking
 */

// Simple logger interface for decorators
interface SimpleLogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

// Default console logger
const defaultLogger: SimpleLogger = {
  debug: (message: string, context?: any) =>
    console.debug(`[DEBUG] ${message}`, context || ''),
  info: (message: string, context?: any) =>
    console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) =>
    console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) =>
    console.error(`[ERROR] ${message}`, context || ''),
};

/**
 * Logging decorator for methods
 */
export function LogMethod(logger: SimpleLogger = defaultLogger) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;

      logger.debug(`Entering ${className}.${methodName}`, { args });

      try {
        const result = await method.apply(this, args);
        logger.debug(`Exiting ${className}.${methodName}`, { result });
        return result;
      } catch (error) {
        logger.error(`Error in ${className}.${methodName}`, { error, args });
        throw error;
      }
    };
  };
}

/**
 * Performance logging decorator
 */
export function LogPerformance(logger: SimpleLogger = defaultLogger) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      const startTime = Date.now();

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        logger.info(`${className}.${methodName} completed`, { duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`${className}.${methodName} failed`, { duration, error });
        throw error;
      }
    };
  };
}

/**
 * Enhanced performance decorator with memory tracking
 */
export function LogPerformanceDetailed(logger: SimpleLogger = defaultLogger) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      try {
        const result = await method.apply(this, args);
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;

        logger.info(`${className}.${methodName} completed`, {
          duration: `${duration.toFixed(2)}ms`,
          memoryDelta: `${Math.round(memoryDiff / 1024)}KB`,
          heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
        });
        return result;
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        logger.error(`${className}.${methodName} failed`, {
          duration: `${duration.toFixed(2)}ms`,
          error,
        });
        throw error;
      }
    };
  };
}

/**
 * Audit logging decorator for tracking method calls
 */
export function LogAudit(
  logger: SimpleLogger = defaultLogger,
  includeArgs: boolean = false
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      const timestamp = new Date().toISOString();
      const userId = (this as any).userId || 'system';

      const auditData: any = {
        timestamp,
        userId,
        action: `${className}.${methodName}`,
        success: false,
      };

      if (includeArgs) {
        auditData.parameters = args;
      }

      try {
        const result = await method.apply(this, args);
        auditData.success = true;
        logger.info(`Audit: ${className}.${methodName}`, auditData);
        return result;
      } catch (error) {
        auditData.error =
          error instanceof Error ? error.message : String(error);
        logger.error(`Audit: ${className}.${methodName} failed`, auditData);
        throw error;
      }
    };
  };
}

/**
 * Rate limiting decorator
 */
export function LogRateLimit(
  maxCalls: number = 10,
  windowMs: number = 60000,
  logger: SimpleLogger = defaultLogger
) {
  const callCounts = new Map<string, { count: number; resetTime: number }>();

  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      const key = `${className}.${methodName}`;
      const now = Date.now();

      let callData = callCounts.get(key);
      if (!callData || now > callData.resetTime) {
        callData = { count: 0, resetTime: now + windowMs };
        callCounts.set(key, callData);
      }

      if (callData.count >= maxCalls) {
        const error = new Error(
          `Rate limit exceeded for ${key}. Max ${maxCalls} calls per ${windowMs}ms`
        );
        logger.warn(`Rate limit exceeded`, { key, maxCalls, windowMs });
        throw error;
      }

      callData.count++;
      return method.apply(this, args);
    };
  };
}

/**
 * Retry decorator with exponential backoff
 */
export function LogRetry(
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  logger: SimpleLogger = defaultLogger
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          const result = await method.apply(this, args);
          if (attempt > 1) {
            logger.info(
              `${className}.${methodName} succeeded on attempt ${attempt}`
            );
          }
          return result;
        } catch (error) {
          lastError = error;

          if (attempt <= maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            logger.warn(
              `${className}.${methodName} failed on attempt ${attempt}, retrying in ${delay}ms`,
              {
                error: error instanceof Error ? error.message : String(error),
                attempt,
                maxRetries,
              }
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      logger.error(
        `${className}.${methodName} failed after ${maxRetries + 1} attempts`,
        {
          error:
            lastError instanceof Error ? lastError.message : String(lastError),
        }
      );
      throw lastError;
    };
  };
}

/**
 * Cache decorator for method results
 */
export function LogCache(
  ttlMs: number = 300000, // 5 minutes default
  logger: SimpleLogger = defaultLogger
) {
  const cache = new Map<string, { value: any; expiry: number }>();

  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      const cacheKey = `${className}.${methodName}:${JSON.stringify(args)}`;
      const now = Date.now();

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && now < cached.expiry) {
        logger.debug(`Cache hit for ${className}.${methodName}`, { cacheKey });
        return cached.value;
      }

      // Execute method
      try {
        const result = await method.apply(this, args);

        // Store in cache
        cache.set(cacheKey, {
          value: result,
          expiry: now + ttlMs,
        });

        logger.debug(
          `Cache miss for ${className}.${methodName}, result cached`,
          { cacheKey, ttlMs }
        );
        return result;
      } catch (error) {
        logger.debug(
          `Cache miss for ${className}.${methodName}, error not cached`,
          {
            cacheKey,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        throw error;
      }
    };
  };
}

