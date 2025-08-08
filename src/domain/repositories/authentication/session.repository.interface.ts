import { SessionAggregate } from '../aggregates/session.aggregate';
import { SessionId } from '../value-objects/session-id';
import { UserId } from '../value-objects/user-id';

export interface ISessionRepository {
  /**
   * Finds a session by its unique identifier
   */
  findById(id: SessionId): Promise<SessionAggregate | null>;

  /**
   * Finds a session by session token
   */
  findByToken(token: string): Promise<SessionAggregate | null>;

  /**
   * Finds all active sessions for a user
   */
  findActiveByUserId(userId: UserId): Promise<SessionAggregate[]>;

  /**
   * Finds sessions by user ID with pagination
   */
  findByUserId(
    userId: UserId,
    offset: number,
    limit: number
  ): Promise<{
    sessions: SessionAggregate[];
    total: number;
  }>;

  /**
   * Saves a session aggregate
   */
  save(session: SessionAggregate): Promise<void>;

  /**
   * Deletes a session
   */
  delete(id: SessionId): Promise<void>;

  /**
   * Deletes all sessions for a user
   */
  deleteAllByUserId(userId: UserId): Promise<void>;

  /**
   * Finds expired sessions
   */
  findExpiredSessions(): Promise<SessionAggregate[]>;

  /**
   * Deletes expired sessions
   */
  deleteExpiredSessions(): Promise<number>;

  /**
   * Finds sessions by IP address
   */
  findByIpAddress(ipAddress: string): Promise<SessionAggregate[]>;

  /**
   * Finds sessions by device ID
   */
  findByDeviceId(deviceId: string): Promise<SessionAggregate[]>;

  /**
   * Counts active sessions for a user
   */
  countActiveByUserId(userId: UserId): Promise<number>;

  /**
   * Finds sessions that should be refreshed
   */
  findSessionsToRefresh(thresholdMinutes: number): Promise<SessionAggregate[]>;

  /**
   * Finds suspicious sessions (multiple IPs, devices, etc.)
   */
  findSuspiciousSessions(): Promise<SessionAggregate[]>;
}
