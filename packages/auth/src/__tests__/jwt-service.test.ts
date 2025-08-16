import { beforeEach, describe, expect, it } from 'vitest';
import { JWTConfig, JWTService, TokenPayload } from '../tokens/jwt-service';

describe('JWTService', () => {
  let jwtService: JWTService;
  let config: JWTConfig;

  beforeEach(() => {
    config = {
      accessTokenSecret: 'test-access-secret-that-is-long-enough-for-security',
      refreshTokenSecret: 'test-refresh-secret-that-is-long-enough-for-security',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      issuer: 'test-issuer',
      audience: 'test-audience',
    };
    jwtService = new JWTService(config);
  });

  describe('generateTokenPair', () => {
    it('should generate valid access and refresh tokens', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:tasks'],
        sessionId: 'session-123',
      };

      const tokenPair = jwtService.generateTokenPair(payload);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresAt).toBeInstanceOf(Date);
      expect(tokenPair.refreshExpiresAt).toBeInstanceOf(Date);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:tasks'],
        sessionId: 'session-123',
      };

      const tokenPair = jwtService.generateTokenPair(payload);
      const decoded = jwtService.verifyAccessToken(tokenPair.accessToken);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.roles).toEqual(payload.roles);
      expect(decoded.permissions).toEqual(payload.permissions);
      expect(decoded.sessionId).toBe(payload.sessionId);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:tasks'],
        sessionId: 'session-123',
      };

      const tokenPair = jwtService.generateTokenPair(payload);
      const decoded = jwtService.verifyRefreshToken(tokenPair.refreshToken);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.sessionId).toBe(payload.sessionId);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from refresh token', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:tasks'],
        sessionId: 'session-123',
      };

      const tokenPair = jwtService.generateTokenPair(payload);
      const newAccessToken = jwtService.refreshAccessToken(tokenPair.refreshToken, payload);

      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(tokenPair.accessToken);

      const decoded = jwtService.verifyAccessToken(newAccessToken);
      expect(decoded.userId).toBe(payload.userId);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate password reset token', () => {
      const token = jwtService.generatePasswordResetToken('user-123', 'test@example.com');
      expect(token).toBeDefined();

      const decoded = jwtService.verifyPasswordResetToken(token);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });
  });

  describe('generateEmailVerificationToken', () => {
    it('should generate email verification token', () => {
      const token = jwtService.generateEmailVerificationToken('user-123', 'test@example.com');
      expect(token).toBeDefined();

      const decoded = jwtService.verifyEmailVerificationToken(token);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });
  });
});