import { ProjectStatus } from '@monorepo/core';
import { Project } from '../entities/project';
import { Task } from '../entities/task';
import { User } from '../entities/user';
import { ProjectRoleVO, UserId } from '../value-objects';
import { Specification } from './task-specifications';

/**
 * Project is active specification
 */
export class ProjectIsActiveSpecification extends Specification<Project> {
  isSatisfiedBy(project: Project): boolean {
    return project.isActive();
  }
}

/**
 * Project is completed specification
 */
export class ProjectIsCompletedSpecification extends Specification<Project> {
  isSatisfiedBy(project: Project): boolean {
    return project.isCompleted();
  }
}

/**
 * Project can be completed specification
 */
export class ProjectCanBeCompletedSpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const { project, tasks } = candidate;

    // Project must be in a status that allows completion
    if (!project.status.canTransitionTo(ProjectStatus.COMPLETED)) {
      return false;
    }

    // All tasks must be completed or cancelled
    const incompleteTasks = tasks.filter(
      t => !t.isCompleted() && !t.status.isCancelled()
    );
    return incompleteTasks.length === 0;
  }
}

/**
 * User has project role specification
 */
export class UserHasProjectRoleSpecification extends Specification<{
  project: Project;
  userId: UserId;
  role: ProjectRoleVO;
}> {
  isSatisfiedBy(candidate: {
    project: Project;
    userId: UserId;
    role: ProjectRoleVO;
  }): boolean {
    const { project, userId, role } = candidate;
    const userRole = project.getUserRole(userId);
    return userRole?.equals(role) ?? false;
  }
}

/**
 * User can manage project members specification
 */
export class UserCanManageProjectMembersSpecification extends Specification<{
  project: Project;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { project: Project; userId: UserId }): boolean {
    const { project, userId } = candidate;
    return project.canUserManageMembers(userId);
  }
}

/**
 * User can create tasks in project specification
 */
export class UserCanCreateTasksInProjectSpecification extends Specification<{
  project: Project;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { project: Project; userId: UserId }): boolean {
    const { project, userId } = candidate;
    return project.canUserCreateTask(userId);
  }
}

/**
 * Project has sufficient managers specification
 */
export class ProjectHasSufficientManagersSpecification extends Specification<Project> {
  constructor(private minimumManagers: number = 1) {
    super();
  }

  isSatisfiedBy(project: Project): boolean {
    const managers = project.members.filter(
      member => member.role.isOwner() || member.role.isManager()
    );
    return managers.length >= this.minimumManagers;
  }
}

/**
 * Project is within member limit specification
 */
export class ProjectIsWithinMemberLimitSpecification extends Specification<Project> {
  constructor(private maxMembers: number = 100) {
    super();
  }

  isSatisfiedBy(project: Project): boolean {
    return project.getMemberCount() <= this.maxMembers;
  }
}

/**
 * Project is healthy specification
 */
export class ProjectIsHealthySpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const { project, tasks } = candidate;

    // Project must be active or operational
    if (!project.isOperational()) {
      return false;
    }

    // Check task completion rate
    const completedTasks = tasks.filter(t => t.isCompleted()).length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 1;

    // Healthy if completion rate is above 30% (for projects with tasks)
    if (totalTasks > 5 && completionRate < 0.3) {
      return false;
    }

    // Check overdue tasks
    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    const overdueRate = totalTasks > 0 ? overdueTasks / totalTasks : 0;

    // Unhealthy if more than 30% of tasks are overdue
    if (overdueRate > 0.3) {
      return false;
    }

    return true;
  }
}

/**
 * Project needs attention specification
 */
export class ProjectNeedsAttentionSpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const { project, tasks } = candidate;

    // Project needs attention if:
    // - It's on hold
    // - Has many overdue tasks
    // - Has no recent activity
    // - Has unassigned high-priority tasks

    if (project.status.isOnHold()) {
      return true;
    }

    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    const totalTasks = tasks.length;

    if (totalTasks > 0 && overdueTasks / totalTasks > 0.2) {
      return true;
    }

    const unassignedHighPriorityTasks = tasks.filter(
      t => !t.isAssigned() && t.priority.requiresImmediateAttention()
    ).length;

    if (unassignedHighPriorityTasks > 0) {
      return true;
    }

    // Check for stale project (no task updates in 14 days)
    const recentActivity = tasks.some(t => {
      const daysSinceUpdate = Math.floor(
        (Date.now() - t.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceUpdate <= 14;
    });

    if (totalTasks > 0 && !recentActivity) {
      return true;
    }

    return false;
  }
}

/**
 * User can be added to project specification
 */
export class UserCanBeAddedToProjectSpecification extends Specification<{
  project: Project;
  user: User;
  role: ProjectRoleVO;
}> {
  isSatisfiedBy(candidate: {
    project: Project;
    user: User;
    role: ProjectRoleVO;
  }): boolean {
    const { project, user } = candidate;

    // Project must be operational
    if (!project.isOperational()) {
      return false;
    }

    // User must be active
    if (!user.isActive()) {
      return false;
    }

    // User must not already be a member
    if (project.isMember(user.id)) {
      return false;
    }

    // Project must be within member limits
    const memberLimitSpec = new ProjectIsWithinMemberLimitSpecification();
    if (!memberLimitSpec.isSatisfiedBy(project)) {
      return false;
    }

    return true;
  }
}

/**
 * Member can be removed from project specification
 */
export class MemberCanBeRemovedFromProjectSpecification extends Specification<{
  project: Project;
  userId: UserId;
}> {
  isSatisfiedBy(candidate: { project: Project; userId: UserId }): boolean {
    const { project, userId } = candidate;

    // Project must be operational
    if (!project.isOperational()) {
      return false;
    }

    // User must be a member
    if (!project.isMember(userId)) {
      return false;
    }

    // Cannot remove the project manager/owner
    if (userId.equals(project.managerId)) {
      return false;
    }

    // Check if removing this member would violate minimum managers rule
    const member = project.members.find(m => m.userId.equals(userId));
    if (member && (member.role.isOwner() || member.role.isManager())) {
      const managerCount = project.members.filter(
        m => m.role.isOwner() || m.role.isManager()
      ).length;

      if (managerCount <= 1) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Project is ready for archival specification
 */
export class ProjectIsReadyForArchivalSpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const { project, tasks } = candidate;

    // Project must be completed or cancelled
    if (!project.isCompleted() && !project.status.isCancelled()) {
      return false;
    }

    // All tasks must be completed or cancelled
    const activeTasks = tasks.filter(t => t.status.isActive());
    if (activeTasks.length > 0) {
      return false;
    }

    // Project should have been in completed/cancelled state for at least 30 days
    const daysSinceCompletion = Math.floor(
      (Date.now() - project.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceCompletion >= 30;
  }
}

/**
 * Project has overdue tasks specification
 */
export class ProjectHasOverdueTasksSpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const { tasks } = candidate;
    return tasks.some(t => t.isOverdue());
  }
}

/**
 * Project is at risk specification
 */
export class ProjectIsAtRiskSpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const { project, tasks } = candidate;

    // Project is at risk if:
    // - End date is approaching and completion rate is low
    // - High percentage of overdue tasks
    // - No active members

    if (project.endDate) {
      const daysUntilEnd = Math.ceil(
        (project.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilEnd <= 14 && daysUntilEnd > 0) {
        const completedTasks = tasks.filter(t => t.isCompleted()).length;
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

        if (completionRate < 0.8) {
          return true;
        }
      }
    }

    // Check overdue task percentage
    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    const totalTasks = tasks.length;

    if (totalTasks > 0 && overdueTasks / totalTasks > 0.25) {
      return true;
    }

    // Check for lack of recent activity
    const hasRecentActivity = tasks.some(t => {
      const daysSinceUpdate = Math.floor(
        (Date.now() - t.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceUpdate <= 7;
    });

    if (totalTasks > 0 && !hasRecentActivity) {
      return true;
    }

    return false;
  }
}

/**
 * Composite specifications for common use cases
 */

/**
 * Active projects specification
 */
export class ActiveProjectsSpecification extends Specification<Project> {
  isSatisfiedBy(project: Project): boolean {
    return new ProjectIsActiveSpecification().isSatisfiedBy(project);
  }
}

/**
 * Projects needing management attention specification
 */
export class ProjectsNeedingManagementAttentionSpecification extends Specification<{
  project: Project;
  tasks: Task[];
}> {
  isSatisfiedBy(candidate: { project: Project; tasks: Task[] }): boolean {
    const needsAttention = new ProjectNeedsAttentionSpecification();
    const isAtRisk = new ProjectIsAtRiskSpecification();

    return (
      needsAttention.isSatisfiedBy(candidate) ||
      isAtRisk.isSatisfiedBy(candidate)
    );
  }
}
