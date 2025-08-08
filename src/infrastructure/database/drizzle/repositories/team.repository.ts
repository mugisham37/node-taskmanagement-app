import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, count } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { teams, Team, NewTeam, teamMembers, TeamMember, NewTeamMember } from '../schema/teams';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class TeamRepository extends BaseRepository<Team, NewTeam> {
  protected table = teams;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'team' }, // Enable caching for teams
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Team-specific methods
  async findByCreator(creatorId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Team>> {
    try {
      return await this.findMany({
        where: eq(teams.createdById, creatorId),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByCreator');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Team>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(teams.name, searchPattern),
        ilike(teams.description, searchPattern)
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

  async updateColor(teamId: string, color: string): Promise<Team | null> {
    try {
      // Validate color format (hex color)
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invalid color format. Must be a hex color (e.g., #FF0000)');
      }

      return await this.update(teamId, { color } as any);
    } catch (error) {
      throw this.handleError(error, 'updateColor');
    }
  }

  async updateSettings(teamId: string, settings: Record<string, any>): Promise<Team | null> {
    try {
      return await this.update(teamId, { settings } as any);
    } catch (error) {
      throw this.handleError(error, 'updateSettings');
    }
  }

  async getTeamStats(creatorId?: string): Promise<{
    total: number;
    recentlyCreated: number;
  }> {
    try {
      const baseWhere = creatorId ? eq(teams.createdById, creatorId) : undefined;

      const [total] = await Promise.all([
        this.count({ where: baseWhere })
      ]);

      // For recently created, we'd need proper date comparison
      const recentlyCreated = 0; // Placeholder

      return {
        total,
        recentlyCreated
      };
    } catch (error) {
      throw this.handleError(error, 'getTeamStats');
    }
  }

  // Team Member Management
  async addMember(teamId: string, userId: string, role: 'owner' | 'admin' | 'member' = 'member', invitedById?: string): Promise<TeamMember> {
    try {
      const memberData: NewTeamMember = {
        teamId,
        userId,
        role,
        invitedById
      };

      const result = await this.db
        .insert(teamMembers)
        .values(memberData)
        .returning();

      return result[0] as TeamMember;
    } catch (error) {
      throw this.handleError(error, 'addMember');
    }
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        ));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      throw this.handleError(error, 'removeMember');
    }
  }

  async updateMemberRole(teamId: string, userId: string, role: 'owner' | 'admin' | 'member'): Promise<TeamMember | null> {
    try {
      const result = await this.db
        .update(teamMembers)
        .set({ role, updatedAt: new Date() })
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        ))
        .returning();

      return (result[0] as TeamMember) || null;
    } catch (error) {
      throw this.handleError(error, 'updateMemberRole');
    }
  }

  async getTeamMembers(teamId: string, options: PaginationOptions = {}): Promise<PaginatedResult<TeamMember>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'joinedAt',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build query for count
      const countQuery = this.db
        .select({ count: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      // Build query for data
      let dataQuery = this.db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      // Apply ordering
      if (sortBy && (teamMembers as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (teamMembers as any)[sortBy];
        dataQuery = dataQuery.orderBy(orderFn(column)) as any;
      }

      // Apply pagination
      dataQuery = dataQuery.limit(limit).offset(offset) as any;

      // Execute queries
      const [totalResult, data] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as TeamMember[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'getTeamMembers');
    }
  }

  async getUserTeams(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Team>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'joinedAt',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build query for count
      const countQuery = this.db
        .select({ count: count() })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId));

      // Build query for data
      let dataQuery = this.db
        .select({
          id: teams.id,
          name: teams.name,
          description: teams.description,
          avatar: teams.avatar,
          color: teams.color,
          settings: teams.settings,
          createdById: teams.createdById,
          createdAt: teams.createdAt,
          updatedAt: teams.updatedAt,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId));

      // Apply ordering
      if (sortBy === 'joinedAt') {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        dataQuery = dataQuery.orderBy(orderFn(teamMembers.joinedAt)) as any;
      } else if (sortBy && (teams as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (teams as any)[sortBy];
        dataQuery = dataQuery.orderBy(orderFn(column)) as any;
      }

      // Apply pagination
      dataQuery = dataQuery.limit(limit).offset(offset) as any;

      // Execute queries
      const [totalResult, data] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as Team[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'getUserTeams');
    }
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        ))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      throw this.handleError(error, 'isMember');
    }
  }

  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    try {
      const result = await this.db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        ))
        .limit(1);

      return result[0]?.role || null;
    } catch (error) {
      throw this.handleError(error, 'getMemberRole');
    }
  }

  async bulkAddMembers(teamId: string, userIds: string[], role: 'owner' | 'admin' | 'member' = 'member', invitedById?: string): Promise<TeamMember[]> {
    try {
      const memberData = userIds.map(userId => ({
        teamId,
        userId,
        role,
        invitedById
      }));

      const result = await this.db
        .insert(teamMembers)
        .values(memberData)
        .returning();

      return result as TeamMember[];
    } catch (error) {
      throw this.handleError(error, 'bulkAddMembers');
    }
  }

  async bulkRemoveMembers(teamId: string, userIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      const result = await this.db
        .delete(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          inArray(teamMembers.userId, userIds)
        ));

      return { success: true, count: result.rowCount || 0 };
    } catch (error) {
      return { success: false, count: 0 };
    }
  }

  async transferOwnership(teamId: string, newOwnerId: string): Promise<Team | null> {
    try {
      return await this.update(teamId, { 
        createdById: newOwnerId
      } as any);
    } catch (error) {
      throw this.handleError(error, 'transferOwnership');
    }
  }

  // Override create to add validation
  async create(data: NewTeam): Promise<Team> {
    try {
      // Validate color format if provided
      if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invalid color format. Must be a hex color (e.g., #FF0000)');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }

  // Helper method to access db from base class
  private get db() {
    return (this as any).db || require('../../connection').db;
  }
}

// Export singleton instance
export const teamRepository = new TeamRepository();
