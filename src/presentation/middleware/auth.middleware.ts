import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { userRepository } from '../db/repositories';
import logger from '../utils/logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
  profilePicture?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Fastify authentication middleware
 */
export async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies?.token;

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { message: 'Authentication token is required' },
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: string; role: string; exp: number };

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return reply.status(401).send({
        success: false,
        error: { message: 'Token has expired' },
      });
    }

    // Fetch user from database
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { message: 'User not found' },
      });
    }

    // Attach user to request
    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      profilePicture: user.profilePicture,
    };

    logger.debug('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return reply.status(401).send({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await authenticateToken(request, reply);
  } catch (error) {
    // Continue without authentication for optional auth
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(roles: string | string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Insufficient permissions' },
      });
    }
  };
}

/**
 * Admin-only access middleware
 */
export const requireAdmin = requireRole('admin');
