import {
  eq,
  and,
  or,
  like,
  gte,
  lte,
  count,
  desc,
  asc,
  inArray,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import { getDatabase } from '../connection';
import { users, projects, tasks, workspaces, projectMembers } from '../schema';
import {
  IUserRepository,
  UserFilters,
  UserSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/user-repository';
import { User } from '../../../domain/entities/user';
import { UserId, Email } from '../../../domain/value-objects';
import { UserStatus } from '../../../shared/constants/user-constants';

export class UserRepository implements IUserRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: UserId): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id.value))
      .limit(1);

    return result.length > 0 ? this.mapToEntity(result[0]) : null;
  }

  async findByIds(ids: UserId[]): Promise<User[]> {
    const idValues = ids.map(id => id.value);
    const result = await this.db
      .select()
      .from(users)
      .where(inArray(users.id, idValues));

    return result.map(row => this.mapToEntity(row));
  }

  async findByEmail(email: Email): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);

    return result.length > 0 ? this.mapToEntity(result[0]) : null;
  }

  async findUsers(
    filters?: UserFilters,
    sort?: UserSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    let query = this.db.select().from(users);

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(users[sort.field]));
    } else {
      query = query.orderBy(desc(users.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;
    const total = await this.count(filters);

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async searchUsers(
    searchTerm: string,
    filters?: UserFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    const searchCondition = or(
      like(users.name, `%${searchTerm}%`),
      like(users.email, `%${searchTerm}%`)
    );

    let query = this.db.select().from(users).where(searchCondition);

    // Apply additional filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(and(searchCondition, ...conditions));
      }
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total matching records
    let countQuery = this.db
      .select({ count: count() })
      .from(users)
      .where(searchCondition);
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(searchCondition, ...conditions));
      }
    }
    const totalResult = await countQuery;
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async getActiveUsers(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    return this.findUsers(
      { status: [UserStatus.ACTIVE] },
      undefined,
      pagination
    );
  }

  async getInactiveUsers(
    inactiveDays: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    let query = this.db
      .select()
      .from(users)
      .where(or(lte(users.lastLoginAt, cutoffDate), isNull(users.lastLoginAt)));

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    const totalResult = await this.db
      .select({ count: count() })
      .from(users)
      .where(or(lte(users.lastLoginAt, cutoffDate), isNull(users.lastLoginAt)));
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async getUsersByStatus(
    status: UserStatus,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    return this.findUsers({ status: [status] }, undefined, pagination);
  }

  async getUsersRequiringVerification(): Promise<User[]> {
    // This would depend on how verification is implemented
    // For now, return empty array as placeholder
    return [];
  }

  async getUserStatistics(): Promise<{
    total: number;
    byStatus: Record<UserStatus, number>;
    registeredThisMonth: number;
    activeThisWeek: number;
    averageLoginFrequency?: number;
  }> {
    const total = await this.count();

    // Get counts by status - simplified for now
    const byStatus = {
      [UserStatus.ACTIVE]: await this.count({ status: [UserStatus.ACTIVE] }),
      [UserStatus.INACTIVE]: await this.count({
        status: [UserStatus.INACTIVE],
      }),
      [UserStatus.SUSPENDED]: await this.count({
        status: [UserStatus.SUSPENDED],
      }),
      [UserStatus.PENDING]: await this.count({ status: [UserStatus.PENDING] }),
    };

    // Get registered this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const registeredThisMonth = await this.count({ createdAfter: thisMonth });

    // Get active this week
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const activeThisWeek = await this.count({ lastLoginAfter: thisWeek });

    return {
      total,
      byStatus,
      registeredThisMonth,
      activeThisWeek,
    };
  }

  async save(user: User): Promise<void> {
    const data = this.mapFromEntity(user);

    await this.db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: data.name,
          email: data.email,
          hashedPassword: data.hashedPassword,
          isActive: data.isActive,
          lastLoginAt: data.lastLoginAt,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(userList: User[]): Promise<void> {
    if (userList.length === 0) return;

    const data = userList.map(user => this.mapFromEntity(user));

    await this.db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: data[0].name, // This is simplified - in real implementation would need proper handling
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: UserId): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id.value));
  }

  async deleteMany(ids: UserId[]): Promise<void> {
    const idValues = ids.map(id => id.value);
    await this.db.delete(users).where(inArray(users.id, idValues));
  }

  async exists(id: UserId): Promise<boolean> {
    const result = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const result = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);

    return result.length > 0;
  }

  async count(filters?: UserFilters): Promise<number> {
    let query = this.db.select({ count: count() }).from(users);

    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    const result = await query;
    return result[0].count;
  }

  // Placeholder implementations for complex methods
  async getUserActivitySummary(
    userId: UserId,
    fromDate: Date,
    toDate: Date
  ): Promise<any> {
    // Implementation would require joins with tasks, projects, etc.
    return {
      loginCount: 0,
      tasksCreated: 0,
      tasksCompleted: 0,
      projectsJoined: 0,
      lastActivity: new Date(),
    };
  }

  async getUserWorkspaceMemberships(userId: UserId): Promise<any[]> {
    // Implementation would require joins with workspace members table
    return [];
  }

  async getUserProjectMemberships(userId: UserId): Promise<any[]> {
    // Implementation would require joins with project members table
    return [];
  }

  async getUserTaskAssignments(
    userId: UserId,
    includeCompleted?: boolean
  ): Promise<any[]> {
    // Implementation would require joins with tasks table
    return [];
  }

  async updateLastLogin(userId: UserId, loginTime: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: loginTime, updatedAt: new Date() })
      .where(eq(users.id, userId.value));
  }

  async updatePassword(userId: UserId, hashedPassword: string): Promise<void> {
    await this.db
      .update(users)
      .set({ hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId.value));
  }

  async updateStatus(userId: UserId, status: UserStatus): Promise<void> {
    await this.db
      .update(users)
      .set({
        isActive: status === UserStatus.ACTIVE,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId.value));
  }

  async bulkUpdateStatus(userIds: UserId[], status: UserStatus): Promise<void> {
    const idValues = userIds.map(id => id.value);
    await this.db
      .update(users)
      .set({
        isActive: status === UserStatus.ACTIVE,
        updatedAt: new Date(),
      })
      .where(inArray(users.id, idValues));
  }

  // Additional placeholder methods - would need full implementation
  async getUsersWithUpcomingPasswordExpiry(days: number): Promise<User[]> {
    return [];
  }
  async getUserLoginHistory(
    userId: UserId,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    return [];
  }
  async getRecentlyRegisteredUsers(
    days: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return this.findUsers({ createdAfter: cutoffDate }, undefined, pagination);
  }
  async getUserPerformanceMetrics(userId: UserId): Promise<any> {
    return {};
  }
  async isEmailAvailable(
    email: Email,
    excludeUserId?: UserId
  ): Promise<boolean> {
    let query = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.value));

    if (excludeUserId) {
      query = query.where(
        and(eq(users.email, email.value), eq(users.id, excludeUserId.value))
      );
    }

    const result = await query.limit(1);
    return result.length === 0;
  }
  async getUsersByWorkspaceRole(
    workspaceId: string,
    role: string
  ): Promise<User[]> {
    return [];
  }
  async getUsersByProjectRole(
    projectId: string,
    role: string
  ): Promise<User[]> {
    return [];
  }
  async getUserNotificationPreferences(userId: UserId): Promise<any> {
    return {};
  }
  async updateNotificationPreferences(
    userId: UserId,
    preferences: Record<string, boolean>
  ): Promise<void> {}

  private buildFilterConditions(filters: UserFilters): any[] {
    const conditions: any[] = [];

    if (filters.status && filters.status.length > 0) {
      // Map status to isActive boolean - simplified
      const hasActive = filters.status.includes(UserStatus.ACTIVE);
      const hasInactive = filters.status.some(s => s !== UserStatus.ACTIVE);

      if (hasActive && !hasInactive) {
        conditions.push(eq(users.isActive, true));
      } else if (hasInactive && !hasActive) {
        conditions.push(eq(users.isActive, false));
      }
    }

    if (filters.search) {
      conditions.push(
        or(
          like(users.name, `%${filters.search}%`),
          like(users.email, `%${filters.search}%`)
        )
      );
    }

    if (filters.createdAfter) {
      conditions.push(gte(users.createdAt, filters.createdAfter));
    }

    if (filters.createdBefore) {
      conditions.push(lte(users.createdAt, filters.createdBefore));
    }

    if (filters.lastLoginAfter) {
      conditions.push(gte(users.lastLoginAt, filters.lastLoginAfter));
    }

    if (filters.lastLoginBefore) {
      conditions.push(lte(users.lastLoginAt, filters.lastLoginBefore));
    }

    return conditions;
  }

  private mapToEntity(row: any): User {
    // This would need to be implemented based on the actual User entity structure
    // For now, returning a placeholder
    return {} as User;
  }

  private mapFromEntity(user: User): any {
    // This would need to be implemented based on the actual User entity structure
    // For now, returning a placeholder
    return {
      id: '', // user.id.value,
      email: '', // user.email.value,
      name: '', // user.name,
      hashedPassword: '', // user.hashedPassword,
      isActive: true, // user.isActive,
      lastLoginAt: null, // user.lastLoginAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
