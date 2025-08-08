/**
 * Permission system for hierarchical access control
 * Supports workspace, project, and task-level permissions
 */
export class Permission {
  // Workspace-level permissions
  public static readonly WORKSPACE_VIEW = 'workspace:view';
  public static readonly WORKSPACE_EDIT = 'workspace:edit';
  public static readonly WORKSPACE_DELETE = 'workspace:delete';
  public static readonly WORKSPACE_MANAGE_MEMBERS = 'workspace:manage_members';
  public static readonly WORKSPACE_MANAGE_ROLES = 'workspace:manage_roles';
  public static readonly WORKSPACE_MANAGE_SETTINGS =
    'workspace:manage_settings';
  public static readonly WORKSPACE_MANAGE_BILLING = 'workspace:manage_billing';

  // Project-level permissions
  public static readonly PROJECT_VIEW = 'project:view';
  public static readonly PROJECT_CREATE = 'project:create';
  public static readonly PROJECT_EDIT = 'project:edit';
  public static readonly PROJECT_DELETE = 'project:delete';
  public static readonly PROJECT_ARCHIVE = 'project:archive';
  public static readonly PROJECT_MANAGE_MEMBERS = 'project:manage_members';
  public static readonly PROJECT_MANAGE_SETTINGS = 'project:manage_settings';

  // Task-level permissions
  public static readonly TASK_VIEW = 'task:view';
  public static readonly TASK_CREATE = 'task:create';
  public static readonly TASK_EDIT = 'task:edit';
  public static readonly TASK_DELETE = 'task:delete';
  public static readonly TASK_ASSIGN = 'task:assign';
  public static readonly TASK_COMMENT = 'task:comment';
  public static readonly TASK_ATTACH_FILES = 'task:attach_files';
  public static readonly TASK_MANAGE_DEPENDENCIES = 'task:manage_dependencies';

  // Team-level permissions
  public static readonly TEAM_VIEW = 'team:view';
  public static readonly TEAM_CREATE = 'team:create';
  public static readonly TEAM_EDIT = 'team:edit';
  public static readonly TEAM_DELETE = 'team:delete';
  public static readonly TEAM_MANAGE_MEMBERS = 'team:manage_members';

  // Comment and collaboration permissions
  public static readonly COMMENT_VIEW = 'comment:view';
  public static readonly COMMENT_CREATE = 'comment:create';
  public static readonly COMMENT_EDIT = 'comment:edit';
  public static readonly COMMENT_DELETE = 'comment:delete';

  // File management permissions
  public static readonly FILE_VIEW = 'file:view';
  public static readonly FILE_UPLOAD = 'file:upload';
  public static readonly FILE_DELETE = 'file:delete';
  public static readonly FILE_SHARE = 'file:share';

  // Analytics and reporting permissions
  public static readonly ANALYTICS_VIEW = 'analytics:view';
  public static readonly ANALYTICS_EXPORT = 'analytics:export';
  public static readonly REPORTS_VIEW = 'reports:view';
  public static readonly REPORTS_CREATE = 'reports:create';

  // Calendar permissions
  public static readonly CALENDAR_VIEW = 'calendar:view';
  public static readonly CALENDAR_EDIT = 'calendar:edit';
  public static readonly CALENDAR_MANAGE_INTEGRATIONS =
    'calendar:manage_integrations';

  // Notification permissions
  public static readonly NOTIFICATION_MANAGE = 'notification:manage';

  // Audit and security permissions
  public static readonly AUDIT_VIEW = 'audit:view';
  public static readonly SECURITY_MANAGE = 'security:manage';

  // System administration permissions
  public static readonly SYSTEM_ADMIN = 'system:admin';

  /**
   * Get all available permissions
   */
  public static getAllPermissions(): string[] {
    return [
      // Workspace permissions
      this.WORKSPACE_VIEW,
      this.WORKSPACE_EDIT,
      this.WORKSPACE_DELETE,
      this.WORKSPACE_MANAGE_MEMBERS,
      this.WORKSPACE_MANAGE_ROLES,
      this.WORKSPACE_MANAGE_SETTINGS,
      this.WORKSPACE_MANAGE_BILLING,

      // Project permissions
      this.PROJECT_VIEW,
      this.PROJECT_CREATE,
      this.PROJECT_EDIT,
      this.PROJECT_DELETE,
      this.PROJECT_ARCHIVE,
      this.PROJECT_MANAGE_MEMBERS,
      this.PROJECT_MANAGE_SETTINGS,

      // Task permissions
      this.TASK_VIEW,
      this.TASK_CREATE,
      this.TASK_EDIT,
      this.TASK_DELETE,
      this.TASK_ASSIGN,
      this.TASK_COMMENT,
      this.TASK_ATTACH_FILES,
      this.TASK_MANAGE_DEPENDENCIES,

      // Team permissions
      this.TEAM_VIEW,
      this.TEAM_CREATE,
      this.TEAM_EDIT,
      this.TEAM_DELETE,
      this.TEAM_MANAGE_MEMBERS,

      // Comment permissions
      this.COMMENT_VIEW,
      this.COMMENT_CREATE,
      this.COMMENT_EDIT,
      this.COMMENT_DELETE,

      // File permissions
      this.FILE_VIEW,
      this.FILE_UPLOAD,
      this.FILE_DELETE,
      this.FILE_SHARE,

      // Analytics permissions
      this.ANALYTICS_VIEW,
      this.ANALYTICS_EXPORT,
      this.REPORTS_VIEW,
      this.REPORTS_CREATE,

      // Calendar permissions
      this.CALENDAR_VIEW,
      this.CALENDAR_EDIT,
      this.CALENDAR_MANAGE_INTEGRATIONS,

      // Notification permissions
      this.NOTIFICATION_MANAGE,

      // Audit permissions
      this.AUDIT_VIEW,
      this.SECURITY_MANAGE,

      // System permissions
      this.SYSTEM_ADMIN,
    ];
  }

  /**
   * Get permissions for Owner role (all permissions)
   */
  public static getOwnerPermissions(): string[] {
    return this.getAllPermissions();
  }

  /**
   * Get permissions for Admin role
   */
  public static getAdminPermissions(): string[] {
    return [
      // Workspace permissions (excluding billing and deletion)
      this.WORKSPACE_VIEW,
      this.WORKSPACE_EDIT,
      this.WORKSPACE_MANAGE_MEMBERS,
      this.WORKSPACE_MANAGE_ROLES,
      this.WORKSPACE_MANAGE_SETTINGS,

      // All project permissions
      this.PROJECT_VIEW,
      this.PROJECT_CREATE,
      this.PROJECT_EDIT,
      this.PROJECT_DELETE,
      this.PROJECT_ARCHIVE,
      this.PROJECT_MANAGE_MEMBERS,
      this.PROJECT_MANAGE_SETTINGS,

      // All task permissions
      this.TASK_VIEW,
      this.TASK_CREATE,
      this.TASK_EDIT,
      this.TASK_DELETE,
      this.TASK_ASSIGN,
      this.TASK_COMMENT,
      this.TASK_ATTACH_FILES,
      this.TASK_MANAGE_DEPENDENCIES,

      // All team permissions
      this.TEAM_VIEW,
      this.TEAM_CREATE,
      this.TEAM_EDIT,
      this.TEAM_DELETE,
      this.TEAM_MANAGE_MEMBERS,

      // All comment permissions
      this.COMMENT_VIEW,
      this.COMMENT_CREATE,
      this.COMMENT_EDIT,
      this.COMMENT_DELETE,

      // All file permissions
      this.FILE_VIEW,
      this.FILE_UPLOAD,
      this.FILE_DELETE,
      this.FILE_SHARE,

      // Analytics permissions
      this.ANALYTICS_VIEW,
      this.ANALYTICS_EXPORT,
      this.REPORTS_VIEW,
      this.REPORTS_CREATE,

      // Calendar permissions
      this.CALENDAR_VIEW,
      this.CALENDAR_EDIT,
      this.CALENDAR_MANAGE_INTEGRATIONS,

      // Notification permissions
      this.NOTIFICATION_MANAGE,

      // Audit permissions
      this.AUDIT_VIEW,
      this.SECURITY_MANAGE,
    ];
  }

  /**
   * Get permissions for Member role
   */
  public static getMemberPermissions(): string[] {
    return [
      // Basic workspace permissions
      this.WORKSPACE_VIEW,

      // Project permissions (no deletion or member management)
      this.PROJECT_VIEW,
      this.PROJECT_CREATE,
      this.PROJECT_EDIT,

      // Task permissions (full access)
      this.TASK_VIEW,
      this.TASK_CREATE,
      this.TASK_EDIT,
      this.TASK_ASSIGN,
      this.TASK_COMMENT,
      this.TASK_ATTACH_FILES,
      this.TASK_MANAGE_DEPENDENCIES,

      // Team permissions (no management)
      this.TEAM_VIEW,

      // Comment permissions (full access)
      this.COMMENT_VIEW,
      this.COMMENT_CREATE,
      this.COMMENT_EDIT,

      // File permissions (no deletion)
      this.FILE_VIEW,
      this.FILE_UPLOAD,
      this.FILE_SHARE,

      // Basic analytics permissions
      this.ANALYTICS_VIEW,
      this.REPORTS_VIEW,

      // Calendar permissions
      this.CALENDAR_VIEW,
      this.CALENDAR_EDIT,
    ];
  }

  /**
   * Get permissions for Viewer role
   */
  public static getViewerPermissions(): string[] {
    return [
      // Basic workspace permissions
      this.WORKSPACE_VIEW,

      // View-only project permissions
      this.PROJECT_VIEW,

      // View-only task permissions
      this.TASK_VIEW,
      this.TASK_COMMENT,

      // View-only team permissions
      this.TEAM_VIEW,

      // Comment permissions (view and create only)
      this.COMMENT_VIEW,
      this.COMMENT_CREATE,

      // View-only file permissions
      this.FILE_VIEW,

      // View-only analytics permissions
      this.ANALYTICS_VIEW,
      this.REPORTS_VIEW,

      // View-only calendar permissions
      this.CALENDAR_VIEW,
    ];
  }

  /**
   * Check if a permission is valid
   */
  public static isValidPermission(permission: string): boolean {
    return this.getAllPermissions().includes(permission);
  }

  /**
   * Get permissions by category
   */
  public static getPermissionsByCategory(): Record<string, string[]> {
    return {
      workspace: [
        this.WORKSPACE_VIEW,
        this.WORKSPACE_EDIT,
        this.WORKSPACE_DELETE,
        this.WORKSPACE_MANAGE_MEMBERS,
        this.WORKSPACE_MANAGE_ROLES,
        this.WORKSPACE_MANAGE_SETTINGS,
        this.WORKSPACE_MANAGE_BILLING,
      ],
      project: [
        this.PROJECT_VIEW,
        this.PROJECT_CREATE,
        this.PROJECT_EDIT,
        this.PROJECT_DELETE,
        this.PROJECT_ARCHIVE,
        this.PROJECT_MANAGE_MEMBERS,
        this.PROJECT_MANAGE_SETTINGS,
      ],
      task: [
        this.TASK_VIEW,
        this.TASK_CREATE,
        this.TASK_EDIT,
        this.TASK_DELETE,
        this.TASK_ASSIGN,
        this.TASK_COMMENT,
        this.TASK_ATTACH_FILES,
        this.TASK_MANAGE_DEPENDENCIES,
      ],
      team: [
        this.TEAM_VIEW,
        this.TEAM_CREATE,
        this.TEAM_EDIT,
        this.TEAM_DELETE,
        this.TEAM_MANAGE_MEMBERS,
      ],
      comment: [
        this.COMMENT_VIEW,
        this.COMMENT_CREATE,
        this.COMMENT_EDIT,
        this.COMMENT_DELETE,
      ],
      file: [
        this.FILE_VIEW,
        this.FILE_UPLOAD,
        this.FILE_DELETE,
        this.FILE_SHARE,
      ],
      analytics: [
        this.ANALYTICS_VIEW,
        this.ANALYTICS_EXPORT,
        this.REPORTS_VIEW,
        this.REPORTS_CREATE,
      ],
      calendar: [
        this.CALENDAR_VIEW,
        this.CALENDAR_EDIT,
        this.CALENDAR_MANAGE_INTEGRATIONS,
      ],
      notification: [this.NOTIFICATION_MANAGE],
      audit: [this.AUDIT_VIEW, this.SECURITY_MANAGE],
      system: [this.SYSTEM_ADMIN],
    };
  }

  /**
   * Check if a permission implies another permission (hierarchical permissions)
   */
  public static implies(
    permission: string,
    impliedPermission: string
  ): boolean {
    // System admin implies all permissions
    if (permission === this.SYSTEM_ADMIN) {
      return true;
    }

    // Workspace management permissions imply view
    if (
      impliedPermission === this.WORKSPACE_VIEW &&
      [
        this.WORKSPACE_EDIT,
        this.WORKSPACE_DELETE,
        this.WORKSPACE_MANAGE_MEMBERS,
        this.WORKSPACE_MANAGE_ROLES,
        this.WORKSPACE_MANAGE_SETTINGS,
        this.WORKSPACE_MANAGE_BILLING,
      ].includes(permission)
    ) {
      return true;
    }

    // Project management permissions imply view
    if (
      impliedPermission === this.PROJECT_VIEW &&
      [
        this.PROJECT_EDIT,
        this.PROJECT_DELETE,
        this.PROJECT_ARCHIVE,
        this.PROJECT_MANAGE_MEMBERS,
        this.PROJECT_MANAGE_SETTINGS,
      ].includes(permission)
    ) {
      return true;
    }

    // Task management permissions imply view
    if (
      impliedPermission === this.TASK_VIEW &&
      [
        this.TASK_EDIT,
        this.TASK_DELETE,
        this.TASK_ASSIGN,
        this.TASK_COMMENT,
        this.TASK_ATTACH_FILES,
        this.TASK_MANAGE_DEPENDENCIES,
      ].includes(permission)
    ) {
      return true;
    }

    // Team management permissions imply view
    if (
      impliedPermission === this.TEAM_VIEW &&
      [this.TEAM_EDIT, this.TEAM_DELETE, this.TEAM_MANAGE_MEMBERS].includes(
        permission
      )
    ) {
      return true;
    }

    // Comment management permissions imply view
    if (
      impliedPermission === this.COMMENT_VIEW &&
      [this.COMMENT_EDIT, this.COMMENT_DELETE].includes(permission)
    ) {
      return true;
    }

    // File management permissions imply view
    if (
      impliedPermission === this.FILE_VIEW &&
      [this.FILE_DELETE, this.FILE_SHARE].includes(permission)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get the resource type from a permission string
   */
  public static getResourceType(permission: string): string | null {
    const parts = permission.split(':');
    return parts.length >= 2 ? parts[0] : null;
  }

  /**
   * Get the action from a permission string
   */
  public static getAction(permission: string): string | null {
    const parts = permission.split(':');
    return parts.length >= 2 ? parts[1] : null;
  }
}
