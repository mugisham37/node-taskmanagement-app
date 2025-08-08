import { UserAggregate } from '../aggregates/user.aggregate';
import { UserId } from '../value-objects/user-id';
import { Email } from '../value-objects/email';

export interface IUserRepository {
  /**
   * Finds a user by their unique identifier
   */
  findById(id: UserId): Promise<UserAggregate | null>;

  /**
   * Finds a user by their email address
   */
  findByEmail(email: Email): Promise<UserAggregate | null>;

  /**
   * Finds multiple users by their identifiers
   */
  findByIds(ids: UserId[]): Promise<UserAggregate[]>;

  /**
   * Finds users by workspace ID
   */
  findByWorkspaceId(workspaceId: string): Promise<UserAggregate[]>;

  /**
   * Saves a user aggregate
   */
  save(user: UserAggregate): Promise<void>;

  /**
   * Deletes a user (soft delete)
   */
  delete(id: UserId): Promise<void>;

  /**
   * Checks if a user exists by email
   */
  existsByEmail(email: Email): Promise<boolean>;

  /**
   * Finds users with high risk scores
   */
  findHighRiskUsers(threshold?: number): Promise<UserAggregate[]>;

  /**
   * Finds locked users
   */
  findLockedUsers(): Promise<UserAggregate[]>;

  /**
   * Finds users without MFA enabled
   */
  findUsersWithoutMFA(): Promise<UserAggregate[]>;

  /**
   * Finds inactive users
   */
  findInactiveUsers(daysThreshold: number): Promise<UserAggregate[]>;

  /**
   * Finds users by email domain
   */
  findByEmailDomain(domain: string): Promise<UserAggregate[]>;

  /**
   * Counts total users
   */
  count(): Promise<number>;

  /**
   * Counts active users
   */
  countActive(daysThreshold: number): Promise<number>;

  /**
   * Finds users with pagination
   */
  findWithPagination(
    offset: number,
    limit: number,
    filters?: {
      emailVerified?: boolean;
      mfaEnabled?: boolean;
      isLocked?: boolean;
      isDeleted?: boolean;
      workspaceId?: string;
    }
  ): Promise<{
    users: UserAggregate[];
    total: number;
  }>;
}
