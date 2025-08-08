import { FastifyRequest, FastifyReply } from 'fastify';
import { IAuthenticationService } from '../../application/services/authentication.service.interface';

/**
 * Authentication middleware for protecting routes
 */
export class AuthMiddleware {
  constructor(private readonly authService: IAuthenticationService) {}

  /**
   * Verify JWT token and attach user to request
   */
  async authenticate(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const token = this.extractToken(request);
      if (!token) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authentication token is required',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const user = await this.authService.verifyToken(token);
      (request as any).user = user;
    } catch (error) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
