/**
 * Task Repository Implementation
 * Prisma-based implementation of ITaskRepository interface
 */

import { PrismaClient, Prisma, Task } from '@prisma/client';
import { BasePrismaRepository } from '../../database/base-repository';
import {
  ITaskRepository,
  TaskFilters,
  TaskSimilarityFilters,
} from '../../../domains/task-management/repositories/task.repository.interface';
import { TaskAggregate } from '../../../domains/task-management/aggregates/task.aggregate';
import { TaskId } from '../../../domains/task-management/value-objects/task-id';
import { ProjectId } from '../../../domains/task-management/value-objects/project-id';
import { WorkspaceId } from '../../../domains/task-management/value-objects/workspace-id';
import { UserId } from '../../../domains/authentication/value-objects/user-id';
import { TaskStatus } from '../../../domains/task-management/value-objects/task-status';
import { Priority } from '../../../domains/task-management/value-objects/priority';
import { logger } from '../../logging/logger';

type TaskWithRelations = Task & {
  assignee?: any;
  creator?: any;
  reporter?: any;
  project?: any;
  workspace?: any;
  parentTask?: any;
  subtasks?: any[];
  dependencies?: any[];
  dependents?: any[];
  attachments?: any[];
  comments?: any[];
  timeEntries?: any[];
};

export class PrismaTaskRepository
  extends BasePrismaRepository<
    TaskAggregate,
    string,
    TaskWithRelations,
    PrismaClient['task']
  >
  implements ITaskRepository
{
  constructor(client?: PrismaClient) {
    super('Task', client);
  }

  protected toDomain(prismaTask: TaskWithRelations): TaskAggregate {
    return TaskAggregate.fromPersistence({
      id: prismaTask.id,
      workspaceId: prismaTask.workspaceId,
      projectId: prismaTask.projectId,
      title: prismaTask.title,
      description: prismaTask.description,
      status: prismaTask.status,
      priority: prismaTask.priority,
      assigneeId: prismaTask.assigneeId,
      creatorId: prismaTask.creatorId,
      reporterId: prismaTask.reporterId,
      dueDate: prismaTask.dueDate,
      startDate: prismaTask.startDate,
      completedAt: prismaTask.completedAt,
      estimatedHours: prismaTask.estimatedHours?.toNumber(),
      actualHours: prismaTask.actualHours?.toNumber(),
      storyPoints: prismaTask.storyPoints,
      tags: prismaTask.tags,
      labels: prismaTask.labels,
      epicId: prismaTask.epicId,
      parentTaskId: prismaTask.parentTaskId,
      recurringTaskId: prismaTask.recurringTaskId,
      recurrenceInstanceDate: prismaTask.recurrenceInstanceDate,
      watchers: prismaTask.watchers,
      lastActivityAt: prismaTask.lastActivityAt,
      customFields: prismaTask.customFields as any,
      position: prismaTask.position,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt,
      deletedAt: prismaTask.deletedAt,
    });
  }

  protected toPrisma(task: TaskAggregate): Prisma.TaskCreateInput {
    const taskData = task.toPersistence();
    return {
      id: taskData.id,
      workspace: { connect: { id: taskData.workspaceId } },
      project: taskData.projectId
        ? { connect: { id: taskData.projectId } }
        : undefined,
      title: taskData.title,
      description: taskData.description,
      status: taskData.status,
      priority: taskData.priority,
      assignee: taskData.assigneeId
        ? { connect: { id: taskData.assigneeId } }
        : undefined,
      creator: { connect: { id: taskData.creatorId } },
      reporter: taskData.reporterId
        ? { connect: { id: taskData.reporterId } }
        : undefined,
      dueDate: taskData.dueDate,
      startDate: taskData.startDate,
      completedAt: taskData.completedAt,
      estimatedHours: taskData.estimatedHours,
      actualHours: taskData.actualHours,
      storyPoints: taskData.storyPoints,
      tags: taskData.tags,
      labels: taskData.labels,
      epic: taskData.epicId ? { connect: { id: taskData.epicId } } : undefined,
      parentTask: taskData.parentTaskId
        ? { connect: { id: taskData.parentTaskId } }
        : undefined,
      recurringTaskId: taskData.recurringTaskId,
      recurrenceInstanceDate: taskData.recurrenceInstanceDate,
      watchers: taskData.watchers,
      lastActivityAt: taskData.lastActivityAt,
      customFields: taskData.customFields,
      position: taskData.position,
      createdAt: taskData.createdAt,
      updatedAt: taskData.updatedAt,
      deletedAt: taskData.deletedAt,
    };
  }

  protected getDelegate(client: PrismaClient | Prisma.TransactionClient) {
    return client.task;
  }

  protected buildWhereClause(specification: any): Prisma.TaskWhereInput {
    // Implementation would depend on the specification pattern used
    return {};
  }

  protected getDefaultInclude() {
    return {
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
          status: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      parentTask: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      subtasks: {
        select: {
          id: true,
          title: true,
          status: true,
          assigneeId: true,
        },
        where: {
          deletedAt: null,
        },
      },
      attachments: true,
      _count: {
        select: {
          comments: true,
          subtasks: true,
          timeEntries: true,
        },
      },
    };
  }

  private buildTaskFilters(filters?: TaskFilters): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
    };

    if (!filters) return where;

    if (filters.status && filters.status.length > 0) {
      where.status = {
        in: filters.status.map(s => s.value),
      };
    }

    if (filters.priority && filters.priority.length > 0) {
      where.priority = {
        in: filters.priority.map(p => p.value),
      };
    }

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId.value;
    }

    if (filters.creatorId) {
      where.creatorId = filters.creatorId.value;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.labels && filters.labels.length > 0) {
      where.labels = {
        hasSome: filters.labels,
      };
    }

    if (filters.dueDate) {
      where.dueDate = {};
      if (filters.dueDate.from) {
        where.dueDate.gte = filters.dueDate.from;
      }
      if (filters.dueDate.to) {
        where.dueDate.lte = filters.dueDate.to;
      }
    }

    if (filters.createdAt) {
      where.createdAt = {};
      if (filters.createdAt.from) {
        where.createdAt.gte = filters.createdAt.from;
      }
      if (filters.createdAt.to) {
        where.createdAt.lte = filters.createdAt.to;
      }
    }

    if (filters.isOverdue) {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        not: 'completed',
      };
    }

    if (filters.hasAttachments !== undefined) {
      if (filters.hasAttachments) {
        where.attachments = {
          some: {},
        };
      } else {
        where.attachments = {
          none: {},
        };
      }
    }

    if (filters.isWatchedBy) {
      where.watchers = {
        has: filters.isWatchedBy.value,
      };
    }

    return where;
  }

  // ITaskRepository specific methods
  async findByWorkspaceId(
    workspaceId: WorkspaceId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        workspaceId: workspaceId.value,
      };

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks by workspace ID', {
        workspaceId: workspaceId.value,
        filters,
        error,
      });
      throw error;
    }
  }

  async findByProjectId(
    projectId: ProjectId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        projectId: projectId.value,
      };

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks by project ID', {
        projectId: projectId.value,
        filters,
        error,
      });
      throw error;
    }
  }

  async findByAssigneeId(
    assigneeId: UserId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        assigneeId: assigneeId.value,
      };

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks by assignee ID', {
        assigneeId: assigneeId.value,
        filters,
        error,
      });
      throw error;
    }
  }

  async findByCreatorId(
    creatorId: UserId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        creatorId: creatorId.value,
      };

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { createdAt: 'desc' },
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks by creator ID', {
        creatorId: creatorId.value,
        filters,
        error,
      });
      throw error;
    }
  }

  async findWatchedByUser(
    userId: UserId,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        watchers: {
          has: userId.value,
        },
      };

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { lastActivityAt: 'desc' },
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks watched by user', {
        userId: userId.value,
        filters,
        error,
      });
      throw error;
    }
  }

  async findSubtasks(parentTaskId: TaskId): Promise<TaskAggregate[]> {
    try {
      const tasks = await this.client.task.findMany({
        where: {
          parentTaskId: parentTaskId.value,
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { position: 'asc' },
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding subtasks', {
        parentTaskId: parentTaskId.value,
        error,
      });
      throw error;
    }
  }

  async findTasksInEpic(epicId: TaskId): Promise<TaskAggregate[]> {
    try {
      const tasks = await this.client.task.findMany({
        where: {
          epicId: epicId.value,
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks in epic', {
        epicId: epicId.value,
        error,
      });
      throw error;
    }
  }

  async findOverdueTasks(workspaceId?: WorkspaceId): Promise<TaskAggregate[]> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        dueDate: {
          lt: new Date(),
        },
        status: {
          not: 'completed',
        },
        deletedAt: null,
      };

      if (workspaceId) {
        whereClause.workspaceId = workspaceId.value;
      }

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { dueDate: 'asc' },
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding overdue tasks', {
        workspaceId: workspaceId?.value,
        error,
      });
      throw error;
    }
  }

  async findTasksDueSoon(
    days: number,
    workspaceId?: WorkspaceId
  ): Promise<TaskAggregate[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const whereClause: Prisma.TaskWhereInput = {
        dueDate: {
          gte: new Date(),
          lte: futureDate,
        },
        status: {
          not: 'completed',
        },
        deletedAt: null,
      };

      if (workspaceId) {
        whereClause.workspaceId = workspaceId.value;
      }

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { dueDate: 'asc' },
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding tasks due soon', {
        days,
        workspaceId: workspaceId?.value,
        error,
      });
      throw error;
    }
  }

  async findSimilarTasks(
    workspaceId: WorkspaceId,
    filters: TaskSimilarityFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        workspaceId: workspaceId.value,
        deletedAt: null,
      };

      const orConditions: Prisma.TaskWhereInput[] = [];

      if (filters.tags && filters.tags.length > 0) {
        orConditions.push({
          tags: {
            hasSome: filters.tags,
          },
        });
      }

      if (filters.labels && filters.labels.length > 0) {
        orConditions.push({
          labels: {
            hasSome: filters.labels,
          },
        });
      }

      if (filters.assigneeId) {
        orConditions.push({
          assigneeId: filters.assigneeId.value,
        });
      }

      if (filters.priority) {
        orConditions.push({
          priority: filters.priority.value,
        });
      }

      if (orConditions.length > 0) {
        whereClause.OR = orConditions;
      }

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { createdAt: 'desc' },
        take: 20, // Limit similar tasks
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error finding similar tasks', {
        workspaceId: workspaceId.value,
        filters,
        error,
      });
      throw error;
    }
  }

  async findWithPagination(
    workspaceId: WorkspaceId,
    offset: number,
    limit: number,
    filters?: TaskFilters,
    sortBy?: {
      field: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'status';
      direction: 'asc' | 'desc';
    }
  ): Promise<{ tasks: TaskAggregate[]; total: number }> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        workspaceId: workspaceId.value,
      };

      const orderBy = sortBy
        ? { [sortBy.field]: sortBy.direction }
        : { createdAt: 'desc' };

      const [tasks, total] = await Promise.all([
        this.client.task.findMany({
          where: whereClause,
          ...this.getDefaultInclude(),
          skip: offset,
          take: limit,
          orderBy,
        }),
        this.client.task.count({ where: whereClause }),
      ]);

      return {
        tasks: tasks.map(task => this.toDomain(task)),
        total,
      };
    } catch (error) {
      logger.error('Error finding tasks with pagination', {
        workspaceId: workspaceId.value,
        offset,
        limit,
        filters,
        sortBy,
        error,
      });
      throw error;
    }
  }

  async searchTasks(
    workspaceId: WorkspaceId,
    query: string,
    filters?: TaskFilters
  ): Promise<TaskAggregate[]> {
    try {
      const whereClause = {
        ...this.buildTaskFilters(filters),
        workspaceId: workspaceId.value,
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive' as const,
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive' as const,
            },
          },
        ],
      };

      const tasks = await this.client.task.findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { lastActivityAt: 'desc' },
        take: 50, // Limit search results
      });

      return tasks.map(task => this.toDomain(task));
    } catch (error) {
      logger.error('Error searching tasks', {
        workspaceId: workspaceId.value,
        query,
        filters,
        error,
      });
      throw error;
    }
  }

  async countByStatus(
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<Record<string, number>> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        workspaceId: workspaceId.value,
        deletedAt: null,
      };

      if (projectId) {
        whereClause.projectId = projectId.value;
      }

      const results = await this.client.task.groupBy({
        by: ['status'],
        where: whereClause,
        _count: {
          status: true,
        },
      });

      return results.reduce(
        (acc, result) => {
          acc[result.status] = result._count.status;
          return acc;
        },
        {} as Record<string, number>
      );
    } catch (error) {
      logger.error('Error counting tasks by status', {
        workspaceId: workspaceId.value,
        projectId: projectId?.value,
        error,
      });
      throw error;
    }
  }

  async countByPriority(
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<Record<string, number>> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        workspaceId: workspaceId.value,
        deletedAt: null,
      };

      if (projectId) {
        whereClause.projectId = projectId.value;
      }

      const results = await this.client.task.groupBy({
        by: ['priority'],
        where: whereClause,
        _count: {
          priority: true,
        },
      });

      return results.reduce(
        (acc, result) => {
          acc[result.priority] = result._count.priority;
          return acc;
        },
        {} as Record<string, number>
      );
    } catch (error) {
      logger.error('Error counting tasks by priority', {
        workspaceId: workspaceId.value,
        projectId: projectId?.value,
        error,
      });
      throw error;
    }
  }

  async countByAssignee(
    workspaceId: WorkspaceId,
    projectId?: ProjectId
  ): Promise<Record<string, number>> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        workspaceId: workspaceId.value,
        assigneeId: { not: null },
        deletedAt: null,
      };

      if (projectId) {
        whereClause.projectId = projectId.value;
      }

      const results = await this.client.task.groupBy({
        by: ['assigneeId'],
        where: whereClause,
        _count: {
          assigneeId: true,
        },
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
    } catch (error) {
      logger.error('Error counting tasks by assignee', {
        workspaceId: workspaceId.value,
        projectId: projectId?.value,
        error,
      });
      throw error;
    }
  }

  async getCompletionStats(
    workspaceId: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageCompletionTime: number;
  }> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        workspaceId: workspaceId.value,
        deletedAt: null,
      };

      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        };
      }

      const [totalTasks, completedTasks, completionTimes] = await Promise.all([
        this.client.task.count({ where: whereClause }),
        this.client.task.count({
          where: {
            ...whereClause,
            status: 'completed',
          },
        }),
        this.client.task.findMany({
          where: {
            ...whereClause,
            status: 'completed',
            completedAt: { not: null },
          },
          select: {
            createdAt: true,
            completedAt: true,
          },
        }),
      ]);

      const completionRate =
        totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const averageCompletionTime =
        completionTimes.length > 0
          ? completionTimes.reduce((sum, task) => {
              const completionTime =
                task.completedAt!.getTime() - task.createdAt.getTime();
              return sum + completionTime / (1000 * 60 * 60); // Convert to hours
            }, 0) / completionTimes.length
          : 0;

      return {
        totalTasks,
        completedTasks,
        completionRate,
        averageCompletionTime,
      };
    } catch (error) {
      logger.error('Error getting completion stats', {
        workspaceId: workspaceId.value,
        dateRange,
        error,
      });
      throw error;
    }
  }

  async getActivityTimeline(taskId: TaskId): Promise<
    Array<{
      timestamp: Date;
      action: string;
      userId: UserId;
      details: Record<string, any>;
    }>
  > {
    try {
      // This would typically come from an audit log or activity table
      // For now, return basic activity from comments and updates
      const activities = await this.client.activity.findMany({
        where: {
          entityType: 'Task',
          entityId: taskId.value,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return activities.map(activity => ({
        timestamp: activity.createdAt,
        action: activity.action,
        userId: UserId.create(activity.userId),
        details: activity.details as Record<string, any>,
      }));
    } catch (error) {
      logger.error('Error getting activity timeline', {
        taskId: taskId.value,
        error,
      });
      return []; // Return empty array if activity table doesn't exist
    }
  }

  async findTasksNeedingAttention(workspaceId: WorkspaceId): Promise<{
    overdue: TaskAggregate[];
    stale: TaskAggregate[];
    blocked: TaskAggregate[];
    highPriority: TaskAggregate[];
  }> {
    try {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const [overdue, stale, blocked, highPriority] = await Promise.all([
        this.findOverdueTasks(workspaceId),
        this.client.task.findMany({
          where: {
            workspaceId: workspaceId.value,
            lastActivityAt: { lt: staleThreshold },
            status: { not: 'completed' },
            deletedAt: null,
          },
          ...this.getDefaultInclude(),
          orderBy: { lastActivityAt: 'asc' },
          take: 20,
        }),
        this.client.task.findMany({
          where: {
            workspaceId: workspaceId.value,
            status: 'blocked',
            deletedAt: null,
          },
          ...this.getDefaultInclude(),
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.client.task.findMany({
          where: {
            workspaceId: workspaceId.value,
            priority: 'critical',
            status: { not: 'completed' },
            deletedAt: null,
          },
          ...this.getDefaultInclude(),
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

      return {
        overdue,
        stale: stale.map(task => this.toDomain(task)),
        blocked: blocked.map(task => this.toDomain(task)),
        highPriority: highPriority.map(task => this.toDomain(task)),
      };
    } catch (error) {
      logger.error('Error finding tasks needing attention', {
        workspaceId: workspaceId.value,
        error,
      });
      throw error;
    }
  }

  async getUserWorkload(
    userId: UserId,
    workspaceId?: WorkspaceId
  ): Promise<{
    totalTasks: number;
    activeTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    estimatedHours: number;
    actualHours: number;
  }> {
    try {
      const whereClause: Prisma.TaskWhereInput = {
        assigneeId: userId.value,
        deletedAt: null,
      };

      if (workspaceId) {
        whereClause.workspaceId = workspaceId.value;
      }

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const [
        totalTasks,
        activeTasks,
        overdueTasks,
        completedThisWeek,
        timeStats,
      ] = await Promise.all([
        this.client.task.count({ where: whereClause }),
        this.client.task.count({
          where: {
            ...whereClause,
            status: { notIn: ['completed', 'cancelled'] },
          },
        }),
        this.client.task.count({
          where: {
            ...whereClause,
            dueDate: { lt: new Date() },
            status: { not: 'completed' },
          },
        }),
        this.client.task.count({
          where: {
            ...whereClause,
            status: 'completed',
            completedAt: { gte: weekStart },
          },
        }),
        this.client.task.aggregate({
          where: whereClause,
          _sum: {
            estimatedHours: true,
            actualHours: true,
          },
        }),
      ]);

      return {
        totalTasks,
        activeTasks,
        overdueTasks,
        completedThisWeek,
        estimatedHours: timeStats._sum.estimatedHours?.toNumber() || 0,
        actualHours: timeStats._sum.actualHours?.toNumber() || 0,
      };
    } catch (error) {
      logger.error('Error getting user workload', {
        userId: userId.value,
        workspaceId: workspaceId?.value,
        error,
      });
      throw error;
    }
  }

  // Override save method to handle domain events
  async save(task: TaskAggregate): Promise<void> {
    try {
      const taskData = this.toPrisma(task);

      await this.client.task.upsert({
        where: { id: task.id.value },
        create: taskData,
        update: taskData,
        ...this.getDefaultInclude(),
      });

      logger.debug('Task saved successfully', { taskId: task.id.value });
    } catch (error) {
      logger.error('Error saving task', {
        taskId: task.id.value,
        error,
      });
      throw error;
    }
  }

  // Override delete method for soft delete
  async delete(id: TaskId): Promise<void> {
    try {
      await this.client.task.update({
        where: { id: id.value },
        data: {
          deletedAt: new Date(),
        },
      });

      logger.info('Task soft deleted', { taskId: id.value });
    } catch (error) {
      logger.error('Error deleting task', { taskId: id.value, error });
      throw error;
    }
  }
}
