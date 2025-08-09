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
import { JWTService } from '../../infrastructure/security/jwt-service';
import { PasswordService } from '../../infrastructure/security/password-service';
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
}

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  private readonly REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JWTService,
    private readonly passwordService: PasswordService,
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

      // Create session
      const sessionId = await this.createSession(user.id, ipAddress, userAgent);

      // Generate tokens
      const accessToken = await this.jwtService.generateAccessToken({
        userId: user.id.value,
        sessionId,
        email: user.email.value,
      });

      const refreshToken = await this.jwtService.generateRefreshToken({
        userId: user.id.value,
        sessionId,
      });

      // Store refresh token
      await this.storeRefreshToken(user.id, sessionId, refreshToken);

      this.logInfo('User logged in successfully', {
        userId: user.id.value,
        sessionId,
        ipAddress,
      });

      return {
        accessToken,
        refreshToken,
        user: this.mapUserToDto(user),
        expiresIn: this.SESSION_DURATION / 1000,
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
      const user = User.create({
        email,
        passwordHash,
        firstName: request.firstName,
        lastName: request.lastName,
      });

      await this.userRepository.save(user);

      // Send verification email
      await this.sendEmailVerification(user);

      this.logInfo('User registered successfully', {
        userId: user.id.value,
        email: user.email.value,
      });

      // Auto-login after registration
      return await this.login(
        {
          email: request.email,
          password: request.password,
        },
        'registration',
        'registration'
      );
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return await this.executeWithMonitoring('refreshToken', async () => {
      // Verify refresh token
      const payload = await this.jwtService.verifyRefreshToken(refreshToken);

      // Check if refresh token is still valid
      const storedToken = await this.getStoredRefreshToken(
        new UserId(payload.userId),
        payload.sessionId
      );
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findById(
        new UserId(payload.userId)
      );
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token
      const accessToken = await this.jwtService.generateAccessToken({
        userId: user.id.value,
        sessionId: payload.sessionId,
        email: user.email.value,
      });

      // Update session activity
      await this.updateSessionActivity(payload.sessionId);

      return {
        accessToken,
        refreshToken, // Keep the same refresh token
        user: this.mapUserToDto(user),
        expiresIn: this.SESSION_DURATION / 1000,
      };
    });
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<void> {
    return await this.executeWithMonitoring('logout', async () => {
      // Invalidate session
      await this.invalidateSession(sessionId);

      // Remove refresh token
      await this.removeRefreshToken(sessionId);

      this.logInfo('User logged out successfully', { sessionId });
    });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: UserId): Promise<void> {
    return await this.executeWithMonitoring('logoutAll', async () => {
      // Get all user sessions
      const sessions = await this.getUserSessions(userId);

      // Invalidate all sessions
      for (const session of sessions) {
        await this.invalidateSession(session.sessionId);
        await this.removeRefreshToken(session.sessionId);
      }

      this.logInfo('User logged out from all devices', {
        userId: userId.value,
        sessionCount: sessions.length,
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
          await this.jwtService.generateEmailVerificationToken({
            userId: user.id.value,
            email: user.email.value,
          });

        await this.emailService.sendEmailVerification({
          recipientEmail: user.email.value,
          recipientName: `${user.firstName} ${user.lastName}`,
          verificationLink: `${process.env.APP_URL}/auth/verify-email?token=${verificationToken}`,
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

      const resetToken = await this.jwtService.generatePasswordResetToken({
        userId: user.id.value,
        email: user.email.value,
      });

      await this.emailService.sendPasswordReset({
        recipientEmail: user.email.value,
        recipientName: `${user.firstName} ${user.lastName}`,
        resetLink: `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`,
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
    const cacheKey = `user-sessions:${userId.value}`;
    const sessions =
      (await this.cacheService.get<SessionInfo[]>(cacheKey)) || [];
    return sessions.filter(s => s.isActive);
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

  private async createSession(
    userId: UserId,
    ipAddress: string,
    userAgent: string
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: SessionInfo = {
      userId: userId.value,
      sessionId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
    };

    // Store session
    const sessionKey = `session:${sessionId}`;
    await this.cacheService.set(
      sessionKey,
      session,
      this.SESSION_DURATION / 1000
    );

    // Add to user sessions list
    const userSessionsKey = `user-sessions:${userId.value}`;
    const userSessions =
      (await this.cacheService.get<SessionInfo[]>(userSessionsKey)) || [];
    userSessions.push(session);
    await this.cacheService.set(
      userSessionsKey,
      userSessions,
      this.REFRESH_TOKEN_DURATION / 1000
    );

    return sessionId;
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    const session = await this.cacheService.get<SessionInfo>(sessionKey);

    if (session) {
      session.lastActivity = new Date();
      await this.cacheService.set(
        sessionKey,
        session,
        this.SESSION_DURATION / 1000
      );
    }
  }

  private async invalidateSession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await this.cacheService.delete(sessionKey);
  }

  private async storeRefreshToken(
    userId: UserId,
    sessionId: string,
    refreshToken: string
  ): Promise<void> {
    const tokenKey = `refresh-token:${sessionId}`;
    await this.cacheService.set(
      tokenKey,
      refreshToken,
      this.REFRESH_TOKEN_DURATION / 1000
    );
  }

  private async getStoredRefreshToken(
    userId: UserId,
    sessionId: string
  ): Promise<string | null> {
    const tokenKey = `refresh-token:${sessionId}`;
    return await this.cacheService.get<string>(tokenKey);
  }

  private async removeRefreshToken(sessionId: string): Promise<void> {
    const tokenKey = `refresh-token:${sessionId}`;
    await this.cacheService.delete(tokenKey);
  }

  private mapUserToDto(user: User): UserDto {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
