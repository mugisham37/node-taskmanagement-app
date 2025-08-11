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
  isNotNull,
} from 'drizzle-orm';
import { getDatabase } from '../connection';
import { projects, users, projectMembers } from '../schema';
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
import { ProjectStatus } from '../../../shared/enums/common.enums';
import { 
  DbProjectStatus,
  DbProjectRole
} from '../types';
import {
  mapRowToProject,
  mapProjectToInsert,
  mapRowToProjectMember,
  mapProjectMemberToInsert,
  mapDomainStatusToDb
} from '../mappers/project-mapper';

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

    if (result.length === 0) return null;

    const members = await this.getProjectMembers(id);
    return mapRowToProject(result[0]!, members);
  }

  async findByIds(ids: ProjectId[]): Promise<Project[]> {
    const idValues = ids.map(id => id.value);
    const result = await this.db
      .select()
      .from(projects)
      .where(inArray(projects.id, idValues));

    const projectsWithMembers = await Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );

    return projectsWithMembers;
  }

  async findByWorkspaceId(
    workspaceId: WorkspaceId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    const conditions = [eq(projects.workspaceId, workspaceId.value)];
    
    // Apply filters
    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    // Count total first
    const total = await this.countWithConditions(conditions);

    // Build the query with all clauses at once
    const baseQuery = this.db.select().from(projects);
    
    let finalQuery;
    
    if (sort?.field) {
      const orderFn = sort.direction === 'DESC' ? desc : asc;
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(orderFn(projects[sort.field]))
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(orderFn(projects[sort.field]));
      }
    } else {
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(desc(projects.createdAt))
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(desc(projects.createdAt));
      }
    }

    const result = await finalQuery;

    // Load members for each project
    const projectsWithMembers = await Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );

    return {
      items: projectsWithMembers,
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
    const baseConditions = [eq(projectMembers.userId, userId.value)];

    // Apply filters
    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      baseConditions.push(...filterConditions);
    }

    // Count total first
    const totalResult = await this.db
      .select({ count: count() })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(and(...baseConditions));
    
    const total = totalResult[0]?.count ?? 0;

    // Build query with join - construct the complete query at once
    const baseQuery = this.db
      .select({ projects })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId));

    let finalQuery;
    
    if (sort?.field) {
      const orderFn = sort.direction === 'DESC' ? desc : asc;
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...baseConditions))
          .orderBy(orderFn(projects[sort.field]))
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .where(and(...baseConditions))
          .orderBy(orderFn(projects[sort.field]));
      }
    } else {
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...baseConditions))
          .orderBy(desc(projects.createdAt))
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .where(and(...baseConditions))
          .orderBy(desc(projects.createdAt));
      }
    }

    const result = await finalQuery;

    // Load members for each project
    const projectsWithMembers = await Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.projects.id));
        return mapRowToProject(row.projects, members);
      })
    );

    return {
      items: projectsWithMembers,
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
    const conditions = [eq(projects.managerId, managerId.value)];

    // Apply filters
    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    // Count total first
    const total = await this.countWithConditions(conditions);

    // Build query - construct the complete query at once
    const baseQuery = this.db.select().from(projects);
    
    let finalQuery;
    
    if (sort?.field) {
      const orderFn = sort.direction === 'DESC' ? desc : asc;
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(orderFn(projects[sort.field]))
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(orderFn(projects[sort.field]));
      }
    } else {
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(desc(projects.createdAt))
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(desc(projects.createdAt));
      }
    }

    const result = await finalQuery;

    // Load members for each project
    const projectsWithMembers = await Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );

    return {
      items: projectsWithMembers,
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

    // Count total first
    const total = await this.countWithConditions(conditions);

    // Build query - construct the complete query at once
    const baseQuery = this.db.select().from(projects);
    
    let finalQuery;
    
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      finalQuery = baseQuery
        .where(and(...conditions))
        .limit(pagination.limit)
        .offset(offset);
    } else {
      finalQuery = baseQuery.where(and(...conditions));
    }

    const result = await finalQuery;

    // Load members for each project
    const projectsWithMembers = await Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );

    return {
      items: projectsWithMembers,
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
          eq(projects.status, 'ACTIVE' as DbProjectStatus)
        )
      );

    return Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );
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
        inArray(projects.status, ['ACTIVE', 'ON_HOLD'] as DbProjectStatus[])
      )
    );

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );
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
    
    const totalMembers = memberResult[0]?.count ?? 0;
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
      .select({
        project_members: projectMembers,
        users: {
          id: users.id,
          email: users.email,
          name: users.name,
        }
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId.value));

    return result.map(row => mapRowToProjectMember(row));
  }

  async getProjectMember(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMember | null> {
    const result = await this.db
      .select({
        project_members: projectMembers,
        users: {
          id: users.id,
          email: users.email,
          name: users.name,
        }
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      )
      .limit(1);

    return result.length > 0 ? mapRowToProjectMember(result[0]!) : null;
  }

  async addProjectMember(
    projectId: ProjectId,
    member: ProjectMember
  ): Promise<void> {
    const insertData = mapProjectMemberToInsert(projectId.value, member);
    await this.db.insert(projectMembers).values({
      ...insertData,
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
      .set({ role: newRole as DbProjectRole })
      .where(
        and(
          eq(projectMembers.projectId, projectId.value),
          eq(projectMembers.userId, userId.value)
        )
      );
  }

  async save(project: Project): Promise<void> {
    const data = mapProjectToInsert(project);

    await this.db
      .insert(projects)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
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

    const data = projectList.map(project => ({
      ...mapProjectToInsert(project),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

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
    const conditions: any[] = [];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    return this.countWithConditions(conditions);
  }

  private async countWithConditions(conditions: any[]): Promise<number> {
    if (conditions.length === 0) {
      const result = await this.db.select({ count: count() }).from(projects);
      return result[0]?.count ?? 0;
    }

    const result = await this.db
      .select({ count: count() })
      .from(projects)
      .where(and(...conditions));
    
    return result[0]?.count ?? 0;
  }

  // Placeholder implementations for complex methods
  async getProjectAggregate(
    _projectId: ProjectId
  ): Promise<ProjectAggregate | null> {
    // TODO: Implement project aggregate loading
    return null;
  }

  async saveProjectAggregate(_aggregate: ProjectAggregate): Promise<void> {
    // TODO: Implement project aggregate saving
    // This would involve saving the project and all its related entities atomically
  }

  async getProjectsByStatus(
    status: ProjectStatus,
    workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    const conditions: any[] = [eq(projects.status, mapDomainStatusToDb(status))];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );
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
      eq(projects.status, 'ACTIVE' as DbProjectStatus),
    ];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );
  }

  async getOverdueProjects(workspaceId?: WorkspaceId): Promise<Project[]> {
    const now = new Date();
    const conditions: any[] = [
      lte(projects.endDate, now),
      isNotNull(projects.endDate),
      inArray(projects.status, ['ACTIVE', 'ON_HOLD'] as DbProjectStatus[]),
    ];

    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId.value));
    }

    const result = await this.db
      .select()
      .from(projects)
      .where(and(...conditions));

    return Promise.all(
      result.map(async row => {
        const members = await this.getProjectMembers(ProjectId.create(row.id));
        return mapRowToProject(row, members);
      })
    );
  }

  // Additional placeholder methods
  async getProjectCompletionHistory(
    _workspaceId: WorkspaceId,
    _fromDate: Date,
    _toDate: Date
  ): Promise<any[]> {
    // TODO: Implement project completion history
    return [];
  }
  
  async getUserProjectRoles(_userId: UserId): Promise<any[]> {
    // TODO: Implement user project roles retrieval
    return [];
  }
  
  async getProjectHealthScores(
    _workspaceId: WorkspaceId
  ): Promise<Map<string, number>> {
    // TODO: Implement project health scoring
    return new Map();
  }
  
  async bulkUpdateStatus(
    projectIds: ProjectId[],
    status: ProjectStatus
  ): Promise<void> {
    const idValues = projectIds.map(id => id.value);
    await this.db
      .update(projects)
      .set({ status: mapDomainStatusToDb(status), updatedAt: new Date() })
      .where(inArray(projects.id, idValues));
  }
  
  async getProjectsReadyForArchival(
    _workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    // TODO: Implement logic to find projects ready for archival
    return [];
  }
  
  async getProjectActivitySummary(
    _projectId: ProjectId,
    _fromDate: Date,
    _toDate: Date
  ): Promise<any> {
    // TODO: Implement project activity summary
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

    return result.length > 0 ? result[0]?.role || null : null;
  }
  
  async getProjectsWithLowActivity(
    _days: number,
    _workspaceId?: WorkspaceId
  ): Promise<Project[]> {
    // TODO: Implement logic to find projects with low activity
    return [];
  }

  private buildFilterConditions(filters: ProjectFilters): any[] {
    const conditions: any[] = [];

    if (filters.status && filters.status.length > 0) {
      const dbStatuses = filters.status.map(status => mapDomainStatusToDb(status));
      conditions.push(inArray(projects.status, dbStatuses));
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
}
