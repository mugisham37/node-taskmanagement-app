import { PrismaClient, Prisma, Project as PrismaProject } from '@prisma/client';
import { BasePrismaRepository } from '../database/base-repository';
import { IProjectRepository } from '../../domain/task-management/repositories/IProjectRepository';
import { Project } from '../../domain/task-management/entities/Project';
import { ProjectId } from '../../domain/task-management/value-objects/ProjectId';
import { WorkspaceId } from '../../domain/task-management/value-objects/WorkspaceId';
import { UserId } from '../../domain/authentication/value-objects/UserId';
import { ProjectStatus } from '../../domain/task-management/value-objects/ProjectStatus';
import { Priority } from '../../domain/task-management/value-objects/Priority';
import { ISpecification } from '../../domain/shared/repositories/IRepository';

type PrismaProjectWithRelations = PrismaProject & {
  owner?: any;
  workspace?: any;
  members?: any[];
  tasks?: any[];
  teams?: any[];
  template?: any;
  archiver?: any;
};

export class PrismaProjectRepository
  extends BasePrismaRepository<
    Project,
    ProjectId,
    PrismaProjectWithRelations,
    any
  >
  implements IProjectRepository
{
  constructor(client?: PrismaClient) {
    super('Project', client);
  }

  protected toDomain(prismaProject: PrismaProjectWithRelations): Project {
    return Project.reconstitute({
      id: ProjectId.create(prismaProject.id),
      workspaceId: WorkspaceId.create(prismaProject.workspaceId),
      name: prismaProject.name,
      description: prismaProject.description,
      color: prismaProject.color,
      ownerId: UserId.create(prismaProject.ownerId),
      status: ProjectStatus.fromString(prismaProject.status),
      priority: Priority.fromString(prismaProject.priority),
      startDate: prismaProject.startDate,
      endDate: prismaProject.endDate,
      budgetAmount: prismaProject.budgetAmount
        ? Number(prismaProject.budgetAmount)
        : null,
      budgetCurrency: prismaProject.budgetCurrency,
      settings: prismaProject.settings as Record<string, any>,
      templateId: prismaProject.templateId,
      isArchived: prismaProject.isArchived,
      archivedAt: prismaProject.archivedAt,
      archivedBy: prismaProject.archivedBy
        ? UserId.create(prismaProject.archivedBy)
        : null,
      createdAt: prismaProject.createdAt,
      updatedAt: prismaProject.updatedAt,
    });
  }

  protected toPrisma(project: Project): any {
    return {
      id: project.id.value,
      workspaceId: project.workspaceId.value,
      name: project.name,
      description: project.description,
      color: project.color,
      ownerId: project.ownerId.value,
      status: project.status.value,
      priority: project.priority.value,
      startDate: project.startDate,
      endDate: project.endDate,
      budgetAmount: project.budgetAmount,
      budgetCurrency: project.budgetCurrency,
      settings: project.settings,
      templateId: project.templateId,
      isArchived: project.isArchived,
      archivedAt: project.archivedAt,
      archivedBy: project.archivedBy?.value || null,
    };
  }

  protected getDelegate(client: PrismaClient | Prisma.TransactionClient) {
    return client.project;
  }

  protected buildWhereClause(specification: ISpecification<Project>): any {
    return {};
  }

  protected getDefaultInclude(): any {
    return {
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            assigneeId: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        archiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    };
  }

  // Workspace-specific queries
  public async findByWorkspace(workspaceId: WorkspaceId): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByWorkspaceAndStatus(
    workspaceId: WorkspaceId,
    status: ProjectStatus
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        status: status.value,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findActiveProjects(
    workspaceId: WorkspaceId
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        isArchived: false,
        deletedAt: null,
        status: {
          in: ['PLANNING', 'ACTIVE'],
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findArchivedProjects(
    workspaceId: WorkspaceId
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        isArchived: true,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { archivedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Owner-specific queries
  public async findByOwner(ownerId: UserId): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        ownerId: ownerId.value,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByOwnerAndStatus(
    ownerId: UserId,
    status: ProjectStatus
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        ownerId: ownerId.value,
        status: status.value,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Status and priority queries
  public async findByStatus(status: ProjectStatus): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        status: status.value,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByPriority(priority: Priority): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        priority: priority.value,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { endDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findOverdueProjects(): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        endDate: {
          lt: new Date(),
        },
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { endDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findProjectsEndingThisWeek(): Promise<Project[]> {
    const today = new Date();
    const endOfWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay() + 7
    );

    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        endDate: {
          gte: today,
          lte: endOfWeek,
        },
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { endDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Template queries
  public async findByTemplate(templateId: string): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        templateId,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findProjectsWithoutTemplate(
    workspaceId: WorkspaceId
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        templateId: null,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Search and filtering
  public async searchProjects(
    workspaceId: WorkspaceId,
    query: string
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByDateRange(
    workspaceId: WorkspaceId,
    startDate: Date,
    endDate: Date
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        OR: [
          {
            startDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            endDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } },
            ],
          },
        ],
      },
      ...this.getDefaultInclude(),
      orderBy: { startDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findByBudgetRange(
    workspaceId: WorkspaceId,
    minBudget: number,
    maxBudget: number
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        budgetAmount: {
          gte: minBudget,
          lte: maxBudget,
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { budgetAmount: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Analytics queries
  public async getProjectCountByStatus(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.groupBy({
      by: ['status'],
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
      },
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

  public async getProjectCountByPriority(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.groupBy({
      by: ['priority'],
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
      },
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

  public async getTotalBudgetByStatus(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.groupBy({
      by: ['status'],
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        budgetAmount: { not: null },
      },
      _sum: { budgetAmount: true },
    });

    return results.reduce(
      (acc, result) => {
        acc[result.status] = Number(result._sum.budgetAmount) || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  public async getAverageProjectDuration(
    workspaceId: WorkspaceId
  ): Promise<number> {
    const delegate = this.getDelegate(this.client);
    const projects = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        startDate: { not: null },
        endDate: { not: null },
        status: 'COMPLETED',
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    if (projects.length === 0) return 0;

    const totalDuration = projects.reduce((sum, project) => {
      if (project.startDate && project.endDate) {
        const duration =
          project.endDate.getTime() - project.startDate.getTime();
        return sum + duration;
      }
      return sum;
    }, 0);

    return totalDuration / projects.length / (1000 * 60 * 60 * 24); // Convert to days
  }

  public async getProjectCompletionRate(
    workspaceId: WorkspaceId
  ): Promise<number> {
    const delegate = this.getDelegate(this.client);
    const [total, completed] = await Promise.all([
      delegate.count({
        where: {
          workspaceId: workspaceId.value,
          deletedAt: null,
        },
      }),
      delegate.count({
        where: {
          workspaceId: workspaceId.value,
          status: 'COMPLETED',
          deletedAt: null,
        },
      }),
    ]);

    return total > 0 ? (completed / total) * 100 : 0;
  }

  // Member-related queries
  public async findProjectsWithMember(userId: UserId): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId: userId.value,
          },
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findProjectsNeedingMembers(
    workspaceId: WorkspaceId
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        status: {
          in: ['PLANNING', 'ACTIVE'],
        },
        members: {
          none: {},
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Bulk operations
  public async bulkUpdateStatus(
    projectIds: ProjectId[],
    status: ProjectStatus
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: projectIds.map(id => id.value) },
      },
      data: {
        status: status.value,
        updatedAt: new Date(),
      },
    });
  }

  public async bulkUpdatePriority(
    projectIds: ProjectId[],
    priority: Priority
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: projectIds.map(id => id.value) },
      },
      data: {
        priority: priority.value,
        updatedAt: new Date(),
      },
    });
  }

  public async bulkArchive(
    projectIds: ProjectId[],
    archivedBy: UserId
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: projectIds.map(id => id.value) },
      },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: archivedBy.value,
        updatedAt: new Date(),
      },
    });
  }

  public async bulkUnarchive(projectIds: ProjectId[]): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.updateMany({
      where: {
        id: { in: projectIds.map(id => id.value) },
      },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      },
    });
  }

  // Archive operations
  public async archive(
    projectId: ProjectId,
    archivedBy: UserId,
    reason?: string
  ): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.update({
      where: { id: projectId.value },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: archivedBy.value,
        updatedAt: new Date(),
        settings: {
          archiveReason: reason,
        },
      },
    });
  }

  public async unarchive(projectId: ProjectId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.update({
      where: { id: projectId.value },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      },
    });
  }

  public async findArchivedByUser(archivedBy: UserId): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        archivedBy: archivedBy.value,
        isArchived: true,
        deletedAt: null,
      },
      ...this.getDefaultInclude(),
      orderBy: { archivedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  // Soft delete operations
  public async softDelete(projectId: ProjectId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.update({
      where: { id: projectId.value },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  public async restore(projectId: ProjectId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.update({
      where: { id: projectId.value },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  public async findDeleted(workspaceId: WorkspaceId): Promise<Project[]> {
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

  public async permanentlyDelete(projectId: ProjectId): Promise<void> {
    const delegate = this.getDelegate(this.client);
    await delegate.delete({
      where: { id: projectId.value },
    });
  }

  // Health and metrics
  public async getProjectHealth(projectId: ProjectId): Promise<{
    taskCompletionRate: number;
    overdueTaskCount: number;
    memberCount: number;
    budgetUtilization: number;
  }> {
    const delegate = this.getDelegate(this.client);
    const project = await delegate.findUnique({
      where: { id: projectId.value },
      include: {
        tasks: {
          select: {
            status: true,
            dueDate: true,
          },
        },
        members: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      task => task.status === 'DONE'
    ).length;
    const overdueTasks = project.tasks.filter(
      task =>
        task.dueDate && task.dueDate < new Date() && task.status !== 'DONE'
    ).length;

    return {
      taskCompletionRate:
        totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      overdueTaskCount: overdueTasks,
      memberCount: project.members.length,
      budgetUtilization: 0, // This would need actual budget tracking implementation
    };
  }

  // Timeline queries
  public async findProjectsStartingThisMonth(
    workspaceId: WorkspaceId
  ): Promise<Project[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        startDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { startDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findProjectsEndingThisMonth(
    workspaceId: WorkspaceId
  ): Promise<Project[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        endDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      ...this.getDefaultInclude(),
      orderBy: { endDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }

  public async findProjectsInTimeframe(
    workspaceId: WorkspaceId,
    startDate: Date,
    endDate: Date
  ): Promise<Project[]> {
    const delegate = this.getDelegate(this.client);
    const results = await delegate.findMany({
      where: {
        workspaceId: workspaceId.value,
        deletedAt: null,
        OR: [
          {
            startDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            endDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } },
            ],
          },
        ],
      },
      ...this.getDefaultInclude(),
      orderBy: { startDate: 'asc' },
    });

    return results.map(result => this.toDomain(result));
  }
}
