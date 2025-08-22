/**
 * Security Utilities
 */

import { createCipher, createDecipher, createHash, randomBytes } from 'crypto';

export class SecurityUtils {
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(password + actualSalt)
      .digest('hex');

    return { hash, salt: actualSalt };
  }

  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const hashedPassword = this.hashPassword(password, salt);
    return hashedPassword.hash === hash;
  }

  static generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  static encrypt(text: string, key: string): string {
    const cipher = createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  static decrypt(encryptedText: string, key: string): string {
    const decipher = createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static sanitizeInput(input: string): string {
    // Basic input sanitization
    return input
      .replace(/[<>]/g, '') // Remove < and > characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateStrongPassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
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

  static generateSecureId(): string {
    return randomBytes(16).toString('hex');
  }

  static constantTimeStringCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
