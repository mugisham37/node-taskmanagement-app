/**
 * Circuit Breaker Pattern Implementation
 * Provides fault tolerance and prevents cascade failures
 */

import { logger } from '../logging/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: Array<new (...args: any[]) => Error>;
  onStateChange?: (state: CircuitState, error?: Error) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChangedAt: Date;
  uptime: number;
  failureRate: number;
  averageResponseTime: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly state: CircuitState,
    message?: string
  ) {
    super(message || `Circuit breaker '${circuitName}' is ${state}`);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private stateChangedAt = new Date();
  private nextAttemptTime = 0;
  private responseTimes: number[] = [];
  private readonly maxResponseTimeHistory = 100;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {
    logger.debug('Circuit breaker created', {
      name: this.name,
      failureThreshold: this.options.failureThreshold,
      recoveryTimeout: this.options.recoveryTimeout,
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          this.name,
          this.state,
          'Circuit breaker is OPEN'
        );
      }

      // Transition to HALF_OPEN for testing
      this.setState(CircuitState.HALF_OPEN);
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;

      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error as Error, responseTime);
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return this.execute(() => {
      return Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    });
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof CircuitBreakerError) {
          throw error; // Don't retry if circuit is open
        }

        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.debug('Retrying operation', {
            circuitName: this.name,
            attempt,
            maxRetries,
            delay,
          });

          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const now = Date.now();
    const uptime = now - this.stateChangedAt.getTime();
    const failureRate =
      this.totalRequests > 0
        ? (this.failureCount / this.totalRequests) * 100
        : 0;
    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) /
          this.responseTimes.length
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
      uptime,
      failureRate,
      averageResponseTime,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.responseTimes = [];
    this.nextAttemptTime = 0;

    logger.info('Circuit breaker reset', { name: this.name });
  }

  /**
   * Force circuit breaker to specific state
   */
  forceState(state: CircuitState): void {
    this.setState(state);

    if (state === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
    }

    logger.info('Circuit breaker state forced', {
      name: this.name,
      state,
    });
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return (
      this.state === CircuitState.CLOSED ||
      this.state === CircuitState.HALF_OPEN
    );
  }

  private onSuccess(responseTime: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.recordResponseTime(responseTime);

    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.CLOSED);
      this.failureCount = 0; // Reset failure count on recovery
    }

    this.options.onSuccess?.();

    logger.debug('Circuit breaker operation succeeded', {
      name: this.name,
      state: this.state,
      responseTime,
      successCount: this.successCount,
    });
  }

  private onFailure(error: Error, responseTime: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.recordResponseTime(responseTime);

    // Check if error should be ignored
    if (this.shouldIgnoreError(error)) {
      logger.debug('Circuit breaker ignoring expected error', {
        name: this.name,
        error: error.message,
      });
      return;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
      this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.setState(CircuitState.OPEN);
      this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
    }

    this.options.onFailure?.(error);

    logger.debug('Circuit breaker operation failed', {
      name: this.name,
      state: this.state,
      error: error.message,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
    });
  }

  private setState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateChangedAt = new Date();

    if (oldState !== newState) {
      this.options.onStateChange?.(newState);

      logger.info('Circuit breaker state changed', {
        name: this.name,
        oldState,
        newState,
        failureCount: this.failureCount,
        successCount: this.successCount,
      });
    }
  }

  private shouldIgnoreError(error: Error): boolean {
    if (!this.options.expectedErrors) {
      return false;
    }

    return this.options.expectedErrors.some(
      ErrorClass => error instanceof ErrorClass
    );
  }

  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private monitoringInterval?: NodeJS.Timeout;

  /**
   * Create or get circuit breaker
   */
  getCircuitBreaker(
    name: string,
    options: CircuitBreakerOptions
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker(name, options);
      this.circuitBreakers.set(name, circuitBreaker);

      logger.info('Circuit breaker registered', { name });
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Remove circuit breaker
   */
  removeCircuitBreaker(name: string): boolean {
    const removed = this.circuitBreakers.delete(name);

    if (removed) {
      logger.info('Circuit breaker removed', { name });
    }

    return removed;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, circuitBreaker] of this.circuitBreakers.entries()) {
      stats[name] = circuitBreaker.getStats();
    }

    return stats;
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): {
    healthy: string[];
    unhealthy: string[];
    totalCount: number;
    healthyCount: number;
    healthPercentage: number;
  } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.isHealthy()) {
        healthy.push(name);
      } else {
        unhealthy.push(name);
      }
    }

    const totalCount = this.circuitBreakers.size;
    const healthyCount = healthy.length;
    const healthPercentage =
      totalCount > 0 ? (healthyCount / totalCount) * 100 : 100;

    return {
      healthy,
      unhealthy,
      totalCount,
      healthyCount,
      healthPercentage,
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [name, circuitBreaker] of this.circuitBreakers.entries()) {
      circuitBreaker.reset();
    }

    logger.info('All circuit breakers reset', {
      count: this.circuitBreakers.size,
    });
  }

  /**
   * Start monitoring circuit breakers
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      const stats = this.getAllStats();
      const healthStatus = this.getHealthStatus();

      logger.debug('Circuit breaker monitoring report', {
        totalCircuits: healthStatus.totalCount,
        healthyCircuits: healthStatus.healthyCount,
        healthPercentage: healthStatus.healthPercentage,
        unhealthyCircuits: healthStatus.unhealthy,
      });

      // Log detailed stats for unhealthy circuits
      for (const name of healthStatus.unhealthy) {
        const circuitStats = stats[name];
        logger.warn('Unhealthy circuit breaker detected', {
          name,
          state: circuitStats.state,
          failureRate: circuitStats.failureRate,
          failureCount: circuitStats.failureCount,
          lastFailureTime: circuitStats.lastFailureTime,
        });
      }
    }, intervalMs);

    logger.info('Circuit breaker monitoring started', {
      intervalMs,
      circuitCount: this.circuitBreakers.size,
    });
  }

  /**
   * Stop monitoring circuit breakers
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;

      logger.info('Circuit breaker monitoring stopped');
    }
  }

  /**
   * Cleanup all circuit breakers
   */
  cleanup(): void {
    this.stopMonitoring();
    this.circuitBreakers.clear();

    logger.info('Circuit breaker manager cleaned up');
  }
}

/**
 * Decorator for automatic circuit breaker protection
 */
export function WithCircuitBreaker(
  name: string,
  options: CircuitBreakerOptions
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(
      name,
      options
    );

    descriptor.value = async function (...args: any[]) {
      return await circuitBreaker.execute(() =>
        originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();
