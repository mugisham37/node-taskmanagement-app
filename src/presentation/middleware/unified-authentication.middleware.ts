import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  UnauthorizedError,
  ForbiddenError,
} from '../../shared/errors/app-errors';
import { ILogger } from '../../shared/interfaces/logger.interface';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  currentWorkspaceId?: string;
  permissions: string[];
  sessionId: string;
  deviceId?: string;
  lastActivityAt: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  workspaceId?: string;
  sessionId: string;
  deviceId?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthenticationOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  workspaceRequired?: boolean;
  refreshTokenRotation?: boolean;
}

export class UnifiedAuthenticationMiddleware {
  constructor(
    private readonly logger: ILogger,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string
  ) {}

  /**
   * Main authentication middleware
   */
  authenticate(options: AuthenticationOptions = { required: true }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          if (options.required) {
            throw new UnauthorizedError('Authentication token required');
          }
          return next();
        }

        const user = await this.validateToken(token);

        // Attach user to request
        (req as any).user = user;
        (req as any).correlationId = this.generateCorrelationId();

        // Update last activity
        await this.updateLastActivity(user.sessionId);

        // Role-based authorization
        if (options.roles && !options.roles.includes(user.role)) {
          throw new ForbiddenError(
            `Access denied. Required roles: ${options.roles.join(', ')}`
          );
        }

        // Permission-based authorization
        if (options.permissions) {
          const hasPermission = options.permissions.some(permission =>
            user.permissions.includes(permission)
          );

          if (!hasPermission) {
            throw new ForbiddenError(
              `Access denied. Required permissions: ${options.permissions.join(', ')}`
            );
          }
        }

        // Workspace context validation
        if (options.workspaceRequired && !user.currentWorkspaceId) {
          throw new ForbiddenError('Workspace context required');
        }

        this.logger.debug('User authenticated successfully', {
          userId: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.currentWorkspaceId,
          sessionId: user.sessionId,
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  optionalAuthenticate() {
    return this.authenticate({ required: false });
  }

  /**
   * Role-based authorization middleware
   */
  requireRoles(roles: string[]) {
    return this.authenticate({ roles });
  }

  /**
   * Permission-based authorization middleware
   */
  requirePermissions(permissions: string[]) {
    return this.authenticate({ permissions });
  }

  /**
   * Workspace context required middleware
   */
  requireWorkspace() {
    return this.authenticate({ workspaceRequired: true });
  }

  /**
   * Admin only middleware
   */
  requireAdmin() {
    return this.authenticate({ roles: ['ADMIN'] });
  }

  /**
   * Manager or above middleware
   */
  requireManager() {
    return this.authenticate({ roles: ['ADMIN', 'MANAGER'] });
  }

  /**
   * Resource ownership validation middleware
   */
  requireResourceOwnership(
    resourceIdParam: string = 'id',
    resourceType: string
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        if (!user) {
          throw new UnauthorizedError('Authentication required');
        }

        const resourceId = req.params[resourceIdParam];
        if (!resourceId) {
          throw new ForbiddenError('Resource ID required');
        }

        // TODO: Implement resource ownership check
        // This would typically query the database to verify ownership
        const isOwner = await this.checkResourceOwnership(
          user.id,
          resourceId,
          resourceType
        );

        if (!isOwner && !['ADMIN', 'MANAGER'].includes(user.role)) {
          throw new ForbiddenError(
            'Access denied. You do not own this resource'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Workspace member validation middleware
   */
  requireWorkspaceMember(workspaceIdParam: string = 'workspaceId') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        if (!user) {
          throw new UnauthorizedError('Authentication required');
        }

        const workspaceId =
          req.params[workspaceIdParam] || user.currentWorkspaceId;
        if (!workspaceId) {
          throw new ForbiddenError('Workspace ID required');
        }

        // TODO: Implement workspace membership check
        const isMember = await this.checkWorkspaceMembership(
          user.id,
          workspaceId
        );

        if (!isMember) {
          throw new ForbiddenError(
            'Access denied. You are not a member of this workspace'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Rate limiting by user
   */
  rateLimitByUser(maxRequests: number, windowMs: number) {
    const userRequests = new Map<
      string,
      { count: number; resetTime: number }
    >();

    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) {
        return next();
      }

      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [userId, data] of userRequests.entries()) {
        if (data.resetTime < windowStart) {
          userRequests.delete(userId);
        }
      }

      const current = userRequests.get(user.id) || {
        count: 0,
        resetTime: now + windowMs,
      };

      if (current.count >= maxRequests && current.resetTime > now) {
        return res.status(429).json({
          success: false,
          error: {
            message: 'Too many requests from this user',
            code: 'USER_RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((current.resetTime - now) / 1000),
          },
          timestamp: new Date().toISOString(),
        });
      }

      current.count++;
      userRequests.set(user.id, current);

      next();
    };
  }

  /**
   * Session validation middleware
   */
  validateSession() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        if (!user) {
          return next();
        }

        // TODO: Implement session validation
        const isValidSession = await this.validateUserSession(
          user.sessionId,
          user.id
        );

        if (!isValidSession) {
          throw new UnauthorizedError('Invalid or expired session');
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Device tracking middleware
   */
  trackDevice() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        if (!user) {
          return next();
        }

        const deviceInfo = {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          deviceId: user.deviceId,
        };

        // TODO: Implement device tracking
        await this.trackUserDevice(user.id, deviceInfo);

        next();
      } catch (error) {
        // Don't fail the request if device tracking fails
        this.logger.warn('Device tracking failed', { error: error.message });
        next();
      }
    };
  }

  /**
   * Extract JWT token from request
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie
    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    // Check query parameter (for WebSocket connections)
    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  /**
   * Validate JWT token and return user data
   */
  private async validateToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      // TODO: Implement user data retrieval and permission loading
      const user: AuthenticatedUser = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        currentWorkspaceId: payload.workspaceId,
        permissions: await this.loadUserPermissions(
          payload.userId,
          payload.workspaceId
        ),
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        lastActivityAt: new Date(),
      };

      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      } else {
        throw new UnauthorizedError('Token validation failed');
      }
    }
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Update user's last activity timestamp
   */
  private async updateLastActivity(sessionId: string): Promise<void> {
    // TODO: Implement session activity update
    // This would typically update the session record in the database
  }

  /**
   * Load user permissions based on user ID and workspace
   */
  private async loadUserPermissions(
    userId: string,
    workspaceId?: string
  ): Promise<string[]> {
    // TODO: Implement permission loading from database
    // This would typically query user roles and permissions
    return [];
  }

  /**
   * Check if user owns a specific resource
   */
  private async checkResourceOwnership(
    userId: string,
    resourceId: string,
    resourceType: string
  ): Promise<boolean> {
    // TODO: Implement resource ownership check
    // This would typically query the database to verify ownership
    return false;
  }

  /**
   * Check if user is a member of a workspace
   */
  private async checkWorkspaceMembership(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    // TODO: Implement workspace membership check
    // This would typically query the workspace members table
    return false;
  }

  /**
   * Validate user session
   */
  private async validateUserSession(
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    // TODO: Implement session validation
    // This would typically check if the session exists and is active
    return true;
  }

  /**
   * Track user device information
   */
  private async trackUserDevice(
    userId: string,
    deviceInfo: any
  ): Promise<void> {
    // TODO: Implement device tracking
    // This would typically store device information in the database
  }
}

/**
 * JWT token management utilities
 */
export class JWTTokenManager {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessTokenExpiry: string = '15m',
    private readonly refreshTokenExpiry: string = '7d'
  ) {}

  /**
   * Generate access and refresh token pair
   */
  generateTokenPair(user: AuthenticatedUser): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      workspaceId: user.currentWorkspaceId,
      sessionId: user.sessionId,
      deviceId: user.deviceId,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'task-management-api',
      audience: 'task-management-client',
    });

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId: user.sessionId },
      this.jwtRefreshSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'task-management-api',
        audience: 'task-management-client',
      }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;

      // TODO: Validate refresh token in database and get user data
      const user = await this.getUserByIdAndSession(
        payload.userId,
        payload.sessionId
      );

      if (!user) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new token pair with rotation
      return this.generateTokenPair(user);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;

      // TODO: Implement token revocation in database
      await this.revokeUserSession(payload.sessionId);
    } catch (error) {
      // Token might already be invalid, which is fine for revocation
    }
  }

  private async getUserByIdAndSession(
    userId: string,
    sessionId: string
  ): Promise<AuthenticatedUser | null> {
    // TODO: Implement user retrieval by ID and session
    return null;
  }

  private async revokeUserSession(sessionId: string): Promise<void> {
    // TODO: Implement session revocation
  }
}
