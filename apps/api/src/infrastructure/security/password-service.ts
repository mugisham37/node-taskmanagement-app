import * as argon2 from 'argon2';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';
import { ValidationError } from '../../shared/errors/validation-error';

export interface PasswordConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  hashingOptions: {
    type: number; // argon2.Type
    memoryCost: number;
    timeCost: number;
    parallelism: number;
    hashLength: number;
  };
}

export interface PasswordStrength {
  score: number; // 0-100
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
  isValid: boolean;
}

export class PasswordService {
  private readonly commonPasswords = new Set([
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
    '12345678',
    'football',
    'baseball',
    'basketball',
    'dragon',
    'master',
    'shadow',
    'superman',
    'batman',
    'trustno1',
    'hello',
    'welcome123',
    'login',
    'guest',
    'test',
    'user',
    'demo',
    'sample',
    'default',
  ]);

  constructor(private readonly config: PasswordConfig) {
    this.validateConfig();
  }

  /**
   * Hash a password using Argon2
   */
  async hashPassword(password: string): Promise<string> {
    try {
      // Validate password before hashing
      const strength = this.checkPasswordStrength(password);
      if (!strength.isValid) {
        throw new ValidationError([{
          field: 'password',
          message: `Password validation failed: ${strength.feedback.join(', ')}`
        }]);
      }

      const hash = await argon2.hash(password, {
        type: this.config.hashingOptions.type as 0 | 1 | 2,
        memoryCost: this.config.hashingOptions.memoryCost,
        timeCost: this.config.hashingOptions.timeCost,
        parallelism: this.config.hashingOptions.parallelism,
        hashLength: this.config.hashingOptions.hashLength,
      });

      return hash;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new InfrastructureError(
        `Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify a password against its hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to verify password: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Hash a password (alias for hashPassword)
   */
  async hash(password: string): Promise<string> {
    return this.hashPassword(password);
  }

  /**
   * Check if password needs rehashing (due to updated security parameters)
   */
  async needsRehashing(hash: string): Promise<boolean> {
    try {
      return argon2.needsRehash(hash, {
        memoryCost: this.config.hashingOptions.memoryCost,
        timeCost: this.config.hashingOptions.timeCost,
        parallelism: this.config.hashingOptions.parallelism,
      });
    } catch (error) {
      // If we can't determine if it needs rehashing, assume it does for security
      return true;
    }
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    if (length < this.config.minLength) {
      length = this.config.minLength;
    }
    if (length > this.config.maxLength) {
      length = this.config.maxLength;
    }

    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = lowercase;
    let password = '';

    // Ensure at least one character from each required category
    if (this.config.requireUppercase) {
      charset += uppercase;
      password += this.getRandomChar(uppercase);
    }
    if (this.config.requireNumbers) {
      charset += numbers;
      password += this.getRandomChar(numbers);
    }
    if (this.config.requireSpecialChars) {
      charset += specialChars;
      password += this.getRandomChar(specialChars);
    }

    // Fill the rest of the password
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(charset);
    }

    // Shuffle the password to avoid predictable patterns
    return this.shuffleString(password);
  }

  /**
   * Check password strength and provide feedback
   */
  checkPasswordStrength(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length < this.config.minLength) {
      feedback.push(
        `Password must be at least ${this.config.minLength} characters long`
      );
    } else if (password.length >= this.config.minLength) {
      score += 20;
    }

    if (password.length > this.config.maxLength) {
      feedback.push(
        `Password must not exceed ${this.config.maxLength} characters`
      );
    }

    // Character type checks
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    if (
      this.config.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
    ) {
      feedback.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      score += 15;
    }

    // Common password check
    if (this.config.preventCommonPasswords && this.isCommonPassword(password)) {
      feedback.push(
        'Password is too common, please choose a more unique password'
      );
      score = Math.max(0, score - 30);
    }

    // Pattern checks
    if (this.hasRepeatingCharacters(password)) {
      feedback.push('Avoid repeating characters');
      score = Math.max(0, score - 10);
    }

    if (this.hasSequentialCharacters(password)) {
      feedback.push('Avoid sequential characters (e.g., 123, abc)');
      score = Math.max(0, score - 10);
    }

    // Bonus points for length
    if (password.length >= 12) {
      score += 10;
    }
    if (password.length >= 16) {
      score += 10;
    }

    // Character diversity bonus
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) {
      score += 10;
    }

    // Determine strength level
    let level: PasswordStrength['level'];
    if (score < 20) {
      level = 'very-weak';
    } else if (score < 40) {
      level = 'weak';
    } else if (score < 60) {
      level = 'fair';
    } else if (score < 80) {
      level = 'good';
    } else {
      level = 'strong';
    }

    const isValid = feedback.length === 0 && score >= 40;

    return {
      score: Math.min(100, score),
      level,
      feedback,
      isValid,
    };
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const strength = this.checkPasswordStrength(password);
    return {
      isValid: strength.isValid,
      errors: strength.feedback,
    };
  }

  /**
   * Generate password reset token (simple random string)
   */
  generateResetToken(length: number = 32): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';

    for (let i = 0; i < length; i++) {
      token += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return token;
  }

  /**
   * Check if password is commonly used
   */
  private isCommonPassword(password: string): boolean {
    const lowerPassword = password.toLowerCase();

    // Check against common passwords list
    if (this.commonPasswords.has(lowerPassword)) {
      return true;
    }

    // Check for simple patterns
    if (/^(.)\1+$/.test(password)) {
      // All same character
      return true;
    }

    if (
      /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i.test(
        password
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check for repeating characters
   */
  private hasRepeatingCharacters(password: string): boolean {
    // Check for 3 or more consecutive identical characters
    return /(.)\1{2,}/.test(password);
  }

  /**
   * Check for sequential characters
   */
  private hasSequentialCharacters(password: string): boolean {
    const sequences = [
      '0123456789',
      'abcdefghijklmnopqrstuvwxyz',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    const lowerPassword = password.toLowerCase();

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subseq = sequence.substring(i, i + 3);
        if (
          lowerPassword.includes(subseq) ||
          lowerPassword.includes(subseq.split('').reverse().join(''))
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get random character from charset
   */
  private getRandomChar(charset: string): string {
    return charset.charAt(Math.floor(Math.random() * charset.length));
  }

  /**
   * Shuffle string characters
   */
  private shuffleString(str: string): string {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i]!;
      array[i] = array[j]!;
      array[j] = temp;
    }
    return array.join('');
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.minLength < 1) {
      throw new InfrastructureError(
        'Minimum password length must be at least 1'
      );
    }

    if (this.config.maxLength < this.config.minLength) {
      throw new InfrastructureError(
        'Maximum password length must be greater than minimum length'
      );
    }

    if (this.config.hashingOptions.memoryCost < 1024) {
      throw new InfrastructureError(
        'Argon2 memory cost must be at least 1024 KB'
      );
    }

    if (this.config.hashingOptions.timeCost < 1) {
      throw new InfrastructureError('Argon2 time cost must be at least 1');
    }

    if (this.config.hashingOptions.parallelism < 1) {
      throw new InfrastructureError('Argon2 parallelism must be at least 1');
    }

    if (this.config.hashingOptions.hashLength < 16) {
      throw new InfrastructureError(
        'Argon2 hash length must be at least 16 bytes'
      );
    }
  }
}
