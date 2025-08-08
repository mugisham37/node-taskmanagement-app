import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { projects, Project, NewProject } from '../schema/projects';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class ProjectRepository extends BaseRepository<Project, NewProject> {
  protected table = projects;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'project' }, // Enable caching for projects
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Project-specific methods
  async findByOwner(ownerId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Project>> {
    try {
      return await this.findMany({
        where: eq(projects.ownerId, ownerId),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findByOwner');
    }
  }

  async findActiveProjects(options: PaginationOptions = {}): Promise<PaginatedResult<Project>> {
    try {
      return await this.findMany({
        where: eq(projects.isArchived, false),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findActiveProjects');
    }
  }

  async findArchivedProjects(options: PaginationOptions = {}): Promise<PaginatedResult<Project>> {
    try {
      return await this.findMany({
        where: eq(projects.isArchived, true),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findArchivedProjects');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Project>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(projects.name, searchPattern),
        ilike(projects.description, searchPattern)
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

  async updateColor(projectId: string, color: string): Promise<Project | null> {
    try {
      // Validate color format (hex color)
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invalid color format. Must be a hex color (e.g., #FF0000)');
      }

      return await this.update(projectId, { color } as any);
    } catch (error) {
      throw this.handleError(error, 'updateColor');
    }
  }

  async archiveProject(projectId: string): Promise<Project | null> {
    try {
      return await this.update(projectId, { 
        isArchived: true
      } as any);
    } catch (error) {
      throw this.handleError(error, 'archiveProject');
    }
  }

  async unarchiveProject(projectId: string): Promise<Project | null> {
    try {
      return await this.update(projectId, { 
        isArchived: false
      } as any);
    } catch (error) {
      throw this.handleError(error, 'unarchiveProject');
    }
  }

  async getProjectStats(ownerId?: string): Promise<{
    total: number;
    active: number;
    archived: number;
  }> {
    try {
      const baseWhere = ownerId ? eq(projects.ownerId, ownerId) : undefined;

      const [
        total,
        active,
        archived
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(projects.isArchived, false)) : eq(projects.isArchived, false)
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(projects.isArchived, true)) : eq(projects.isArchived, true)
        })
      ]);

      return {
        total,
        active,
        archived
      };
    } catch (error) {
      throw this.handleError(error, 'getProjectStats');
    }
  }

  async bulkArchive(projectIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(projectIds, { isArchived: true } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkArchive');
    }
  }

  async bulkUnarchive(projectIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(projectIds, { isArchived: false } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkUnarchive');
    }
  }

  async findRecentProjects(days: number = 30, options: PaginationOptions = {}): Promise<PaginatedResult<Project>> {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      return await this.findMany({
        where: eq(projects.isArchived, false),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentProjects');
    }
  }

  async findProjectsByColor(color: string, options: PaginationOptions = {}): Promise<PaginatedResult<Project>> {
    try {
      return await this.findMany({
        where: eq(projects.color, color),
        ...options
      });
    } catch (error) {
      throw this.handleError(error, 'findProjectsByColor');
    }
  }

  async getProjectsByOwnerStats(ownerId: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    archivedProjects: number;
    recentProjects: number;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalProjects,
        activeProjects,
        archivedProjects
      ] = await Promise.all([
        this.count({ where: eq(projects.ownerId, ownerId) }),
        this.count({ 
          where: and(
            eq(projects.ownerId, ownerId),
            eq(projects.isArchived, false)
          )
        }),
        this.count({ 
          where: and(
            eq(projects.ownerId, ownerId),
            eq(projects.isArchived, true)
          )
        })
      ]);

      // For recent projects, we'd need proper date comparison
      const recentProjects = 0; // Placeholder

      return {
        totalProjects,
        activeProjects,
        archivedProjects,
        recentProjects
      };
    } catch (error) {
      throw this.handleError(error, 'getProjectsByOwnerStats');
    }
  }

  async transferOwnership(projectId: string, newOwnerId: string): Promise<Project | null> {
    try {
      return await this.update(projectId, { 
        ownerId: newOwnerId
      } as any);
    } catch (error) {
      throw this.handleError(error, 'transferOwnership');
    }
  }

  async duplicateProject(projectId: string, newName?: string): Promise<Project | null> {
    try {
      const originalProject = await this.findById(projectId);
      if (!originalProject) {
        throw new RepositoryException('NOT_FOUND', 'Project not found');
      }

      const duplicateData: NewProject = {
        name: newName || `${originalProject.name} (Copy)`,
        description: originalProject.description,
        color: originalProject.color,
        ownerId: originalProject.ownerId,
        isArchived: false
      };

      return await this.create(duplicateData);
    } catch (error) {
      throw this.handleError(error, 'duplicateProject');
    }
  }

  // Override create to add validation
  async create(data: NewProject): Promise<Project> {
    try {
      // Validate color format if provided
      if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invalid color format. Must be a hex color (e.g., #FF0000)');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }
}

// Export singleton instance
export const projectRepository = new ProjectRepository();
