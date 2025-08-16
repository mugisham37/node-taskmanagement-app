/**
 * Platform-agnostic async utilities
 * Provides async handling patterns without framework dependencies
 */

/**
 * Type for async functions
 */
export type AsyncFunction<T = any, R = any> = (...args: T[]) => Promise<R>;

/**
 * Async utilities class
 */
export class AsyncUtils {
  /**
   * Wrap an async function to catch errors
   * @param fn The async function to wrap
   * @returns Wrapped function that catches errors
   */
  static catchAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R | undefined> {
    return async (...args: T): Promise<R | undefined> => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error('Async function error:', error);
        return undefined;
      }
    };
  }

  /**
   * Async function with timeout support
   * @param fn The async function to wrap
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves or rejects with timeout
   */
  static withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Async function with retry logic
   * @param fn The async function to retry
   * @param maxRetries Maximum number of retries
   * @param retryDelay Delay between retries in milliseconds
   * @returns Promise that resolves or rejects after retries
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Create a delay promise
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute async functions in parallel with concurrency limit
   * @param tasks Array of async functions
   * @param concurrency Maximum concurrent executions
   * @returns Promise that resolves with all results
   */
  static async parallelLimit<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      const promise = task().then(result => {
        results[i] = result;
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Execute async functions sequentially
   * @param tasks Array of async functions
   * @returns Promise that resolves with all results
   */
  static async sequential<T>(
    tasks: (() => Promise<T>)[]
  ): Promise<T[]> {
    const results: T[] = [];

    for (const task of tasks) {
      const result = await task();
      results.push(result);
    }

    return results;
  }

  /**
   * Debounce an async function
   * @param fn The async function to debounce
   * @param delay Delay in milliseconds
   * @returns Debounced function
   */
  static debounce<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    delay: number
  ): (...args: T) => Promise<R> {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolvePromise: ((value: R) => void) | null = null;
    let rejectPromise: ((reason: any) => void) | null = null;

    return (...args: T): Promise<R> => {
      return new Promise<R>((resolve, reject) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolvePromise = resolve;
        rejectPromise = reject;

        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolvePromise?.(result);
          } catch (error) {
            rejectPromise?.(error);
          }
        }, delay);
      });
    };
  }

  /**
   * Throttle an async function
   * @param fn The async function to throttle
   * @param delay Delay in milliseconds
   * @returns Throttled function
   */
  static throttle<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    delay: number
  ): (...args: T) => Promise<R | undefined> {
    let lastExecution = 0;
    let isExecuting = false;

    return async (...args: T): Promise<R | undefined> => {
      const now = Date.now();

      if (isExecuting || now - lastExecution < delay) {
        return undefined;
      }

      isExecuting = true;
      lastExecution = now;

      try {
        const result = await fn(...args);
        return result;
      } finally {
        isExecuting = false;
      }
    };
  }

  /**
   * Memoize an async function
   * @param fn The async function to memoize
   * @param keyGenerator Function to generate cache key
   * @returns Memoized function
   */
  static memoize<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    keyGenerator?: (...args: T) => string
  ): (...args: T) => Promise<R> {
    const cache = new Map<string, Promise<R>>();

    return (...args: T): Promise<R> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key)!;
      }

      const promise = fn(...args);
      cache.set(key, promise);

      // Remove from cache if promise rejects
      promise.catch(() => {
        cache.delete(key);
      });

      return promise;
    };
  }

  /**
   * Create a circuit breaker for async functions
   * @param fn The async function to wrap
   * @param maxFailures Maximum failures before opening circuit
   * @param resetTimeout Time to wait before trying again
   * @returns Circuit breaker wrapped function
   */
  static circuitBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    maxFailures: number = 5,
    resetTimeout: number = 60000
  ): (...args: T) => Promise<R> {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (...args: T): Promise<R> => {
      if (state === 'OPEN') {
        if (Date.now() - lastFailureTime > resetTimeout) {
          state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
      }

      try {
        const result = await fn(...args);
        // Success - reset failures
        failures = 0;
        state = 'CLOSED';
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (failures >= maxFailures) {
          state = 'OPEN';
        }

        throw error;
      }
    };
  }
}