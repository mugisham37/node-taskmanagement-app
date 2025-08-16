import { ICacheService } from '../cache-service-interface';

export interface PartitionStrategy {
  name: string;
  getPartition(key: string, context?: PartitionContext): string;
}

export interface PartitionContext {
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
}

export class HashPartitionStrategy implements PartitionStrategy {
  name = 'hash';

  constructor(private partitionCount: number = 16) {}

  getPartition(key: string): string {
    const hash = this.simpleHash(key);
    const partition = hash % this.partitionCount;
    return `partition_${partition}`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export class UserPartitionStrategy implements PartitionStrategy {
  name = 'user';

  getPartition(key: string, context?: PartitionContext): string {
    if (context?.userId) {
      return `user_${context.userId}`;
    }
    
    // Fallback to hash partitioning
    const hashStrategy = new HashPartitionStrategy();
    return hashStrategy.getPartition(key);
  }
}

export class WorkspacePartitionStrategy implements PartitionStrategy {
  name = 'workspace';

  getPartition(key: string, context?: PartitionContext): string {
    if (context?.workspaceId) {
      return `workspace_${context.workspaceId}`;
    }
    
    // Fallback to user partitioning
    const userStrategy = new UserPartitionStrategy();
    return userStrategy.getPartition(key, context);
  }
}

export class EntityTypePartitionStrategy implements PartitionStrategy {
  name = 'entity-type';

  getPartition(key: string, context?: PartitionContext): string {
    if (context?.entityType) {
      return `entity_${context.entityType}`;
    }
    
    // Try to extract entity type from key
    const parts = key.split(':');
    if (parts.length > 0) {
      return `entity_${parts[0]}`;
    }
    
    // Fallback to hash partitioning
    const hashStrategy = new HashPartitionStrategy();
    return hashStrategy.getPartition(key);
  }
}

export class CachePartitioner {
  private strategies: Map<string, PartitionStrategy> = new Map();
  private cacheProviders: Map<string, ICacheService> = new Map();
  private defaultStrategy: string;

  constructor(defaultStrategy: string = 'hash') {
    this.defaultStrategy = defaultStrategy;
    
    // Register default strategies
    this.registerStrategy(new HashPartitionStrategy());
    this.registerStrategy(new UserPartitionStrategy());
    this.registerStrategy(new WorkspacePartitionStrategy());
    this.registerStrategy(new EntityTypePartitionStrategy());
  }

  registerStrategy(strategy: PartitionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  registerCacheProvider(partition: string, cacheService: ICacheService): void {
    this.cacheProviders.set(partition, cacheService);
  }

  private getPartition(key: string, context?: PartitionContext, strategyName?: string): string {
    const strategy = this.strategies.get(strategyName || this.defaultStrategy);
    if (!strategy) {
      throw new Error(`Unknown partition strategy: ${strategyName || this.defaultStrategy}`);
    }
    
    return strategy.getPartition(key, context);
  }

  private getCacheProvider(partition: string): ICacheService {
    const provider = this.cacheProviders.get(partition);
    if (!provider) {
      // Fallback to first available provider
      const firstProvider = this.cacheProviders.values().next().value;
      if (!firstProvider) {
        throw new Error('No cache providers registered');
      }
      return firstProvider;
    }
    return provider;
  }

  async get<T>(
    key: string, 
    context?: PartitionContext, 
    strategyName?: string
  ): Promise<T | null> {
    const partition = this.getPartition(key, context, strategyName);
    const cacheProvider = this.getCacheProvider(partition);
    return cacheProvider.get<T>(key);
  }

  async set<T>(
    key: string, 
    value: T, 
    ttl?: number, 
    context?: PartitionContext, 
    strategyName?: string
  ): Promise<void> {
    const partition = this.getPartition(key, context, strategyName);
    const cacheProvider = this.getCacheProvider(partition);
    return cacheProvider.set(key, value, ttl);
  }

  async delete(
    key: string, 
    context?: PartitionContext, 
    strategyName?: string
  ): Promise<void> {
    const partition = this.getPartition(key, context, strategyName);
    const cacheProvider = this.getCacheProvider(partition);
    return cacheProvider.delete(key);
  }

  async clear(partition?: string): Promise<void> {
    if (partition) {
      const cacheProvider = this.getCacheProvider(partition);
      return cacheProvider.clear();
    }
    
    // Clear all partitions
    const clearPromises = Array.from(this.cacheProviders.values()).map(
      provider => provider.clear()
    );
    await Promise.all(clearPromises);
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    partitions: Array<{
      partition: string;
      status: 'healthy' | 'unhealthy';
      latency?: number;
    }>;
  }> {
    const partitionResults = await Promise.allSettled(
      Array.from(this.cacheProviders.entries()).map(async ([partition, provider]) => {
        const health = await provider.healthCheck();
        return {
          partition,
          status: health.status,
          latency: health.latency
        };
      })
    );

    const partitions = partitionResults.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { partition: 'unknown', status: 'unhealthy' as const }
    );

    const allHealthy = partitions.every(p => p.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      partitions
    };
  }

  getPartitionInfo(): {
    strategies: string[];
    partitions: string[];
    defaultStrategy: string;
  } {
    return {
      strategies: Array.from(this.strategies.keys()),
      partitions: Array.from(this.cacheProviders.keys()),
      defaultStrategy: this.defaultStrategy
    };
  }

  // Utility methods for partition management
  async rebalancePartitions(): Promise<void> {
    // In a real implementation, this would redistribute keys across partitions
    console.log('Rebalancing partitions...');
    
    // This is a simplified implementation
    // In production, you would:
    // 1. Analyze current key distribution
    // 2. Identify hot partitions
    // 3. Migrate keys to balance load
    // 4. Update partition mappings
  }

  async migratePartition(fromPartition: string, toPartition: string): Promise<void> {
    const fromProvider = this.cacheProviders.get(fromPartition);
    const toProvider = this.cacheProviders.get(toPartition);
    
    if (!fromProvider || !toProvider) {
      throw new Error('Invalid partition for migration');
    }

    // In a real implementation, this would migrate all keys
    console.log(`Migrating from ${fromPartition} to ${toPartition}`);
    
    // This is a placeholder - actual implementation would:
    // 1. Get all keys from source partition
    // 2. Copy data to destination partition
    // 3. Verify data integrity
    // 4. Remove data from source partition
  }
}