import { User } from '../entities/User';
import { Session } from '../entities/Session';
import { Device } from '../entities/Device';
import { UserId } from '../value-objects/UserId';
import { Email } from '../value-objects/Email';
import { SessionId } from '../value-objects/SessionId';
import { DeviceId } from '../value-objects/DeviceId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface AuthenticationCredentials {
  email: string;
  password: string;
}

export interface AuthenticationContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  workspaceId?: string;
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  session?: Session;
  device?: Device;
  requiresMfa?: boolean;
  requiresEmailVerification?: boolean;
  riskScore?: number;
  error?: string;
}

export interface WorkspaceAuthenticationResult extends AuthenticationResult {
  workspaceContext?: {
    workspaceId: WorkspaceId;
    permissions: string[];
    role: string;
  };
}

export class UserAuthenticatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly workspaceId?: WorkspaceId,
    public readonly riskScore?: number
  ) {
    super('UserAuthenticated', {
      userId: userId.value,
      sessionId: sessionId.value,
      workspaceId: workspaceId?.value,
      riskScore,
    });
  }
}

export class AuthenticationFailedEvent extends DomainEvent {
  constructor(
    public readonly email: string,
    public readonly reason: string,
    public readonly ipAddress?: string,
    public readonly riskScore?: number
  ) {
    super('AuthenticationFailed', {
      email,
      reason,
      ipAddress,
      riskScore,
    });
  }
}

export class MfaRequiredEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly method: string
  ) {
    super('MfaRequired', {
      userId: userId.value,
      method,
    });
  }
}

/**
 * Enhanced Authentication Service with workspace context integration
 * Handles user authentication, session management, and security assessment
 */
export class AuthenticationService {
  constructor(
    private readonly userRepository: any, // TODO: Define proper repository interface
    private readonly sessionRepository: any,
    private readonly deviceRepository: any,
    private readonly passwordService: any,
    private readonly riskAssessmentService: any,
    private readonly eventBus: any
  ) {}

  /**
   * Authenticate user with workspace context
   */
  async authenticateWithWorkspaceContext(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<WorkspaceAuthenticationResult> {
    try {
      // Basic authentication
      const authResult = await this.authenticate(credentials, context);

      if (!authResult.success || !authResult.user) {
        return authResult;
      }

      // Add workspace context if specified
      if (context.workspaceId) {
        const workspaceId = WorkspaceId.create(context.workspaceId);

        // Validate workspace access
        const hasAccess = await this.validateWorkspaceAccess(
          authResult.user.id,
          workspaceId
        );

        if (!hasAccess) {
          return {
            success: false,
            error: 'Access denied to workspace',
          };
        }

        // Get workspace permissions and role
        const workspaceContext = await this.getWorkspaceContext(
          authResult.user.id,
          workspaceId
        );

        // Update session with workspace context
        if (authResult.session) {
          authResult.session.switchWorkspaceContext(workspaceId);
        }

        return {
          ...authResult,
          workspaceContext,
        };
      }

      return authResult;
    } catch (error) {
      await this.eventBus.publish(
        new AuthenticationFailedEvent(
          credentials.email,
          'Authentication error',
          context.ipAddress
        )
      );

      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Standard authentication without workspace context
   */
  async authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    try {
      // Find user by email
      const email = Email.create(credentials.email);
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        await this.eventBus.publish(
          new AuthenticationFailedEvent(
            credentials.email,
            'User not found',
            context.ipAddress
          )
        );

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Check if user can login
      if (!user.canLogin()) {
        const reason = user.isLocked()
          ? 'Account locked'
          : 'Email not verified';

        await this.eventBus.publish(
          new AuthenticationFailedEvent(
            credentials.email,
            reason,
            context.ipAddress
          )
        );

        return {
          success: false,
          error: reason,
          requiresEmailVerification: !user.isEmailVerified(),
        };
      }

      // Verify password
      const isValidPassword = await this.passwordService.verify(
        credentials.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        user.recordFailedLogin(context.ipAddress);
        await this.userRepository.save(user);

        await this.eventBus.publish(
          new AuthenticationFailedEvent(
            credentials.email,
            'Invalid password',
            context.ipAddress
          )
        );

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Calculate risk score
      const riskScore = await this.calculateAuthenticationRisk(user, context);

      // Check if MFA is required
      if (user.mfaEnabled || riskScore > 0.5) {
        await this.eventBus.publish(new MfaRequiredEvent(user.id, 'TOTP'));

        return {
          success: false,
          requiresMfa: true,
          riskScore,
        };
      }

      // Handle device registration/recognition
      const device = await this.handleDeviceAuthentication(user, context);

      // Create session
      const session = await this.createSession(user, device, context);

      // Record successful login
      user.recordSuccessfulLogin(context.ipAddress);
      user.updateRiskScore(riskScore);
      await this.userRepository.save(user);

      // Publish authentication event
      await this.eventBus.publish(
        new UserAuthenticatedEvent(user.id, session.id, undefined, riskScore)
      );

      return {
        success: true,
        user,
        session,
        device,
        riskScore,
      };
    } catch (error) {
      await this.eventBus.publish(
        new AuthenticationFailedEvent(
          credentials.email,
          'Authentication error',
          context.ipAddress
        )
      );

      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Validate MFA token
   */
  async validateMfaToken(
    userId: UserId,
    token: string,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Validate TOTP token
      const isValidToken = await this.validateTotpToken(user, token);
      if (!isValidToken) {
        return {
          success: false,
          error: 'Invalid MFA token',
        };
      }

      // Handle device and session creation
      const device = await this.handleDeviceAuthentication(user, context);
      const session = await this.createSession(user, device, context);

      // Record successful login
      user.recordSuccessfulLogin(context.ipAddress);
      await this.userRepository.save(user);

      // Publish authentication event
      await this.eventBus.publish(
        new UserAuthenticatedEvent(user.id, session.id)
      );

      return {
        success: true,
        user,
        session,
        device,
      };
    } catch (error) {
      return {
        success: false,
        error: 'MFA validation failed',
      };
    }
  }

  /**
   * Refresh authentication session
   */
  async refreshSession(sessionToken: string): Promise<AuthenticationResult> {
    try {
      const session = await this.sessionRepository.findByToken(sessionToken);
      if (!session || !session.isValid()) {
        return {
          success: false,
          error: 'Invalid session',
        };
      }

      const user = await this.userRepository.findById(session.userId);
      if (!user || !user.canLogin()) {
        return {
          success: false,
          error: 'User cannot login',
        };
      }

      // Extend session
      session.extend();
      await this.sessionRepository.save(session);

      return {
        success: true,
        user,
        session,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Session refresh failed',
      };
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionToken: string): Promise<void> {
    try {
      const session = await this.sessionRepository.findByToken(sessionToken);
      if (session) {
        session.expire();
        await this.sessionRepository.save(session);
      }
    } catch (error) {
      // Log error but don't throw - logout should always succeed
      console.error('Logout error:', error);
    }
  }

  /**
   * Switch workspace context for existing session
   */
  async switchWorkspaceContext(
    sessionToken: string,
    workspaceId: WorkspaceId
  ): Promise<WorkspaceAuthenticationResult> {
    try {
      const session = await this.sessionRepository.findByToken(sessionToken);
      if (!session || !session.isValid()) {
        return {
          success: false,
          error: 'Invalid session',
        };
      }

      const user = await this.userRepository.findById(session.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Validate workspace access
      const hasAccess = await this.validateWorkspaceAccess(
        user.id,
        workspaceId
      );
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied to workspace',
        };
      }

      // Update session and user workspace context
      session.switchWorkspaceContext(workspaceId);
      user.switchWorkspaceContext(workspaceId);

      await this.sessionRepository.save(session);
      await this.userRepository.save(user);

      // Get workspace context
      const workspaceContext = await this.getWorkspaceContext(
        user.id,
        workspaceId
      );

      return {
        success: true,
        user,
        session,
        workspaceContext,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Workspace context switch failed',
      };
    }
  }

  // Private helper methods

  private async calculateAuthenticationRisk(
    user: User,
    context: AuthenticationContext
  ): Promise<number> {
    return this.riskAssessmentService.calculateAuthenticationRisk(
      user,
      context
    );
  }

  private async validateTotpToken(user: User, token: string): Promise<boolean> {
    // TODO: Implement TOTP validation
    return true; // Placeholder
  }

  private async handleDeviceAuthentication(
    user: User,
    context: AuthenticationContext
  ): Promise<Device | undefined> {
    if (!context.deviceFingerprint) {
      return undefined;
    }

    // Try to find existing device
    let device = await this.deviceRepository.findByFingerprint(
      context.deviceFingerprint
    );

    if (!device) {
      // Create new device
      const deviceType = Device.detectDeviceType(context.userAgent);
      device = Device.create({
        userId: user.id,
        name: `${deviceType} Device`,
        type: deviceType,
        fingerprint: context.deviceFingerprint,
        trusted: false,
      });

      await this.deviceRepository.save(device);
    }

    // Record device activity
    device.recordActivity();
    await this.deviceRepository.save(device);

    return device;
  }

  private async createSession(
    user: User,
    device: Device | undefined,
    context: AuthenticationContext
  ): Promise<Session> {
    const sessionToken = this.generateSessionToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = Session.create({
      sessionToken,
      userId: user.id,
      expires,
      deviceId: device?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await this.sessionRepository.save(session);
    return session;
  }

  private generateSessionToken(): string {
    // TODO: Implement secure session token generation
    return 'session_' + Math.random().toString(36).substring(2);
  }

  private async validateWorkspaceAccess(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    // TODO: Implement workspace access validation
    return true; // Placeholder
  }

  private async getWorkspaceContext(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<{
    workspaceId: WorkspaceId;
    permissions: string[];
    role: string;
  }> {
    // TODO: Implement workspace context retrieval
    return {
      workspaceId,
      permissions: [],
      role: 'member',
    };
  }
}
