import { FastifyRequest, FastifyReply } from 'fastify';
import { IRateLimitService } from '../../application/services/rate-limit.service.interface';

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware {
  constructor(private readonly rateLimitService: IRateLimitService) {}

  /**
   * Apply rate limiting based on IP address
   */
  limit(options: { max: number; timeWindow: string }) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const clientId = this.getClientId(request);
        const isAllowed = await this.rateLimitService.checkLimit(
          clientId,
          options.max,
          options.timeWindow
        );

        if (!isAllowed) {
          return reply.code(429).send({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              timestamp: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        // Log error but don't block request if rate limiting fails
        console.error('Rate limiting error:', error);
      }
    };
  }

  private getClientId(request: FastifyRequest): string {
    // Use user ID if authenticated, otherwise use IP
    const user = (request as any).user;
    return user?.id || request.ip;
  }
}
