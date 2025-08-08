import { Team, TeamMemberRole } from '../entities/Team';
import { TeamId } from '../value-objects/TeamId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { ProjectId } from '../value-objects/ProjectId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TeamRepository } from '../repositories/TeamRepository';
import {
  WorkspacePermissionService,
  WorkspacePermission,
} from './WorkspacePermissionService';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface CreateTeamRequest {
  name: string;
  description?: string;
  color?: string;
  projectId?: ProjectId;
  settings?: {
    allowMemberInvites?: boolean;
    requireApprovalForTasks?: boolean;
    enableNotifications?: boolean;
    defaultTaskAssignment?: 'round_robin' | 'manual' | 'workload_based';
    maxTasksPerMember?: number;
    workingHours?: {
      start: string;
      end: string;
      days: number[];
    };
  };
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  color?: string;
  settings?: {
    allowMemberInvites?: boolean;
    requireApprovalForTasks?: boolean;
    enableNotifications?: boolean;
    defaultTaskAssignment?: 'round_robin' | 'manual' | 'workload_based';
    maxTasksPerMember?: number;
    workingHours?: {
      start: string;
      end: string;
      days: number[];
    };
  };
}

export interface TeamInvitationRequest {
  teamId: TeamId;
  userId: UserId;
  role: TeamMemberRole;
  invitedBy: UserId;
  message?: string;
}

export interface TeamAnalytics {
  memberStats: {
    total: number;
    leads: number;
    members: number;
    activeMembers: number;
  };
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    averageCompletionTime: number;
  };
  workloadStats: {
    distribution: Record<string, number>;
    averageTasksPerMember: number;
    mostActiveMembers: { userId: UserId; taskCount: number }[];
  };
  performanceStats: {
    completionRate: number;
    onTimeDeliveryRate: number;
    teamVelocity: number; // tasks completed per week
  };
}

export interface TeamWorkloadDistribution {
  userId: UserId;
  userName: string;
  currentTasks: number;
  completedTasks: number;
  overdueTasks: number;
  workloadPercentage: number;
  capacity: number;
  isOverloaded: boolean;
}

// Domain Events
export class TeamInvitationSentEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly invitedUserId: UserId,
    public readonly invitedBy: UserId,
    public readonly role: TeamMemberRole
  ) {
    super('TeamInvitationSent', {
      teamId: teamId.value,
      invitedUserId: invitedUserId.value,
      invitedBy: invitedBy.value,
      role,
    });
  }
}

export class TeamMemberJoinedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly memberId: UserId,
    public readonly role: TeamMemberRole
  ) {
    super('TeamMemberJoined', {
      teamId: teamId.value,
      memberId: memberId.value,
      role,
    });
  }
}

export class TeamMemberLeftEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly memberId: UserId,
    public readonly removedBy: UserId
  ) {
    super('TeamMemberLeft', {
      teamId: teamId.value,
      memberId: memberId.value,
      removedBy: removedBy.value,
    });
  }
}

export class TeamTaskAssignedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly taskId: string,
    public readonly assigneeId: UserId,
    public readonly assignmentStrategy: string
  ) {
    super('TeamTaskAssigned', {
      teamId: teamId.value,
      taskId,
      assigneeId: assigneeId.value,
      assignmentStrategy,
    });
  }
}

export class TeamService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly permissionService: WorkspacePermissionService
  ) {}

  /**
   * Create a new team
   */
  async createTeam(
    workspaceId: WorkspaceId,
    createdBy: UserId,
    request: CreateTeamRequest
  ): Promise<Team> {
    // Check permissions
    await this.permissionService.ensurePermission(
      createdBy,
      WorkspacePermission.TEAM_CREATE,
      { workspaceId, projectId: request.projectId }
    );

    // Check if team name is available
    const isNameAvailable = await this.teamRepository.isNameAvailable(
      workspaceId,
      request.name
    );
    if (!isNameAvailable) {
      throw new Error(
        `Team name '${request.name}' is already taken in this workspace`
      );
    }

    // Create team
    const team = Team.create(
      {
        workspaceId,
        projectId: request.projectId,
        name: request.name,
        description: request.description,
        color: request.color || '#3B82F6',
        settings: request.settings || {},
        members: [],
      },
      createdBy
    );

    // Add creator as team lead
    team.addMember(createdBy, TeamMemberRole.LEAD, createdBy);

    await this.teamRepository.save(team);
    return team;
  }

  /**
   * Update team details
   */
  async updateTeam(
    teamId: TeamId,
    userId: UserId,
    request: UpdateTeamRequest
  ): Promise<Team> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      userId,
      WorkspacePermission.TEAM_UPDATE
    );

    // Update team
    if (request.name) {
      // Check if new name is available
      const isNameAvailable = await this.teamRepository.isNameAvailable(
        team.workspaceId,
        request.name,
        teamId
      );
      if (!isNameAvailable) {
        throw new Error(
          `Team name '${request.name}' is already taken in this workspace`
        );
      }
      team.updateName(request.name);
    }

    if (request.description !== undefined) {
      team.updateDescription(request.description);
    }

    if (request.color) {
      team.updateColor(request.color);
    }

    if (request.settings) {
      team.updateSettings(request.settings);
    }

    await this.teamRepository.save(team);
    return team;
  }

  /**
   * Get team by ID with access control
   */
  async getTeamById(teamId: TeamId): Promise<Team> {
    const team = await this.teamRepository.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }
    return team;
  }

  /**
   * Get teams by workspace
   */
  async getTeamsByWorkspace(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<Team[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TEAM_VIEW,
      { workspaceId }
    );

    return await this.teamRepository.findByWorkspace(workspaceId);
  }

  /**
   * Get teams where user is a member
   */
  async getUserTeams(userId: UserId): Promise<Team[]> {
    return await this.teamRepository.findByMember(userId);
  }

  /**
   * Invite user to team
   */
  async inviteToTeam(request: TeamInvitationRequest): Promise<void> {
    const team = await this.getTeamById(request.teamId);

    // Check permissions
    if (!team.canUserInviteMembers(request.invitedBy)) {
      throw new Error(
        'You do not have permission to invite members to this team'
      );
    }

    // Check if user is already a member
    if (team.isMember(request.userId)) {
      throw new Error('User is already a member of this team');
    }

    // Add member to team
    team.addMember(request.userId, request.role, request.invitedBy);

    await this.teamRepository.save(team);

    // Emit domain event
    console.log(
      new TeamInvitationSentEvent(
        request.teamId,
        request.userId,
        request.invitedBy,
        request.role
      )
    );

    // In a real implementation, this would also send an email invitation
    console.log(
      `Invitation sent to user ${request.userId.value} for team ${team.name}`
    );
  }

  /**
   * Accept team invitation (join team)
   */
  async joinTeam(teamId: TeamId, userId: UserId): Promise<void> {
    const team = await this.getTeamById(teamId);

    // Check if user is already a member
    if (!team.isMember(userId)) {
      throw new Error('No invitation found for this team');
    }

    // Emit domain event
    const member = team.getMember(userId);
    if (member) {
      console.log(new TeamMemberJoinedEvent(teamId, userId, member.role));
    }

    // In a real implementation, this might update invitation status
    console.log(`User ${userId.value} joined team ${team.name}`);
  }

  /**
   * Remove member from team
   */
  async removeMember(
    teamId: TeamId,
    memberId: UserId,
    removedBy: UserId
  ): Promise<void> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      removedBy,
      WorkspacePermission.TEAM_MANAGE_MEMBERS
    );

    // Remove member
    team.removeMember(memberId, removedBy);

    await this.teamRepository.save(team);

    // Emit domain event
    console.log(new TeamMemberLeftEvent(teamId, memberId, removedBy));
  }

  /**
   * Change member role
   */
  async changeMemberRole(
    teamId: TeamId,
    memberId: UserId,
    newRole: TeamMemberRole,
    changedBy: UserId
  ): Promise<void> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      changedBy,
      WorkspacePermission.TEAM_MANAGE_MEMBERS
    );

    // Change role
    team.changeMemberRole(memberId, newRole, changedBy);

    await this.teamRepository.save(team);
  }

  /**
   * Leave team (self-removal)
   */
  async leaveTeam(teamId: TeamId, userId: UserId): Promise<void> {
    const team = await this.getTeamById(teamId);

    // Check if user is a member
    if (!team.isMember(userId)) {
      throw new Error('You are not a member of this team');
    }

    // Remove member
    team.removeMember(userId, userId);

    await this.teamRepository.save(team);

    // Emit domain event
    console.log(new TeamMemberLeftEvent(teamId, userId, userId));
  }

  /**
   * Get team analytics
   */
  async getTeamAnalytics(
    teamId: TeamId,
    userId: UserId
  ): Promise<TeamAnalytics> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      userId,
      WorkspacePermission.TEAM_VIEW
    );

    // Get team statistics
    const stats = await this.teamRepository.getTeamStats(teamId);

    const memberStats = {
      total: team.getMemberCount(),
      leads: team.getLeads().length,
      members: team.getRegularMembers().length,
      activeMembers: team.getMemberCount(), // Simplified
    };

    const taskStats = {
      total: stats.taskCount,
      completed: stats.completedTaskCount,
      inProgress: stats.taskCount - stats.completedTaskCount,
      overdue: 0, // Would be calculated from actual task data
      averageCompletionTime: stats.averageTaskCompletionTime,
    };

    const workloadStats = {
      distribution: stats.workloadDistribution,
      averageTasksPerMember: stats.taskCount / Math.max(stats.memberCount, 1),
      mostActiveMembers: Object.entries(stats.workloadDistribution)
        .map(([userId, taskCount]) => ({
          userId: UserId.fromString(userId),
          taskCount,
        }))
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 5),
    };

    const performanceStats = {
      completionRate:
        stats.taskCount > 0
          ? (stats.completedTaskCount / stats.taskCount) * 100
          : 0,
      onTimeDeliveryRate: 85, // Would be calculated from actual data
      teamVelocity: stats.completedTaskCount / 4, // Assuming 4 weeks
    };

    return {
      memberStats,
      taskStats,
      workloadStats,
      performanceStats,
    };
  }

  /**
   * Get team workload distribution
   */
  async getTeamWorkloadDistribution(
    teamId: TeamId,
    userId: UserId
  ): Promise<TeamWorkloadDistribution[]> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      userId,
      WorkspacePermission.TEAM_VIEW
    );

    const stats = await this.teamRepository.getTeamStats(teamId);
    const maxTasks = team.settings.maxTasksPerMember || 10;

    const distribution: TeamWorkloadDistribution[] = [];

    for (const member of team.members) {
      const currentTasks = stats.workloadDistribution[member.userId.value] || 0;
      const workloadPercentage = (currentTasks / maxTasks) * 100;

      distribution.push({
        userId: member.userId,
        userName: `User ${member.userId.value}`, // Would be fetched from user service
        currentTasks,
        completedTasks: 0, // Would be calculated from actual data
        overdueTasks: 0, // Would be calculated from actual data
        workloadPercentage,
        capacity: maxTasks,
        isOverloaded: workloadPercentage > 100,
      });
    }

    return distribution.sort(
      (a, b) => b.workloadPercentage - a.workloadPercentage
    );
  }

  /**
   * Assign task to team member using team's assignment strategy
   */
  async assignTaskToTeam(
    teamId: TeamId,
    taskId: string,
    assignedBy: UserId,
    preferredAssignee?: UserId
  ): Promise<UserId | null> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      assignedBy,
      WorkspacePermission.TASK_ASSIGN
    );

    let assigneeId: UserId | null = null;

    if (preferredAssignee && team.isMember(preferredAssignee)) {
      // Use preferred assignee if they're a team member
      assigneeId = preferredAssignee;
    } else {
      // Use team's assignment strategy
      const stats = await this.teamRepository.getTeamStats(teamId);
      const currentAssignments = new Map(
        Object.entries(stats.workloadDistribution).map(([userId, count]) => [
          userId,
          count,
        ])
      );

      assigneeId = team.getNextAssignee(currentAssignments);
    }

    if (assigneeId) {
      // Emit domain event
      console.log(
        new TeamTaskAssignedEvent(
          teamId,
          taskId,
          assigneeId,
          team.settings.defaultTaskAssignment || 'manual'
        )
      );
    }

    return assigneeId;
  }

  /**
   * Get teams with capacity for new tasks
   */
  async getTeamsWithCapacity(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<Team[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TEAM_VIEW,
      { workspaceId }
    );

    return await this.teamRepository.findTeamsWithCapacity(workspaceId);
  }

  /**
   * Search teams
   */
  async searchTeams(
    workspaceId: WorkspaceId,
    userId: UserId,
    query: string
  ): Promise<Team[]> {
    // Check permissions
    await this.permissionService.ensurePermission(
      userId,
      WorkspacePermission.TEAM_VIEW,
      { workspaceId }
    );

    return await this.teamRepository.search(workspaceId, query);
  }

  /**
   * Delete team
   */
  async deleteTeam(teamId: TeamId, userId: UserId): Promise<void> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      userId,
      WorkspacePermission.TEAM_DELETE
    );

    // Only team leads can delete the team
    if (!team.isLead(userId)) {
      throw new Error('Only team leads can delete the team');
    }

    await this.teamRepository.delete(teamId);
  }

  /**
   * Get team performance metrics
   */
  async getTeamPerformanceMetrics(
    teamId: TeamId,
    userId: UserId,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    tasksCompleted: number;
    averageCompletionTime: number;
    onTimeDeliveryRate: number;
    memberProductivity: {
      userId: UserId;
      tasksCompleted: number;
      efficiency: number;
    }[];
    trendData: { date: string; tasksCompleted: number; tasksCreated: number }[];
  }> {
    const team = await this.getTeamById(teamId);

    // Check permissions
    await this.ensureTeamPermission(
      team,
      userId,
      WorkspacePermission.TEAM_VIEW
    );

    // Get basic stats
    const stats = await this.teamRepository.getTeamStats(teamId);

    // Calculate period-specific metrics
    const periodMultiplier =
      period === 'week' ? 1 : period === 'month' ? 4 : 12;
    const tasksCompleted = Math.floor(
      stats.completedTaskCount / periodMultiplier
    );

    const memberProductivity = Object.entries(stats.workloadDistribution).map(
      ([userId, taskCount]) => ({
        userId: UserId.fromString(userId),
        tasksCompleted: Math.floor(taskCount / periodMultiplier),
        efficiency: Math.random() * 0.3 + 0.7, // Mock efficiency between 0.7-1.0
      })
    );

    // Mock trend data
    const trendData = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      tasksCompleted: Math.floor(Math.random() * 10),
      tasksCreated: Math.floor(Math.random() * 12),
    }));

    return {
      tasksCompleted,
      averageCompletionTime: stats.averageTaskCompletionTime,
      onTimeDeliveryRate: 85 + Math.random() * 10, // Mock rate between 85-95%
      memberProductivity,
      trendData,
    };
  }

  /**
   * Check if user can access team
   */
  private async canUserAccessTeam(
    team: Team,
    userId: UserId
  ): Promise<boolean> {
    // Team members always have access
    if (team.isMember(userId)) {
      return true;
    }

    // Check workspace-level permissions
    const hasWorkspaceAccess = await this.permissionService.checkPermission(
      userId,
      WorkspacePermission.TEAM_VIEW,
      { workspaceId: team.workspaceId, projectId: team.projectId }
    );

    return hasWorkspaceAccess.granted;
  }

  /**
   * Ensure user has team permission
   */
  private async ensureTeamPermission(
    team: Team,
    userId: UserId,
    permission: WorkspacePermission
  ): Promise<void> {
    // Team leads have all permissions
    if (team.isLead(userId)) {
      return;
    }

    // Check workspace-level permission
    const result = await this.permissionService.checkPermission(
      userId,
      permission,
      {
        workspaceId: team.workspaceId,
        projectId: team.projectId,
      }
    );

    if (!result.granted) {
      throw new Error(
        result.reason || `Access denied: ${permission} permission required`
      );
    }
  }
}
