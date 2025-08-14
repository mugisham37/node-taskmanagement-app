import { Workspace, WorkspaceMember } from '../entities/workspace';
import { Project } from '../entities/project';
import { User } from '../entities/user';
import { UserId } from '../value-objects';
import { Specification } from './task-specifications';

/**
 * Workspace is active specification
 */
export class WorkspaceIsActiveSpecification extends Specification<Workspace> {
  isSatisfiedBy(workspace: Workspace): boolean {
    return workspace.isActive;
  }
}

/**
 * User is workspace owner specification
 */
export class UserIsWorkspaceOwnerSpecification extends Specification<{
  workspace: Workspace;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { workspace: Workspace; userId: UserId }): boolean {
    const { workspace, userId } = candidate;
    return userId.equals(workspace.ownerId);
  }
}

/**
 * User can manage workspace members specification
 */
export class UserCanManageWorkspaceMembersSpecification extends Specification<{
  workspace: Workspace;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { workspace: Workspace; userId: UserId }): boolean {
    const { workspace, userId } = candidate;
    return workspace.canUserManageMembers(userId);
  }
}

/**
 * User can create projects in workspace specification
 */
export class UserCanCreateProjectsInWorkspaceSpecification extends Specification<{
  workspace: Workspace;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { workspace: Workspace; userId: UserId }): boolean {
    const { workspace, userId } = candidate;
    return workspace.canUserCreateProject(userId);
  }
}

/**
 * Workspace is within member limit specification
 */
export class WorkspaceIsWithinMemberLimitSpecification extends Specification<Workspace> {
  constructor(private maxMembers: number = 50) {
    super();
  }

  isSatisfiedBy(workspace: Workspace): boolean {
    return workspace.getMemberCount() <= this.maxMembers;
  }
}

/**
 * Workspace is within project limit specification
 */
export class WorkspaceIsWithinProjectLimitSpecification extends Specification<Workspace> {
  constructor(private maxProjects: number = 25) {
    super();
  }

  isSatisfiedBy(workspace: Workspace): boolean {
    return workspace.getProjectCount() <= this.maxProjects;
  }
}

/**
 * Workspace has active projects specification
 */
export class WorkspaceHasActiveProjectsSpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
  }): boolean {
    const { projects } = candidate;
    return projects.some(project => project.isActive());
  }
}

/**
 * Workspace is healthy specification
 */
export class WorkspaceIsHealthySpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
  memberActivity: Map<string, Date>;
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
    memberActivity: Map<string, Date>;
  }): boolean {
    const { workspace, projects, memberActivity } = candidate;

    // Workspace must be active
    if (!workspace.isActive) {
      return false;
    }

    // Should have at least one active project
    const activeProjects = projects.filter(p => p.isActive()).length;
    if (projects.length > 0 && activeProjects === 0) {
      return false;
    }

    // Check member activity (at least 50% active in last 14 days)
    const activeMembersCount = this.getActiveMembersCount(
      workspace.members,
      memberActivity,
      14
    );
    const activityRate =
      workspace.members.length > 0
        ? activeMembersCount / workspace.members.length
        : 0;

    if (activityRate < 0.5) {
      return false;
    }

    return true;
  }

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

/**
 * Workspace needs attention specification
 */
export class WorkspaceNeedsAttentionSpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
  memberActivity: Map<string, Date>;
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
    memberActivity: Map<string, Date>;
  }): boolean {
    const { workspace, projects, memberActivity } = candidate;

    // Workspace needs attention if:
    // - It's inactive
    // - No active projects
    // - Low member activity
    // - No administrators (for large workspaces)

    if (!workspace.isActive) {
      return true;
    }

    const activeProjects = projects.filter(p => p.isActive()).length;
    if (projects.length > 0 && activeProjects === 0) {
      return true;
    }

    // Check member activity
    const activeMembersCount = this.getActiveMembersCount(
      workspace.members,
      memberActivity,
      14
    );
    const activityRate =
      workspace.members.length > 0
        ? activeMembersCount / workspace.members.length
        : 0;

    if (activityRate < 0.3) {
      return true;
    }

    // Check for lack of administrators in large workspaces
    const adminCount = workspace.members.filter(m => m.role === 'ADMIN').length;
    if (workspace.getMemberCount() > 10 && adminCount === 0) {
      return true;
    }

    return false;
  }

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

/**
 * User can be added to workspace specification
 */
export class UserCanBeAddedToWorkspaceSpecification extends Specification<{
  workspace: Workspace;
  user: User;
}> {
  isSatisfiedBy(candidate: { workspace: Workspace; user: User }): boolean {
    const { workspace, user } = candidate;

    // Workspace must be active
    if (!workspace.isActive) {
      return false;
    }

    // User must be active
    if (!user.isActive()) {
      return false;
    }

    // User must not already be a member
    if (workspace.isMember(user.id)) {
      return false;
    }

    // Workspace must be within member limits
    const memberLimitSpec = new WorkspaceIsWithinMemberLimitSpecification();
    if (!memberLimitSpec.isSatisfiedBy(workspace)) {
      return false;
    }

    return true;
  }
}

/**
 * Member can be removed from workspace specification
 */
export class MemberCanBeRemovedFromWorkspaceSpecification extends Specification<{
  workspace: Workspace;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { workspace: Workspace; userId: UserId }): boolean {
    const { workspace, userId } = candidate;

    // Workspace must be active
    if (!workspace.isActive) {
      return false;
    }

    // User must be a member
    if (!workspace.isMember(userId)) {
      return false;
    }

    // Cannot remove the workspace owner
    if (userId.equals(workspace.ownerId)) {
      return false;
    }

    return true;
  }
}

/**
 * Workspace can be deleted specification
 */
export class WorkspaceCanBeDeletedSpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
  }): boolean {
    const { projects } = candidate;

    // Only the owner can delete the workspace (this should be checked at the service level)
    // Here we check business rules

    // Cannot delete workspace with active projects
    const activeProjects = projects.filter(p => p.isActive()).length;
    if (activeProjects > 0) {
      return false;
    }

    return true;
  }
}

/**
 * Workspace is over capacity specification
 */
export class WorkspaceIsOverCapacitySpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
  totalTasks: number;
  memberActivity: Map<string, Date>;
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
    totalTasks: number;
    memberActivity: Map<string, Date>;
  }): boolean {
    const { workspace, projects, totalTasks, memberActivity } = candidate;

    const activeMembers = this.getActiveMembersCount(
      workspace.members,
      memberActivity,
      7
    );
    const activeProjects = projects.filter(p => p.isActive()).length;

    // Over capacity if:
    // - More than 15 tasks per active member
    // - More than 3 active projects per active member
    // - More than 80% member capacity utilization

    if (activeMembers > 0) {
      const tasksPerMember = totalTasks / activeMembers;
      const projectsPerMember = activeProjects / activeMembers;

      if (tasksPerMember > 15 || projectsPerMember > 3) {
        return true;
      }
    }

    // Check member capacity (assuming 50 is max capacity)
    const capacityUtilization = workspace.getMemberCount() / 50;
    if (capacityUtilization > 0.8) {
      return true;
    }

    return false;
  }

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

/**
 * Workspace should be split specification
 */
export class WorkspaceShouldBeSplitSpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
  }): boolean {
    const { workspace, projects } = candidate;

    // Workspace should be split if:
    // - More than 25 members
    // - More than 15 projects
    // - Projects can be logically grouped

    if (workspace.getMemberCount() > 25) {
      return true;
    }

    if (projects.length > 15) {
      return true;
    }

    return false;
  }
}

/**
 * Workspace has sufficient administrators specification
 */
export class WorkspaceHasSufficientAdministratorsSpecification extends Specification<Workspace> {
  isSatisfiedBy(workspace: Workspace): boolean {
    const adminCount = workspace.members.filter(
      m => m.role === 'ADMIN' || m.role === 'OWNER'
    ).length;
    const memberCount = workspace.getMemberCount();

    // Should have at least 1 admin per 10 members
    const recommendedAdmins = Math.max(1, Math.ceil(memberCount / 10));

    return adminCount >= recommendedAdmins;
  }
}

/**
 * Composite specifications for common use cases
 */

/**
 * Active workspaces specification
 */
export class ActiveWorkspacesSpecification extends Specification<Workspace> {
  isSatisfiedBy(workspace: Workspace): boolean {
    return new WorkspaceIsActiveSpecification().isSatisfiedBy(workspace);
  }
}

/**
 * Workspaces needing management attention specification
 */
export class WorkspacesNeedingManagementAttentionSpecification extends Specification<{
  workspace: Workspace;
  projects: Project[];
  memberActivity: Map<string, Date>;
}> {
  isSatisfiedBy(candidate: {
    workspace: Workspace;
    projects: Project[];
    memberActivity: Map<string, Date>;
  }): boolean {
    const needsAttention = new WorkspaceNeedsAttentionSpecification();
    const isOverCapacity = new WorkspaceIsOverCapacitySpecification();

    return (
      needsAttention.isSatisfiedBy(candidate) ||
      isOverCapacity.isSatisfiedBy({
        workspace: candidate.workspace,
        projects: candidate.projects,
        totalTasks: 0, // This would need to be provided
        memberActivity: candidate.memberActivity,
      })
    );
  }
}
