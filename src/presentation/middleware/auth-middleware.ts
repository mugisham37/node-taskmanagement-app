import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTService } from '../../infrastructure/security/jwt-service';
import { UserRepository } from '../../infrastructure/persistence/repositories/user-repository';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export class AuthMiddleware {
  constructor(
    private readonly jwtService: JWTService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggingService
  ) {}

  authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthorizationError('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        throw new AuthorizationError('Missing access token');
      }

      // Verify and decode the JWT token
      const payload = await this.jwtService.verifyToken(token);

      if (!payload.sub) {
        throw new AuthorizationError('Invalid token payload');
      }

      // Get user from database to ensure they still exist and are active
      const user = await this.userRepository.findById(payload.sub);

      if (!user) {
        throw new AuthorizationError('User not found');
      }

      if (!user.isActive) {
        throw new AuthorizationError('User account is deactivated');
      }

      // Attach user to request
      request.user = {
        id: user.id.value,
        email: user.email.value,
        name: user.name,
        isActive: user.isActive,
      };

      this.logger.debug('User authenticated successfully', {
        userId: user.id.value,
        email: user.email.value,
      });
    } catch (error) {
      this.logger.warn('Authentication failed', error as Error, {
        url: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
      });

      if (error instanceof AuthorizationError) {
        throw error;
      }

      throw new AuthorizationError('Authentication failed');
    }
  };

  // Optional authentication - doesn't throw if no token provided
  optionalAuthenticate = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      await this.authenticate(request, reply);
    } catch (error) {
      // Silently ignore authentication errors for optional auth
      this.logger.debug('Optional authentication failed', error as Error);
    }
  };
}
