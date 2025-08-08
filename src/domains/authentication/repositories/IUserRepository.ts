import { IRepository } from '../../shared/repositories/IRepository';
import { User } from '../entities/User';
import { UserId } from '../value-objects/UserId';
import { Email } from '../../shared/value-objects/Email';

export interface IUserRepository extends IRepository<User, UserId> {
  // Authentication queries
  findByEmail(email: Email): Promise<User | null>;
  findByEmailString(email: string): Promise<User | null>;
  isEmailTaken(email: Email): Promise<boolean>;

  // Profile queries
  findByName(name: string): Promise<User[]>;
  findByNamePattern(pattern: string): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;

  // Security queries
  findUsersWithMFAEnabled(): Promise<User[]>;
  findUsersWithFailedLogins(threshold: number): Promise<User[]>;
  findLockedUsers(): Promise<User[]>;
  findUsersWithHighRiskScore(threshold: number): Promise<User[]>;

  // Activity queries
  findActiveUsers(daysThreshold: number): Promise<User[]>;
  findInactiveUsers(daysThreshold: number): Promise<User[]>;
  findRecentlyRegistered(days: number): Promise<User[]>;
  findUsersByLastLogin(startDate: Date, endDate: Date): Promise<User[]>;

  // Workspace-related queries
  findByWorkspace(workspaceId: string): Promise<User[]>;
  findWorkspaceOwners(): Promise<User[]>;
  findUsersWithoutWorkspace(): Promise<User[]>;

  // Device and session queries
  findUsersWithMultipleDevices(): Promise<User[]>;
  findUsersWithActiveSessions(): Promise<User[]>;
  getUserDeviceCount(userId: UserId): Promise<number>;
  getUserSessionCount(userId: UserId): Promise<number>;

  // Productivity queries
  findMostProductiveUsers(workspaceId: string, limit: number): Promise<User[]>;
  findUsersWithOverdueTasks(): Promise<User[]>;
  findUsersWithHighWorkload(threshold: number): Promise<User[]>;

  // Analytics queries
  getUserRegistrationStats(days: number): Promise<Record<string, number>>;
  getUserActivityStats(userId: UserId): Promise<{
    tasksCompleted: number;
    projectsOwned: number;
    lastActivity: Date;
    averageTaskCompletionTime: number;
  }>;

  // Notification queries
  findUsersWithPendingNotifications(): Promise<User[]>;
  findUsersWithNotificationPreference(preference: string): Promise<User[]>;

  // Timezone and preferences
  findUsersByTimezone(timezone: string): Promise<User[]>;
  findUsersWithWorkingHours(
    startHour: number,
    endHour: number
  ): Promise<User[]>;

  // Bulk operations
  bulkUpdateTimezone(userIds: UserId[], timezone: string): Promise<void>;
  bulkUpdateNotificationSettings(
    userIds: UserId[],
    settings: any
  ): Promise<void>;
  bulkLockUsers(userIds: UserId[], reason: string): Promise<void>;
  bulkUnlockUsers(userIds: UserId[]): Promise<void>;

  // Security operations
  lockUser(userId: UserId, reason: string, duration?: number): Promise<void>;
  unlockUser(userId: UserId): Promise<void>;
  resetFailedLoginAttempts(userId: UserId): Promise<void>;
  updateRiskScore(userId: UserId, score: number): Promise<void>;

  // MFA operations
  enableMFA(
    userId: UserId,
    secret: string,
    backupCodes: string[]
  ): Promise<void>;
  disableMFA(userId: UserId): Promise<void>;
  updateBackupCodes(userId: UserId, codes: string[]): Promise<void>;

  // Password operations
  updatePasswordHash(userId: UserId, passwordHash: string): Promise<void>;
  findUsersWithWeakPasswords(): Promise<User[]>;
  findUsersRequiringPasswordReset(): Promise<User[]>;

  // Email verification
  markEmailAsVerified(userId: UserId): Promise<void>;
  findUnverifiedUsers(olderThanDays: number): Promise<User[]>;

  // Soft delete operations
  softDelete(userId: UserId): Promise<void>;
  restore(userId: UserId): Promise<void>;
  findDeleted(): Promise<User[]>;
  permanentlyDelete(userId: UserId): Promise<void>;

  // Health and compliance
  findUsersRequiringDataExport(): Promise<User[]>;
  findUsersForDataRetention(retentionDays: number): Promise<User[]>;
  getUserDataSize(userId: UserId): Promise<number>;

  // Integration queries
  findUsersWithExternalAccounts(): Promise<User[]>;
  findUsersByProvider(provider: string): Promise<User[]>;
  findUsersWithWebAuthnCredentials(): Promise<User[]>;
}
