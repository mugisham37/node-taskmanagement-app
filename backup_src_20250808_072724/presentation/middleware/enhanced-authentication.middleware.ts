import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../../domain/authentication/services/AuthenticationService';
import { TokenManagementService } from '../../domain/authentication/services/TokenManagementService';
import { SessionManagementService } from '../../domain/authentication/services/SessionManagementService';
import { RoleBasedAccessControlService } from '../../domain/authentication/services/RoleBasedAccessControlService';
import { AuditLoggingService } from '../../domain/authentication/services/AuditLoggingService';
import { MfaEnhancedService } from '../../domain/authentication/services/MfaEnhancedService';
import { RiskAssessmentService } from '../../domain/authentication/services/RiskAssessmentService';
import { UserId } from '../../domain/authentication/value-objects/UserId';
import { WorkspaceId } from '../../domain/task-management/value-objects/WorkspaceId';

export interface EnhancedAuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
    workspaceId?: string;
    permissions: string[];
    riskScore: number;
    sessionId: string;
    deviceId?: string;
    mfaEnabled: boolean;
    emailVerified: boolean;
  };
  workspaceContext?: {
    workspaceId: string;
    workspaceName: string;
    role: string;
    permissions: string[];
  };
  authContext?: {
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    requestPath: string;
    requestMethod: string;
    correlationId: string;
  };
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
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

/**
 * Enhanced Authentication Middleware
 * Integrates all authentication services for comprehensive security
 */
export class EnhancedAuthenticationMiddleware {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly tokenService: TokenManagementService,
    private readonly sessionService: SessionManagementService,
    private readonly rbacService: RoleBasedAccessControlService,
    private readonly auditService: AuditLoggingService,
    private readonly mfaService: MfaEnhancedService,
    private readonly riskService: RiskAssessmentService
  ) {}

  /**
   * Main authentication middleware
   */
  authenticate(options: AuthenticationOptions = {}) {
    return async (
      req: EnhancedAuthRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        // Extract authentication context
        const authContext = this.extractAuthContext(req);
        req.authContext = authContext;

        // Get authentication token
        const token = this.extractToken(req);

        if (!token) {
          if (options.optional) {
            return next();
          }

          await this.auditService.logAuthenticationEvent(
            'login_failed',
            undefined,
            {
              reason: 'No token provided',
              ipAddress: authContext.ipAddress,
              userAgent: authContext.userAgent,
            }
          );

          return res.status(401).json({
            success: false,
            error: 'Authentication token is required',
            code: 'AUTH_TOKEN_REQUIRED',
          });
        }

        // Validate token
        const tokenValidation =
          await this.tokenService.validateAccessToken(token);

        if (!tokenValidation.valid) {
          await this.auditService.logAuthenticationEvent(
            'login_failed',
            undefined,
            {
              reason: tokenValidation.error || 'Invalid token',
              ipAddress: authContext.ipAddress,
              userAgent: authContext.userAgent,
            }
          );

          const statusCode = tokenValidation.requiresRefresh ? 401 : 403;
          return res.status(statusCode).json({
            success: false,
            error: tokenValidation.error || 'Invalid token',
            code: tokenValidation.requiresRefresh
              ? 'TOKEN_EXPIRED'
              : 'INVALID_TOKEN',
            requiresRefresh: tokenValidation.requiresRefresh,
          });
        }

        const payload = tokenValidation.payload!;

        // Get session
        const session = await this.sessionService.getSession(payload.sessionId);
        if (!session) {
          await this.auditService.logAuthenticationEvent(
            'login_failed',
            UserId.create(payload.userId),
            {
              reason: 'Session not found',
              ipAddress: authContext.ipAddress,
              userAgent: authContext.userAgent,
            }
          );

          return res.status(401).json({
            success: false,
            error: 'Session expired or invalid',
            code: 'SESSION_INVALID',
          });
        }

        // Get user
        const user = await this.getUserById(UserId.create(payload.userId));
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        // Check user status
        if (user.isDeleted || user.isLocked) {
          await this.auditService.logAuthenticationEvent(
            'login_failed',
            user.id,
            {
              reason: user.isDeleted ? 'User deleted' : 'User locked',
              ipAddress: authContext.ipAddress,
              userAgent: authContext.userAgent,
            }
          );

          return res.status(403).json({
            success: false,
            error: 'Account is not accessible',
            code: user.isDeleted ? 'ACCOUNT_DELETED' : 'ACCOUNT_LOCKED',
          });
        }

        // Check email verification requirement
        if (options.requireEmailVerification && !user.emailVerified) {
          return res.status(403).json({
            success: false,
            error: 'Email verification required',
            code: 'EMAIL_NOT_VERIFIED',
          });
        }

        // Check MFA requirement
        if (options.requireMfa && !user.mfaEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Multi-factor authentication required',
            code: 'MFA_REQUIRED',
          });
        }

        // Calculate current risk score
        const currentRiskScore = await this.riskService.calculateCurrentRisk(
          user.id,
          authContext
        );

        // Check risk score threshold
        if (options.maxRiskScore && currentRiskScore > options.maxRiskScore) {
          await this.auditService.logSecurityEvent(
            'high_risk_access_blocked',
            user.id,
            'high',
            {
              riskScore: currentRiskScore,
              threshold: options.maxRiskScore,
              ...authContext,
            }
          );

          return res.status(403).json({
            success: false,
            error: 'Access denied due to security risk',
            code: 'HIGH_RISK_BLOCKED',
            requiresAdditionalVerification: true,
          });
        }

        // Check role restrictions
        if (
          options.allowedRoles &&
          !options.allowedRoles.includes(payload.role)
        ) {
          await this.auditService.logAuthorizationEvent(
            'permission_denied',
            user.id,
            {
              reason: 'Insufficient role',
              requiredRoles: options.allowedRoles,
              userRole: payload.role,
              ...authContext,
            }
          );

          return res.status(403).json({
            success: false,
            error: 'Insufficient role permissions',
            code: 'INSUFFICIENT_ROLE',
          });
        }

        // Get workspace context if required
        let workspaceContext;
        if (payload.workspaceId) {
          workspaceContext = await this.getWorkspaceContext(
            user.id,
            WorkspaceId.create(payload.workspaceId)
          );
        } else if (options.requireWorkspace) {
          return res.status(400).json({
            success: false,
            error: 'Workspace context required',
            code: 'WORKSPACE_REQUIRED',
          });
        }

        // Check permissions
        if (
          options.requiredPermissions &&
          options.requiredPermissions.length > 0
        ) {
          const accessContext = {
            userId: user.id,
            workspaceId: payload.workspaceId
              ? WorkspaceId.create(payload.workspaceId)
              : undefined,
            ...authContext,
          };

          const permissionChecks = options.requiredPermissions.map(
            permission => ({
              permission,
              workspaceId: accessContext.workspaceId,
            })
          );

          const permissionResults = await this.rbacService.checkPermissions(
            accessContext,
            permissionChecks
          );

          const deniedPermissions = options.requiredPermissions.filter(
            permission => !permissionResults[permission]
          );

          if (deniedPermissions.length > 0) {
            await this.auditService.logAuthorizationEvent(
              'permission_denied',
              user.id,
              {
                deniedPermissions,
                requiredPermissions: options.requiredPermissions,
                ...authContext,
              }
            );

            return res.status(403).json({
              success: false,
              error: 'Insufficient permissions',
              code: 'INSUFFICIENT_PERMISSIONS',
              deniedPermissions,
            });
          }
        }

        // Apply rate limiting
        const rateLimitInfo = await this.applyRateLimit(
          req,
          user.id,
          currentRiskScore,
          options.rateLimitKey
        );

        if (rateLimitInfo.remaining < 0) {
          await this.auditService.logSecurityEvent(
            'rate_limit_exceeded',
            user.id,
            'medium',
            {
              limit: rateLimitInfo.limit,
              resetTime: rateLimitInfo.resetTime,
              ...authContext,
            }
          );

          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(
              (rateLimitInfo.resetTime.getTime() - Date.now()) / 1000
            ),
          });
        }

        // Attach user and context to request
        req.user = {
          id: user.id.value,
          email: user.email.value,
          name: user.name,
          role: payload.role,
          workspaceId: payload.workspaceId,
          permissions: payload.permissions,
          riskScore: currentRiskScore,
          sessionId: payload.sessionId,
          deviceId: session.deviceId?.value,
          mfaEnabled: user.mfaEnabled,
          emailVerified: user.emailVerified,
        };

        if (workspaceContext) {
          req.workspaceContext = workspaceContext;
        }

        req.rateLimitInfo = rateLimitInfo;

        // Monitor session activity
        await this.sessionService.monitorSessionActivity(session.id, {
          type: 'api_request',
          ipAddress: authContext.ipAddress,
          userAgent: authContext.userAgent,
          metadata: {
            path: authContext.requestPath,
            method: authContext.requestMethod,
            permissions: options.requiredPermissions,
          },
        });

        // Refresh token if needed
        if (tokenValidation.requiresRefresh) {
          res.setHeader('X-Token-Refresh-Required', 'true');
        }

        // Add security headers
        this.addSecurityHeaders(res, currentRiskScore);

        next();
      } catch (error) {
        console.error('Authentication middleware error:', error);

        await this.auditService.logSystemEvent('authentication_error', {
          error: error.message,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(500).json({
          success: false,
          error: 'Authentication service error',
          code: 'AUTH_SERVICE_ERROR',
        });
      }
    };
  }

  /**
   * Permission check middleware
   */
  requirePermissions(permissions: string | string[]) {
    const requiredPermissions = Array.isArray(permissions)
      ? permissions
      : [permissions];

    return this.authenticate({
      requiredPermissions,
    });
  }

  /**
   * Role check middleware
   */
  requireRoles(roles: string | string[]) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return this.authenticate({
      allowedRoles,
    });
  }

  /**
   * Workspace context middleware
   */
  requireWorkspace() {
    return this.authenticate({
      requireWorkspace: true,
    });
  }

  /**
   * High security middleware
   */
  requireHighSecurity() {
    return this.authenticate({
      requireMfa: true,
      requireEmailVerification: true,
      maxRiskScore: 0.3,
    });
  }

  /**
   * Admin access middleware
   */
  requireAdmin() {
    return this.authenticate({
      allowedRoles: ['system_admin', 'workspace_admin'],
      requireMfa: true,
      maxRiskScore: 0.5,
    });
  }

  /**
   * Optional authentication middleware
   */
  optionalAuth() {
    return this.authenticate({
      optional: true,
    });
  }

  // Private helper methods

  private extractAuthContext(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceFingerprint: req.get('X-Device-Fingerprint'),
      requestPath: req.path,
      requestMethod: req.method,
      correlationId:
        req.get('X-Correlation-ID') || this.generateCorrelationId(),
    };
  }

  private extractToken(req: Request): string | null {
    // Try Authorization header first
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  private async getUserById(userId: UserId): Promise<any> {
    // TODO: Implement user repository call
    return null;
  }

  private async getWorkspaceContext(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<any> {
    // TODO: Implement workspace context retrieval
    return null;
  }

  private async applyRateLimit(
    req: Request,
    userId: UserId,
    riskScore: number,
    rateLimitKey?: string
  ): Promise<{
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    // Adaptive rate limiting based on risk score
    let baseLimit = 1000; // requests per hour

    if (riskScore > 0.8) {
      baseLimit = 100; // High risk
    } else if (riskScore > 0.5) {
      baseLimit = 300; // Medium risk
    } else if (riskScore > 0.2) {
      baseLimit = 600; // Low-medium risk
    }

    // TODO: Implement actual rate limiting with Redis
    return {
      limit: baseLimit,
      remaining: baseLimit - 1,
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    };
  }

  private addSecurityHeaders(res: Response, riskScore: number): void {
    // Add security headers based on risk score
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (riskScore > 0.5) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Add risk score header for debugging (remove in production)
    res.setHeader('X-Risk-Score', riskScore.toString());
  }

  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

/**
 * Factory function to create middleware instance
 */
export function createEnhancedAuthMiddleware(
  authenticationService: AuthenticationService,
  tokenService: TokenManagementService,
  sessionService: SessionManagementService,
  rbacService: RoleBasedAccessControlService,
  auditService: AuditLoggingService,
  mfaService: MfaEnhancedService,
  riskService: RiskAssessmentService
): EnhancedAuthenticationMiddleware {
  return new EnhancedAuthenticationMiddleware(
    authenticationService,
    tokenService,
    sessionService,
    rbacService,
    auditService,
    mfaService,
    riskService
  );
}

/**
 * Convenience middleware functions
 */
export const createAuthMiddleware = (
  middleware: EnhancedAuthenticationMiddleware
) => ({
  // Basic authentication
  authenticate: () => middleware.authenticate(),

  // Optional authentication
  optionalAuth: () => middleware.optionalAuth(),

  // Permission-based access
  requirePermissions: (permissions: string | string[]) =>
    middleware.requirePermissions(permissions),

  // Role-based access
  requireRoles: (roles: string | string[]) => middleware.requireRoles(roles),

  // Workspace context
  requireWorkspace: () => middleware.requireWorkspace(),

  // High security operations
  requireHighSecurity: () => middleware.requireHighSecurity(),

  // Admin access
  requireAdmin: () => middleware.requireAdmin(),

  // Custom authentication options
  custom: (options: AuthenticationOptions) => middleware.authenticate(options),
});
