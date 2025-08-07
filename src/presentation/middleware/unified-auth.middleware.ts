import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationService } from '../domain/authentication/services/AuthenticationService';
import { AuthorizationService } from '../domain/authentication/services/AuthorizationService';
import { SessionManagementService } from '../domain/authentication/services/SessionManagementService';
import { RiskAssessmentService } from '../domain/authentication/services/RiskAssessmentService';
import { UserId } from '../domain/authentication/value-objects/UserId';
import { WorkspaceId } from '../domain/task-management/value-objects/WorkspaceId';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  workspaceId?: string;
  permissions: string[];
  riskScore: number;
  sessionId: string;
  deviceId?: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  role: string;
  permissions: string[];
}

export interface AuthenticationContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  requestPath: string;
  requestMethod: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    workspaceContext?: WorkspaceContext;
    authContext?: AuthenticationContext;
  }
}

/**
 * Unified Authentication Middleware for Fastify with workspace context
 * Integrates with the enhanced authentication services
 */
export class UnifiedAuthMiddleware {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly authorizationService: AuthorizationService,
    private readonly sessionService: SessionManagementService,
    private readonly riskAssessmentService: RiskAssessmentService
  ) {}

  /**
   * Main authentication middleware
   */
  authenticate(
    options: {
      optional?: boolean;
      requireWorkspace?: boolean;
      allowedRoles?: string[];
    } = {}
  ) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Extract authentication context
        const authContext = this.extractAuthContext(request);
        request.authContext = authContext;

        // Get session token
        const sessionToken = this.extractSessionToken(request);

        if (!sessionToken) {
          if (options.optional) {
            return;
          }
          throw new Error('Authentication token is required');
        }

        // Validate session
        const session = await this.sessionService.getSession(sessionToken);
        if (!session) {
          throw new Error('Invalid or expired session');
        }

        // Get user
        const user = await this.getUserFromSession(session);
        if (!user) {
          throw new Error('User not found');
        }

        // Calculate current risk score
        const riskScore = await this.riskAssessmentService.calculateCurrentRisk(
          user.id,
          authContext
        );

        // Check if additional verification is needed
        if (riskScore > 0.8) {
          reply.code(403).send({
            error: 'Additional verification required',
            requiresMfa: true,
            riskScore,
          });
          return;
        }

        // Get workspace context if session has workspace
        let workspaceContext: WorkspaceContext | undefined;
        if (session.workspaceId) {
          workspaceContext = await this.getWorkspaceContext(
            user.id,
            session.workspaceId
          );

          if (options.requireWorkspace && !workspaceContext) {
            throw new Error('Workspace context required');
          }
        } else if (options.requireWorkspace) {
          throw new Error('Workspace context required');
        }

        // Get user permissions
        const permissions = await this.getUserPermissions(
          user.id,
          session.workspaceId
        );

        // Check role restrictions
        if (options.allowedRoles && !options.allowedRoles.includes(user.role)) {
          throw new Error('Insufficient role permissions');
        }

        // Attach user and context to request
        request.user = {
          id: user.id.value,
          email: user.email.value,
          name: user.name,
          role: user.role || 'member',
          workspaceId: session.workspaceId?.value,
          permissions,
          riskScore,
          sessionId: session.id.value,
          deviceId: session.deviceId?.value,
        };

        if (workspaceContext) {
          request.workspaceContext = workspaceContext;
        }

        // Monitor session activity
        await this.sessionService.monitorSessionActivity(session.id, {
          type: 'api_request',
          ipAddress: authContext.ipAddress,
          userAgent: authContext.userAgent,
          metadata: {
            path: authContext.requestPath,
            method: authContext.requestMethod,
          },
        });

        // Update user risk score if changed significantly
        if (Math.abs(riskScore - user.riskScore) > 0.1) {
          user.updateRiskScore(riskScore);
          // TODO: Save user
        }
      } catch (error) {
        if (options.optional) {
          return;
        }

        reply.code(401).send({
          error: 'Authentication failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };
  }

  /**
   * Authorization middleware for specific permissions
   */
  authorize(permissions: string | string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
      }

      const requiredPermissions = Array.isArray(permissions)
        ? permissions
        : [permissions];
      const userId = UserId.create(request.user.id);

      // Check permissions
      const permissionChecks = await Promise.all(
        requiredPermissions.map(async permission => {
          if (request.workspaceContext) {
            const workspaceId = WorkspaceId.create(
              request.workspaceContext.workspaceId
            );
            return this.authorizationService.checkWorkspacePermission(
              userId,
              workspaceId,
              permission
            );
          }

          // For non-workspace permissions, check user's global permissions
          return request.user!.permissions.includes(permission);
        })
      );

      const hasAllPermissions = permissionChecks.every(Boolean);

      if (!hasAllPermissions) {
        reply.code(403).send({
          error: 'Insufficient permissions',
          required: requiredPermissions,
          granted: request.user.permissions,
        });
        return;
      }
    };
  }

  /**
   * Workspace context middleware
   */
  requireWorkspace() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
      }

      if (!request.workspaceContext) {
        reply.code(400).send({
          error: 'Workspace context required',
          message:
            'This endpoint requires a workspace context. Please switch to a workspace first.',
        });
        return;
      }
    };
  }

  /**
   * Resource ownership middleware
   */
  requireOwnership(resourceUserIdParam: string = 'userId') {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
      }

      const resourceUserId =
        (request.params as any)[resourceUserIdParam] ||
        (request.body as any)?.[resourceUserIdParam];

      if (!resourceUserId) {
        reply.code(400).send({ error: 'Resource user ID not provided' });
        return;
      }

      // Allow if user is admin or owns the resource
      const isAdmin = request.user.permissions.includes('system:admin');
      const isOwner = request.user.id === resourceUserId;

      if (!isAdmin && !isOwner) {
        reply.code(403).send({
          error: 'Access denied',
          message: 'You can only access your own resources',
        });
        return;
      }
    };
  }

  /**
   * Rate limiting based on user risk score
   */
  adaptiveRateLimit() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return; // Skip rate limiting for unauthenticated requests
      }

      const riskScore = request.user.riskScore;
      let rateLimit = 1000; // Default requests per hour

      // Adjust rate limit based on risk score
      if (riskScore > 0.8) {
        rateLimit = 100; // High risk: 100 requests per hour
      } else if (riskScore > 0.5) {
        rateLimit = 300; // Medium risk: 300 requests per hour
      } else if (riskScore > 0.2) {
        rateLimit = 600; // Low-medium risk: 600 requests per hour
      }

      // TODO: Implement actual rate limiting logic with Redis or similar
      // For now, just add the limit to the response headers
      reply.header('X-RateLimit-Limit', rateLimit.toString());
      reply.header('X-RateLimit-Risk-Score', riskScore.toString());
    };
  }

  /**
   * Session refresh middleware
   */
  refreshSessionIfNeeded() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return;
      }

      try {
        const sessionToken = this.extractSessionToken(request);
        if (!sessionToken) {
          return;
        }

        const session = await this.sessionService.getSession(sessionToken);
        if (!session) {
          return;
        }

        // Check if session should be refreshed (less than 1 hour remaining)
        if (session.shouldRefresh(60 * 60 * 1000)) {
          await this.sessionService.extendSession(session.id);

          // Add header to indicate session was refreshed
          reply.header('X-Session-Refreshed', 'true');
        }
      } catch (error) {
        // Don't fail the request if session refresh fails
        console.error('Session refresh failed:', error);
      }
    };
  }

  // Private helper methods

  private extractAuthContext(request: FastifyRequest): AuthenticationContext {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      deviceFingerprint: request.headers['x-device-fingerprint'] as string,
      requestPath: request.url,
      requestMethod: request.method,
    };
  }

  private extractSessionToken(request: FastifyRequest): string | null {
    // Try Authorization header first
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    const cookieToken = request.cookies?.sessionToken;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  private async getUserFromSession(session: any): Promise<any> {
    // TODO: Implement user retrieval from session
    return null;
  }

  private async getWorkspaceContext(
    userId: any,
    workspaceId: any
  ): Promise<WorkspaceContext | undefined> {
    // TODO: Implement workspace context retrieval
    return undefined;
  }

  private async getUserPermissions(
    userId: any,
    workspaceId?: any
  ): Promise<string[]> {
    // TODO: Implement permission retrieval
    return [];
  }
}

/**
 * Factory function to create middleware instance
 */
export function createAuthMiddleware(
  authenticationService: AuthenticationService,
  authorizationService: AuthorizationService,
  sessionService: SessionManagementService,
  riskAssessmentService: RiskAssessmentService
): UnifiedAuthMiddleware {
  return new UnifiedAuthMiddleware(
    authenticationService,
    authorizationService,
    sessionService,
    riskAssessmentService
  );
}

/**
 * Convenience middleware functions
 */
export const authMiddleware = {
  // Basic authentication
  authenticate: (middleware: UnifiedAuthMiddleware) =>
    middleware.authenticate(),

  // Optional authentication
  optionalAuth: (middleware: UnifiedAuthMiddleware) =>
    middleware.authenticate({ optional: true }),

  // Require workspace context
  requireWorkspace: (middleware: UnifiedAuthMiddleware) => [
    middleware.authenticate({ requireWorkspace: true }),
    middleware.requireWorkspace(),
  ],

  // Admin only
  requireAdmin: (middleware: UnifiedAuthMiddleware) => [
    middleware.authenticate({ allowedRoles: ['admin'] }),
    middleware.authorize(['system:admin']),
  ],

  // Workspace admin
  requireWorkspaceAdmin: (middleware: UnifiedAuthMiddleware) => [
    middleware.authenticate({ requireWorkspace: true }),
    middleware.authorize([
      'workspace:manage_members',
      'workspace:manage_settings',
    ]),
  ],

  // Project permissions
  requireProjectAccess: (
    middleware: UnifiedAuthMiddleware,
    permission: string
  ) => [
    middleware.authenticate({ requireWorkspace: true }),
    middleware.authorize([permission]),
  ],

  // Task permissions
  requireTaskAccess: (
    middleware: UnifiedAuthMiddleware,
    permission: string
  ) => [
    middleware.authenticate({ requireWorkspace: true }),
    middleware.authorize([permission]),
  ],
};
