import {
  EntitySearchAdapter,
  IndexableEntity,
} from '../../../domain/search/services/cross-entity-search.service';
import { PrismaClient } from '@prisma/client';

interface TaskEntity {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  creatorId: string;
  projectId: string | null;
  tags: string[];
  dueDate: Date | null;
  estimatedHours: number | null;
  actualHours: number | null;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    name: string;
  } | null;
  assignee?: {
    name: string | null;
    email: string;
  } | null;
  creator?: {
    name: string | null;
    email: string;
  };
}

class TaskIndexableEntity implements IndexableEntity {
  constructor(private readonly task: TaskEntity) {}

  get id(): string {
    return this.task.id;
  }

  getSearchableContent(): {
    title: string;
    content: string;
    metadata: Record<string, any>;
    tags: string[];
    permissions: string[];
  } {
    const content = [
      this.task.description || '',
      this.task.project?.name || '',
      this.task.assignee?.name || '',
      this.task.assignee?.email || '',
      this.task.creator?.name || '',
      this.task.creator?.email || '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      title: this.task.title,
      content,
      metadata: {
        status: this.task.status,
        priority: this.task.priority,
        assigneeId: this.task.assigneeId,
        creatorId: this.task.creatorId,
        projectId: this.task.projectId,
        dueDate: this.task.dueDate?.toISOString(),
        estimatedHours: this.task.estimatedHours,
        actualHours: this.task.actualHours,
        projectName: this.task.project?.name,
        assigneeName: this.task.assignee?.name,
        assigneeEmail: this.task.assignee?.email,
        creatorName: this.task.creator?.name,
        creatorEmail: this.task.creator?.email,
      },
      tags: this.task.tags,
      permissions: this.generatePermissions(),
    };
  }

  getEntityType(): string {
    return 'task';
  }

  getWorkspaceId(): string {
    return this.task.workspaceId;
  }

  private generatePermissions(): string[] {
    const permissions: string[] = [];

    // Workspace-level permission
    permissions.push(`workspace:${this.task.workspaceId}`);

    // Project-level permission
    if (this.task.projectId) {
      permissions.push(`project:${this.task.projectId}`);
    }

    // Assignee permission
    if (this.task.assigneeId) {
      permissions.push(`user:${this.task.assigneeId}`);
    }

    // Creator permission
    permissions.push(`user:${this.task.creatorId}`);

    return permissions;
  }
}

export class TaskSearchAdapter implements EntitySearchAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  getEntityType(): string {
    return 'task';
  }

  async findById(id: string): Promise<IndexableEntity | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { name: true },
        },
        assignee: {
          select: { name: true, email: true },
        },
        creator: {
          select: { name: true, email: true },
        },
      },
    });

    return task ? new TaskIndexableEntity(task) : null;
  }

  async findByIds(ids: string[]): Promise<IndexableEntity[]> {
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: ids } },
      include: {
        project: {
          select: { name: true },
        },
        assignee: {
          select: { name: true, email: true },
        },
        creator: {
          select: { name: true, email: true },
        },
      },
    });

    return tasks.map(task => new TaskIndexableEntity(task));
  }

  async findByWorkspace(
    workspaceId: string,
    limit = 1000,
    offset = 0
  ): Promise<IndexableEntity[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        project: {
          select: { name: true },
        },
        assignee: {
          select: { name: true, email: true },
        },
        creator: {
          select: { name: true, email: true },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' },
    });

    return tasks.map(task => new TaskIndexableEntity(task));
  }

  getSearchableFields(): string[] {
    return [
      'title',
      'description',
      'status',
      'priority',
      'assigneeId',
      'creatorId',
      'projectId',
      'tags',
      'dueDate',
      'estimatedHours',
      'actualHours',
      'createdAt',
      'updatedAt',
    ];
  }

  async getPermissionContext(
    entity: IndexableEntity,
    userId: string
  ): Promise<string[]> {
    const task = await this.prisma.task.findUnique({
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
        project: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task) return [];

    const permissions: string[] = [];

    // Check workspace membership
    const workspaceMember = task.workspace.members[0];
    if (workspaceMember) {
      permissions.push(`workspace:${task.workspaceId}`);

      // Add role-based permissions
      workspaceMember.role.permissions.forEach(permission => {
        permissions.push(`role:${permission}`);
      });
    }

    // Check project membership
    const projectMember = task.project?.members[0];
    if (projectMember) {
      permissions.push(`project:${task.projectId}`);
    }

    // Check if user is assignee or creator
    if (task.assigneeId === userId || task.creatorId === userId) {
      permissions.push(`user:${userId}`);
    }

    return permissions;
  }
}
