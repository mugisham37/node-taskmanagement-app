/**
 * Rate Limiter Implementation
 * Advanced rate limiting with multiple strategies and monitoring
 */

import { logger } from '../logging/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (identifier: string, info: RateLimitInfo) => void;
  store?: IRateLimitStore;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsInWindow: number;
  remainingRequests: number;
  resetTime: Date;
  windowStartTime: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  retryAfter?: number;
}

export interface IRateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  set(key: string, record: RateLimitRecord, ttl: number): Promise<void>;
  increment(key: string, windowMs: number): Promise<RateLimitRecord>;
  reset(key: string): Promise<void>;
}

export interface RateLimitRecord {
  totalHits: number;
  windowStartTime: number;
  resetTime: number;
}

/**
 * In-Memory Rate Limit Store
 */
export class MemoryRateLimitStore implements IRateLimitStore {
  private store = new Map<string, RateLimitRecord>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Clean up expired records every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    const record = this.store.get(key);

    if (!record) {
      return null;
    }

    // Check if record is expired
    if (Date.now() > record.resetTime) {
      this.store.delete(key);
      return null;
    }

    return record;
  }

  async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
    this.store.set(key, record);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now();
    const existing = await this.get(key);

    if (!existing || now > existing.resetTime) {
      // Create new window
      const record: RateLimitRecord = {
        totalHits: 1,
        windowStartTime: now,
        resetTime: now + windowMs,
      };

      this.store.set(key, record);
      return record;
    }

    // Increment existing record
    existing.totalHits++;
    this.store.set(key, existing);
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, record] of this.store) {
      if (now > record.resetTime) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.store.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug('Rate limit store cleanup completed', {
        expiredKeys: expiredKeys.length,
        remainingKeys: this.store.size,
      });
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Redis Rate Limit Store
 */
export class RedisRateLimitStore implements IRateLimitStore {
  constructor(private redisClient: any) {}

  async get(key: string): Promise<RateLimitRecord | null> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis rate limit get failed', { error, key });
      return null;
    }
  }

  async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
    try {
      await this.redisClient.setex(
        key,
        Math.ceil(ttl / 1000),
        JSON.stringify(record)
      );
    } catch (error) {
      logger.error('Redis rate limit set failed', { error, key });
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now();
    const ttlSeconds = Math.ceil(windowMs / 1000);

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redisClient.pipeline();
      pipeline.get(key);
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);

      const results = await pipeline.exec();
      const existingData = results[0][1];
      const newCount = results[1][1];

      let record: RateLimitRecord;

      if (!existingData) {
        // New window
        record = {
          totalHits: 1,
          windowStartTime: now,
          resetTime: now + windowMs,
        };
      } else {
        const existing = JSON.parse(existingData);
        record = {
          ...existing,
          totalHits: newCount,
        };
      }

      // Update the record in Redis
      await this.redisClient.setex(key, ttlSeconds, JSON.stringify(record));
      return record;
    } catch (error) {
      logger.error('Redis rate limit increment failed', { error, key });

      // Fallback to basic increment
      return {
        totalHits: 1,
        windowStartTime: now,
        resetTime: now + windowMs,
      };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      logger.error('Redis rate limit reset failed', { error, key });
    }
  }
}

/**
 * Rate Limiter Service
 */
export class RateLimiter {
  private readonly config: Required<RateLimitConfig>;
  private readonly store: IRateLimitStore;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (identifier: string) => `rate_limit:${identifier}`,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      onLimitReached: () => {},
      store: new MemoryRateLimitStore(),
      ...config,
    };

    this.store = this.config.store;
  }

  /**
   * Check if request is allowed and update counters
   */
  async checkLimit(
    identifier: string,
    success?: boolean
  ): Promise<RateLimitResult> {
    try {
      // Skip counting based on configuration
      if (success === true && this.config.skipSuccessfulRequests) {
        return this.getAllowedResult(identifier);
      }

      if (success === false && this.config.skipFailedRequests) {
        return this.getAllowedResult(identifier);
      }

      const key = this.config.keyGenerator(identifier);
      const record = await this.store.increment(key, this.config.windowMs);

      const info = this.createRateLimitInfo(record);
      const allowed = record.totalHits <= this.config.maxRequests;

      if (!allowed) {
        this.config.onLimitReached(identifier, info);

        logger.warn('Rate limit exceeded', {
          identifier,
          totalHits: record.totalHits,
          maxRequests: this.config.maxRequests,
          windowMs: this.config.windowMs,
        });
      }

      return {
        allowed,
        info,
        retryAfter: allowed
          ? undefined
          : Math.ceil((record.resetTime - Date.now()) / 1000),
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error, identifier });

      // Fail open - allow request if rate limiting fails
      return this.getAllowedResult(identifier);
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(identifier: string): Promise<RateLimitInfo> {
    try {
      const key = this.config.keyGenerator(identifier);
      const record = await this.store.get(key);

      if (!record) {
        return this.createDefaultRateLimitInfo();
      }

      return this.createRateLimitInfo(record);
    } catch (error) {
      logger.error('Rate limit status check failed', { error, identifier });
      return this.createDefaultRateLimitInfo();
    }
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    try {
      const key = this.config.keyGenerator(identifier);
      await this.store.reset(key);

      logger.info('Rate limit reset', { identifier });
    } catch (error) {
      logger.error('Rate limit reset failed', { error, identifier });
    }
  }

  /**
   * Create middleware function for Express/Fastify
   */
  createMiddleware(
    options: {
      keyGenerator?: (req: any) => string;
      onLimitReached?: (req: any, reply: any, info: RateLimitInfo) => void;
      skipSuccessfulRequests?: boolean;
      skipFailedRequests?: boolean;
    } = {}
  ) {
    const keyGen = options.keyGenerator || ((req: any) => req.ip || 'unknown');

    return async (req: any, reply: any, next?: any) => {
      try {
        const identifier = keyGen(req);
        const result = await this.checkLimit(identifier);

        // Set rate limit headers
        reply.header('X-RateLimit-Limit', this.config.maxRequests);
        reply.header(
          'X-RateLimit-Remaining',
          Math.max(0, result.info.remainingRequests)
        );
        reply.header(
          'X-RateLimit-Reset',
          Math.ceil(result.info.resetTime.getTime() / 1000)
        );
        reply.header(
          'X-RateLimit-Window',
          Math.ceil(this.config.windowMs / 1000)
        );

        if (!result.allowed) {
          reply.header('Retry-After', result.retryAfter);

          if (options.onLimitReached) {
            options.onLimitReached(req, reply, result.info);
          } else {
            reply.code(429).send({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded',
              retryAfter: result.retryAfter,
            });
          }
          return;
        }

        // Continue to next middleware
        if (next) {
          next();
        }
      } catch (error) {
        logger.error('Rate limit middleware error', { error });

        // Fail open - continue request
        if (next) {
          next();
        }
      }
    };
  }

  private getAllowedResult(identifier: string): RateLimitResult {
    return {
      allowed: true,
      info: this.createDefaultRateLimitInfo(),
    };
  }

  private createRateLimitInfo(record: RateLimitRecord): RateLimitInfo {
    const now = Date.now();
    const remainingRequests = Math.max(
      0,
      this.config.maxRequests - record.totalHits
    );

    return {
      totalHits: record.totalHits,
      totalHitsInWindow: record.totalHits,
      remainingRequests,
      resetTime: new Date(record.resetTime),
      windowStartTime: new Date(record.windowStartTime),
    };
  }

  private createDefaultRateLimitInfo(): RateLimitInfo {
    const now = new Date();

    return {
      totalHits: 0,
      totalHitsInWindow: 0,
      remainingRequests: this.config.maxRequests,
      resetTime: new Date(now.getTime() + this.config.windowMs),
      windowStartTime: now,
    };
  }
}

/**
 * Rate Limiter Factory for different use cases
 */
export class RateLimiterFactory {
  private static limiters = new Map<string, RateLimiter>();

  /**
   * Create or get rate limiter for authentication attempts
   */
  static getAuthLimiter(store?: IRateLimitStore): RateLimiter {
    const key = 'auth';

    if (!this.limiters.has(key)) {
      this.limiters.set(
        key,
        new RateLimiter({
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 5, // 5 attempts per 15 minutes
          keyGenerator: (identifier: string) => `auth_limit:${identifier}`,
          store,
          onLimitReached: (identifier, info) => {
            logger.warn('Authentication rate limit exceeded', {
              identifier,
              attempts: info.totalHits,
              resetTime: info.resetTime,
            });
          },
        })
      );
    }

    return this.limiters.get(key)!;
  }

  /**
   * Create or get rate limiter for API requests
   */
  static getApiLimiter(store?: IRateLimitStore): RateLimiter {
    const key = 'api';

    if (!this.limiters.has(key)) {
      this.limiters.set(
        key,
        new RateLimiter({
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 100, // 100 requests per minute
          keyGenerator: (identifier: string) => `api_limit:${identifier}`,
          store,
          skipSuccessfulRequests: false,
        })
      );
    }

    return this.limiters.get(key)!;
  }

  /**
   * Create or get rate limiter for password reset attempts
   */
  static getPasswordResetLimiter(store?: IRateLimitStore): RateLimiter {
    const key = 'password_reset';

    if (!this.limiters.has(key)) {
      this.limiters.set(
        key,
        new RateLimiter({
          windowMs: 60 * 60 * 1000, // 1 hour
          maxRequests: 3, // 3 attempts per hour
          keyGenerator: (identifier: string) => `pwd_reset_limit:${identifier}`,
          store,
          onLimitReached: (identifier, info) => {
            logger.warn('Password reset rate limit exceeded', {
              identifier,
              attempts: info.totalHits,
              resetTime: info.resetTime,
            });
          },
        })
      );
    }

    return this.limiters.get(key)!;
  }

  /**
   * Create custom rate limiter
   */
  static createCustomLimiter(
    name: string,
    config: RateLimitConfig
  ): RateLimiter {
    const limiter = new RateLimiter(config);
    this.limiters.set(name, limiter);
    return limiter;
  }

  /**
   * Get existing rate limiter by name
   */
  static getLimiter(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }

  /**
   * Remove rate limiter
   */
  static removeLimiter(name: string): boolean {
    return this.limiters.delete(name);
  }

  /**
   * Clear all rate limiters
   */
  static clearAll(): void {
    this.limiters.clear();
  }
}

// Export singleton instances
export const authRateLimiter = RateLimiterFactory.getAuthLimiter();
export const apiRateLimiter = RateLimiterFactory.getApiLimiter();
export const passwordResetRateLimiter =
  RateLimiterFactory.getPasswordResetLimiter();
