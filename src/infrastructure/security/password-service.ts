/**
 * Password Service Implementation
 * Secure password hashing, validation, and security features
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { logger } from '../logging/logger';

export interface PasswordConfig {
  saltRounds: number;
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
}

export interface PasswordHashResult {
  hash: string;
  salt: string;
  algorithm: string;
  iterations: number;
}

export class PasswordService {
  private readonly config: PasswordConfig;
  private readonly commonPasswords: Set<string>;

  constructor(config: Partial<PasswordConfig> = {}) {
    this.config = {
      saltRounds: 12,
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventUserInfoInPassword: true,
      ...config,
    };

    this.commonPasswords = new Set([
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
      '1234567890',
      'password1',
      'qwerty123',
      'admin123',
      'root',
      'toor',
      'pass',
      'test',
      'guest',
      'user',
      'login',
      'changeme',
      'secret',
      'default',
      'master',
    ]);
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      if (!password || password.length === 0) {
        throw new Error('Password cannot be empty');
      }

      const hash = await bcrypt.hash(password, this.config.saltRounds);

      logger.debug('Password hashed successfully', {
        saltRounds: this.config.saltRounds,
        hashLength: hash.length,
      });

      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }

      const isValid = await bcrypt.compare(password, hash);

      logger.debug('Password verification completed', {
        isValid,
        hashLength: hash.length,
      });

      return isValid;
    } catch (error) {
      logger.error('Password verification failed', { error });
      return false;
    }
  }

  /**
   * Validate password against security requirements
   */
  validatePassword(
    password: string,
    userInfo?: { email?: string; name?: string; username?: string }
  ): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length validation
    if (password.length < this.config.minLength) {
      errors.push(
        `Password must be at least ${this.config.minLength} characters long`
      );
    } else {
      score += Math.min(password.length * 2, 20);
    }

    if (password.length > this.config.maxLength) {
      errors.push(
        `Password must not exceed ${this.config.maxLength} characters`
      );
    }

    // Character requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 10;
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 10;
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 10;
    }

    if (
      this.config.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 15;
    }

    // Common password check
    if (
      this.config.preventCommonPasswords &&
      this.commonPasswords.has(password.toLowerCase())
    ) {
      errors.push('Password is too common and easily guessable');
      score -= 20;
    }

    // User info in password check
    if (this.config.preventUserInfoInPassword && userInfo) {
      const lowerPassword = password.toLowerCase();

      if (
        userInfo.email &&
        lowerPassword.includes(userInfo.email.split('@')[0].toLowerCase())
      ) {
        errors.push('Password should not contain your email address');
        score -= 10;
      }

      if (
        userInfo.name &&
        userInfo.name.length > 2 &&
        lowerPassword.includes(userInfo.name.toLowerCase())
      ) {
        errors.push('Password should not contain your name');
        score -= 10;
      }

      if (
        userInfo.username &&
        userInfo.username.length > 2 &&
        lowerPassword.includes(userInfo.username.toLowerCase())
      ) {
        errors.push('Password should not contain your username');
        score -= 10;
      }
    }

    // Additional complexity checks
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 2, 20);

    // Pattern detection (reduce score for obvious patterns)
    if (/(.)\1{2,}/.test(password)) {
      // Repeated characters
      score -= 10;
    }

    if (/123|abc|qwe|asd|zxc/i.test(password)) {
      // Sequential patterns
      score -= 15;
    }

    // Normalize score
    score = Math.max(0, Math.min(100, score));

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    if (score < 30) {
      strength = 'weak';
    } else if (score < 60) {
      strength = 'medium';
    } else if (score < 80) {
      strength = 'strong';
    } else {
      strength = 'very-strong';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score,
    };
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = '';
    let password = '';

    // Ensure at least one character from each required set
    if (this.config.requireUppercase) {
      charset += uppercase;
      password += uppercase[crypto.randomInt(uppercase.length)];
    }

    if (this.config.requireLowercase) {
      charset += lowercase;
      password += lowercase[crypto.randomInt(lowercase.length)];
    }

    if (this.config.requireNumbers) {
      charset += numbers;
      password += numbers[crypto.randomInt(numbers.length)];
    }

    if (this.config.requireSpecialChars) {
      charset += specialChars;
      password += specialChars[crypto.randomInt(specialChars.length)];
    }

    // Fill the rest of the password
    for (let i = password.length; i < length; i++) {
      password += charset[crypto.randomInt(charset.length)];
    }

    // Shuffle the password to avoid predictable patterns
    return password
      .split('')
      .sort(() => crypto.randomInt(3) - 1)
      .join('');
  }

  /**
   * Generate password reset token
   */
  generateResetToken(): { token: string; hash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    return { token, hash, expiresAt };
  }

  /**
   * Verify password reset token
   */
  verifyResetToken(token: string, hash: string, expiresAt: Date): boolean {
    try {
      if (new Date() > expiresAt) {
        return false;
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(tokenHash));
    } catch (error) {
      logger.error('Reset token verification failed', { error });
      return false;
    }
  }

  /**
   * Check if password needs rehashing (due to changed salt rounds)
   */
  needsRehash(hash: string): boolean {
    try {
      const rounds = bcrypt.getRounds(hash);
      return rounds < this.config.saltRounds;
    } catch (error) {
      logger.error('Failed to check if password needs rehash', { error });
      return true; // Assume it needs rehashing if we can't determine
    }
  }

  /**
   * Generate secure backup codes for MFA
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Hash backup codes for storage
   */
  async hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashedCodes = await Promise.all(
      codes.map(code => this.hashPassword(code))
    );

    return hashedCodes;
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(
    code: string,
    hashedCodes: string[]
  ): Promise<{ isValid: boolean; usedIndex?: number }> {
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await this.verifyPassword(code, hashedCodes[i]);
      if (isValid) {
        return { isValid: true, usedIndex: i };
      }
    }

    return { isValid: false };
  }
}

// Singleton instance
let passwordService: PasswordService | null = null;

export function createPasswordService(
  config?: Partial<PasswordConfig>
): PasswordService {
  if (!passwordService) {
    passwordService = new PasswordService(config);
  }
  return passwordService;
}

export function getPasswordService(): PasswordService {
  if (!passwordService) {
    passwordService = new PasswordService();
  }
  return passwordService;
}
