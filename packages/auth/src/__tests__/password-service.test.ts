import { beforeEach, describe, expect, it } from 'vitest';
import { PasswordConfig, PasswordService } from '../encryption/password-service';

describe('PasswordService', () => {
  let passwordService: PasswordService;
  let config: PasswordConfig;

  beforeEach(() => {
    config = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      hashingOptions: {
        type: 2, // Argon2id
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
        hashLength: 32,
      },
    };
    passwordService = new PasswordService(config);
  });

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'SecurePass123!';
      const hash = await passwordService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$argon2')).toBe(true);
    });

    it('should reject weak passwords', async () => {
      const weakPassword = '123';
      
      await expect(passwordService.hashPassword(weakPassword)).rejects.toThrow();
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePass123!';
      const hash = await passwordService.hashPassword(password);
      
      const isValid = await passwordService.verify(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123!';
      const wrongPassword = 'WrongPass123!';
      const hash = await passwordService.hashPassword(password);
      
      const isValid = await passwordService.verify(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('checkPasswordStrength', () => {
    it('should return strong for good password', () => {
      const password = 'MySecureP@ssw0rd2024!';
      const strength = passwordService.checkPasswordStrength(password);

      expect(strength.level).toBe('strong');
      expect(strength.isValid).toBe(true);
      expect(strength.score).toBeGreaterThan(80);
    });

    it('should return weak for poor password', () => {
      const password = 'password';
      const strength = passwordService.checkPasswordStrength(password);

      expect(strength.level).toBe('very-weak');
      expect(strength.isValid).toBe(false);
      expect(strength.feedback.length).toBeGreaterThan(0);
    });

    it('should detect common passwords', () => {
      const password = 'password123';
      const strength = passwordService.checkPasswordStrength(password);

      expect(strength.isValid).toBe(false);
      expect(strength.feedback.some(f => f.includes('common'))).toBe(true);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate secure password with default length', () => {
      const password = passwordService.generateSecurePassword();

      expect(password.length).toBeGreaterThanOrEqual(config.minLength);
      expect(password.length).toBeLessThanOrEqual(config.maxLength);

      const strength = passwordService.checkPasswordStrength(password);
      expect(strength.isValid).toBe(true);
    });

    it('should generate password with specified length', () => {
      const length = 20;
      const password = passwordService.generateSecurePassword(length);

      expect(password.length).toBe(length);

      const strength = passwordService.checkPasswordStrength(password);
      expect(strength.isValid).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const password = 'MySecureP@ssw0rd2024!';
      const result = passwordService.validatePassword(password);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return errors for weak password', () => {
      const password = 'weak';
      const result = passwordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});