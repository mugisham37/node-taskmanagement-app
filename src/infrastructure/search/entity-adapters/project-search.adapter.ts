import {
  EntitySearchAdapter,
  IndexableEntity,
} from '../../../domain/search/services/cross-entity-search.service';
import { PrismaClient } from '@prisma/client';

interface ProjectEntity {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  ownerId: string;
  startDate: Date | null;
  endDate: Date | null;
  budgetAmount: number | null;
  budgetCurrency: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner?: {
    name: string | null;
    email: string;
  };
  members?: Array<{
    user: {
      name: string | null;
      email: string;
    };
    role: string;
  }>;
  _count?: {
    tasks: number;
  };
}

class ProjectIndexableEntity implements IndexableEntity {
  constructor(private readonly project: ProjectEntity) {}

  get id(): string {
    return this.project.id;
  }

  getSearchableContent(): {
    title: string;
    content: string;
    metadata: Record<string, any>;
    tags: string[];
    permissions: string[];
  } {
    const memberNames =
      this.project.members?.map(m => m.user.name).filter(Boolean) || [];
    const memberEmails = this.project.members?.map(m => m.user.email) || [];

    const content = [
      this.project.description || '',
      this.project.owner?.name || '',
      this.project.owner?.email || '',
      ...memberNames,
      ...memberEmails,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      title: this.project.name,
      content,
      metadata: {
        status: this.project.status,
        priority: this.project.priority,
        ownerId: this.project.ownerId,
        startDate: this.project.startDate?.toISOString(),
        endDate: this.project.endDate?.toISOString(),
        budgetAmount: this.project.budgetAmount,
        budgetCurrency: this.project.budgetCurrency,
        isArchived: this.project.isArchived,
        ownerName: this.project.owner?.name,
        ownerEmail: this.project.owner?.email,
        memberCount: this.project.members?.length || 0,
        taskCount: this.project._count?.tasks || 0,
      },
      tags: [], // Projects don't have tags in the current schema
      permissions: this.generatePermissions(),
    };
  }

  getEntityType(): string {
    return 'project';
  }

  getWorkspaceId(): string {
    return this.project.workspaceId;
  }

  private generatePermissions(): string[] {
    const permissions: string[] = [];

    // Workspace-level permission
    permissions.push(`workspace:${this.project.workspaceId}`);

    // Project-level permission
    permissions.push(`project:${this.project.id}`);

    // Owner permission
    permissions.push(`user:${this.project.ownerId}`);

    // Member permissions
    this.project.members?.forEach(member => {
      permissions.push(`user:${member.user.email}`); // Using email as identifier
    });

    return permissions;
  }
}

export class ProjectSearchAdapter implements EntitySearchAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  getEntityType(): string {
    return 'project';
  }

  async findById(id: string): Promise<IndexableEntity | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    return project ? new ProjectIndexableEntity(project) : null;
  }

  async findByIds(ids: string[]): Promise<IndexableEntity[]> {
    const projects = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      include: {
        owner: {
          select: { name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    return projects.map(project => new ProjectIndexableEntity(project));
  }

  async findByWorkspace(
    workspaceId: string,
    limit = 1000,
    offset = 0
  ): Promise<IndexableEntity[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        owner: {
          select: { name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
        _count: {
          select: { tasks: true },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map(project => new ProjectIndexableEntity(project));
  }

  getSearchableFields(): string[] {
    return [
      'name',
      'description',
      'status',
      'priority',
      'ownerId',
      'startDate',
      'endDate',
      'budgetAmount',
      'budgetCurrency',
      'isArchived',
      'createdAt',
      'updatedAt',
    ];
  }

  async getPermissionContext(
    entity: IndexableEntity,
    userId: string
  ): Promise<string[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: entity.id },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
              include: { role: true },
            },
          },
        },
        members: {
          where: { userId },
        },
      },
    });

    if (!project) return [];

    const permissions: string[] = [];

    // Check workspace membership
    const workspaceMember = project.workspace.members[0];
    if (workspaceMember) {
      permissions.push(`workspace:${project.workspaceId}`);

      // Add role-based permissions
      workspaceMember.role.permissions.forEach(permission => {
        permissions.push(`role:${permission}`);
      });
    }

    // Check project membership
    const projectMember = project.members[0];
    if (projectMember) {
      permissions.push(`project:${project.id}`);
    }

    // Check if user is owner
    if (project.ownerId === userId) {
      permissions.push(`user:${userId}`);
    }

    return permissions;
  }
}
