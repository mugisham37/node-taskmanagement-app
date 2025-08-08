import { SavedSearch } from '../entities/saved-search.entity';
import { SavedSearchRepository } from './saved-search.repository';
import { PrismaClient } from '@prisma/client';

export class PostgreSQLSavedSearchRepository implements SavedSearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(savedSearch: SavedSearch): Promise<SavedSearch> {
    const result = await this.prisma.savedSearch.create({
      data: {
        id: savedSearch.id,
        userId: savedSearch.userId,
        workspaceId: savedSearch.workspaceId,
        name: savedSearch.name,
        description: savedSearch.description,
        query: savedSearch.query,
        filters: savedSearch.filters,
        isShared: savedSearch.isShared,
        sharedWith: savedSearch.sharedWith,
        isDefault: savedSearch.isDefault,
        sortBy: savedSearch.sortBy,
        sortOrder: savedSearch.sortOrder,
        createdAt: savedSearch.createdAt,
        updatedAt: savedSearch.updatedAt,
      },
    });

    return this.toDomain(result);
  }

  async update(savedSearch: SavedSearch): Promise<SavedSearch> {
    const result = await this.prisma.savedSearch.update({
      where: { id: savedSearch.id },
      data: {
        name: savedSearch.name,
        description: savedSearch.description,
        query: savedSearch.query,
        filters: savedSearch.filters,
        isShared: savedSearch.isShared,
        sharedWith: savedSearch.sharedWith,
        isDefault: savedSearch.isDefault,
        sortBy: savedSearch.sortBy,
        sortOrder: savedSearch.sortOrder,
        updatedAt: savedSearch.updatedAt,
      },
    });

    return this.toDomain(result);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.savedSearch.delete({
      where: { id },
    });
  }

  async findById(id: string): Promise<SavedSearch | null> {
    const result = await this.prisma.savedSearch.findUnique({
      where: { id },
    });

    return result ? this.toDomain(result) : null;
  }

  async findByUserId(
    userId: string,
    workspaceId: string
  ): Promise<SavedSearch[]> {
    const results = await this.prisma.savedSearch.findMany({
      where: {
        userId,
        workspaceId,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return results.map(result => this.toDomain(result));
  }

  async findSharedInWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<SavedSearch[]> {
    const results = await this.prisma.savedSearch.findMany({
      where: {
        workspaceId,
        isShared: true,
        OR: [
          { sharedWith: { has: userId } },
          { sharedWith: { isEmpty: true } }, // Shared with everyone
        ],
        userId: { not: userId }, // Exclude user's own searches
      },
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  async findDefaultByUser(
    userId: string,
    workspaceId: string
  ): Promise<SavedSearch | null> {
    const result = await this.prisma.savedSearch.findFirst({
      where: {
        userId,
        workspaceId,
        isDefault: true,
      },
    });

    return result ? this.toDomain(result) : null;
  }

  async setAsDefault(
    id: string,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    await this.prisma.$transaction(async tx => {
      // Unset all other default searches for this user in this workspace
      await tx.savedSearch.updateMany({
        where: {
          userId,
          workspaceId,
          isDefault: true,
        },
        data: {
          isDefault: false,
          updatedAt: new Date(),
        },
      });

      // Set the specified search as default
      await tx.savedSearch.update({
        where: { id },
        data: {
          isDefault: true,
          updatedAt: new Date(),
        },
      });
    });
  }

  async findByNamePattern(
    pattern: string,
    workspaceId: string,
    userId: string
  ): Promise<SavedSearch[]> {
    const results = await this.prisma.savedSearch.findMany({
      where: {
        workspaceId,
        name: {
          contains: pattern,
          mode: 'insensitive',
        },
        OR: [
          { userId },
          {
            isShared: true,
            OR: [
              { sharedWith: { has: userId } },
              { sharedWith: { isEmpty: true } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  async hasAccess(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.savedSearch.findUnique({
      where: { id },
      select: {
        userId: true,
        isShared: true,
        sharedWith: true,
      },
    });

    if (!result) return false;

    // Owner has access
    if (result.userId === userId) return true;

    // Check if shared with user
    if (result.isShared) {
      // Shared with everyone
      if (result.sharedWith.length === 0) return true;

      // Shared with specific user
      if (result.sharedWith.includes(userId)) return true;
    }

    return false;
  }

  async getUsageStats(id: string): Promise<{
    usageCount: number;
    lastUsed: Date | null;
    sharedWithCount: number;
  }> {
    const [savedSearch, usageCount, lastUsage] = await Promise.all([
      this.prisma.savedSearch.findUnique({
        where: { id },
        select: { sharedWith: true },
      }),
      this.prisma.savedSearchUsage.count({
        where: { savedSearchId: id },
      }),
      this.prisma.savedSearchUsage.findFirst({
        where: { savedSearchId: id },
        orderBy: { usedAt: 'desc' },
        select: { usedAt: true },
      }),
    ]);

    return {
      usageCount,
      lastUsed: lastUsage?.usedAt || null,
      sharedWithCount: savedSearch?.sharedWith.length || 0,
    };
  }

  async recordUsage(id: string, userId: string): Promise<void> {
    await this.prisma.savedSearchUsage.create({
      data: {
        savedSearchId: id,
        userId,
        usedAt: new Date(),
      },
    });
  }

  async findMostUsed(workspaceId: string, limit = 10): Promise<SavedSearch[]> {
    const results = await this.prisma.savedSearch.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { usage: true },
        },
      },
      orderBy: {
        usage: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return results.map(result => this.toDomain(result));
  }

  async findRecentlyUsed(
    userId: string,
    workspaceId: string,
    limit = 10
  ): Promise<SavedSearch[]> {
    const recentUsage = await this.prisma.savedSearchUsage.findMany({
      where: {
        userId,
        savedSearch: { workspaceId },
      },
      include: { savedSearch: true },
      orderBy: { usedAt: 'desc' },
      take: limit,
      distinct: ['savedSearchId'],
    });

    return recentUsage.map(usage => this.toDomain(usage.savedSearch));
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.prisma.$transaction(async tx => {
      // Delete usage records first
      await tx.savedSearchUsage.deleteMany({
        where: {
          savedSearchId: { in: ids },
        },
      });

      // Delete saved searches
      await tx.savedSearch.deleteMany({
        where: {
          id: { in: ids },
        },
      });
    });
  }

  async findByQueryPattern(
    pattern: string,
    workspaceId: string
  ): Promise<SavedSearch[]> {
    const results = await this.prisma.savedSearch.findMany({
      where: {
        workspaceId,
        query: {
          contains: pattern,
          mode: 'insensitive',
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result => this.toDomain(result));
  }

  private toDomain(data: any): SavedSearch {
    return SavedSearch.create({
      id: data.id,
      userId: data.userId,
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description,
      query: data.query,
      filters: data.filters as Record<string, any>,
      isShared: data.isShared,
      sharedWith: data.sharedWith,
      isDefault: data.isDefault,
      sortBy: data.sortBy,
      sortOrder: data.sortOrder as 'asc' | 'desc',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
