import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AppError } from '../../shared/errors/app-error';

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: FastifyRequest) => string;
  onLimitReached?: (req: FastifyRequest, res: FastifyReply) => void;
  message?: string;
}

export interface RateLimitConfig {
  global?: RateLimitRule;
  perUser?: RateLimitRule;
  perIP?: RateLimitRule;
  perEndpoint?: Record<string, RateLimitRule>;
  perUserPerEndpoint?: Record<string, RateLimitRule>;
}

export interface RateLimitStore {
  key: string;
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class EnhancedRateLimiterMiddleware {
  private readonly stores = new Map<string, RateLimitStore>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly logger: LoggingService,
    private readonly config: RateLimitConfig
  ) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Global rate limiting middleware
   */
  globalRateLimit() {
    if (!this.config.global) {
      return (req: FastifyRequest, res: FastifyReply, next: () => void) =>
        next();
    }

    return this.createRateLimiter(this.config.global, 'global');
  }

  /**
   * Per-IP rate limiting middleware
   */
  perIPRateLimit() {
    if (!this.config.perIP) {
      return (req: FastifyRequest, res: FastifyReply, next: () => void) =>
        next();
    }

    const rule = {
      ...this.config.perIP,
      keyGenerator: (req: FastifyRequest) => `ip:${this.getClientIP(req)}`,
    };

    return this.createRateLimiter(rule, 'per-ip');
  }

  /**
   * Per-user rate limiting middleware
   */
  perUserRateLimit() {
    if (!this.config.perUser) {
      return (req: FastifyRequest, res: FastifyReply, next: () => void) =>
        next();
    }

    const rule = {
      ...this.config.perUser,
      keyGenerator: (req: FastifyRequest) => {
        const user = req.user;
        return user ? `user:${user.id}` : `ip:${this.getClientIP(req)}`;
      },
    };

    return this.createRateLimiter(rule, 'per-user');
  }

  /**
   * Per-endpoint rate limiting middleware
   */
  perEndpointRateLimit() {
    return (req: FastifyRequest, res: FastifyReply, next: () => void) => {
      const endpoint = this.getEndpointKey(req);
      const rule = this.config.perEndpoint?.[endpoint];

      if (!rule) {
        return next();
      }

      const enhancedRule = {
        ...rule,
        keyGenerator: (req: FastifyRequest) =>
          `endpoint:${endpoint}:${this.getClientIP(req)}`,
      };

      return this.createRateLimiter(enhancedRule, 'per-endpoint')(
        req,
        res,
        next
      );
    };
  }

  /**
   * Authentication rate limiting (for login attempts)
   */
  authRateLimit(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    const rule: RateLimitRule = {
      windowMs,
      maxRequests: maxAttempts,
      keyGenerator: (req: FastifyRequest) => {
        const email = (req.body as any)?.email || (req.body as any)?.username;
        const ip = this.getClientIP(req);
        return `auth:${email || ip}`;
      },
      message: 'Too many authentication attempts. Please try again later.',
      onLimitReached: (req: FastifyRequest, res: FastifyReply) => {
        this.logger.warn('Authentication rate limit exceeded', {
          ip: this.getClientIP(req),
          email: (req.body as any)?.email,
          userAgent: req.headers['user-agent'],
        });
      },
    };

    return this.createRateLimiter(rule, 'auth');
  }

  /**
   * API key rate limiting
   */
  apiKeyRateLimit(
    maxRequests: number = 1000,
    windowMs: number = 60 * 60 * 1000
  ) {
    const rule: RateLimitRule = {
      windowMs,
      maxRequests,
      keyGenerator: (req: FastifyRequest) => {
        const apiKey = req.headers['x-api-key'] as string;
        return `api-key:${apiKey || this.getClientIP(req)}`;
      },
      message: 'API rate limit exceeded for this key.',
    };

    return this.createRateLimiter(rule, 'api-key');
  }

  /**
   * Burst protection middleware
   */
  burstProtection(maxBurst: number = 10, burstWindowMs: number = 1000) {
    const rule: RateLimitRule = {
      windowMs: burstWindowMs,
      maxRequests: maxBurst,
      keyGenerator: (req: FastifyRequest) => {
        const user = req.user;
        const key = user ? user.id : this.getClientIP(req);
        return `burst:${key}`;
      },
      message: 'Too many requests in a short time. Please slow down.',
    };

    return this.createRateLimiter(rule, 'burst');
  }

  /**
   * Adaptive rate limiting based on server load
   */
  adaptiveRateLimit() {
    return (req: FastifyRequest, res: FastifyReply, next: () => void) => {
      const serverLoad = this.getServerLoad();
      let maxRequests = 100; // Base limit
      let windowMs = 60000; // 1 minute

      // Adjust limits based on server load
      if (serverLoad > 0.8) {
        maxRequests = 20;
        windowMs = 60000;
      } else if (serverLoad > 0.6) {
        maxRequests = 50;
        windowMs = 60000;
      }

      const rule: RateLimitRule = {
        windowMs,
        maxRequests,
        keyGenerator: (req: FastifyRequest) =>
          `adaptive:${this.getClientIP(req)}`,
        message: 'Server is under high load. Please try again later.',
      };

      return this.createRateLimiter(rule, 'adaptive')(req, res, next);
    };
  }

  /**
   * Create a rate limiter middleware with the given rule
   */
  private createRateLimiter(rule: RateLimitRule, type: string) {
    return async (
      req: FastifyRequest,
      res: FastifyReply,
      next?: () => void
    ) => {
      try {
        const key = rule.keyGenerator
          ? rule.keyGenerator(req)
          : this.getClientIP(req);
        const now = Date.now();

        // Get or create store entry
        let store = this.stores.get(key);

        if (!store || store.resetTime <= now) {
          // Create new window
          store = {
            key,
            count: 0,
            resetTime: now + rule.windowMs,
            firstRequest: now,
          };
          this.stores.set(key, store);
        }

        // Check if request should be counted
        const shouldCount = this.shouldCountRequest(req, res, rule);

        if (shouldCount) {
          store.count++;
        }

        // Check if limit exceeded
        if (store.count > rule.maxRequests) {
          const retryAfter = Math.ceil((store.resetTime - now) / 1000);

          // Call custom handler if provided
          if (rule.onLimitReached) {
            rule.onLimitReached(req, res);
          }

          // Log rate limit violation
          this.logger.warn('Rate limit exceeded', {
            type,
            key,
            count: store.count,
            limit: rule.maxRequests,
            windowMs: rule.windowMs,
            retryAfter,
            ip: this.getClientIP(req),
            userAgent: req.headers['user-agent'],
            userId: req.user?.id,
          });

          // Set rate limit headers
          res.headers({
            'X-RateLimit-Limit': rule.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': store.resetTime.toString(),
            'Retry-After': retryAfter.toString(),
          });

          throw new AppError(
            rule.message || 'Too many requests',
            429,
            'RATE_LIMIT_EXCEEDED',
            { retryAfter }
          );
        }

        // Set rate limit headers for successful requests
        const remaining = Math.max(0, rule.maxRequests - store.count);
        res.headers({
          'X-RateLimit-Limit': rule.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': store.resetTime.toString(),
        });

        if (next) next();
      } catch (error) {
        this.logger.error('Rate limiter error', error as Error);
        if (error instanceof AppError) {
          throw error;
        }
        if (next) next(); // Don't block requests on rate limiter errors
      }
    };
  }

  /**
   * Determine if request should be counted against rate limit
   */
  private shouldCountRequest(
    req: FastifyRequest,
    res: FastifyReply,
    rule: RateLimitRule
  ): boolean {
    // Skip counting based on rule configuration
    if (rule.skipSuccessfulRequests && res.statusCode < 400) {
      return false;
    }

    if (rule.skipFailedRequests && res.statusCode >= 400) {
      return false;
    }

    return true;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: FastifyRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      'unknown'
    );
  }

  /**
   * Get endpoint key for rate limiting
   */
  private getEndpointKey(req: FastifyRequest): string {
    // Normalize endpoint path (remove IDs and query params)
    const path = req.url
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id'
      )
      .replace(/\/\d+/g, '/:id')
      .split('?')[0]; // Remove query parameters

    return `${req.method}:${path}`;
  }

  /**
   * Get current server load (simplified implementation)
   */
  private getServerLoad(): number {
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;

    // Simplified load calculation (in a real implementation, you'd use more sophisticated metrics)
    return Math.min(1, totalUsage / 1000000); // Convert microseconds to a 0-1 scale
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, store] of this.stores.entries()) {
      if (store.resetTime <= now) {
        this.stores.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Rate limiter cleanup completed', {
        entriesRemoved: cleaned,
        remainingEntries: this.stores.size,
      });
    }
  }

  /**
   * Get current rate limit status for a key
   */
  getRateLimitStatus(key: string): RateLimitStore | null {
    return this.stores.get(key) || null;
  }

  /**
   * Reset rate limit for a specific key
   */
  resetRateLimit(key: string): void {
    this.stores.delete(key);
    this.logger.info('Rate limit reset', { key });
  }

  /**
   * Get all active rate limit entries (for monitoring)
   */
  getAllRateLimits(): RateLimitStore[] {
    return Array.from(this.stores.values());
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.stores.clear();
  }
}
