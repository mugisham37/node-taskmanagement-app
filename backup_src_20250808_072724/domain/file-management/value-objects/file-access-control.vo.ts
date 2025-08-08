import { ValueObject } from '../../shared/base/value-object';

export interface FilePermission {
  userId: string;
  permissions: string[]; // 'read', 'write', 'delete', 'share'
}

export interface FileAccessControlProps {
  isPublic: boolean;
  workspaceLevel: boolean; // If true, all workspace members can access
  projectLevel: boolean; // If true, all project members can access
  specificUsers: FilePermission[];
  inheritFromParent: boolean; // Inherit permissions from task/project/comment
  parentType?: 'task' | 'project' | 'comment';
  parentId?: string;
}

export class FileAccessControl extends ValueObject<FileAccessControlProps> {
  constructor(props: FileAccessControlProps) {
    super(props);
  }

  get isPublic(): boolean {
    return this.props.isPublic;
  }

  get workspaceLevel(): boolean {
    return this.props.workspaceLevel;
  }

  get projectLevel(): boolean {
    return this.props.projectLevel;
  }

  get specificUsers(): FilePermission[] {
    return this.props.specificUsers;
  }

  get inheritFromParent(): boolean {
    return this.props.inheritFromParent;
  }

  get parentType(): 'task' | 'project' | 'comment' | undefined {
    return this.props.parentType;
  }

  get parentId(): string | undefined {
    return this.props.parentId;
  }

  // Business methods
  hasPermission(userId: string, permission: string): boolean {
    // Public files are readable by anyone
    if (this.isPublic && permission === 'read') {
      return true;
    }

    // Check specific user permissions
    const userPermission = this.specificUsers.find(p => p.userId === userId);
    if (userPermission && userPermission.permissions.includes(permission)) {
      return true;
    }

    // If workspace level access is enabled, assume user has basic permissions
    // (This would need to be validated against actual workspace membership)
    if (this.workspaceLevel && ['read', 'write'].includes(permission)) {
      return true;
    }

    // If project level access is enabled, assume user has basic permissions
    // (This would need to be validated against actual project membership)
    if (this.projectLevel && ['read', 'write'].includes(permission)) {
      return true;
    }

    return false;
  }

  addUserPermission(userId: string, permissions: string[]): FileAccessControl {
    const existingIndex = this.specificUsers.findIndex(
      p => p.userId === userId
    );
    let newSpecificUsers: FilePermission[];

    if (existingIndex >= 0) {
      // Update existing user permissions
      newSpecificUsers = [...this.specificUsers];
      newSpecificUsers[existingIndex] = {
        userId,
        permissions: [
          ...new Set([
            ...newSpecificUsers[existingIndex].permissions,
            ...permissions,
          ]),
        ],
      };
    } else {
      // Add new user permission
      newSpecificUsers = [...this.specificUsers, { userId, permissions }];
    }

    return new FileAccessControl({
      ...this.props,
      specificUsers: newSpecificUsers,
    });
  }

  removeUserPermission(
    userId: string,
    permissions?: string[]
  ): FileAccessControl {
    if (!permissions) {
      // Remove user entirely
      return new FileAccessControl({
        ...this.props,
        specificUsers: this.specificUsers.filter(p => p.userId !== userId),
      });
    }

    // Remove specific permissions
    const newSpecificUsers = this.specificUsers
      .map(p => {
        if (p.userId === userId) {
          return {
            userId,
            permissions: p.permissions.filter(
              perm => !permissions.includes(perm)
            ),
          };
        }
        return p;
      })
      .filter(p => p.permissions.length > 0);

    return new FileAccessControl({
      ...this.props,
      specificUsers: newSpecificUsers,
    });
  }

  makePublic(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      isPublic: true,
    });
  }

  makePrivate(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      isPublic: false,
    });
  }

  enableWorkspaceAccess(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      workspaceLevel: true,
    });
  }

  disableWorkspaceAccess(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      workspaceLevel: false,
    });
  }

  enableProjectAccess(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      projectLevel: true,
    });
  }

  disableProjectAccess(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      projectLevel: false,
    });
  }

  setParentInheritance(
    parentType: 'task' | 'project' | 'comment',
    parentId: string
  ): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      inheritFromParent: true,
      parentType,
      parentId,
    });
  }

  disableParentInheritance(): FileAccessControl {
    return new FileAccessControl({
      ...this.props,
      inheritFromParent: false,
      parentType: undefined,
      parentId: undefined,
    });
  }

  getUserPermissions(userId: string): string[] {
    const userPermission = this.specificUsers.find(p => p.userId === userId);
    return userPermission ? userPermission.permissions : [];
  }

  getAllUserIds(): string[] {
    return this.specificUsers.map(p => p.userId);
  }

  equals(other: FileAccessControl): boolean {
    return this.deepEquals(other);
  }

  toPlainObject(): Record<string, any> {
    return {
      isPublic: this.isPublic,
      workspaceLevel: this.workspaceLevel,
      projectLevel: this.projectLevel,
      specificUsers: this.specificUsers,
      inheritFromParent: this.inheritFromParent,
      parentType: this.parentType,
      parentId: this.parentId,
    };
  }
}
