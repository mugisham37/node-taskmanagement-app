/**
 * Comprehensive Security Middleware Stack
 *
 * Combines all security measures including rate limiting, input sanitization,
 * CSRF protection, CORS configuration, and security audit logging
 */

import { AuthorizationError, LoggingService } from '@taskmanagement/core';
import { AuthenticatedRequest, SecurityContext } from '@taskmanagement/types';
import { ValidationError } from '@taskmanagement/validation';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuditLogger } from '../audit-logger';
import { InputSanitizer } from '../input-sanitizer';
import { RateLimitService } from '../rate-limit-service';
import { RBACService } from '../rbac/rbac-service';
import { SessionManager } from '../session/session-manager';
import { JWTService } from '../tokens/jwt-service';

export interface SecurityConfig {
  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    global: {
      windowMs: number;
      maxRequests: number;
    };
    perEndpoint: Record<
      string,
      {
        windowMs: number;
        maxRequests: number;
      }
    >;
    perUser: {
      windowMs: number;
      maxRequests: number;
    };
  };

  // Input sanitization
  inputSanitization: {
    enabled: boolean;
    strictMode: boolean;
    allowedTags: string[];
    allowedAttributes: Record<string, string[]>;
  };

  // CSRF protection
  csrfProtection: {
    enabled: boolean;
    tokenLength: number;
    cookieName: string;
    headerName: string;
    skipMethods: string[];
  };

  // CORS configuration
  cors: {
    enabled: boolean;
    origin: string | string[] | boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };

  // Security headers
  securityHeaders: {
    enabled: boolean;
    contentSecurityPolicy: string | false;
    hsts:
      | {
          maxAge: number;
          includeSubDomains: boolean;
          preload: boolean;
        }
      | false;
    frameOptions: 'DENY' | 'SAMEORIGIN' | string | false;
    contentTypeOptions: boolean;
    referrerPolicy: string | false;
    permissionsPolicy: string | false;
  };

  // Audit logging
  auditLogging: {
    enabled: boolean;
    logAllRequests: boolean;
    logFailedAuth: boolean;
    logPermissionDenied: boolean;
    logSuspiciousActivity: boolean;
  };
}

export class ComprehensiveSecurityMiddleware {
  private readonly defaultConfig: SecurityConfig = {
    rateLimiting: {
      enabled: true,
      global: {
        windowMs: 60000, // 1 minute
        maxRequests: 1000,
      },
      perEndpoint: {
        'POST:/auth/login': { windowMs: 900000, maxRequests: 5 }, // 15 min, 5 attempts
        'POST:/auth/register': { windowMs: 3600000, maxRequests: 3 }, // 1 hour, 3 attempts
        'POST:/auth/forgot-password': { windowMs: 3600000, maxRequests: 3 },
      },
      perUser: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      },
    },
    inputSanitization: {
      enabled: true,
      strictMode: true,
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
      allowedAttributes: {
        a: ['href', 'title'],
        img: ['src', 'alt', 'title'],
      },
    },
    csrfProtection: {
      enabled: true,
      tokenLength: 32,
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      skipMethods: ['GET', 'HEAD', 'OPTIONS'],
    },
    cors: {
      enabled: true,
      origin: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'X-API-Key',
      ],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      credentials: true,
      maxAge: 86400, // 24 hours
    },
    securityHeaders: {
      enabled: true,
      contentSecurityPolicy:
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameOptions: 'DENY',
      contentTypeOptions: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    auditLogging: {
      enabled: true,
      logAllRequests: false,
      logFailedAuth: true,
      logPermissionDenied: true,
      logSuspiciousActivity: true,
    },
  };

  private readonly inputSanitizer: InputSanitizer;
  private readonly auditLogger: AuditLogger;
  private csrfTokens = new Map<string, { token: string; expires: Date }>();

  constructor(
    private readonly logger: LoggingService,
    private readonly rateLimitService: RateLimitService,
    private readonly sessionManager: SessionManager,
    private readonly jwtService: JWTService,
    private readonly rbacService: RBACService,
    private readonly config: Partial<SecurityConfig> = {}
  ) {
    this.inputSanitizer = new InputSanitizer(logger);
    this.auditLogger = new AuditLogger(logger);
  }

  /**
   * Main security middleware handler
   */
  handle = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const finalConfig = { ...this.defaultConfig, ...this.config };
    const securityContext = this.createSecurityContext(request);

    // Attach security context to request
    (request as AuthenticatedRequest).securityContext = securityContext;

    try {
      // 1. Security Headers
      if (finalConfig.securityHeaders.enabled) {
        this.setSecurityHeaders(reply, finalConfig.securityHeaders);
      }

      // 2. CORS Handling
      if (finalConfig.cors.enabled) {
        this.handleCORS(request, reply, finalConfig.cors);
      }

      // 3. Rate Limiting
      if (finalConfig.rateLimiting.enabled) {
        await this.handleRateLimiting(request, reply, finalConfig.rateLimiting);
      }

      // 4. Input Sanitization
      if (finalConfig.inputSanitization.enabled) {
        await this.handleInputSanitization(request, finalConfig.inputSanitization);
      }

      // 5. CSRF Protection (for state-changing operations)
      if (finalConfig.csrfProtection.enabled) {
        await this.handleCSRFProtection(request, reply, finalConfig.csrfProtection);
      }

      // 6. Authentication (if token present)
      await this.handleAuthentication(request);

      // 7. Audit Logging
      if (finalConfig.auditLogging.enabled) {
        this.handleAuditLogging(request, finalConfig.auditLogging);
      }

      this.logger.debug('Security middleware completed successfully', {
        requestId: securityContext.requestId,
        endpoint: securityContext.endpoint,
        userId: securityContext.userId,
      });
    } catch (error) {
      this.logger.error('Security middleware error', error as Error, {
        requestId: securityContext.requestId,
        endpoint: securityContext.endpoint,
      });

      if (error instanceof AuthorizationError) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: error.message,
          requestId: securityContext.requestId,
        });
        return;
      }

      if (error instanceof ValidationError) {
        reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
          requestId: securityContext.requestId,
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Security check failed',
        requestId: securityContext.requestId,
      });
      return;
    }
  };

  /**
   * Authorization middleware for protected routes
   */
  requireAuth = () => {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authRequest = request as AuthenticatedRequest;

      if (!authRequest.user) {
        throw new AuthorizationError('Authentication required');
      }

      this.logger.debug('Authentication verified', {
        userId: authRequest.user.id,
        requestId: authRequest.securityContext.requestId,
      });
    };
  };

  /**
   * Permission-based authorization middleware
   */
  requirePermission = (resource: string, action: string) => {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authRequest = request as AuthenticatedRequest;

      if (!authRequest.user) {
        throw new AuthorizationError('Authentication required');
      }

      const accessParams: any = {
        userId: authRequest.user.id,
        resource,
        action,
      };

      const resourceId = this.extractResourceId(request);
      if (resourceId) {
        accessParams.resourceId = resourceId;
      }

      const workspaceId = this.extractWorkspaceId(request);
      if (workspaceId) {
        accessParams.workspaceId = workspaceId;
      }

      const accessResult = await this.rbacService.checkAccess(accessParams);

      if (!accessResult.allowed) {
        const auditParams: any = {
          userId: authRequest.user.id,
          resource,
          action,
          ipAddress: authRequest.securityContext.ipAddress,
          userAgent: authRequest.securityContext.userAgent,
          requestId: authRequest.securityContext.requestId,
        };

        if (accessResult.reason) {
          auditParams.reason = accessResult.reason;
        }

        this.auditLogger.logPermissionDenied(auditParams);

        throw new AuthorizationError(
          `Access denied: ${accessResult.reason || 'Insufficient permissions'}`
        );
      }

      this.logger.debug('Permission check passed', {
        userId: authRequest.user.id,
        resource,
        action,
        matchedPermissions: accessResult.matchedPermissions,
      });
    };
  };

  /**
   * Role-based authorization middleware
   */
  requireRole = (roles: string | string[]) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authRequest = request as AuthenticatedRequest;

      if (!authRequest.user) {
        throw new AuthorizationError('Authentication required');
      }

      const hasRequiredRole = requiredRoles.some((role) => authRequest.user!.roles.includes(role));

      if (!hasRequiredRole) {
        this.auditLogger.logPermissionDenied({
          userId: authRequest.user.id,
          resource: 'role',
          action: 'access',
          reason: `Required roles: ${requiredRoles.join(', ')}`,
          ipAddress: authRequest.securityContext.ipAddress,
          userAgent: authRequest.securityContext.userAgent,
          requestId: authRequest.securityContext.requestId,
        });

        throw new AuthorizationError(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
      }

      this.logger.debug('Role check passed', {
        userId: authRequest.user.id,
        userRoles: authRequest.user.roles,
        requiredRoles,
      });
    };
  };

  // Private helper methods

  private createSecurityContext(request: FastifyRequest): SecurityContext {
    return {
      requestId: request.id || this.generateRequestId(),
      ipAddress: this.getClientIP(request),
      userAgent: request.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      endpoint: request.url,
      method: request.method,
      riskScore: 0,
      previousLogins: 0,
      suspiciousActivity: false,
      rateLimitStatus: {
        remaining: 100,
        reset: new Date(Date.now() + 3600000), // 1 hour from now
      },
    };
  }

  private setSecurityHeaders(reply: FastifyReply, config: SecurityConfig['securityHeaders']): void {
    if (config.contentSecurityPolicy !== false) {
      reply.header('Content-Security-Policy', config.contentSecurityPolicy);
    }

    if (config.hsts !== false) {
      let hstsValue = `max-age=${config.hsts.maxAge}`;
      if (config.hsts.includeSubDomains) hstsValue += '; includeSubDomains';
      if (config.hsts.preload) hstsValue += '; preload';
      reply.header('Strict-Transport-Security', hstsValue);
    }

    if (config.frameOptions !== false) {
      reply.header('X-Frame-Options', config.frameOptions);
    }

    if (config.contentTypeOptions) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    if (config.referrerPolicy !== false) {
      reply.header('Referrer-Policy', config.referrerPolicy);
    }

    if (config.permissionsPolicy !== false) {
      reply.header('Permissions-Policy', config.permissionsPolicy);
    }

    // Additional security headers
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('Server');
  }

  private handleCORS(
    request: FastifyRequest,
    reply: FastifyReply,
    config: SecurityConfig['cors']
  ): void {
    const origin = request.headers.origin;

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', config.methods.join(', '));
      reply.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
      reply.header('Access-Control-Max-Age', config.maxAge.toString());

      if (this.isOriginAllowed(origin, config.origin)) {
        reply.header('Access-Control-Allow-Origin', origin || '*');
        if (config.credentials) {
          reply.header('Access-Control-Allow-Credentials', 'true');
        }
      }

      reply.code(204).send();
      return;
    }

    // Handle actual requests
    if (this.isOriginAllowed(origin, config.origin)) {
      reply.header('Access-Control-Allow-Origin', origin || '*');
      if (config.credentials) {
        reply.header('Access-Control-Allow-Credentials', 'true');
      }
    }

    if (config.exposedHeaders.length > 0) {
      reply.header('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    }
  }

  private async handleRateLimiting(
    request: FastifyRequest,
    reply: FastifyReply,
    config: SecurityConfig['rateLimiting']
  ): Promise<void> {
    const clientId = this.getClientIdentifier(request);
    const endpoint = this.getEndpointKey(request);

    // Check endpoint-specific rate limit
    const endpointConfig = config.perEndpoint[endpoint];
    if (endpointConfig) {
      const result = await this.rateLimitService.checkLimit(clientId, endpoint, endpointConfig);

      if (!result.allowed) {
        this.setRateLimitHeaders(reply, result);
        throw ValidationError.forField('rate_limit', 'Rate limit exceeded for this endpoint');
      }
    }

    // Check global rate limit
    const globalResult = await this.rateLimitService.checkLimit(clientId, 'global', config.global);

    if (!globalResult.allowed) {
      this.setRateLimitHeaders(reply, globalResult);
      throw ValidationError.forField('rate_limit', 'Global rate limit exceeded');
    }

    // Set rate limit headers for successful requests
    this.setRateLimitHeaders(reply, globalResult);
  }

  private async handleInputSanitization(
    request: FastifyRequest,
    config: SecurityConfig['inputSanitization']
  ): Promise<void> {
    // Sanitize request body
    if (request.body && typeof request.body === 'object') {
      const result = this.inputSanitizer.sanitizeObject(request.body, {
        allowedTags: config.allowedTags,
        allowedAttributes: config.allowedAttributes,
      });

      if (result.wasModified) {
        request.body = result.sanitized;
        this.logger.warn('Request body was sanitized', {
          requestId: (request as AuthenticatedRequest).securityContext.requestId,
          wasModified: result.wasModified,
        });
      }
    }

    // Sanitize query parameters
    if (request.query && typeof request.query === 'object') {
      const result = this.inputSanitizer.sanitizeObject(request.query, {
        allowedTags: config.allowedTags,
      });

      if (result.wasModified) {
        request.query = result.sanitized;
        this.logger.warn('Query parameters were sanitized', {
          requestId: (request as AuthenticatedRequest).securityContext.requestId,
        });
      }
    }
  }

  private async handleCSRFProtection(
    request: FastifyRequest,
    reply: FastifyReply,
    config: SecurityConfig['csrfProtection']
  ): Promise<void> {
    // Skip CSRF protection for safe methods
    if (config.skipMethods.includes(request.method)) {
      return;
    }

    const token = this.extractCSRFToken(request, config);
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      // No session, generate and set CSRF token
      const newToken = this.generateCSRFToken();
      this.setCSRFCookie(reply, newToken, config);
      (request as AuthenticatedRequest).csrfToken = newToken;
      return;
    }

    if (!token) {
      throw ValidationError.forField('csrf_token', 'CSRF token is required');
    }

    if (!this.validateCSRFToken(sessionId, token)) {
      throw ValidationError.forField('csrf_token', 'Invalid CSRF token');
    }
  }

  private async handleAuthentication(request: FastifyRequest): Promise<void> {
    const token = this.extractAuthToken(request);

    if (!token) {
      return; // No token, continue without authentication
    }

    try {
      // Verify JWT token
      const payload = this.jwtService.verifyAccessToken(token);

      // Validate session
      const sessionResult = await this.sessionManager.validateSession(payload.sessionId);

      if (!sessionResult.isValid || !sessionResult.session) {
        throw new AuthorizationError('Invalid session');
      }

      // Attach user to request
      (request as AuthenticatedRequest).user = {
        id: payload.userId,
        email: payload.email,
        name: payload.email, // Use email as name if not provided
        isActive: true,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        sessionId: payload.sessionId,
      };

      // Update security context
      (request as AuthenticatedRequest).securityContext.userId = payload.userId;
      (request as AuthenticatedRequest).securityContext.sessionId = payload.sessionId;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }

      this.logger.warn('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (request as AuthenticatedRequest).securityContext.requestId,
      });

      throw new AuthorizationError('Invalid authentication token');
    }
  }

  private handleAuditLogging(
    request: FastifyRequest,
    config: SecurityConfig['auditLogging']
  ): void {
    const authRequest = request as AuthenticatedRequest;

    if (config.logAllRequests) {
      this.auditLogger.logRequest({
        userId: authRequest.user?.id,
        method: request.method,
        url: request.url,
        ipAddress: authRequest.securityContext.ipAddress,
        userAgent: authRequest.securityContext.userAgent,
        requestId: authRequest.securityContext.requestId,
      });
    }
  }

  // Utility methods

  private getClientIP(request: FastifyRequest): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      'unknown'
    );
  }

  private getClientIdentifier(request: FastifyRequest): string {
    const authRequest = request as AuthenticatedRequest;
    return authRequest.user?.id || this.getClientIP(request);
  }

  private getEndpointKey(request: FastifyRequest): string {
    return `${request.method}:${request.url.split('?')[0]}`;
  }

  private isOriginAllowed(
    origin: string | undefined,
    allowedOrigins: string | string[] | boolean
  ): boolean {
    if (allowedOrigins === true) return true;
    if (allowedOrigins === false) return false;
    if (typeof allowedOrigins === 'string') return origin === allowedOrigins;
    if (Array.isArray(allowedOrigins)) return allowedOrigins.includes(origin || '');
    return false;
  }

  private setRateLimitHeaders(reply: FastifyReply, result: any): void {
    reply.header('X-RateLimit-Limit', result.maxRequests || 100);
    reply.header('X-RateLimit-Remaining', result.remaining || 0);
    reply.header('X-RateLimit-Reset', result.resetTime?.getTime() || Date.now());
  }

  private extractCSRFToken(
    request: FastifyRequest,
    config: SecurityConfig['csrfProtection']
  ): string | null {
    return (
      (request.headers[config.headerName] as string) ||
      (request as any).cookies?.[config.cookieName] ||
      null
    );
  }

  private extractSessionId(request: FastifyRequest): string | null {
    const authRequest = request as AuthenticatedRequest;
    return authRequest.user?.sessionId || null;
  }

  private extractAuthToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return (request as any).cookies?.accessToken || null;
  }

  private extractResourceId(request: FastifyRequest): string | undefined {
    const params = request.params as any;
    return params?.id || params?.resourceId;
  }

  private extractWorkspaceId(request: FastifyRequest): string | undefined {
    const params = request.params as any;
    const headers = request.headers;
    return params?.workspaceId || (headers['x-workspace-id'] as string);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateCSRFToken(): string {
    return Buffer.from(`${Date.now()}_${Math.random().toString(36).substring(2)}`).toString(
      'base64url'
    );
  }

  private setCSRFCookie(
    reply: FastifyReply,
    token: string,
    config: SecurityConfig['csrfProtection']
  ): void {
    (reply as any).setCookie(config.cookieName, token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1 hour
    });
  }

  private validateCSRFToken(sessionId: string, token: string): boolean {
    const storedToken = this.csrfTokens.get(sessionId);

    if (!storedToken || storedToken.expires < new Date()) {
      this.csrfTokens.delete(sessionId);
      return false;
    }

    return storedToken.token === token;
  }
}
