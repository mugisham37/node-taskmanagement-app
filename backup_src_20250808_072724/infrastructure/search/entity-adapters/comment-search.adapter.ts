import {
  EntitySearchAdapter,
  IndexableEntity,
} from '../../../domain/search/services/cross-entity-search.service';
import { PrismaClient } from '@prisma/client';

interface CommentEntity {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  task?: {
    workspaceId: string;
    title: string;
    projectId: string | null;
  };
  author?: {
    name: string | null;
    email: string;
  };
}

class CommentIndexableEntity implements IndexableEntity {
  constructor(private readonly comment: CommentEntity) {}

  get id(): string {
    return this.comment.id;
  }

  getSearchableContent(): {
    title: string;
    content: string;
    metadata: Record<string, any>;
    tags: string[];
    permissions: string[];
  } {
    const title = `Comment on: ${this.comment.task?.title || 'Task'}`;

    const content = [
      this.comment.content,
      this.comment.author?.name || '',
      this.comment.author?.email || '',
      this.comment.task?.title || '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      title,
      content,
      metadata: {
        taskId: this.comment.taskId,
        authorId: this.comment.authorId,
        projectId: this.comment.task?.projectId,
        taskTitle: this.comment.task?.title,
        authorName: this.comment.author?.name,
        authorEmail: this.comment.author?.email,
      },
      tags: [], // Comments don't have tags in the current schema
      permissions: this.generatePermissions(),
    };
  }

  getEntityType(): string {
    return 'comment';
  }

  getWorkspaceId(): string {
    return this.comment.task?.workspaceId || '';
  }

  private generatePermissions(): string[] {
    const permissions: string[] = [];

    // Workspace-level permission
    if (this.comment.task?.workspaceId) {
      permissions.push(`workspace:${this.comment.task.workspaceId}`);
    }

    // Project-level permission
    if (this.comment.task?.projectId) {
      permissions.push(`project:${this.comment.task.projectId}`);
    }

    // Task-level permission
    permissions.push(`task:${this.comment.taskId}`);

    // Author permission
    permissions.push(`user:${this.comment.authorId}`);

    return permissions;
  }
}

export class CommentSearchAdapter implements EntitySearchAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  getEntityType(): string {
    return 'comment';
  }

  async findById(id: string): Promise<IndexableEntity | null> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            workspaceId: true,
            title: true,
            projectId: true,
          },
        },
        author: {
          select: { name: true, email: true },
        },
      },
    });

    return comment ? new CommentIndexableEntity(comment) : null;
  }

  async findByIds(ids: string[]): Promise<IndexableEntity[]> {
    const comments = await this.prisma.comment.findMany({
      where: { id: { in: ids } },
      include: {
        task: {
          select: {
            workspaceId: true,
            title: true,
            projectId: true,
          },
        },
        author: {
          select: { name: true, email: true },
        },
      },
    });

    return comments.map(comment => new CommentIndexableEntity(comment));
  }

  async findByWorkspace(
    workspaceId: string,
    limit = 1000,
    offset = 0
  ): Promise<IndexableEntity[]> {
    const comments = await this.prisma.comment.findMany({
      where: {
        task: {
          workspaceId,
          deletedAt: null,
        },
      },
      include: {
        task: {
          select: {
            workspaceId: true,
            title: true,
            projectId: true,
          },
        },
        author: {
          select: { name: true, email: true },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' },
    });

    return comments.map(comment => new CommentIndexableEntity(comment));
  }

  getSearchableFields(): string[] {
    return ['content', 'taskId', 'authorId', 'createdAt', 'updatedAt'];
  }

  async getPermissionContext(
    entity: IndexableEntity,
    userId: string
  ): Promise<string[]> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: entity.id },
      include: {
        task: {
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
        },
      },
    });

    if (!comment) return [];

    const permissions: string[] = [];

    // Check workspace membership
    const workspaceMember = comment.task.workspace.members[0];
    if (workspaceMember) {
      permissions.push(`workspace:${comment.task.workspaceId}`);

      // Add role-based permissions
      workspaceMember.role.permissions.forEach(permission => {
        permissions.push(`role:${permission}`);
      });
    }

    // Check project membership
    const projectMember = comment.task.project?.members[0];
    if (projectMember) {
      permissions.push(`project:${comment.task.projectId}`);
    }

    // Check if user is comment author or task assignee/creator
    if (
      comment.authorId === userId ||
      comment.task.assigneeId === userId ||
      comment.task.creatorId === userId
    ) {
      permissions.push(`user:${userId}`);
    }

    return permissions;
  }
}
