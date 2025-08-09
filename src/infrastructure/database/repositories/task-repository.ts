import {
  eq,
  and,
  or,
  like,
  gte,
  lte,
  count,
  desc,
  asc,
  inArray,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import { getDatabase } from '../connection';
import { tasks, users, projects, taskDependencies } from '../schema';
import {
  ITaskRepository,
  TaskFilters,
  TaskSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/task-repository';
import { Task } from '../../../domain/entities/task';
import {
  TaskAggregate,
  TaskDependency,
} from '../../../domain/aggregates/task-aggregate';
import { TaskId, UserId, ProjectId } from '../../../domain/value-objects';
import { TaskStatus } from '../../../shared/constants/task-constants';

export class TaskRepository implements ITaskRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: TaskId): Promise<Task | null> {
    const result = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id.value))
      .limit(1);

    return result.length > 0 ? this.mapToEntity(result[0]) : null;
  }

  async findByIds(ids: TaskId[]): Promise<Task[]> {
    const idValues = ids.map(id => id.value);
    const result = await this.db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, idValues));

    return result.map(row => this.mapToEntity(row));
  }

  async findByProjectId(
    projectId: ProjectId,
    filters?: TaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>> {
    let query = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(tasks.projectId, projectId.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(tasks[sort.field]));
    } else {
      query = query.orderBy(desc(tasks.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;
    const total = await this.count(projectId, filters);

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findByAssigneeId(
    assigneeId: UserId,
    filters?: TaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>> {
    let query = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.assigneeId, assigneeId.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(tasks.assigneeId, assigneeId.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(tasks[sort.field]));
    } else {
      query = query.orderBy(desc(tasks.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    let countQuery = this.db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.assigneeId, assigneeId.value));

    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        countQuery = countQuery.where(
          and(eq(tasks.assigneeId, assigneeId.value), ...conditions)
        );
      }
    }

    const totalResult = await countQuery;
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findByCreatedById(
    createdById: UserId,
    filters?: TaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>> {
    let query = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.createdById, createdById.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(tasks.createdById, createdById.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(tasks[sort.field]));
    } else {
      query = query.orderBy(desc(tasks.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    let countQuery = this.db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.createdById, createdById.value));

    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        countQuery = countQuery.where(
          and(eq(tasks.createdById, createdById.value), ...conditions)
        );
      }
    }

    const totalResult = await countQuery;
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findOverdueTasks(
    projectId?: ProjectId,
    assigneeId?: UserId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>> {
    const now = new Date();
    let query = this.db
      .select()
      .from(tasks)
      .where(
        and(
          lte(tasks.dueDate, now),
          isNotNull(tasks.dueDate),
          inArray(tasks.status, ['TODO', 'IN_PROGRESS', 'IN_REVIEW'])
        )
      );

    const conditions: any[] = [
      lte(tasks.dueDate, now),
      isNotNull(tasks.dueDate),
      inArray(tasks.status, ['TODO', 'IN_PROGRESS', 'IN_REVIEW']),
    ];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId.value));
    }

    if (assigneeId) {
      conditions.push(eq(tasks.assigneeId, assigneeId.value));
    }

    query = this.db
      .select()
      .from(tasks)
      .where(and(...conditions));

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    const totalResult = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(and(...conditions));
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findTasksDueWithinDays(
    days: number,
    projectId?: ProjectId,
    assigneeId?: UserId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const conditions: any[] = [
      lte(tasks.dueDate, futureDate),
      isNotNull(tasks.dueDate),
      inArray(tasks.status, ['TODO', 'IN_PROGRESS', 'IN_REVIEW']),
    ];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId.value));
    }

    if (assigneeId) {
      conditions.push(eq(tasks.assigneeId, assigneeId.value));
    }

    let query = this.db
      .select()
      .from(tasks)
      .where(and(...conditions));

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    const totalResult = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(and(...conditions));
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async searchTasks(
    searchTerm: string,
    projectId?: ProjectId,
    filters?: TaskFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Task>> {
    const searchCondition = or(
      like(tasks.title, `%${searchTerm}%`),
      like(tasks.description, `%${searchTerm}%`)
    );

    const conditions: any[] = [searchCondition];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId.value));
    }

    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    let query = this.db
      .select()
      .from(tasks)
      .where(and(...conditions));

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    const totalResult = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(and(...conditions));
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async getTaskStatistics(projectId: ProjectId): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completed: number;
    averageCompletionTime?: number;
  }> {
    const total = await this.count(projectId);

    // Get counts by status
    const statusCounts = await this.db
      .select({ status: tasks.status, count: count() })
      .from(tasks)
      .where(eq(tasks.projectId, projectId.value))
      .groupBy(tasks.status);

    const byStatus = statusCounts.reduce(
      (acc, row) => {
        acc[row.status as TaskStatus] = row.count;
        return acc;
      },
      {} as Record<TaskStatus, number>
    );

    // Get counts by priority
    const priorityCounts = await this.db
      .select({ priority: tasks.priority, count: count() })
      .from(tasks)
      .where(eq(tasks.projectId, projectId.value))
      .groupBy(tasks.priority);

    const byPriority = priorityCounts.reduce(
      (acc, row) => {
        acc[row.priority] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get overdue count
    const now = new Date();
    const overdueResult = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId.value),
          lte(tasks.dueDate, now),
          isNotNull(tasks.dueDate),
          inArray(tasks.status, ['TODO', 'IN_PROGRESS', 'IN_REVIEW'])
        )
      );
    const overdue = overdueResult[0].count;

    // Get completed count
    const completedResult = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(eq(tasks.projectId, projectId.value), eq(tasks.status, 'COMPLETED'))
      );
    const completed = completedResult[0].count;

    return {
      total,
      byStatus,
      byPriority,
      overdue,
      completed,
    };
  }

  async getTaskDependencies(taskId: TaskId): Promise<TaskDependency[]> {
    const result = await this.db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, taskId.value));

    return result.map(row => ({
      taskId: TaskId.create(row.taskId),
      dependsOnId: TaskId.create(row.dependsOnId),
      createdAt: row.createdAt,
    }));
  }

  async getTasksDependingOn(taskId: TaskId): Promise<Task[]> {
    const result = await this.db
      .select()
      .from(tasks)
      .innerJoin(taskDependencies, eq(tasks.id, taskDependencies.taskId))
      .where(eq(taskDependencies.dependsOnId, taskId.value));

    return result.map(row => this.mapToEntity(row.tasks));
  }

  async save(task: Task): Promise<void> {
    const data = this.mapFromEntity(task);

    await this.db
      .insert(tasks)
      .values(data)
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          assigneeId: data.assigneeId,
          dueDate: data.dueDate,
          estimatedHours: data.estimatedHours,
          actualHours: data.actualHours,
          completedAt: data.completedAt,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(taskList: Task[]): Promise<void> {
    if (taskList.length === 0) return;

    const data = taskList.map(task => this.mapFromEntity(task));

    await this.db
      .insert(tasks)
      .values(data)
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: TaskId): Promise<void> {
    // Delete dependencies first
    await this.db
      .delete(taskDependencies)
      .where(
        or(
          eq(taskDependencies.taskId, id.value),
          eq(taskDependencies.dependsOnId, id.value)
        )
      );

    // Delete task
    await this.db.delete(tasks).where(eq(tasks.id, id.value));
  }

  async deleteMany(ids: TaskId[]): Promise<void> {
    const idValues = ids.map(id => id.value);

    // Delete dependencies first
    await this.db
      .delete(taskDependencies)
      .where(
        or(
          inArray(taskDependencies.taskId, idValues),
          inArray(taskDependencies.dependsOnId, idValues)
        )
      );

    // Delete tasks
    await this.db.delete(tasks).where(inArray(tasks.id, idValues));
  }

  async exists(id: TaskId): Promise<boolean> {
    const result = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async count(projectId?: ProjectId, filters?: TaskFilters): Promise<number> {
    let query = this.db.select({ count: count() }).from(tasks);

    const conditions: any[] = [];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId.value));
    }

    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result[0].count;
  }

  // Placeholder implementations for complex methods
  async getTaskAggregate(projectId: ProjectId): Promise<TaskAggregate | null> {
    // This would require complex logic to build the aggregate
    return null;
  }

  async saveTaskAggregate(aggregate: TaskAggregate): Promise<void> {
    // This would require complex logic to save the aggregate
  }

  async addTaskDependency(taskId: TaskId, dependsOnId: TaskId): Promise<void> {
    await this.db.insert(taskDependencies).values({
      id: crypto.randomUUID(),
      taskId: taskId.value,
      dependsOnId: dependsOnId.value,
      createdAt: new Date(),
    });
  }

  async removeTaskDependency(
    taskId: TaskId,
    dependsOnId: TaskId
  ): Promise<void> {
    await this.db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, taskId.value),
          eq(taskDependencies.dependsOnId, dependsOnId.value)
        )
      );
  }

  async getTasksWithNoDependencies(projectId: ProjectId): Promise<Task[]> {
    const result = await this.db
      .select()
      .from(tasks)
      .leftJoin(taskDependencies, eq(tasks.id, taskDependencies.taskId))
      .where(
        and(
          eq(tasks.projectId, projectId.value),
          isNull(taskDependencies.taskId)
        )
      );

    return result.map(row => this.mapToEntity(row.tasks));
  }

  // Additional placeholder methods
  async getTaskCompletionHistory(
    projectId: ProjectId,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    return [];
  }
  async getUserTaskWorkload(userId: UserId): Promise<any> {
    return {};
  }
  async bulkUpdateStatus(taskIds: TaskId[], status: TaskStatus): Promise<void> {
    const idValues = taskIds.map(id => id.value);
    await this.db
      .update(tasks)
      .set({ status, updatedAt: new Date() })
      .where(inArray(tasks.id, idValues));
  }
  async bulkAssignTasks(taskIds: TaskId[], assigneeId: UserId): Promise<void> {
    const idValues = taskIds.map(id => id.value);
    await this.db
      .update(tasks)
      .set({ assigneeId: assigneeId.value, updatedAt: new Date() })
      .where(inArray(tasks.id, idValues));
  }
  async getTasksRequiringAttention(
    projectId?: ProjectId,
    assigneeId?: UserId
  ): Promise<Task[]> {
    return [];
  }

  private buildFilterConditions(filters: TaskFilters): any[] {
    const conditions: any[] = [];

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(tasks.status, filters.status));
    }

    if (filters.assigneeId) {
      conditions.push(eq(tasks.assigneeId, filters.assigneeId.value));
    }

    if (filters.createdById) {
      conditions.push(eq(tasks.createdById, filters.createdById.value));
    }

    if (filters.priority && filters.priority.length > 0) {
      conditions.push(inArray(tasks.priority, filters.priority));
    }

    if (filters.dueDateFrom) {
      conditions.push(gte(tasks.dueDate, filters.dueDateFrom));
    }

    if (filters.dueDateTo) {
      conditions.push(lte(tasks.dueDate, filters.dueDateTo));
    }

    if (filters.isOverdue) {
      const now = new Date();
      conditions.push(
        and(
          lte(tasks.dueDate, now),
          isNotNull(tasks.dueDate),
          inArray(tasks.status, ['TODO', 'IN_PROGRESS', 'IN_REVIEW'])
        )
      );
    }

    if (filters.hasEstimatedHours !== undefined) {
      if (filters.hasEstimatedHours) {
        conditions.push(isNotNull(tasks.estimatedHours));
      } else {
        conditions.push(isNull(tasks.estimatedHours));
      }
    }

    if (filters.search) {
      conditions.push(
        or(
          like(tasks.title, `%${filters.search}%`),
          like(tasks.description, `%${filters.search}%`)
        )
      );
    }

    return conditions;
  }

  private mapToEntity(row: any): Task {
    // This would need to be implemented based on the actual Task entity structure
    return {} as Task;
  }

  private mapFromEntity(task: Task): any {
    // This would need to be implemented based on the actual Task entity structure
    return {
      id: '', // task.id.value,
      title: '', // task.title,
      description: '', // task.description,
      status: 'TODO', // task.status.value,
      priority: 'MEDIUM', // task.priority.value,
      assigneeId: null, // task.assigneeId?.value,
      projectId: '', // task.projectId.value,
      createdById: '', // task.createdById.value,
      dueDate: null, // task.dueDate,
      estimatedHours: null, // task.estimatedHours,
      actualHours: null, // task.actualHours,
      completedAt: null, // task.completedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
