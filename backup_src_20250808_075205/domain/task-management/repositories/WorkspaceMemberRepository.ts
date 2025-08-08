import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';

export enum MemberStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
}

export interface WorkspaceMember {
  id: string;
  workspaceId: WorkspaceId;
  userId: UserId;
  roleId: string;
  invitedBy?: UserId;
  joinedAt: Date;
  lastActiveAt?: Date;
  status: MemberStatus;
}

export interface WorkspaceRole {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
}

export interface WorkspaceMemberRepository {
  /**
   * Add a member to workspace
   */
  addMember(member: WorkspaceMember): Promise<void>;

  /**
   * Remove member from workspace
   */
  removeMember(workspaceId: WorkspaceId, userId: UserId): Promise<void>;

  /**
   * Update member status
   */
  updateMemberStatus(
    workspaceId: WorkspaceId,
    userId: UserId,
    status: MemberStatus
  ): Promise<void>;

  /**
   * Update member role
   */
  updateMemberRole(
    workspaceId: WorkspaceId,
    userId: UserId,
    roleId: string
  ): Promise<void>;

  /**
   * Find member by workspace and user ID
   */
  findMember(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<WorkspaceMember | null>;

  /**
   * Find all members of a workspace
   */
  findMembersByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceMember[]>;

  /**
   * Find all workspaces where user is a member
   */
  findWorkspacesByMember(userId: UserId): Promise<WorkspaceMember[]>;

  /**
   * Check if user is member of workspace
   */
  isMember(workspaceId: WorkspaceId, userId: UserId): Promise<boolean>;

  /**
   * Get member count for workspace
   */
  getMemberCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Find members with specific role
   */
  findMembersByRole(
    workspaceId: WorkspaceId,
    roleId: string
  ): Promise<WorkspaceMember[]>;

  /**
   * Find pending invitations
   */
  findPendingInvitations(workspaceId: WorkspaceId): Promise<WorkspaceMember[]>;

  /**
   * Update last active timestamp
   */
  updateLastActive(workspaceId: WorkspaceId, userId: UserId): Promise<void>;
}

export interface WorkspaceRoleRepository {
  /**
   * Save workspace role
   */
  save(role: WorkspaceRole): Promise<void>;

  /**
   * Find role by ID
   */
  findById(roleId: string): Promise<WorkspaceRole | null>;

  /**
   * Find roles by workspace
   */
  findByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceRole[]>;

  /**
   * Find role by name within workspace
   */
  findByName(
    workspaceId: WorkspaceId,
    name: string
  ): Promise<WorkspaceRole | null>;

  /**
   * Delete role
   */
  delete(roleId: string): Promise<void>;

  /**
   * Check if role name is available in workspace
   */
  isNameAvailable(
    workspaceId: WorkspaceId,
    name: string,
    excludeId?: string
  ): Promise<boolean>;

  /**
   * Find system roles
   */
  findSystemRoles(): Promise<WorkspaceRole[]>;

  /**
   * Get default member role for workspace
   */
  getDefaultMemberRole(workspaceId: WorkspaceId): Promise<WorkspaceRole | null>;
}
