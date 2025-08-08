import { UserId } from '../value-objects/UserId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { Permission } from '../entities/Permission';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface PermissionContext {
  workspaceId?: WorkspaceId;
  projectId?: string;
  taskId?: string;
  teamId?: string;
  resourceOwnerId?: UserId;
}

export interface PermissionEvaluationContext {
  userId: UserId;
  permission: string;
  resource: string;
  resourceId?: string;
  context: PermissionContext;
}

export interface PermissionResult {
  granted: boolean;
  reason?: string;
  impliedBy?: string[];
  conditions?: Record<string, any>;
}

export interface HierarchicalPermissionCheck {
  workspacePermissions: string[];
  projectPermissions: string[];
  taskPermissions: string[];
  effectivePermissions: string[];
}

export class PermissionGrantedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly permission: string,
    public readonly resource: string,
    public readonly context: PermissionContext
  ) {
    super('PermissionGranted', {
      userId: userId.value,
      permission,
      resource,
      context,
    });
  }
}

export class PermissionDeniedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly permission: string,
    public readonly resource: string,
    public readonly reason: string,
    public readonly context: PermissionContext
  ) {
    super('PermissionDenied', {
      userId: userId.value,
      permission,
      resource,
      reason,
      context,
    });
  }
}

/**
 * Authorization Service with hierarchical permission checking for task resources
 * Implements workspace -> project -> task permission hierarchy
 */
export class AuthorizationService {
  constructor(
    private readonly userRepository: any,
    private readonly workspaceRepository: any,
    private readonly projectRepository: any,
    private readonly taskRepository: any,
    private readonly roleRepository: any,
    private readonly eventBus: any
  ) {}

  /**
   * Check workspace-level permission
   */
  async checkWorkspacePermission(
    userId: UserId,
    workspaceId: WorkspaceId,
    permission: string
  ): Promise<boolean> {
    try {
      const result = await this.evaluatePermission({
        userId,
        permission,
        resource: 'workspace',
        resourceId: workspaceId.value,
        context: { workspaceId },
      });

      if (result.granted) {
        await this.eventBus.publish(
          new PermissionGrantedEvent(userId, permission, 'workspace', {
            workspaceId,
          })
        );
      } else {
        await this.eventBus.publish(
          new PermissionDeniedEvent(
            userId,
            permission,
            'workspace',
            result.reason || 'Permission denied',
            { workspaceId }
          )
        );
      }

      return result.granted;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check project-level permission with workspace inheritance
   */
  async checkProjectPermission(
    userId: UserId,
    projectId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        return false;
      }

      const result = await this.evaluatePermission({
        userId,
        permission,
        resource: 'project',
        resourceId: projectId,
        context: {
          workspaceId: project.workspaceId,
          projectId,
        },
      });

      if (result.granted) {
        await this.eventBus.publish(
          new PermissionGrantedEvent(userId, permission, 'project', {
            workspaceId: project.workspaceId,
            projectId,
          })
        );
      } else {
        await this.eventBus.publish(
          new PermissionDeniedEvent(
            userId,
            permission,
            'project',
            result.reason || 'Permission denied',
            {
              workspaceId: project.workspaceId,
              projectId,
            }
          )
        );
      }

      return result.granted;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check task-level permission with project and workspace inheritance
   */
  async checkTaskPermission(
    userId: UserId,
    taskId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const task = await this.taskRepository.findById(taskId);
      if (!task) {
        return false;
      }

      const result = await this.evaluatePermission({
        userId,
        permission,
        resource: 'task',
        resourceId: taskId,
        context: {
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId,
          resourceOwnerId: task.creatorId,
        },
      });

      if (result.granted) {
        await this.eventBus.publish(
          new PermissionGrantedEvent(userId, permission, 'task', {
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            taskId,
          })
        );
      } else {
        await this.eventBus.publish(
          new PermissionDeniedEvent(
            userId,
            permission,
            'task',
            result.reason || 'Permission denied',
            {
              workspaceId: task.workspaceId,
              projectId: task.projectId,
              taskId,
            }
          )
        );
      }

      return result.granted;
    } catch (error) {
      return false;
    }
  }

  /**
   * Dynamic permission evaluation with context
   */
  async evaluatePermission(
    context: PermissionEvaluationContext
  ): Promise<PermissionResult> {
    try {
      // Check if permission is valid
      if (!Permission.isValidPermission(context.permission)) {
        return {
          granted: false,
          reason: 'Invalid permission',
        };
      }

      // Get user's hierarchical permissions
      const hierarchicalPermissions = await this.getHierarchicalPermissions(
        context.userId,
        context.context
      );

      // Check direct permission
      if (
        hierarchicalPermissions.effectivePermissions.includes(
          context.permission
        )
      ) {
        return {
          granted: true,
          impliedBy: [context.permission],
        };
      }

      // Check implied permissions
      const impliedBy = hierarchicalPermissions.effectivePermissions.filter(p =>
        Permission.implies(p, context.permission)
      );

      if (impliedBy.length > 0) {
        return {
          granted: true,
          impliedBy,
        };
      }

      // Check resource-specific permissions (e.g., task owner can edit their tasks)
      const resourcePermission =
        await this.checkResourceSpecificPermission(context);

      if (resourcePermission.granted) {
        return resourcePermission;
      }

      return {
        granted: false,
        reason: 'Insufficient permissions',
      };
    } catch (error) {
      return {
        granted: false,
        reason: 'Permission evaluation error',
      };
    }
  }

  /**
   * Get hierarchical permissions for a user in a given context
   */
  async getHierarchicalPermissions(
    userId: UserId,
    context: PermissionContext
  ): Promise<HierarchicalPermissionCheck> {
    const workspacePermissions: string[] = [];
    const projectPermissions: string[] = [];
    const taskPermissions: string[] = [];

    try {
      // Get workspace-level permissions
      if (context.workspaceId) {
        const workspaceMember = await this.getWorkspaceMember(
          userId,
          context.workspaceId
        );
        if (workspaceMember) {
          const role = await this.roleRepository.findById(
            workspaceMember.roleId
          );
          if (role) {
            workspacePermissions.push(...role.permissions);
          }
        }
      }

      // Get project-level permissions
      if (context.projectId) {
        const projectMember = await this.getProjectMember(
          userId,
          context.projectId
        );
        if (projectMember) {
          projectPermissions.push(
            ...this.getProjectRolePermissions(projectMember.role)
          );
        }
      }

      // Get task-level permissions (implicit permissions based on task relationship)
      if (context.taskId) {
        const taskPermissions = await this.getTaskSpecificPermissions(
          userId,
          context.taskId
        );
        taskPermissions.push(...taskPermissions);
      }

      // Combine all permissions (workspace permissions apply everywhere)
      const effectivePermissions = [
        ...new Set([
          ...workspacePermissions,
          ...projectPermissions,
          ...taskPermissions,
        ]),
      ];

      return {
        workspacePermissions,
        projectPermissions,
        taskPermissions,
        effectivePermissions,
      };
    } catch (error) {
      return {
        workspacePermissions: [],
        projectPermissions: [],
        taskPermissions: [],
        effectivePermissions: [],
      };
    }
  }

  /**
   * Check for resource-specific permissions (e.g., task creator can edit their task)
   */
  private async checkResourceSpecificPermission(
    context: PermissionEvaluationContext
  ): Promise<PermissionResult> {
    // Task creator permissions
    if (context.resource === 'task' && context.context.resourceOwnerId) {
      if (context.userId.equals(context.context.resourceOwnerId)) {
        const creatorPermissions = [
          Permission.TASK_VIEW,
          Permission.TASK_EDIT,
          Permission.TASK_COMMENT,
          Permission.TASK_ATTACH_FILES,
        ];

        if (creatorPermissions.includes(context.permission)) {
          return {
            granted: true,
            reason: 'Task creator permissions',
            conditions: { isCreator: true },
          };
        }
      }
    }

    // Task assignee permissions
    if (context.resource === 'task') {
      const task = await this.taskRepository.findById(context.resourceId);
      if (task && task.assigneeId && context.userId.equals(task.assigneeId)) {
        const assigneePermissions = [
          Permission.TASK_VIEW,
          Permission.TASK_EDIT,
          Permission.TASK_COMMENT,
        ];

        if (assigneePermissions.includes(context.permission)) {
          return {
            granted: true,
            reason: 'Task assignee permissions',
            conditions: { isAssignee: true },
          };
        }
      }
    }

    return {
      granted: false,
      reason: 'No resource-specific permissions',
    };
  }

  /**
   * Batch permission check for multiple permissions
   */
  async checkMultiplePermissions(
    userId: UserId,
    permissions: Array<{
      permission: string;
      resource: string;
      resourceId?: string;
      context: PermissionContext;
    }>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const permissionCheck of permissions) {
      const key = `${permissionCheck.resource}:${permissionCheck.resourceId}:${permissionCheck.permission}`;

      const result = await this.evaluatePermission({
        userId,
        permission: permissionCheck.permission,
        resource: permissionCheck.resource,
        resourceId: permissionCheck.resourceId,
        context: permissionCheck.context,
      });

      results[key] = result.granted;
    }

    return results;
  }

  /**
   * Get all effective permissions for a user in a context
   */
  async getUserEffectivePermissions(
    userId: UserId,
    context: PermissionContext
  ): Promise<string[]> {
    const hierarchicalPermissions = await this.getHierarchicalPermissions(
      userId,
      context
    );

    return hierarchicalPermissions.effectivePermissions;
  }

  // Private helper methods

  private async getWorkspaceMember(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<any> {
    // TODO: Implement workspace member retrieval
    return null;
  }

  private async getProjectMember(
    userId: UserId,
    projectId: string
  ): Promise<any> {
    // TODO: Implement project member retrieval
    return null;
  }

  private getProjectRolePermissions(role: string): string[] {
    // TODO: Implement project role permission mapping
    return [];
  }

  private async getTaskSpecificPermissions(
    userId: UserId,
    taskId: string
  ): Promise<string[]> {
    // TODO: Implement task-specific permission retrieval
    return [];
  }
}
