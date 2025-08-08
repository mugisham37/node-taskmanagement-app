import { Workspace, SubscriptionTier } from '../entities/Workspace';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import {
  WorkspaceMemberRepository,
  WorkspaceRoleRepository,
  WorkspaceMember,
  WorkspaceRole,
  MemberStatus,
} from '../repositories/WorkspaceMemberRepository';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface CreateWorkspaceRequest {
  name: string;
  slug: string;
  description?: string;
  subscriptionTier?: SubscriptionTier;
  billingEmail?: string;
  settings?: any;
  branding?: any;
  securitySettings?: any;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: any;
  branding?: any;
  securitySettings?: any;
}

export interface InviteMemberRequest {
  userId: UserId;
  roleId: string;
  invitedBy: UserId;
}

export interface WorkspaceContext {
  workspace: Workspace;
  member: WorkspaceMember;
  role: WorkspaceRole;
  permissions: string[];
}

export interface WorkspaceUsage {
  memberCount: number;
  projectCount: number;
  storageUsageGb: number;
  memberLimit: number;
  projectLimit: number;
  storageLimitGb: number;
}

// Domain Events
export class WorkspaceMemberInvitedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly memberId: UserId,
    public readonly invitedBy: UserId,
    public readonly roleId: string
  ) {
    super('WorkspaceMemberInvited', {
      workspaceId: workspaceId.value,
      memberId: memberId.value,
      invitedBy: invitedBy.value,
      roleId,
    });
  }
}

export class WorkspaceMemberJoinedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly memberId: UserId,
    public readonly roleId: string
  ) {
    super('WorkspaceMemberJoined', {
      workspaceId: workspaceId.value,
      memberId: memberId.value,
      roleId,
    });
  }
}

export class WorkspaceMemberRemovedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly memberId: UserId,
    public readonly removedBy: UserId
  ) {
    super('WorkspaceMemberRemoved', {
      workspaceId: workspaceId.value,
      memberId: memberId.value,
      removedBy: removedBy.value,
    });
  }
}

export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly roleRepository: WorkspaceRoleRepository
  ) {}

  /**
   * Create a new workspace with the user as owner
   */
  async createWorkspace(
    ownerId: UserId,
    request: CreateWorkspaceRequest
  ): Promise<Workspace> {
    // Check if slug is available
    const isSlugAvailable = await this.workspaceRepository.isSlugAvailable(
      request.slug
    );
    if (!isSlugAvailable) {
      throw new Error(`Workspace slug '${request.slug}' is already taken`);
    }

    // Create workspace
    const workspace = Workspace.create({
      name: request.name,
      slug: request.slug,
      description: request.description,
      ownerId,
      subscriptionTier: request.subscriptionTier || SubscriptionTier.FREE,
      billingEmail: request.billingEmail,
      settings: request.settings || {},
      branding: request.branding || {},
      securitySettings: request.securitySettings || {},
      isActive: true,
      memberLimit: 0, // Will be set by entity based on subscription tier
      projectLimit: 0, // Will be set by entity based on subscription tier
      storageLimitGb: 0, // Will be set by entity based on subscription tier
    });

    // Save workspace
    await this.workspaceRepository.save(workspace);

    // Create default roles for the workspace
    await this.createDefaultRoles(workspace.id);

    // Add owner as admin member
    const adminRole = await this.roleRepository.findByName(
      workspace.id,
      'Admin'
    );
    if (adminRole) {
      const ownerMember: WorkspaceMember = {
        id: this.generateId(),
        workspaceId: workspace.id,
        userId: ownerId,
        roleId: adminRole.id,
        joinedAt: new Date(),
        status: MemberStatus.ACTIVE,
      };

      await this.memberRepository.addMember(ownerMember);
    }

    return workspace;
  }

  /**
   * Update workspace details
   */
  async updateWorkspace(
    workspaceId: WorkspaceId,
    userId: UserId,
    request: UpdateWorkspaceRequest
  ): Promise<Workspace> {
    const workspace = await this.getWorkspaceById(workspaceId);

    // Check permissions
    await this.ensureWorkspacePermission(
      workspaceId,
      userId,
      'workspace.update'
    );

    // Update workspace
    if (request.name) {
      workspace.updateName(request.name);
    }

    if (request.description !== undefined) {
      workspace.updateDescription(request.description);
    }

    if (request.settings) {
      workspace.updateSettings(request.settings);
    }

    if (request.branding) {
      workspace.updateBranding(request.branding);
    }

    if (request.securitySettings) {
      workspace.updateSecuritySettings(request.securitySettings);
    }

    await this.workspaceRepository.save(workspace);
    return workspace;
  }

  /**
   * Get workspace by ID with access control
   */
  async getWorkspaceById(workspaceId: WorkspaceId): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.isDeleted()) {
      throw new Error('Workspace has been deleted');
    }

    return workspace;
  }

  /**
   * Get workspace by slug
   */
  async getWorkspaceBySlug(slug: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.isDeleted()) {
      throw new Error('Workspace has been deleted');
    }

    return workspace;
  }

  /**
   * Get all workspaces where user is a member
   */
  async getUserWorkspaces(userId: UserId): Promise<Workspace[]> {
    return await this.workspaceRepository.findByMemberId(userId);
  }

  /**
   * Switch user's workspace context
   */
  async switchWorkspaceContext(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<WorkspaceContext> {
    // Verify user is member of workspace
    const member = await this.memberRepository.findMember(workspaceId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new Error('User is not an active member of this workspace');
    }

    // Get workspace
    const workspace = await this.getWorkspaceById(workspaceId);

    // Get role and permissions
    const role = await this.roleRepository.findById(member.roleId);
    if (!role) {
      throw new Error('Member role not found');
    }

    // Update last active timestamp
    await this.memberRepository.updateLastActive(workspaceId, userId);

    return {
      workspace,
      member,
      role,
      permissions: role.permissions,
    };
  }

  /**
   * Invite a user to workspace
   */
  async inviteMember(
    workspaceId: WorkspaceId,
    request: InviteMemberRequest
  ): Promise<void> {
    const workspace = await this.getWorkspaceById(workspaceId);

    // Check permissions
    await this.ensureWorkspacePermission(
      workspaceId,
      request.invitedBy,
      'workspace.invite_members'
    );

    // Check if user is already a member
    const existingMember = await this.memberRepository.findMember(
      workspaceId,
      request.userId
    );
    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Check member limit
    const currentMemberCount =
      await this.memberRepository.getMemberCount(workspaceId);
    if (!workspace.canAddMember(currentMemberCount)) {
      throw new Error('Workspace member limit reached');
    }

    // Verify role exists
    const role = await this.roleRepository.findById(request.roleId);
    if (!role || !role.workspaceId.equals(workspaceId)) {
      throw new Error('Invalid role for this workspace');
    }

    // Create member invitation
    const member: WorkspaceMember = {
      id: this.generateId(),
      workspaceId,
      userId: request.userId,
      roleId: request.roleId,
      invitedBy: request.invitedBy,
      joinedAt: new Date(),
      status: MemberStatus.PENDING,
    };

    await this.memberRepository.addMember(member);

    // Emit domain event
    // Note: In a real implementation, this would be handled by the domain event system
    console.log(
      new WorkspaceMemberInvitedEvent(
        workspaceId,
        request.userId,
        request.invitedBy,
        request.roleId
      )
    );
  }

  /**
   * Accept workspace invitation
   */
  async acceptInvitation(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<void> {
    const member = await this.memberRepository.findMember(workspaceId, userId);
    if (!member) {
      throw new Error('No invitation found');
    }

    if (member.status !== MemberStatus.PENDING) {
      throw new Error('Invitation is not pending');
    }

    // Update member status
    await this.memberRepository.updateMemberStatus(
      workspaceId,
      userId,
      MemberStatus.ACTIVE
    );

    // Emit domain event
    console.log(
      new WorkspaceMemberJoinedEvent(workspaceId, userId, member.roleId)
    );
  }

  /**
   * Remove member from workspace
   */
  async removeMember(
    workspaceId: WorkspaceId,
    memberId: UserId,
    removedBy: UserId
  ): Promise<void> {
    const workspace = await this.getWorkspaceById(workspaceId);

    // Check permissions
    await this.ensureWorkspacePermission(
      workspaceId,
      removedBy,
      'workspace.remove_members'
    );

    // Cannot remove workspace owner
    if (workspace.isOwner(memberId)) {
      throw new Error('Cannot remove workspace owner');
    }

    // Cannot remove self if you are the owner
    if (workspace.isOwner(removedBy) && removedBy.equals(memberId)) {
      throw new Error('Workspace owner cannot remove themselves');
    }

    // Remove member
    await this.memberRepository.removeMember(workspaceId, memberId);

    // Emit domain event
    console.log(
      new WorkspaceMemberRemovedEvent(workspaceId, memberId, removedBy)
    );
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: WorkspaceId,
    memberId: UserId,
    newRoleId: string,
    updatedBy: UserId
  ): Promise<void> {
    const workspace = await this.getWorkspaceById(workspaceId);

    // Check permissions
    await this.ensureWorkspacePermission(
      workspaceId,
      updatedBy,
      'workspace.manage_roles'
    );

    // Cannot change owner role
    if (workspace.isOwner(memberId)) {
      throw new Error('Cannot change workspace owner role');
    }

    // Verify new role exists
    const role = await this.roleRepository.findById(newRoleId);
    if (!role || !role.workspaceId.equals(workspaceId)) {
      throw new Error('Invalid role for this workspace');
    }

    // Update member role
    await this.memberRepository.updateMemberRole(
      workspaceId,
      memberId,
      newRoleId
    );
  }

  /**
   * Get workspace usage statistics
   */
  async getWorkspaceUsage(workspaceId: WorkspaceId): Promise<WorkspaceUsage> {
    const workspace = await this.getWorkspaceById(workspaceId);

    const [memberCount, projectCount, storageUsageGb] = await Promise.all([
      this.workspaceRepository.getMemberCount(workspaceId),
      this.workspaceRepository.getProjectCount(workspaceId),
      this.workspaceRepository.getStorageUsage(workspaceId),
    ]);

    return {
      memberCount,
      projectCount,
      storageUsageGb,
      memberLimit: workspace.memberLimit,
      projectLimit: workspace.projectLimit,
      storageLimitGb: workspace.storageLimitGb,
    };
  }

  /**
   * Delete workspace (soft delete)
   */
  async deleteWorkspace(
    workspaceId: WorkspaceId,
    deletedBy: UserId
  ): Promise<void> {
    const workspace = await this.getWorkspaceById(workspaceId);

    // Only owner can delete workspace
    if (!workspace.isOwner(deletedBy)) {
      throw new Error('Only workspace owner can delete the workspace');
    }

    // Mark workspace as deleted
    workspace.delete(deletedBy);
    await this.workspaceRepository.save(workspace);
  }

  /**
   * Check if user has specific permission in workspace
   */
  async hasPermission(
    workspaceId: WorkspaceId,
    userId: UserId,
    permission: string
  ): Promise<boolean> {
    try {
      const member = await this.memberRepository.findMember(
        workspaceId,
        userId
      );
      if (!member || member.status !== MemberStatus.ACTIVE) {
        return false;
      }

      const role = await this.roleRepository.findById(member.roleId);
      if (!role) {
        return false;
      }

      return role.permissions.includes(permission);
    } catch {
      return false;
    }
  }

  /**
   * Ensure user has specific permission in workspace
   */
  private async ensureWorkspacePermission(
    workspaceId: WorkspaceId,
    userId: UserId,
    permission: string
  ): Promise<void> {
    const hasPermission = await this.hasPermission(
      workspaceId,
      userId,
      permission
    );

    if (!hasPermission) {
      throw new Error(`Insufficient permissions: ${permission}`);
    }
  }

  /**
   * Create default roles for a new workspace
   */
  private async createDefaultRoles(workspaceId: WorkspaceId): Promise<void> {
    const defaultRoles: Omit<WorkspaceRole, 'id' | 'createdAt'>[] = [
      {
        workspaceId,
        name: 'Admin',
        description: 'Full access to workspace',
        permissions: [
          'workspace.update',
          'workspace.delete',
          'workspace.invite_members',
          'workspace.remove_members',
          'workspace.manage_roles',
          'project.create',
          'project.update',
          'project.delete',
          'task.create',
          'task.update',
          'task.delete',
          'task.assign',
        ],
        isSystemRole: true,
      },
      {
        workspaceId,
        name: 'Member',
        description: 'Standard workspace member',
        permissions: [
          'project.view',
          'project.create',
          'task.create',
          'task.update',
          'task.assign',
        ],
        isSystemRole: true,
      },
      {
        workspaceId,
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['project.view', 'task.view'],
        isSystemRole: true,
      },
    ];

    for (const roleData of defaultRoles) {
      const role: WorkspaceRole = {
        ...roleData,
        id: this.generateId(),
        createdAt: new Date(),
      };
      await this.roleRepository.save(role);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
// TODO: This is a temporary instance export for compatibility during migration
// In the final architecture, services should be properly injected via DI container
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { WorkspaceMemberRepository } from '../repositories/WorkspaceMemberRepository';

// Create temporary instances (this should be replaced with proper DI)
const workspaceRepository = new WorkspaceRepository();
const memberRepository = new WorkspaceMemberRepository();

export const workspaceService = new WorkspaceService(
  workspaceRepository,
  memberRepository
);
