import { BaseEntity } from './base-entity';
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
import { DomainError, ValidationError } from '../../shared/errors';
import {
  PROJECT_VALIDATION,
  PROJECT_BUSINESS_RULES,
} from '../../shared/constants/project-constants';

/**
 * Project Member interface
 */
export interface ProjectMember {
  userId: UserId;
  role: ProjectRoleVO;
  joinedAt: Date;
}

/**
 * Project domain entity
 * Represents a project with member management, task creation permissions, and lifecycle management
 */
export class Project extends BaseEntity<ProjectId> {
  private _name: string;
  private _description: string;
  private _workspaceId: WorkspaceId;
  private _managerId: UserId;
  private _status: ProjectStatusVO;
  private _members: Map<string, ProjectMember>;
  private _startDate: Date | null;
  private _endDate: Date | null;

  constructor(
    id: ProjectId,
    name: string,
    description: string,
    workspaceId: WorkspaceId,
    managerId: UserId,
    status: ProjectStatusVO = ProjectStatusVO.create(ProjectStatus.ACTIVE),
    startDate: Date | null = null,
    endDate: Date | null = null,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._name = name;
    this._description = description;
    this._workspaceId = workspaceId;
    this._managerId = managerId;
    this._status = status;
    this._members = new Map();
    this._startDate = startDate;
    this._endDate = endDate;

    // Add the manager as the owner
    this.addMember(managerId, ProjectRoleVO.create(ProjectRole.OWNER));

    this.validate();
  }

  /**
   * Get the project's name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get the project's description
   */
  get description(): string {
    return this._description;
  }

  /**
   * Get the project's workspace ID
   */
  get workspaceId(): WorkspaceId {
    return this._workspaceId;
  }

  /**
   * Get the project's manager ID
   */
  get managerId(): UserId {
    return this._managerId;
  }

  /**
   * Get the project's status
   */
  get status(): ProjectStatusVO {
    return this._status;
  }

  /**
   * Get the project's start date
   */
  get startDate(): Date | null {
    return this._startDate;
  }

  /**
   * Get the project's end date
   */
  get endDate(): Date | null {
    return this._endDate;
  }

  /**
   * Get all project members
   */
  get members(): ProjectMember[] {
    return Array.from(this._members.values());
  }

  /**
   * Update the project's basic information
   */
  updateBasicInfo(
    name: string,
    description: string,
    startDate?: Date | null,
    endDate?: Date | null
  ): void {
    if (!this._status.canBeModified()) {
      throw new DomainError(
        `Cannot update project with status ${this._status.value}`
      );
    }

    this.validateName(name);
    this.validateDescription(description);
    this.validateDateRange(startDate, endDate);

    this._name = name;
    this._description = description;
    this._startDate = startDate ?? this._startDate;
    this._endDate = endDate ?? this._endDate;

    this.markAsUpdated();
  }

  /**
   * Add a member to the project
   */
  addMember(userId: UserId, role: ProjectRoleVO): void {
    if (!this._status.canBeModified()) {
      throw new DomainError(
        `Cannot add members to project with status ${this._status.value}`
      );
    }

    const userIdStr = userId.toString();

    if (this._members.has(userIdStr)) {
      throw new DomainError('User is already a member of this project');
    }

    if (this._members.size >= PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT) {
      throw new DomainError(
        `Project cannot have more than ${PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT} members`
      );
    }

    const member: ProjectMember = {
      userId,
      role,
      joinedAt: new Date(),
    };

    this._members.set(userIdStr, member);
    this.markAsUpdated();

    // TODO: Add domain event for member added
  }

  /**
   * Remove a member from the project
   */
  removeMember(userId: UserId): void {
    if (!this._status.canBeModified()) {
      throw new DomainError(
        `Cannot remove members from project with status ${this._status.value}`
      );
    }

    const userIdStr = userId.toString();

    if (!this._members.has(userIdStr)) {
      throw new DomainError('User is not a member of this project');
    }

    // Cannot remove the project manager
    if (userId.equals(this._managerId)) {
      throw new DomainError('Cannot remove the project manager');
    }

    // Ensure we maintain minimum managers
    const member = this._members.get(userIdStr)!;
    if (member.role.isOwner() || member.role.isManager()) {
      const managerCount = this.getManagerCount();
      if (managerCount <= PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT) {
        throw new DomainError(
          `Project must have at least ${PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT} manager(s)`
        );
      }
    }

    this._members.delete(userIdStr);
    this.markAsUpdated();

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
    if (!this._status.canBeModified()) {
      throw new DomainError(
        `Cannot update member roles in project with status ${this._status.value}`
      );
    }

    const userIdStr = userId.toString();
    const member = this._members.get(userIdStr);

    if (!member) {
      throw new DomainError('User is not a member of this project');
    }

    // Cannot change the owner's role
    if (userId.equals(this._managerId) && member.role.isOwner()) {
      throw new DomainError("Cannot change the project owner's role");
    }

    // Check if updater has permission to change roles
    const updaterMember = this._members.get(updatedBy.toString());
    if (!updaterMember || !updaterMember.role.canManageMembers()) {
      throw new DomainError('Insufficient permissions to update member roles');
    }

    // Ensure we maintain minimum managers when demoting
    if (
      (member.role.isOwner() || member.role.isManager()) &&
      !(newRole.isOwner() || newRole.isManager())
    ) {
      const managerCount = this.getManagerCount();
      if (managerCount <= PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT) {
        throw new DomainError(
          `Project must have at least ${PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT} manager(s)`
        );
      }
    }

    member.role = newRole;
    this.markAsUpdated();

    // TODO: Add domain event for member role updated
  }

  /**
   * Check if a user can create tasks in this project
   */
  canUserCreateTask(userId: UserId): boolean {
    if (!this._status.canCreateTasks()) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role.canCreateTasks() ?? false;
  }

  /**
   * Check if a user can update tasks in this project
   */
  canUserUpdateTask(userId: UserId): boolean {
    if (!this._status.canBeModified()) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role.canUpdateTasks() ?? false;
  }

  /**
   * Check if a user can delete tasks in this project
   */
  canUserDeleteTask(userId: UserId): boolean {
    if (!this._status.canBeModified()) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role.canDeleteTasks() ?? false;
  }

  /**
   * Check if a user can assign tasks in this project
   */
  canUserAssignTask(userId: UserId): boolean {
    if (!this._status.canBeModified()) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role.canAssignTasks() ?? false;
  }

  /**
   * Check if a user can manage members in this project
   */
  canUserManageMembers(userId: UserId): boolean {
    if (!this._status.canBeModified()) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role.canManageMembers() ?? false;
  }

  /**
   * Get a user's role in this project
   */
  getUserRole(userId: UserId): ProjectRoleVO | null {
    const member = this._members.get(userId.toString());
    return member?.role ?? null;
  }

  /**
   * Check if a user is a member of this project
   */
  isMember(userId: UserId): boolean {
    return this._members.has(userId.toString());
  }

  /**
   * Get the number of members in this project
   */
  getMemberCount(): number {
    return this._members.size;
  }

  /**
   * Get the number of managers (owners + managers) in this project
   */
  private getManagerCount(): number {
    return Array.from(this._members.values()).filter(
      member => member.role.isOwner() || member.role.isManager()
    ).length;
  }

  /**
   * Put the project on hold
   */
  putOnHold(): void {
    if (!this._status.canTransitionTo(ProjectStatus.ON_HOLD)) {
      throw new DomainError(
        `Cannot put project on hold from ${this._status.value} status`
      );
    }

    this._status = ProjectStatusVO.create(ProjectStatus.ON_HOLD);
    this.markAsUpdated();

    // TODO: Add domain event for project put on hold
  }

  /**
   * Activate the project (from on hold)
   */
  activate(): void {
    if (!this._status.canTransitionTo(ProjectStatus.ACTIVE)) {
      throw new DomainError(
        `Cannot activate project from ${this._status.value} status`
      );
    }

    this._status = ProjectStatusVO.create(ProjectStatus.ACTIVE);
    this.markAsUpdated();

    // TODO: Add domain event for project activated
  }

  /**
   * Complete the project
   */
  complete(): void {
    if (!this._status.canTransitionTo(ProjectStatus.COMPLETED)) {
      throw new DomainError(
        `Cannot complete project from ${this._status.value} status`
      );
    }

    this._status = ProjectStatusVO.create(ProjectStatus.COMPLETED);
    this.markAsUpdated();

    // TODO: Add domain event for project completed
  }

  /**
   * Cancel the project
   */
  cancel(): void {
    if (!this._status.canTransitionTo(ProjectStatus.CANCELLED)) {
      throw new DomainError(
        `Cannot cancel project from ${this._status.value} status`
      );
    }

    this._status = ProjectStatusVO.create(ProjectStatus.CANCELLED);
    this.markAsUpdated();

    // TODO: Add domain event for project cancelled
  }

  /**
   * Archive the project
   */
  archive(): void {
    if (!this._status.canTransitionTo(ProjectStatus.ARCHIVED)) {
      throw new DomainError(
        `Cannot archive project from ${this._status.value} status`
      );
    }

    this._status = ProjectStatusVO.create(ProjectStatus.ARCHIVED);
    this.markAsUpdated();

    // TODO: Add domain event for project archived
  }

  /**
   * Check if the project is active
   */
  isActive(): boolean {
    return this._status.isActive();
  }

  /**
   * Check if the project is completed
   */
  isCompleted(): boolean {
    return this._status.isCompleted();
  }

  /**
   * Check if the project is operational
   */
  isOperational(): boolean {
    return this._status.isOperational();
  }

  /**
   * Validate the project entity
   */
  protected validate(): void {
    this.validateName(this._name);
    this.validateDescription(this._description);
    this.validateDateRange(this._startDate, this._endDate);
  }

  /**
   * Validate the project's name
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw ValidationError.forField('name', 'Project name cannot be empty');
    }

    if (name.length < PROJECT_VALIDATION.NAME_MIN_LENGTH) {
      throw ValidationError.forField(
        'name',
        `Project name must be at least ${PROJECT_VALIDATION.NAME_MIN_LENGTH} character(s)`
      );
    }

    if (name.length > PROJECT_VALIDATION.NAME_MAX_LENGTH) {
      throw ValidationError.forField(
        'name',
        `Project name cannot exceed ${PROJECT_VALIDATION.NAME_MAX_LENGTH} characters`
      );
    }
  }

  /**
   * Validate the project's description
   */
  private validateDescription(description: string): void {
    if (
      description &&
      description.length > PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH
    ) {
      throw ValidationError.forField(
        'description',
        `Project description cannot exceed ${PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`
      );
    }
  }

  /**
   * Validate the project's date range
   */
  private validateDateRange(
    startDate: Date | null,
    endDate: Date | null
  ): void {
    if (startDate && endDate && startDate >= endDate) {
      throw ValidationError.forField(
        'dateRange',
        'Project start date must be before end date'
      );
    }
  }

  /**
   * Get validation errors for the current state
   */
  getValidationErrors(): string[] {
    const errors: string[] = [];

    try {
      this.validate();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      }
    }

    return errors;
  }

  /**
   * Create a new Project instance
   */
  static create(
    id: ProjectId,
    name: string,
    description: string,
    workspaceId: WorkspaceId,
    managerId: UserId,
    startDate?: Date,
    endDate?: Date
  ): Project {
    return new Project(
      id,
      name,
      description,
      workspaceId,
      managerId,
      ProjectStatusVO.create(ProjectStatus.ACTIVE),
      startDate ?? null,
      endDate ?? null
    );
  }

  /**
   * Restore a Project from persistence
   */
  static restore(
    id: ProjectId,
    name: string,
    description: string,
    workspaceId: WorkspaceId,
    managerId: UserId,
    status: ProjectStatusVO,
    startDate: Date | null,
    endDate: Date | null,
    members: ProjectMember[],
    createdAt: Date,
    updatedAt: Date
  ): Project {
    const project = new Project(
      id,
      name,
      description,
      workspaceId,
      managerId,
      status,
      startDate,
      endDate,
      createdAt,
      updatedAt
    );

    // Clear the default owner member and add the restored members
    project._members.clear();
    members.forEach(member => {
      project._members.set(member.userId.toString(), member);
    });

    return project;
  }
}
