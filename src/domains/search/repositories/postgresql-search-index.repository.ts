import { SearchIndex } from '../entities/search-index.entity';
import { SearchIndexRepository } from './search-index.repository';
import { SearchQuery } from '../value-objects/search-query.vo';
import {
  SearchResult,
  SearchResultItem,
} from '../value-objects/search-result.vo';
import { PrismaClient } from '@prisma/client';

export class PostgreSQLSearchIndexRepository implements SearchIndexRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async index(searchIndex: SearchIndex): Promise<void> {
    await this.prisma.searchIndex.create({
      data: {
        id: searchIndex.id,
        entityType: searchIndex.entityType,
        entityId: searchIndex.entityId,
        workspaceId: searchIndex.workspaceId,
        title: searchIndex.title,
        content: searchIndex.content,
        metadata: searchIndex.metadata,
        tags: searchIndex.tags,
        permissions: searchIndex.permissions,
        searchVector: this.generateSearchVector(
          searchIndex.title,
          searchIndex.content
        ),
        createdAt: searchIndex.createdAt,
        updatedAt: searchIndex.updatedAt,
      },
    });
  }

  async update(searchIndex: SearchIndex): Promise<void> {
    await this.prisma.searchIndex.update({
      where: { id: searchIndex.id },
      data: {
        title: searchIndex.title,
        content: searchIndex.content,
        metadata: searchIndex.metadata,
        tags: searchIndex.tags,
        permissions: searchIndex.permissions,
        searchVector: this.generateSearchVector(
          searchIndex.title,
          searchIndex.content
        ),
        updatedAt: searchIndex.updatedAt,
      },
    });
  }

  async remove(entityType: string, entityId: string): Promise<void> {
    await this.prisma.searchIndex.deleteMany({
      where: {
        entityType,
        entityId,
      },
    });
  }

  async removeByWorkspace(workspaceId: string): Promise<void> {
    await this.prisma.searchIndex.deleteMany({
      where: { workspaceId },
    });
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Build the search conditions
      const whereConditions: any = {
        workspaceId: query.workspaceId,
      };

      // Add entity type filter
      if (query.entityTypes.length > 0) {
        whereConditions.entityType = {
          in: query.entityTypes,
        };
      }

      // Add permission filter
      if (query.permissions.length > 0) {
        whereConditions.permissions = {
          hasSome: query.permissions,
        };
      }

      // Add custom filters
      this.applyCustomFilters(whereConditions, query.filters);

      // Build search query
      let searchCondition: any = {};
      if (query.query.trim()) {
        // Use PostgreSQL full-text search
        searchCondition = {
          OR: [
            {
              title: {
                contains: query.query,
                mode: 'insensitive',
              },
            },
            {
              content: {
                contains: query.query,
                mode: 'insensitive',
              },
            },
            {
              tags: {
                hasSome: query.query.split(' '),
              },
            },
          ],
        };
      }

      const finalWhere = query.query.trim()
        ? { AND: [whereConditions, searchCondition] }
        : whereConditions;

      // Execute search with pagination
      const [results, totalCount] = await Promise.all([
        this.prisma.searchIndex.findMany({
          where: finalWhere,
          orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
          take: query.limit,
          skip: query.offset,
        }),
        this.prisma.searchIndex.count({
          where: finalWhere,
        }),
      ]);

      // Convert to domain objects
      const items = results.map(
        result =>
          new SearchResultItem({
            id: result.id,
            entityType: result.entityType,
            entityId: result.entityId,
            title: result.title,
            content: result.content,
            metadata: result.metadata as Record<string, any>,
            relevanceScore: this.calculateRelevanceScore(result, query.query),
            highlights: this.generateHighlights(result, query.query),
            tags: result.tags,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
          })
      );

      // Get facets
      const facets = await this.getFacets(query);

      // Get suggestions
      const suggestions = await this.getSuggestions(
        query.query,
        query.workspaceId,
        5
      );

      const executionTime = Date.now() - startTime;

      return SearchResult.create({
        items,
        totalCount,
        facets,
        suggestions,
        executionTime,
        query: query.query,
        filters: query.filters,
      });
    } catch (error) {
      console.error('Search error:', error);
      return SearchResult.empty(query.query, query.filters);
    }
  }

  async getSuggestions(
    partialQuery: string,
    workspaceId: string,
    limit = 10
  ): Promise<string[]> {
    if (!partialQuery.trim()) return [];

    const results = await this.prisma.searchIndex.findMany({
      where: {
        workspaceId,
        OR: [
          {
            title: {
              contains: partialQuery,
              mode: 'insensitive',
            },
          },
          {
            tags: {
              hasSome: [partialQuery],
            },
          },
        ],
      },
      select: {
        title: true,
        tags: true,
      },
      take: limit * 2, // Get more to filter and deduplicate
    });

    const suggestions = new Set<string>();

    // Add title-based suggestions
    results.forEach(result => {
      const words = result.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (
          word.includes(partialQuery.toLowerCase()) &&
          word.length > partialQuery.length
        ) {
          suggestions.add(word);
        }
      });
    });

    // Add tag-based suggestions
    results.forEach(result => {
      result.tags.forEach(tag => {
        if (tag.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(tag);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  }

  async getFacets(
    query: SearchQuery
  ): Promise<Record<string, Record<string, number>>> {
    const whereConditions: any = {
      workspaceId: query.workspaceId,
    };

    if (query.entityTypes.length > 0) {
      whereConditions.entityType = {
        in: query.entityTypes,
      };
    }

    if (query.permissions.length > 0) {
      whereConditions.permissions = {
        hasSome: query.permissions,
      };
    }

    // Get entity type facets
    const entityTypeFacets = await this.prisma.searchIndex.groupBy({
      by: ['entityType'],
      where: whereConditions,
      _count: {
        entityType: true,
      },
    });

    // Get tag facets
    const tagResults = await this.prisma.searchIndex.findMany({
      where: whereConditions,
      select: { tags: true },
    });

    const tagCounts: Record<string, number> = {};
    tagResults.forEach(result => {
      result.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Sort tags by count and take top 20
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .reduce(
        (acc, [tag, count]) => {
          acc[tag] = count;
          return acc;
        },
        {} as Record<string, number>
      );

    return {
      entityType: entityTypeFacets.reduce(
        (acc, facet) => {
          acc[facet.entityType] = facet._count.entityType;
          return acc;
        },
        {} as Record<string, number>
      ),
      tags: topTags,
    };
  }

  async bulkIndex(searchIndexes: SearchIndex[]): Promise<void> {
    const data = searchIndexes.map(searchIndex => ({
      id: searchIndex.id,
      entityType: searchIndex.entityType,
      entityId: searchIndex.entityId,
      workspaceId: searchIndex.workspaceId,
      title: searchIndex.title,
      content: searchIndex.content,
      metadata: searchIndex.metadata,
      tags: searchIndex.tags,
      permissions: searchIndex.permissions,
      searchVector: this.generateSearchVector(
        searchIndex.title,
        searchIndex.content
      ),
      createdAt: searchIndex.createdAt,
      updatedAt: searchIndex.updatedAt,
    }));

    // Use transaction for bulk insert
    await this.prisma.$transaction(async tx => {
      // Delete existing entries for these entities
      const identifiers = searchIndexes.map(si => ({
        entityType: si.entityType,
        entityId: si.entityId,
      }));

      for (const identifier of identifiers) {
        await tx.searchIndex.deleteMany({
          where: {
            entityType: identifier.entityType,
            entityId: identifier.entityId,
          },
        });
      }

      // Insert new entries
      await tx.searchIndex.createMany({
        data,
      });
    });
  }

  async bulkRemove(
    identifiers: Array<{ entityType: string; entityId: string }>
  ): Promise<void> {
    await this.prisma.$transaction(async tx => {
      for (const identifier of identifiers) {
        await tx.searchIndex.deleteMany({
          where: {
            entityType: identifier.entityType,
            entityId: identifier.entityId,
          },
        });
      }
    });
  }

  async rebuildIndex(workspaceId: string): Promise<void> {
    // This would typically involve:
    // 1. Clear existing index for workspace
    // 2. Re-index all entities from their source tables
    // For now, just clear the index
    await this.removeByWorkspace(workspaceId);
  }

  async getIndexStats(workspaceId: string): Promise<{
    totalDocuments: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    const [count, lastUpdated] = await Promise.all([
      this.prisma.searchIndex.count({
        where: { workspaceId },
      }),
      this.prisma.searchIndex.findFirst({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    return {
      totalDocuments: count,
      indexSize: count * 1024, // Rough estimate
      lastUpdated: lastUpdated?.updatedAt || new Date(),
    };
  }

  async optimizeIndex(workspaceId: string): Promise<void> {
    // PostgreSQL-specific optimization
    await this.prisma.$executeRaw`VACUUM ANALYZE search_index`;
  }

  async exists(entityType: string, entityId: string): Promise<boolean> {
    const count = await this.prisma.searchIndex.count({
      where: {
        entityType,
        entityId,
      },
    });
    return count > 0;
  }

  async getById(
    entityType: string,
    entityId: string
  ): Promise<SearchIndex | null> {
    const result = await this.prisma.searchIndex.findFirst({
      where: {
        entityType,
        entityId,
      },
    });

    if (!result) return null;

    return SearchIndex.create({
      id: result.id,
      entityType: result.entityType,
      entityId: result.entityId,
      workspaceId: result.workspaceId,
      title: result.title,
      content: result.content,
      metadata: result.metadata as Record<string, any>,
      tags: result.tags,
      permissions: result.permissions,
      searchVector: result.searchVector || undefined,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }

  async getByEntityType(
    workspaceId: string,
    entityType: string,
    limit = 100,
    offset = 0
  ): Promise<SearchIndex[]> {
    const results = await this.prisma.searchIndex.findMany({
      where: {
        workspaceId,
        entityType,
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' },
    });

    return results.map(result =>
      SearchIndex.create({
        id: result.id,
        entityType: result.entityType,
        entityId: result.entityId,
        workspaceId: result.workspaceId,
        title: result.title,
        content: result.content,
        metadata: result.metadata as Record<string, any>,
        tags: result.tags,
        permissions: result.permissions,
        searchVector: result.searchVector || undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      })
    );
  }

  private generateSearchVector(title: string, content: string): string {
    // Simple search vector generation
    // In production, this would use PostgreSQL's to_tsvector function
    const text = `${title} ${content}`.toLowerCase();
    return text
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateRelevanceScore(result: any, query: string): number {
    if (!query.trim()) return 1.0;

    const queryLower = query.toLowerCase();
    const titleLower = result.title.toLowerCase();
    const contentLower = result.content.toLowerCase();

    let score = 0;

    // Title matches get higher score
    if (titleLower.includes(queryLower)) {
      score += 2.0;
    }

    // Content matches
    if (contentLower.includes(queryLower)) {
      score += 1.0;
    }

    // Tag matches
    const matchingTags = result.tags.filter((tag: string) =>
      tag.toLowerCase().includes(queryLower)
    );
    score += matchingTags.length * 0.5;

    // Boost for exact matches
    if (titleLower === queryLower) {
      score += 3.0;
    }

    return Math.max(score, 0.1);
  }

  private generateHighlights(
    result: any,
    query: string
  ): Record<string, string[]> {
    if (!query.trim()) return {};

    const highlights: Record<string, string[]> = {};
    const queryLower = query.toLowerCase();

    // Highlight title
    if (result.title.toLowerCase().includes(queryLower)) {
      highlights.title = [this.highlightText(result.title, query)];
    }

    // Highlight content (first few matches)
    const contentHighlights = this.extractHighlights(result.content, query, 3);
    if (contentHighlights.length > 0) {
      highlights.content = contentHighlights;
    }

    return highlights;
  }

  private highlightText(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private extractHighlights(
    content: string,
    query: string,
    maxHighlights = 3
  ): string[] {
    const queryLower = query.toLowerCase();
    const sentences = content.split(/[.!?]+/);
    const highlights: string[] = [];

    for (const sentence of sentences) {
      if (highlights.length >= maxHighlights) break;

      if (sentence.toLowerCase().includes(queryLower)) {
        const highlighted = this.highlightText(sentence.trim(), query);
        if (highlighted) {
          highlights.push(highlighted);
        }
      }
    }

    return highlights;
  }

  private applyCustomFilters(
    whereConditions: any,
    filters: Record<string, any>
  ): void {
    // Apply status filter
    if (filters.status) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['status'],
        in: Array.isArray(filters.status) ? filters.status : [filters.status],
      };
    }

    // Apply priority filter
    if (filters.priority) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['priority'],
        in: Array.isArray(filters.priority)
          ? filters.priority
          : [filters.priority],
      };
    }

    // Apply assignee filter
    if (filters.assignee) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['assigneeId'],
        in: Array.isArray(filters.assignee)
          ? filters.assignee
          : [filters.assignee],
      };
    }

    // Apply tag filter
    if (filters.tags) {
      whereConditions.tags = {
        hasSome: Array.isArray(filters.tags) ? filters.tags : [filters.tags],
      };
    }

    // Apply date filters
    if (filters.created) {
      const dateConditions: any = {};

      if (filters.created['>']) {
        dateConditions.gte = new Date(filters.created['>']);
      }
      if (filters.created['<']) {
        dateConditions.lte = new Date(filters.created['<']);
      }
      if (filters.created['>=']) {
        dateConditions.gte = new Date(filters.created['>=']);
      }
      if (filters.created['<=']) {
        dateConditions.lte = new Date(filters.created['<=']);
      }

      if (Object.keys(dateConditions).length > 0) {
        whereConditions.createdAt = dateConditions;
      }
    }
  }

  private buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc'): any {
    switch (sortBy) {
      case 'created':
        return { createdAt: sortOrder };
      case 'updated':
        return { updatedAt: sortOrder };
      case 'title':
        return { title: sortOrder };
      case 'relevance':
      default:
        return { updatedAt: 'desc' }; // Default to most recent
    }
  }
}
