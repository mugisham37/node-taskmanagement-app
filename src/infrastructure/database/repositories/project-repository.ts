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
import { projects, users, workspaces, projectMembers, tasks } from '../schema';
import {
  IProjectRepository,
  ProjectFilters,
  ProjectSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/project-repository';
import { Project, ProjectMember } from '../../../domain/entities/project';
import { ProjectAggregate } from '../../../domain/aggregates/project-aggregate';
import { ProjectId, UserId, WorkspaceId } from '../../../domain/value-objects';
import { ProjectStatus } from '../../../shared/constants/project-constants';

export class ProjectRepository implements IProjectRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id.value))
      .limit(1);

    return result.length > 0 ? this.mapToEntity(result[0]) : null;
  }

  async findByIds(ids: ProjectId[]): Promise<Project[]> {
    const idValues = ids.map(id => id.value);
    const result = await this.db
      .select()
      .from(projects)
      .where(inArray(projects.id, idValues));

    return result.map(row => this.mapToEntity(row));
  }

  async findByWorkspaceId(
    workspaceId: WorkspaceId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    let query = this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(projects.workspaceId, workspaceId.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(projects[sort.field]));
    } else {
      query = query.orderBy(desc(projects.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;
    const total = await this.count(workspaceId, filters);

    return {
      items: result.map(row => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findByMemberId(
    userId: UserId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    let query = this.db
      .select()
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(projectMembers.userId, userId.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(projects[sort.field]));
    } else {
      query = query.orderBy(desc(projects.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Count total
    const totalResult = await this.db
      .select({ count: count() })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId.value));
    const total = totalResult[0].count;

    return {
      items: result.map(row => this.mapToEntity(row.projects)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findByManagerId(
    managerId: UserId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    let query = this.db
      .select()
      .from(projects)
      .where(eq(projects.managerId, managerId.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(projects.managerId, managerId.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      query = query.orderBy(orderBy(projects[sort.field]));
    } else {
      query = query.orderBy(desc(projects.createdAt));
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
      .from(projects)
      .where(eq(projects.managerId, managerId.value));

    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        countQuery = countQuery.where(
          and(eq(projects.managerId, managerId.value), ...conditions)
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

  async searchProjects(
    searchTerm: string,
    workspaceId?: WorkspaceId,
    filters?: ProjectFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    const searchCondition = or(
      like(projects.name, `%${searchTerm}%`),
      like(projects.description, `%${searchTerm}%`)
    );

    const conditions: any[] = [searchCondition];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    let query = this.db
      .select()
      .from(projects)
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
      .from(projects)
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

  async getActiveProjects(workspaceId: WorkspaceId): Promise<Project[]> {
    const result = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId.value),
          eq(projects.status, 'ACTIVE')
        )
      );

    return result.map(row => this.mapToEntity(row));
  }

  async getProjectsRequiringAttention(
    workspaceId?: WorkspaceId,
    managerId?: UserId
  ): Promise<Project[]> {
    const conditions: any[] = [];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    if (managerId) {
      conditions.push(eq(projects.managerId, managerId.value));
    }

    // Projects that are overdue (past end date but not completed)
    const now = new Date();
    conditions.push(
      and(
        lte(projects.endDate, now),
        isNotNull(projects.endDate),
        inArray(projects.status, ['ACTIVE', 'ON_HOLD'])
      )
    );

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return result.map(row => this.mapToEntity(row));
  }

  async getProjectStatistics(workspaceId: WorkspaceId): Promise<{
    total: number;
    byStatus: Record<ProjectStatus, number>;
    averageCompletionTime?: number;
    totalMembers: number;
    averageMembersPerProject: number;
  }> {
    const total = await this.count(workspaceId);

    // Get counts by status
    const statusCounts = await this.db
      .select({ status: projects.status, count: count() })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId.value))
      .groupBy(projects.status);

    const byStatus = statusCounts.reduce(
      (acc, row) => {
        acc[row.status as ProjectStatus] = row.count;
        return acc;
      },
      {} as Record<ProjectStatus, number>
    );

    // Get total members
    const memberResult = await this.db
      .select({ count: count() })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projects.workspaceId, workspaceId.value));
    const totalMembers = memberResult[0].count;

    const averageMembersPerProject = total > 0 ? totalMembers / total : 0;

    return {
      total,
      byStatus,
      totalMembers,
      averageMembersPerProject,
    };
  }

  async getProjectMembers(projectId: ProjectId): Promise<ProjectMember[]> {
    const result = await this.db
      .select()
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId.value));

    return result.map(row => this.mapToProjectMember(row));
  }

  async getProjectMember(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMember | null> {
    const result = await this.db
      .select()
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      )
      .limit(1);

    return result.length > 0 ? this.mapToProjectMember(result[0]) : null;
  }

  async addProjectMember(
    projectId: ProjectId,
    member: ProjectMember
  ): Promise<void> {
    await this.db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId: projectId.value,
      userId: member.userId.value,
      role: member.role,
      joinedAt: member.joinedAt,
    });
  }

  async removeProjectMember(
    projectId: ProjectId,
    userId: UserId
  ): Promise<void> {
    await this.db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      );
  }

  async updateProjectMemberRole(
    projectId: ProjectId,
    userId: UserId,
    newRole: string
  ): Promise<void> {
    await this.db
      .update(projectMembers)
      .set({ role: newRole as any })
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      );
  }

  async save(project: Project): Promise<void> {
    const data = this.mapFromEntity(project);

    await this.db
      .insert(projects)
      .values(data)
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: data.name,
          description: data.description,
          status: data.status,
          startDate: data.startDate,
          endDate: data.endDate,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(projectList: Project[]): Promise<void> {
    if (projectList.length === 0) return;

    const data = projectList.map(project => this.mapFromEntity(project));

    await this.db
      .insert(projects)
      .values(data)
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: ProjectId): Promise<void> {
    // Delete project members first
    await this.db
      .delete(projectMembers)
      .where(eq(projectMembers.projectId, id.value));

    // Delete project
    await this.db.delete(projects).where(eq(projects.id, id.value));
  }

  async deleteMany(ids: ProjectId[]): Promise<void> {
    const idValues = ids.map(id => id.value);

    // Delete project members first
    await this.db
      .delete(projectMembers)
      .where(inArray(projectMembers.projectId, idValues));

    // Delete projects
    await this.db.delete(projects).where(inArray(projects.id, idValues));
  }

  async exists(id: ProjectId): Promise<boolean> {
    const result = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async count(
    workspaceId?: WorkspaceId,
    filters?: ProjectFilters
  ): Promise<number> {
    let query = this.db.select({ count: count() }).from(projects);

    const conditions: any[] = [];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
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
  async getProjectAggregate(
    projectId: ProjectId
  ): Promise<ProjectAggregate | null> {
    return null;
  }

  async saveProjectAggregate(aggregate: ProjectAggregate): Promise<void> {
    // Complex implementation needed
  }

  async getProjectsByStatus(
    status: ProjectStatus,
    workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    const conditions: any[] = [eq(projects.status, status)];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return result.map(row => this.mapToEntity(row));
  }

  async getProjectsEndingSoon(
    days: number,
    workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const conditions: any[] = [
      lte(projects.endDate, futureDate),
      isNotNull(projects.endDate),
      inArray(projects.status, ['ACTIVE']),
    ];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return result.map(row => this.mapToEntity(row));
  }

  async getOverdueProjects(workspaceId?: WorkspaceId): Promise<Project[]> {
    const now = new Date();
    const conditions: any[] = [
      lte(projects.endDate, now),
      isNotNull(projects.endDate),
      inArray(projects.status, ['ACTIVE', 'ON_HOLD']),
    ];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return result.map(row => this.mapToEntity(row));
  }

  // Additional placeholder methods
  async getProjectCompletionHistory(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    return [];
  }
  async getUserProjectRoles(userId: UserId): Promise<any[]> {
    return [];
  }
  async getProjectHealthScores(
    workspaceId: WorkspaceId
  ): Promise<Map<string, number>> {
    return new Map();
  }
  async bulkUpdateStatus(
    projectIds: ProjectId[],
    status: ProjectStatus
  ): Promise<void> {
    const idValues = projectIds.map(id => id.value);
    await this.db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(inArray(projects.id, idValues));
  }
  async getProjectsReadyForArchival(
    workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    return [];
  }
  async getProjectActivitySummary(
    projectId: ProjectId,
    fromDate: Date,
    toDate: Date
  ): Promise<any> {
    return {};
  }
  async userHasAccessToProject(
    projectId: ProjectId,
    userId: UserId
  ): Promise<boolean> {
    const result = await this.db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      )
      .limit(1);

    return result.length > 0;
  }
  async getUserPermissionLevel(
    projectId: ProjectId,
    userId: UserId
  ): Promise<string | null> {
    const result = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      )
      .limit(1);

    return result.length > 0 ? result[0].role : null;
  }
  async getProjectsWithLowActivity(
    days: number,
    workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    return [];
  }

  private buildFilterConditions(filters: ProjectFilters): any[] {
    const conditions: any[] = [];

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(projects.status, filters.status));
    }

    if (filters.managerId) {
      conditions.push(eq(projects.managerId, filters.managerId.value));
    }

    if (filters.startDateFrom) {
      conditions.push(gte(projects.startDate, filters.startDateFrom));
    }

    if (filters.startDateTo) {
      conditions.push(lte(projects.startDate, filters.startDateTo));
    }

    if (filters.endDateFrom) {
      conditions.push(gte(projects.endDate, filters.endDateFrom));
    }

    if (filters.endDateTo) {
      conditions.push(lte(projects.endDate, filters.endDateTo));
    }

    if (filters.search) {
      conditions.push(
        or(
          like(projects.name, `%${filters.search}%`),
          like(projects.description, `%${filters.search}%`)
        )
      );
    }

    return conditions;
  }

  private mapToEntity(row: any): Project {
    // This would need to be implemented based on the actual Project entity structure
    return {} as Project;
  }

  private mapFromEntity(project: Project): any {
    // This would need to be implemented based on the actual Project entity structure
    return {
      id: '', // project.id.value,
      name: '', // project.name,
      description: '', // project.description,
      workspaceId: '', // project.workspaceId.value,
      managerId: '', // project.managerId.value,
      status: 'ACTIVE', // project.status.value,
      startDate: null, // project.startDate,
      endDate: null, // project.endDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapToProjectMember(row: any): ProjectMember {
    // This would need to be implemented based on the actual ProjectMember structure
    return {} as ProjectMember;
  }
}
