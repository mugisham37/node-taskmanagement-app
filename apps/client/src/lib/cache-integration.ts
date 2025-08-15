import { QueryClient, QueryFunction, QueryKey } from '@tanstack/react-query';
import { CacheManager, getCacheManager } from '@taskmanagement/shared/cache';

export interface ClientCacheConfig {
  queryClient: QueryClient;
  cacheManager?: CacheManager;
  enablePersistence?: boolean;
  enableBackground?: boolean;
}

export class ClientCacheIntegration {
  private queryClient: QueryClient;
  private cacheManager?: CacheManager;
  private enablePersistence: boolean;
  private enableBackground: boolean;

  constructor(config: ClientCacheConfig) {
    this.queryClient = config.queryClient;
    this.cacheManager = config.cacheManager || getCacheManager() || undefined;
    this.enablePersistence = config.enablePersistence ?? true;
    this.enableBackground = config.enableBackground ?? true;

    this.setupQueryClientDefaults();
    this.setupCacheSync();
  }

  private setupQueryClientDefaults(): void {
    this.queryClient.setDefaultOptions({
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: 3,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
      mutations: {
        retry: 1,
      },
    });
  }

  private setupCacheSync(): void {
    if (!this.cacheManager) return;

    // Sync React Query cache with server cache
    this.queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'added' || event.type === 'updated') {
        const { query } = event;
        if (query.state.data && this.enablePersistence) {
          this.syncToServerCache(query.queryKey, query.state.data);
        }
      }
    });
  }

  private async syncToServerCache(queryKey: QueryKey, data: any): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = this.serializeQueryKey(queryKey);
      await this.cacheManager.set(key, data, 300, 'react-query');
    } catch (error) {
      console.warn('Failed to sync to server cache:', error);
    }
  }

  private serializeQueryKey(queryKey: QueryKey): string {
    return Array.isArray(queryKey) 
      ? queryKey.map(k => String(k)).join(':')
      : String(queryKey);
  }

  // Enhanced query methods with server cache integration
  async enhancedQuery<T>(
    queryKey: QueryKey,
    queryFn: QueryFunction<T>,
    options: {
      staleWhileRevalidate?: boolean;
      serverCacheTTL?: number;
      enableDeduplication?: boolean;
    } = {}
  ): Promise<T> {
    const {
      staleWhileRevalidate = false,
      serverCacheTTL = 300,
      enableDeduplication = true,
    } = options;

    const key = this.serializeQueryKey(queryKey);

    // Try server cache first if available
    if (this.cacheManager) {
      const serverCached = await this.cacheManager.get<T>(key, 'react-query');
      if (serverCached) {
        // Update React Query cache with server data
        this.queryClient.setQueryData(queryKey, serverCached);
        
        if (staleWhileRevalidate) {
          // Revalidate in background
          this.revalidateInBackground(queryKey, queryFn, serverCacheTTL);
        }
        
        return serverCached;
      }
    }

    // Fallback to React Query
    const data = await this.queryClient.fetchQuery({
      queryKey,
      queryFn,
    });

    // Cache in server cache
    if (this.cacheManager) {
      await this.cacheManager.set(key, data, serverCacheTTL, 'react-query');
    }

    return data;
  }

  private async revalidateInBackground<T>(
    queryKey: QueryKey,
    queryFn: QueryFunction<T>,
    ttl: number
  ): Promise<void> {
    if (!this.enableBackground) return;

    try {
      const data = await queryFn({ queryKey, signal: new AbortController().signal });
      
      // Update both caches
      this.queryClient.setQueryData(queryKey, data);
      
      if (this.cacheManager) {
        const key = this.serializeQueryKey(queryKey);
        await this.cacheManager.set(key, data, ttl, 'react-query');
      }
    } catch (error) {
      console.warn('Background revalidation failed:', error);
    }
  }

  // Optimistic updates with rollback
  async optimisticUpdate<T>(
    queryKey: QueryKey,
    updater: (old: T | undefined) => T,
    mutationFn: () => Promise<T>,
    options: {
      rollbackOnError?: boolean;
      invalidateRelated?: QueryKey[];
    } = {}
  ): Promise<T> {
    const { rollbackOnError = true, invalidateRelated = [] } = options;

    // Store previous data for rollback
    const previousData = this.queryClient.getQueryData<T>(queryKey);
    
    // Apply optimistic update
    const optimisticData = updater(previousData);
    this.queryClient.setQueryData(queryKey, optimisticData);

    try {
      // Execute mutation
      const result = await mutationFn();
      
      // Update with real result
      this.queryClient.setQueryData(queryKey, result);
      
      // Update server cache
      if (this.cacheManager) {
        const key = this.serializeQueryKey(queryKey);
        await this.cacheManager.set(key, result, 300, 'react-query');
      }

      // Invalidate related queries
      for (const relatedKey of invalidateRelated) {
        await this.queryClient.invalidateQueries({ queryKey: relatedKey });
      }

      return result;
    } catch (error) {
      // Rollback on error
      if (rollbackOnError) {
        this.queryClient.setQueryData(queryKey, previousData);
      }
      throw error;
    }
  }

  // Batch operations
  async batchQueries<T>(
    queries: Array<{
      queryKey: QueryKey;
      queryFn: QueryFunction<T>;
    }>
  ): Promise<T[]> {
    const promises = queries.map(({ queryKey, queryFn }) =>
      this.enhancedQuery(queryKey, queryFn)
    );

    return Promise.all(promises);
  }

  // Prefetching with intelligent scheduling
  async prefetchQuery<T>(
    queryKey: QueryKey,
    queryFn: QueryFunction<T>,
    options: {
      priority?: 'high' | 'medium' | 'low';
      delay?: number;
    } = {}
  ): Promise<void> {
    const { priority = 'medium', delay = 0 } = options;

    const prefetchFn = async () => {
      try {
        await this.queryClient.prefetchQuery({
          queryKey,
          queryFn,
        });
      } catch (error) {
        console.warn('Prefetch failed:', error);
      }
    };

    if (delay > 0) {
      setTimeout(prefetchFn, delay);
    } else if (priority === 'low') {
      // Use requestIdleCallback for low priority prefetching
      if ('requestIdleCallback' in window) {
        requestIdleCallback(prefetchFn);
      } else {
        setTimeout(prefetchFn, 0);
      }
    } else {
      prefetchFn();
    }
  }

  // Cache warming for user sessions
  async warmUserCache(userId: string): Promise<void> {
    const warmupQueries = [
      {
        queryKey: ['user', userId],
        queryFn: async () => {
          // This would be replaced with actual user data fetching
          return { id: userId, warmed: true };
        },
      },
      {
        queryKey: ['user', userId, 'projects'],
        queryFn: async () => {
          // This would be replaced with actual projects fetching
          return [];
        },
      },
      {
        queryKey: ['user', userId, 'preferences'],
        queryFn: async () => {
          // This would be replaced with actual preferences fetching
          return {};
        },
      },
    ];

    await Promise.allSettled(
      warmupQueries.map(({ queryKey, queryFn }) =>
        this.prefetchQuery(queryKey, queryFn, { priority: 'low' })
      )
    );
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate React Query cache
    await this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = this.serializeQueryKey(query.queryKey);
        return new RegExp(pattern.replace(/\*/g, '.*')).test(key);
      },
    });

    // Invalidate server cache
    if (this.cacheManager) {
      await this.cacheManager.invalidateQueries(pattern);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidatePattern(`*:${tag}:*`);
    }
  }

  // Cache statistics
  getCacheStats() {
    const queryCache = this.queryClient.getQueryCache();
    const queries = queryCache.getAll();
    
    return {
      totalQueries: queries.length,
      staleQueries: queries.filter(q => q.isStale()).length,
      fetchingQueries: queries.filter(q => q.isFetching()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      serverCache: this.cacheManager?.getStats(),
    };
  }

  // Cleanup and maintenance
  async cleanup(): Promise<void> {
    // Clear stale queries
    this.queryClient.clear();
    
    // Clear server cache if available
    if (this.cacheManager) {
      await this.cacheManager.cleanup();
    }
  }
}

// React hook for cache integration
export function useCacheIntegration() {
  const queryClient = useQueryClient();
  const [integration] = useState(() => 
    new ClientCacheIntegration({ queryClient })
  );

  return integration;
}

// Enhanced query hooks
export function useEnhancedQuery<T>(
  queryKey: QueryKey,
  queryFn: QueryFunction<T>,
  options: Parameters<typeof useQuery>[2] & {
    staleWhileRevalidate?: boolean;
    serverCacheTTL?: number;
  } = {}
) {
  const integration = useCacheIntegration();
  
  return useQuery({
    queryKey,
    queryFn: () => integration.enhancedQuery(queryKey, queryFn, options),
    ...options,
  });
}

export function useOptimisticMutation<T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options: {
    queryKey: QueryKey;
    updater: (old: T | undefined, variables: V) => T;
    invalidateRelated?: QueryKey[];
  }
) {
  const integration = useCacheIntegration();
  
  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      return integration.optimisticUpdate(
        options.queryKey,
        (old) => options.updater(old, variables),
        () => mutationFn(variables),
        { invalidateRelated: options.invalidateRelated }
      );
    },
  });
}