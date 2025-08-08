import { Project } from '../entities/Project';
import { Task } from '../entities/Task';
import { Workspace } from '../entities/Workspace';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectStatus } from '../value-objects/ProjectStatus';
import { DomainService } from '../../shared/base/domain-service';

export interface ProjectResourceRule {
  canAllocateResources(project: Project, requiredResources: number): boolean;
  validateBudgetAllocation(project: Project, amount: number): boolean;
}

export interface ProjectTimelineRule {
  canExtendDeadline(project: Project, newEndDate: Date, user: UserId): boolean;
  validateMilestoneConsistency(project: Project, tasks: Task[]): boolean;
}

export interface ProjectMembershipRule {
  canAddMember(project: Project, userId: UserId, addedBy: UserId): boolean;
  validateMemberCapacity(project: Project, currentMemberCount: number): boolean;
}

export class ProjectDomainService extends DomainService {
  constructor(
    private readonly resourceRule: ProjectResourceRule,
    private readonly timelineRule: ProjectTimelineRule,
    private readonly membershipRule: ProjectMembershipRule
  ) {
    super();
  }

  /**
   * Validates project creation within workspace constraints
   */
  public validateProjectCreation(
    project: Project,
    workspace: Workspace,
    currentProjectCount: number
  ): void {
    // Check workspace project limits
    if (!workspace.canAddProject(currentProjectCount)) {
      throw new Error('Workspace has reached maximum project limit');
    }

    // Validate project timeline against workspace settings
    if (project.startDate && project.endDate) {
      const duration = project.endDate.getTime() - project.startDate.getTime();
      const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year max

      if (duration > maxDuration) {
        throw new Error('Project duration cannot exceed 1 year');
      }
    }

    // Validate budget against workspace tier
    if (project.budgetAmount) {
      const maxBudget = this.getMaxBudgetForTier(workspace.subscriptionTier);
      if (project.budgetAmount > maxBudget) {
        throw new Error(
          `Project budget exceeds maximum allowed for ${workspace.subscriptionTier} tier`
        );
      }
    }
  }

  /**
   * Calculates project health score based on various metrics
   */
  public calculateProjectHealth(
    project: Project,
    tasks: Task[],
    memberCount: number
  ): { score: number; factors: string[]; recommendations: string[] } {
    let score = 100;
    const factors: string[] = [];
    const recommendations: string[] = [];

    // Timeline health
    if (project.isOverdue()) {
      score -= 30;
      factors.push('Project is overdue');
      recommendations.push(
        'Review project timeline and consider extending deadline'
      );
    }

    // Task completion health
    const completedTasks = tasks.filter(t => t.status.isCompleted()).length;
    const completionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;

    if (completionRate < 0.3) {
      score -= 20;
      factors.push('Low task completion rate');
      recommendations.push(
        'Focus on completing existing tasks before adding new ones'
      );
    }

    // Overdue tasks health
    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    if (overdueTasks > 0) {
      score -= overdueTasks * 5;
      factors.push(`${overdueTasks} overdue tasks`);
      recommendations.push('Address overdue tasks immediately');
    }

    // Resource allocation health
    const unassignedTasks = tasks.filter(t => !t.assigneeId).length;
    if (unassignedTasks > tasks.length * 0.3) {
      score -= 15;
      factors.push('High number of unassigned tasks');
      recommendations.push('Assign tasks to team members');
    }

    // Team size health
    if (memberCount === 0) {
      score -= 25;
      factors.push('No team members assigned');
      recommendations.push('Add team members to the project');
    }

    // Budget health (if budget is set)
    if (project.budgetAmount) {
      // This would need actual expense tracking
      // For now, just check if budget is reasonable
      const estimatedCost = this.estimateProjectCost(tasks, memberCount);
      if (estimatedCost > project.budgetAmount * 1.2) {
        score -= 20;
        factors.push('Estimated cost exceeds budget');
        recommendations.push('Review budget allocation or reduce scope');
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      recommendations,
    };
  }

  /**
   * Validates project status transition
   */
  public validateStatusTransition(
    project: Project,
    newStatus: ProjectStatus,
    tasks: Task[],
    user: UserId
  ): void {
    // Check if user has permission to change status
    if (!project.isOwner(user)) {
      throw new Error('Only project owner can change project status');
    }

    // Validate transition rules
    if (!project.status.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${project.status.value} to ${newStatus.value}`
      );
    }

    // Additional validation for specific transitions
    if (newStatus.isCompleted()) {
      const incompleteTasks = tasks.filter(
        t => !t.status.isCompleted() && !t.status.isCancelled()
      );
      if (incompleteTasks.length > 0) {
        throw new Error('Cannot complete project with incomplete tasks');
      }
    }

    if (newStatus.isActive()) {
      if (!project.startDate) {
        throw new Error('Cannot activate project without start date');
      }

      const activeTasks = tasks.filter(t => t.status.isActive());
      if (activeTasks.length === 0) {
        throw new Error('Cannot activate project without active tasks');
      }
    }
  }

  /**
   * Calculates project progress based on task completion
   */
  public calculateProgress(tasks: Task[]): {
    percentage: number;
    completedTasks: number;
    totalTasks: number;
    weightedProgress: number;
  } {
    if (tasks.length === 0) {
      return {
        percentage: 0,
        completedTasks: 0,
        totalTasks: 0,
        weightedProgress: 0,
      };
    }

    const completedTasks = tasks.filter(t => t.status.isCompleted()).length;
    const percentage = (completedTasks / tasks.length) * 100;

    // Calculate weighted progress based on story points or estimated hours
    let totalWeight = 0;
    let completedWeight = 0;

    tasks.forEach(task => {
      const weight = task.storyPoints || task.estimatedHours || 1;
      totalWeight += weight;

      if (task.status.isCompleted()) {
        completedWeight += weight;
      } else if (task.status.isInProgress()) {
        completedWeight += weight * 0.5; // 50% credit for in-progress tasks
      }
    });

    const weightedProgress =
      totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;

    return {
      percentage: Math.round(percentage),
      completedTasks,
      totalTasks: tasks.length,
      weightedProgress: Math.round(weightedProgress),
    };
  }

  /**
   * Validates project timeline against dependencies and constraints
   */
  public validateProjectTimeline(
    project: Project,
    tasks: Task[],
    dependencies: { taskId: string; dependsOnId: string }[] = []
  ): { isValid: boolean; conflicts: string[]; suggestions: string[] } {
    const conflicts: string[] = [];
    const suggestions: string[] = [];

    // Check if project timeline accommodates all tasks
    if (project.startDate && project.endDate) {
      const projectDuration =
        project.endDate.getTime() - project.startDate.getTime();
      const totalEstimatedHours = tasks.reduce(
        (sum, task) => sum + (task.estimatedHours || 0),
        0
      );

      // Assuming 8 hours per day, 5 days per week
      const availableWorkingHours =
        (projectDuration / (1000 * 60 * 60 * 24)) * 8 * (5 / 7);

      if (totalEstimatedHours > availableWorkingHours * 1.2) {
        // 20% buffer
        conflicts.push('Total estimated hours exceed available project time');
        suggestions.push(
          'Consider extending project timeline or reducing scope'
        );
      }
    }

    // Check task due dates against project end date
    if (project.endDate) {
      const tasksAfterProjectEnd = tasks.filter(
        t => t.dueDate && t.dueDate > project.endDate!
      );

      if (tasksAfterProjectEnd.length > 0) {
        conflicts.push(
          `${tasksAfterProjectEnd.length} tasks have due dates after project end date`
        );
        suggestions.push('Adjust task due dates or extend project timeline');
      }
    }

    // Validate dependency chain doesn't exceed project timeline
    // This would require more complex dependency graph analysis
    // For now, just check for basic conflicts

    return {
      isValid: conflicts.length === 0,
      conflicts,
      suggestions,
    };
  }

  /**
   * Estimates project cost based on tasks and team size
   */
  private estimateProjectCost(tasks: Task[], memberCount: number): number {
    const totalEstimatedHours = tasks.reduce(
      (sum, task) => sum + (task.estimatedHours || 0),
      0
    );
    const averageHourlyRate = 75; // Default rate
    const overheadMultiplier = 1.3; // 30% overhead

    return totalEstimatedHours * averageHourlyRate * overheadMultiplier;
  }

  /**
   * Gets maximum budget allowed for workspace tier
   */
  private getMaxBudgetForTier(tier: string): number {
    const budgetLimits = {
      free: 1000,
      basic: 10000,
      professional: 100000,
      enterprise: Number.MAX_SAFE_INTEGER,
    };

    return budgetLimits[tier.toLowerCase()] || 1000;
  }
}
