import { ProjectId } from '../value-objects/ProjectId';
import { UserId } from '../../authentication/value-objects/UserId';

export enum ProjectMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export interface ProjectMember {
  id: string;
  projectId: ProjectId;
  userId: UserId;
  role: ProjectMemberRole;
  addedBy?: UserId;
  addedAt: Date;
}

export interface ProjectMemberRepository {
  /**
   * Add member to project
   */
  addMember(member: ProjectMember): Promise<void>;

  /**
   * Remove member from project
   */
  removeMember(projectId: ProjectId, userId: UserId): Promise<void>;

  /**
   * Update member role
   */
  updateMemberRole(
    projectId: ProjectId,
    userId: UserId,
    role: ProjectMemberRole
  ): Promise<void>;

  /**
   * Find member by project and user ID
   */
  findMember(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMember | null>;

  /**
   * Find all members of a project
   */
  findMembersByProject(projectId: ProjectId): Promise<ProjectMember[]>;

  /**
   * Find all projects where user is a member
   */
  findProjectsByMember(userId: UserId): Promise<ProjectMember[]>;

  /**
   * Check if user is member of project
   */
  isMember(projectId: ProjectId, userId: UserId): Promise<boolean>;

  /**
   * Get member count for project
   */
  getMemberCount(projectId: ProjectId): Promise<number>;

  /**
   * Find members with specific role
   */
  findMembersByRole(
    projectId: ProjectId,
    role: ProjectMemberRole
  ): Promise<ProjectMember[]>;

  /**
   * Get user's role in project
   */
  getUserRole(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMemberRole | null>;

  /**
   * Find project owners
   */
  findProjectOwners(projectId: ProjectId): Promise<ProjectMember[]>;

  /**
   * Find project admins
   */
  findProjectAdmins(projectId: ProjectId): Promise<ProjectMember[]>;

  /**
   * Bulk add members to project
   */
  bulkAddMembers(members: ProjectMember[]): Promise<void>;

  /**
   * Bulk remove members from project
   */
  bulkRemoveMembers(projectId: ProjectId, userIds: UserId[]): Promise<void>;
}
