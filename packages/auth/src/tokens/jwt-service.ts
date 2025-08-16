import { AuthorizationError, InfrastructureError, JWT } from '@taskmanagement/core';
import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';

export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenId: string;
}

export class JWTService {
  constructor(private readonly config: JWTConfig) {
    this.validateConfig();
  }

  /**
   * Get default JWT configuration using centralized constants
   */
  static getDefaultConfig(): Partial<JWTConfig> {
    return {
      accessTokenExpiresIn: JWT.ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiresIn: JWT.REFRESH_TOKEN_EXPIRY,
    };
  }

  /**
   * Create JWTService with default configuration enhanced with custom config
   */
  static createWithDefaults(customConfig: Partial<JWTConfig> & Pick<JWTConfig, 'accessTokenSecret' | 'refreshTokenSecret' | 'issuer' | 'audience'>): JWTService {
    const defaultConfig = this.getDefaultConfig();
    const finalConfig: JWTConfig = {
      ...defaultConfig,
      ...customConfig,
    } as JWTConfig;
    
    return new JWTService(finalConfig);
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokenPair(payload: TokenPayload): TokenPair {
    try {
      const now = new Date();
      const tokenId = this.generateTokenId();

      // Generate access token
      const accessTokenOptions: SignOptions = {
        expiresIn: this.parseExpirationTime(this.config.accessTokenExpiresIn),
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: payload.userId,
        jwtid: tokenId,
      };

      const accessToken = jwt.sign(
        {
          userId: payload.userId,
          email: payload.email,
          roles: payload.roles,
          permissions: payload.permissions,
          sessionId: payload.sessionId,
          type: 'access',
        },
        this.config.accessTokenSecret,
        accessTokenOptions
      );

      // Generate refresh token
      const refreshTokenOptions: SignOptions = {
        expiresIn: this.parseExpirationTime(this.config.refreshTokenExpiresIn),
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: payload.userId,
        jwtid: `refresh_${tokenId}`,
      };

      const refreshToken = jwt.sign(
        {
          userId: payload.userId,
          sessionId: payload.sessionId,
          tokenId,
          type: 'refresh',
        },
        this.config.refreshTokenSecret,
        refreshTokenOptions
      );

      // Calculate expiration dates
      const expiresAt = new Date(
        now.getTime() +
          this.parseExpirationTime(this.config.accessTokenExpiresIn)
      );
      const refreshExpiresAt = new Date(
        now.getTime() +
          this.parseExpirationTime(this.config.refreshTokenExpiresIn)
      );

      return {
        accessToken,
        refreshToken,
        expiresAt,
        refreshExpiresAt,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Failed to generate token pair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): TokenPayload & JwtPayload {
    try {
      const verifyOptions: VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
      };

      const decoded = jwt.verify(
        token,
        this.config.accessTokenSecret,
        verifyOptions
      ) as TokenPayload & JwtPayload;

      if (decoded['type'] !== 'access') {
        throw new AuthorizationError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthorizationError(`Invalid access token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthorizationError('Access token has expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new AuthorizationError('Access token not active yet');
      }
      throw new InfrastructureError(
        `Failed to verify access token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload & JwtPayload {
    try {
      const verifyOptions: VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
      };

      const decoded = jwt.verify(
        token,
        this.config.refreshTokenSecret,
        verifyOptions
      ) as RefreshTokenPayload & JwtPayload;

      if (decoded['type'] !== 'refresh') {
        throw new AuthorizationError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthorizationError(`Invalid refresh token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthorizationError('Refresh token has expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new AuthorizationError('Refresh token not active yet');
      }
      throw new InfrastructureError(
        `Failed to verify refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decode token without verification (for debugging/logging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired without verification
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
   * Get token expiration date
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
   * Generate a new access token using refresh token
   */
  refreshAccessToken(refreshToken: string, newPayload: TokenPayload): string {
    try {
      // Verify refresh token first
      const refreshPayload = this.verifyRefreshToken(refreshToken);

      // Ensure the user ID matches
      if (refreshPayload.userId !== newPayload.userId) {
        throw new AuthorizationError('User ID mismatch in refresh token');
      }

      // Generate new access token
      const accessTokenOptions: SignOptions = {
        expiresIn: this.parseExpirationTime(this.config.accessTokenExpiresIn),
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: newPayload.userId,
        jwtid: refreshPayload.tokenId,
      };

      return jwt.sign(
        {
          userId: newPayload.userId,
          email: newPayload.email,
          roles: newPayload.roles,
          permissions: newPayload.permissions,
          sessionId: newPayload.sessionId,
          type: 'access',
        },
        this.config.accessTokenSecret,
        accessTokenOptions
      );
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new InfrastructureError(
        `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId: string, email: string): string {
    try {
      const options: SignOptions = {
        expiresIn: JWT.PASSWORD_RESET_TOKEN_EXPIRY, // Use centralized constant
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: userId,
      };

      return jwt.sign(
        {
          userId,
          email,
          type: 'password-reset',
          timestamp: Date.now(),
        },
        this.config.accessTokenSecret,
        options
      );
    } catch (error) {
      throw new InfrastructureError(
        `Failed to generate password reset token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token: string): { userId: string; email: string } {
    try {
      const verifyOptions: VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
      };

      const decoded = jwt.verify(
        token,
        this.config.accessTokenSecret,
        verifyOptions
      ) as any;

      if (decoded.type !== 'password-reset') {
        throw new AuthorizationError('Invalid token type');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthorizationError(
          `Invalid password reset token: ${error.message}`
        );
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthorizationError('Password reset token has expired');
      }
      throw new InfrastructureError(
        `Failed to verify password reset token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId: string, email: string): string {
    try {
      const options: SignOptions = {
        expiresIn: JWT.EMAIL_VERIFICATION_TOKEN_EXPIRY, // Use centralized constant
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: userId,
      };

      return jwt.sign(
        {
          userId,
          email,
          type: 'email-verification',
          timestamp: Date.now(),
        },
        this.config.accessTokenSecret,
        options
      );
    } catch (error) {
      throw new InfrastructureError(
        `Failed to generate email verification token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify email verification token
   */
  verifyEmailVerificationToken(token: string): {
    userId: string;
    email: string;
  } {
    try {
      const verifyOptions: VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
      };

      const decoded = jwt.verify(
        token,
        this.config.accessTokenSecret,
        verifyOptions
      ) as any;

      if (decoded.type !== 'email-verification') {
        throw new AuthorizationError('Invalid token type');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthorizationError(
          `Invalid email verification token: ${error.message}`
        );
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthorizationError('Email verification token has expired');
      }
      throw new InfrastructureError(
        `Failed to verify email verification token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private validateConfig(): void {
    if (
      !this.config.accessTokenSecret ||
      this.config.accessTokenSecret.length < 32
    ) {
      throw new InfrastructureError(
        'Access token secret must be at least 32 characters long'
      );
    }

    if (
      !this.config.refreshTokenSecret ||
      this.config.refreshTokenSecret.length < 32
    ) {
      throw new InfrastructureError(
        'Refresh token secret must be at least 32 characters long'
      );
    }

    if (!this.config.issuer) {
      throw new InfrastructureError('JWT issuer is required');
    }

    if (!this.config.audience) {
      throw new InfrastructureError('JWT audience is required');
    }
  }

  private parseExpirationTime(expiresIn: string): number {
    // Simple parser for common time formats
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new InfrastructureError(
        `Invalid expiration time format: ${expiresIn}`
      );
    }

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new InfrastructureError(`Unsupported time unit: ${unit}`);
    }
  }

  private generateTokenId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
