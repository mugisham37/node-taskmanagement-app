import { logger } from '../logging/logger';

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
    setInterval(() => {
      this.resetCounters();
    }, this.options.monitoringPeriod);
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

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.options.onSuccess();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.nextAttemptTime = undefined;
      this.onStateChange();
      logger.info(`Circuit breaker ${this.name} moved to CLOSED state`);
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.options.onFailure(error);

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
        `Circuit breaker ${this.name} moved to OPEN state from HALF_OPEN`
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
      });
    }
  }

  private onStateChange(): void {
    this.options.onStateChange(this.state);
  }

  private shouldAttemptReset(): boolean {
    return (
      this.nextAttemptTime !== undefined && new Date() >= this.nextAttemptTime
    );
  }

  private setNextAttemptTime(): void {
    this.nextAttemptTime = new Date(Date.now() + this.options.recoveryTimeout);
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
      this.failureCount = 0;
      this.successCount = 0;
      this.totalRequests = 0;
    }
  }

  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
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
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// Circuit breaker registry for managing multiple circuit breakers
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

  public resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  public remove(name: string): boolean {
    const removed = this.circuitBreakers.delete(name);
    if (removed) {
      logger.info(`Circuit breaker removed: ${name}`);
    }
    return removed;
  }

  public clear(): void {
    this.circuitBreakers.clear();
    logger.info('All circuit breakers cleared');
  }

  public list(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }
}

// Decorator for automatic circuit breaker integration
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
