/**
 * Session Manager
 *
 * Handles secure session management with Redis-backed storage,
 * session validation, and security features like session rotation
 */

import { CacheService } from '@taskmanagement/cache';
import { AuthorizationError, InfrastructureError, LoggingService } from '@taskmanagement/core';

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  deviceFingerprint?: string;
  loginMethod: 'password' | 'oauth' | '2fa';
  metadata?: Record<string, any>;
}

export interface SessionConfig {
  sessionDuration: number; // in milliseconds
  maxSessionsPerUser: number;
  enableSessionRotation: boolean;
  rotationInterval: number; // in milliseconds
  enableDeviceTracking: boolean;
  enableConcurrentSessionLimit: boolean;
  sessionCleanupInterval: number; // in milliseconds
}

export interface CreateSessionRequest {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  ipAddress: string;
  userAgent: string;
  loginMethod: 'password' | 'oauth' | '2fa';
  deviceFingerprint?: string;
  metadata?: Record<string, any>;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: SessionData;
  reason?: string;
  requiresRotation?: boolean;
}

export class SessionManager {
  private readonly defaultConfig: SessionConfig = {
    sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
    maxSessionsPerUser: 5,
    enableSessionRotation: true,
    rotationInterval: 60 * 60 * 1000, // 1 hour
    enableDeviceTracking: true,
    enableConcurrentSessionLimit: true,
    sessionCleanupInterval: 60 * 60 * 1000, // 1 hour
  };

  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService,
    private readonly config: Partial<SessionConfig> = {}
  ) {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Start cleanup interval
    this.startCleanupInterval(finalConfig.sessionCleanupInterval);
  }

  /**
   * Create a new session
   */
  async createSession(request: CreateSessionRequest): Promise<SessionData> {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.getConfig().sessionDuration
      );

      // Check concurrent session limit
      if (this.getConfig().enableConcurrentSessionLimit) {
        await this.enforceConcurrentSessionLimit(request.userId);
      }

      const session: SessionData = {
        sessionId,
        userId: request.userId,
        email: request.email,
        roles: request.roles,
        permissions: request.permissions,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        isActive: true,
        ...(request.deviceFingerprint && { deviceFingerprint: request.deviceFingerprint }),
        loginMethod: request.loginMethod,
        metadata: request.metadata || {},
      };

      // Store session
      await this.storeSession(session);

      // Add to user's session list
      await this.addToUserSessions(request.userId, sessionId);

      this.logger.info('Session created successfully', {
        sessionId,
        userId: request.userId,
        ipAddress: request.ipAddress,
        loginMethod: request.loginMethod,
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error as Error, {
        userId: request.userId,
        ipAddress: request.ipAddress,
      });
      throw new InfrastructureError(
        `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate and retrieve session
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        return {
          isValid: false,
          reason: 'Session not found',
        };
      }

      if (!session.isActive) {
        return {
          isValid: false,
          reason: 'Session is inactive',
        };
      }

      if (new Date() > session.expiresAt) {
        await this.invalidateSession(sessionId);
        return {
          isValid: false,
          reason: 'Session has expired',
        };
      }

      // Check if session needs rotation
      const requiresRotation = this.shouldRotateSession(session);

      // Update last activity
      await this.updateLastActivity(sessionId);

      return {
        isValid: true,
        session,
        requiresRotation,
      };
    } catch (error) {
      this.logger.error('Failed to validate session', error as Error, {
        sessionId,
      });
      return {
        isValid: false,
        reason: 'Session validation failed',
      };
    }
  }

  /**
   * Rotate session ID for security
   */
  async rotateSession(oldSessionId: string): Promise<string> {
    try {
      const session = await this.getSession(oldSessionId);

      if (!session) {
        throw new AuthorizationError('Session not found');
      }

      const newSessionId = this.generateSessionId();
      const updatedSession: SessionData = {
        ...session,
        sessionId: newSessionId,
        lastActivity: new Date(),
      };

      // Store new session
      await this.storeSession(updatedSession);

      // Remove old session
      await this.removeSession(oldSessionId);

      // Update user's session list
      await this.updateUserSessionList(
        session.userId,
        oldSessionId,
        newSessionId
      );

      this.logger.info('Session rotated successfully', {
        oldSessionId,
        newSessionId,
        userId: session.userId,
      });

      return newSessionId;
    } catch (error) {
      this.logger.error('Failed to rotate session', error as Error, {
        sessionId: oldSessionId,
      });
      throw new InfrastructureError(
        `Failed to rotate session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);

      if (session) {
        // Mark as inactive
        session.isActive = false;
        await this.storeSession(session);

        // Remove from user's session list
        await this.removeFromUserSessions(session.userId, sessionId);

        this.logger.info('Session invalidated', {
          sessionId,
          userId: session.userId,
        });
      }

      // Remove from cache
      await this.removeSession(sessionId);
    } catch (error) {
      this.logger.error('Failed to invalidate session', error as Error, {
        sessionId,
      });
      throw new InfrastructureError(
        `Failed to invalidate session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.getUserSessions(userId);

      for (const sessionId of sessionIds) {
        await this.invalidateSession(sessionId);
      }

      // Clear user's session list
      await this.clearUserSessions(userId);

      this.logger.info('All user sessions invalidated', {
        userId,
        sessionCount: sessionIds.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to invalidate all user sessions',
        error as Error,
        {
          userId,
        }
      );
      throw new InfrastructureError(
        `Failed to invalidate all user sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      const sessions: SessionData[] = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session && session.isActive && new Date() <= session.expiresAt) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get active user sessions', error as Error, {
        userId,
      });
      return [];
    }
  }

  /**
   * Update session permissions
   */
  async updateSessionPermissions(
    sessionId: string,
    roles: string[],
    permissions: string[]
  ): Promise<void> {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        throw new AuthorizationError('Session not found');
      }

      session.roles = roles;
      session.permissions = permissions;
      session.lastActivity = new Date();

      await this.storeSession(session);

      this.logger.info('Session permissions updated', {
        sessionId,
        userId: session.userId,
        roles,
        permissions: permissions.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to update session permissions',
        error as Error,
        {
          sessionId,
        }
      );
      throw new InfrastructureError(
        `Failed to update session permissions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    totalActiveSessions: number;
    sessionsPerUser: Record<string, number>;
    sessionsByLoginMethod: Record<string, number>;
    averageSessionDuration: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use Redis SCAN or maintain separate counters
      const stats = {
        totalActiveSessions: 0,
        sessionsPerUser: {} as Record<string, number>,
        sessionsByLoginMethod: {} as Record<string, number>,
        averageSessionDuration: 0,
      };

      // Implementation would scan through sessions and calculate statistics
      // For now, return empty stats
      return stats;
    } catch (error) {
      this.logger.error('Failed to get session statistics', error as Error);
      return {
        totalActiveSessions: 0,
        sessionsPerUser: {},
        sessionsByLoginMethod: {},
        averageSessionDuration: 0,
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      let cleanedCount = 0;

      // This is a simplified implementation
      // In production, you would use Redis SCAN to iterate through sessions
      // and remove expired ones

      this.logger.info('Session cleanup completed', {
        cleanedCount,
      });

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error as Error);
      return 0;
    }
  }

  /**
   * Destroy session manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // Private helper methods

  private getConfig(): SessionConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `sess_${timestamp}_${randomPart}_${randomPart2}`;
  }

  private async storeSession(session: SessionData): Promise<void> {
    const key = this.getSessionKey(session.sessionId);
    const ttl = Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000);
    await this.cacheService.set(key, session, { ttl });
  }

  private async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getSessionKey(sessionId);
    return await this.cacheService.get<SessionData>(key);
  }

  private async removeSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.cacheService.delete(key);
  }

  private async updateLastActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date();
      await this.storeSession(session);
    }
  }

  private async addToUserSessions(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const key = this.getUserSessionsKey(userId);
    const sessions = (await this.cacheService.get<string[]>(key)) || [];
    sessions.push(sessionId);
    await this.cacheService.set(
      key,
      sessions,
      { ttl: this.getConfig().sessionDuration / 1000 }
    );
  }

  private async removeFromUserSessions(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const key = this.getUserSessionsKey(userId);
    const sessions = (await this.cacheService.get<string[]>(key)) || [];
    const filtered = sessions.filter(id => id !== sessionId);
    await this.cacheService.set(
      key,
      filtered,
      { ttl: this.getConfig().sessionDuration / 1000 }
    );
  }

  private async getUserSessions(userId: string): Promise<string[]> {
    const key = this.getUserSessionsKey(userId);
    return (await this.cacheService.get<string[]>(key)) || [];
  }

  private async clearUserSessions(userId: string): Promise<void> {
    const key = this.getUserSessionsKey(userId);
    await this.cacheService.delete(key);
  }

  private async updateUserSessionList(
    userId: string,
    oldSessionId: string,
    newSessionId: string
  ): Promise<void> {
    const key = this.getUserSessionsKey(userId);
    const sessions = (await this.cacheService.get<string[]>(key)) || [];
    const index = sessions.indexOf(oldSessionId);
    if (index !== -1) {
      sessions[index] = newSessionId;
      await this.cacheService.set(
        key,
        sessions,
        { ttl: this.getConfig().sessionDuration / 1000 }
      );
    }
  }

  private async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    const sessions = await this.getActiveUserSessions(userId);
    const maxSessions = this.getConfig().maxSessionsPerUser;

    if (sessions.length >= maxSessions) {
      // Remove oldest session
      const sortedSessions = sessions.sort(
        (a, b) => a.lastActivity.getTime() - b.lastActivity.getTime()
      );
      const oldestSession = sortedSessions[0];

      if (oldestSession) {
        await this.invalidateSession(oldestSession.sessionId);

        this.logger.info(
          'Oldest session invalidated due to concurrent session limit',
          {
            userId,
            invalidatedSessionId: oldestSession.sessionId,
            maxSessions,
          }
        );
      }
    }
  }

  private shouldRotateSession(session: SessionData): boolean {
    if (!this.getConfig().enableSessionRotation) {
      return false;
    }

    const rotationInterval = this.getConfig().rotationInterval;
    const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();

    return timeSinceLastActivity >= rotationInterval;
  }

  private startCleanupInterval(interval: number): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        this.logger.error('Session cleanup failed', error as Error);
      }
    }, interval);
  }

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user-sessions:${userId}`;
  }
}
