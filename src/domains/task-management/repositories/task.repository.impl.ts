import { PrismaClient, Prisma, Task as PrismaTask } from '@prisma/client';
import { BasePrismaRepository } from '../database/base-repository';
import { ITaskRepository } from './ITaskRepository';
import { Task } from '../entities/Task';
import { TaskId } from '../value-objects/TaskId';
import { ProjectId } from '../../domain/task-management/value-objects/ProjectId';
import { WorkspaceId } from '../../domain/task-management/value-objects/WorkspaceId';
import { UserId } from '../../domain/authentication/value-objects/UserId';
import { TaskStatus } from '../../domain/task-management/value-objects/TaskStatus';
import { Priority } from '../../domain/task-management/value-objects/Priority';
import { ISpecification } from '../../../shared/domain/repositories/IRepository';

type PrismaTaskWithRelations = PrismaTask & {
  assignee?: any;
  creator?: any;
  reporter?: any;
  project?: any;
  workspace?: any;
  subtasks?: any[];
  parentTask?: any;
  dependencies?: any[];
  dependents?: any[];
};

export class PrismaTaskRepository
  extends BasePrismaRepository<Task, TaskId, PrismaTaskWithRelations, any>
  implements ITaskRepository
{
  constructor(client?: PrismaClient) {
    super('Task', client);
  }

  protected toDomain(prismaTask: PrismaTaskWithRelations): Task {
    // Convert Prisma model to domain entity
    // This would need to be implemented based on your domain entity structure
    return Task.reconstitute({
      id: TaskId.create(prismaTask.id),
      workspaceId: WorkspaceId.create(prismaTask.workspaceId),
      projectId: prismaTask.projectId
        ? ProjectId.create(prismaTask.projectId)
        : null,
      title: prismaTask.title,
      description: prismaTask.description,
      status: TaskStatus.fromString(prismaTask.status),
      priority: Priority.fromString(prismaTask.priority),
      assigneeId: prismaTask.assigneeId
        ? UserId.create(prismaTask.assigneeId)
        : null,
      creatorId: UserId.create(prismaTask.creatorId),
      reporterId: prismaTask.reporterId
        ? UserId.create(prismaTask.reporterId)
        : null,
      dueDate: prismaTask.dueDate,
      startDate: prismaTask.startDate,
      completedAt: prismaTask.completedAt,
      estimatedHours: prismaTask.estimatedHours
        ? Number(prismaTask.estimatedHours)
        : null,
      actualHours: prismaTask.actualHours
        ? Number(prismaTask.actualHours)
        : null,
      storyPoints: prismaTask.storyPoints,
      tags: prismaTask.tags,
      labels: prismaTask.labels,
      epicId: prismaTask.epicId ? TaskId.create(prismaTask.epicId) : null,
      parentTaskId: prismaTask.parentTaskId
        ? TaskId.create(prismaTask.parentTaskId)
        : null,
      attachments: prismaTask.attachments as any[],
      externalLinks: prismaTask.externalLinks as any[],
      watchers: prismaTask.watchers.map((id: string) => UserId.create(id)),
      customFields: prismaTask.customFields as Record<string, any>,
      position: prismaTask.position,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt,
    });
  }

  protected toPrisma(task: Task): any {
    // Convert domain entity to Prisma model
    return {
      id: task.id.value,
      workspaceId: task.workspaceId.value,
      projectId: task.projectId?.value || null,
      title: task.title,
      description: task.description,
      status: task.status.value,
      priority: task.priority.value,
      assigneeId: task.assigneeId?.value || null,
      creatorId: task.creatorId.value,
      reporterId: task.reporterId?.value || null,
      dueDate: task.dueDate,
      startDate: task.startDate,
      completedAt: task.completedAt,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      storyPoints: task.storyPoints,
      tags: task.tags,
      labels: task.labels,
      epicId: task.epicId?.value || null,
      parentTaskId: task.parentTaskId?.value || null,
      attachments: task.attachments,
      externalLinks: task.externalLinks,
      watchers: task.watchers.map(w => w.value),
      customFields: task.customFields,
      position: task.position,
      lastActivityAt: new Date(),
    };
  }

  protected getDelegate(client: PrismaClient | Prisma.TransactionClient) {
    return client.task;
  }

  protected buildWhereClause(specification: ISpecification<Task>): any {
    // This would need to be implemented based on your specification pattern
    // For now, returning empty object
    return {};
  }

  protected getDefaultInclude(): any {
    return {
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
        parentTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    };
  }

  // Workspace-specific queries
  public async findByWorkspace(workspaceId: WorkspaceId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { workspaceId: workspaceId.value },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByWorkspaceAndStatus(
    workspaceId: WorkspaceId,
    status: TaskStatus
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        status: status.value,
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByWorkspaceAndPriority(
    workspaceId: WorkspaceId,
    priority: Priority
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        priority: priority.value,
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Project-specific queries
  public async findByProject(projectId: ProjectId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { projectId: projectId.value },
      ...this.getDefaultInclude(),
      orderBy: { position: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByProjectAndStatus(
    projectId: ProjectId,
    status: TaskStatus
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        projectId: projectId.value,
        status: status.value,
      },
      ...this.getDefaultInclude(),
      orderBy: { position: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByProjectAndAssignee(
    projectId: ProjectId,
    assigneeId: UserId
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        projectId: projectId.value,
        assigneeId: assigneeId.value,
      },
      ...this.getDefaultInclude(),
      orderBy: { dueDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // User-specific queries
  public async findByAssignee(assigneeId: UserId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { assigneeId: assigneeId.value },
      ...this.getDefaultInclude(),
      orderBy: { dueDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByCreator(creatorId: UserId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { creatorId: creatorId.value },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByWatcher(watcherId: UserId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        watchers: {
          has: watcherId.value,
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { lastActivityAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Status and priority queries
  public async findByStatus(status: TaskStatus): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { status: status.value },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByPriority(priority: Priority): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { priority: priority.value },
      ...this.getDefaultInclude(),
      orderBy: { dueDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findOverdueTasks(): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        dueDate: {
          lt: new Date(),
        },
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { dueDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findTasksDueToday(): Promise<Task[]> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        dueDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { dueDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findTasksDueThisWeek(): Promise<Task[]> {
    const today = new Date();
    const startOfWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay()
    );
    const endOfWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay() + 7
    );

    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        dueDate: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { dueDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Hierarchy queries
  public async findSubtasks(parentTaskId: TaskId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { parentTaskId: parentTaskId.value },
      ...this.getDefaultInclude(),
      orderBy: { position: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findEpicTasks(epicId: TaskId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: { epicId: epicId.value },
      ...this.getDefaultInclude(),
      orderBy: { position: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findRootTasks(workspaceId: WorkspaceId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        parentTaskId: null,
        epicId: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { position: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Dependency queries
  public async findDependencies(taskId: TaskId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const dependencies = await this.client.taskDependency.findMany({
      where: { taskId: taskId.value },
      include: {
        dependsOn: {
          ...this.getDefaultInclude().include,
        },
      },
    });

    return dependencies.map(dep => this.toDomain(dep.dependsOn));
  }

  public async findDependents(taskId: TaskId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const dependents = await this.client.taskDependency.findMany({
      where: { dependsOnId: taskId.value },
      include: {
        task: {
          ...this.getDefaultInclude().include,
        },
      },
    });

    return dependents.map(dep => this.toDomain(dep.task));
  }

  // Search and filtering
  public async searchTasks(
    workspaceId: WorkspaceId,
    query: string
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      ...this.getDefaultInclude(),
      orderBy: { lastActivityAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByTags(
    workspaceId: WorkspaceId,
    tags: string[]
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        tags: {
          hasSome: tags,
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByLabels(
    workspaceId: WorkspaceId,
    labels: string[]
  ): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        labels: {
          hasSome: labels,
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Analytics queries
  public async getTaskCountByStatus(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.groupBy({
      by: ['status'],
      where: { workspaceId: workspaceId.value },
      _count: { status: true },
    });

    return results.reduce(
      (acc, result) => {
        acc[result.status] = result._count.status;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  public async getTaskCountByPriority(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.groupBy({
      by: ['priority'],
      where: { workspaceId: workspaceId.value },
      _count: { priority: true },
    });

    return results.reduce(
      (acc, result) => {
        acc[result.priority] = result._count.priority;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  public async getTaskCountByAssignee(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.groupBy({
      by: ['assigneeId'],
      where: {
        workspaceId: workspaceId.value,
        assigneeId: { not: null },
      },
      _count: { assigneeId: true },
    });

    return results.reduce(
      (acc, result) => {
        if (result.assigneeId) {
          acc[result.assigneeId] = result._count.assigneeId;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  }

  public async getAverageCompletionTime(
    workspaceId: WorkspaceId
  ): Promise<number> {
    const delegate = this.getDelegate(this.client);
    const result = await delegate.aggregate({
      where: {
        workspaceId: workspaceId.value,
        status: 'DONE',
        completedAt: { not: null },
      },
      _avg: {
        actualHours: true,
      },
    });

    return Number(result._avg.actualHours) || 0;
  }

  // Bulk operations
  public async bulkUpdateStatus(
    taskIds: TaskId[],
    status: TaskStatus
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: taskIds.map(id => id.value) },
      },
      data: {
        status: status.value,
        updatedAt: new Date(),
        ...(status.value === 'DONE' ? { completedAt: new Date() } : {}),
      },
    });
  }

  public async bulkUpdatePriority(
    taskIds: TaskId[],
    priority: Priority
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: taskIds.map(id => id.value) },
      },
      data: {
        priority: priority.value,
        updatedAt: new Date(),
      },
    });
  }

  public async bulkAssign(
    taskIds: TaskId[],
    assigneeId: UserId
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: taskIds.map(id => id.value) },
      },
      data: {
        assigneeId: assigneeId.value,
        updatedAt: new Date(),
      },
    });
  }

  public async bulkAddTags(taskIds: TaskId[], tags: string[]): Promise<void> {
    // This requires individual updates since we need to merge arrays
    const delegate = this.getDelegate(this.client);
    const tasks = await delegate.findMany({
      where: { id: { in: taskIds.map(id => id.value) } },
      select: { id: true, tags: true },
    });

    await this.client.$transaction(
      tasks.map(task =>
        delegate.update({
          where: { id: task.id },
          data: {
            tags: [...new Set([...task.tags, ...tags])],
            updatedAt: new Date(),
          },
        })
      )
    );
  }

  // Soft delete operations
  public async softDelete(taskId: TaskId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.update({
      where: { id: taskId.value },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  public async restore(taskId: TaskId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.update({
      where: { id: taskId.value },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  public async findDeleted(workspaceId: WorkspaceId): Promise<Task[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: { not: null },
      },
      ...this.getDefaultInclude(),
      orderBy: { deletedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async permanentlyDelete(taskId: TaskId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.delete({
      where: { id: taskId.value },
    });
  }
}
