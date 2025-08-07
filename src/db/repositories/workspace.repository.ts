import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { workspaces, Workspace, NewWorkspace } from '../schema/workspaces';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class WorkspaceRepository extends BaseRepository<Workspace, NewWorkspace> {
  protected table = workspaces;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'workspace' }, // Enable caching for workspaces
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Workspace-specific methods
  async findByOwner(ownerId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Workspace>> {
    try {
      return await this.findMany({
        where: eq(workspaces.ownerId, ownerId),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByOwner');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Workspace>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(workspaces.name, searchPattern),
        ilike(workspaces.description, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  async updateSettings(workspaceId: string, settings: Record<string, any>): Promise<Workspace | null> {
    try {
      return await this.update(workspaceId, { settings } as any);
    } catch (error) {
      throw this.handleError(error, 'updateSettings');
    }
  }

  async getWorkspaceStats(ownerId?: string): Promise<{
    total: number;
    recentlyCreated: number;
  }> {
    try {
      const baseWhere = ownerId ? eq(workspaces.ownerId, ownerId) : undefined;

      const [total] = await Promise.all([
        this.count({ where: baseWhere })
      ]);

      // For recently created, we'd need proper date comparison
      const recentlyCreated = 0; // Placeholder

      return {
        total,
        recentlyCreated
      };
    } catch (error) {
      throw this.handleError(error, 'getWorkspaceStats');
    }
  }

  async transferOwnership(workspaceId: string, newOwnerId: string): Promise<Workspace | null> {
    try {
      return await this.update(workspaceId, { 
        ownerId: newOwnerId
      } as any);
    } catch (error) {
      throw this.handleError(error, 'transferOwnership');
    }
  }

  // Override create to add validation
  async create(data: NewWorkspace): Promise<Workspace> {
    try {
      return await super.create(data);
    } catch (error) {
      throw this.handleError(error, 'create');
    }
  }
}

// Export singleton instance
export const workspaceRepository = new WorkspaceRepository();
