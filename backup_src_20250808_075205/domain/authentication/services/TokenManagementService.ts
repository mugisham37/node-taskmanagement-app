import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../entities/User';
import { Session } from '../entities/Session';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenPayload {
  userId: string;
  sessionId: string;
  workspaceId?: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  sub: string;
  jti: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  version: number;
  iat: number;
  exp: number;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
  requiresRefresh?: boolean;
}

export class TokenIssuedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly tokenType: 'access' | 'refresh',
    public readonly expiresAt: Date
  ) {
    super('TokenIssued', {
      userId: userId.value,
      sessionId: sessionId.value,
      tokenType,
      expiresAt: expiresAt.toISOString(),
    });
  }
}

export class TokenRevokedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly reason: string
  ) {
    super('TokenRevoked', {
      userId: userId.value,
      sessionId: sessionId.value,
      reason,
    });
  }
}

export class TokenRotatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly oldTokenId: string,
    public readonly newTokenId: string
  ) {
    super('TokenRotated', {
      userId: userId.value,
      sessionId: sessionId.value,
      oldTokenId,
      newTokenId,
    });
  }
}

/**
 * Comprehensive JWT Token Management Service
 * Handles token generation, validation, rotation, and revocation
 */
export class TokenManagementService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenTTL: number = 15 * 60; // 15 minutes
  private readonly refreshTokenTTL: number = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private readonly sessionRepository: any,
    private readonly tokenBlacklistRepository: any,
    private readonly eventBus: any,
    config: {
      accessTokenSecret: string;
      refreshTokenSecret: string;
      issuer: string;
      audience: string;
      accessTokenTTL?: number;
      refreshTokenTTL?: number;
    }
  ) {
    this.accessTokenSecret = config.accessTokenSecret;
    this.refreshTokenSecret = config.refreshTokenSecret;
    this.issuer = config.issuer;
    this.audience = config.audience;

    if (config.accessTokenTTL) {
      this.accessTokenTTL = config.accessTokenTTL;
    }

    if (config.refreshTokenTTL) {
      this.refreshTokenTTL = config.refreshTokenTTL;
    }
  }

  /**
   * Generate a new token pair for user authentication
   */
  async generateTokenPair(
    user: User,
    session: Session,
    workspaceId?: WorkspaceId,
    permissions: string[] = []
  ): Promise<TokenPair> {
    try {
      const tokenFamily = this.generateTokenFamily();
      const jti = this.generateJTI();

      // Create access token payload
      const accessPayload: TokenPayload = {
        userId: user.id.value,
        sessionId: session.id.value,
        workspaceId: workspaceId?.value,
        role: this.getUserRole(user, workspaceId),
        permissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.accessTokenTTL,
        aud: this.audience,
        iss: this.issuer,
        sub: user.id.value,
        jti,
      };

      // Create refresh token payload
      const refreshPayload: RefreshTokenPayload = {
        userId: user.id.value,
        sessionId: session.id.value,
        tokenFamily,
        version: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.refreshTokenTTL,
      };

      // Sign tokens
      const accessToken = jwt.sign(accessPayload, this.accessTokenSecret, {
        algorithm: 'HS256',
      });

      const refreshToken = jwt.sign(refreshPayload, this.refreshTokenSecret, {
        algorithm: 'HS256',
      });

      // Store refresh token metadata
      await this.storeRefreshTokenMetadata(refreshPayload, tokenFamily);

      // Publish events
      await this.eventBus.publish(
        new TokenIssuedEvent(
          user.id,
          session.id,
          'access',
          new Date(accessPayload.exp * 1000)
        )
      );

      await this.eventBus.publish(
        new TokenIssuedEvent(
          user.id,
          session.id,
          'refresh',
          new Date(refreshPayload.exp * 1000)
        )
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenTTL,
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      // Check if token is blacklisted
      const isBlacklisted =
        await this.tokenBlacklistRepository.isBlacklisted(token);
      if (isBlacklisted) {
        return {
          valid: false,
          error: 'Token has been revoked',
        };
      }

      // Verify and decode token
      const payload = jwt.verify(token, this.accessTokenSecret, {
        audience: this.audience,
        issuer: this.issuer,
        algorithms: ['HS256'],
      }) as TokenPayload;

      // Validate session is still active
      const session = await this.sessionRepository.findById(
        SessionId.create(payload.sessionId)
      );

      if (!session || session.isExpired()) {
        return {
          valid: false,
          error: 'Session expired or invalid',
        };
      }

      // Check if token is close to expiration (within 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;
      const requiresRefresh = timeUntilExpiry < 5 * 60; // 5 minutes

      return {
        valid: true,
        payload,
        requiresRefresh,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token expired',
          requiresRefresh: true,
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token',
        };
      }

      return {
        valid: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const refreshPayload = jwt.verify(refreshToken, this.refreshTokenSecret, {
        algorithms: ['HS256'],
      }) as RefreshTokenPayload;

      // Check if refresh token is blacklisted
      const isBlacklisted =
        await this.tokenBlacklistRepository.isBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new Error('Refresh token has been revoked');
      }

      // Validate refresh token metadata
      const tokenMetadata = await this.getRefreshTokenMetadata(
        refreshPayload.tokenFamily,
        refreshPayload.version
      );

      if (!tokenMetadata || tokenMetadata.revoked) {
        throw new Error('Refresh token is invalid or revoked');
      }

      // Get session and user
      const session = await this.sessionRepository.findById(
        SessionId.create(refreshPayload.sessionId)
      );

      if (!session || session.isExpired()) {
        throw new Error('Session expired or invalid');
      }

      const user = await this.getUserById(UserId.create(refreshPayload.userId));
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token pair with rotation
      const newTokenPair = await this.rotateTokenPair(
        user,
        session,
        refreshPayload.tokenFamily,
        refreshPayload.version
      );

      // Blacklist old refresh token
      await this.tokenBlacklistRepository.blacklist(
        refreshToken,
        'Token rotated',
        new Date(Date.now() + this.refreshTokenTTL * 1000)
      );

      return newTokenPair;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Revoke all tokens for a user session
   */
  async revokeSessionTokens(
    sessionId: SessionId,
    reason: string = 'Manual revocation'
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        return;
      }

      // Get all refresh tokens for this session
      const refreshTokens = await this.getSessionRefreshTokens(sessionId);

      // Blacklist all refresh tokens
      for (const tokenData of refreshTokens) {
        await this.tokenBlacklistRepository.blacklist(
          tokenData.token,
          reason,
          new Date(Date.now() + this.refreshTokenTTL * 1000)
        );

        // Mark token metadata as revoked
        await this.revokeRefreshTokenMetadata(
          tokenData.tokenFamily,
          tokenData.version
        );
      }

      // Publish revocation event
      await this.eventBus.publish(
        new TokenRevokedEvent(session.userId, sessionId, reason)
      );
    } catch (error) {
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }

  /**
   * Revoke all tokens for a user across all sessions
   */
  async revokeAllUserTokens(
    userId: UserId,
    reason: string = 'Security revocation'
  ): Promise<void> {
    try {
      // Get all user sessions
      const sessions = await this.sessionRepository.findByUserId(userId);

      // Revoke tokens for each session
      for (const session of sessions) {
        await this.revokeSessionTokens(session.id, reason);
      }
    } catch (error) {
      throw new Error(`User token revocation failed: ${error.message}`);
    }
  }

  /**
   * Generate short-lived access token for specific operations
   */
  async generateOperationToken(
    user: User,
    operation: string,
    ttl: number = 5 * 60 // 5 minutes
  ): Promise<string> {
    try {
      const payload = {
        userId: user.id.value,
        operation,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + ttl,
        aud: this.audience,
        iss: this.issuer,
        sub: user.id.value,
        jti: this.generateJTI(),
      };

      return jwt.sign(payload, this.accessTokenSecret, {
        algorithm: 'HS256',
      });
    } catch (error) {
      throw new Error(`Operation token generation failed: ${error.message}`);
    }
  }

  /**
   * Validate operation token
   */
  async validateOperationToken(
    token: string,
    expectedOperation: string
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret, {
        audience: this.audience,
        issuer: this.issuer,
        algorithms: ['HS256'],
      }) as any;

      if (payload.operation !== expectedOperation) {
        return {
          valid: false,
          error: 'Invalid operation',
        };
      }

      return {
        valid: true,
        userId: payload.userId,
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid operation token',
      };
    }
  }

  /**
   * Clean up expired tokens from blacklist
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      return await this.tokenBlacklistRepository.cleanupExpired();
    } catch (error) {
      console.error('Token cleanup failed:', error);
      return 0;
    }
  }

  // Private helper methods

  private async rotateTokenPair(
    user: User,
    session: Session,
    tokenFamily: string,
    currentVersion: number
  ): Promise<TokenPair> {
    const newVersion = currentVersion + 1;
    const jti = this.generateJTI();

    // Create new access token
    const accessPayload: TokenPayload = {
      userId: user.id.value,
      sessionId: session.id.value,
      workspaceId: session.workspaceId?.value,
      role: this.getUserRole(user, session.workspaceId),
      permissions: await this.getUserPermissions(user, session.workspaceId),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.accessTokenTTL,
      aud: this.audience,
      iss: this.issuer,
      sub: user.id.value,
      jti,
    };

    // Create new refresh token
    const refreshPayload: RefreshTokenPayload = {
      userId: user.id.value,
      sessionId: session.id.value,
      tokenFamily,
      version: newVersion,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.refreshTokenTTL,
    };

    // Sign new tokens
    const accessToken = jwt.sign(accessPayload, this.accessTokenSecret, {
      algorithm: 'HS256',
    });

    const refreshToken = jwt.sign(refreshPayload, this.refreshTokenSecret, {
      algorithm: 'HS256',
    });

    // Update refresh token metadata
    await this.updateRefreshTokenMetadata(tokenFamily, newVersion);

    // Publish rotation event
    await this.eventBus.publish(
      new TokenRotatedEvent(
        user.id,
        session.id,
        `${tokenFamily}:${currentVersion}`,
        `${tokenFamily}:${newVersion}`
      )
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTTL,
      tokenType: 'Bearer',
    };
  }

  private generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateJTI(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private getUserRole(user: User, workspaceId?: WorkspaceId): string {
    // TODO: Implement workspace-specific role resolution
    return 'member';
  }

  private async getUserPermissions(
    user: User,
    workspaceId?: WorkspaceId
  ): Promise<string[]> {
    // TODO: Implement permission resolution
    return [];
  }

  private async getUserById(userId: UserId): Promise<User | null> {
    // TODO: Implement user repository call
    return null;
  }

  private async storeRefreshTokenMetadata(
    payload: RefreshTokenPayload,
    tokenFamily: string
  ): Promise<void> {
    // TODO: Implement refresh token metadata storage
  }

  private async getRefreshTokenMetadata(
    tokenFamily: string,
    version: number
  ): Promise<any> {
    // TODO: Implement refresh token metadata retrieval
    return null;
  }

  private async updateRefreshTokenMetadata(
    tokenFamily: string,
    version: number
  ): Promise<void> {
    // TODO: Implement refresh token metadata update
  }

  private async revokeRefreshTokenMetadata(
    tokenFamily: string,
    version: number
  ): Promise<void> {
    // TODO: Implement refresh token metadata revocation
  }

  private async getSessionRefreshTokens(sessionId: SessionId): Promise<any[]> {
    // TODO: Implement session refresh token retrieval
    return [];
  }
}
