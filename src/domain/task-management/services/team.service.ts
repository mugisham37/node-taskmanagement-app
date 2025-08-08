import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { 
  teamRepository, 
  userRepository, 
  workspaceRepository,
  activityRepository
} from '../db/repositories';
import { Team, NewTeam, TeamMember, NewTeamMember, TeamRole } from '../db/schema/teams';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import { notificationService, NotificationType } from './notification.service';
import { activityService } from './activity.service';

export interface TeamFilters {
  createdById?: string;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface TeamCreateData {
  name: string;
  description?: string;
  avatar?: string;
  color?: string;
  settings?: Record<string, any>;
}

export interface TeamUpdateData {
  name?: string;
  description?: string;
  avatar?: string;
  color?: string;
  settings?: Record<string, any>;
}

export interface TeamMemberData {
  email: string;
  role?: TeamRole;
}

export interface TeamStats {
  totalMembers: number;
  membersByRole: Record<string, number>;
  recentActivity: number;
  workspaceCount: number;
}

export class TeamService extends BaseService {
  constructor() {
    super('TeamService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache for teams
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createTeam(data: TeamCreateData, context?: ServiceContext): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('createTeam', ctx, { name: data.name });

    try {
      // Validate input
      this.validateTeamData(data);

      // Check if user exists
      const user = await userRepository.findById(ctx.userId!);
      if (!user) {
        throw new NotFoundError('User', ctx.userId!);
      }

      // Create team
      const newTeam: NewTeam = {
        name: data.name,
        description: data.description,
        avatar: data.avatar,
        color: data.color || '#4f46e5',
        settings: data.settings || {},
        createdById: ctx.userId!
      };

      const team = await teamRepository.create(newTeam);

      // Add creator as owner
      await teamRepository.addMember(team.id, ctx.userId!, 'owner', ctx.userId!);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_created',
        teamId: team.id,
        data: {
          teamName: team.name,
          action: 'team_created'
        },
        metadata: {
          teamId: team.id
        }
      }, ctx);

      await this.recordMetric('team.created', 1, { 
        hasDescription: team.description ? 'true' : 'false'
      });

      return team;
    } catch (error) {
      this.handleError(error, 'createTeam', ctx);
    }
  }

  async getTeamById(teamId: string, context?: ServiceContext): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('getTeamById', ctx, { teamId });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is a member of the team
      await this.verifyTeamMembership(teamId, ctx.userId!);

      return team;
    } catch (error) {
      this.handleError(error, 'getTeamById', ctx);
    }
  }

  async getTeams(
    filters: TeamFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Team>> {
    const ctx = this.createContext(context);
    this.logOperation('getTeams', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Get teams where user is a member
      const result = await teamRepository.getUserTeams(ctx.userId!, paginationOptions);

      return result;
    } catch (error) {
      this.handleError(error, 'getTeams', ctx);
    }
  }

  async updateTeam(teamId: string, data: TeamUpdateData, context?: ServiceContext): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('updateTeam', ctx, { teamId, updates: Object.keys(data) });

    try {
      const existingTeam = await teamRepository.findById(teamId);
      if (!existingTeam) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is an admin or owner of the team
      await this.verifyTeamAdminAccess(teamId, ctx.userId!);

      // Validate updates
      this.validateTeamUpdateData(data);

      const updatedTeam = await teamRepository.update(teamId, {
        ...data,
        updatedAt: new Date()
      });

      if (!updatedTeam) {
        throw new NotFoundError('Team', teamId);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_updated',
        teamId: teamId,
        data: {
          teamName: updatedTeam.name,
          action: 'team_updated',
          updates: Object.keys(data)
        },
        metadata: {
          teamId: teamId
        }
      }, ctx);

      await this.recordMetric('team.updated', 1);

      return updatedTeam;
    } catch (error) {
      this.handleError(error, 'updateTeam', ctx);
    }
  }

  async deleteTeam(teamId: string, context?: ServiceContext): Promise<{ message: string }> {
    const ctx = this.createContext(context);
    this.logOperation('deleteTeam', ctx, { teamId });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is the owner of the team
      await this.verifyTeamOwnership(teamId, ctx.userId!);

      // Get team name for activity log
      const teamName = team.name;

      // Delete team (cascade will handle members and workspaces)
      const success = await teamRepository.delete(teamId);
      if (!success) {
        throw new NotFoundError('Team', teamId);
      }

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_deleted',
        data: {
          teamName,
          teamId,
          action: 'team_deleted'
        }
      }, ctx);

      await this.recordMetric('team.deleted', 1);

      return {
        message: 'Team deleted successfully'
      };
    } catch (error) {
      this.handleError(error, 'deleteTeam', ctx);
    }
  }

  // Team Member Management
  async addTeamMember(
    teamId: string,
    memberData: TeamMemberData,
    context?: ServiceContext
  ): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('addTeamMember', ctx, { teamId, email: memberData.email });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is an admin or owner of the team
      await this.verifyTeamAdminAccess(teamId, ctx.userId!);

      // Check if user with the provided email exists
      const newMember = await userRepository.findByEmail(memberData.email);
      if (!newMember) {
        throw new NotFoundError('User', `with email ${memberData.email}`);
      }

      // Check if user is already a member of the team
      const isMember = await teamRepository.isMember(teamId, newMember.id);
      if (isMember) {
        throw new ValidationError('User is already a member of this team');
      }

      // Determine role (only owner can add admins)
      let role = memberData.role || 'member';
      const userRole = await teamRepository.getMemberRole(teamId, ctx.userId!);
      if (role === 'admin' && userRole !== 'owner') {
        throw new ForbiddenError('Only the team owner can add administrators');
      }

      // Prevent adding another owner
      if (role === 'owner') {
        role = 'admin';
      }

      // Add member to team
      await teamRepository.addMember(teamId, newMember.id, role, ctx.userId!);

      // Send notification to new member
      await notificationService.createNotification({
        userId: newMember.id,
        type: NotificationType.TEAM_INVITATION,
        title: 'Added to Team',
        message: `You have been added to the team "${team.name}"`,
        data: {
          teamId,
          teamName: team.name,
          role
        }
      });

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_member_added',
        teamId: teamId,
        data: {
          teamName: team.name,
          memberName: `${newMember.firstName} ${newMember.lastName}`,
          memberEmail: newMember.email,
          memberRole: role,
          action: 'team_member_added'
        }
      }, ctx);

      await this.recordMetric('team.member.added', 1, { role });

      return team;
    } catch (error) {
      this.handleError(error, 'addTeamMember', ctx);
    }
  }

  async removeTeamMember(teamId: string, memberId: string, context?: ServiceContext): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('removeTeamMember', ctx, { teamId, memberId });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is an admin or owner of the team
      await this.verifyTeamAdminAccess(teamId, ctx.userId!);

      // Check if member exists
      const memberRole = await teamRepository.getMemberRole(teamId, memberId);
      if (!memberRole) {
        throw new NotFoundError('Member', 'in this team');
      }

      // Check if trying to remove the owner
      if (memberRole === 'owner') {
        throw new ForbiddenError('Cannot remove the team owner');
      }

      // Check if admin is trying to remove another admin
      const userRole = await teamRepository.getMemberRole(teamId, ctx.userId!);
      if (userRole === 'admin' && memberRole === 'admin') {
        throw new ForbiddenError('Administrators cannot remove other administrators');
      }

      // Get member info for activity log
      const memberUser = await userRepository.findById(memberId);

      // Remove member from team
      await teamRepository.removeMember(teamId, memberId);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_member_removed',
        teamId: teamId,
        data: {
          teamName: team.name,
          memberName: memberUser?.firstName ? `${memberUser.firstName} ${memberUser.lastName}` : 'Unknown',
          memberEmail: memberUser?.email,
          action: 'team_member_removed'
        }
      }, ctx);

      await this.recordMetric('team.member.removed', 1);

      return team;
    } catch (error) {
      this.handleError(error, 'removeTeamMember', ctx);
    }
  }

  async updateTeamMemberRole(
    teamId: string,
    memberId: string,
    role: TeamRole,
    context?: ServiceContext
  ): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('updateTeamMemberRole', ctx, { teamId, memberId, role });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is the owner of the team
      await this.verifyTeamOwnership(teamId, ctx.userId!);

      // Find the member to update
      const currentRole = await teamRepository.getMemberRole(teamId, memberId);
      if (!currentRole) {
        throw new NotFoundError('Member', 'in this team');
      }

      // Check if trying to change the owner's role
      if (currentRole === 'owner') {
        throw new ForbiddenError('Cannot change the team owner\'s role');
      }

      // Check if trying to set another member as owner
      if (role === 'owner') {
        throw new ForbiddenError('Cannot set another member as owner');
      }

      // Get member info for activity log
      const memberUser = await userRepository.findById(memberId);
      const oldRole = currentRole;

      // Update member's role
      await teamRepository.updateMemberRole(teamId, memberId, role);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_member_role_changed',
        teamId: teamId,
        data: {
          teamName: team.name,
          memberName: memberUser?.firstName ? `${memberUser.firstName} ${memberUser.lastName}` : 'Unknown',
          memberEmail: memberUser?.email,
          oldRole,
          newRole: role,
          action: 'team_member_role_changed'
        }
      }, ctx);

      await this.recordMetric('team.member.role_updated', 1, { 
        oldRole, 
        newRole: role 
      });

      return team;
    } catch (error) {
      this.handleError(error, 'updateTeamMemberRole', ctx);
    }
  }

  async getTeamMembers(teamId: string, context?: ServiceContext): Promise<TeamMember[]> {
    const ctx = this.createContext(context);
    this.logOperation('getTeamMembers', ctx, { teamId });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is a member of the team
      await this.verifyTeamMembership(teamId, ctx.userId!);

      const members = await teamRepository.getTeamMembers(teamId);
      return members.data;
    } catch (error) {
      this.handleError(error, 'getTeamMembers', ctx);
    }
  }

  async leaveTeam(teamId: string, context?: ServiceContext): Promise<{ message: string }> {
    const ctx = this.createContext(context);
    this.logOperation('leaveTeam', ctx, { teamId });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is a member of the team
      const memberRole = await teamRepository.getMemberRole(teamId, ctx.userId!);
      if (!memberRole) {
        throw new NotFoundError('You are not a member of this team');
      }

      // Check if user is the owner
      if (memberRole === 'owner') {
        throw new ForbiddenError('The team owner cannot leave the team. Transfer ownership or delete the team instead.');
      }

      // Get user info for activity log
      const user = await userRepository.findById(ctx.userId!);

      // Remove user from team
      await teamRepository.removeMember(teamId, ctx.userId!);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_member_removed',
        teamId: teamId,
        data: {
          teamName: team.name,
          memberName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Unknown',
          memberEmail: user?.email,
          action: 'left_team'
        }
      }, ctx);

      await this.recordMetric('team.member.left', 1);

      return {
        message: 'You have left the team successfully'
      };
    } catch (error) {
      this.handleError(error, 'leaveTeam', ctx);
    }
  }

  async transferTeamOwnership(teamId: string, newOwnerId: string, context?: ServiceContext): Promise<Team> {
    const ctx = this.createContext(context);
    this.logOperation('transferTeamOwnership', ctx, { teamId, newOwnerId });

    try {
      const team = await teamRepository.findById(teamId);
      if (!team) {
        throw new NotFoundError('Team', teamId);
      }

      // Check if user is the owner of the team
      await this.verifyTeamOwnership(teamId, ctx.userId!);

      // Find the new owner in the team members
      const newOwnerRole = await teamRepository.getMemberRole(teamId, newOwnerId);
      if (!newOwnerRole) {
        throw new NotFoundError('New owner must be a member of the team');
      }

      // Get user info for activity log
      const newOwnerUser = await userRepository.findById(newOwnerId);

      // Update roles
      await teamRepository.updateMemberRole(teamId, ctx.userId!, 'admin');
      await teamRepository.updateMemberRole(teamId, newOwnerId, 'owner');

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_updated',
        teamId: teamId,
        data: {
          teamName: team.name,
          action: 'ownership_transferred',
          newOwnerName: newOwnerUser?.firstName ? `${newOwnerUser.firstName} ${newOwnerUser.lastName}` : 'Unknown',
          newOwnerEmail: newOwnerUser?.email
        }
      }, ctx);

      await this.recordMetric('team.ownership.transferred', 1);

      return team;
    } catch (error) {
      this.handleError(error, 'transferTeamOwnership', ctx);
    }
  }

  // Statistics
  async getTeamStats(teamId: string, context?: ServiceContext): Promise<TeamStats> {
    const ctx = this.createContext(context);
    this.logOperation('getTeamStats', ctx, { teamId });

    try {
      // Check if user is a member of the team
      await this.verifyTeamMembership(teamId, ctx.userId!);

      const members = await teamRepository.getTeamMembers(teamId);
      const workspaces = await workspaceRepository.findMany({
        where: eq(workspaceRepository['table']?.teamId, teamId)
      });

      // Count members by role
      const membersByRole: Record<string, number> = {};
      members.data.forEach((member: any) => {
        membersByRole[member.role] = (membersByRole[member.role] || 0) + 1;
      });

      // Get recent activity count (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentActivities = await activityRepository.findMany({
        where: and(
          eq(activityRepository['table']?.teamId, teamId),
          gte(activityRepository['table']?.createdAt, sevenDaysAgo)
        )
      });

      const stats: TeamStats = {
        totalMembers: members.data.length,
        membersByRole,
        recentActivity: recentActivities.data.length,
        workspaceCount: workspaces.data.length
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getTeamStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyTeamMembership(teamId: string, userId: string): Promise<void> {
    const isMember = await teamRepository.isMember(teamId, userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this team');
    }
  }

  private async verifyTeamAdminAccess(teamId: string, userId: string): Promise<void> {
    const role = await teamRepository.getMemberRole(teamId, userId);
    if (!role || !['admin', 'owner'].includes(role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  }

  private async verifyTeamOwnership(teamId: string, userId: string): Promise<void> {
    const role = await teamRepository.getMemberRole(teamId, userId);
    if (!role || role !== 'owner') {
      throw new ForbiddenError('Only the team owner can perform this action');
    }
  }

  private validateTeamData(data: TeamCreateData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Team name is required');
    }

    if (data.name.length > 100) {
      throw new ValidationError('Team name must be less than 100 characters');
    }

    if (data.description && data.description.length > 500) {
      throw new ValidationError('Team description must be less than 500 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Team color must be a valid hex color code');
    }
  }

  private validateTeamUpdateData(data: TeamUpdateData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Team name is required');
      }
      if (data.name.length > 100) {
        throw new ValidationError('Team name must be less than 100 characters');
      }
    }

    if (data.description !== undefined && data.description && data.description.length > 500) {
      throw new ValidationError('Team description must be less than 500 characters');
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      throw new ValidationError('Team color must be a valid hex color code');
    }
  }
}

// Export singleton instance
export const teamService = new TeamService();
