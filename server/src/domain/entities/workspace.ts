import { BaseEntity } from './base-entity';
import { WorkspaceId, UserId, ProjectId } from '../value-objects';
import { WorkspacePlan } from '../value-objects/workspace-plan';
import { DomainError, ValidationError } from '../../shared/errors';
import { WorkspaceMember } from './workspace-member';

/**
 * Workspace settings interface
 */
export interface WorkspaceSettings {
  allowPublicProjects: boolean;
  requireApprovalForMembers: boolean;
  maxProjects: number;
  maxMembers: number;
  maxStorageGB: number;
  enableIntegrations: boolean;
  enableCustomFields: boolean;
  enableTimeTracking: boolean;
  enableReporting: boolean;
  defaultProjectVisibility: 'private' | 'internal' | 'public';
  allowedEmailDomains: string[];
  ssoEnabled: boolean;
  ssoProvider?: string;
  customBranding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

/**
 * Workspace domain entity
 * Represents a workspace with ownership, project management, and access control
 */
export class Workspace extends BaseEntity<WorkspaceId> {
  private _name: string;
  private _slug: string;
  private _description: string;
  private _ownerId: UserId;
  private _plan: WorkspacePlan;
  private _settings: WorkspaceSettings;
  private _isActive: boolean;
  private _members: Map<string, WorkspaceMember>;
  private _projectIds: Set<string>;

  constructor(
    id: WorkspaceId,
    name: string,
    slug: string,
    description: string,
    ownerId: UserId,
    plan: WorkspacePlan,
    settings: WorkspaceSettings,
    isActive: boolean = true,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._name = name;
    this._slug = slug;
    this._description = description;
    this._ownerId = ownerId;
    this._plan = plan;
    this._settings = settings;
    this._isActive = isActive;
    this._members = new Map();
    this._projectIds = new Set();

    // Add the owner as the first member
    this.addMember(ownerId, 'OWNER');

    this.validate();
  }

  /**
   * Get the workspace's name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get the workspace's slug
   */
  get slug(): string {
    return this._slug;
  }

  /**
   * Get the workspace's description
   */
  get description(): string {
    return this._description;
  }

  /**
   * Get the workspace's owner ID
   */
  get ownerId(): UserId {
    return this._ownerId;
  }

  /**
   * Get the workspace's plan
   */
  get plan(): WorkspacePlan {
    return this._plan;
  }

  /**
   * Get the workspace's settings
   */
  get settings(): WorkspaceSettings {
    return this._settings;
  }

  /**
   * Get whether the workspace is active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get all workspace members
   */
  get members(): WorkspaceMember[] {
    return Array.from(this._members.values());
  }

  /**
   * Get all project IDs in this workspace
   */
  get projectIds(): string[] {
    return Array.from(this._projectIds);
  }

  /**
   * Update the workspace's basic information
   */
  updateBasicInfo(name: string, description: string): void {
    if (!this._isActive) {
      throw new DomainError('Cannot update inactive workspace');
    }

    this.validateName(name);
    this.validateDescription(description);

    this._name = name;
    this._description = description;

    this.markAsUpdated();
  }

  /**
   * Update the workspace name
   */
  updateName(name: string, updatedBy: UserId): void {
    if (!this._isActive) {
      throw new DomainError('Cannot update inactive workspace');
    }

    if (!this.canUserUpdateWorkspace(updatedBy)) {
      throw new DomainError('Insufficient permissions to update workspace name');
    }

    this.validateName(name);
    this._name = name;
    this.markAsUpdated();
  }

  /**
   * Update the workspace description
   */
  updateDescription(description: string, updatedBy: UserId): void {
    if (!this._isActive) {
      throw new DomainError('Cannot update inactive workspace');
    }

    if (!this.canUserUpdateWorkspace(updatedBy)) {
      throw new DomainError('Insufficient permissions to update workspace description');
    }

    this.validateDescription(description);
    this._description = description;
    this.markAsUpdated();
  }

  /**
   * Update workspace settings
   */
  updateSettings(settings: WorkspaceSettings, updatedBy: UserId): void {
    if (!this._isActive) {
      throw new DomainError('Cannot update inactive workspace');
    }

    if (!this.canUserUpdateWorkspace(updatedBy)) {
      throw new DomainError('Insufficient permissions to update workspace settings');
    }

    this._settings = { ...this._settings, ...settings };
    this.markAsUpdated();
  }

  /**
   * Archive the workspace
   */
  archive(): void {
    if (!this._isActive) {
      throw new DomainError('Workspace is already archived');
    }

    this._isActive = false;
    this.markAsUpdated();
  }

  /**
   * Add a member to the workspace
   */
  addMember(userId: UserId, role: 'OWNER' | 'ADMIN' | 'MEMBER'): void {
    if (!this._isActive) {
      throw new DomainError('Cannot add members to inactive workspace');
    }

    const userIdStr = userId.toString();

    if (this._members.has(userIdStr)) {
      throw new DomainError('User is already a member of this workspace');
    }

    // Only one owner allowed
    if (role === 'OWNER' && this.hasOwner() && !userId.equals(this._ownerId)) {
      throw new DomainError('Workspace can only have one owner');
    }

    const member = new WorkspaceMember(userId, this.id, role);
    this._members.set(userIdStr, member);
    this.markAsUpdated();

    // TODO: Add domain event for member added
  }

  /**
   * Remove a member from the workspace
   */
  removeMember(userId: UserId): void {
    if (!this._isActive) {
      throw new DomainError('Cannot remove members from inactive workspace');
    }

    const userIdStr = userId.toString();

    if (!this._members.has(userIdStr)) {
      throw new DomainError('User is not a member of this workspace');
    }

    // Cannot remove the owner
    if (userId.equals(this._ownerId)) {
      throw new DomainError('Cannot remove the workspace owner');
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
    newRole: 'ADMIN' | 'MEMBER',
    updatedBy: UserId
  ): void {
    if (!this._isActive) {
      throw new DomainError('Cannot update member roles in inactive workspace');
    }

    const userIdStr = userId.toString();
    const member = this._members.get(userIdStr);

    if (!member) {
      throw new DomainError('User is not a member of this workspace');
    }

    // Cannot change the owner's role
    if (userId.equals(this._ownerId)) {
      throw new DomainError("Cannot change the workspace owner's role");
    }

    // Check if updater has permission to change roles
    if (!this.canUserManageMembers(updatedBy)) {
      throw new DomainError('Insufficient permissions to update member roles');
    }

    member.role = newRole;
    this.markAsUpdated();

    // TODO: Add domain event for member role updated
  }

  /**
   * Add a project to this workspace
   */
  addProject(projectId: ProjectId): void {
    if (!this._isActive) {
      throw new DomainError('Cannot add projects to inactive workspace');
    }

    const projectIdStr = projectId.toString();

    if (this._projectIds.has(projectIdStr)) {
      throw new DomainError('Project is already in this workspace');
    }

    this._projectIds.add(projectIdStr);
    this.markAsUpdated();

    // TODO: Add domain event for project added
  }

  /**
   * Remove a project from this workspace
   */
  removeProject(projectId: ProjectId): void {
    const projectIdStr = projectId.toString();

    if (!this._projectIds.has(projectIdStr)) {
      throw new DomainError('Project is not in this workspace');
    }

    this._projectIds.delete(projectIdStr);
    this.markAsUpdated();

    // TODO: Add domain event for project removed
  }

  /**
   * Check if a user can create projects in this workspace
   */
  canUserCreateProject(userId: UserId): boolean {
    if (!this._isActive) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role === 'OWNER' || member?.role === 'ADMIN';
  }

  /**
   * Check if a user can manage members in this workspace
   */
  canUserManageMembers(userId: UserId): boolean {
    if (!this._isActive) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role === 'OWNER' || member?.role === 'ADMIN';
  }

  /**
   * Check if a user can update this workspace
   */
  canUserUpdateWorkspace(userId: UserId): boolean {
    if (!this._isActive) {
      return false;
    }

    const member = this._members.get(userId.toString());
    return member?.role === 'OWNER' || member?.role === 'ADMIN';
  }

  /**
   * Check if a user can delete this workspace
   */
  canUserDeleteWorkspace(userId: UserId): boolean {
    return this._isActive && userId.equals(this._ownerId);
  }

  /**
   * Get a user's role in this workspace
   */
  getUserRole(userId: UserId): 'OWNER' | 'ADMIN' | 'MEMBER' | null {
    const member = this._members.get(userId.toString());
    return member?.role ?? null;
  }

  /**
   * Check if a user is a member of this workspace
   */
  isMember(userId: UserId): boolean {
    return this._members.has(userId.toString());
  }

  /**
   * Check if the workspace has an owner
   */
  private hasOwner(): boolean {
    return Array.from(this._members.values()).some(
      member => member.role === 'OWNER'
    );
  }

  /**
   * Get the number of members in this workspace
   */
  getMemberCount(): number {
    return this._members.size;
  }

  /**
   * Get the number of projects in this workspace
   */
  getProjectCount(): number {
    return this._projectIds.size;
  }

  /**
   * Deactivate the workspace
   */
  deactivate(): void {
    if (!this._isActive) {
      throw new DomainError('Workspace is already inactive');
    }

    this._isActive = false;
    this.markAsUpdated();

    // TODO: Add domain event for workspace deactivated
  }

  /**
   * Activate the workspace
   */
  activate(): void {
    if (this._isActive) {
      throw new DomainError('Workspace is already active');
    }

    this._isActive = true;
    this.markAsUpdated();

    // TODO: Add domain event for workspace activated
  }

  /**
   * Transfer ownership of the workspace
   */
  transferOwnership(newOwnerId: UserId, currentOwnerId: UserId): void {
    if (!this._isActive) {
      throw new DomainError('Cannot transfer ownership of inactive workspace');
    }

    if (!currentOwnerId.equals(this._ownerId)) {
      throw new DomainError('Only the current owner can transfer ownership');
    }

    if (newOwnerId.equals(this._ownerId)) {
      throw new DomainError('Cannot transfer ownership to the same user');
    }

    const newOwnerMember = this._members.get(newOwnerId.toString());
    if (!newOwnerMember) {
      throw new DomainError('New owner must be a member of the workspace');
    }

    // Update the current owner to admin
    const currentOwnerMember = this._members.get(this._ownerId.toString());
    if (currentOwnerMember) {
      currentOwnerMember.role = 'ADMIN';
    }

    // Update the new owner
    newOwnerMember.role = 'OWNER';
    this._ownerId = newOwnerId;

    this.markAsUpdated();

    // TODO: Add domain event for ownership transferred
  }

  /**
   * Validate the workspace entity
   */
  protected validate(): void {
    this.validateName(this._name);
    this.validateDescription(this._description);
  }

  /**
   * Validate the workspace's name
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw ValidationError.forField('name', 'Workspace name cannot be empty');
    }

    if (name.length < 1) {
      throw ValidationError.forField(
        'name',
        'Workspace name must be at least 1 character'
      );
    }

    if (name.length > 255) {
      throw ValidationError.forField(
        'name',
        'Workspace name cannot exceed 255 characters'
      );
    }
  }

  /**
   * Validate the workspace's description
   */
  private validateDescription(description: string): void {
    if (description && description.length > 2000) {
      throw ValidationError.forField(
        'description',
        'Workspace description cannot exceed 2000 characters'
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
   * Create a new Workspace instance
   */
  static create(data: {
    name: string;
    slug: string;
    description?: string;
    ownerId: UserId;
    plan: WorkspacePlan;
    settings: WorkspaceSettings;
  }): Workspace {
    const id = WorkspaceId.generate();
    return new Workspace(
      id,
      data.name,
      data.slug,
      data.description || '',
      data.ownerId,
      data.plan,
      data.settings
    );
  }

  /**
   * Restore a Workspace from persistence
   */
  static restore(
    id: WorkspaceId,
    name: string,
    slug: string,
    description: string,
    ownerId: UserId,
    plan: WorkspacePlan,
    settings: WorkspaceSettings,
    isActive: boolean,
    members: WorkspaceMember[],
    projectIds: string[],
    createdAt: Date,
    updatedAt: Date
  ): Workspace {
    const workspace = new Workspace(
      id,
      name,
      slug,
      description,
      ownerId,
      plan,
      settings,
      isActive,
      createdAt,
      updatedAt
    );

    // Clear the default owner member and add the restored members
    workspace._members.clear();
    members.forEach(member => {
      workspace._members.set(member.userId.toString(), member);
    });

    // Add the restored project IDs
    workspace._projectIds.clear();
    projectIds.forEach(projectId => {
      workspace._projectIds.add(projectId);
    });

    return workspace;
  }
}

export { WorkspaceMember } from './workspace-member';
