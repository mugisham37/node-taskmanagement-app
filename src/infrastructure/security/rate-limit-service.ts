import { CacheService } from '../caching/cache-service';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string, action: string) => string;
  onLimitReached?: (identifier: string, action: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  totalRequests: number;
}

export interface RateLimitInfo {
  identifier: string;
  action: string;
  requests: number;
  windowStart: Date;
  windowEnd: Date;
}

export class RateLimitService {
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  };

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Check if request is allowed and increment counter
   */
  async checkLimit(
    identifier: string,
    action: string = 'default',
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = this.generateKey(identifier, action, finalConfig);

    try {
      const now = Date.now();
      const windowStart =
        Math.floor(now / finalConfig.windowMs) * finalConfig.windowMs;
      const windowEnd = windowStart + finalConfig.windowMs;

      // Get current request count
      const currentCount = await this.getCurrentCount(key);

      // Check if limit is exceeded
      if (currentCount >= finalConfig.maxRequests) {
        // Call limit reached callback if provided
        if (finalConfig.onLimitReached) {
          finalConfig.onLimitReached(identifier, action);
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: new Date(windowEnd),
          totalRequests: currentCount,
        };
      }

      // Increment counter
      const newCount = await this.incrementCounter(key, finalConfig.windowMs);

      return {
        allowed: true,
        remaining: Math.max(0, finalConfig.maxRequests - newCount),
        resetTime: new Date(windowEnd),
        totalRequests: newCount,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Failed to check rate limit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check limit without incrementing counter
   */
  async checkLimitOnly(
    identifier: string,
    action: string = 'default',
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = this.generateKey(identifier, action, finalConfig);

    try {
      const now = Date.now();
      const windowStart =
        Math.floor(now / finalConfig.windowMs) * finalConfig.windowMs;
      const windowEnd = windowStart + finalConfig.windowMs;

      const currentCount = await this.getCurrentCount(key);

      return {
        allowed: currentCount < finalConfig.maxRequests,
        remaining: Math.max(0, finalConfig.maxRequests - currentCount),
        resetTime: new Date(windowEnd),
        totalRequests: currentCount,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Failed to check rate limit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reset rate limit for identifier and action
   */
  async resetLimit(
    identifier: string,
    action: string = 'default'
  ): Promise<void> {
    const key = this.generateKey(identifier, action, this.defaultConfig);

    try {
      await this.cacheService.del(key);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to reset rate limit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get rate limit information
   */
  async getLimitInfo(
    identifier: string,
    action: string = 'default',
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitInfo> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = this.generateKey(identifier, action, finalConfig);

    try {
      const now = Date.now();
      const windowStart =
        Math.floor(now / finalConfig.windowMs) * finalConfig.windowMs;
      const windowEnd = windowStart + finalConfig.windowMs;

      const currentCount = await this.getCurrentCount(key);

      return {
        identifier,
        action,
        requests: currentCount,
        windowStart: new Date(windowStart),
        windowEnd: new Date(windowEnd),
      };
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get rate limit info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create rate limiter for specific action with predefined config
   */
  createLimiter(action: string, config: RateLimitConfig) {
    return {
      check: (identifier: string) =>
        this.checkLimit(identifier, action, config),
      checkOnly: (identifier: string) =>
        this.checkLimitOnly(identifier, action, config),
      reset: (identifier: string) => this.resetLimit(identifier, action),
      getInfo: (identifier: string) =>
        this.getLimitInfo(identifier, action, config),
    };
  }

  /**
   * Predefined rate limiters for common use cases
   */
  getLoginLimiter() {
    return this.createLimiter('login', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 login attempts per 15 minutes
      skipSuccessfulRequests: true,
    });
  }

  getPasswordResetLimiter() {
    return this.createLimiter('password-reset', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 password reset requests per hour
    });
  }

  getEmailLimiter() {
    return this.createLimiter('email', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10, // 10 emails per hour
    });
  }

  getAPILimiter() {
    return this.createLimiter('api', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 API calls per minute
    });
  }

  getRegistrationLimiter() {
    return this.createLimiter('registration', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 registration attempts per hour
    });
  }

  getTaskCreationLimiter() {
    return this.createLimiter('task-creation', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 tasks per minute
    });
  }

  getProjectCreationLimiter() {
    return this.createLimiter('project-creation', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 projects per hour
    });
  }

  getCommentLimiter() {
    return this.createLimiter('comment', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 comments per minute
    });
  }

  getFileUploadLimiter() {
    return this.createLimiter('file-upload', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 file uploads per minute
    });
  }

  getSearchLimiter() {
    return this.createLimiter('search', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 searches per minute
    });
  }

  /**
   * Bulk check multiple actions for an identifier
   */
  async checkMultipleLimits(
    identifier: string,
    actions: Array<{ action: string; config?: Partial<RateLimitConfig> }>
  ): Promise<Record<string, RateLimitResult>> {
    const results: Record<string, RateLimitResult> = {};

    for (const { action, config } of actions) {
      results[action] = await this.checkLimitOnly(identifier, action, config);
    }

    return results;
  }

  /**
   * Get statistics for rate limiting
   */
  async getStatistics(
    identifiers: string[],
    actions: string[] = ['default'],
    config: Partial<RateLimitConfig> = {}
  ): Promise<{
    totalRequests: number;
    blockedRequests: number;
    activeWindows: number;
    topIdentifiers: Array<{ identifier: string; requests: number }>;
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let totalRequests = 0;
    let blockedRequests = 0;
    let activeWindows = 0;
    const identifierCounts: Record<string, number> = {};

    for (const identifier of identifiers) {
      for (const action of actions) {
        const info = await this.getLimitInfo(identifier, action, finalConfig);
        totalRequests += info.requests;

        if (info.requests >= finalConfig.maxRequests) {
          blockedRequests += info.requests - finalConfig.maxRequests;
        }

        if (info.requests > 0) {
          activeWindows++;
        }

        identifierCounts[identifier] =
          (identifierCounts[identifier] || 0) + info.requests;
      }
    }

    const topIdentifiers = Object.entries(identifierCounts)
      .map(([identifier, requests]) => ({ identifier, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      totalRequests,
      blockedRequests,
      activeWindows,
      topIdentifiers,
    };
  }

  private async getCurrentCount(key: string): Promise<number> {
    const count = await this.cacheService.get<number>(key);
    return count || 0;
  }

  private async incrementCounter(
    key: string,
    windowMs: number
  ): Promise<number> {
    const ttl = Math.ceil(windowMs / 1000);

    // Try to increment existing counter
    const newCount = await this.cacheService.increment(key, 1);

    // If this is the first increment, set TTL
    if (newCount === 1) {
      await this.cacheService.expire(key, ttl);
    }

    return newCount;
  }

  private generateKey(
    identifier: string,
    action: string,
    config: RateLimitConfig
  ): string {
    if (config.keyGenerator) {
      return config.keyGenerator(identifier, action);
    }

    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;

    return `rate-limit:${identifier}:${action}:${windowStart}`;
  }
}
