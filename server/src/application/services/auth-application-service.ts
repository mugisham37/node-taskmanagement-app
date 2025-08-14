/**
 * Authentication Application Service
 *
 * Handles authentication, session management, OAuth integration, and 2FA
 */

import {
  BaseApplicationService,
  ValidationResult,
  RequiredFieldValidationRule,
  LengthValidationRule,
} from './base-application-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IUserRepository } from '../../domain/repositories/user-repository';
import {
  JWTService
} from '../../infrastructure/security/jwt-service';
import { PasswordService } from '../../infrastructure/security/password-service';
import {
  SessionManager
} from '../../infrastructure/security/session-manager';
import {
  OAuthService
} from '../../infrastructure/security/oauth-service';
import {
  TwoFactorAuthService,
  TwoFactorSetup,
} from '../../infrastructure/security/two-factor-auth-service';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { UserId } from '../../domain/value-objects/user-id';
import { Email } from '../../domain/value-objects/email';
import { User } from '../../domain/entities/user';
import { injectable } from '../../shared/decorators/injectable.decorator';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
  expiresIn: number;
  sessionId: string;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isActive: boolean;
  role: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

@injectable()
export class AuthApplicationService extends BaseApplicationService {
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JWTService,
    private readonly passwordService: PasswordService,
    private readonly sessionManager: SessionManager,
    private readonly oauthService: OAuthService,
    private readonly twoFactorService: TwoFactorAuthService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Authenticate user with email and password
   */
  async login(
    request: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    return await this.executeWithMonitoring('login', async () => {
      // Validate input
      const validation = this.validateLoginRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const email = new Email(request.email);

      // Check for account lockout
      await this.checkAccountLockout(email);

      // Find user
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        await this.recordFailedLoginAttempt(email, ipAddress);
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await this.passwordService.verify(
        request.password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        await this.recordFailedLoginAttempt(email, ipAddress);
        throw new Error('Invalid credentials');
      }

      // Check if account is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Clear failed login attempts
      await this.clearFailedLoginAttempts(email);

      // Check if 2FA is enabled
      const twoFactorStatus = await this.twoFactorService.getTwoFactorStatus(
        user.id.value
      );

      if (twoFactorStatus.isEnabled) {
        // Generate temporary token for 2FA verification
        const twoFactorToken = this.generateTwoFactorToken(user.id.value);
        await this.storeTwoFactorToken(user.id.value, twoFactorToken);

        this.logInfo('2FA required for login', {
          userId: user.id.value,
          ipAddress,
        });

        return {
          accessToken: '',
          refreshToken: '',
          user: this.mapUserToDto(user),
          expiresIn: 0,
          sessionId: '',
          requiresTwoFactor: true,
          twoFactorToken,
        };
      }

      // Create session
      const session = await this.sessionManager.createSession({
        userId: user.id.value,
        email: user.email.value,
        roles: [], // TODO: Get user roles from database
        permissions: [], // TODO: Get user permissions from database
        ipAddress,
        userAgent,
        loginMethod: 'password',
      });

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair({
        userId: user.id.value,
        email: user.email.value,
        roles: [],
        permissions: [],
        sessionId: session.sessionId,
      });

      this.logInfo('User logged in successfully', {
        userId: user.id.value,
        sessionId: session.sessionId,
        ipAddress,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: this.mapUserToDto(user),
        expiresIn: Math.floor(
          (tokenPair.expiresAt.getTime() - Date.now()) / 1000
        ),
        sessionId: session.sessionId,
      };
    });
  }

  /**
   * Register new user
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    return await this.executeWithMonitoring('register', async () => {
      // Validate input
      const validation = this.validateRegisterRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const email = new Email(request.email);

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.passwordService.hash(request.password);

      // Create user
      const user = User.create(
        UserId.create(crypto.randomUUID()),
        email,
        `${request.firstName} ${request.lastName}`,
        passwordHash,
        request.firstName,
        request.lastName
      );

      await this.userRepository.save(user);

      // Send verification email
      await this.sendEmailVerification(user);

      this.logInfo('User registered successfully', {
        userId: user.id.value,
        email: user.email.value,
      });

      // Create session for auto-login after registration
      const session = await this.sessionManager.createSession({
        userId: user.id.value,
        email: user.email.value,
        roles: [], // TODO: Get default user roles
        permissions: [], // TODO: Get default user permissions
        ipAddress: 'registration',
        userAgent: 'registration',
        loginMethod: 'password',
      });

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair({
        userId: user.id.value,
        email: user.email.value,
        roles: [],
        permissions: [],
        sessionId: session.sessionId,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: this.mapUserToDto(user),
        expiresIn: Math.floor(
          (tokenPair.expiresAt.getTime() - Date.now()) / 1000
        ),
        sessionId: session.sessionId,
      };
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return await this.executeWithMonitoring('refreshToken', async () => {
      // Verify refresh token
      const payload = this.jwtService.verifyRefreshToken(refreshToken);

      // Validate session
      const sessionResult = await this.sessionManager.validateSession(
        payload.sessionId
      );
      if (!sessionResult.isValid || !sessionResult.session) {
        throw new Error('Invalid session');
      }

      // Get user
      const user = await this.userRepository.findById(
        new UserId(payload.userId)
      );
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token using the existing refresh token
      const newAccessToken = this.jwtService.refreshAccessToken(refreshToken, {
        userId: user.id.value,
        email: user.email.value,
        roles: sessionResult.session.roles,
        permissions: sessionResult.session.permissions,
        sessionId: payload.sessionId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken, // Keep the same refresh token
        user: this.mapUserToDto(user),
        expiresIn: this.SESSION_DURATION / 1000,
        sessionId: payload.sessionId,
      };
    });
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<void> {
    return await this.executeWithMonitoring('logout', async () => {
      await this.sessionManager.invalidateSession(sessionId);

      this.logInfo('User logged out successfully', { sessionId });
    });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: UserId): Promise<void> {
    return await this.executeWithMonitoring('logoutAll', async () => {
      await this.sessionManager.invalidateAllUserSessions(userId.value);

      this.logInfo('User logged out from all devices', {
        userId: userId.value,
      });
    });
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(user: User): Promise<void> {
    return await this.executeWithMonitoring(
      'sendEmailVerification',
      async () => {
        const verificationToken =
          await this.jwtService.generateEmailVerificationToken(
            user.id.value,
            user.email.value
          );

        await this.emailService.sendEmailVerification({
          recipientEmail: user.email.value,
          recipientName: `${user.firstName} ${user.lastName}`,
          verificationUrl: `${process.env['APP_URL']}/auth/verify-email?token=${verificationToken}`,
        });

        this.logInfo('Email verification sent', {
          userId: user.id.value,
          email: user.email.value,
        });
      }
    );
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<void> {
    return await this.executeWithMonitoring('verifyEmail', async () => {
      const payload = await this.jwtService.verifyEmailVerificationToken(token);

      const user = await this.userRepository.findById(
        new UserId(payload.userId)
      );
      if (!user) {
        throw new Error('User not found');
      }

      if (user.email.value !== payload.email) {
        throw new Error('Email mismatch');
      }

      user.verifyEmail();
      await this.userRepository.save(user);

      this.logInfo('Email verified successfully', {
        userId: user.id.value,
        email: user.email.value,
      });
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    return await this.executeWithMonitoring('sendPasswordReset', async () => {
      const emailVO = new Email(email);
      const user = await this.userRepository.findByEmail(emailVO);

      if (!user) {
        // Don't reveal if email exists or not
        this.logInfo('Password reset requested for non-existent email', {
          email,
        });
        return;
      }

      const resetToken = await this.jwtService.generatePasswordResetToken(
        user.id.value,
        user.email.value
      );

      await this.emailService.sendPasswordReset({
        recipientEmail: user.email.value,
        recipientName: `${user.firstName} ${user.lastName}`,
        resetUrl: `${process.env['APP_URL']}/auth/reset-password?token=${resetToken}`,
      });

      this.logInfo('Password reset email sent', {
        userId: user.id.value,
        email: user.email.value,
      });
    });
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return await this.executeWithMonitoring('resetPassword', async () => {
      const payload = await this.jwtService.verifyPasswordResetToken(token);

      const user = await this.userRepository.findById(
        new UserId(payload.userId)
      );
      if (!user) {
        throw new Error('User not found');
      }

      // Validate new password
      const validation = this.validatePassword(newPassword);
      if (!validation.isValid) {
        throw new Error(
          `Password validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Hash new password
      const passwordHash = await this.passwordService.hash(newPassword);

      user.changePassword(passwordHash);
      await this.userRepository.save(user);

      // Invalidate all sessions
      await this.logoutAll(user.id);

      this.logInfo('Password reset successfully', {
        userId: user.id.value,
      });
    });
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: UserId): Promise<SessionInfo[]> {
    const sessions = await this.sessionManager.getActiveUserSessions(
      userId.value
    );
    return sessions.map(session => ({
      userId: session.userId,
      sessionId: session.sessionId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      isActive: session.isActive,
    }));
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateOAuthUrl(
    provider: string,
    redirectUri?: string,
    state?: string
  ): Promise<{ url: string; state: string }> {
    return await this.executeWithMonitoring('generateOAuthUrl', async () => {
      const result = await this.oauthService.generateAuthorizationUrl({
        provider,
        redirectUri: redirectUri || '',
        state: state || crypto.randomUUID(),
      });

      this.logInfo('OAuth authorization URL generated', {
        provider,
        state: result.state,
      });

      return {
        url: result.url,
        state: result.state,
      };
    });
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    return await this.executeWithMonitoring('handleOAuthCallback', async () => {
      // Exchange code for token
      const tokenResponse = await this.oauthService.exchangeCodeForToken({
        provider,
        code,
        state,
      });

      // Get user info from provider
      const userInfo = await this.oauthService.getUserInfo(
        provider,
        tokenResponse.accessToken
      );

      // Find or create user
      let user = await this.userRepository.findByEmail(
        new Email(userInfo.email)
      );

      if (!user) {
        // Create new user from OAuth data
        user = User.create(
          UserId.create(crypto.randomUUID()),
          new Email(userInfo.email),
          userInfo.name,
          '', // OAuth users don't have passwords
          userInfo.firstName || userInfo.name.split(' ')[0] || '',
          userInfo.lastName ||
            userInfo.name.split(' ').slice(1).join(' ') ||
            ''
        );

        user.verifyEmail(); // OAuth users are automatically verified // OAuth emails are typically verified
        await this.userRepository.save(user);
      }

      // Create session
      const session = await this.sessionManager.createSession({
        userId: user.id.value,
        email: user.email.value,
        roles: [], // TODO: Get user roles
        permissions: [], // TODO: Get user permissions
        ipAddress,
        userAgent,
        loginMethod: 'oauth',
        metadata: {
          provider,
          providerUserId: userInfo.providerUserId,
        },
      });

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair({
        userId: user.id.value,
        email: user.email.value,
        roles: [],
        permissions: [],
        sessionId: session.sessionId,
      });

      this.logInfo('OAuth login successful', {
        userId: user.id.value,
        provider,
        sessionId: session.sessionId,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: this.mapUserToDto(user),
        expiresIn: Math.floor(
          (tokenPair.expiresAt.getTime() - Date.now()) / 1000
        ),
        sessionId: session.sessionId,
      };
    });
  }

  /**
   * Setup Two-Factor Authentication
   */
  async setup2FA(userId: string, userEmail: string): Promise<TwoFactorSetup> {
    return await this.executeWithMonitoring('setup2FA', async () => {
      const setup = await this.twoFactorService.generateSetup(
        userId,
        userEmail
      );

      this.logInfo('2FA setup initiated', {
        userId,
        userEmail,
      });

      return setup;
    });
  }

  /**
   * Enable Two-Factor Authentication
   */
  async enable2FA(
    userId: string,
    token: string,
    method: '2fa' | 'sms' | 'email' = '2fa'
  ): Promise<{ backupCodes: string[] }> {
    return await this.executeWithMonitoring('enable2FA', async () => {
      const result = await this.twoFactorService.enableTwoFactor(
        userId,
        token,
        method
      );

      this.logInfo('2FA enabled successfully', {
        userId,
        method,
      });

      return result;
    });
  }

  /**
   * Verify Two-Factor Authentication token
   */
  async verify2FA(
    userId: string,
    token: string,
    allowBackupCode: boolean = true
  ): Promise<{
    isValid: boolean;
    usedBackupCode?: boolean;
    remainingBackupCodes?: number;
  }> {
    return await this.executeWithMonitoring('verify2FA', async () => {
      const result = await this.twoFactorService.verifyToken(
        userId,
        token,
        allowBackupCode
      );

      if (result.isValid) {
        this.logInfo('2FA verification successful', {
          userId,
          usedBackupCode: result.usedBackupCode,
        });
      } else {
        this.logWarning('2FA verification failed', {
          userId,
          rateLimited: result.rateLimited,
        });
      }

      return result;
    });
  }

  /**
   * Disable Two-Factor Authentication
   */
  async disable2FA(userId: string, verificationToken: string): Promise<void> {
    return await this.executeWithMonitoring('disable2FA', async () => {
      await this.twoFactorService.disableTwoFactor(userId, verificationToken);

      this.logInfo('2FA disabled successfully', {
        userId,
      });
    });
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(
    userId: string,
    verificationToken: string
  ): Promise<string[]> {
    return await this.executeWithMonitoring(
      'generateNewBackupCodes',
      async () => {
        const codes = await this.twoFactorService.generateNewBackupCodes(
          userId,
          verificationToken
        );

        this.logInfo('New backup codes generated', {
          userId,
          codeCount: codes.length,
        });

        return codes;
      }
    );
  }

  /**
   * Get Two-Factor Authentication status
   */
  async get2FAStatus(userId: string): Promise<{
    isEnabled: boolean;
    method: '2fa' | 'sms' | 'email' | null;
    backupCodesRemaining: number;
    lastUsed?: Date;
    setupDate?: Date;
  }> {
    return await this.executeWithMonitoring('get2FAStatus', async () => {
      return await this.twoFactorService.getTwoFactorStatus(userId);
    });
  }

  /**
   * Send SMS verification code
   */
  async sendSMSCode(userId: string, phoneNumber: string): Promise<void> {
    return await this.executeWithMonitoring('sendSMSCode', async () => {
      await this.twoFactorService.sendSMSCode({
        userId,
        phoneNumber,
      });

      this.logInfo('SMS verification code sent', {
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });
    });
  }

  /**
   * Send email verification code
   */
  async sendEmailCode(userId: string, email: string): Promise<void> {
    return await this.executeWithMonitoring('sendEmailCode', async () => {
      await this.twoFactorService.sendEmailCode({
        userId,
        email,
      });

      this.logInfo('Email verification code sent', {
        userId,
        email: this.maskEmail(email),
      });
    });
  }

  // Private helper methods
  private validateLoginRequest(request: LoginRequest): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('email', 'Email'),
      new RequiredFieldValidationRule('password', 'Password'),
    ]);
  }

  private validateRegisterRequest(request: RegisterRequest): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('email', 'Email'),
      new RequiredFieldValidationRule('password', 'Password'),
      new RequiredFieldValidationRule('firstName', 'First Name'),
      new RequiredFieldValidationRule('lastName', 'Last Name'),
      new LengthValidationRule('firstName', 1, 50, 'First Name'),
      new LengthValidationRule('lastName', 1, 50, 'Last Name'),
    ]);
  }

  private validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async checkAccountLockout(email: Email): Promise<void> {
    const lockoutKey = `lockout:${email.value}`;
    const lockoutInfo = await this.cacheService.get<{ lockedUntil: number }>(
      lockoutKey
    );

    if (lockoutInfo && Date.now() < lockoutInfo.lockedUntil) {
      const remainingTime = Math.ceil(
        (lockoutInfo.lockedUntil - Date.now()) / 1000 / 60
      );
      throw new Error(
        `Account is locked. Try again in ${remainingTime} minutes.`
      );
    }
  }

  private async recordFailedLoginAttempt(
    email: Email,
    ipAddress: string
  ): Promise<void> {
    const attemptsKey = `login-attempts:${email.value}`;
    const attempts = (await this.cacheService.get<number>(attemptsKey)) || 0;
    const newAttempts = attempts + 1;

    await this.cacheService.set(
      attemptsKey,
      newAttempts,
      this.LOCKOUT_DURATION / 1000
    );

    if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      const lockoutKey = `lockout:${email.value}`;
      await this.cacheService.set(
        lockoutKey,
        {
          lockedUntil: Date.now() + this.LOCKOUT_DURATION,
        },
        this.LOCKOUT_DURATION / 1000
      );

      this.logWarning('Account locked due to too many failed login attempts', {
        email: email.value,
        ipAddress,
        attempts: newAttempts,
      });
    }
  }

  private async clearFailedLoginAttempts(email: Email): Promise<void> {
    const attemptsKey = `login-attempts:${email.value}`;
    const lockoutKey = `lockout:${email.value}`;

    await this.cacheService.delete(attemptsKey);
    await this.cacheService.delete(lockoutKey);
  }

  /**
   * Complete 2FA login process
   */
  async complete2FALogin(
    twoFactorToken: string,
    verificationCode: string,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    return await this.executeWithMonitoring('complete2FALogin', async () => {
      // Verify 2FA token
      const userId = await this.verifyTwoFactorToken(twoFactorToken);
      if (!userId) {
        throw new Error('Invalid or expired 2FA token');
      }

      // Verify 2FA code
      const verification = await this.twoFactorService.verifyToken(
        userId,
        verificationCode
      );
      if (!verification.isValid) {
        throw new Error('Invalid 2FA verification code');
      }

      // Get user
      const user = await this.userRepository.findById(new UserId(userId));
      if (!user) {
        throw new Error('User not found');
      }

      // Create session
      const session = await this.sessionManager.createSession({
        userId: user.id.value,
        email: user.email.value,
        roles: [], // TODO: Get user roles from database
        permissions: [], // TODO: Get user permissions from database
        ipAddress,
        userAgent,
        loginMethod: '2fa',
      });

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair({
        userId: user.id.value,
        email: user.email.value,
        roles: [],
        permissions: [],
        sessionId: session.sessionId,
      });

      // Clean up 2FA token
      await this.removeTwoFactorToken(userId);

      this.logInfo('2FA login completed successfully', {
        userId: user.id.value,
        sessionId: session.sessionId,
        ipAddress,
        usedBackupCode: verification.usedBackupCode,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: this.mapUserToDto(user),
        expiresIn: Math.floor(
          (tokenPair.expiresAt.getTime() - Date.now()) / 1000
        ),
        sessionId: session.sessionId,
      };
    });
  }

  private generateTwoFactorToken(userId: string): string {
    return Buffer.from(
      `${userId}_${Date.now()}_${Math.random().toString(36)}`
    ).toString('base64url');
  }

  private async storeTwoFactorToken(
    userId: string,
    token: string
  ): Promise<void> {
    const key = `2fa-login-token:${token}`;
    await this.cacheService.set(key, userId, { ttl: 300 }); // 5 minutes
  }

  private async verifyTwoFactorToken(token: string): Promise<string | null> {
    const key = `2fa-login-token:${token}`;
    return await this.cacheService.get<string>(key);
  }

  private async removeTwoFactorToken(_userId: string): Promise<void> {
    // Find and remove all tokens for this user
    // This is a simplified implementation
    // In production, you might want to maintain a user->token mapping
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return phoneNumber;
    return phoneNumber.slice(0, -4).replace(/\d/g, '*') + phoneNumber.slice(-4);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || local.length <= 2) return email;
    return local.slice(0, 2) + '*'.repeat(local.length - 2) + '@' + domain;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserDto> {
    return await this.executeWithMonitoring('getProfile', async () => {
      const userIdObj = new UserId(userId);
      const user = await this.userRepository.findById(userIdObj);
      if (!user) {
        throw new Error('User not found');
      }
      return this.mapUserToDto(user);
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateData: Partial<UserDto>): Promise<UserDto> {
    return await this.executeWithMonitoring('updateProfile', async () => {
      const userIdObj = new UserId(userId);
      const user = await this.userRepository.findById(userIdObj);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user profile
      const newName = `${updateData.firstName || user.firstName} ${updateData.lastName || user.lastName}`.trim();
      const newEmail = updateData.email ? new Email(updateData.email) : undefined;
      
      user.updateProfile(newName, newEmail);

      await this.userRepository.save(user);
      return this.mapUserToDto(user);
    });
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    return await this.executeWithMonitoring('changePassword', async () => {
      const userIdObj = new UserId(userId);
      const user = await this.userRepository.findById(userIdObj);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await this.passwordService.verify(
        currentPassword,
        user.passwordHash
      );
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password and update
      const newPasswordHash = await this.passwordService.hash(newPassword);
      user.updatePassword(newPasswordHash);

      await this.userRepository.save(user);
    });
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string): Promise<void> {
    return await this.executeWithMonitoring('deactivateAccount', async () => {
      const userIdObj = new UserId(userId);
      const user = await this.userRepository.findById(userIdObj);
      if (!user) {
        throw new Error('User not found');
      }

      user.deactivate();
      await this.userRepository.save(user);

      // Invalidate all sessions
      await this.logoutAll(userIdObj);
    });
  }

  /**
   * Activate user account
   */
  async activateAccount(userId: string): Promise<void> {
    return await this.executeWithMonitoring('activateAccount', async () => {
      const userIdObj = new UserId(userId);
      const user = await this.userRepository.findById(userIdObj);
      if (!user) {
        throw new Error('User not found');
      }

      user.activate();
      await this.userRepository.save(user);
    });
  }

  private mapUserToDto(user: User): UserDto {
    return {
      id: user.id.value,
      email: user.email.value,
      username: user.name, // using name as username
      firstName: user.firstName,
      lastName: user.lastName,
      ...(user.avatar && { avatar: user.avatar }),
      isActive: user.isActive(),
      role: 'user', // default role
      ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt }),
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
