/**
 * Two-Factor Authentication Service
 *
 * Handles TOTP (Time-based One-Time Password) and SMS-based 2FA
 * Supports backup codes and recovery options
 */

import { ValidationError } from '@taskmanagement/validation';
import * as qrcode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';
import { CacheService } from '../caching/cache-service';
import { EmailService } from '../external-services/email-service';
import { LoggingService } from '../monitoring/logging-service';

export interface TwoFactorConfig {
  issuer: string;
  serviceName: string;
  tokenWindow: number; // Number of time steps to allow
  backupCodeCount: number;
  backupCodeLength: number;
  rateLimitAttempts: number;
  rateLimitWindow: number; // in seconds
  smsProvider?: 'twilio' | 'aws-sns' | 'custom';
  smsConfig?: Record<string, any>;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface TwoFactorVerification {
  isValid: boolean;
  usedBackupCode?: boolean;
  remainingBackupCodes?: number;
  rateLimited?: boolean;
  attemptsRemaining?: number;
}

export interface BackupCodeInfo {
  codes: string[];
  usedCodes: string[];
  remainingCount: number;
  generatedAt: Date;
}

export interface TwoFactorStatus {
  isEnabled: boolean;
  method: '2fa' | 'sms' | 'email' | null;
  backupCodesRemaining: number;
  lastUsed?: Date;
  setupDate?: Date;
}

export interface SMSVerificationRequest {
  phoneNumber: string;
  userId: string;
}

export interface EmailVerificationRequest {
  email: string;
  userId: string;
}

export class TwoFactorAuthService {
  private readonly defaultConfig: TwoFactorConfig = {
    issuer: 'Enterprise Platform',
    serviceName: 'Enterprise Platform',
    tokenWindow: 1, // Allow 1 time step before and after current
    backupCodeCount: 10,
    backupCodeLength: 8,
    rateLimitAttempts: 5,
    rateLimitWindow: 300, // 5 minutes
  };

  constructor(
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly config: Partial<TwoFactorConfig> = {}
  ) {}

  /**
   * Generate 2FA setup for a user
   */
  async generateSetup(userId: string, userEmail: string): Promise<TwoFactorSetup> {
    try {
      const finalConfig = { ...this.defaultConfig, ...this.config };

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${finalConfig.serviceName} (${userEmail})`,
        issuer: finalConfig.issuer,
        length: 32,
      });

      // Generate QR code URL
      const qrCodeUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: `${finalConfig.serviceName}:${userEmail}`,
        issuer: finalConfig.issuer,
        algorithm: 'sha1',
        digits: 6,
        period: 30,
      });

      // Generate QR code data URL
      const qrCodeDataUrl = await qrcode.toDataURL(qrCodeUrl);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes(
        finalConfig.backupCodeCount,
        finalConfig.backupCodeLength
      );

      // Store setup temporarily (user needs to verify before enabling)
      await this.storeTempSetup(userId, {
        secret: secret.base32,
        backupCodes,
        setupDate: new Date(),
      });

      this.logger.info('2FA setup generated', {
        userId,
        userEmail,
      });

      return {
        secret: secret.base32,
        qrCodeUrl,
        qrCodeDataUrl,
        backupCodes,
        manualEntryKey: secret.base32,
      };
    } catch (error) {
      this.logger.error('Failed to generate 2FA setup', error as Error, {
        userId,
        userEmail,
      });
      throw new InfrastructureError(
        `Failed to generate 2FA setup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify and enable 2FA for a user
   */
  async enableTwoFactor(
    userId: string,
    token: string,
    method: '2fa' | 'sms' | 'email' = '2fa'
  ): Promise<{ backupCodes: string[] }> {
    try {
      const tempSetup = await this.getTempSetup(userId);
      if (!tempSetup) {
        throw ValidationError.forField('setup', 'No pending 2FA setup found');
      }

      // Verify the token
      const isValid = speakeasy.totp.verify({
        secret: tempSetup.secret,
        token,
        window: this.getConfig().tokenWindow,
        algorithm: 'sha1',
        digits: 6,
        step: 30,
      });

      if (!isValid) {
        throw ValidationError.forField('token', 'Invalid verification token');
      }

      // Enable 2FA
      await this.store2FAConfig(userId, {
        secret: tempSetup.secret,
        method,
        backupCodes: tempSetup.backupCodes,
        usedBackupCodes: [],
        isEnabled: true,
        setupDate: new Date(),
      });

      // Clean up temporary setup
      await this.removeTempSetup(userId);

      this.logger.info('2FA enabled successfully', {
        userId,
        method,
      });

      return {
        backupCodes: tempSetup.backupCodes,
      };
    } catch (error) {
      this.logger.error('Failed to enable 2FA', error as Error, {
        userId,
        method,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to enable 2FA: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify 2FA token
   */
  async verifyToken(
    userId: string,
    token: string,
    allowBackupCode: boolean = true
  ): Promise<TwoFactorVerification> {
    try {
      // Check rate limiting
      const rateLimitResult = await this.checkRateLimit(userId);
      if (rateLimitResult.isLimited) {
        return {
          isValid: false,
          rateLimited: true,
          attemptsRemaining: rateLimitResult.attemptsRemaining,
        };
      }

      const config = await this.get2FAConfig(userId);
      if (!config || !config.isEnabled) {
        throw ValidationError.forField('user', '2FA is not enabled for this user');
      }

      // Try TOTP verification first
      const isValidTOTP = speakeasy.totp.verify({
        secret: config.secret,
        token,
        window: this.getConfig().tokenWindow,
        algorithm: 'sha1',
        digits: 6,
        step: 30,
      });

      if (isValidTOTP) {
        await this.clearRateLimit(userId);
        await this.updateLastUsed(userId);

        this.logger.info('2FA token verified successfully', {
          userId,
          method: 'totp',
        });

        return {
          isValid: true,
          usedBackupCode: false,
        };
      }

      // Try backup code if TOTP failed and backup codes are allowed
      if (allowBackupCode && this.isBackupCode(token)) {
        const backupResult = await this.verifyBackupCode(userId, token);
        if (backupResult.isValid) {
          await this.clearRateLimit(userId);
          await this.updateLastUsed(userId);

          this.logger.info('2FA backup code verified successfully', {
            userId,
            remainingCodes: backupResult.remainingBackupCodes,
          });

          return backupResult;
        }
      }

      // Record failed attempt
      await this.recordFailedAttempt(userId);

      this.logger.warn('2FA verification failed', {
        userId,
        tokenLength: token.length,
      });

      return {
        isValid: false,
        usedBackupCode: false,
      };
    } catch (error) {
      this.logger.error('Failed to verify 2FA token', error as Error, {
        userId,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to verify 2FA token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disableTwoFactor(userId: string, verificationToken: string): Promise<void> {
    try {
      // Verify current token before disabling
      const verification = await this.verifyToken(userId, verificationToken);
      if (!verification.isValid) {
        throw new AuthorizationError('Invalid verification token');
      }

      // Remove 2FA configuration
      await this.remove2FAConfig(userId);

      this.logger.info('2FA disabled successfully', {
        userId,
      });
    } catch (error) {
      this.logger.error('Failed to disable 2FA', error as Error, {
        userId,
      });

      if (error instanceof AuthorizationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to disable 2FA: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId: string, verificationToken: string): Promise<string[]> {
    try {
      // Verify current token before generating new codes
      const verification = await this.verifyToken(userId, verificationToken);
      if (!verification.isValid) {
        throw new AuthorizationError('Invalid verification token');
      }

      const config = await this.get2FAConfig(userId);
      if (!config) {
        throw ValidationError.forField('user', '2FA is not enabled for this user');
      }

      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes(
        this.getConfig().backupCodeCount,
        this.getConfig().backupCodeLength
      );

      // Update configuration
      config.backupCodes = newBackupCodes;
      config.usedBackupCodes = [];
      await this.store2FAConfig(userId, config);

      this.logger.info('New backup codes generated', {
        userId,
        codeCount: newBackupCodes.length,
      });

      return newBackupCodes;
    } catch (error) {
      this.logger.error('Failed to generate new backup codes', error as Error, {
        userId,
      });

      if (error instanceof AuthorizationError || error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to generate new backup codes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get 2FA status for a user
   */
  async getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
    try {
      const config = await this.get2FAConfig(userId);

      if (!config || !config.isEnabled) {
        return {
          isEnabled: false,
          method: null,
          backupCodesRemaining: 0,
        };
      }

      const remainingCodes = config.backupCodes.length - config.usedBackupCodes.length;

      return {
        isEnabled: true,
        method: config.method,
        backupCodesRemaining: remainingCodes,
        lastUsed: config.lastUsed,
        setupDate: config.setupDate,
      };
    } catch (error) {
      this.logger.error('Failed to get 2FA status', error as Error, {
        userId,
      });

      return {
        isEnabled: false,
        method: null,
        backupCodesRemaining: 0,
      };
    }
  }

  /**
   * Send SMS verification code
   */
  async sendSMSCode(request: SMSVerificationRequest): Promise<void> {
    try {
      const code = this.generateSMSCode();

      // Store code temporarily
      await this.storeSMSCode(request.userId, code);

      // Send SMS (implementation depends on SMS provider)
      await this.sendSMS(request.phoneNumber, code);

      this.logger.info('SMS verification code sent', {
        userId: request.userId,
        phoneNumber: this.maskPhoneNumber(request.phoneNumber),
      });
    } catch (error) {
      this.logger.error('Failed to send SMS code', error as Error, {
        userId: request.userId,
      });
      throw new InfrastructureError(
        `Failed to send SMS code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send email verification code
   */
  async sendEmailCode(request: EmailVerificationRequest): Promise<void> {
    try {
      const code = this.generateEmailCode();

      // Store code temporarily
      await this.storeEmailCode(request.userId, code);

      // Send email
      await this.emailService.sendTwoFactorCode(request.email, code, 5);

      this.logger.info('Email verification code sent', {
        userId: request.userId,
        email: this.maskEmail(request.email),
      });
    } catch (error) {
      this.logger.error('Failed to send email code', error as Error, {
        userId: request.userId,
      });
      throw new InfrastructureError(
        `Failed to send email code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Private helper methods

  private getConfig(): TwoFactorConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  private generateBackupCodes(count: number, length: number): string[] {
    const codes: string[] = [];
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < length; j++) {
        code += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      codes.push(code);
    }

    return codes;
  }

  private generateSMSCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateEmailCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private isBackupCode(token: string): boolean {
    return /^[A-Z0-9]{8}$/.test(token.toUpperCase());
  }

  private async verifyBackupCode(userId: string, code: string): Promise<TwoFactorVerification> {
    const config = await this.get2FAConfig(userId);
    if (!config) {
      return { isValid: false };
    }

    const normalizedCode = code.toUpperCase();
    const codeIndex = config.backupCodes.indexOf(normalizedCode);

    if (codeIndex === -1 || config.usedBackupCodes.includes(normalizedCode)) {
      return { isValid: false };
    }

    // Mark code as used
    config.usedBackupCodes.push(normalizedCode);
    await this.store2FAConfig(userId, config);

    const remainingCodes = config.backupCodes.length - config.usedBackupCodes.length;

    return {
      isValid: true,
      usedBackupCode: true,
      remainingBackupCodes: remainingCodes,
    };
  }

  private async checkRateLimit(userId: string): Promise<{
    isLimited: boolean;
    attemptsRemaining: number;
  }> {
    const key = `2fa-attempts:${userId}`;
    const attempts = (await this.cacheService.get<number>(key)) || 0;
    const maxAttempts = this.getConfig().rateLimitAttempts;

    return {
      isLimited: attempts >= maxAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - attempts),
    };
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    const key = `2fa-attempts:${userId}`;
    const attempts = (await this.cacheService.get<number>(key)) || 0;
    const ttl = this.getConfig().rateLimitWindow;

    await this.cacheService.set(key, attempts + 1, { ttl });
  }

  private async clearRateLimit(userId: string): Promise<void> {
    const key = `2fa-attempts:${userId}`;
    await this.cacheService.delete(key);
  }

  private async storeTempSetup(userId: string, setup: any): Promise<void> {
    const key = `2fa-temp-setup:${userId}`;
    await this.cacheService.set(key, setup, { ttl: 600 }); // 10 minutes
  }

  private async getTempSetup(userId: string): Promise<any> {
    const key = `2fa-temp-setup:${userId}`;
    return await this.cacheService.get(key);
  }

  private async removeTempSetup(userId: string): Promise<void> {
    const key = `2fa-temp-setup:${userId}`;
    await this.cacheService.delete(key);
  }

  private async store2FAConfig(userId: string, config: any): Promise<void> {
    const key = `2fa-config:${userId}`;
    // No expiration for permanent config, but we need to provide options object
    await this.cacheService.set(key, config, {});
  }

  private async get2FAConfig(userId: string): Promise<any> {
    const key = `2fa-config:${userId}`;
    return await this.cacheService.get(key);
  }

  private async remove2FAConfig(userId: string): Promise<void> {
    const key = `2fa-config:${userId}`;
    await this.cacheService.delete(key);
  }

  private async updateLastUsed(userId: string): Promise<void> {
    const config = await this.get2FAConfig(userId);
    if (config) {
      config.lastUsed = new Date();
      await this.store2FAConfig(userId, config);
    }
  }

  private async storeSMSCode(userId: string, code: string): Promise<void> {
    const key = `sms-code:${userId}`;
    await this.cacheService.set(key, code, { ttl: 300 }); // 5 minutes
  }

  private async storeEmailCode(userId: string, code: string): Promise<void> {
    const key = `email-code:${userId}`;
    await this.cacheService.set(key, code, { ttl: 300 }); // 5 minutes
  }

  private async sendSMS(phoneNumber: string, code: string): Promise<void> {
    // Implementation depends on SMS provider
    // This is a placeholder
    this.logger.info('SMS would be sent', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      code,
    });
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return phoneNumber;
    return phoneNumber.slice(0, -4).replace(/\d/g, '*') + phoneNumber.slice(-4);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain || local.length <= 2) return email;
    return local.slice(0, 2) + '*'.repeat(local.length - 2) + '@' + domain;
  }
}
