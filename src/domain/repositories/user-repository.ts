import { User } from '../entities/user';
import { UserId, Email } from '../value-objects';
import { UserStatus } from '../../shared/constants/user-constants';

/**
 * User filter options
 */
export interface UserFilters {
  status?: UserStatus[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
}

/**
 * User sorting options
 */
export interface UserSortOptions {
  field: 'createdAt' | 'updatedAt' | 'name' | 'email' | 'lastLoginAt';
  direction: 'ASC' | 'DESC';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * User Repository Interface
 * Defines all necessary user operations for persistence
 */
export interface IUserRepository {
  /**
   * Find a user by their ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find multiple users by their IDs
   */
  findByIds(ids: UserId[]): Promise<User[]>;

  /**
   * Find a user by their email address
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Find users with optional filters, sorting, and pagination
   */
  findUsers(
    filters?: UserFilters,
    sort?: UserSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Search users by name or email
   */
  searchUsers(
    searchTerm: string,
    filters?: UserFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Get active users
   */
  getActiveUsers(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Get inactive users (haven't logged in for specified days)
   */
  getInactiveUsers(
    inactiveDays: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Get users by status
   */
  getUsersByStatus(
    status: UserStatus,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Get users requiring verification
   */
  getUsersRequiringVerification(): Promise<User[]>;

  /**
   * Get user statistics
   */
  getUserStatistics(): Promise<{
    total: number;
    byStatus: Record<UserStatus, number>;
    registeredThisMonth: number;
    activeThisWeek: number;
    averageLoginFrequency?: number; // days between logins
  }>;

  /**
   * Save a single user
   */
  save(user: User): Promise<void>;

  /**
   * Save multiple users
   */
  saveMany(users: User[]): Promise<void>;

  /**
   * Delete a user
   */
  delete(id: UserId): Promise<void>;

  /**
   * Delete multiple users
   */
  deleteMany(ids: UserId[]): Promise<void>;

  /**
   * Check if a user exists by ID
   */
  exists(id: UserId): Promise<boolean>;

  /**
   * Check if a user exists by email
   */
  existsByEmail(email: Email): Promise<boolean>;

  /**
   * Count users matching filters
   */
  count(filters?: UserFilters): Promise<number>;

  /**
   * Get user activity summary
   */
  getUserActivitySummary(
    userId: UserId,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    loginCount: number;
    tasksCreated: number;
    tasksCompleted: number;
    projectsJoined: number;
    lastActivity: Date;
  }>;

  /**
   * Get user's workspace memberships
   */
  getUserWorkspaceMemberships(userId: UserId): Promise<
    Array<{
      workspaceId: string;
      workspaceName: string;
      role: string;
      joinedAt: Date;
    }>
  >;

  /**
   * Get user's project memberships
   */
  getUserProjectMemberships(userId: UserId): Promise<
    Array<{
      projectId: string;
      projectName: string;
      workspaceId: string;
      role: string;
      joinedAt: Date;
    }>
  >;

  /**
   * Get user's task assignments
   */
  getUserTaskAssignments(
    userId: UserId,
    includeCompleted?: boolean
  ): Promise<
    Array<{
      taskId: string;
      taskTitle: string;
      projectId: string;
      projectName: string;
      status: string;
      priority: string;
      dueDate?: Date;
      assignedAt: Date;
    }>
  >;

  /**
   * Update user last login time
   */
  updateLastLogin(userId: UserId, loginTime: Date): Promise<void>;

  /**
   * Update user password
   */
  updatePassword(userId: UserId, hashedPassword: string): Promise<void>;

  /**
   * Update user status
   */
  updateStatus(userId: UserId, status: UserStatus): Promise<void>;

  /**
   * Bulk update user status
   */
  bulkUpdateStatus(userIds: UserId[], status: UserStatus): Promise<void>;

  /**
   * Get users with upcoming password expiry
   */
  getUsersWithUpcomingPasswordExpiry(days: number): Promise<User[]>;

  /**
   * Get user login history
   */
  getUserLoginHistory(
    userId: UserId,
    fromDate: Date,
    toDate: Date
  ): Promise<
    Array<{
      loginTime: Date;
      ipAddress?: string;
      userAgent?: string;
    }>
  >;

  /**
   * Get recently registered users
   */
  getRecentlyRegisteredUsers(
    days: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Get user performance metrics
   */
  getUserPerformanceMetrics(userId: UserId): Promise<{
    tasksCompletedOnTime: number;
    tasksCompletedLate: number;
    averageTaskCompletionTime: number; // in hours
    projectsManaged: number;
    teamMembersManaged: number;
  }>;

  /**
   * Check if email is available for registration
   */
  isEmailAvailable(email: Email, excludeUserId?: UserId): Promise<boolean>;

  /**
   * Get users by role in workspace
   */
  getUsersByWorkspaceRole(workspaceId: string, role: string): Promise<User[]>;

  /**
   * Get users by role in project
   */
  getUsersByProjectRole(projectId: string, role: string): Promise<User[]>;

  /**
   * Get user notification preferences
   */
  getUserNotificationPreferences(userId: UserId): Promise<{
    emailNotifications: boolean;
    taskAssignments: boolean;
    projectUpdates: boolean;
    deadlineReminders: boolean;
    weeklyDigest: boolean;
  }>;

  /**
   * Update user notification preferences
   */
  updateNotificationPreferences(
    userId: UserId,
    preferences: Record<string, boolean>
  ): Promise<void>;
}
