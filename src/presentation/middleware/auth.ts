import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticationError, ForbiddenError } from "../utils/app-error";
import config from "../config/environment";
import { db } from "../db/connection";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import logger from "../config/logger";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    isEmailVerified: boolean;
    lastLoginAt?: Date;
  };
  apiVersion?: string;
  language?: string;
  t?: (key: string, options?: any) => string;
}

// Legacy interface for backward compatibility
export interface AuthenticatedRequest extends AuthRequest {}

/**
 * Enhanced authentication middleware
 */
export const authenticate = (options: { optional?: boolean } = {}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.token;
      
      // Get token from header or cookie
      let token: string | undefined;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (!token) {
        if (options.optional) {
          return next();
        }
        throw new AuthenticationError("Authentication token is required");
      }

      try {
        // Verify JWT token
        const decoded = jwt.verify(token, config.jwtSecret) as { 
          userId: string; 
          role: string;
          iat: number;
          exp: number;
        };

        // Check if token is expired (additional check)
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp < now) {
          throw new AuthenticationError("Token has expired");
        }

        // Fetch user from database
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            isEmailVerified: users.isEmailVerified,
            lastLoginAt: users.lastLoginAt,
            deletedAt: users.deletedAt,
          })
          .from(users)
          .where(eq(users.id, decoded.userId))
          .limit(1);

        if (!user) {
          throw new AuthenticationError("User not found");
        }

        // Check if user account is active (not soft deleted)
        if (user.deletedAt) {
          throw new AuthenticationError("User account is deactivated");
        }

        // Attach user to request
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt || undefined,
        };

        // Log successful authentication
        logger.debug('User authenticated successfully', {
          userId: user.id,
          email: user.email,
          role: user.role,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        next();
      } catch (jwtError) {
        if (jwtError instanceof jwt.JsonWebTokenError) {
          throw new AuthenticationError("Invalid token");
        } else if (jwtError instanceof jwt.TokenExpiredError) {
          throw new AuthenticationError("Token has expired");
        } else {
          throw jwtError;
        }
      }
    } catch (error) {
      // Log authentication failure
      logger.warn('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });

      next(error);
    }
  };
};

/**
 * Authorization middleware for role-based access control
 */
export const authorize = (roles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if user exists in request
    if (!req.user) {
      return next(new ForbiddenError("User not authenticated"));
    }

    // Convert roles to array if string
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed - insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
      });

      return next(new ForbiddenError("You don't have permission to access this resource"));
    }

    // Log successful authorization
    logger.debug('User authorized successfully', {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: allowedRoles,
      path: req.path,
    });

    next();
  };
};

/**
 * Optional authentication middleware
 */
export const optionalAuth = authenticate({ optional: true });

/**
 * Middleware to require email verification
 */
export const requireEmailVerification = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AuthenticationError("User not authenticated"));
  }

  if (!req.user.isEmailVerified) {
    return next(new ForbiddenError("Email verification required"));
  }

  next();
};

/**
 * Middleware to check if user owns the resource
 */
export const requireOwnership = (userIdParam: string = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError("User not authenticated"));
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
    
    if (!resourceUserId) {
      return next(new ForbiddenError("Resource user ID not provided"));
    }

    // Allow if user is admin or owns the resource
    if (req.user.role === 'admin' || req.user.id === resourceUserId) {
      return next();
    }

    logger.warn('Ownership check failed', {
      userId: req.user.id,
      resourceUserId,
      path: req.path,
      method: req.method,
    });

    return next(new ForbiddenError("You can only access your own resources"));
  };
};

/**
 * Middleware for admin-only access
 */
export const requireAdmin = authorize('admin');

/**
 * Middleware for user or admin access
 */
export const requireUserOrAdmin = authorize(['user', 'admin']);

/**
 * Middleware to check multiple permissions
 */
export const requirePermissions = (permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError("User not authenticated"));
    }

    // For now, we'll use role-based permissions
    // In the future, this could be extended to use a more granular permission system
    const userPermissions = getUserPermissions(req.user.role);
    
    const hasAllPermissions = permissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn('Permission check failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermissions: permissions,
        userPermissions,
        path: req.path,
      });

      return next(new ForbiddenError("Insufficient permissions"));
    }

    next();
  };
};

/**
 * Get user permissions based on role
 */
const getUserPermissions = (role: string): string[] => {
  const permissions: Record<string, string[]> = {
    admin: [
      'user:read', 'user:write', 'user:delete',
      'project:read', 'project:write', 'project:delete',
      'task:read', 'task:write', 'task:delete',
      'team:read', 'team:write', 'team:delete',
      'workspace:read', 'workspace:write', 'workspace:delete',
      'system:read', 'system:write',
      'audit:read',
    ],
    user: [
      'user:read', 'user:write',
      'project:read', 'project:write',
      'task:read', 'task:write',
      'team:read', 'team:write',
      'workspace:read', 'workspace:write',
    ],
  };

  return permissions[role] || [];
};

/**
 * Middleware to refresh token if it's about to expire
 */
export const refreshTokenIfNeeded = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.exp) {
      return next();
    }

    // Check if token expires in the next 15 minutes
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    const fifteenMinutes = 15 * 60;

    if (timeUntilExpiry < fifteenMinutes && timeUntilExpiry > 0) {
      // Generate new token
      const newToken = jwt.sign(
        { 
          userId: req.user.id, 
          role: req.user.role 
        },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      // Set new token in response header
      res.setHeader('X-New-Token', newToken);
      
      logger.info('Token refreshed', {
        userId: req.user.id,
        oldExpiry: new Date(decoded.exp * 1000),
        newExpiry: new Date((decoded.exp + (24 * 60 * 60)) * 1000), // Assuming 24h expiry
      });
    }

    next();
  } catch (error) {
    // If refresh fails, continue without refreshing
    logger.warn('Token refresh failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
};

/**
 * Middleware to track user activity
 */
export const trackUserActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  try {
    // Update last activity timestamp
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id));

    logger.debug('User activity tracked', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });
  } catch (error) {
    // Don't fail the request if activity tracking fails
    logger.warn('Failed to track user activity', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  next();
};

// Legacy exports for backward compatibility
export { authenticate as auth };
