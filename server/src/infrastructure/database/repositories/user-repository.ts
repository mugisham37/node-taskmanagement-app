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
  SQL,
} from 'drizzle-orm';
import { getDatabase } from '../connection';
import { users } from '../schema';
import {
  IUserRepository,
  UserFilters,
  UserSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/user-repository';
import { User } from '../../../domain/entities/user';
import { UserId, Email, UserStatusVO } from '../../../domain/value-objects';
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
    // Build conditions
    const conditions = filters ? this.buildFilterConditions(filters) : [];
    
    // Build the full query in one go to avoid type issues
    const db = this.db;
    let result: any[];
    
    if (conditions.length > 0) {
      if (sort?.field && sort?.direction) {
        const sortColumn = this.getSortColumn(sort.field);
        const orderFn = sort.direction === 'DESC' ? desc : asc;
        if (pagination) {
          const offset = (pagination.page - 1) * pagination.limit;
          result = await db
            .select()
            .from(users)
            .where(and(...conditions))
            .orderBy(orderFn(sortColumn))
            .limit(pagination.limit)
            .offset(offset);
        } else {
          result = await db
            .select()
            .from(users)
            .where(and(...conditions))
            .orderBy(orderFn(sortColumn));
        }
      } else {
        if (pagination) {
          const offset = (pagination.page - 1) * pagination.limit;
          result = await db
            .select()
            .from(users)
            .where(and(...conditions))
            .orderBy(desc(users.createdAt))
            .limit(pagination.limit)
            .offset(offset);
        } else {
          result = await db
            .select()
            .from(users)
            .where(and(...conditions))
            .orderBy(desc(users.createdAt));
        }
      }
    } else {
      if (sort?.field && sort?.direction) {
        const sortColumn = this.getSortColumn(sort.field);
        const orderFn = sort.direction === 'DESC' ? desc : asc;
        if (pagination) {
          const offset = (pagination.page - 1) * pagination.limit;
          result = await db
            .select()
            .from(users)
            .orderBy(orderFn(sortColumn))
            .limit(pagination.limit)
            .offset(offset);
        } else {
          result = await db.select().from(users).orderBy(orderFn(sortColumn));
        }
      } else {
        if (pagination) {
          const offset = (pagination.page - 1) * pagination.limit;
          result = await db
            .select()
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(pagination.limit)
            .offset(offset);
        } else {
          result = await db.select().from(users).orderBy(desc(users.createdAt));
        }
      }
    }

    const total = await this.count(filters);

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  private getSortColumn(field: string): any {
    switch (field) {
      case 'name':
        return users.name;
      case 'email':
        return users.email;
      case 'createdAt':
        return users.createdAt;
      case 'updatedAt':
        return users.updatedAt;
      case 'lastLoginAt':
        return users.lastLoginAt;
      default:
        return users.createdAt;
    }
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

    // Build additional filter conditions
    const filterConditions = filters ? this.buildFilterConditions(filters) : [];
    const allConditions = filterConditions.length > 0 
      ? [searchCondition, ...filterConditions] 
      : [searchCondition];

    const db = this.db;
    let result: any[];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      result = await db
        .select()
        .from(users)
        .where(and(...allConditions))
        .limit(pagination.limit)
        .offset(offset);
    } else {
      result = await db
        .select()
        .from(users)
        .where(and(...allConditions));
    }

    // Count total matching records
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(...allConditions));
    const total = totalResult[0]?.count || 0;

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

    const conditions = or(
      lte(users.lastLoginAt, cutoffDate), 
      isNull(users.lastLoginAt)
    );

    const db = this.db;
    let result: any[];

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      result = await db
        .select()
        .from(users)
        .where(conditions)
        .limit(pagination.limit)
        .offset(offset);
    } else {
      result = await db
        .select()
        .from(users)
        .where(conditions);
    }

    // Count total
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(conditions);
    const total = totalResult[0]?.count || 0;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async getUsersByStatus(
    status: typeof UserStatus[keyof typeof UserStatus],
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    return this.findUsers({ status: [status] }, undefined, pagination);
  }

  async getUsersRequiringVerification(): Promise<User[]> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.isActive, false));

    return result.map(row => this.mapToEntity(row));
  }

  async getUserStatistics(): Promise<{
    total: number;
    byStatus: Record<typeof UserStatus[keyof typeof UserStatus], number>;
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
      [UserStatus.DELETED]: await this.count({ status: [UserStatus.DELETED] }),
      [UserStatus.PENDING_VERIFICATION]: await this.count({ 
        status: [UserStatus.PENDING_VERIFICATION] 
      }),
    } as Record<typeof UserStatus[keyof typeof UserStatus], number>;

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
    const db = this.db;

    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        const result = await db
          .select({ count: count() })
          .from(users)
          .where(and(...conditions));
        return result[0]?.count || 0;
      }
    }

    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count || 0;
  }

  // Implementation for complex methods
  async getUserActivitySummary(
    userId: UserId,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    loginCount: number;
    tasksCreated: number;
    tasksCompleted: number;
    projectsJoined: number;
    lastActivity: Date;
  }> {
    // Implementation would require joins with tasks, projects, etc.
    // For now, returning basic implementation with user's last login
    const user = await this.findById(userId);
    
    // Note: fromDate and toDate would be used in actual implementation
    // to filter activities within the date range
    void fromDate; // Acknowledge parameter
    void toDate; // Acknowledge parameter
    
    return {
      loginCount: 0, // Would need login history tracking
      tasksCreated: 0, // Would need join with tasks table
      tasksCompleted: 0, // Would need join with tasks table
      projectsJoined: 0, // Would need join with project members table
      lastActivity: user?.lastLoginAt || new Date(),
    };
  }

  async getUserWorkspaceMemberships(userId: UserId): Promise<any[]> {
    // Implementation would require joins with workspace members table
    // This would depend on workspace member schema being available
    void userId; // Acknowledge parameter
    return [];
  }

  async getUserProjectMemberships(userId: UserId): Promise<any[]> {
    // Implementation would require joins with project members table
    // This would depend on project member schema being available
    void userId; // Acknowledge parameter
    return [];
  }

  async getUserTaskAssignments(
    userId: UserId,
    includeCompleted?: boolean
  ): Promise<any[]> {
    // Implementation would require joins with tasks table
    // This would depend on task schema being available
    void userId; // Acknowledge parameter
    void includeCompleted; // Acknowledge parameter
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

  async updateStatus(userId: UserId, status: typeof UserStatus[keyof typeof UserStatus]): Promise<void> {
    await this.db
      .update(users)
      .set({
        isActive: status === UserStatus.ACTIVE,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId.value));
  }

  async bulkUpdateStatus(userIds: UserId[], status: typeof UserStatus[keyof typeof UserStatus]): Promise<void> {
    const idValues = userIds.map(id => id.value);
    await this.db
      .update(users)
      .set({
        isActive: status === UserStatus.ACTIVE,
        updatedAt: new Date(),
      })
      .where(inArray(users.id, idValues));
  }

  // Additional methods implementations
  async getUsersWithUpcomingPasswordExpiry(days: number): Promise<User[]> {
    // This would require password expiry tracking in schema
    // For now, return empty array as placeholder
    void days; // Acknowledge parameter
    return [];
  }

  async getUserLoginHistory(
    userId: UserId,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    // This would require login history tracking
    // For now, return empty array as placeholder
    void userId; // Acknowledge parameter
    void fromDate; // Acknowledge parameter
    void toDate; // Acknowledge parameter
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
    // This would require performance tracking
    // For now, return empty object as placeholder
    void userId; // Acknowledge parameter
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
      query = this.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, email.value),
            eq(users.id, excludeUserId.value)
          )
        );
    }

    const result = await query.limit(1);
    return result.length === 0;
  }

  async getUsersByWorkspaceRole(
    workspaceId: string,
    role: string
  ): Promise<User[]> {
    // This would require workspace member joins
    // Implementation would depend on workspace member schema
    void workspaceId; // Acknowledge parameter
    void role; // Acknowledge parameter
    return [];
  }

  async getUsersByProjectRole(
    projectId: string,
    role: string
  ): Promise<User[]> {
    // This would require project member joins
    // Implementation would depend on project member schema
    void projectId; // Acknowledge parameter
    void role; // Acknowledge parameter
    return [];
  }

  async getUserNotificationPreferences(userId: UserId): Promise<any> {
    // This would require notification preferences table
    // For now, return empty object as placeholder
    void userId; // Acknowledge parameter
    return {};
  }

  async updateNotificationPreferences(
    userId: UserId,
    preferences: Record<string, boolean>
  ): Promise<void> {
    // This would require notification preferences table
    // For now, empty implementation as placeholder
    void userId; // Acknowledge parameter
    void preferences; // Acknowledge parameter
  }

  private buildFilterConditions(filters: UserFilters): SQL<unknown>[] {
    const conditions: SQL<unknown>[] = [];

    if (filters.status && filters.status.length > 0) {
      // Map status to isActive boolean - simplified mapping
      const hasActive = filters.status.includes(UserStatus.ACTIVE);
      const hasInactive = filters.status.some(s => s !== UserStatus.ACTIVE);

      if (hasActive && !hasInactive) {
        conditions.push(eq(users.isActive, true));
      } else if (hasInactive && !hasActive) {
        conditions.push(eq(users.isActive, false));
      }
      // If both active and inactive are requested, no filter needed
    }

    if (filters.search) {
      conditions.push(
        or(
          like(users.name, `%${filters.search}%`),
          like(users.email, `%${filters.search}%`)
        )!
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
    return new User(
      UserId.create(row.id),
      Email.create(row.email),
      row.name,
      row.hashedPassword,
      UserStatusVO.create(row.isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE),
      row.lastLoginAt,
      row.createdAt,
      row.updatedAt
    );
  }

  private mapFromEntity(user: User): any {
    return {
      id: user.id.value,
      email: user.email.value,
      name: user.name,
      hashedPassword: user.hashedPassword,
      isActive: user.status.value === UserStatus.ACTIVE,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
