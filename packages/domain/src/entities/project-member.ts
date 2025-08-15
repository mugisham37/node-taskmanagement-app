import { ProjectId } from '../value-objects/project-id';
import { UserId } from '../value-objects/user-id';

export enum ProjectRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export interface ProjectMemberProps {
  id: string;
  projectId: ProjectId;
  userId: UserId;
  role: ProjectRole;
  joinedAt: Date;
  permissions: string[];
  lastActiveAt?: Date;
}

export class ProjectMember {
  private readonly props: ProjectMemberProps;

  constructor(props: ProjectMemberProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): ProjectId {
    return this.props.projectId;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get role(): ProjectRole {
    return this.props.role;
  }

  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  get permissions(): string[] {
    return [...this.props.permissions];
  }

  get lastActiveAt(): Date | undefined {
    return this.props.lastActiveAt;
  }

  updateRole(newRole: ProjectRole): void {
    if (newRole === this.props.role) {
      return;
    }
    
    this.props.role = newRole;
    this.updateLastActiveAt();
  }

  updatePermissions(permissions: string[]): void {
    this.props.permissions = [...permissions];
    this.updateLastActiveAt();
  }

  private updateLastActiveAt(): void {
    this.props.lastActiveAt = new Date();
  }

  isOwner(): boolean {
    return this.props.role === ProjectRole.OWNER;
  }

  isAdmin(): boolean {
    return this.props.role === ProjectRole.ADMIN || this.props.role === ProjectRole.OWNER;
  }

  hasPermission(permission: string): boolean {
    return this.props.permissions.includes(permission);
  }

  static create(
    projectId: ProjectId,
    userId: UserId,
    role: ProjectRole = ProjectRole.MEMBER,
    permissions: string[] = []
  ): ProjectMember {
    return new ProjectMember({
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      userId,
      role,
      joinedAt: new Date(),
      permissions,
      lastActiveAt: new Date()
    });
  }
}
