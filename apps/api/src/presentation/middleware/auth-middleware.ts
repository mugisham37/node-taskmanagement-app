import { JWTService } from '@taskmanagement/auth';
import { IUserRepository, UserId } from '@taskmanagement/domain';
import { LoggingService } from '@taskmanagement/observability';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthorizationError } from '../../shared/errors/authorization-error';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  role?: string;
  workspaceId?: string;
  permissions?: string[];
  riskScore?: number;
  sessionId?: string;
  deviceId?: string;
  mfaEnabled?: boolean;
  emailVerified?: boolean;
}

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  role: string;
  permissions: string[];
}

export interface AuthContext {
  ipAddress?: string;
  userAgent?: string | undefined;
  deviceFingerprint?: string | undefined;
  requestPath: string;
  requestMethod: string;
  correlationId: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface AuthenticationOptions {
  optional?: boolean;
  requireWorkspace?: boolean;
  allowedRoles?: string[];
  requiredPermissions?: string[];
  requireMfa?: boolean;
  requireEmailVerification?: boolean;
  maxRiskScore?: number;
  rateLimitKey?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    workspaceContext?: WorkspaceContext;
    authContext?: AuthContext;
    rateLimitInfo?: RateLimitInfo;
  }
}

export class AuthMiddleware {
  constructor(
    private readonly jwtService: JWTService,
    private readonly userRepository: IUserRepository,
    private readonly logger: LoggingService
  ) {}

  authenticate = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
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
      const payload = this.jwtService.verifyAccessToken(token);

      if (!payload.sub) {
        throw new AuthorizationError('Invalid token payload');
      }

      // Get user from database to ensure they still exist and are active
      const user = await this.userRepository.findById(new UserId(payload.sub));

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
        isActive: user.isActive(),
        role: payload['role'],
        workspaceId: payload['workspaceId'],
        permissions: payload.permissions || [],
        riskScore: payload['riskScore'] || 0,
        sessionId: payload.sessionId,
        deviceId: payload['deviceId'],
        mfaEnabled: payload['mfaEnabled'] || false,
        emailVerified: payload['emailVerified'] || false,
      };

      // Add auth context
      request.authContext = this.extractAuthContext(request);

      this.logger.debug('User authenticated successfully', {
        userId: user.id.value,
        email: user.email.value,
      });
    } catch (error) {
      this.logger.warn('Authentication failed', {
        url: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
        error: (error as Error).message,
      });

      if (error instanceof AuthorizationError) {
        throw error;
      }

      throw new AuthorizationError('Authentication failed');
    }
  };

  /**
   * Enhanced authentication with options
   */
  authenticateWithOptions = (options: AuthenticationOptions = {}) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Extract authentication context
        const authContext = this.extractAuthContext(request);
        request.authContext = authContext;

        // Get authentication token
        const token = this.extractToken(request);

        if (!token) {
          if (options.optional) {
            return;
          }

          this.logger.warn('Authentication failed: No token provided', {
            ip: authContext.ipAddress,
            userAgent: authContext.userAgent,
          });

          throw new AuthorizationError('Authentication token is required');
        }

        // Verify and decode the JWT token
        const payload = this.jwtService.verifyAccessToken(token);

        if (!payload.sub) {
          throw new AuthorizationError('Invalid token payload');
        }

        // Get user from database
        const user = await this.userRepository.findById(new UserId(payload.sub));

        if (!user) {
          throw new AuthorizationError('User not found');
        }

        if (!user.isActive) {
          throw new AuthorizationError('User account is deactivated');
        }

        // Check role restrictions
        if (options.allowedRoles && !options.allowedRoles.includes(payload['role'])) {
          this.logger.warn('Authorization failed: Insufficient role', {
            userId: payload.sub,
            userRole: payload['role'],
            requiredRoles: options.allowedRoles,
          });

          throw new AuthorizationError('Insufficient role permissions');
        }

        // Check email verification requirement
        if (options.requireEmailVerification && !payload['emailVerified']) {
          throw new AuthorizationError('Email verification required');
        }

        // Check MFA requirement
        if (options.requireMfa && !payload['mfaEnabled']) {
          throw new AuthorizationError('Multi-factor authentication required');
        }

        // Check risk score threshold
        if (options.maxRiskScore && payload['riskScore'] > options.maxRiskScore) {
          this.logger.warn('Authorization failed: High risk score', {
            userId: payload.sub,
            riskScore: payload['riskScore'],
            threshold: options.maxRiskScore,
          });

          throw new AuthorizationError('Access denied due to security risk');
        }

        // Check permissions
        if (options.requiredPermissions && options.requiredPermissions.length > 0) {
          const userPermissions = payload.permissions || [];
          const hasAllPermissions = options.requiredPermissions.every((permission) =>
            userPermissions.includes(permission)
          );

          if (!hasAllPermissions) {
            const missingPermissions = options.requiredPermissions.filter(
              (permission) => !userPermissions.includes(permission)
            );

            this.logger.warn('Authorization failed: Missing permissions', {
              userId: payload.sub,
              missingPermissions,
              requiredPermissions: options.requiredPermissions,
            });

            throw new AuthorizationError('Insufficient permissions');
          }
        }

        // Attach user to request
        request.user = {
          id: user.id.value,
          email: user.email.value,
          name: user.name,
          isActive: user.isActive(),
          role: payload['role'],
          workspaceId: payload['workspaceId'],
          permissions: payload.permissions || [],
          riskScore: payload['riskScore'] || 0,
          sessionId: payload.sessionId,
          deviceId: payload['deviceId'],
          mfaEnabled: payload['mfaEnabled'] || false,
          emailVerified: payload['emailVerified'] || false,
        };

        // Add workspace context if available
        if (payload['workspaceId']) {
          request.workspaceContext = {
            workspaceId: payload['workspaceId'],
            workspaceName: payload['workspaceName'] || '',
            role: payload['workspaceRole'] || payload['role'],
            permissions: payload['workspacePermissions'] || payload.permissions || [],
          };
        } else if (options.requireWorkspace) {
          throw new AuthorizationError('Workspace context required');
        }

        // Add security headers
        this.addSecurityHeaders(reply, payload['riskScore'] || 0);
      } catch (error) {
        this.logger.error('Enhanced authentication failed', error as Error);
        if (error instanceof AuthorizationError) {
          throw error;
        }
        throw new AuthorizationError('Authentication service error');
      }
    };
  };

  // Optional authentication - doesn't throw if no token provided
  optionalAuthenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.authenticate(request, reply);
    } catch (error) {
      // Silently ignore authentication errors for optional auth
      this.logger.debug('Optional authentication failed', error as Error);
    }
  };

  requireRole = (allowedRoles: string[]) => {
    return this.authenticateWithOptions({ allowedRoles });
  };

  requirePermissions = (permissions: string | string[]) => {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    return this.authenticateWithOptions({ requiredPermissions });
  };

  requireWorkspace = () => {
    return this.authenticateWithOptions({ requireWorkspace: true });
  };

  requireHighSecurity = () => {
    return this.authenticateWithOptions({
      requireMfa: true,
      requireEmailVerification: true,
      maxRiskScore: 0.3,
    });
  };

  requireAdmin = () => {
    return this.authenticateWithOptions({
      allowedRoles: ['system_admin', 'workspace_admin'],
      requireMfa: true,
      maxRiskScore: 0.5,
    });
  };

  optionalAuth = () => {
    return this.authenticateWithOptions({ optional: true });
  };

  // Private helper methods
  private extractAuthContext(request: FastifyRequest): AuthContext {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] || undefined,
      deviceFingerprint: (request.headers['x-device-fingerprint'] as string) || undefined,
      requestPath: request.url,
      requestMethod: request.method,
      correlationId:
        (request.headers['x-correlation-id'] as string) || this.generateCorrelationId(),
    };
  }

  private extractToken(request: FastifyRequest): string | null {
    // Try Authorization header first
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie (if using cookie-based auth)
    const cookies = (request as any).cookies;
    if (cookies && cookies.accessToken) {
      return cookies.accessToken;
    }

    return null;
  }

  private addSecurityHeaders(reply: FastifyReply, riskScore: number): void {
    // Add security headers based on risk score
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (riskScore > 0.5) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Add risk score header for debugging (remove in production)
    if (process.env['NODE_ENV'] !== 'production') {
      reply.header('X-Risk-Score', riskScore.toString());
    }
  }

  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}
