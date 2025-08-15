import { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerStats } from './interfaces';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface RequestHistoryEntry {
  timestamp: number;
  success: boolean;
  duration: number;
}

export class DefaultCircuitBreaker implements CircuitBreaker {
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
  private requestHistory: RequestHistoryEntry[] = [];

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
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.onStateChange();
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

  getStats(): CircuitBreakerStats {
    const now = Date.now();
    const windowStart = now - this.options.monitoringPeriod;

    const recentRequests = this.requestHistory.filter(
      req => req.timestamp > windowStart
    );

    const failures = recentRequests.filter(req => !req.success);
    const failureRate =
      recentRequests.length > 0
        ? failures.length / recentRequests.length
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      failureRate,
      uptime: now - this.startTime.getTime(),
    };
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = undefined;
    this.onStateChange();
  }

  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.setNextAttemptTime();
    this.onStateChange();
  }

  forceClose(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = undefined;
    this.onStateChange();
  }

  private onSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.options.onSuccess();

    this.addToRequestHistory(true, duration);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.nextAttemptTime = undefined;
      this.onStateChange();
    }
  }

  private onFailure(error: Error, duration: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.options.onFailure(error);

    this.addToRequestHistory(false, duration);

    if (this.isExpectedError(error)) {
      return;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.setNextAttemptTime();
      this.onStateChange();
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.state = CircuitBreakerState.OPEN;
      this.setNextAttemptTime();
      this.onStateChange();
    }
  }

  private addToRequestHistory(success: boolean, duration: number): void {
    const entry: RequestHistoryEntry = {
      timestamp: Date.now(),
      success,
      duration,
    };

    this.requestHistory.push(entry);

    // Keep only recent history
    const cutoff = Date.now() - this.options.monitoringPeriod;
    this.requestHistory = this.requestHistory.filter(
      req => req.timestamp > cutoff
    );
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

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
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
  private circuitBreakers = new Map<string, DefaultCircuitBreaker>();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  register(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): DefaultCircuitBreaker {
    if (this.circuitBreakers.has(name)) {
      return this.circuitBreakers.get(name)!;
    }

    const circuitBreaker = new DefaultCircuitBreaker(name, options);
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  get(name: string): DefaultCircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getOrCreate(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): DefaultCircuitBreaker {
    return this.get(name) || this.register(name, options);
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }
    return stats;
  }

  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  remove(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.destroy();
      return this.circuitBreakers.delete(name);
    }
    return false;
  }

  clear(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
  }
}

export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();