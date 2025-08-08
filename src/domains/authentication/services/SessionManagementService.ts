import { Session } from '../entities/Session';
import { User } from '../entities/User';
import { Device } from '../entities/Device';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';
import { DeviceId } from '../value-objects/DeviceId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface SessionInfo {
  id: string;
  userId: string;
  workspaceId?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActiveAt: Date;
  expires: Date;
  isExpired: boolean;
  isCurrent: boolean;
}

export interface WorkspaceSessionContext {
  workspaceId: WorkspaceId;
  workspaceName: string;
  role: string;
  permissions: string[];
  lastSwitchedAt: Date;
}

export interface SessionSecurityInfo {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  securityFlags: {
    newDevice: boolean;
    newLocation: boolean;
    suspiciousActivity: boolean;
    requiresMfa: boolean;
  };
  recommendations: string[];
}

export class SessionCreatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly deviceId?: DeviceId,
    public readonly workspaceId?: WorkspaceId
  ) {
    super('SessionCreated', {
      sessionId: sessionId.value,
      userId: userId.value,
      deviceId: deviceId?.value,
      workspaceId: workspaceId?.value,
    });
  }
}

export class SessionExpiredEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly reason: string
  ) {
    super('SessionExpired', {
      sessionId: sessionId.value,
      userId: userId.value,
      reason,
    });
  }
}

export class SessionWorkspaceSwitchedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly fromWorkspaceId?: WorkspaceId,
    public readonly toWorkspaceId?: WorkspaceId
  ) {
    super('SessionWorkspaceSwitched', {
      sessionId: sessionId.value,
      userId: userId.value,
      fromWorkspaceId: fromWorkspaceId?.value,
      toWorkspaceId: toWorkspaceId?.value,
    });
  }
}

export class SuspiciousSessionActivityEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly activityType: string,
    public readonly riskScore: number
  ) {
    super('SuspiciousSessionActivity', {
      sessionId: sessionId.value,
      userId: userId.value,
      activityType,
      riskScore,
    });
  }
}

/**
 * Session Management Service with workspace-aware session handling
 * Handles session lifecycle, security monitoring, and workspace context switching
 */
export class SessionManagementService {
  constructor(
    private readonly sessionRepository: any,
    private readonly userRepository: any,
    private readonly deviceRepository: any,
    private readonly workspaceRepository: any,
    private readonly riskAssessmentService: any,
    private readonly eventBus: any
  ) {}

  /**
   * Create a new session with optional workspace context
   */
  async createSession(
    userId: UserId,
    deviceId?: DeviceId,
    workspaceId?: WorkspaceId,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      expiresIn?: number;
    }
  ): Promise<Session> {
    try {
      const sessionToken = this.generateSecureSessionToken();
      const expiresIn = context?.expiresIn || 24 * 60 * 60 * 1000; // 24 hours default
      const expires = new Date(Date.now() + expiresIn);

      const session = Session.create({
        sessionToken,
        userId,
        expires,
        workspaceId,
        deviceId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      await this.sessionRepository.save(session);

      // Update user's active workspace if provided
      if (workspaceId) {
        const user = await this.userRepository.findById(userId);
        if (user) {
          user.switchWorkspaceContext(workspaceId);
          await this.userRepository.save(user);
        }
      }

      await this.eventBus.publish(
        new SessionCreatedEvent(session.id, userId, deviceId, workspaceId)
      );

      return session;
    } catch (error) {
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }

  /**
   * Get session by token with validation
   */
  async getSession(sessionToken: string): Promise<Session | null> {
    try {
      const session = await this.sessionRepository.findByToken(sessionToken);

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (session.isExpired()) {
        await this.expireSession(session.id, 'Session expired');
        return null;
      }

      // Update last activity
      session.updateActivity();
      await this.sessionRepository.save(session);

      return session;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extend session expiration
   */
  async extendSession(
    sessionId: SessionId,
    additionalTime?: number
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.isExpired()) {
        throw new Error('Cannot extend expired session');
      }

      session.extend(additionalTime);
      await this.sessionRepository.save(session);

      return session;
    } catch (error) {
      throw new Error(`Session extension failed: ${error.message}`);
    }
  }

  /**
   * Switch workspace context for a session
   */
  async switchWorkspaceContext(
    sessionId: SessionId,
    workspaceId: WorkspaceId
  ): Promise<WorkspaceSessionContext> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session || session.isExpired()) {
        throw new Error('Invalid or expired session');
      }

      // Validate workspace access
      const hasAccess = await this.validateWorkspaceAccess(
        session.userId,
        workspaceId
      );
      if (!hasAccess) {
        throw new Error('Access denied to workspace');
      }

      const previousWorkspaceId = session.workspaceId;

      // Update session workspace context
      session.switchWorkspaceContext(workspaceId);
      await this.sessionRepository.save(session);

      // Update user's active workspace
      const user = await this.userRepository.findById(session.userId);
      if (user) {
        user.switchWorkspaceContext(workspaceId);
        await this.userRepository.save(user);
      }

      // Get workspace context information
      const workspaceContext = await this.getWorkspaceContext(
        session.userId,
        workspaceId
      );

      await this.eventBus.publish(
        new SessionWorkspaceSwitchedEvent(
          sessionId,
          session.userId,
          previousWorkspaceId,
          workspaceId
        )
      );

      return workspaceContext;
    } catch (error) {
      throw new Error(`Workspace context switch failed: ${error.message}`);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: UserId): Promise<SessionInfo[]> {
    try {
      const sessions = await this.sessionRepository.findByUserId(userId);
      const devices = await this.deviceRepository.findByUserId(userId);
      const deviceMap = new Map(devices.map((d: any) => [d.id.value, d]));

      return sessions
        .filter((session: Session) => !session.isExpired())
        .map((session: Session) => {
          const device = session.deviceId
            ? deviceMap.get(session.deviceId.value)
            : null;

          return {
            id: session.id.value,
            userId: session.userId.value,
            workspaceId: session.workspaceId?.value,
            deviceId: session.deviceId?.value,
            deviceName: device?.name,
            deviceType: device?.type,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            lastActiveAt: session.updatedAt,
            expires: session.expires,
            isExpired: session.isExpired(),
            isCurrent: false, // This would be determined by comparing with current session
          };
        });
    } catch (error) {
      return [];
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: SessionId,
    reason: string = 'Manual revocation'
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        session.revoke(reason);
        await this.sessionRepository.save(session);

        await this.eventBus.publish(
          new SessionExpiredEvent(sessionId, session.userId, reason)
        );
      }
    } catch (error) {
      throw new Error(`Session revocation failed: ${error.message}`);
    }
  }

  /**
   * Revoke all sessions for a user except the current one
   */
  async revokeAllOtherSessions(
    userId: UserId,
    currentSessionId: SessionId
  ): Promise<number> {
    try {
      const sessions = await this.sessionRepository.findByUserId(userId);
      let revokedCount = 0;

      for (const session of sessions) {
        if (!session.id.equals(currentSessionId) && !session.isExpired()) {
          session.revoke('Revoked by user');
          await this.sessionRepository.save(session);
          revokedCount++;

          await this.eventBus.publish(
            new SessionExpiredEvent(session.id, userId, 'Revoked by user')
          );
        }
      }

      return revokedCount;
    } catch (error) {
      throw new Error(`Session revocation failed: ${error.message}`);
    }
  }

  /**
   * Get session security information
   */
  async getSessionSecurity(sessionId: SessionId): Promise<SessionSecurityInfo> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const riskScore = await this.calculateSessionRiskScore(session);
      const securityFlags = await this.analyzeSessionSecurity(session);

      const recommendations: string[] = [];

      if (securityFlags.newDevice) {
        recommendations.push(
          'This session is from a new device. Consider enabling MFA.'
        );
      }

      if (securityFlags.newLocation) {
        recommendations.push(
          'This session is from a new location. Verify this is you.'
        );
      }

      if (riskScore > 0.7) {
        recommendations.push(
          'High risk session detected. Consider changing your password.'
        );
      }

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (riskScore > 0.7) {
        riskLevel = 'high';
      } else if (riskScore > 0.4) {
        riskLevel = 'medium';
      }

      return {
        riskScore,
        riskLevel,
        securityFlags,
        recommendations,
      };
    } catch (error) {
      return {
        riskScore: 1.0,
        riskLevel: 'high',
        securityFlags: {
          newDevice: false,
          newLocation: false,
          suspiciousActivity: true,
          requiresMfa: true,
        },
        recommendations: [
          'Unable to assess session security. Please verify your account.',
        ],
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const expiredSessions = await this.sessionRepository.findExpired();
      let cleanedCount = 0;

      for (const session of expiredSessions) {
        await this.sessionRepository.delete(session.id);
        cleanedCount++;
      }

      return cleanedCount;
    } catch (error) {
      console.error('Session cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Monitor session for suspicious activity
   */
  async monitorSessionActivity(
    sessionId: SessionId,
    activity: {
      type: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        return;
      }

      // Calculate risk score for this activity
      const riskScore = await this.riskAssessmentService.assessActivityRisk(
        session,
        activity
      );

      // Update session activity
      session.updateActivity(activity.ipAddress, activity.userAgent);
      await this.sessionRepository.save(session);

      // Check for suspicious activity
      if (riskScore > 0.8) {
        await this.eventBus.publish(
          new SuspiciousSessionActivityEvent(
            sessionId,
            session.userId,
            activity.type,
            riskScore
          )
        );

        // Consider automatic session termination for very high risk
        if (riskScore > 0.95) {
          await this.revokeSession(sessionId, 'Suspicious activity detected');
        }
      }
    } catch (error) {
      console.error('Session activity monitoring failed:', error);
    }
  }

  // Private helper methods

  private async expireSession(
    sessionId: SessionId,
    reason: string
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        session.expire();
        await this.sessionRepository.save(session);

        await this.eventBus.publish(
          new SessionExpiredEvent(sessionId, session.userId, reason)
        );
      }
    } catch (error) {
      console.error('Session expiration failed:', error);
    }
  }

  private generateSecureSessionToken(): string {
    // Generate a cryptographically secure session token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  private async validateWorkspaceAccess(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    try {
      // TODO: Implement proper workspace access validation
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        return false;
      }

      // Check if user is a member of the workspace
      const member = await this.workspaceRepository.findMember(
        workspaceId,
        userId
      );
      return !!member && member.status === 'ACTIVE';
    } catch (error) {
      return false;
    }
  }

  private async getWorkspaceContext(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<WorkspaceSessionContext> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      const member = await this.workspaceRepository.findMember(
        workspaceId,
        userId
      );

      return {
        workspaceId,
        workspaceName: workspace?.name || 'Unknown Workspace',
        role: member?.role?.name || 'member',
        permissions: member?.role?.permissions || [],
        lastSwitchedAt: new Date(),
      };
    } catch (error) {
      return {
        workspaceId,
        workspaceName: 'Unknown Workspace',
        role: 'member',
        permissions: [],
        lastSwitchedAt: new Date(),
      };
    }
  }

  private async calculateSessionRiskScore(session: Session): Promise<number> {
    return this.riskAssessmentService.calculateSessionRisk(session);
  }

  private async analyzeSessionSecurity(session: Session): Promise<{
    newDevice: boolean;
    newLocation: boolean;
    suspiciousActivity: boolean;
    requiresMfa: boolean;
  }> {
    try {
      // Check if device is new
      const device = session.deviceId
        ? await this.deviceRepository.findById(session.deviceId)
        : null;
      const newDevice = !device || !device.trusted;

      // Check if location is new (simplified - would use IP geolocation in production)
      const recentSessions = await this.sessionRepository.findRecentByUserId(
        session.userId,
        7 // last 7 days
      );
      const knownIPs = new Set(
        recentSessions
          .filter((s: Session) => s.ipAddress && !s.id.equals(session.id))
          .map((s: Session) => s.ipAddress)
      );
      const newLocation = session.ipAddress
        ? !knownIPs.has(session.ipAddress)
        : false;

      // Check for suspicious activity patterns
      const suspiciousActivity =
        await this.riskAssessmentService.detectSuspiciousActivity(
          session.userId,
          session
        );

      // Determine if MFA is required
      const user = await this.userRepository.findById(session.userId);
      const requiresMfa =
        !user?.mfaEnabled && (newDevice || newLocation || suspiciousActivity);

      return {
        newDevice,
        newLocation,
        suspiciousActivity,
        requiresMfa,
      };
    } catch (error) {
      return {
        newDevice: true,
        newLocation: true,
        suspiciousActivity: true,
        requiresMfa: true,
      };
    }
  }
}
