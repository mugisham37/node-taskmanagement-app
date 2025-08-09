import { Project, ProjectMember } from '../entities/project';
import { Task } from '../entities/task';
import {
  ProjectId,
  UserId,
  ProjectRoleVO,
  ProjectStatusVO,
} from '../value-objects';
import {
  ProjectRole,
  ProjectStatus,
} from '../../shared/constants/project-constants';
import { DomainError } from '../../shared/errors';

/**
 * Project Access Result interface
 */
export interface ProjectAccessResult {
  hasAccess: boolean;
  reason?: string;
  requiredRole?: ProjectRole;
}

/**
 * Project Health Assessment interface
 */
export interface ProjectHealthAssessment {
  score: number; // 0-100
  status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  issues: string[];
  recommendations: string[];
}

/**
 * Project Completion Readiness interface
 */
export interface ProjectCompletionReadiness {
  canComplete: boolean;
  reason?: string;
  incompleteTasks: number;
  blockers: string[];
}

/**
 * Member Role Change Validation interface
 */
export interface MemberRoleChangeValidation {
  isValid: boolean;
  reason?: string;
  warnings?: string[];
}

/**
 * Project Domain Service
 * Handles project-level business logic and permissions
 */
export class ProjectDomainService {
  /**
   * Validate user access to perform an action on a project
   */
  validateUserAccess(
    project: Project,
    userId: UserId,
    requiredAction: string
  ): ProjectAccessResult {
    // Check if user is a member
    if (!project.isMember(userId)) {
      return {
        hasAccess: false,
        reason: 'User is not a member of this project',
      };
    }

    const userRole = project.getUserRole(userId);
    if (!userRole) {
      return {
        hasAccess: false,
        reason: 'User role not found',
      };
    }

    // Check specific permissions based on action
    switch (requiredAction) {
      case 'CREATE_TASK':
        if (!userRole.canCreateTasks()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to create tasks',
            requiredRole: ProjectRole.MEMBER,
          };
        }
        break;

      case 'UPDATE_TASK':
        if (!userRole.canUpdateTasks()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to update tasks',
            requiredRole: ProjectRole.MEMBER,
          };
        }
        break;

      case 'DELETE_TASK':
        if (!userRole.canDeleteTasks()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to delete tasks',
            requiredRole: ProjectRole.MANAGER,
          };
        }
        break;

      case 'ASSIGN_TASK':
        if (!userRole.canAssignTasks()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to assign tasks',
            requiredRole: ProjectRole.MEMBER,
          };
        }
        break;

      case 'MANAGE_MEMBERS':
        if (!userRole.canManageMembers()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to manage members',
            requiredRole: ProjectRole.MANAGER,
          };
        }
        break;

      case 'UPDATE_PROJECT':
        if (!userRole.canUpdateProject()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to update project',
            requiredRole: ProjectRole.MANAGER,
          };
        }
        break;

      case 'DELETE_PROJECT':
        if (!userRole.canDeleteProject()) {
          return {
            hasAccess: false,
            reason: 'User does not have permission to delete project',
            requiredRole: ProjectRole.OWNER,
          };
        }
        break;

      default:
        return {
          hasAccess: false,
          reason: 'Unknown action',
        };
    }

    // Check if project status allows the action
    if (
      !project.status.canBeModified() &&
      [
        'CREATE_TASK',
        'UPDATE_TASK',
        'DELETE_TASK',
        'ASSIGN_TASK',
        'MANAGE_MEMBERS',
      ].includes(requiredAction)
    ) {
      return {
        hasAccess: false,
        reason: `Action not allowed for project with status ${project.status.value}`,
      };
    }

    return { hasAccess: true };
  }

  /**
   * Assess project health based on various metrics
   */
  assessProjectHealth(
    project: Project,
    tasks: Task[],
    memberActivity: Map<string, Date> // userId -> last activity date
  ): ProjectHealthAssessment {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check project status
    if (project.status.isOnHold()) {
      score -= 20;
      issues.push('Project is on hold');
      recommendations.push('Review project status and reactivate if possible');
    }

    // Check task completion rate
    const completedTasks = tasks.filter(t => t.isCompleted()).length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    if (completionRate < 0.3 && totalTasks > 5) {
      score -= 25;
      issues.push('Low task completion rate');
      recommendations.push('Review task assignments and remove blockers');
    } else if (completionRate < 0.6 && totalTasks > 10) {
      score -= 15;
      issues.push('Below average task completion rate');
      recommendations.push('Monitor task progress more closely');
    }

    // Check overdue tasks
    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    const overdueRate = totalTasks > 0 ? overdueTasks / totalTasks : 0;

    if (overdueRate > 0.3) {
      score -= 30;
      issues.push('High number of overdue tasks');
      recommendations.push('Reassess task priorities and deadlines');
    } else if (overdueRate > 0.1) {
      score -= 15;
      issues.push('Some tasks are overdue');
      recommendations.push('Follow up on overdue tasks');
    }

    // Check member activity
    const inactiveMembers = this.getInactiveMembers(
      project.members,
      memberActivity,
      7
    ); // 7 days
    if (inactiveMembers.length > 0) {
      score -= inactiveMembers.length * 5;
      issues.push(`${inactiveMembers.length} inactive members`);
      recommendations.push('Check in with inactive team members');
    }

    // Check if project has too few managers
    const managers = project.members.filter(
      m => m.role.isOwner() || m.role.isManager()
    ).length;

    if (managers < 1 && project.members.length > 5) {
      score -= 20;
      issues.push('Insufficient project management');
      recommendations.push('Promote additional members to manager role');
    }

    // Check task assignment distribution
    const assignedTasks = tasks.filter(t => t.isAssigned()).length;
    const unassignedRate =
      totalTasks > 0 ? (totalTasks - assignedTasks) / totalTasks : 0;

    if (unassignedRate > 0.5) {
      score -= 20;
      issues.push('Many tasks are unassigned');
      recommendations.push('Assign tasks to team members');
    }

    // Check project timeline
    if (
      project.endDate &&
      project.endDate < new Date() &&
      !project.isCompleted()
    ) {
      score -= 25;
      issues.push('Project is past its end date');
      recommendations.push('Review project timeline and update status');
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
    };
  }

  /**
   * Check if a project is ready for completion
   */
  checkCompletionReadiness(
    project: Project,
    tasks: Task[]
  ): ProjectCompletionReadiness {
    const blockers: string[] = [];

    // Check if project status allows completion
    if (!project.status.canTransitionTo(ProjectStatus.COMPLETED)) {
      blockers.push(
        `Cannot complete project from ${project.status.value} status`
      );
    }

    // Check incomplete tasks
    const incompleteTasks = tasks.filter(
      t => !t.isCompleted() && !t.status.isCancelled()
    ).length;

    if (incompleteTasks > 0) {
      blockers.push(`${incompleteTasks} tasks are still incomplete`);
    }

    // Check for tasks in progress
    const tasksInProgress = tasks.filter(t => t.isInProgress()).length;
    if (tasksInProgress > 0) {
      blockers.push(`${tasksInProgress} tasks are still in progress`);
    }

    // Check for overdue tasks
    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    if (overdueTasks > 0) {
      blockers.push(`${overdueTasks} tasks are overdue`);
    }

    return {
      canComplete: blockers.length === 0,
      reason: blockers.length > 0 ? blockers.join('; ') : undefined,
      incompleteTasks,
      blockers,
    };
  }

  /**
   * Validate member role change
   */
  validateMemberRoleChange(
    project: Project,
    targetUserId: UserId,
    newRole: ProjectRoleVO,
    changedBy: UserId
  ): MemberRoleChangeValidation {
    const warnings: string[] = [];

    // Check if the person making the change has permission
    const changerRole = project.getUserRole(changedBy);
    if (!changerRole || !changerRole.canManageMembers()) {
      return {
        isValid: false,
        reason: 'User does not have permission to change member roles',
      };
    }

    // Check if target user is a member
    const targetMember = project.members.find(m =>
      m.userId.equals(targetUserId)
    );
    if (!targetMember) {
      return {
        isValid: false,
        reason: 'Target user is not a member of this project',
      };
    }

    // Cannot change the project owner's role
    if (targetUserId.equals(project.managerId) && targetMember.role.isOwner()) {
      return {
        isValid: false,
        reason: "Cannot change the project owner's role",
      };
    }

    // Check if we're demoting the last manager
    const currentManagers = project.members.filter(
      m => m.role.isOwner() || m.role.isManager()
    ).length;

    if (
      (targetMember.role.isOwner() || targetMember.role.isManager()) &&
      !(newRole.isOwner() || newRole.isManager()) &&
      currentManagers <= 1
    ) {
      return {
        isValid: false,
        reason: 'Cannot demote the last manager in the project',
      };
    }

    // Warning if promoting to manager without sufficient experience
    if (newRole.isManager() && !targetMember.role.isManager()) {
      const memberAge = Date.now() - targetMember.joinedAt.getTime();
      const daysSinceMember = memberAge / (1000 * 60 * 60 * 24);

      if (daysSinceMember < 7) {
        warnings.push('User has been a member for less than a week');
      }
    }

    // Warning if demoting a manager with active task assignments
    if (targetMember.role.isManager() && !newRole.isManager()) {
      warnings.push('Consider reassigning any tasks managed by this user');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Calculate optimal team size for a project
   */
  calculateOptimalTeamSize(
    estimatedTasks: number,
    projectDurationWeeks: number,
    taskComplexity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): {
    recommended: number;
    minimum: number;
    maximum: number;
    reasoning: string;
  } {
    // Base calculation: tasks per person per week
    let tasksPerPersonPerWeek: number;

    switch (taskComplexity) {
      case 'LOW':
        tasksPerPersonPerWeek = 8;
        break;
      case 'MEDIUM':
        tasksPerPersonPerWeek = 5;
        break;
      case 'HIGH':
        tasksPerPersonPerWeek = 3;
        break;
    }

    const totalPersonWeeks = estimatedTasks / tasksPerPersonPerWeek;
    const recommended = Math.ceil(totalPersonWeeks / projectDurationWeeks);

    // Apply constraints
    const minimum = Math.max(2, Math.ceil(recommended * 0.7)); // At least 2 people
    const maximum = Math.min(12, Math.ceil(recommended * 1.5)); // Max 12 people (communication overhead)

    const reasoning = `Based on ${estimatedTasks} ${taskComplexity.toLowerCase()} complexity tasks over ${projectDurationWeeks} weeks, assuming ${tasksPerPersonPerWeek} tasks per person per week.`;

    return {
      recommended: Math.max(minimum, Math.min(maximum, recommended)),
      minimum,
      maximum,
      reasoning,
    };
  }

  /**
   * Get project velocity (tasks completed per week)
   */
  calculateProjectVelocity(
    completedTasks: Task[],
    projectStartDate: Date
  ): {
    tasksPerWeek: number;
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    weeklyBreakdown: { week: number; tasks: number }[];
  } {
    const now = new Date();
    const projectAgeWeeks = Math.ceil(
      (now.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
    );

    // Group completed tasks by week
    const weeklyBreakdown: { week: number; tasks: number }[] = [];

    for (let week = 1; week <= projectAgeWeeks; week++) {
      const weekStart = new Date(projectStartDate);
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const tasksCompletedThisWeek = completedTasks.filter(task => {
        const completedAt = task.completedAt;
        return completedAt && completedAt >= weekStart && completedAt < weekEnd;
      }).length;

      weeklyBreakdown.push({ week, tasks: tasksCompletedThisWeek });
    }

    const totalTasks = completedTasks.length;
    const tasksPerWeek = projectAgeWeeks > 0 ? totalTasks / projectAgeWeeks : 0;

    // Calculate trend (compare last 2 weeks with previous 2 weeks)
    let trend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';

    if (weeklyBreakdown.length >= 4) {
      const recentWeeks = weeklyBreakdown.slice(-2);
      const previousWeeks = weeklyBreakdown.slice(-4, -2);

      const recentAvg = recentWeeks.reduce((sum, w) => sum + w.tasks, 0) / 2;
      const previousAvg =
        previousWeeks.reduce((sum, w) => sum + w.tasks, 0) / 2;

      if (recentAvg > previousAvg * 1.2) {
        trend = 'INCREASING';
      } else if (recentAvg < previousAvg * 0.8) {
        trend = 'DECREASING';
      }
    }

    return {
      tasksPerWeek,
      trend,
      weeklyBreakdown,
    };
  }

  /**
   * Get inactive members (haven't been active for specified days)
   */
  private getInactiveMembers(
    members: ProjectMember[],
    memberActivity: Map<string, Date>,
    inactiveDays: number
  ): ProjectMember[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    return members.filter(member => {
      const lastActivity = memberActivity.get(member.userId.toString());
      return !lastActivity || lastActivity < cutoffDate;
    });
  }
}
