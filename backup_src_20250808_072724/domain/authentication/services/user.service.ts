import { eq, and, ilike, isNull, isNotNull, gte, lte } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ConflictError, ValidationError, ForbiddenError } from './base.service';
import { userRepository } from '../db/repositories';
import { User, NewUser } from '../db/schema/users';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  language: string;
  timezone?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  role: string;
  isEmailVerified: boolean;
  preferences: UserPreferences;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  adminUsers: number;
  recentSignups: number;
  loginActivity: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export interface UserSearchFilters {
  role?: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
}

export class UserService extends BaseService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private readonly REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  private readonly BCRYPT_ROUNDS = 12;

  constructor() {
    super('UserService', {
      enableCache: true,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Authentication Methods
  async register(data: RegisterData, context?: ServiceContext): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    const ctx = this.createContext(context);
    this.logOperation('register', ctx, { email: data.email, username: data.username });

    try {
      // Validate input
      this.validateRegistrationData(data);

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      const existingUsername = await userRepository.findByUsername(data.username);
      if (existingUsername) {
        throw new ConflictError('Username is already taken');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const newUser: NewUser = {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        emailVerificationToken,
        role: 'user',
        isEmailVerified: false,
        preferences: {
          theme: 'system',
          notifications: true,
          language: 'en'
        }
      };

      const user = await userRepository.create(newUser);

      // Generate tokens
      const tokens = await this.generateTokens(user.id);

      // Record metrics
      await this.recordMetric('user.registered', 1, { role: user.role });

      return {
        user: this.mapToUserProfile(user),
        tokens
      };
    } catch (error) {
      this.handleError(error, 'register', ctx);
    }
  }

  async login(credentials: LoginCredentials, context?: ServiceContext): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    const ctx = this.createContext(context);
    this.logOperation('login', ctx, { email: credentials.email });

    try {
      // Find user by email
      const user = await userRepository.findByEmail(credentials.email.toLowerCase());
      if (!user) {
        throw new NotFoundError('User', 'with provided credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new ValidationError('Invalid credentials');
      }

      // Update last login
      await userRepository.updateLastLogin(user.id);

      // Generate tokens
      const tokens = await this.generateTokens(user.id);

      // Record metrics
      await this.recordMetric('user.login', 1, { role: user.role });

      return {
        user: this.mapToUserProfile(user),
        tokens
      };
    } catch (error) {
      this.handleError(error, 'login', ctx);
    }
  }

  async refreshToken(refreshToken: string, context?: ServiceContext): Promise<AuthTokens> {
    const ctx = this.createContext(context);
    this.logOperation('refreshToken', ctx);

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.JWT_SECRET) as any;
      const userId = decoded.userId;

      // Check if user still exists
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Generate new tokens
      return await this.generateTokens(userId);
    } catch (error) {
      this.handleError(error, 'refreshToken', ctx);
    }
  }

  async logout(userId: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext({ ...context, userId });
    this.logOperation('logout', ctx);

    try {
      // In a real implementation, you might want to blacklist the token
      // or store logout timestamp
      await this.recordMetric('user.logout', 1);
    } catch (error) {
      this.handleError(error, 'logout', ctx);
    }
  }

  // User Management Methods
  async getUserById(id: string, context?: ServiceContext): Promise<UserProfile> {
    const ctx = this.createContext(context);
    this.logOperation('getUserById', ctx, { targetUserId: id });

    try {
      const user = await userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      return this.mapToUserProfile(user);
    } catch (error) {
      this.handleError(error, 'getUserById', ctx);
    }
  }

  async getUserProfile(userId: string, context?: ServiceContext): Promise<UserProfile> {
    const ctx = this.createContext({ ...context, userId });
    this.logOperation('getUserProfile', ctx);

    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      return this.mapToUserProfile(user);
    } catch (error) {
      this.handleError(error, 'getUserProfile', ctx);
    }
  }

  async updateProfile(
    userId: string, 
    updates: Partial<Pick<User, 'firstName' | 'lastName' | 'avatar'>>,
    context?: ServiceContext
  ): Promise<UserProfile> {
    const ctx = this.createContext({ ...context, userId });
    this.logOperation('updateProfile', ctx, updates);

    try {
      const updatedUser = await userRepository.update(userId, updates);
      if (!updatedUser) {
        throw new NotFoundError('User', userId);
      }

      await this.recordMetric('user.profile.updated', 1);

      return this.mapToUserProfile(updatedUser);
    } catch (error) {
      this.handleError(error, 'updateProfile', ctx);
    }
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
    context?: ServiceContext
  ): Promise<UserProfile> {
    const ctx = this.createContext({ ...context, userId });
    this.logOperation('updatePreferences', ctx, preferences);

    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const updatedPreferences = {
        ...(user.preferences as Record<string, any>),
        ...preferences
      };

      const updatedUser = await userRepository.updatePreferences(userId, updatedPreferences);
      if (!updatedUser) {
        throw new NotFoundError('User', userId);
      }

      return this.mapToUserProfile(updatedUser);
    } catch (error) {
      this.handleError(error, 'updatePreferences', ctx);
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext({ ...context, userId });
    this.logOperation('changePassword', ctx);

    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new ValidationError('Current password is incorrect');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

      // Update password
      await userRepository.update(userId, { passwordHash: newPasswordHash });

      await this.recordMetric('user.password.changed', 1);
    } catch (error) {
      this.handleError(error, 'changePassword', ctx);
    }
  }

  // Email Verification
  async sendVerificationEmail(userId: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext({ ...context, userId });
    this.logOperation('sendVerificationEmail', ctx);

    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      if (user.isEmailVerified) {
        throw new ValidationError('Email is already verified');
      }

      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      await userRepository.update(userId, { emailVerificationToken });

      // In a real implementation, send email here
      console.log(`Verification email sent to ${user.email} with token: ${emailVerificationToken}`);

      await this.recordMetric('user.verification.email.sent', 1);
    } catch (error) {
      this.handleError(error, 'sendVerificationEmail', ctx);
    }
  }

  async verifyEmail(token: string, context?: ServiceContext): Promise<UserProfile> {
    const ctx = this.createContext(context);
    this.logOperation('verifyEmail', ctx);

    try {
      const user = await userRepository.findByEmailVerificationToken(token);
      if (!user) {
        throw new ValidationError('Invalid or expired verification token');
      }

      const verifiedUser = await userRepository.verifyEmail(user.id);
      if (!verifiedUser) {
        throw new NotFoundError('User', user.id);
      }

      await this.recordMetric('user.email.verified', 1);

      return this.mapToUserProfile(verifiedUser);
    } catch (error) {
      this.handleError(error, 'verifyEmail', ctx);
    }
  }

  // Password Reset
  async requestPasswordReset(email: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('requestPasswordReset', ctx, { email });

    try {
      const user = await userRepository.findByEmail(email.toLowerCase());
      if (!user) {
        // Don't reveal if email exists or not
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      await userRepository.setPasswordResetToken(user.id, resetToken, resetExpires);

      // In a real implementation, send email here
      console.log(`Password reset email sent to ${email} with token: ${resetToken}`);

      await this.recordMetric('user.password.reset.requested', 1);
    } catch (error) {
      this.handleError(error, 'requestPasswordReset', ctx);
    }
  }

  async resetPassword(token: string, newPassword: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('resetPassword', ctx);

    try {
      const user = await userRepository.findByPasswordResetToken(token);
      if (!user) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

      // Update password and clear reset token
      await userRepository.update(user.id, { passwordHash });
      await userRepository.clearPasswordResetToken(user.id);

      await this.recordMetric('user.password.reset.completed', 1);
    } catch (error) {
      this.handleError(error, 'resetPassword', ctx);
    }
  }

  // Admin Methods
  async getUsers(
    options: PaginationOptions & UserSearchFilters,
    context?: ServiceContext
  ): Promise<PaginatedResult<UserProfile>> {
    const ctx = this.createContext(context);
    this.logOperation('getUsers', ctx, options);

    try {
      this.requireAdminRole(ctx);

      const paginationOptions = this.validatePagination(options);
      const result = await userRepository.findMany(paginationOptions);

      return {
        ...result,
        data: result.data.map(user => this.mapToUserProfile(user))
      };
    } catch (error) {
      this.handleError(error, 'getUsers', ctx);
    }
  }

  async searchUsers(
    query: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<UserProfile>> {
    const ctx = this.createContext(context);
    this.logOperation('searchUsers', ctx, { query, ...options });

    try {
      const paginationOptions = this.validatePagination(options);
      const result = await userRepository.search({ query, ...paginationOptions });

      return {
        ...result,
        data: result.data.map(user => this.mapToUserProfile(user))
      };
    } catch (error) {
      this.handleError(error, 'searchUsers', ctx);
    }
  }

  async changeUserRole(
    targetUserId: string,
    newRole: 'admin' | 'user',
    context?: ServiceContext
  ): Promise<UserProfile> {
    const ctx = this.createContext(context);
    this.logOperation('changeUserRole', ctx, { targetUserId, newRole });

    try {
      this.requireAdminRole(ctx);

      const updatedUser = await userRepository.changeRole(targetUserId, newRole);
      if (!updatedUser) {
        throw new NotFoundError('User', targetUserId);
      }

      await this.recordMetric('user.role.changed', 1, { newRole });

      return this.mapToUserProfile(updatedUser);
    } catch (error) {
      this.handleError(error, 'changeUserRole', ctx);
    }
  }

  async deactivateUser(targetUserId: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deactivateUser', ctx, { targetUserId });

    try {
      this.requireAdminRole(ctx);

      // In a real implementation, you might have an isActive field
      // For now, we'll use soft delete
      const success = await userRepository.softDelete(targetUserId);
      if (!success) {
        throw new NotFoundError('User', targetUserId);
      }

      await this.recordMetric('user.deactivated', 1);
    } catch (error) {
      this.handleError(error, 'deactivateUser', ctx);
    }
  }

  async getUserStats(context?: ServiceContext): Promise<UserStats> {
    const ctx = this.createContext(context);
    this.logOperation('getUserStats', ctx);

    try {
      this.requireAdminRole(ctx);

      const stats = await userRepository.getUserStats();

      // Calculate additional stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        totalUsers: stats.total,
        activeUsers: stats.total - 0, // Assuming no soft-deleted users for now
        verifiedUsers: stats.verified,
        adminUsers: stats.admins,
        recentSignups: 0, // Would need to implement date filtering
        loginActivity: {
          today: 0, // Would need to implement login tracking
          thisWeek: 0,
          thisMonth: 0
        }
      };
    } catch (error) {
      this.handleError(error, 'getUserStats', ctx);
    }
  }

  // Private Helper Methods
  private async generateTokens(userId: string): Promise<AuthTokens> {
    const payload = { userId, type: 'access' };
    const refreshPayload = { userId, type: 'refresh' };
    
    const accessToken = (jwt as any).sign(
      payload,
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );

    const refreshToken = (jwt as any).sign(
      refreshPayload,
      this.JWT_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRES_IN }
    );

    // Parse expiration time
    const expiresIn = this.parseExpirationTime(this.JWT_EXPIRES_IN);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  private parseExpirationTime(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 24 * 60 * 60; // Default to 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }

  private mapToUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar || undefined,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      preferences: user.preferences as UserPreferences,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt
    };
  }

  private validateRegistrationData(data: RegisterData): void {
    if (!data.email || !data.email.includes('@')) {
      throw new ValidationError('Valid email is required');
    }
    if (!data.username || data.username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters');
    }
    if (!data.firstName || data.firstName.trim().length === 0) {
      throw new ValidationError('First name is required');
    }
    if (!data.lastName || data.lastName.trim().length === 0) {
      throw new ValidationError('Last name is required');
    }
    this.validatePassword(data.password);
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new ValidationError('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }
  }

  private requireAdminRole(context: ServiceContext): void {
    if (context.userRole !== 'admin') {
      throw new ForbiddenError('Admin role required');
    }
  }
}

// Export singleton instance
export const userService = new UserService();
