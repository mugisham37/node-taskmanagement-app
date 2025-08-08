import { SearchIndex } from '../entities/search-index.entity';
import { SearchIndexRepository } from '../repositories/search-index.repository';
import { DomainEvent } from '../../../shared/domain/domain-event';
import { EventBus } from '../../../shared/domain/event-bus';

export interface IndexableEntity {
  id: string;
  getSearchableContent(): {
    title: string;
    content: string;
    metadata: Record<string, any>;
    tags: string[];
    permissions: string[];
  };
  getEntityType(): string;
  getWorkspaceId(): string;
}

export interface SearchIndexingService {
  /**
   * Index a single entity
   */
  indexEntity(entity: IndexableEntity): Promise<void>;

  /**
   * Update index for an entity
   */
  updateEntityIndex(entity: IndexableEntity): Promise<void>;

  /**
   * Remove entity from index
   */
  removeEntityFromIndex(entityType: string, entityId: string): Promise<void>;

  /**
   * Bulk index multiple entities
   */
  bulkIndexEntities(entities: IndexableEntity[]): Promise<void>;

  /**
   * Rebuild index for a workspace
   */
  rebuildWorkspaceIndex(workspaceId: string): Promise<void>;

  /**
   * Process indexing queue
   */
  processIndexingQueue(): Promise<void>;

  /**
   * Get indexing statistics
   */
  getIndexingStats(workspaceId: string): Promise<{
    totalIndexed: number;
    lastIndexed: Date;
    pendingIndexing: number;
    indexSize: number;
  }>;

  /**
   * Optimize search index
   */
  optimizeIndex(workspaceId: string): Promise<void>;
}

export class SearchIndexingServiceImpl implements SearchIndexingService {
  constructor(
    private readonly searchIndexRepository: SearchIndexRepository,
    private readonly eventBus: EventBus
  ) {}

  async indexEntity(entity: IndexableEntity): Promise<void> {
    try {
      const searchableContent = entity.getSearchableContent();

      const searchIndex = SearchIndex.create({
        entityType: entity.getEntityType(),
        entityId: entity.id,
        workspaceId: entity.getWorkspaceId(),
        title: searchableContent.title,
        content: searchableContent.content,
        metadata: searchableContent.metadata,
        tags: searchableContent.tags,
        permissions: searchableContent.permissions,
      });

      await this.searchIndexRepository.index(searchIndex);

      // Publish domain event
      await this.eventBus.publish(
        new EntityIndexedEvent({
          entityType: entity.getEntityType(),
          entityId: entity.id,
          workspaceId: entity.getWorkspaceId(),
        })
      );
    } catch (error) {
      await this.eventBus.publish(
        new EntityIndexingFailedEvent({
          entityType: entity.getEntityType(),
          entityId: entity.id,
          workspaceId: entity.getWorkspaceId(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
      throw error;
    }
  }

  async updateEntityIndex(entity: IndexableEntity): Promise<void> {
    try {
      const existingIndex = await this.searchIndexRepository.getById(
        entity.getEntityType(),
        entity.id
      );

      if (!existingIndex) {
        await this.indexEntity(entity);
        return;
      }

      const searchableContent = entity.getSearchableContent();
      existingIndex.updateContent(
        searchableContent.title,
        searchableContent.content,
        searchableContent.metadata
      );
      existingIndex.updatePermissions(searchableContent.permissions);

      await this.searchIndexRepository.update(existingIndex);

      await this.eventBus.publish(
        new EntityIndexUpdatedEvent({
          entityType: entity.getEntityType(),
          entityId: entity.id,
          workspaceId: entity.getWorkspaceId(),
        })
      );
    } catch (error) {
      await this.eventBus.publish(
        new EntityIndexingFailedEvent({
          entityType: entity.getEntityType(),
          entityId: entity.id,
          workspaceId: entity.getWorkspaceId(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
      throw error;
    }
  }

  async removeEntityFromIndex(
    entityType: string,
    entityId: string
  ): Promise<void> {
    try {
      await this.searchIndexRepository.remove(entityType, entityId);

      await this.eventBus.publish(
        new EntityRemovedFromIndexEvent({
          entityType,
          entityId,
        })
      );
    } catch (error) {
      throw error;
    }
  }

  async bulkIndexEntities(entities: IndexableEntity[]): Promise<void> {
    try {
      const searchIndexes = entities.map(entity => {
        const searchableContent = entity.getSearchableContent();
        return SearchIndex.create({
          entityType: entity.getEntityType(),
          entityId: entity.id,
          workspaceId: entity.getWorkspaceId(),
          title: searchableContent.title,
          content: searchableContent.content,
          metadata: searchableContent.metadata,
          tags: searchableContent.tags,
          permissions: searchableContent.permissions,
        });
      });

      await this.searchIndexRepository.bulkIndex(searchIndexes);

      await this.eventBus.publish(
        new BulkIndexingCompletedEvent({
          entityCount: entities.length,
          workspaceIds: [...new Set(entities.map(e => e.getWorkspaceId()))],
        })
      );
    } catch (error) {
      await this.eventBus.publish(
        new BulkIndexingFailedEvent({
          entityCount: entities.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
      throw error;
    }
  }

  async rebuildWorkspaceIndex(workspaceId: string): Promise<void> {
    try {
      await this.eventBus.publish(
        new IndexRebuildStartedEvent({ workspaceId })
      );

      await this.searchIndexRepository.rebuildIndex(workspaceId);

      await this.eventBus.publish(
        new IndexRebuildCompletedEvent({ workspaceId })
      );
    } catch (error) {
      await this.eventBus.publish(
        new IndexRebuildFailedEvent({
          workspaceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
      throw error;
    }
  }

  async processIndexingQueue(): Promise<void> {
    // Implementation would depend on the queue system being used
    // This is a placeholder for queue processing logic
    throw new Error('Method not implemented');
  }

  async getIndexingStats(workspaceId: string): Promise<{
    totalIndexed: number;
    lastIndexed: Date;
    pendingIndexing: number;
    indexSize: number;
  }> {
    const stats = await this.searchIndexRepository.getIndexStats(workspaceId);

    return {
      totalIndexed: stats.totalDocuments,
      lastIndexed: stats.lastUpdated,
      pendingIndexing: 0, // Would be implemented with queue system
      indexSize: stats.indexSize,
    };
  }

  async optimizeIndex(workspaceId: string): Promise<void> {
    await this.searchIndexRepository.optimizeIndex(workspaceId);

    await this.eventBus.publish(new IndexOptimizedEvent({ workspaceId }));
  }
}

// Domain Events
class EntityIndexedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      entityType: string;
      entityId: string;
      workspaceId: string;
    }
  ) {
    super('EntityIndexed', payload);
  }
}

class EntityIndexUpdatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      entityType: string;
      entityId: string;
      workspaceId: string;
    }
  ) {
    super('EntityIndexUpdated', payload);
  }
}

class EntityRemovedFromIndexEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      entityType: string;
      entityId: string;
    }
  ) {
    super('EntityRemovedFromIndex', payload);
  }
}

class EntityIndexingFailedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      entityType: string;
      entityId: string;
      workspaceId: string;
      error: string;
    }
  ) {
    super('EntityIndexingFailed', payload);
  }
}

class BulkIndexingCompletedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      entityCount: number;
      workspaceIds: string[];
    }
  ) {
    super('BulkIndexingCompleted', payload);
  }
}

class BulkIndexingFailedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      entityCount: number;
      error: string;
    }
  ) {
    super('BulkIndexingFailed', payload);
  }
}

class IndexRebuildStartedEvent extends DomainEvent {
  constructor(public readonly payload: { workspaceId: string }) {
    super('IndexRebuildStarted', payload);
  }
}

class IndexRebuildCompletedEvent extends DomainEvent {
  constructor(public readonly payload: { workspaceId: string }) {
    super('IndexRebuildCompleted', payload);
  }
}

class IndexRebuildFailedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      workspaceId: string;
      error: string;
    }
  ) {
    super('IndexRebuildFailed', payload);
  }
}

class IndexOptimizedEvent extends DomainEvent {
  constructor(public readonly payload: { workspaceId: string }) {
    super('IndexOptimized', payload);
  }
}
