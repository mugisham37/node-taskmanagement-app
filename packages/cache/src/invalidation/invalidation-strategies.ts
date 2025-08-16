import { ICacheService } from '../cache-service-interface';

export interface InvalidationStrategy {
  name: string;
  invalidate(cacheService: ICacheService, context: InvalidationContext): Promise<void>;
}

export interface InvalidationContext {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

export class EntityBasedInvalidation implements InvalidationStrategy {
  name = 'entity-based';

  async invalidate(cacheService: ICacheService, context: InvalidationContext): Promise<void> {
    const patterns = this.generateInvalidationPatterns(context);
    
    for (const pattern of patterns) {
      try {
        if ('invalidatePattern' in cacheService) {
          await (cacheService as any).invalidatePattern(pattern);
        }
      } catch (error) {
        console.error(`Failed to invalidate pattern ${pattern}:`, error);
      }
    }
  }

  private generateInvalidationPatterns(context: InvalidationContext): string[] {
    const { entityType, entityId, userId, workspaceId, projectId } = context;
    const patterns: string[] = [];

    // Direct entity patterns
    patterns.push(`${entityType}:${entityId}:*`);
    patterns.push(`${entityType}:*:${entityId}`);
    patterns.push(`*:${entityType}:${entityId}:*`);

    // List patterns
    patterns.push(`list:${entityType}:*`);
    patterns.push(`search:${entityType}:*`);

    // User-specific patterns
    if (userId) {
      patterns.push(`user:${userId}:${entityType}:*`);
      patterns.push(`${entityType}:user:${userId}:*`);
    }

    // Workspace-specific patterns
    if (workspaceId) {
      patterns.push(`workspace:${workspaceId}:${entityType}:*`);
      patterns.push(`${entityType}:workspace:${workspaceId}:*`);
    }

    // Project-specific patterns
    if (projectId) {
      patterns.push(`project:${projectId}:${entityType}:*`);
      patterns.push(`${entityType}:project:${projectId}:*`);
    }

    // Analytics and stats patterns
    patterns.push(`analytics:${entityType}:*`);
    patterns.push(`stats:${entityType}:*`);

    return patterns;
  }
}

export class TagBasedInvalidation implements InvalidationStrategy {
  name = 'tag-based';

  async invalidate(cacheService: ICacheService, context: InvalidationContext): Promise<void> {
    const tags = this.generateInvalidationTags(context);
    
    for (const tag of tags) {
      try {
        if ('invalidateByTags' in cacheService) {
          await (cacheService as any).invalidateByTags([tag]);
        }
      } catch (error) {
        console.error(`Failed to invalidate tag ${tag}:`, error);
      }
    }
  }

  private generateInvalidationTags(context: InvalidationContext): string[] {
    const { entityType, entityId, userId, workspaceId, projectId } = context;
    const tags: string[] = [];

    // Entity tags
    tags.push(entityType);
    tags.push(`${entityType}:${entityId}`);

    // Relationship tags
    if (userId) {
      tags.push(`user:${userId}`);
    }

    if (workspaceId) {
      tags.push(`workspace:${workspaceId}`);
    }

    if (projectId) {
      tags.push(`project:${projectId}`);
    }

    return tags;
  }
}

export class TimeBasedInvalidation implements InvalidationStrategy {
  name = 'time-based';

  async invalidate(cacheService: ICacheService, context: InvalidationContext): Promise<void> {
    // Invalidate time-sensitive data
    const timePatterns = [
      'stats:daily:*',
      'stats:weekly:*',
      'stats:hourly:*',
      'analytics:*',
      'dashboard:*'
    ];

    for (const pattern of timePatterns) {
      try {
        if ('invalidatePattern' in cacheService) {
          await (cacheService as any).invalidatePattern(pattern);
        }
      } catch (error) {
        console.error(`Failed to invalidate time pattern ${pattern}:`, error);
      }
    }
  }
}

export class CascadingInvalidation implements InvalidationStrategy {
  name = 'cascading';

  async invalidate(cacheService: ICacheService, context: InvalidationContext): Promise<void> {
    const cascadeMap = this.getCascadeMap();
    const entityType = context.entityType;

    if (cascadeMap.has(entityType)) {
      const relatedEntities = cascadeMap.get(entityType)!;
      
      for (const relatedEntity of relatedEntities) {
        const relatedContext: InvalidationContext = {
          ...context,
          entityType: relatedEntity
        };

        // Use entity-based invalidation for related entities
        const entityInvalidation = new EntityBasedInvalidation();
        await entityInvalidation.invalidate(cacheService, relatedContext);
      }
    }
  }

  private getCascadeMap(): Map<string, string[]> {
    return new Map([
      ['user', ['task', 'project', 'workspace', 'notification']],
      ['project', ['task', 'user', 'workspace']],
      ['workspace', ['project', 'task', 'user']],
      ['task', ['project', 'user']]
    ]);
  }
}

export class InvalidationManager {
  private strategies: Map<string, InvalidationStrategy> = new Map();

  constructor() {
    this.registerStrategy(new EntityBasedInvalidation());
    this.registerStrategy(new TagBasedInvalidation());
    this.registerStrategy(new TimeBasedInvalidation());
    this.registerStrategy(new CascadingInvalidation());
  }

  registerStrategy(strategy: InvalidationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  async invalidate(
    cacheService: ICacheService,
    context: InvalidationContext,
    strategyNames: string[] = ['entity-based', 'tag-based']
  ): Promise<void> {
    const promises = strategyNames.map(async (strategyName) => {
      const strategy = this.strategies.get(strategyName);
      if (strategy) {
        try {
          await strategy.invalidate(cacheService, context);
        } catch (error) {
          console.error(`Invalidation strategy ${strategyName} failed:`, error);
        }
      }
    });

    await Promise.all(promises);
  }
}