import { FastifyRequest, FastifyReply } from 'fastify';
import { RiskAssessmentService } from '../domain/authentication/services/RiskAssessmentService';
import { UserId } from '../domain/authentication/value-objects/UserId';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: FastifyRequest) => string;
  onLimitReached?: (request: FastifyRequest, reply: FastifyReply) => void;
}

export interface AdaptiveRateLimitConfig extends RateLimitConfig {
  riskMultipliers: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  userTypeMultipliers: {
    admin: number;
    member: number;
    viewer: number;
  };
  endpointMultipliers: Record<string, number>;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  riskLevel?: string;
  riskScore?: number;
}

export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(
    key: string,
    value: { count: number; resetTime: number },
    ttl: number
  ): Promise<void>;
  increment(
    key: string,
    ttl: number
  ): Promise<{ count: number; resetTime: number }>;
  delete(key: string): Promise<void>;
}

/**
 * In-memory rate limit store (for development/testing)
 * In production, use Redis or similar distributed cache
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  async set(
    key: string,
    value: { count: number; resetTime: number },
    ttl: number
  ): Promise<void> {
    this.store.set(key, value);

    // Clean up expired entries periodically
    setTimeout(() => {
      const entry = this.store.get(key);
      if (entry && Date.now() > entry.resetTime) {
        this.store.delete(key);
      }
    }, ttl);
  }

  async increment(
    key: string,
    ttl: number
  ): Promise<{ count: number; resetTime: number }> {
    const existing = await this.get(key);

    if (existing) {
      existing.count++;
      await this.set(key, existing, ttl);
      return existing;
    } else {
      const newEntry = {
        count: 1,
        resetTime: Date.now() + ttl,
      };
      await this.set(key, newEntry, ttl);
      return newEntry;
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Intelligent Rate Limiting Middleware with adaptive throttling based on user behavior
 * Adjusts rate limits based on risk scores, user types, and endpoint sensitivity
 */
export class IntelligentRateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly riskAssessmentService: RiskAssessmentService,
    private readonly config: AdaptiveRateLimitConfig
  ) {}

  /**
   * Create rate limiting middleware
   */
  createMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const key = this.generateKey(request);
        const limit = await this.calculateAdaptiveLimit(request);

        // Get current count
        const current = await this.store.increment(key, this.config.windowMs);

        // Calculate remaining requests
        const remaining = Math.max(0, limit - current.count);

        // Set rate limit headers
        reply.header('X-RateLimit-Limit', limit.toString());
        reply.header('X-RateLimit-Remaining', remaining.toString());
        reply.header(
          'X-RateLimit-Reset',
          new Date(current.resetTime).toISOString()
        );

        // Add risk information if user is authenticated
        if (request.user) {
          reply.header(
            'X-RateLimit-Risk-Score',
            request.user.riskScore.toString()
          );
          reply.header(
            'X-RateLimit-Risk-Level',
            this.getRiskLevel(request.user.riskScore)
          );
        }

        // Check if limit exceeded
        if (current.count > limit) {
          await this.handleLimitExceeded(request, reply, {
            limit,
            remaining: 0,
            resetTime: new Date(current.resetTime),
            riskScore: request.user?.riskScore,
            riskLevel: request.user
              ? this.getRiskLevel(request.user.riskScore)
              : undefined,
          });
          return;
        }

        // Log high-frequency requests for monitoring
        if (current.count > limit * 0.8) {
          console.warn('High request frequency detected', {
            key,
            count: current.count,
            limit,
            userId: request.user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            path: request.url,
          });
        }
      } catch (error) {
        // If rate limiting fails, log error but don't block request
        console.error('Rate limiting error:', error);
      }
    };
  }

  /**
   * Calculate adaptive rate limit based on user context
   */
  private async calculateAdaptiveLimit(
    request: FastifyRequest
  ): Promise<number> {
    let baseLimit = this.config.maxRequests;

    // Apply risk-based multiplier
    if (request.user) {
      const riskLevel = this.getRiskLevel(request.user.riskScore);
      const riskMultiplier = this.config.riskMultipliers[riskLevel];
      baseLimit = Math.floor(baseLimit * riskMultiplier);

      // Apply user type multiplier
      const userRole = request.user.role || 'member';
      const userMultiplier =
        this.config.userTypeMultipliers[
          userRole as keyof typeof this.config.userTypeMultipliers
        ] || 1;
      baseLimit = Math.floor(baseLimit * userMultiplier);
    }

    // Apply endpoint-specific multiplier
    const endpointMultiplier = this.getEndpointMultiplier(request.url);
    baseLimit = Math.floor(baseLimit * endpointMultiplier);

    // Ensure minimum limit
    return Math.max(baseLimit, 10);
  }

  /**
   * Generate cache key for rate limiting
   */
  private generateKey(request: FastifyRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Use user ID if authenticated, otherwise IP address
    const identifier = request.user?.id || request.ip;
    const endpoint = this.normalizeEndpoint(request.url);

    return `rate_limit:${identifier}:${endpoint}`;
  }

  /**
   * Handle rate limit exceeded
   */
  private async handleLimitExceeded(
    request: FastifyRequest,
    reply: FastifyReply,
    info: RateLimitInfo
  ): Promise<void> {
    // Custom handler if provided
    if (this.config.onLimitReached) {
      this.config.onLimitReached(request, reply);
      return;
    }

    // Log rate limit violation
    console.warn('Rate limit exceeded', {
      userId: request.user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      path: request.url,
      method: request.method,
      limit: info.limit,
      riskScore: info.riskScore,
      riskLevel: info.riskLevel,
    });

    // Increase user risk score for rate limit violations
    if (request.user) {
      try {
        const userId = UserId.create(request.user.id);
        const currentRisk = request.user.riskScore;
        const newRisk = Math.min(currentRisk + 0.1, 1.0);

        await this.riskAssessmentService.updateUserRiskScore(
          userId,
          newRisk,
          'Rate limit exceeded'
        );
      } catch (error) {
        console.error(
          'Failed to update risk score for rate limit violation:',
          error
        );
      }
    }

    // Send rate limit response
    reply.code(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((info.resetTime.getTime() - Date.now()) / 1000),
      limit: info.limit,
      remaining: info.remaining,
      resetTime: info.resetTime.toISOString(),
      riskLevel: info.riskLevel,
    });
  }

  /**
   * Get risk level from risk score
   */
  private getRiskLevel(
    riskScore: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.9) return 'critical';
    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Get endpoint-specific multiplier
   */
  private getEndpointMultiplier(url: string): number {
    const normalizedEndpoint = this.normalizeEndpoint(url);

    // Check for exact matches first
    if (this.config.endpointMultipliers[normalizedEndpoint]) {
      return this.config.endpointMultipliers[normalizedEndpoint];
    }

    // Check for pattern matches
    for (const [pattern, multiplier] of Object.entries(
      this.config.endpointMultipliers
    )) {
      if (
        pattern.includes('*') &&
        this.matchesPattern(normalizedEndpoint, pattern)
      ) {
        return multiplier;
      }
    }

    return 1.0; // Default multiplier
  }

  /**
   * Normalize endpoint for consistent matching
   */
  private normalizeEndpoint(url: string): string {
    // Remove query parameters and normalize path
    const path = url.split('?')[0];

    // Replace IDs with placeholders for pattern matching
    return path
      .replace(/\/[a-f0-9-]{36}/g, '/:id')
      .replace(/\/\d+/g, '/:id')
      .toLowerCase();
  }

  /**
   * Check if endpoint matches pattern
   */
  private matchesPattern(endpoint: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/:\w+/g, '[^/]+');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(endpoint);
  }
}

/**
 * Factory function to create rate limiter with default configuration
 */
export function createIntelligentRateLimiter(
  riskAssessmentService: RiskAssessmentService,
  store?: RateLimitStore,
  customConfig?: Partial<AdaptiveRateLimitConfig>
): IntelligentRateLimiter {
  const defaultConfig: AdaptiveRateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // Base limit
    riskMultipliers: {
      low: 1.0,
      medium: 0.7,
      high: 0.4,
      critical: 0.1,
    },
    userTypeMultipliers: {
      admin: 2.0,
      member: 1.0,
      viewer: 0.8,
    },
    endpointMultipliers: {
      // Authentication endpoints (more restrictive)
      '/api/v1/auth/login': 0.1,
      '/api/v1/auth/register': 0.05,
      '/api/v1/auth/forgot-password': 0.02,
      '/api/v1/auth/reset-password': 0.05,

      // MFA endpoints
      '/api/v1/auth/mfa/*': 0.2,

      // File upload endpoints
      '/api/v1/files/upload': 0.3,
      '/api/v1/attachments/upload': 0.3,

      // Export endpoints
      '/api/v1/*/export': 0.1,

      // Search endpoints
      '/api/v1/search/*': 0.5,

      // Bulk operations
      '/api/v1/*/bulk/*': 0.2,

      // Admin endpoints
      '/api/v1/admin/*': 0.5,

      // Regular CRUD operations
      '/api/v1/tasks/*': 1.0,
      '/api/v1/projects/*': 1.0,
      '/api/v1/workspaces/*': 1.0,
    },
  };

  const config = { ...defaultConfig, ...customConfig };
  const rateLimitStore = store || new MemoryRateLimitStore();

  return new IntelligentRateLimiter(
    rateLimitStore,
    riskAssessmentService,
    config
  );
}

/**
 * Predefined rate limiter configurations
 */
export const rateLimiterConfigs = {
  // Strict rate limiting for authentication endpoints
  authentication: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    riskMultipliers: {
      low: 1.0,
      medium: 0.5,
      high: 0.2,
      critical: 0.1,
    },
  },

  // Moderate rate limiting for API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    riskMultipliers: {
      low: 1.0,
      medium: 0.7,
      high: 0.4,
      critical: 0.1,
    },
  },

  // Lenient rate limiting for static content
  static: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5000,
    riskMultipliers: {
      low: 1.0,
      medium: 0.9,
      high: 0.7,
      critical: 0.3,
    },
  },
};
