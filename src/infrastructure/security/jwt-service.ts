/**
 * JWT Service Implementation
 * Comprehensive JWT token management with security features
 */

import jwt from 'jsonwebtoken';
import { logger } from '../logging/logger';

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiration: string;
  refreshTokenExpiration: string;
  issuer: string;
  audience: string;
  algorithm?: jwt.Algorithm;
}

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  workspaceId?: string;
  roles?: string[];
  permissions?: string[];
  sessionId?: string;
  deviceId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: JwtPayload;
  error?: string;
  isExpired?: boolean;
}

export class JwtService {
  private readonly config: Required<JwtConfig>;

  constructor(config: JwtConfig) {
    this.config = {
      algorithm: 'HS256',
      ...config,
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (
      !this.config.accessTokenSecret ||
      this.config.accessTokenSecret.length < 32
    ) {
      throw new Error(
        'Access token secret must be at least 32 characters long'
      );
    }

    if (
      !this.config.refreshTokenSecret ||
      this.config.refreshTokenSecret.length < 32
    ) {
      throw new Error(
        'Refresh token secret must be at least 32 characters long'
      );
    }

    if (this.config.accessTokenSecret === this.config.refreshTokenSecret) {
      throw new Error('Access and refresh token secrets must be different');
    }
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokens(
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'>
  ): TokenPair {
    try {
      const now = Math.floor(Date.now() / 1000);

      const accessTokenPayload: JwtPayload = {
        ...payload,
        iat: now,
        iss: this.config.issuer,
        aud: this.config.audience,
      };

      const refreshTokenPayload = {
        sub: payload.sub,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        type: 'refresh',
        iat: now,
        iss: this.config.issuer,
        aud: this.config.audience,
      };

      const accessToken = jwt.sign(
        accessTokenPayload,
        this.config.accessTokenSecret,
        {
          expiresIn: this.config.accessTokenExpiration,
          algorithm: this.config.algorithm,
        }
      );

      const refreshToken = jwt.sign(
        refreshTokenPayload,
        this.config.refreshTokenSecret,
        {
          expiresIn: this.config.refreshTokenExpiration,
          algorithm: this.config.algorithm,
        }
      );

      // Calculate expiration time in seconds
      const decoded = jwt.decode(accessToken) as any;
      const expiresIn = decoded.exp - decoded.iat;

      logger.debug('JWT tokens generated successfully', {
        userId: payload.sub,
        sessionId: payload.sessionId,
        expiresIn,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Failed to generate JWT tokens', {
        error,
        userId: payload.sub,
      });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): TokenValidationResult {
    try {
      const payload = jwt.verify(token, this.config.accessTokenSecret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm],
      }) as JwtPayload;

      return {
        isValid: true,
        payload,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn('Access token verification failed', {
        error: errorMessage,
        token: token.substring(0, 20) + '...',
      });

      return {
        isValid: false,
        error: errorMessage,
        isExpired: errorMessage.includes('expired'),
      };
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): TokenValidationResult {
    try {
      const payload = jwt.verify(token, this.config.refreshTokenSecret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm],
      }) as any;

      return {
        isValid: true,
        payload: {
          sub: payload.sub,
          sessionId: payload.sessionId,
          deviceId: payload.deviceId,
        } as JwtPayload,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn('Refresh token verification failed', {
        error: errorMessage,
        token: token.substring(0, 20) + '...',
      });

      return {
        isValid: false,
        error: errorMessage,
        isExpired: errorMessage.includes('expired'),
      };
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      logger.error('Failed to decode token', { error });
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(
    refreshToken: string,
    newPayload: Partial<JwtPayload>
  ): TokenPair | null {
    const validation = this.verifyRefreshToken(refreshToken);

    if (!validation.isValid || !validation.payload) {
      return null;
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: validation.payload.sub,
      sessionId: validation.payload.sessionId,
      deviceId: validation.payload.deviceId,
      ...newPayload,
    };

    return this.generateTokens(payload);
  }

  /**
   * Create a short-lived token for specific operations
   */
  createShortLivedToken(
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
    expiresIn: string = '5m'
  ): string {
    try {
      const tokenPayload: JwtPayload = {
        ...payload,
        iss: this.config.issuer,
        aud: this.config.audience,
      };

      return jwt.sign(tokenPayload, this.config.accessTokenSecret, {
        expiresIn,
        algorithm: this.config.algorithm,
      });
    } catch (error) {
      logger.error('Failed to create short-lived token', {
        error,
        userId: payload.sub,
      });
      throw new Error('Short-lived token creation failed');
    }
  }
}

// Singleton instance
let jwtService: JwtService | null = null;

export function createJwtService(config: JwtConfig): JwtService {
  if (!jwtService) {
    jwtService = new JwtService(config);
  }
  return jwtService;
}

export function getJwtService(): JwtService {
  if (!jwtService) {
    throw new Error(
      'JWT service not initialized. Call createJwtService() first.'
    );
  }
  return jwtService;
}
