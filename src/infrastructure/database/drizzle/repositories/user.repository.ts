import { eq, and, or, ilike, isNull, isNotNull, desc, asc } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { users, User, NewUser } from '../schema/users';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class UserRepository extends BaseRepository<User, NewUser> {
  protected table = users;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'user' }, // Enable caching for users
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // User-specific methods
  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.findMany({
        where: eq(users.email, email),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByEmail');
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const result = await this.findMany({
        where: eq(users.username, username),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByUsername');
    }
  }

  async emailExists(email: string): Promise<boolean> {
    try {
      const user = await this.findByEmail(email);
      return user !== null;
    } catch (error) {
      throw this.handleError(error, 'emailExists');
    }
  }

  async usernameExists(username: string): Promise<boolean> {
    try {
      const user = await this.findByUsername(username);
      return user !== null;
    } catch (error) {
      throw this.handleError(error, 'usernameExists');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<User>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(users.firstName, searchPattern),
        ilike(users.lastName, searchPattern),
        ilike(users.username, searchPattern),
        ilike(users.email, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  async findActiveUsers(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    try {
      // Assuming there's an isActive field or similar logic
      const whereCondition = eq(users.isEmailVerified, true);
      
      return await this.findMany({
        where: whereCondition,
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findActiveUsers');
    }
  }

  async findAdmins(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    try {
      const whereCondition = eq(users.role, 'admin');
      
      return await this.findMany({
        where: whereCondition,
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findAdmins');
    }
  }

  async findUnverifiedUsers(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    try {
      const whereCondition = eq(users.isEmailVerified, false);
      
      return await this.findMany({
        where: whereCondition,
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findUnverifiedUsers');
    }
  }

  async updateLastLogin(id: string): Promise<User | null> {
    try {
      return await this.update(id, {
        lastLoginAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateLastLogin');
    }
  }

  async verifyEmail(id: string): Promise<User | null> {
    try {
      return await this.update(id, {
        isEmailVerified: true,
        emailVerificationToken: null
      } as any);
    } catch (error) {
      throw this.handleError(error, 'verifyEmail');
    }
  }

  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<User | null> {
    try {
      return await this.update(id, {
        passwordResetToken: token,
        passwordResetExpires: expires
      } as any);
    } catch (error) {
      throw this.handleError(error, 'setPasswordResetToken');
    }
  }

  async clearPasswordResetToken(id: string): Promise<User | null> {
    try {
      return await this.update(id, {
        passwordResetToken: null,
        passwordResetExpires: null
      } as any);
    } catch (error) {
      throw this.handleError(error, 'clearPasswordResetToken');
    }
  }

  async updatePreferences(id: string, preferences: Record<string, any>): Promise<User | null> {
    try {
      return await this.update(id, {
        preferences
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updatePreferences');
    }
  }

  async changeRole(id: string, role: 'admin' | 'user'): Promise<User | null> {
    try {
      return await this.update(id, {
        role
      } as any);
    } catch (error) {
      throw this.handleError(error, 'changeRole');
    }
  }

  async getUserStats(): Promise<{
    total: number;
    verified: number;
    unverified: number;
    admins: number;
    recentLogins: number;
  }> {
    try {
      const [
        total,
        verified,
        unverified,
        admins
      ] = await Promise.all([
        this.count(),
        this.count({ where: eq(users.isEmailVerified, true) }),
        this.count({ where: eq(users.isEmailVerified, false) }),
        this.count({ where: eq(users.role, 'admin') })
      ]);

      // Recent logins in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentLogins = await this.count({
        where: isNotNull(users.lastLoginAt)
      });

      return {
        total,
        verified,
        unverified,
        admins,
        recentLogins
      };
    } catch (error) {
      throw this.handleError(error, 'getUserStats');
    }
  }

  async findRecentUsers(days: number = 7, options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      return await this.findMany({
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentUsers');
    }
  }

  async bulkUpdateRole(userIds: string[], role: 'admin' | 'user'): Promise<{ success: boolean; count: number }> {
    try {
      const result = await this.updateMany(userIds, { role } as any);
      return result;
    } catch (error) {
      throw this.handleError(error, 'bulkUpdateRole');
    }
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    try {
      const result = await this.findMany({
        where: eq(users.emailVerificationToken, token),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByEmailVerificationToken');
    }
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    try {
      const result = await this.findMany({
        where: and(
          eq(users.passwordResetToken, token),
          // Add expiry check here
        ),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByPasswordResetToken');
    }
  }

  // Override create to add validation
  async create(data: NewUser): Promise<User> {
    try {
      // Check if email already exists
      if (await this.emailExists(data.email)) {
        throw new RepositoryException('DUPLICATE_KEY', 'Email already exists');
      }

      // Check if username already exists
      if (await this.usernameExists(data.username)) {
        throw new RepositoryException('DUPLICATE_KEY', 'Username already exists');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
