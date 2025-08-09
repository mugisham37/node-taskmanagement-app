import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitService } from '../../infrastructure/security/rate-limit-service';
import { AppError } from '../../shared/errors/app-error';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimitMiddleware {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly logger: LoggingService
  ) {}

  createRateLimit = (options: RateLimitOptions) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const key = options.keyGenerator
        ? options.keyGenerator(request)
        : this.getDefaultKey(request);

      try {
        const result = await this.rateLimitService.checkLimit(
          key,
          options.maxRequests,
          options.windowMs
        );

        // Add rate limit headers
        reply.header('X-RateLimit-Limit', options.maxRequests);
        reply.header(
          'X-RateLimit-Remaining',
          Math.max(0, options.maxRequests - result.count)
        );
        reply.header(
          'X-RateLimit-Reset',
          new Date(result.resetTime).toISOString()
        );

        if (result.blocked) {
          this.logger.warn('Rate limit exceeded', {
            key,
            count: result.count,
            limit: options.maxRequests,
            windowMs: options.windowMs,
            url: request.url,
            method: request.method,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          });

          throw new AppError(
            'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT_EXCEEDED',
            429,
            {
              retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            }
          );
        }

        this.logger.debug('Rate limit check passed', {
          key,
          count: result.count,
          limit: options.maxRequests,
          remaining: options.maxRequests - result.count,
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        this.logger.error('Rate limit check failed', error as Error, {
          key,
          url: request.url,
          method: request.method,
        });

        // If rate limiting fails, allow the request to proceed
        // but log the error for monitoring
      }
    };
  };

  // Predefined rate limit configurations
  static readonly STRICT = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  };

  static readonly MODERATE = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  };

  static readonly LENIENT = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5000,
  };

  static readonly AUTH = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Very strict for auth endpoints
  };

  private getDefaultKey(request: FastifyRequest): string {
    // Use user ID if authenticated, otherwise use IP
    const user = (request as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }
    return `ip:${request.ip}`;
  }
}
