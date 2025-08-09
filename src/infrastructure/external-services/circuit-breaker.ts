/**
 * Enhanced Circuit Breaker Implementation
 * Comprehensive circuit breaker pattern with advanced monitoring and recovery
 * Migrated and enhanced from older version
 */

import { logger } from '../monitoring/logging-service';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  onStateChange?: (state: CircuitBreakerState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
  failureRate: number;
  uptime: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly startTime = new Date();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    private readonly name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      expectedErrors: [],
      onStateChange: () => {},
      onFailure: () => {},
      onSuccess: () => {},
      ...options,
    };

    // Set up monitoring period reset
    this.monitoringInterval = setInterval(() => {
      this.resetCounters();
    }, this.options.monitoringPeriod);

    logger.debug(`Circuit breaker ${this.name} initialized`, {
      failureThreshold: this.options.failureThreshold,
      recoveryTimeout: this.options.recoveryTimeout,
      monitoringPeriod: this.options.monitoringPeriod,
    });
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.onStateChange();
        logger.info(`Circuit breaker ${this.name} moved to HALF_OPEN state`);
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker ${this.name} is OPEN. Next attempt at ${this.nextAttemptTime}`
        );
      }
    }

    this.totalRequests++;
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error as Error, duration);
      throw error;
    }
  }

  private onSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.options.onSuccess();

    logger.debug(`Circuit breaker ${this.name} operation succeeded`, {
      duration,
      successCount: this.successCount,
      state: this.state,
    });

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.nextAttemptTime = undefined;
      this.onStateChange();
      logger.info(`Circuit breaker ${this.name} moved to CLOSED state`);
    }
  }

  private onFailure(error: Error, duration: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.options.onFailure(error);

    logger.debug(`Circuit breaker ${this.name} operation failed`, {
      duration,
      failureCount: this.failureCount,
      error: error.message,
      state: this.state,
    });

    // Check if this is an expected error that shouldn't trigger the circuit breaker
    if (this.isExpectedError(error)) {
      logger.debug(`Circuit breaker ${this.name} ignoring expected error`, {
        error: error.message,
      });
      return;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.setNextAttemptTime();
      this.onStateChange();
      logger.warn(
        `Circuit breaker ${this.name} moved to OPEN state from HALF_OPEN`,
        {
          error: error.message,
        }
      );
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.state = CircuitBreakerState.OPEN;
      this.setNextAttemptTime();
      this.onStateChange();
      logger.warn(`Circuit breaker ${this.name} moved to OPEN state`, {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
        error: error.message,
      });
    }
  }

  private onStateChange(): void {
    this.options.onStateChange(this.state);

    logger.info(`Circuit breaker ${this.name} state changed`, {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
    });
  }

  private shouldAttemptReset(): boolean {
    return (
      this.nextAttemptTime !== undefined && new Date() >= this.nextAttemptTime
    );
  }

  private setNextAttemptTime(): void {
    this.nextAttemptTime = new Date(Date.now() + this.options.recoveryTimeout);
    logger.debug(`Circuit breaker ${this.name} next attempt scheduled`, {
      nextAttemptTime: this.nextAttemptTime,
    });
  }

  private isExpectedError(error: Error): boolean {
    return this.options.expectedErrors.some(
      expectedError =>
        error.message.includes(expectedError) ||
        error.constructor.name === expectedError
    );
  }

  private resetCounters(): void {
    if (this.state === CircuitBreakerState.CLOSED) {
      const previousFailureCount = this.failureCount;
      const previousSuccessCount = this.successCount;

      this.failureCount = 0;
      this.successCount = 0;
      this.totalRequests = 0;

      if (previousFailureCount > 0 || previousSuccessCount > 0) {
        logger.debug(`Circuit breaker ${this.name} counters reset`, {
          previousFailureCount,
          previousSuccessCount,
        });
      }
    }
  }

  public getStats(): CircuitBreakerStats {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();
    const failureRate =
      this.totalRequests > 0
        ? (this.failureCount / this.totalRequests) * 100
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      failureRate: Math.round(failureRate * 100) / 100,
      uptime,
    };
  }

  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = undefined;
    this.onStateChange();
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  public forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.setNextAttemptTime();
    this.onStateChange();
    logger.warn(`Circuit breaker ${this.name} manually forced to OPEN state`);
  }

  public forceClose(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = undefined;
    this.onStateChange();
    logger.info(`Circuit breaker ${this.name} manually forced to CLOSED state`);
  }

  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    logger.debug(`Circuit breaker ${this.name} destroyed`);
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  public static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  public register(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    if (this.circuitBreakers.has(name)) {
      return this.circuitBreakers.get(name)!;
    }

    const circuitBreaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, circuitBreaker);

    logger.info(`Circuit breaker registered: ${name}`);
    return circuitBreaker;
  }

  public get(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  public getOrCreate(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    return this.get(name) || this.register(name, options);
  }

  public getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }

    return stats;
  }

  public getHealthSummary(): {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  } {
    let healthy = 0;
    let unhealthy = 0;
    let degraded = 0;

    for (const circuitBreaker of this.circuitBreakers.values()) {
      const stats = circuitBreaker.getStats();

      switch (stats.state) {
        case CircuitBreakerState.CLOSED:
          if (stats.failureRate < 10) {
            healthy++;
          } else {
            degraded++;
          }
          break;
        case CircuitBreakerState.HALF_OPEN:
          degraded++;
          break;
        case CircuitBreakerState.OPEN:
          unhealthy++;
          break;
      }
    }

    return {
      total: this.circuitBreakers.size,
      healthy,
      unhealthy,
      degraded,
    };
  }

  public resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  public remove(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.destroy();
      const removed = this.circuitBreakers.delete(name);
      if (removed) {
        logger.info(`Circuit breaker removed: ${name}`);
      }
      return removed;
    }
    return false;
  }

  public clear(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
    logger.info('All circuit breakers cleared');
  }

  public list(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }

  public shutdown(): void {
    this.clear();
    logger.info('Circuit breaker registry shutdown complete');
  }
}

/**
 * Decorator for automatic circuit breaker integration
 */
export function WithCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const registry = CircuitBreakerRegistry.getInstance();
    const circuitBreaker = registry.register(name, options);

    descriptor.value = async function (...args: any[]) {
      return await circuitBreaker.execute(() =>
        originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

// Global registry instance
export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
