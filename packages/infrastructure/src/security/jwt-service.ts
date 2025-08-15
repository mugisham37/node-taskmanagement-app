import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import {
    JWTService,
    RefreshTokenPayload,
    TokenPair,
    TokenPayload
} from './interfaces';

export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  issuer: string;
  audience: string;
}

export class DefaultJWTService implements JWTService {
  readonly name = 'jwt-service';

  constructor(private readonly config: JWTConfig) {
    this.validateConfig();
  }

  generateTokenPair(payload: TokenPayload): TokenPair {
    try {
      const now = new Date();
      const tokenId = this.generateTokenId();

      // Generate access token
      const accessTokenOptions: SignOptions = {
        expiresIn: this.config.accessTokenExpiresIn,
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
        expiresIn: this.config.refreshTokenExpiresIn,
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
        now.getTime() + this.parseExpirationTime(this.config.accessTokenExpiresIn)
      );
      const refreshExpiresAt = new Date(
        now.getTime() + this.parseExpirationTime(this.config.refreshTokenExpiresIn)
      );

      return {
        accessToken,
        refreshToken,
        expiresAt,
        refreshExpiresAt,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate token pair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

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
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid access token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token has expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('Access token not active yet');
      }
      throw new Error(
        `Failed to verify access token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

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
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid refresh token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('Refresh token not active yet');
      }
      throw new Error(
        `Failed to verify refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  refreshAccessToken(refreshToken: string, newPayload: TokenPayload): string {
    try {
      // Verify refresh token first
      const refreshPayload = this.verifyRefreshToken(refreshToken);

      // Ensure the user ID matches
      if (refreshPayload.userId !== newPayload.userId) {
        throw new Error('User ID mismatch in refresh token');
      }

      // Generate new access token
      const accessTokenOptions: SignOptions = {
        expiresIn: this.config.accessTokenExpiresIn,
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
      throw new Error(
        `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  generatePasswordResetToken(userId: string, email: string): string {
    try {
      const options: SignOptions = {
        expiresIn: '1h', // 1 hour for password reset
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
      throw new Error(
        `Failed to generate password reset token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

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
        throw new Error('Invalid token type');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid password reset token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Password reset token has expired');
      }
      throw new Error(
        `Failed to verify password reset token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  generateEmailVerificationToken(userId: string, email: string): string {
    try {
      const options: SignOptions = {
        expiresIn: '24h', // 24 hours for email verification
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
      throw new Error(
        `Failed to generate email verification token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  verifyEmailVerificationToken(token: string): { userId: string; email: string } {
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
        throw new Error('Invalid token type');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid email verification token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Email verification token has expired');
      }
      throw new Error(
        `Failed to verify email verification token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      return true;
    }
  }

  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test token generation and verification
      const testPayload: TokenPayload = {
        userId: 'test',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
        sessionId: 'test-session',
      };

      const tokens = this.generateTokenPair(testPayload);
      this.verifyAccessToken(tokens.accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const isHealthy = await this.isHealthy();
    return {
      healthy: isHealthy,
      issuer: this.config.issuer,
      audience: this.config.audience,
    };
  }

  private validateConfig(): void {
    if (!this.config.accessTokenSecret || this.config.accessTokenSecret.length < 32) {
      throw new Error('Access token secret must be at least 32 characters long');
    }

    if (!this.config.refreshTokenSecret || this.config.refreshTokenSecret.length < 32) {
      throw new Error('Refresh token secret must be at least 32 characters long');
    }

    if (!this.config.issuer) {
      throw new Error('JWT issuer is required');
    }

    if (!this.config.audience) {
      throw new Error('JWT audience is required');
    }
  }

  private parseExpirationTime(expiresIn: string): number {
    // Simple parser for common time formats
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiration time format: ${expiresIn}`);
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
        throw new Error(`Unsupported time unit: ${unit}`);
    }
  }

  private generateTokenId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}