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
import { workspaces, users, projects, projectMembers } from '../schema';
import {
  IWorkspaceRepository,
  WorkspaceFilters,
  WorkspaceSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/workspace-repository';
import { Workspace, WorkspaceMember } from '../../../domain/entities/workspace';
import {
  WorkspaceAggregate,
  ProjectSummary,
} from '../../../domain/aggregates/workspace-aggregate';
import { WorkspaceId, UserId, ProjectId } from '../../../domain/value-objects';

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
    const idValues = ids.map(id => id.value);
    const result = await this.db
      .select()
      .from(workspaces)
      .where(inArray(workspaces.id, idValues));

    return result.map(row => this.mapToEntity(row));
  }

  async findByOwnerId(
    ownerId: UserId,
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    let query = this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, ownerId.value));

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(
          and(eq(workspaces.ownerId, ownerId.value), ...conditions)
        );
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      // Note: memberCount and projectCount would need to be calculated via joins
      if (sort.field === 'memberCount' || sort.field === 'projectCount') {
        query = query.orderBy(desc(workspaces.createdAt)); // Fallback
      } else {
        query = query.orderBy(orderBy(workspaces[sort.field]));
      }
    } else {
      query = query.orderBy(desc(workspaces.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;
    const total = await this.count({ ownerId });

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
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    // This would require a workspace members table which isn't in our current schema
    // For now, return workspaces where user is owner or has projects
    let query = this.db
      .select()
      .from(workspaces)
      .leftJoin(projects, eq(workspaces.id, projects.workspaceId))
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(
        or(
          eq(workspaces.ownerId, userId.value),
          eq(projectMembers.userId, userId.value)
        )
      );

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;

    // Remove duplicates and map to entities
    const uniqueWorkspaces = new Map();
    result.forEach(row => {
      if (row.workspaces && !uniqueWorkspaces.has(row.workspaces.id)) {
        uniqueWorkspaces.set(
          row.workspaces.id,
          this.mapToEntity(row.workspaces)
        );
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
    let query = this.db.select().from(workspaces);

    // Apply filters
    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    // Apply sorting
    if (sort) {
      const orderBy = sort.direction === 'DESC' ? desc : asc;
      if (sort.field === 'memberCount' || sort.field === 'projectCount') {
        query = query.orderBy(desc(workspaces.createdAt)); // Fallback
      } else {
        query = query.orderBy(orderBy(workspaces[sort.field]));
      }
    } else {
      query = query.orderBy(desc(workspaces.createdAt));
    }

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.limit(pagination.limit).offset(offset);
    }

    const result = await query;
    const total = await this.count(filters);

    return {
      items: result.map(row => this.mapToEntity(row)),
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

    let query = this.db
      .select()
      .from(workspaces)
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
      .from(workspaces)
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

  async getActiveWorkspaces(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({ isActive: true }, undefined, pagination);
  }

  async getInactiveWorkspaces(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({ isActive: false }, undefined, pagination);
  }

  async getWorkspacesRequiringAttention(
    ownerId?: UserId
  ): Promise<Workspace[]> {
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

    return result.map(row => this.mapToEntity(row));
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
    const projectResult = await this.db
      .select({ count: count() })
      .from(projects);
    const totalProjects = projectResult[0].count;

    // Get total members (unique users across all projects)
    const memberResult = await this.db
      .select({ count: count() })
      .from(projectMembers);
    const totalMembers = memberResult[0].count;

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

  async getWorkspaceMembers(
    workspaceId: WorkspaceId
  ): Promise<WorkspaceMember[]> {
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
    result.forEach(row => {
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
      .where(
        and(
          eq(workspaces.id, workspaceId.value),
          eq(workspaces.ownerId, userId.value)
        )
      )
      .limit(1);

    if (ownerResult.length > 0) {
      return this.mapToWorkspaceMember({
        users: { id: userId.value },
        role: 'OWNER',
        joinedAt: ownerResult[0].createdAt,
      });
    }

    // Check if user is a project member
    const memberResult = await this.db
      .select()
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(
          eq(projects.workspaceId, workspaceId.value),
          eq(projectMembers.userId, userId.value)
        )
      )
      .limit(1);

    return memberResult.length > 0
      ? this.mapToWorkspaceMember(memberResult[0])
      : null;
  }

  async addWorkspaceMember(
    workspaceId: WorkspaceId,
    member: WorkspaceMember
  ): Promise<void> {
    // This would require a workspace members table
    // For now, this is a placeholder
  }

  async removeWorkspaceMember(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<void> {
    // This would require a workspace members table
    // For now, this is a placeholder
  }

  async updateWorkspaceMemberRole(
    workspaceId: WorkspaceId,
    userId: UserId,
    newRole: 'ADMIN' | 'MEMBER'
  ): Promise<void> {
    // This would require a workspace members table
    // For now, this is a placeholder
  }

  async getWorkspaceProjects(workspaceId: WorkspaceId): Promise<ProjectId[]> {
    const result = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId.value));

    return result.map(row => ProjectId.create(row.id));
  }

  async addWorkspaceProject(
    workspaceId: WorkspaceId,
    projectId: ProjectId
  ): Promise<void> {
    // Projects are already linked to workspaces via workspaceId
    // This method might not be needed or could update the project's workspace
    await this.db
      .update(projects)
      .set({ workspaceId: workspaceId.value })
      .where(eq(projects.id, projectId.value));
  }

  async removeWorkspaceProject(
    workspaceId: WorkspaceId,
    projectId: ProjectId
  ): Promise<void> {
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

    const data = workspaceList.map(workspace => this.mapFromEntity(workspace));

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
    const idValues = ids.map(id => id.value);

    // Delete all projects in these workspaces first
    await this.db
      .delete(projects)
      .where(inArray(projects.workspaceId, idValues));

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
    let query = this.db.select({ count: count() }).from(workspaces);

    if (filters) {
      const conditions = this.buildFilterConditions(filters);
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    const result = await query;
    return result[0].count;
  }

  // Placeholder implementations for complex methods
  async getWorkspaceAggregate(
    workspaceId: WorkspaceId
  ): Promise<WorkspaceAggregate | null> {
    return null;
  }
  async saveWorkspaceAggregate(aggregate: WorkspaceAggregate): Promise<void> {}
  async getWorkspaceActivitySummary(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<any> {
    return {};
  }
  async getWorkspaceHealthScores(): Promise<Map<string, number>> {
    return new Map();
  }
  async getWorkspaceCapacityAnalysis(workspaceId: WorkspaceId): Promise<any> {
    return {};
  }
  async getUserWorkspaceRoles(userId: UserId): Promise<any[]> {
    return [];
  }
  async userHasAccessToWorkspace(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<boolean> {
    // Check if user is owner
    const ownerResult = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId.value),
          eq(workspaces.ownerId, userId.value)
        )
      )
      .limit(1);

    if (ownerResult.length > 0) return true;

    // Check if user is a project member
    const memberResult = await this.db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, workspaceId.value),
          eq(projectMembers.userId, userId.value)
        )
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
      .where(
        and(
          eq(workspaces.id, workspaceId.value),
          eq(workspaces.ownerId, userId.value)
        )
      )
      .limit(1);

    if (ownerResult.length > 0) return 'OWNER';

    // Check if user is a project member
    const memberResult = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, workspaceId.value),
          eq(projectMembers.userId, userId.value)
        )
      )
      .limit(1);

    return memberResult.length > 0 ? 'MEMBER' : null;
  }
  async getWorkspacesWithLowActivity(
    days: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({}, undefined, pagination);
  }
  async getWorkspacesOverCapacity(
    capacityThreshold: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>> {
    return this.findWorkspaces({}, undefined, pagination);
  }
  async getWorkspaceMemberActivity(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<Map<string, Date>> {
    return new Map();
  }
  async getWorkspaceProjectSummaries(
    workspaceId: WorkspaceId
  ): Promise<ProjectSummary[]> {
    return [];
  }
  async updateWorkspaceProjectSummary(
    workspaceId: WorkspaceId,
    projectSummary: ProjectSummary
  ): Promise<void> {}
  async getWorkspaceGrowthMetrics(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<any> {
    return {};
  }
  async getWorkspacesReadyForArchival(
    inactiveDays: number
  ): Promise<Workspace[]> {
    return [];
  }
  async bulkUpdateStatus(
    workspaceIds: WorkspaceId[],
    isActive: boolean
  ): Promise<void> {
    const idValues = workspaceIds.map(id => id.value);
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
        and(
          eq(workspaces.id, workspaceId.value),
          eq(workspaces.ownerId, currentOwnerId.value)
        )
      );
  }
  async getWorkspaceCollaborationMetrics(
    workspaceId: WorkspaceId
  ): Promise<any> {
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
    // This would need to be implemented based on the actual Workspace entity structure
    return {} as Workspace;
  }

  private mapFromEntity(workspace: Workspace): any {
    // This would need to be implemented based on the actual Workspace entity structure
    return {
      id: '', // workspace.id.value,
      name: '', // workspace.name,
      description: '', // workspace.description,
      ownerId: '', // workspace.ownerId.value,
      isActive: true, // workspace.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapToWorkspaceMember(row: any): WorkspaceMember {
    // This would need to be implemented based on the actual WorkspaceMember structure
    return {} as WorkspaceMember;
  }
}
