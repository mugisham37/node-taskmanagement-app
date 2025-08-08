import { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { logger } from '@/infrastructure/logging/logger';
import { WebSocketUser } from './websocket-connection';
import { config } from '@/infrastructure/config/environment';

export interface AuthenticationResult {
  success: boolean;
  user?: WebSocketUser;
  error?: string;
}

export class WebSocketAuthenticator {
  /**
   * Authenticate WebSocket connection
   */
  async authenticate(request: FastifyRequest): Promise<AuthenticationResult> {
    try {
      // Extract token from query parameters or headers
      const token = this.extractToken(request);
      if (!token) {
        return {
          success: false,
          error: 'No authentication token provided',
        };
      }

      // Verify JWT token
      const decoded = await this.verifyToken(token);
      if (!decoded) {
        return {
          success: false,
          error: 'Invalid or expired token',
        };
      }

      // Create WebSocket user from token payload
      const user = this.createWebSocketUser(decoded);

      // Additional validation
      const validationResult = await this.validateUser(user);
      if (!validationResult.success) {
        return validationResult;
      }

      logger.debug('WebSocket authentication successful', {
        userId: user.id,
        workspaceId: user.workspaceId,
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('WebSocket authentication error', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Extract token from request
   */
  private extractToken(request: FastifyRequest): string | null {
    // Try query parameter first
    const queryToken = (request.query as any)?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Try Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    const cookieToken = request.cookies?.auth_token;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret, {
        algorithms: ['RS256', 'HS256'],
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience,
      });

      return decoded;
    } catch (error) {
      logger.debug('Token verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create WebSocket user from token payload
   */
  private createWebSocketUser(tokenPayload: any): WebSocketUser {
    return {
      id: tokenPayload.sub || tokenPayload.userId,
      email: tokenPayload.email,
      workspaceId: tokenPayload.workspaceId,
      roles: tokenPayload.roles || [],
      permissions: tokenPayload.permissions || [],
    };
  }

  /**
   * Validate user and check if they can establish WebSocket connection
   */
  private async validateUser(
    user: WebSocketUser
  ): Promise<AuthenticationResult> {
    // Check if user ID is valid
    if (!user.id) {
      return {
        success: false,
        error: 'Invalid user ID',
      };
    }

    // Check if user has required permissions for WebSocket access
    if (!this.hasWebSocketPermission(user)) {
      return {
        success: false,
        error: 'Insufficient permissions for WebSocket access',
      };
    }

    // Additional workspace validation if workspace context is provided
    if (user.workspaceId && !(await this.validateWorkspaceAccess(user))) {
      return {
        success: false,
        error: 'Invalid workspace access',
      };
    }

    return {
      success: true,
    };
  }

  /**
   * Check if user has WebSocket permission
   */
  private hasWebSocketPermission(user: WebSocketUser): boolean {
    // Check for specific WebSocket permission
    if (user.permissions.includes('websocket:connect')) {
      return true;
    }

    // Check for general API access permission
    if (user.permissions.includes('api:access')) {
      return true;
    }

    // Check for admin role
    if (
      user.roles.includes('admin') ||
      user.roles.includes('workspace_admin')
    ) {
      return true;
    }

    // Default to allowing connection for authenticated users
    // This can be made more restrictive based on requirements
    return true;
  }

  /**
   * Validate workspace access
   */
  private async validateWorkspaceAccess(user: WebSocketUser): Promise<boolean> {
    try {
      // This would typically check against the database
      // For now, we'll do basic validation

      if (!user.workspaceId) {
        return false;
      }

      // Check if user has workspace-related permissions
      const hasWorkspacePermission = user.permissions.some(
        permission =>
          permission.startsWith(`workspace:${user.workspaceId}:`) ||
          permission === 'workspace:access' ||
          permission === 'workspace:*'
      );

      if (hasWorkspacePermission) {
        return true;
      }

      // Check if user has workspace role
      const hasWorkspaceRole = user.roles.some(
        role => role.includes('workspace_') || role === 'member'
      );

      return hasWorkspaceRole;
    } catch (error) {
      logger.error('Workspace validation error', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        workspaceId: user.workspaceId,
      });
      return false;
    }
  }

  /**
   * Refresh user permissions (for long-lived connections)
   */
  async refreshUserPermissions(
    user: WebSocketUser
  ): Promise<WebSocketUser | null> {
    try {
      // This would typically fetch fresh permissions from the database
      // For now, return the existing user

      logger.debug('Refreshing user permissions', {
        userId: user.id,
        workspaceId: user.workspaceId,
      });

      // In a real implementation, you would:
      // 1. Query the database for current user permissions
      // 2. Query workspace memberships
      // 3. Update the user object with fresh data

      return user;
    } catch (error) {
      logger.error('Error refreshing user permissions', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
      });
      return null;
    }
  }

  /**
   * Validate specific action permission
   */
  async validateActionPermission(
    user: WebSocketUser,
    action: string,
    resource?: string
  ): Promise<boolean> {
    try {
      // Check for specific permission
      const specificPermission = resource ? `${resource}:${action}` : action;

      if (user.permissions.includes(specificPermission)) {
        return true;
      }

      // Check for wildcard permissions
      const wildcardPermission = resource ? `${resource}:*` : `${action}:*`;

      if (user.permissions.includes(wildcardPermission)) {
        return true;
      }

      // Check for admin permissions
      if (user.roles.includes('admin')) {
        return true;
      }

      // Check for workspace admin permissions (if workspace context)
      if (user.workspaceId && user.roles.includes('workspace_admin')) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error validating action permission', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        action,
        resource,
      });
      return false;
    }
  }
}
