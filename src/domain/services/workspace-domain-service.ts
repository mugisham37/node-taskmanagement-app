import { Workspace, WorkspaceMember } from '../entities/workspace';
import { Project } from '../entities/project';
import { WorkspaceId, UserId } from '../value-objects';
import { DomainError } from '../../shared/errors';

/**
 * Workspace Access Result interface
 */
export interface WorkspaceAccessResult {
  hasAccess: boolean;
  reason?: string;
  requiredRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

/**
 * Workspace Health Assessment interface
 */
export interface WorkspaceHealthAssessment {
  score: number; // 0-100
  status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  issues: string[];
  recommendations: string[];
  metrics: {
    activeProjects: number;
    totalProjects: number;
    activeMembersPercentage: number;
    averageProjectHealth: number;
  };
}

/**
 * Member Invitation Validation interface
 */
export interface MemberInvitationValidation {
  isValid: boolean;
  reason?: string;
  warnings?: string[] | undefined;
}

/**
 * Workspace Capacity Analysis interface
 */
export interface WorkspaceCapacityAnalysis {
  currentCapacity: number; // 0-100%
  recommendedActions: string[];
  bottlenecks: string[];
  growthPotential: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Workspace Domain Service
 * Handles workspace-level operations and access control
 */
export class WorkspaceDomainService {
  /**
   * Create a new workspace
   */
  async createWorkspace(data: {
    name: string;
    description: string;
    ownerId: UserId;
  }): Promise<Workspace> {
    const workspaceId = WorkspaceId.generate();
    
    return new Workspace(
      workspaceId,
      data.name,
      data.description,
      data.ownerId,
      true
    );
  }

  /**
   * Check if user can update workspace
   */
  canUserUpdateWorkspace(workspace: Workspace, userId: UserId): boolean {
    return workspace.canUserUpdateWorkspace(userId);
  }

  /**
   * Invite user to workspace
   */
  async inviteUserToWorkspace(
    workspace: Workspace,
    inviteeEmail: string,
    invitedBy: UserId
  ): Promise<void> {
    if (!workspace.canUserManageMembers(invitedBy)) {
      throw new DomainError('User does not have permission to invite members');
    }

    // In a real implementation, this would create an invitation record
    // and the user would accept it to become a member
    console.log(`Invitation sent to ${inviteeEmail} for workspace ${workspace.name}`);
  }

  /**
   * Remove user from workspace
   */
  async removeUserFromWorkspace(
    workspace: Workspace,
    userIdToRemove: UserId,
    removedBy: UserId
  ): Promise<void> {
    if (!workspace.canUserManageMembers(removedBy)) {
      throw new DomainError('User does not have permission to remove members');
    }

    if (workspace.ownerId.equals(userIdToRemove)) {
      throw new DomainError('Cannot remove workspace owner');
    }

    workspace.removeMember(userIdToRemove);
  }

  /**
   * Transfer workspace ownership
   */
  async transferOwnership(
    workspace: Workspace,
    newOwnerId: UserId,
    currentOwnerId: UserId
  ): Promise<void> {
    if (!workspace.ownerId.equals(currentOwnerId)) {
      throw new DomainError('Only the workspace owner can transfer ownership');
    }

    if (!workspace.isMember(newOwnerId)) {
      throw new DomainError('New owner must be a member of the workspace');
    }

    workspace.transferOwnership(newOwnerId, currentOwnerId);
  }

  /**
   * Archive workspace
   */
  async archiveWorkspace(workspace: Workspace, userId: UserId): Promise<void> {
    if (!workspace.ownerId.equals(userId)) {
      throw new DomainError('Only the workspace owner can archive the workspace');
    }

    workspace.archive();
  }

  /**
   * Validate user access to perform an action on a workspace
   */
  validateUserAccess(
    workspace: Workspace,
    userId: UserId,
    requiredAction: string
  ): WorkspaceAccessResult {
    // Check if workspace is active
    if (!workspace.isActive) {
      return {
        hasAccess: false,
        reason: 'Workspace is not active',
      };
    }

    // Check if user is a member
    if (!workspace.isMember(userId)) {
      return {
        hasAccess: false,
        reason: 'User is not a member of this workspace',
      };
    }

    const userRole = workspace.getUserRole(userId);
    if (!userRole) {
      return {
        hasAccess: false,
        reason: 'User role not found',
      };
    }

    // Check specific permissions based on action
    switch (requiredAction) {
      case 'CREATE_PROJECT':
        if (!workspace.canUserCreateProject(userId)) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to create projects',
            requiredRole: 'ADMIN',
          };
        }
        break;

      case 'MANAGE_MEMBERS':
        if (!workspace.canUserManageMembers(userId)) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to manage members',
            requiredRole: 'ADMIN',
          };
        }
        break;

      case 'UPDATE_WORKSPACE':
        if (!workspace.canUserUpdateWorkspace(userId)) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to update workspace',
            requiredRole: 'ADMIN',
          };
        }
        break;

      case 'DELETE_WORKSPACE':
        if (!workspace.canUserDeleteWorkspace(userId)) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to delete workspace',
            requiredRole: 'OWNER',
          };
        }
        break;

      case 'VIEW_ANALYTICS':
        if (userRole === 'MEMBER') {
          return {
            hasAccess: false,
            reason: 'Members cannot view workspace analytics',
            requiredRole: 'ADMIN',
          };
        }
        break;

      case 'TRANSFER_OWNERSHIP':
        if (userRole !== 'OWNER') {
          return {
            hasAccess: false,
            reason: 'Only the owner can transfer ownership',
            requiredRole: 'OWNER',
          };
        }
        break;

      default:
        return {
          hasAccess: false,
          reason: 'Unknown action',
        };
    }

    return { hasAccess: true };
  }

  /**
   * Assess workspace health based on various metrics
   */
  assessWorkspaceHealth(
    workspace: Workspace,
    projects: Project[],
    memberActivity: Map<string, Date>, // userId -> last activity date
    projectHealthScores: Map<string, number> // projectId -> health score
  ): WorkspaceHealthAssessment {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if workspace is active
    if (!workspace.isActive) {
      score -= 50;
      issues.push('Workspace is inactive');
      recommendations.push('Activate the workspace to resume operations');
    }

    // Check project activity
    const activeProjects = projects.filter(p => p.isActive()).length;
    const totalProjects = projects.length;

    if (totalProjects === 0) {
      score -= 30;
      issues.push('No projects in workspace');
      recommendations.push('Create projects to start organizing work');
    } else if (activeProjects === 0) {
      score -= 40;
      issues.push('No active projects');
      recommendations.push('Activate existing projects or create new ones');
    } else if (activeProjects / totalProjects < 0.3) {
      score -= 20;
      issues.push('Low percentage of active projects');
      recommendations.push('Review and activate stalled projects');
    }

    // Check member activity
    const activeMembersCount = this.getActiveMembersCount(
      workspace.members,
      memberActivity,
      14
    ); // 14 days
    const activeMembersPercentage =
      workspace.members.length > 0
        ? (activeMembersCount / workspace.members.length) * 100
        : 0;

    if (activeMembersPercentage < 50) {
      score -= 25;
      issues.push('Low member activity');
      recommendations.push(
        'Engage inactive members or remove them from the workspace'
      );
    } else if (activeMembersPercentage < 70) {
      score -= 10;
      issues.push('Some members are inactive');
      recommendations.push('Check in with inactive members');
    }

    // Check project health scores
    const projectHealthValues = Array.from(projectHealthScores.values());
    const averageProjectHealth =
      projectHealthValues.length > 0
        ? projectHealthValues.reduce((sum, score) => sum + score, 0) /
          projectHealthValues.length
        : 0;

    if (averageProjectHealth < 60) {
      score -= 20;
      issues.push('Poor average project health');
      recommendations.push('Address issues in underperforming projects');
    } else if (averageProjectHealth < 80) {
      score -= 10;
      issues.push('Below average project health');
      recommendations.push('Monitor project progress more closely');
    }

    // Check workspace structure
    const adminCount = workspace.members.filter(m => m.role === 'ADMIN').length;
    const memberCount = workspace.members.length;

    if (memberCount > 10 && adminCount === 0) {
      score -= 15;
      issues.push('Large workspace without administrators');
      recommendations.push('Promote some members to administrator role');
    }

    // Check for workspace growth stagnation
    if (totalProjects > 0 && activeProjects === 0) {
      score -= 15;
      issues.push('Workspace growth has stagnated');
      recommendations.push('Plan new initiatives or revive existing projects');
    }

    // Determine status
    let status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
    if (score >= 80) {
      status = 'HEALTHY';
    } else if (score >= 60) {
      status = 'AT_RISK';
    } else {
      status = 'CRITICAL';
    }

    return {
      score: Math.max(0, score),
      status,
      issues,
      recommendations,
      metrics: {
        activeProjects,
        totalProjects,
        activeMembersPercentage,
        averageProjectHealth,
      },
    };
  }

  /**
   * Validate member invitation
   */
  validateMemberInvitation(
    workspace: Workspace,
    inviteeUserId: UserId,
    role: 'ADMIN' | 'MEMBER',
    invitedBy: UserId
  ): MemberInvitationValidation {
    const warnings: string[] = [];

    // Check if workspace is active
    if (!workspace.isActive) {
      return {
        isValid: false,
        reason: 'Cannot invite members to inactive workspace',
      };
    }

    // Check if inviter has permission
    if (!workspace.canUserManageMembers(invitedBy)) {
      return {
        isValid: false,
        reason: 'User does not have permission to invite members',
      };
    }

    // Check if user is already a member
    if (workspace.isMember(inviteeUserId)) {
      return {
        isValid: false,
        reason: 'User is already a member of this workspace',
      };
    }

    // Check workspace capacity (business rule: max 50 members per workspace)
    const maxMembers = 50;
    if (workspace.getMemberCount() >= maxMembers) {
      return {
        isValid: false,
        reason: `Workspace has reached maximum capacity of ${maxMembers} members`,
      };
    }

    // Warning if inviting as admin
    if (role === 'ADMIN') {
      const adminCount = workspace.members.filter(
        m => m.role === 'ADMIN'
      ).length;
      const memberCount = workspace.members.length;

      if (adminCount / memberCount > 0.3) {
        warnings.push('High percentage of administrators in workspace');
      }
    }

    // Warning if workspace is getting large
    if (workspace.getMemberCount() > 30) {
      warnings.push(
        'Large workspace may benefit from being split into smaller teams'
      );
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Analyze workspace capacity and utilization
   */
  analyzeWorkspaceCapacity(
    workspace: Workspace,
    projects: Project[],
    totalTasks: number,
    completedTasks: number,
    memberActivity: Map<string, Date>
  ): WorkspaceCapacityAnalysis {
    const recommendedActions: string[] = [];
    const bottlenecks: string[] = [];

    // Calculate current capacity utilization
    const activeMembers = this.getActiveMembersCount(
      workspace.members,
      memberActivity,
      7
    );
    const activeProjects = projects.filter(p => p.isActive()).length;
    const tasksPerActiveMember =
      activeMembers > 0 ? totalTasks / activeMembers : 0;
    const projectsPerActiveMember =
      activeMembers > 0 ? activeProjects / activeMembers : 0;

    // Base capacity calculation (0-100%)
    let currentCapacity = 0;

    // Factor 1: Task load per member
    if (tasksPerActiveMember > 15) {
      currentCapacity += 40; // High task load
      bottlenecks.push('High task load per member');
      recommendedActions.push(
        'Consider adding more team members or redistributing tasks'
      );
    } else if (tasksPerActiveMember > 10) {
      currentCapacity += 25; // Medium task load
    } else if (tasksPerActiveMember > 5) {
      currentCapacity += 15; // Low task load
    }

    // Factor 2: Project load per member
    if (projectsPerActiveMember > 3) {
      currentCapacity += 30; // High project load
      bottlenecks.push('Too many projects per active member');
      recommendedActions.push(
        'Focus on fewer projects or add project managers'
      );
    } else if (projectsPerActiveMember > 2) {
      currentCapacity += 20; // Medium project load
    } else if (projectsPerActiveMember > 1) {
      currentCapacity += 10; // Low project load
    }

    // Factor 3: Member activity level
    const activityRate =
      workspace.members.length > 0
        ? activeMembers / workspace.members.length
        : 0;
    if (activityRate < 0.5) {
      currentCapacity += 20; // Low activity indicates underutilization
      bottlenecks.push('Low member activity rate');
      recommendedActions.push(
        'Engage inactive members or remove them from workspace'
      );
    } else if (activityRate > 0.9) {
      currentCapacity += 10; // High activity
    }

    // Factor 4: Completion rate
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
    if (completionRate < 0.3) {
      bottlenecks.push('Low task completion rate');
      recommendedActions.push('Review task assignments and remove blockers');
    }

    // Determine growth potential
    let growthPotential: 'LOW' | 'MEDIUM' | 'HIGH';

    if (currentCapacity > 80) {
      growthPotential = 'LOW';
      recommendedActions.push(
        'Consider expanding team or optimizing processes'
      );
    } else if (currentCapacity > 50) {
      growthPotential = 'MEDIUM';
      recommendedActions.push('Monitor capacity and plan for growth');
    } else {
      growthPotential = 'HIGH';
      recommendedActions.push(
        'Workspace has room for more projects and members'
      );
    }

    // Additional recommendations based on workspace size
    if (workspace.getMemberCount() < 3 && activeProjects > 1) {
      recommendedActions.push(
        'Consider adding more team members for better project coverage'
      );
    }

    if (workspace.getProjectCount() === 0) {
      recommendedActions.push('Create projects to organize work effectively');
    }

    return {
      currentCapacity: Math.min(100, currentCapacity),
      recommendedActions,
      bottlenecks,
      growthPotential,
    };
  }

  /**
   * Calculate optimal workspace structure
   */
  calculateOptimalStructure(
    memberCount: number,
    projectCount: number,
    workspaceComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX'
  ): {
    recommendedAdmins: number;
    recommendedProjectsPerMember: number;
    recommendedTeamSize: number;
    shouldSplit: boolean;
    reasoning: string;
  } {
    let recommendedAdmins: number;
    let recommendedProjectsPerMember: number;
    let recommendedTeamSize: number;
    let shouldSplit = false;

    // Calculate recommended admins based on member count and complexity
    switch (workspaceComplexity) {
      case 'SIMPLE':
        recommendedAdmins = Math.max(1, Math.ceil(memberCount / 15));
        recommendedProjectsPerMember = 1.5;
        recommendedTeamSize = Math.min(10, memberCount);
        break;
      case 'MODERATE':
        recommendedAdmins = Math.max(1, Math.ceil(memberCount / 10));
        recommendedProjectsPerMember = 1.2;
        recommendedTeamSize = Math.min(8, memberCount);
        break;
      case 'COMPLEX':
        recommendedAdmins = Math.max(2, Math.ceil(memberCount / 8));
        recommendedProjectsPerMember = 1.0;
        recommendedTeamSize = Math.min(6, memberCount);
        break;
    }

    // Check if workspace should be split
    if (memberCount > 25 || projectCount > 15) {
      shouldSplit = true;
    }

    const reasoning =
      `For a ${workspaceComplexity.toLowerCase()} workspace with ${memberCount} members and ${projectCount} projects, ` +
      `recommended structure includes ${recommendedAdmins} admin(s) with approximately ${recommendedProjectsPerMember} projects per member.`;

    return {
      recommendedAdmins,
      recommendedProjectsPerMember,
      recommendedTeamSize,
      shouldSplit,
      reasoning,
    };
  }

  /**
   * Validate workspace deletion
   */
  validateWorkspaceDeletion(
    workspace: Workspace,
    projects: Project[],
    userId: UserId
  ): { canDelete: boolean; reason?: string; warnings?: string[] | undefined } {
    const warnings: string[] = [];

    // Check if user is the owner
    if (!workspace.canUserDeleteWorkspace(userId)) {
      return {
        canDelete: false,
        reason: 'Only the workspace owner can delete the workspace',
      };
    }

    // Check for active projects
    const activeProjects = projects.filter(p => p.isActive()).length;
    if (activeProjects > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete workspace with ${activeProjects} active project(s)`,
      };
    }

    // Warnings for completed projects
    const completedProjects = projects.filter(p => p.isCompleted()).length;
    if (completedProjects > 0) {
      warnings.push(
        `${completedProjects} completed project(s) will be permanently deleted`
      );
    }

    // Warning for multiple members
    if (workspace.getMemberCount() > 1) {
      warnings.push(
        `${workspace.getMemberCount()} member(s) will lose access to this workspace`
      );
    }

    return {
      canDelete: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get count of active members (active within specified days)
   */
  private getActiveMembersCount(
    members: WorkspaceMember[],
    memberActivity: Map<string, Date>,
    activeDays: number
  ): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - activeDays);

    return members.filter(member => {
      const lastActivity = memberActivity.get(member.userId.toString());
      return lastActivity && lastActivity >= cutoffDate;
    }).length;
  }
}
