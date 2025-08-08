/**
 * Multi-Factor Authentication Service
 * TOTP, backup codes, and MFA management
 */

import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { logger } from '../logging/logger';

export interface MfaConfig {
  issuer: string;
  window: number;
  step: number;
  digits: number;
  algorithm: string;
}

export interface TotpSetupResult {
  secret: string;
  qrCodeUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface MfaVerificationResult {
  isValid: boolean;
  usedBackupCode?: boolean;
  backupCodeIndex?: number;
  error?: string;
}

export class MfaService {
  private readonly config: MfaConfig;

  constructor(config: Partial<MfaConfig> = {}) {
    this.config = {
      issuer: 'Unified Enterprise Platform',
      window: 1, // Allow 1 step before and after current time
      step: 30, // 30 second time step
      digits: 6, // 6 digit codes
      algorithm: 'sha1',
      ...config,
    };

    // Configure otplib
    authenticator.options = {
      window: this.config.window,
      step: this.config.step,
      digits: this.config.digits,
      algorithm: this.config.algorithm as any,
    };
  }

  /**
   * Generate TOTP secret and setup information
   */
  async generateTotpSetup(
    userEmail: string,
    userName?: string
  ): Promise<TotpSetupResult> {
    try {
      // Generate a random secret
      const secret = authenticator.generateSecret();

      // Create the service name for the authenticator app
      const serviceName = this.config.issuer;
      const accountName = userName ? `${userName} (${userEmail})` : userEmail;

      // Generate the otpauth URL
      const qrCodeUrl = authenticator.keyuri(accountName, serviceName, secret);

      // Generate QR code data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      logger.info('TOTP setup generated', {
        userEmail,
        serviceName,
        secretLength: secret.length,
        backupCodesCount: backupCodes.length,
      });

      return {
        secret,
        qrCodeUrl,
        qrCodeDataUrl,
        backupCodes,
      };
    } catch (error) {
      logger.error('Failed to generate TOTP setup', { error, userEmail });
      throw new Error('TOTP setup generation failed');
    }
  }

  /**
   * Verify TOTP code
   */
  verifyTotpCode(token: string, secret: string): boolean {
    try {
      if (!token || !secret) {
        return false;
      }

      // Remove any spaces or formatting from the token
      const cleanToken = token.replace(/\s/g, '');

      // Verify the token
      const isValid = authenticator.verify({
        token: cleanToken,
        secret,
      });

      logger.debug('TOTP verification completed', {
        isValid,
        tokenLength: cleanToken.length,
      });

      return isValid;
    } catch (error) {
      logger.error('TOTP verification failed', { error });
      return false;
    }
  }

  /**
   * Generate current TOTP code (for testing purposes)
   */
  generateTotpCode(secret: string): string {
    try {
      return authenticator.generate(secret);
    } catch (error) {
      logger.error('Failed to generate TOTP code', { error });
      throw new Error('TOTP code generation failed');
    }
  }

  /**
   * Verify MFA code (TOTP or backup code)
   */
  async verifyMfaCode(
    code: string,
    totpSecret: string,
    hashedBackupCodes: string[],
    verifyBackupCode: (
      code: string,
      hashedCodes: string[]
    ) => Promise<{ isValid: boolean; usedIndex?: number }>
  ): Promise<MfaVerificationResult> {
    try {
      // First try TOTP verification
      if (this.verifyTotpCode(code, totpSecret)) {
        return {
          isValid: true,
          usedBackupCode: false,
        };
      }

      // If TOTP fails, try backup codes
      const backupResult = await verifyBackupCode(code, hashedBackupCodes);

      if (backupResult.isValid) {
        logger.info('Backup code used for MFA verification', {
          backupCodeIndex: backupResult.usedIndex,
        });

        return {
          isValid: true,
          usedBackupCode: true,
          backupCodeIndex: backupResult.usedIndex,
        };
      }

      return {
        isValid: false,
        error: 'Invalid MFA code',
      };
    } catch (error) {
      logger.error('MFA verification failed', { error });
      return {
        isValid: false,
        error: 'MFA verification error',
      };
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character code with format XXXX-XXXX
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      codes.push(`${part1}-${part2}`);
    }

    return codes;
  }

  /**
   * Validate backup code format
   */
  isValidBackupCodeFormat(code: string): boolean {
    // Expected format: XXXX-XXXX (8 hex characters with dash)
    const backupCodeRegex = /^[A-F0-9]{4}-[A-F0-9]{4}$/;
    return backupCodeRegex.test(code.toUpperCase());
  }

  /**
   * Get time remaining until next TOTP code
   */
  getTimeRemaining(): number {
    const now = Math.floor(Date.now() / 1000);
    const timeStep = this.config.step;
    const timeRemaining = timeStep - (now % timeStep);
    return timeRemaining;
  }

  /**
   * Get current time step
   */
  getCurrentTimeStep(): number {
    return Math.floor(Date.now() / 1000 / this.config.step);
  }

  /**
   * Validate TOTP secret format
   */
  isValidTotpSecret(secret: string): boolean {
    try {
      // Try to generate a code with the secret
      authenticator.generate(secret);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate recovery information for MFA reset
   */
  generateRecoveryInfo(): {
    recoveryCode: string;
    recoveryHash: string;
    expiresAt: Date;
  } {
    const recoveryCode = crypto.randomBytes(16).toString('hex').toUpperCase();
    const recoveryHash = crypto
      .createHash('sha256')
      .update(recoveryCode)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      recoveryCode,
      recoveryHash,
      expiresAt,
    };
  }

  /**
   * Verify recovery code
   */
  verifyRecoveryCode(code: string, hash: string, expiresAt: Date): boolean {
    try {
      if (new Date() > expiresAt) {
        return false;
      }

      const codeHash = crypto
        .createHash('sha256')
        .update(code.toUpperCase())
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(codeHash));
    } catch (error) {
      logger.error('Recovery code verification failed', { error });
      return false;
    }
  }

  /**
   * Generate MFA challenge for authentication
   */
  generateMfaChallenge(): {
    challengeId: string;
    expiresAt: Date;
  } {
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    return {
      challengeId,
      expiresAt,
    };
  }

  /**
   * Get MFA status information
   */
  getMfaStatus(
    totpSecret?: string,
    backupCodes?: string[]
  ): {
    isEnabled: boolean;
    hasTotp: boolean;
    hasBackupCodes: boolean;
    backupCodesRemaining: number;
    nextCodeIn: number;
  } {
    const hasTotp = Boolean(totpSecret && this.isValidTotpSecret(totpSecret));
    const hasBackupCodes = Boolean(backupCodes && backupCodes.length > 0);
    const backupCodesRemaining = backupCodes?.length || 0;
    const nextCodeIn = this.getTimeRemaining();

    return {
      isEnabled: hasTotp,
      hasTotp,
      hasBackupCodes,
      backupCodesRemaining,
      nextCodeIn,
    };
  }
}

// Singleton instance
let mfaService: MfaService | null = null;

export function createMfaService(config?: Partial<MfaConfig>): MfaService {
  if (!mfaService) {
    mfaService = new MfaService(config);
  }
  return mfaService;
}

export function getMfaService(): MfaService {
  if (!mfaService) {
    mfaService = new MfaService();
  }
  return mfaService;
}
