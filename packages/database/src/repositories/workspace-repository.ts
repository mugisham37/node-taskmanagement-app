import {
  ProjectId,
  ProjectSummary,
  UserId,
  Workspace,
  WorkspaceAggregate,
  WorkspaceId,
  WorkspaceMember,
} from '@monorepo/domain';
import {
  IWorkspaceRepository,
  PaginatedResult,
  PaginationOptions,
  WorkspaceFilters,
  WorkspaceSortOptions,
} from '@taskmanagement/domain';
import { and, asc, count, desc, eq, gte, inArray, like, lte, or } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { projectMembers, projects, users, workspaces } from '../schema';

export class WorkspaceRepository implements IWorkspaceRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const result = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id.value))
      .limit(1);

    return result.length > 0 ? this.mapToEntity(result[0]) : null;
  }

  async findByIds(ids: WorkspaceId[]): Promise<Workspace[]> {
    const idValues = ids.map((id) => id.value);
    const result = await this.db.select().from(workspaces).where(inArray(workspaces.id, idValues));

    return result.map((row) => this.mapToEntity(row));
  }

  async findByOwnerId(
    ownerId: UserId,
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    // Build conditions array
    const conditions = [eq(workspaces.ownerId, ownerId.value)];

    // Apply filters
    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    // Build order by clause
    const orderDirection = sort?.direction === 'DESC' ? desc : asc;
    let orderByClause;
    if (
      sort &&
      (sort.field === 'name' || sort.field === 'createdAt' || sort.field === 'updatedAt')
    ) {
      orderByClause = orderDirection(workspaces[sort.field]);
    } else {
      orderByClause = desc(workspaces.createdAt);
    }

    // Build complete query in one go
    let finalQuery;
    const baseQuery = this.db.select().from(workspaces);

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      finalQuery = baseQuery
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(pagination.limit)
        .offset(offset);
    } else {
      finalQuery = baseQuery.where(and(...conditions)).orderBy(orderByClause);
    }

    const result = await finalQuery;
    const total = await this.count({ ownerId });

    return {
      items: result.map((row) => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findByMemberId(
    userId: UserId,
    _filters?: WorkspaceFilters,
    _sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    // This would require a workspace members table which isn't in our current schema
    // For now, return workspaces where user is owner or has projects

    // Build conditions for member search
    const memberConditions = or(
      eq(workspaces.ownerId, userId.value),
      eq(projectMembers.userId, userId.value)
    );

    // Build complete query in one go
    let finalQuery;
    const baseQuery = this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        ownerId: workspaces.ownerId,
        isActive: workspaces.isActive,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaces)
      .leftJoin(projects, eq(workspaces.id, projects.workspaceId))
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId));

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      finalQuery = baseQuery
        .where(memberConditions)
        .orderBy(desc(workspaces.createdAt))
        .limit(pagination.limit)
        .offset(offset);
    } else {
      finalQuery = baseQuery.where(memberConditions).orderBy(desc(workspaces.createdAt));
    }

    const result = await finalQuery;

    // Remove duplicates and map to entities
    const uniqueWorkspaces = new Map();
    result.forEach((row) => {
      if (row && !uniqueWorkspaces.has(row.id)) {
        uniqueWorkspaces.set(row.id, this.mapToEntity(row));
      }
    });

    const items = Array.from(uniqueWorkspaces.values());
    const total = items.length;

    return {
      items,
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || items.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async findWorkspaces(
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    // Build conditions
    const conditions: any[] = [];
    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    // Build order by clause
    const orderDirection = sort?.direction === 'DESC' ? desc : asc;
    let orderByClause;
    if (
      sort &&
      (sort.field === 'name' || sort.field === 'createdAt' || sort.field === 'updatedAt')
    ) {
      orderByClause = orderDirection(workspaces[sort.field]);
    } else {
      orderByClause = desc(workspaces.createdAt);
    }

    // Build complete query in one go
    let finalQuery;
    const baseQuery = this.db.select().from(workspaces);

    if (conditions.length > 0) {
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(orderByClause)
          .limit(pagination.limit)
          .offset(offset);
      } else {
        finalQuery = baseQuery.where(and(...conditions)).orderBy(orderByClause);
      }
    } else {
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        finalQuery = baseQuery.orderBy(orderByClause).limit(pagination.limit).offset(offset);
      } else {
        finalQuery = baseQuery.orderBy(orderByClause);
      }
    }

    const result = await finalQuery;
    const total = await this.count(filters);

    return {
      items: result.map((row) => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async searchWorkspaces(
    searchTerm: string,
    filters?: WorkspaceFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    const searchCondition = or(
      like(workspaces.name, `%${searchTerm}%`),
      like(workspaces.description, `%${searchTerm}%`)
    );

    const conditions: any[] = [searchCondition];

    if (filters) {
      const filterConditions = this.buildFilterConditions(filters);
      conditions.push(...filterConditions);
    }

    // Build complete query in one go
    let finalQuery;
    const baseQuery = this.db.select().from(workspaces);

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      finalQuery = baseQuery
        .where(and(...conditions))
        .orderBy(desc(workspaces.createdAt))
        .limit(pagination.limit)
        .offset(offset);
    } else {
      finalQuery = baseQuery.where(and(...conditions)).orderBy(desc(workspaces.createdAt));
    }

    const result = await finalQuery;

    // Count total
    const totalResult = await this.db
      .select({ count: count() })
      .from(workspaces)
      .where(and(...conditions));

    const total = totalResult?.[0]?.count || 0;

    return {
      items: result.map((row) => this.mapToEntity(row)),
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || result.length,
      totalPages: pagination ? Math.ceil(total / pagination.limit) : 1,
    };
  }

  async getActiveWorkspaces(pagination?: PaginationOptions): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({ isActive: true }, undefined, pagination);
  }

  async getInactiveWorkspaces(pagination?: PaginationOptions): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({ isActive: false }, undefined, pagination);
  }

  async getWorkspacesRequiringAttention(ownerId?: UserId): Promise<Workspace[]> {
    const conditions: any[] = [eq(workspaces.isActive, true)];

    if (ownerId) {
      conditions.push(eq(workspaces.ownerId, ownerId.value));
    }

    // For now, just return active workspaces
    // In a real implementation, this would include more complex logic
    const result = await this.db
      .select()
      .from(workspaces)
      .where(and(...conditions));

    return result.map((row) => this.mapToEntity(row));
  }

  async getWorkspaceStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalMembers: number;
    totalProjects: number;
    averageMembersPerWorkspace: number;
    averageProjectsPerWorkspace: number;
  }> {
    const total = await this.count();
    const active = await this.count({ isActive: true });
    const inactive = await this.count({ isActive: false });

    // Get total projects
    const projectResult = await this.db.select({ count: count() }).from(projects);
    const totalProjects = projectResult?.[0]?.count || 0;

    // Get total members (unique users across all projects)
    const memberResult = await this.db.select({ count: count() }).from(projectMembers);
    const totalMembers = memberResult?.[0]?.count || 0;

    return {
      total,
      active,
      inactive,
      totalMembers,
      totalProjects,
      averageMembersPerWorkspace: total > 0 ? totalMembers / total : 0,
      averageProjectsPerWorkspace: total > 0 ? totalProjects / total : 0,
    };
  }

  async getWorkspaceMembers(workspaceId: WorkspaceId): Promise<WorkspaceMember[]> {
    // This would require a workspace members table
    // For now, return members from all projects in the workspace
    const result = await this.db
      .select()
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projects.workspaceId, workspaceId.value));

    // Remove duplicates and map to workspace members
    const uniqueMembers = new Map();
    result.forEach((row) => {
      if (!uniqueMembers.has(row.users.id)) {
        uniqueMembers.set(row.users.id, this.mapToWorkspaceMember(row));
      }
    });

    return Array.from(uniqueMembers.values());
  }

  async getWorkspaceMember(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<WorkspaceMember | null> {
    // Check if user is owner
    const ownerResult = await this.db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId.value), eq(workspaces.ownerId, userId.value)))
      .limit(1);

    if (ownerResult.length > 0) {
      return this.mapToWorkspaceMember({
        users: { id: userId.value },
        role: 'OWNER',
        joinedAt: ownerResult[0]?.createdAt || new Date(),
      });
    }

    // Check if user is a project member
    const memberResult = await this.db
      .select()
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(eq(projects.workspaceId, workspaceId.value), eq(projectMembers.userId, userId.value))
      )
      .limit(1);

    return memberResult.length > 0 ? this.mapToWorkspaceMember(memberResult[0]) : null;
  }

  async addWorkspaceMember(_workspaceId: WorkspaceId, _member: WorkspaceMember): Promise<void> {
    // This would require a workspace members table
    // For now, this is a placeholder implementation
    // In a real system, you would insert into a workspace_members table
  }

  async removeWorkspaceMember(_workspaceId: WorkspaceId, _userId: UserId): Promise<void> {
    // This would require a workspace members table
    // For now, this is a placeholder implementation
    // In a real system, you would delete from a workspace_members table
  }

  async updateWorkspaceMemberRole(
    _workspaceId: WorkspaceId,
    _userId: UserId,
    _newRole: 'ADMIN' | 'MEMBER'
  ): Promise<void> {
    // This would require a workspace members table
    // For now, this is a placeholder implementation
    // In a real system, you would update the role in a workspace_members table
  }

  async getWorkspaceProjects(workspaceId: WorkspaceId): Promise<ProjectId[]> {
    const result = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId.value));

    return result.map((row) => ProjectId.create(row.id));
  }

  async addWorkspaceProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
    // Projects are already linked to workspaces via workspaceId
    // This method might not be needed or could update the project's workspace
    await this.db
      .update(projects)
      .set({ workspaceId: workspaceId.value })
      .where(eq(projects.id, projectId.value));
  }

  async removeWorkspaceProject(_workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
    // This could archive the project or move it to a different workspace
    // For now, we'll just delete it
    await this.db.delete(projects).where(eq(projects.id, projectId.value));
  }

  async save(workspace: Workspace): Promise<void> {
    const data = this.mapFromEntity(workspace);

    await this.db
      .insert(workspaces)
      .values(data)
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(workspaceList: Workspace[]): Promise<void> {
    if (workspaceList.length === 0) return;

    const data = workspaceList.map((workspace) => this.mapFromEntity(workspace));

    await this.db
      .insert(workspaces)
      .values(data)
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: WorkspaceId): Promise<void> {
    // Delete all projects in the workspace first
    await this.db.delete(projects).where(eq(projects.workspaceId, id.value));

    // Delete workspace
    await this.db.delete(workspaces).where(eq(workspaces.id, id.value));
  }

  async deleteMany(ids: WorkspaceId[]): Promise<void> {
    const idValues = ids.map((id) => id.value);

    // Delete all projects in these workspaces first
    await this.db.delete(projects).where(inArray(projects.workspaceId, idValues));

    // Delete workspaces
    await this.db.delete(workspaces).where(inArray(workspaces.id, idValues));
  }

  async exists(id: WorkspaceId): Promise<boolean> {
    const result = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async count(filters?: WorkspaceFilters): Promise<number> {
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        const result = await this.db
          .select({ count: count() })
          .from(workspaces)
          .where(and(...conditions));
        return result?.[0]?.count || 0;
      }
    }

    const result = await this.db.select({ count: count() }).from(workspaces);
    return result?.[0]?.count || 0;
  }

  // Placeholder implementations for complex methods
  async getWorkspaceAggregate(_workspaceId: WorkspaceId): Promise<WorkspaceAggregate | null> {
    return null;
  }

  async saveWorkspaceAggregate(_aggregate: WorkspaceAggregate): Promise<void> {
    // Implementation placeholder
  }

  async getWorkspaceActivitySummary(
    _workspaceId: WorkspaceId,
    _fromDate: Date,
    _toDate: Date
  ): Promise<any> {
    return {};
  }

  async getWorkspaceHealthScores(): Promise<Map<string, number>> {
    return new Map();
  }

  async getWorkspaceCapacityAnalysis(_workspaceId: WorkspaceId): Promise<any> {
    return {};
  }

  async getUserWorkspaceRoles(_userId: UserId): Promise<any[]> {
    return [];
  }

  async userHasAccessToWorkspace(workspaceId: WorkspaceId, userId: UserId): Promise<boolean> {
    // Check if user is owner
    const ownerResult = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId.value), eq(workspaces.ownerId, userId.value)))
      .limit(1);

    if (ownerResult.length > 0) return true;

    // Check if user is a project member
    const memberResult = await this.db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(eq(projects.workspaceId, workspaceId.value), eq(projectMembers.userId, userId.value))
      )
      .limit(1);

    return memberResult.length > 0;
  }

  async getUserPermissionLevel(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<'OWNER' | 'ADMIN' | 'MEMBER' | null> {
    // Check if user is owner
    const ownerResult = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId.value), eq(workspaces.ownerId, userId.value)))
      .limit(1);

    if (ownerResult.length > 0) return 'OWNER';

    // Check if user is a project member
    const memberResult = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(eq(projects.workspaceId, workspaceId.value), eq(projectMembers.userId, userId.value))
      )
      .limit(1);

    return memberResult.length > 0 ? 'MEMBER' : null;
  }

  async getWorkspacesWithLowActivity(
    _days: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({}, undefined, pagination);
  }

  async getWorkspacesOverCapacity(
    _capacityThreshold: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({}, undefined, pagination);
  }

  async getWorkspaceMemberActivity(
    _workspaceId: WorkspaceId,
    _fromDate: Date,
    _toDate: Date
  ): Promise<Map<string, Date>> {
    return new Map();
  }

  async getWorkspaceProjectSummaries(_workspaceId: WorkspaceId): Promise<ProjectSummary[]> {
    return [];
  }

  async updateWorkspaceProjectSummary(
    _workspaceId: WorkspaceId,
    _projectSummary: ProjectSummary
  ): Promise<void> {
    // Implementation placeholder
  }

  async getWorkspaceGrowthMetrics(
    _workspaceId: WorkspaceId,
    _fromDate: Date,
    _toDate: Date
  ): Promise<any> {
    return {};
  }

  async getWorkspacesReadyForArchival(_inactiveDays: number): Promise<Workspace[]> {
    return [];
  }

  async bulkUpdateStatus(workspaceIds: WorkspaceId[], isActive: boolean): Promise<void> {
    const idValues = workspaceIds.map((id) => id.value);
    await this.db
      .update(workspaces)
      .set({ isActive, updatedAt: new Date() })
      .where(inArray(workspaces.id, idValues));
  }

  async transferOwnership(
    workspaceId: WorkspaceId,
    currentOwnerId: UserId,
    newOwnerId: UserId
  ): Promise<void> {
    await this.db
      .update(workspaces)
      .set({ ownerId: newOwnerId.value, updatedAt: new Date() })
      .where(
        and(eq(workspaces.id, workspaceId.value), eq(workspaces.ownerId, currentOwnerId.value))
      );
  }

  async getWorkspaceCollaborationMetrics(_workspaceId: WorkspaceId): Promise<any> {
    return {};
  }

  private buildFilterConditions(filters: WorkspaceFilters): any[] {
    const conditions: any[] = [];

    if (filters.ownerId) {
      conditions.push(eq(workspaces.ownerId, filters.ownerId.value));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(workspaces.isActive, filters.isActive));
    }

    if (filters.search) {
      conditions.push(
        or(
          like(workspaces.name, `%${filters.search}%`),
          like(workspaces.description, `%${filters.search}%`)
        )
      );
    }

    if (filters.createdAfter) {
      conditions.push(gte(workspaces.createdAt, filters.createdAfter));
    }

    if (filters.createdBefore) {
      conditions.push(lte(workspaces.createdAt, filters.createdBefore));
    }

    return conditions;
  }

  private mapToEntity(row: any): Workspace {
    // Create a proper workspace entity from database row
    const workspaceId = WorkspaceId.create(row.id);
    const ownerId = UserId.create(row.ownerId);

    const workspace = new Workspace(
      workspaceId,
      row.name,
      row.description || '',
      ownerId,
      row.isActive,
      row.createdAt,
      row.updatedAt
    );

    return workspace;
  }

  private mapFromEntity(workspace: Workspace): any {
    // Map workspace entity to database format
    return {
      id: workspace.id.value,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId.value,
      isActive: workspace.isActive,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  private mapToWorkspaceMember(row: any): WorkspaceMember {
    // Map database row to workspace member
    return {
      userId: UserId.create(row.users?.id || row.userId),
      role: row.role || 'MEMBER',
      joinedAt: row.joinedAt || new Date(),
    };
  }
}
