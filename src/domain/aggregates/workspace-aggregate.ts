import { AggregateRoot } from './aggregate-root';
import { Workspace, WorkspaceMember } from '../entities/workspace';
import { WorkspaceId, UserId, ProjectId } from '../value-objects';
import { DomainError } from '../../shared/errors';

/**
 * Create Workspace Data interface
 */
export interface CreateWorkspaceData {
  name: string;
  description: string;
  ownerId: UserId;
}

/**
 * Workspace Statistics interface
 */
export interface WorkspaceStatistics {
  memberCount: number;
  projectCount: number;
  activeProjectCount: number;
  totalTaskCount: number;
  completedTaskCount: number;
  completionPercentage: number;
}

/**
 * Project Summary interface
 */
export interface ProjectSummary {
  projectId: ProjectId;
  name: string;
  status: string;
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  completionPercentage: number;
}

/**
 * Workspace Aggregate
 * Manages workspace lifecycle, project management, and user access control
 */
export class WorkspaceAggregate extends AggregateRoot<WorkspaceId> {
  private _workspace: Workspace;
  private _projectSummaries: Map<string, ProjectSummary>;
  private _totalTaskCount: number;
  private _completedTaskCount: number;

  constructor(
    workspace: Workspace,
    projectSummaries: ProjectSummary[] = [],
    totalTaskCount: number = 0,
    completedTaskCount: number = 0,
    createdAt?: Date,
    updatedAt?: Date,
    version?: number
  ) {
    super(workspace.id, createdAt, updatedAt, version);
    this._workspace = workspace;
    this._projectSummaries = new Map();
    this._totalTaskCount = totalTaskCount;
    this._completedTaskCount = completedTaskCount;

    // Initialize project summaries
    projectSummaries.forEach(summary => {
      this._projectSummaries.set(summary.projectId.toString(), summary);
    });

    this.validate();
  }

  /**
   * Get the workspace entity
   */
  get workspace(): Workspace {
    return this._workspace;
  }

  /**
   * Get workspace statistics
   */
  get statistics(): WorkspaceStatistics {
    const projectSummaries = Array.from(this._projectSummaries.values());
    const activeProjectCount = projectSummaries.filter(
      p => p.status === 'ACTIVE'
    ).length;

    return {
      memberCount: this._workspace.getMemberCount(),
      projectCount: this._workspace.getProjectCount(),
      activeProjectCount,
      totalTaskCount: this._totalTaskCount,
      completedTaskCount: this._completedTaskCount,
      completionPercentage:
        this._totalTaskCount > 0
          ? (this._completedTaskCount / this._totalTaskCount) * 100
          : 0,
    };
  }

  /**
   * Update workspace basic information
   */
  updateWorkspace(name: string, description: string, updatedBy: UserId): void {
    // Check permissions
    if (!this._workspace.canUserUpdateWorkspace(updatedBy)) {
      throw new DomainError(
        'User does not have permission to update this workspace'
      );
    }

    this._workspace.updateBasicInfo(name, description);
    this.incrementVersion();

    // TODO: Add domain event for workspace updated
  }

  /**
   * Add a member to the workspace
   */
  addMember(userId: UserId, role: 'ADMIN' | 'MEMBER', addedBy: UserId): void {
    // Check permissions
    if (!this._workspace.canUserManageMembers(addedBy)) {
      throw new DomainError('User does not have permission to add members');
    }

    this._workspace.addMember(userId, role);
    this.incrementVersion();

    // TODO: Add domain event for member added
  }

  /**
   * Remove a member from the workspace
   */
  removeMember(userId: UserId, removedBy: UserId): void {
    // Check permissions
    if (!this._workspace.canUserManageMembers(removedBy)) {
      throw new DomainError('User does not have permission to remove members');
    }

    this._workspace.removeMember(userId);
    this.incrementVersion();

    // TODO: Add domain event for member removed
  }

  /**
   * Update a member's role
   */
  updateMemberRole(
    userId: UserId,
    newRole: 'ADMIN' | 'MEMBER',
    updatedBy: UserId
  ): void {
    // Check permissions
    if (!this._workspace.canUserManageMembers(updatedBy)) {
      throw new DomainError(
        'User does not have permission to update member roles'
      );
    }

    this._workspace.updateMemberRole(userId, newRole, updatedBy);
    this.incrementVersion();

    // TODO: Add domain event for member role updated
  }

  /**
   * Add a project to the workspace
   */
  addProject(projectId: ProjectId, projectSummary: ProjectSummary): void {
    this._workspace.addProject(projectId);
    this._projectSummaries.set(projectId.toString(), projectSummary);
    this.incrementVersion();

    // TODO: Add domain event for project added
  }

  /**
   * Remove a project from the workspace
   */
  removeProject(projectId: ProjectId): void {
    this._workspace.removeProject(projectId);
    this._projectSummaries.delete(projectId.toString());
    this.incrementVersion();

    // TODO: Add domain event for project removed
  }

  /**
   * Update project summary
   */
  updateProjectSummary(projectSummary: ProjectSummary): void {
    const projectIdStr = projectSummary.projectId.toString();

    if (!this._projectSummaries.has(projectIdStr)) {
      throw new DomainError('Project not found in workspace');
    }

    this._projectSummaries.set(projectIdStr, projectSummary);
    this.recalculateTaskStatistics();
    this.incrementVersion();
  }

  /**
   * Get project summary by ID
   */
  getProjectSummary(projectId: ProjectId): ProjectSummary | null {
    return this._projectSummaries.get(projectId.toString()) || null;
  }

  /**
   * Get all project summaries
   */
  getProjectSummaries(): ProjectSummary[] {
    return Array.from(this._projectSummaries.values());
  }

  /**
   * Get project summaries by status
   */
  getProjectSummariesByStatus(status: string): ProjectSummary[] {
    return Array.from(this._projectSummaries.values()).filter(
      p => p.status === status
    );
  }

  /**
   * Check if a user can create projects in this workspace
   */
  canUserCreateProject(userId: UserId): boolean {
    return this._workspace.canUserCreateProject(userId);
  }

  /**
   * Check if a user can manage members in this workspace
   */
  canUserManageMembers(userId: UserId): boolean {
    return this._workspace.canUserManageMembers(userId);
  }

  /**
   * Check if a user can update this workspace
   */
  canUserUpdateWorkspace(userId: UserId): boolean {
    return this._workspace.canUserUpdateWorkspace(userId);
  }

  /**
   * Check if a user can delete this workspace
   */
  canUserDeleteWorkspace(userId: UserId): boolean {
    return this._workspace.canUserDeleteWorkspace(userId);
  }

  /**
   * Get a user's role in this workspace
   */
  getUserRole(userId: UserId): 'OWNER' | 'ADMIN' | 'MEMBER' | null {
    return this._workspace.getUserRole(userId);
  }

  /**
   * Check if a user is a member of this workspace
   */
  isMember(userId: UserId): boolean {
    return this._workspace.isMember(userId);
  }

  /**
   * Get all workspace members
   */
  getMembers(): WorkspaceMember[] {
    return this._workspace.members;
  }

  /**
   * Get members by role
   */
  getMembersByRole(role: 'OWNER' | 'ADMIN' | 'MEMBER'): WorkspaceMember[] {
    return this._workspace.members.filter(member => member.role === role);
  }

  /**
   * Deactivate the workspace
   */
  deactivate(userId: UserId): void {
    // Check permissions - only owner can deactivate
    if (!this._workspace.canUserDeleteWorkspace(userId)) {
      throw new DomainError(
        'Only the workspace owner can deactivate the workspace'
      );
    }

    // Business rule: Cannot deactivate workspace with active projects
    const activeProjects = this.getProjectSummariesByStatus('ACTIVE');
    if (activeProjects.length > 0) {
      throw new DomainError('Cannot deactivate workspace with active projects');
    }

    this._workspace.deactivate();
    this.incrementVersion();

    // TODO: Add domain event for workspace deactivated
  }

  /**
   * Activate the workspace
   */
  activate(userId: UserId): void {
    // Check permissions - only owner can activate
    if (!userId.equals(this._workspace.ownerId)) {
      throw new DomainError(
        'Only the workspace owner can activate the workspace'
      );
    }

    this._workspace.activate();
    this.incrementVersion();

    // TODO: Add domain event for workspace activated
  }

  /**
   * Transfer ownership of the workspace
   */
  transferOwnership(newOwnerId: UserId, currentOwnerId: UserId): void {
    this._workspace.transferOwnership(newOwnerId, currentOwnerId);
    this.incrementVersion();

    // TODO: Add domain event for ownership transferred
  }

  /**
   * Get workspace health score (0-100)
   */
  getHealthScore(): number {
    const stats = this.statistics;
    let score = 100;

    // Deduct points for low project completion rates
    if (stats.totalTaskCount > 0) {
      const completionRate = stats.completionPercentage / 100;
      if (completionRate < 0.5) {
        score -= (0.5 - completionRate) * 40; // Max 20 points deduction
      }
    }

    // Deduct points for inactive workspace
    if (!this._workspace.isActive) {
      score -= 30;
    }

    // Deduct points if no active projects
    if (stats.activeProjectCount === 0 && stats.projectCount > 0) {
      score -= 20;
    }

    // Bonus points for high activity
    if (stats.activeProjectCount > 0 && stats.completionPercentage > 80) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if the workspace is healthy
   */
  isHealthy(): boolean {
    return this.getHealthScore() >= 70;
  }

  /**
   * Get workspace activity summary
   */
  getActivitySummary(): {
    recentlyCompletedTasks: number;
    activeProjects: number;
    totalMembers: number;
    overallProgress: number;
  } {
    const stats = this.statistics;

    return {
      recentlyCompletedTasks: stats.completedTaskCount,
      activeProjects: stats.activeProjectCount,
      totalMembers: stats.memberCount,
      overallProgress: stats.completionPercentage,
    };
  }

  /**
   * Recalculate task statistics from project summaries
   */
  private recalculateTaskStatistics(): void {
    const projectSummaries = Array.from(this._projectSummaries.values());

    this._totalTaskCount = projectSummaries.reduce(
      (sum, project) => sum + project.taskCount,
      0
    );
    this._completedTaskCount = projectSummaries.reduce(
      (sum, project) => sum + project.completedTaskCount,
      0
    );
  }

  /**
   * Apply a domain event to the aggregate
   */
  protected applyEvent(event: any): void {
    // TODO: Implement event application logic for event sourcing
    // This would handle events like WorkspaceCreated, MemberAdded, etc.
  }

  /**
   * Check aggregate invariants
   */
  protected checkInvariants(): void {
    // Check that completed task count doesn't exceed total
    if (this._completedTaskCount > this._totalTaskCount) {
      throw new DomainError(
        'Completed task count cannot exceed total task count'
      );
    }

    // Check that all project summaries reference projects in the workspace
    const workspaceProjectIds = new Set(this._workspace.projectIds);
    for (const projectId of this._projectSummaries.keys()) {
      if (!workspaceProjectIds.has(projectId)) {
        throw new DomainError(
          'All project summaries must reference projects in the workspace'
        );
      }
    }

    // Check that workspace has an owner
    const owner = this._workspace.members.find(
      member => member.role === 'OWNER'
    );
    if (!owner) {
      throw new DomainError('Workspace must have an owner');
    }

    // Check that the owner matches the workspace owner ID
    if (!owner.userId.equals(this._workspace.ownerId)) {
      throw new DomainError('Workspace owner ID must match the owner member');
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

    // Add validation errors from the workspace entity
    errors.push(...this._workspace.getValidationErrors());

    return errors;
  }

  /**
   * Create a snapshot of the aggregate's current state
   */
  createSnapshot(): Record<string, any> {
    return {
      workspace: {
        id: this._workspace.id.toString(),
        name: this._workspace.name,
        description: this._workspace.description,
        ownerId: this._workspace.ownerId.toString(),
        isActive: this._workspace.isActive,
        members: this._workspace.members.map(member => ({
          userId: member.userId.toString(),
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
        })),
        projectIds: this._workspace.projectIds,
        createdAt: this._workspace.createdAt.toISOString(),
        updatedAt: this._workspace.updatedAt.toISOString(),
      },
      projectSummaries: Array.from(this._projectSummaries.values()).map(
        summary => ({
          projectId: summary.projectId.toString(),
          name: summary.name,
          status: summary.status,
          memberCount: summary.memberCount,
          taskCount: summary.taskCount,
          completedTaskCount: summary.completedTaskCount,
          completionPercentage: summary.completionPercentage,
        })
      ),
      statistics: {
        totalTaskCount: this._totalTaskCount,
        completedTaskCount: this._completedTaskCount,
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
   * Create a new WorkspaceAggregate instance
   */
  static create(
    data: CreateWorkspaceData,
    workspaceId: WorkspaceId
  ): WorkspaceAggregate {
    const workspace = Workspace.create(
      workspaceId,
      data.name,
      data.description,
      data.ownerId
    );

    return new WorkspaceAggregate(workspace);
  }

  /**
   * Restore a WorkspaceAggregate from persistence
   */
  static restore(
    workspace: Workspace,
    projectSummaries: ProjectSummary[],
    totalTaskCount: number,
    completedTaskCount: number,
    createdAt: Date,
    updatedAt: Date,
    version: number
  ): WorkspaceAggregate {
    return new WorkspaceAggregate(
      workspace,
      projectSummaries,
      totalTaskCount,
      completedTaskCount,
      createdAt,
      updatedAt,
      version
    );
  }
}
