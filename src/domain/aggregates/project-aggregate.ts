import { AggregateRoot } from './aggregate-root';
import { Project, ProjectMember } from '../entities/project';
import {
  ProjectId,
  UserId,
  WorkspaceId,
  ProjectStatusVO,
  ProjectRoleVO,
} from '../value-objects';
import {
  ProjectStatus,
  ProjectRole,
} from '../../shared/constants/project-constants';
import { DomainError } from '../../shared/errors';
import { PROJECT_BUSINESS_RULES } from '../../shared/constants/project-constants';

/**
 * Create Project Data interface
 */
export interface CreateProjectData {
  name: string;
  description: string;
  managerId: UserId;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Project Statistics interface
 */
export interface ProjectStatistics {
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  overdueTasks: number;
  completionPercentage: number;
}

/**
 * Project Aggregate
 * Manages project lifecycle, member management, and project-level business rules
 */
export class ProjectAggregate extends AggregateRoot<ProjectId> {
  private _project: Project;
  private _taskCount: number;
  private _completedTaskCount: number;
  private _overdueTaskCount: number;

  constructor(
    project: Project,
    taskCount: number = 0,
    completedTaskCount: number = 0,
    overdueTaskCount: number = 0,
    createdAt?: Date,
    updatedAt?: Date,
    version?: number
  ) {
    super(project.id, createdAt, updatedAt, version);
    this._project = project;
    this._taskCount = taskCount;
    this._completedTaskCount = completedTaskCount;
    this._overdueTaskCount = overdueTaskCount;
    this.validate();
  }

  /**
   * Get the project entity
   */
  get project(): Project {
    return this._project;
  }

  /**
   * Get project statistics
   */
  get statistics(): ProjectStatistics {
    return {
      memberCount: this._project.getMemberCount(),
      taskCount: this._taskCount,
      completedTaskCount: this._completedTaskCount,
      overdueTasks: this._overdueTaskCount,
      completionPercentage:
        this._taskCount > 0
          ? (this._completedTaskCount / this._taskCount) * 100
          : 0,
    };
  }

  /**
   * Update project basic information
   */
  updateProject(
    name: string,
    description: string,
    updatedBy: UserId,
    startDate?: Date,
    endDate?: Date
  ): void {
    // Check permissions
    if (!this._project.canUserUpdateProject(updatedBy)) {
      throw new DomainError(
        'User does not have permission to update this project'
      );
    }

    this._project.updateBasicInfo(name, description, startDate, endDate);
    this.incrementVersion();

    // TODO: Add domain event for project updated
  }

  /**
   * Add a member to the project
   */
  addMember(userId: UserId, role: ProjectRoleVO, addedBy: UserId): void {
    // Check permissions
    if (!this._project.canUserManageMembers(addedBy)) {
      throw new DomainError('User does not have permission to add members');
    }

    this._project.addMember(userId, role);
    this.incrementVersion();

    // TODO: Add domain event for member added
  }

  /**
   * Remove a member from the project
   */
  removeMember(userId: UserId, removedBy: UserId): void {
    // Check permissions
    if (!this._project.canUserManageMembers(removedBy)) {
      throw new DomainError('User does not have permission to remove members');
    }

    this._project.removeMember(userId);
    this.incrementVersion();

    // TODO: Add domain event for member removed
  }

  /**
   * Update a member's role
   */
  updateMemberRole(
    userId: UserId,
    newRole: ProjectRoleVO,
    updatedBy: UserId
  ): void {
    // Check permissions
    if (!this._project.canUserManageMembers(updatedBy)) {
      throw new DomainError(
        'User does not have permission to update member roles'
      );
    }

    this._project.updateMemberRole(userId, newRole, updatedBy);
    this.incrementVersion();

    // TODO: Add domain event for member role updated
  }

  /**
   * Check if a user can create tasks in this project
   */
  canUserCreateTask(userId: UserId): boolean {
    return this._project.canUserCreateTask(userId);
  }

  /**
   * Check if a user can update tasks in this project
   */
  canUserUpdateTask(userId: UserId): boolean {
    return this._project.canUserUpdateTask(userId);
  }

  /**
   * Check if a user can delete tasks in this project
   */
  canUserDeleteTask(userId: UserId): boolean {
    return this._project.canUserDeleteTask(userId);
  }

  /**
   * Check if a user can assign tasks in this project
   */
  canUserAssignTask(userId: UserId): boolean {
    return this._project.canUserAssignTask(userId);
  }

  /**
   * Get a user's role in this project
   */
  getUserRole(userId: UserId): ProjectRoleVO | null {
    return this._project.getUserRole(userId);
  }

  /**
   * Check if a user is a member of this project
   */
  isMember(userId: UserId): boolean {
    return this._project.isMember(userId);
  }

  /**
   * Get all project members
   */
  getMembers(): ProjectMember[] {
    return this._project.members;
  }

  /**
   * Get members by role
   */
  getMembersByRole(role: ProjectRole): ProjectMember[] {
    return this._project.members.filter(member => member.role.value === role);
  }

  /**
   * Put the project on hold
   */
  putOnHold(userId: UserId): void {
    // Check permissions
    if (!this._project.canUserUpdateProject(userId)) {
      throw new DomainError(
        'User does not have permission to put project on hold'
      );
    }

    this._project.putOnHold();
    this.incrementVersion();

    // TODO: Add domain event for project put on hold
  }

  /**
   * Activate the project
   */
  activate(userId: UserId): void {
    // Check permissions
    if (!this._project.canUserUpdateProject(userId)) {
      throw new DomainError(
        'User does not have permission to activate project'
      );
    }

    this._project.activate();
    this.incrementVersion();

    // TODO: Add domain event for project activated
  }

  /**
   * Complete the project
   */
  complete(userId: UserId): void {
    // Check permissions
    if (!this._project.canUserUpdateProject(userId)) {
      throw new DomainError(
        'User does not have permission to complete project'
      );
    }

    // Business rule: Can only complete if all tasks are completed
    if (this._taskCount > 0 && this._completedTaskCount < this._taskCount) {
      throw new DomainError('Cannot complete project with incomplete tasks');
    }

    this._project.complete();
    this.incrementVersion();

    // TODO: Add domain event for project completed
  }

  /**
   * Cancel the project
   */
  cancel(userId: UserId): void {
    // Check permissions
    if (!this._project.canUserUpdateProject(userId)) {
      throw new DomainError('User does not have permission to cancel project');
    }

    this._project.cancel();
    this.incrementVersion();

    // TODO: Add domain event for project cancelled
  }

  /**
   * Archive the project
   */
  archive(userId: UserId): void {
    // Check permissions - only owners can archive
    const userRole = this._project.getUserRole(userId);
    if (!userRole || !userRole.isOwner()) {
      throw new DomainError('Only project owners can archive projects');
    }

    this._project.archive();
    this.incrementVersion();

    // TODO: Add domain event for project archived
  }

  /**
   * Update task statistics
   */
  updateTaskStatistics(
    taskCount: number,
    completedTaskCount: number,
    overdueTaskCount: number
  ): void {
    this._taskCount = taskCount;
    this._completedTaskCount = completedTaskCount;
    this._overdueTaskCount = overdueTaskCount;
    this.incrementVersion();
  }

  /**
   * Increment task count (when a task is created)
   */
  incrementTaskCount(): void {
    this._taskCount++;
    this.incrementVersion();
  }

  /**
   * Decrement task count (when a task is deleted)
   */
  decrementTaskCount(): void {
    if (this._taskCount > 0) {
      this._taskCount--;
      this.incrementVersion();
    }
  }

  /**
   * Increment completed task count (when a task is completed)
   */
  incrementCompletedTaskCount(): void {
    this._completedTaskCount++;
    this.incrementVersion();
  }

  /**
   * Decrement completed task count (when a completed task is reopened)
   */
  decrementCompletedTaskCount(): void {
    if (this._completedTaskCount > 0) {
      this._completedTaskCount--;
      this.incrementVersion();
    }
  }

  /**
   * Update overdue task count
   */
  updateOverdueTaskCount(count: number): void {
    this._overdueTaskCount = count;
    this.incrementVersion();
  }

  /**
   * Check if the project is healthy (no major issues)
   */
  isHealthy(): boolean {
    const stats = this.statistics;

    // Project is unhealthy if:
    // - More than 50% of tasks are overdue
    // - Project is on hold for too long
    // - No progress in a long time

    if (stats.taskCount > 0 && stats.overdueTasks / stats.taskCount > 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Get project health score (0-100)
   */
  getHealthScore(): number {
    const stats = this.statistics;
    let score = 100;

    // Deduct points for overdue tasks
    if (stats.taskCount > 0) {
      const overduePercentage = stats.overdueTasks / stats.taskCount;
      score -= overduePercentage * 30; // Max 30 points deduction
    }

    // Deduct points if project is on hold
    if (this._project.status.isOnHold()) {
      score -= 20;
    }

    // Bonus points for high completion rate
    if (stats.taskCount > 0) {
      const completionBonus = stats.completionPercentage * 0.1; // Max 10 points bonus
      score += completionBonus;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if the project can be deleted
   */
  canBeDeleted(userId: UserId): boolean {
    // Only owners can delete projects
    const userRole = this._project.getUserRole(userId);
    if (!userRole || !userRole.isOwner()) {
      return false;
    }

    // Cannot delete projects with active tasks
    if (this._taskCount > 0 && this._project.isActive()) {
      return false;
    }

    return true;
  }

  /**
   * Apply a domain event to the aggregate
   */
  protected applyEvent(event: any): void {
    // TODO: Implement event application logic for event sourcing
    // This would handle events like ProjectCreated, MemberAdded, etc.
  }

  /**
   * Check aggregate invariants
   */
  protected checkInvariants(): void {
    // Check that task statistics are consistent
    if (this._completedTaskCount > this._taskCount) {
      throw new DomainError(
        'Completed task count cannot exceed total task count'
      );
    }

    if (this._overdueTaskCount > this._taskCount) {
      throw new DomainError(
        'Overdue task count cannot exceed total task count'
      );
    }

    // Check that the project has at least one manager
    const managers = this.getMembersByRole(ProjectRole.MANAGER);
    const owners = this.getMembersByRole(ProjectRole.OWNER);

    if (
      managers.length + owners.length <
      PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT
    ) {
      throw new DomainError(
        `Project must have at least ${PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT} manager(s)`
      );
    }

    // Check member count limits
    if (
      this._project.getMemberCount() >
      PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT
    ) {
      throw new DomainError(
        `Project cannot have more than ${PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT} members`
      );
    }
  }

  /**
   * Get validation errors for the current state
   */
  getValidationErrors(): string[] {
    const errors: string[] = [];

    try {
      this.checkInvariants();
    } catch (error) {
      if (error instanceof DomainError) {
        errors.push(error.message);
      }
    }

    // Add validation errors from the project entity
    errors.push(...this._project.getValidationErrors());

    return errors;
  }

  /**
   * Create a snapshot of the aggregate's current state
   */
  createSnapshot(): Record<string, any> {
    return {
      project: {
        id: this._project.id.toString(),
        name: this._project.name,
        description: this._project.description,
        workspaceId: this._project.workspaceId.toString(),
        managerId: this._project.managerId.toString(),
        status: this._project.status.value,
        startDate: this._project.startDate?.toISOString() || null,
        endDate: this._project.endDate?.toISOString() || null,
        members: this._project.members.map(member => ({
          userId: member.userId.toString(),
          role: member.role.value,
          joinedAt: member.joinedAt.toISOString(),
        })),
        createdAt: this._project.createdAt.toISOString(),
        updatedAt: this._project.updatedAt.toISOString(),
      },
      statistics: {
        taskCount: this._taskCount,
        completedTaskCount: this._completedTaskCount,
        overdueTaskCount: this._overdueTaskCount,
      },
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Restore the aggregate from a snapshot
   */
  restoreFromSnapshot(snapshot: Record<string, any>): void {
    // TODO: Implement snapshot restoration logic
    // This would restore the aggregate state from a snapshot
  }

  /**
   * Create a new ProjectAggregate instance
   */
  static create(
    data: CreateProjectData,
    projectId: ProjectId,
    workspaceId: WorkspaceId
  ): ProjectAggregate {
    const project = Project.create(
      projectId,
      data.name,
      data.description,
      workspaceId,
      data.managerId,
      data.startDate,
      data.endDate
    );

    return new ProjectAggregate(project);
  }

  /**
   * Restore a ProjectAggregate from persistence
   */
  static restore(
    project: Project,
    taskCount: number,
    completedTaskCount: number,
    overdueTaskCount: number,
    createdAt: Date,
    updatedAt: Date,
    version: number
  ): ProjectAggregate {
    return new ProjectAggregate(
      project,
      taskCount,
      completedTaskCount,
      overdueTaskCount,
      createdAt,
      updatedAt,
      version
    );
  }
}
