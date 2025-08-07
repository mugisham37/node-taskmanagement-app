import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationService } from '../domain/authentication/services/AuthenticationService';
import { AuthorizationService } from '../domain/authentication/services/AuthorizationService';
import { MfaService } from '../domain/authentication/services/MfaService';
import { OAuthService } from '../domain/authentication/services/OAuthService';
import { SessionManagementService } from '../domain/authentication/services/SessionManagementService';
import { UnifiedAuthMiddleware } from '../middleware/unified-auth.middleware';
import { ComprehensiveAuditMiddleware } from '../middleware/comprehensive-audit.middleware';
import { IntelligentRateLimiter } from '../middleware/intelligent-rate-limiter.middleware';
import { UserId } from '../domain/authentication/value-objects/UserId';
import { WorkspaceId } from '../domain/task-management/value-objects/WorkspaceId';

// Request/Response schemas
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      workspaceId: { type: 'string', format: 'uuid' },
      deviceFingerprint: { type: 'string' },
      rememberMe: { type: 'boolean' },
    },
  },
};

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      name: { type: 'string', minLength: 1 },
      timezone: { type: 'string' },
      workspaceInviteToken: { type: 'string' },
    },
  },
};

const mfaVerifySchema = {
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string' },
      method: {
        type: 'string',
        enum: ['totp', 'sms', 'webauthn', 'backup_code'],
      },
      rememberDevice: { type: 'boolean' },
    },
  },
};

const mfaSetupSchema = {
  body: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['totp', 'sms', 'webauthn'] },
      phoneNumber: { type: 'string' },
      credentialName: { type: 'string' },
    },
  },
};

const workspaceSwitchSchema = {
  body: {
    type: 'object',
    required: ['workspaceId'],
    properties: {
      workspaceId: { type: 'string', format: 'uuid' },
    },
  },
};

const sessionManagementSchema = {
  params: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', format: 'uuid' },
    },
  },
};

/**
 * Unified Authentication Routes for Fastify
 * Implements comprehensive authentication with workspace context, MFA, and OAuth
 */
export async function unifiedAuthRoutes(
  fastify: FastifyInstance,
  authService: AuthenticationService,
  authorizationService: AuthorizationService,
  mfaService: MfaService,
  oauthService: OAuthService,
  sessionService: SessionManagementService,
  authMiddleware: UnifiedAuthMiddleware,
  auditMiddleware: ComprehensiveAuditMiddleware,
  rateLimiter: IntelligentRateLimiter
) {
  // Apply rate limiting to all auth routes
  fastify.addHook('preHandler', rateLimiter.createMiddleware());

  // Apply audit logging to all auth routes
  fastify.addHook('preHandler', auditMiddleware.createMiddleware());

  /**
   * User Registration
   */
  fastify.post(
    '/register',
    {
      schema: registerSchema,
      preHandler: [rateLimiter.createMiddleware()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password, name, timezone, workspaceInviteToken } =
          request.body as any;

        // Create user account
        const user = await authService.createUser({
          email,
          password,
          name,
          timezone: timezone || 'UTC',
        });

        // Handle workspace invitation if provided
        let workspaceContext;
        if (workspaceInviteToken) {
          workspaceContext = await authService.acceptWorkspaceInvitation(
            user.id,
            workspaceInviteToken
          );
        }

        // Log registration event
        await auditMiddleware.logAuthenticationEvent(
          'register',
          user.id.value,
          request,
          { workspaceInviteToken: !!workspaceInviteToken }
        );

        reply.code(201).send({
          success: true,
          message: 'Registration successful. Please verify your email.',
          user: {
            id: user.id.value,
            email: user.email.value,
            name: user.name,
            emailVerified: user.isEmailVerified(),
          },
          workspaceContext,
        });
      } catch (error) {
        await auditMiddleware.logAuthenticationEvent(
          'register_failed',
          undefined,
          request,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );

        reply.code(400).send({
          success: false,
          error: 'Registration failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * User Login
   */
  fastify.post(
    '/login',
    {
      schema: loginSchema,
      preHandler: [rateLimiter.createMiddleware()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password, workspaceId, deviceFingerprint, rememberMe } =
          request.body as any;

        const authContext = {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          deviceFingerprint,
          workspaceId,
        };

        const result = await authService.authenticateWithWorkspaceContext(
          { email, password },
          authContext
        );

        if (!result.success) {
          await auditMiddleware.logAuthenticationEvent(
            'login_failed',
            undefined,
            request,
            { email, reason: result.error }
          );

          if (result.requiresMfa) {
            reply.code(200).send({
              success: false,
              requiresMfa: true,
              riskScore: result.riskScore,
              message: 'Multi-factor authentication required',
            });
            return;
          }

          if (result.requiresEmailVerification) {
            reply.code(200).send({
              success: false,
              requiresEmailVerification: true,
              message: 'Please verify your email address',
            });
            return;
          }

          reply.code(401).send({
            success: false,
            error: 'Authentication failed',
            message: result.error,
          });
          return;
        }

        // Set session cookie
        const sessionToken = result.session!.sessionToken;
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict' as const,
          maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 24 hours
        };

        reply.setCookie('sessionToken', sessionToken, cookieOptions);

        await auditMiddleware.logAuthenticationEvent(
          'login',
          result.user!.id.value,
          request,
          { workspaceId: result.workspaceContext?.workspaceId.value }
        );

        reply.send({
          success: true,
          message: 'Login successful',
          user: {
            id: result.user!.id.value,
            email: result.user!.email.value,
            name: result.user!.name,
            role: 'member', // TODO: Get from user
            riskScore: result.riskScore,
          },
          session: {
            id: result.session!.id.value,
            expires: result.session!.expires,
          },
          workspaceContext: result.workspaceContext
            ? {
                workspaceId: result.workspaceContext.workspaceId.value,
                permissions: result.workspaceContext.permissions,
                role: result.workspaceContext.role,
              }
            : undefined,
          device: result.device
            ? {
                id: result.device.id.value,
                name: result.device.name,
                trusted: result.device.trusted,
              }
            : undefined,
        });
      } catch (error) {
        await auditMiddleware.logAuthenticationEvent(
          'login_failed',
          undefined,
          request,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );

        reply.code(500).send({
          success: false,
          error: 'Authentication failed',
          message: 'Internal server error',
        });
      }
    }
  );

  /**
   * MFA Verification
   */
  fastify.post(
    '/mfa/verify',
    {
      schema: mfaVerifySchema,
      preHandler: [rateLimiter.createMiddleware()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token, method = 'totp', rememberDevice } = request.body as any;
        const userId = request.headers['x-user-id'] as string; // Temporary user ID from login attempt

        if (!userId) {
          reply.code(400).send({
            success: false,
            error: 'User ID required for MFA verification',
          });
          return;
        }

        const userIdObj = UserId.create(userId);
        let result;

        switch (method) {
          case 'totp':
            result = await mfaService.verifyTotpToken(userIdObj, token);
            break;
          case 'sms':
            result = await mfaService.verifySmsToken(userIdObj, token);
            break;
          case 'backup_code':
            result = await mfaService.verifyBackupCode(userIdObj, token);
            break;
          default:
            reply.code(400).send({
              success: false,
              error: 'Unsupported MFA method',
            });
            return;
        }

        if (!result.success) {
          await auditMiddleware.logAuthenticationEvent(
            'mfa_failed',
            userId,
            request,
            { method, reason: result.error }
          );

          reply.code(401).send({
            success: false,
            error: 'MFA verification failed',
            message: result.error,
            remainingAttempts: result.remainingAttempts,
          });
          return;
        }

        // Complete authentication process
        const authContext = {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        };

        const authResult = await authService.completeMfaAuthentication(
          userIdObj,
          authContext
        );

        if (rememberDevice && authResult.device) {
          authResult.device.trust();
          // TODO: Save device
        }

        await auditMiddleware.logAuthenticationEvent(
          'mfa_success',
          userId,
          request,
          { method }
        );

        reply.send({
          success: true,
          message: 'MFA verification successful',
          user: {
            id: authResult.user!.id.value,
            email: authResult.user!.email.value,
            name: authResult.user!.name,
          },
          session: {
            id: authResult.session!.id.value,
            expires: authResult.session!.expires,
          },
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'MFA verification failed',
          message: 'Internal server error',
        });
      }
    }
  );

  /**
   * MFA Setup
   */
  fastify.post(
    '/mfa/setup',
    {
      schema: mfaSetupSchema,
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          method = 'totp',
          phoneNumber,
          credentialName,
        } = request.body as any;
        const userId = UserId.create(request.user!.id);

        let setupResult;

        switch (method) {
          case 'totp':
            setupResult = await mfaService.setupTotp(userId);
            break;
          case 'sms':
            if (!phoneNumber) {
              reply.code(400).send({
                success: false,
                error: 'Phone number required for SMS MFA',
              });
              return;
            }
            setupResult = await mfaService.setupSms(userId, phoneNumber);
            break;
          case 'webauthn':
            setupResult =
              await mfaService.generateWebAuthnRegistrationOptions(userId);
            break;
          default:
            reply.code(400).send({
              success: false,
              error: 'Unsupported MFA method',
            });
            return;
        }

        reply.send({
          success: true,
          message: `${method.toUpperCase()} MFA setup initiated`,
          setupData: setupResult,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'MFA setup failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * MFA Setup Confirmation
   */
  fastify.post(
    '/mfa/setup/confirm',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          method,
          token,
          secret,
          backupCodes,
          phoneNumber,
          registrationResponse,
        } = request.body as any;
        const userId = UserId.create(request.user!.id);

        switch (method) {
          case 'totp':
            await mfaService.confirmTotpSetup(
              userId,
              secret,
              token,
              backupCodes
            );
            break;
          case 'sms':
            await mfaService.confirmSmsSetup(userId, phoneNumber, token);
            break;
          case 'webauthn':
            await mfaService.registerWebAuthnCredential(
              userId,
              registrationResponse,
              request.headers['x-challenge'] as string,
              request.body.credentialName
            );
            break;
          default:
            reply.code(400).send({
              success: false,
              error: 'Unsupported MFA method',
            });
            return;
        }

        reply.send({
          success: true,
          message: `${method.toUpperCase()} MFA enabled successfully`,
        });
      } catch (error) {
        reply.code(400).send({
          success: false,
          error: 'MFA setup confirmation failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * Get MFA Status
   */
  fastify.get(
    '/mfa/status',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = UserId.create(request.user!.id);
        const status = await mfaService.getMfaStatus(userId);

        reply.send({
          success: true,
          mfaStatus: status,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to get MFA status',
        });
      }
    }
  );

  /**
   * Disable MFA
   */
  fastify.post(
    '/mfa/disable',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = UserId.create(request.user!.id);
        await mfaService.disableMfa(userId);

        reply.send({
          success: true,
          message: 'MFA disabled successfully',
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to disable MFA',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * Switch Workspace Context
   */
  fastify.post(
    '/workspace/switch',
    {
      schema: workspaceSwitchSchema,
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { workspaceId } = request.body as any;
        const sessionId = request.user!.sessionId;
        const workspaceIdObj = WorkspaceId.create(workspaceId);

        const result = await sessionService.switchWorkspaceContext(
          sessionId,
          workspaceIdObj
        );

        reply.send({
          success: true,
          message: 'Workspace context switched successfully',
          workspaceContext: {
            workspaceId: result.workspaceId.value,
            workspaceName: result.workspaceName,
            role: result.role,
            permissions: result.permissions,
          },
        });
      } catch (error) {
        reply.code(400).send({
          success: false,
          error: 'Workspace switch failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * Get Current User
   */
  fastify.get(
    '/me',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user!;
        const workspaceContext = request.workspaceContext;

        reply.send({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
            riskScore: user.riskScore,
          },
          session: {
            id: user.sessionId,
            deviceId: user.deviceId,
          },
          workspaceContext,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to get user information',
        });
      }
    }
  );

  /**
   * Get User Sessions
   */
  fastify.get(
    '/sessions',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = UserId.create(request.user!.id);
        const sessions = await sessionService.getUserSessions(userId);

        reply.send({
          success: true,
          sessions: sessions.map(session => ({
            ...session,
            isCurrent: session.id === request.user!.sessionId,
          })),
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to get user sessions',
        });
      }
    }
  );

  /**
   * Revoke Session
   */
  fastify.delete(
    '/sessions/:sessionId',
    {
      schema: sessionManagementSchema,
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params as any;
        const currentSessionId = request.user!.sessionId;

        if (sessionId === currentSessionId) {
          reply.code(400).send({
            success: false,
            error: 'Cannot revoke current session',
          });
          return;
        }

        await sessionService.revokeSession(sessionId, 'Revoked by user');

        reply.send({
          success: true,
          message: 'Session revoked successfully',
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to revoke session',
        });
      }
    }
  );

  /**
   * Revoke All Other Sessions
   */
  fastify.post(
    '/sessions/revoke-all',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = UserId.create(request.user!.id);
        const currentSessionId = request.user!.sessionId;

        const revokedCount = await sessionService.revokeAllOtherSessions(
          userId,
          currentSessionId
        );

        reply.send({
          success: true,
          message: `${revokedCount} sessions revoked successfully`,
          revokedCount,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to revoke sessions',
        });
      }
    }
  );

  /**
   * Logout
   */
  fastify.post(
    '/logout',
    {
      preHandler: [authMiddleware.authenticate()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionId = request.user!.sessionId;
        await sessionService.revokeSession(sessionId, 'User logout');

        // Clear session cookie
        reply.clearCookie('sessionToken');

        await auditMiddleware.logAuthenticationEvent(
          'logout',
          request.user!.id,
          request
        );

        reply.send({
          success: true,
          message: 'Logout successful',
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Logout failed',
        });
      }
    }
  );

  /**
   * OAuth Routes
   */

  // Google OAuth
  fastify.get(
    '/oauth/google',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { url, state } =
          await oauthService.generateAuthorizationUrl('google');

        // Store state in session for verification
        reply.setCookie('oauth_state', state, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 10 * 60 * 1000, // 10 minutes
        });

        reply.redirect(url);
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'OAuth initialization failed',
        });
      }
    }
  );

  // Google OAuth Callback
  fastify.get(
    '/oauth/google/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code, state } = request.query as any;
        const storedState = request.cookies.oauth_state;

        if (!code || !state || state !== storedState) {
          reply.code(400).send({
            success: false,
            error: 'Invalid OAuth callback',
          });
          return;
        }

        const result = await oauthService.handleCallback('google', code, state);

        // Create session
        const session = await sessionService.createSession(
          result.user.id,
          undefined,
          undefined,
          {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          }
        );

        // Set session cookie
        reply.setCookie('sessionToken', session.sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        // Clear OAuth state cookie
        reply.clearCookie('oauth_state');

        await auditMiddleware.logAuthenticationEvent(
          'oauth_login',
          result.user.id.value,
          request,
          { provider: 'google', isNewUser: result.isNewUser }
        );

        // Redirect to frontend
        const redirectUrl = result.isNewUser
          ? '/welcome?oauth=google'
          : '/dashboard?oauth=google';

        reply.redirect(redirectUrl);
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'OAuth callback failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Similar routes for GitHub, Microsoft, etc.
  // ... (implement similar patterns for other OAuth providers)

  /**
   * Admin Routes
   */

  // Get User by ID (Admin only)
  fastify.get(
    '/admin/users/:userId',
    {
      preHandler: [
        authMiddleware.authenticate(),
        authMiddleware.authorize(['system:admin']),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as any;
        const user = await authService.getUserById(UserId.create(userId));

        if (!user) {
          reply.code(404).send({
            success: false,
            error: 'User not found',
          });
          return;
        }

        reply.send({
          success: true,
          user: {
            id: user.id.value,
            email: user.email.value,
            name: user.name,
            emailVerified: user.isEmailVerified(),
            mfaEnabled: user.mfaEnabled,
            riskScore: user.riskScore,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          },
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to get user',
        });
      }
    }
  );

  // Lock User Account (Admin only)
  fastify.post(
    '/admin/users/:userId/lock',
    {
      preHandler: [
        authMiddleware.authenticate(),
        authMiddleware.authorize(['system:admin']),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as any;
        const { reason, duration } = request.body as any;

        await authService.lockUserAccount(
          UserId.create(userId),
          reason || 'Locked by administrator',
          duration
        );

        await auditMiddleware.logCustomEvent(
          'user_locked',
          'user',
          userId,
          request.user!.id,
          request.workspaceContext?.workspaceId,
          { reason, duration, lockedBy: request.user!.id }
        );

        reply.send({
          success: true,
          message: 'User account locked successfully',
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to lock user account',
        });
      }
    }
  );

  // Get Security Events (Admin only)
  fastify.get(
    '/admin/security/events',
    {
      preHandler: [
        authMiddleware.authenticate(),
        authMiddleware.authorize(['system:admin', 'audit:view']),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          startDate,
          endDate,
          userId,
          limit = 100,
          offset = 0,
        } = request.query as any;

        const events = await auditMiddleware.queryEvents({
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          userId,
          limit: parseInt(limit),
          offset: parseInt(offset),
        });

        // Filter for security-related events
        const securityEvents = events.filter(
          event =>
            event.tags?.includes('security') ||
            event.action.startsWith('security_') ||
            event.action.startsWith('auth_')
        );

        reply.send({
          success: true,
          events: securityEvents,
          total: securityEvents.length,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: 'Failed to get security events',
        });
      }
    }
  );
}
