import { WorkspaceId } from '../value-objects/WorkspaceId';
import { ProjectId } from '../value-objects/ProjectId';
import { TaskId } from '../value-objects/TaskId';
import { UserId } from '../../authentication/value-objects/UserId';
import {
  WorkspaceMemberRepository,
  WorkspaceRoleRepository,
  MemberStatus,
} from '../repositories/WorkspaceMemberRepository';

export interface PermissionContext {
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  taskId?: TaskId;
  resourceOwnerId?: UserId;
}

export interface PermissionResult {
  granted: boolean;
  reason?: string;
  requiredPermissions?: string[];
}

export enum WorkspacePermission {
  // Workspace permissions
  WORKSPACE_VIEW = 'workspace.view',
  WORKSPACE_UPDATE = 'workspace.update',
  WORKSPACE_DELETE = 'workspace.delete',
  WORKSPACE_INVITE_MEMBERS = 'workspace.invite_members',
  WORKSPACE_REMOVE_MEMBERS = 'workspace.remove_members',
  WORKSPACE_MANAGE_ROLES = 'workspace.manage_roles',
  WORKSPACE_VIEW_ANALYTICS = 'workspace.view_analytics',

  // Project permissions
  PROJECT_VIEW = 'project.view',
  PROJECT_CREATE = 'project.create',
  PROJECT_UPDATE = 'project.update',
  PROJECT_DELETE = 'project.delete',
  PROJECT_ARCHIVE = 'project.archive',
  PROJECT_MANAGE_MEMBERS = 'project.manage_members',

  // Task permissions
  TASK_VIEW = 'task.view',
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_DELETE = 'task.delete',
  TASK_ASSIGN = 'task.assign',
  TASK_COMMENT = 'task.comment',

  // Team permissions
  TEAM_VIEW = 'team.view',
  TEAM_CREATE = 'team.create',
  TEAM_UPDATE = 'team.update',
  TEAM_DELETE = 'team.delete',
  TEAM_MANAGE_MEMBERS = 'team.manage_members',

  // File permissions
  FILE_VIEW = 'file.view',
  FILE_UPLOAD = 'file.upload',
  FILE_DELETE = 'file.delete',

  // Analytics permissions
  ANALYTICS_VIEW = 'analytics.view',
  ANALYTICS_EXPORT = 'analytics.export',
}

export class WorkspacePermissionService {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly roleRepository: WorkspaceRoleRepository
  ) {}

  /**
   * Check if user has specific permission in workspace context
   */
  async checkPermission(
    userId: UserId,
    permission: WorkspacePermission,
    context: PermissionContext
  ): Promise<PermissionResult> {
    try {
      // Get user's membership in workspace
      const member = await this.memberRepository.findMember(
        context.workspaceId,
        userId
      );

      if (!member) {
        return {
          granted: false,
          reason: 'User is not a member of this workspace',
        };
      }

      if (member.status !== MemberStatus.ACTIVE) {
        return {
          granted: false,
          reason: 'User membership is not active',
        };
      }

      // Get user's role and permissions
      const role = await this.roleRepository.findById(member.roleId);
      if (!role) {
        return {
          granted: false,
          reason: 'User role not found',
        };
      }

      // Check if role has the required permission
      if (!role.permissions.includes(permission)) {
        return {
          granted: false,
          reason: 'Insufficient permissions',
          requiredPermissions: [permission],
        };
      }

      // Additional context-based checks
      const contextResult = await this.checkContextualPermissions(
        userId,
        permission,
        context,
        role.permissions
      );

      if (!contextResult.granted) {
        return contextResult;
      }

      return { granted: true };
    } catch (error) {
      return {
        granted: false,
        reason: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check multiple permissions at once
   */
  async checkMultiplePermissions(
    userId: UserId,
    permissions: WorkspacePermission[],
    context: PermissionContext
  ): Promise<Record<WorkspacePermission, PermissionResult>> {
    const results: Record<WorkspacePermission, PermissionResult> = {} as any;

    for (const permission of permissions) {
      results[permission] = await this.checkPermission(
        userId,
        permission,
        context
      );
    }

    return results;
  }

  /**
   * Ensure user has specific permission (throws if not)
   */
  async ensurePermission(
    userId: UserId,
    permission: WorkspacePermission,
    context: PermissionContext
  ): Promise<void> {
    const result = await this.checkPermission(userId, permission, context);

    if (!result.granted) {
      throw new Error(
        result.reason || `Access denied: ${permission} permission required`
      );
    }
  }

  /**
   * Get all permissions for user in workspace
   */
  async getUserPermissions(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<string[]> {
    const member = await this.memberRepository.findMember(workspaceId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      return [];
    }

    const role = await this.roleRepository.findById(member.roleId);
    return role?.permissions || [];
  }

  /**
   * Check if user can access workspace
   */
  async canAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const result = await this.checkPermission(
      userId,
      WorkspacePermission.WORKSPACE_VIEW,
      { workspaceId }
    );
    return result.granted;
  }

  /**
   * Check if user can manage workspace
   */
  async canManageWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const result = await this.checkPermission(
      userId,
      WorkspacePermission.WORKSPACE_UPDATE,
      { workspaceId }
    );
    return result.granted;
  }

  /**
   * Check if user can invite members to workspace
   */
  async canInviteMembers(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const result = await this.checkPermission(
      userId,
      WorkspacePermission.WORKSPACE_INVITE_MEMBERS,
      { workspaceId }
    );
    return result.granted;
  }

  /**
   * Check contextual permissions based on resource ownership and hierarchy
   */
  private async checkContextualPermissions(
    userId: UserId,
    permission: WorkspacePermission,
    context: PermissionContext,
    userPermissions: string[]
  ): Promise<PermissionResult> {
    // Resource ownership checks
    if (context.resourceOwnerId && context.resourceOwnerId.equals(userId)) {
      // Resource owners have additional permissions
      const ownerPermissions = this.getOwnerPermissions(permission);
      if (ownerPermissions.some(p => userPermissions.includes(p))) {
        return { granted: true };
      }
    }

    // Project-level permission checks
    if (context.projectId) {
      const projectResult = await this.checkProjectPermissions(
        userId,
        permission,
        context
      );
      if (!projectResult.granted) {
        return projectResult;
      }
    }

    // Task-level permission checks
    if (context.taskId) {
      const taskResult = await this.checkTaskPermissions(
        userId,
        permission,
        context
      );
      if (!taskResult.granted) {
        return taskResult;
      }
    }

    return { granted: true };
  }

  /**
   * Get permissions that resource owners automatically have
   */
  private getOwnerPermissions(permission: WorkspacePermission): string[] {
    const ownerPermissionMap: Record<string, string[]> = {
      [WorkspacePermission.PROJECT_UPDATE]: [WorkspacePermission.PROJECT_VIEW],
      [WorkspacePermission.PROJECT_DELETE]: [
        WorkspacePermission.PROJECT_UPDATE,
      ],
      [WorkspacePermission.TASK_UPDATE]: [WorkspacePermission.TASK_VIEW],
      [WorkspacePermission.TASK_DELETE]: [WorkspacePermission.TASK_UPDATE],
      [WorkspacePermission.TASK_ASSIGN]: [WorkspacePermission.TASK_UPDATE],
    };

    return ownerPermissionMap[permission] || [];
  }

  /**
   * Check project-specific permissions
   */
  private async checkProjectPermissions(
    userId: UserId,
    permission: WorkspacePermission,
    context: PermissionContext
  ): Promise<PermissionResult> {
    // In a full implementation, this would check:
    // - Project membership
    // - Project-specific roles
    // - Project visibility settings

    // For now, return granted if user has workspace-level permission
    return { granted: true };
  }

  /**
   * Check task-specific permissions
   */
  private async checkTaskPermissions(
    userId: UserId,
    permission: WorkspacePermission,
    context: PermissionContext
  ): Promise<PermissionResult> {
    // In a full implementation, this would check:
    // - Task assignment
    // - Task visibility
    // - Task-specific permissions

    // For now, return granted if user has workspace-level permission
    return { granted: true };
  }

  /**
   * Get hierarchical permissions for a role
   */
  async getHierarchicalPermissions(roleId: string): Promise<string[]> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      return [];
    }

    // Start with role's direct permissions
    const permissions = new Set(role.permissions);

    // Add implied permissions based on hierarchy
    for (const permission of role.permissions) {
      const impliedPermissions = this.getImpliedPermissions(permission);
      impliedPermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Get permissions that are implied by having a higher-level permission
   */
  private getImpliedPermissions(permission: string): string[] {
    const permissionHierarchy: Record<string, string[]> = {
      [WorkspacePermission.WORKSPACE_UPDATE]: [
        WorkspacePermission.WORKSPACE_VIEW,
      ],
      [WorkspacePermission.WORKSPACE_DELETE]: [
        WorkspacePermission.WORKSPACE_UPDATE,
        WorkspacePermission.WORKSPACE_VIEW,
      ],
      [WorkspacePermission.PROJECT_UPDATE]: [WorkspacePermission.PROJECT_VIEW],
      [WorkspacePermission.PROJECT_DELETE]: [
        WorkspacePermission.PROJECT_UPDATE,
        WorkspacePermission.PROJECT_VIEW,
      ],
      [WorkspacePermission.TASK_UPDATE]: [WorkspacePermission.TASK_VIEW],
      [WorkspacePermission.TASK_DELETE]: [
        WorkspacePermission.TASK_UPDATE,
        WorkspacePermission.TASK_VIEW,
      ],
      [WorkspacePermission.TASK_ASSIGN]: [WorkspacePermission.TASK_VIEW],
    };

    return permissionHierarchy[permission] || [];
  }

  /**
   * Check if permission is valid for workspace context
   */
  isValidWorkspacePermission(permission: string): boolean {
    return Object.values(WorkspacePermission).includes(
      permission as WorkspacePermission
    );
  }

  /**
   * Get all available permissions grouped by category
   */
  getAvailablePermissions(): Record<string, WorkspacePermission[]> {
    return {
      workspace: [
        WorkspacePermission.WORKSPACE_VIEW,
        WorkspacePermission.WORKSPACE_UPDATE,
        WorkspacePermission.WORKSPACE_DELETE,
        WorkspacePermission.WORKSPACE_INVITE_MEMBERS,
        WorkspacePermission.WORKSPACE_REMOVE_MEMBERS,
        WorkspacePermission.WORKSPACE_MANAGE_ROLES,
        WorkspacePermission.WORKSPACE_VIEW_ANALYTICS,
      ],
      project: [
        WorkspacePermission.PROJECT_VIEW,
        WorkspacePermission.PROJECT_CREATE,
        WorkspacePermission.PROJECT_UPDATE,
        WorkspacePermission.PROJECT_DELETE,
        WorkspacePermission.PROJECT_ARCHIVE,
        WorkspacePermission.PROJECT_MANAGE_MEMBERS,
      ],
      task: [
        WorkspacePermission.TASK_VIEW,
        WorkspacePermission.TASK_CREATE,
        WorkspacePermission.TASK_UPDATE,
        WorkspacePermission.TASK_DELETE,
        WorkspacePermission.TASK_ASSIGN,
        WorkspacePermission.TASK_COMMENT,
      ],
      team: [
        WorkspacePermission.TEAM_VIEW,
        WorkspacePermission.TEAM_CREATE,
        WorkspacePermission.TEAM_UPDATE,
        WorkspacePermission.TEAM_DELETE,
        WorkspacePermission.TEAM_MANAGE_MEMBERS,
      ],
      file: [
        WorkspacePermission.FILE_VIEW,
        WorkspacePermission.FILE_UPLOAD,
        WorkspacePermission.FILE_DELETE,
      ],
      analytics: [
        WorkspacePermission.ANALYTICS_VIEW,
        WorkspacePermission.ANALYTICS_EXPORT,
      ],
    };
  }
}
