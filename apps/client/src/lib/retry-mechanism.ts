// Retry mechanism with exponential backoff and jitter

import { AppError, normalizeError, isRetryableError } from '@taskmanagement/shared';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;        // Base delay in milliseconds
  maxDelay: number;         // Maximum delay in milliseconds
  backoffFactor: number;    // Exponential backoff multiplier
  jitter: boolean;          // Add random jitter to prevent thundering herd
  retryableErrors?: string[]; // Additional error codes to retry
  onRetry?: (attempt: number, error: AppError, delay: number) => void;
}

export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalDelay: number;
  lastError: AppError | null;
}

export class RetryMechanism {
  private readonly config: RetryConfig;
  private stats: RetryStats = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    totalDelay: 0,
    lastError: null,
  };

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true,
      retryableErrors: [],
      ...config,
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: AppError;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      this.stats.totalAttempts++;
      
      try {
        const result = await fn();
        this.stats.successfulAttempts++;
        return result;
      } catch (error) {
        lastError = normalizeError(error);
        this.stats.lastError = lastError;
        this.stats.failedAttempts++;

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt >= this.config.maxAttempts || !this.shouldRetry(lastError)) {
          throw lastError;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        this.stats.totalDelay += delay;

        // Call retry callback
        this.config.onRetry?.(attempt, lastError, delay);

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalDelay: 0,
      lastError: null,
    };
  }

  private shouldRetry(error: AppError): boolean {
    // Check if error is in custom retryable list
    if (this.config.retryableErrors?.includes(error.code)) {
      return true;
    }

    // Use shared utility to check if error is retryable
    return isRetryableError(error);
  }

  private calculateDelay(attempt: number): number {
    // Calculate exponential backoff delay
    let delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd problem
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Retry decorator for functions
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config?: Partial<RetryConfig>
): T {
  const retryMechanism = new RetryMechanism(config);
  
  return ((...args: Parameters<T>) => {
    return retryMechanism.execute(() => fn(...args));
  }) as T;
}

/**
 * Retry manager for tracking multiple retry operations
 */
export class RetryManager {
  private mechanisms = new Map<string, RetryMechanism>();

  /**
   * Get or create retry mechanism for an operation
   */
  getMechanism(operationName: string, config?: Partial<RetryConfig>): RetryMechanism {
    if (!this.mechanisms.has(operationName)) {
      this.mechanisms.set(operationName, new RetryMechanism(config));
    }
    return this.mechanisms.get(operationName)!;
  }

  /**
   * Execute operation with retry
   */
  async execute<T>(
    operationName: string,
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const mechanism = this.getMechanism(operationName, config);
    return mechanism.execute(fn);
  }

  /**
   * Get stats for all retry mechanisms
   */
  getAllStats(): Record<string, RetryStats> {
    const stats: Record<string, RetryStats> = {};
    for (const [operationName, mechanism] of this.mechanisms) {
      stats[operationName] = mechanism.getStats();
    }
    return stats;
  }

  /**
   * Reset stats for all mechanisms
   */
  resetAllStats(): void {
    for (const mechanism of this.mechanisms.values()) {
      mechanism.resetStats();
    }
  }

  /**
   * Get success rate for all operations
   */
  getSuccessRates(): Record<string, number> {
    const rates: Record<string, number> = {};
    for (const [operationName, mechanism] of this.mechanisms) {
      const stats = mechanism.getStats();
      const totalAttempts = stats.totalAttempts;
      rates[operationName] = totalAttempts > 0 
        ? stats.successfulAttempts / totalAttempts 
        : 0;
    }
    return rates;
  }
}

// Global retry manager instance
export const retryManager = new RetryManager();

/**
 * Utility function for simple retry operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const mechanism = new RetryMechanism(config);
  return mechanism.execute(fn);
}