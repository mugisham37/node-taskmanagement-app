import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTService, TokenPayload } from './jwt-service';
import { RateLimitService } from './rate-limit-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface AuthenticatedRequest extends FastifyRequest {
  user: TokenPayload & {
    id: string;
    sessionId: string;
  };
}

export interface AuthMiddlewareConfig {
  jwtService: JWTService;
  rateLimitService?: RateLimitService;
  skipPaths?: string[];
  optionalPaths?: string[];
  requireEmailVerification?: boolean;
}

export interface PermissionConfig {
  resource: string;
  action: string;
  allowOwner?: boolean;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

export class AuthMiddleware {
  constructor(private readonly config: AuthMiddlewareConfig) {}

  /**
   * Authentication middleware - verifies JWT token
   */
  authenticate() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip authentication for certain paths
      if (this.shouldSkipAuth(request.url)) {
        return;
      }

      try {
        const token = this.extractToken(request);

        if (!token) {
          if (this.isOptionalAuth(request.url)) {
            return;
          }
          throw new AuthorizationError('Authentication token is required');
        }

        // Apply rate limiting if configured
        if (this.config.rateLimitService) {
          const clientId = this.getClientIdentifier(request);
          const rateLimitResult = await this.config.rateLimitService.checkLimit(
            clientId,
            'auth',
            {
              windowMs: 60000, // 1 minute
              maxRequests: 100, // 100 auth requests per minute
            }
          );

          if (!rateLimitResult.allowed) {
            reply.code(429).send({
              error: 'Too Many Requests',
              message: 'Authentication rate limit exceeded',
              resetTime: rateLimitResult.resetTime,
            });
            return;
          }
        }

        // Verify token
        const payload = this.config.jwtService.verifyAccessToken(token);

        // Check if email verification is required
        if (
          this.config.requireEmailVerification &&
          !payload.permissions.includes('email:verified')
        ) {
          throw new AuthorizationError('Email verification is required');
        }

        // Attach user to request
        (request as AuthenticatedRequest).user = {
          ...payload,
          id: payload.userId,
          sessionId: payload.sessionId,
        };
      } catch (error) {
        if (error instanceof AuthorizationError) {
          reply.code(401).send({
            error: 'Unauthorized',
            message: error.message,
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Authentication failed',
        });
        return;
      }
    };
  }

  /**
   * Authorization middleware - checks permissions
   */
  authorize(config: PermissionConfig) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw new AuthorizationError('User not authenticated');
        }

        // Check if user has required roles
        if (config.requiredRoles && config.requiredRoles.length > 0) {
          const hasRequiredRole = config.requiredRoles.some(role =>
            user.roles.includes(role)
          );

          if (!hasRequiredRole) {
            throw new AuthorizationError(
              `Access denied. Required roles: ${config.requiredRoles.join(', ')}`
            );
          }
        }

        // Check if user has required permissions
        if (
          config.requiredPermissions &&
          config.requiredPermissions.length > 0
        ) {
          const hasRequiredPermission = config.requiredPermissions.some(
            permission => user.permissions.includes(permission)
          );

          if (!hasRequiredPermission) {
            throw new AuthorizationError(
              `Access denied. Required permissions: ${config.requiredPermissions.join(', ')}`
            );
          }
        }

        // Check resource-specific permissions
        const resourcePermission = `${config.resource}:${config.action}`;
        if (
          !user.permissions.includes(resourcePermission) &&
          !user.permissions.includes('*:*')
        ) {
          // Check if user is owner and owner access is allowed
          if (config.allowOwner) {
            const resourceId = this.extractResourceId(request, config.resource);
            if (
              resourceId &&
              (await this.isResourceOwner(user.id, config.resource, resourceId))
            ) {
              return; // Allow access for owner
            }
          }

          throw new AuthorizationError(
            `Access denied. Missing permission: ${resourcePermission}`
          );
        }
      } catch (error) {
        if (error instanceof AuthorizationError) {
          reply.code(403).send({
            error: 'Forbidden',
            message: error.message,
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Authorization failed',
        });
        return;
      }
    };
  }

  /**
   * Role-based authorization middleware
   */
  requireRole(roles: string | string[]) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw new AuthorizationError('User not authenticated');
        }

        const hasRequiredRole = requiredRoles.some(role =>
          user.roles.includes(role)
        );

        if (!hasRequiredRole) {
          throw new AuthorizationError(
            `Access denied. Required roles: ${requiredRoles.join(', ')}`
          );
        }
      } catch (error) {
        if (error instanceof AuthorizationError) {
          reply.code(403).send({
            error: 'Forbidden',
            message: error.message,
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Role authorization failed',
        });
        return;
      }
    };
  }

  /**
   * Permission-based authorization middleware
   */
  requirePermission(permissions: string | string[]) {
    const requiredPermissions = Array.isArray(permissions)
      ? permissions
      : [permissions];

    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw new AuthorizationError('User not authenticated');
        }

        // Check for wildcard permission
        if (user.permissions.includes('*:*')) {
          return;
        }

        const hasRequiredPermission = requiredPermissions.some(permission =>
          user.permissions.includes(permission)
        );

        if (!hasRequiredPermission) {
          throw new AuthorizationError(
            `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
          );
        }
      } catch (error) {
        if (error instanceof AuthorizationError) {
          reply.code(403).send({
            error: 'Forbidden',
            message: error.message,
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Permission authorization failed',
        });
        return;
      }
    };
  }

  /**
   * Owner-based authorization middleware
   */
  requireOwnership(resource: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          throw new AuthorizationError('User not authenticated');
        }

        // Admin users bypass ownership checks
        if (user.roles.includes('admin') || user.permissions.includes('*:*')) {
          return;
        }

        const resourceId = this.extractResourceId(request, resource);

        if (!resourceId) {
          throw new AuthorizationError('Resource ID not found');
        }

        const isOwner = await this.isResourceOwner(
          user.id,
          resource,
          resourceId
        );

        if (!isOwner) {
          throw new AuthorizationError(
            'Access denied. You must be the owner of this resource'
          );
        }
      } catch (error) {
        if (error instanceof AuthorizationError) {
          reply.code(403).send({
            error: 'Forbidden',
            message: error.message,
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Ownership authorization failed',
        });
        return;
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(
    action: string,
    config?: { windowMs?: number; maxRequests?: number }
  ) {
    if (!this.config.rateLimitService) {
      throw new InfrastructureError('Rate limit service not configured');
    }

    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientId = this.getClientIdentifier(request);
        const rateLimitResult = await this.config.rateLimitService!.checkLimit(
          clientId,
          action,
          config
        );

        if (!rateLimitResult.allowed) {
          reply.code(429).send({
            error: 'Too Many Requests',
            message: `Rate limit exceeded for action: ${action}`,
            resetTime: rateLimitResult.resetTime,
            remaining: rateLimitResult.remaining,
          });
          return;
        }

        // Add rate limit headers
        reply.header('X-RateLimit-Limit', config?.maxRequests || 100);
        reply.header('X-RateLimit-Remaining', rateLimitResult.remaining);
        reply.header('X-RateLimit-Reset', rateLimitResult.resetTime.getTime());
      } catch (error) {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Rate limiting failed',
        });
        return;
      }
    };
  }

  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check for token in cookies
    const cookieToken = request.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    // Check for token in query parameters (not recommended for production)
    const queryToken = (request.query as any)?.token;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  private shouldSkipAuth(path: string): boolean {
    if (!this.config.skipPaths) {
      return false;
    }

    return this.config.skipPaths.some(skipPath => {
      if (skipPath.includes('*')) {
        const regex = new RegExp(skipPath.replace(/\*/g, '.*'));
        return regex.test(path);
      }
      return path === skipPath || path.startsWith(skipPath);
    });
  }

  private isOptionalAuth(path: string): boolean {
    if (!this.config.optionalPaths) {
      return false;
    }

    return this.config.optionalPaths.some(optionalPath => {
      if (optionalPath.includes('*')) {
        const regex = new RegExp(optionalPath.replace(/\*/g, '.*'));
        return regex.test(path);
      }
      return path === optionalPath || path.startsWith(optionalPath);
    });
  }

  private getClientIdentifier(request: FastifyRequest): string {
    const user = (request as AuthenticatedRequest).user;

    if (user) {
      return `user:${user.id}`;
    }

    // Fall back to IP address for unauthenticated requests
    return `ip:${request.ip}`;
  }

  private extractResourceId(
    request: FastifyRequest,
    resource: string
  ): string | null {
    // Try to extract resource ID from URL parameters
    const params = request.params as any;

    // Common parameter names for resource IDs
    const possibleKeys = [`${resource}Id`, `${resource}_id`, 'id', resource];

    for (const key of possibleKeys) {
      if (params[key]) {
        return params[key];
      }
    }

    // Try to extract from request body
    const body = request.body as any;
    if (body) {
      for (const key of possibleKeys) {
        if (body[key]) {
          return body[key];
        }
      }
    }

    return null;
  }

  private async isResourceOwner(
    userId: string,
    resource: string,
    resourceId: string
  ): Promise<boolean> {
    // This would typically query the database to check ownership
    // For now, return false as a placeholder
    // In a real implementation, this would check the database:
    // - For tasks: check if user is the creator or assignee
    // - For projects: check if user is the manager or member
    // - For workspaces: check if user is the owner

    console.log(
      `Checking ownership: user ${userId} for ${resource} ${resourceId}`
    );
    return false;
  }
}
