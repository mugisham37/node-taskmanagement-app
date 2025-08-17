import { Result } from '@taskmanagement/types/common';
import { Task } from "@taskmanagement/domain";
import { Cacheable, CacheEvict, CachePut } from "@taskmanagement/cache";
import { MultiLayerCache } from "@taskmanagement/cache";
import { TaskApplicationService } from './TaskApplicationService';

/**
 * Enhanced TaskApplicationService with caching capabilities
 */
export class CachedTaskApplicationService extends TaskApplicationService {
  private cache: MultiLayerCache;

  constructor(
    // Inject all dependencies from parent class
    ...args: any[]
  ) {
    super(...args);
    // Initialize cache - this would be injected in a real implementation
    this.cache = new MultiLayerCache(this.container);
  }

  @Cacheable({
    ttl: 300, // 5 minutes
    tags: ['tasks'],
    keyGenerator: function (this: CachedTaskApplicationService, filters: any) {
      return `tasks:list:${JSON.stringify(filters)}`;
    },
  })
  async getTasks(filters: any): Promise<Result<Task[]>> {
    return super.getTasks(filters);
  }

  @Cacheable({
    ttl: 600, // 10 minutes
    tags: ['tasks'],
    keyGenerator: function (
      this: CachedTaskApplicationService,
      params: { taskId: string; userId: string }
    ) {
      return `task:${params.taskId}:user:${params.userId}`;
    },
  })
  async getTaskById(params: { taskId: string; userId: string }): Promise<Result<Task>> {
    return super.getTaskById(params);
  }

  @CacheEvict({
    tags: ['tasks'],
    keys: function (this: CachedTaskApplicationService, params: any) {
      return [
        `task:${params.taskId}:user:${params.userId}`,
        `tasks:list:*`, // This would need pattern matching
      ];
    },
  })
  @CachePut({
    ttl: 600,
    tags: ['tasks'],
    keyGenerator: function (this: CachedTaskApplicationService, params: any) {
      return `task:${params.taskId}:user:${params.userId}`;
    },
  })
  async updateTask(params: {
    taskId: string;
    updates: any;
    userId: string;
  }): Promise<Result<Task>> {
    return super.updateTask(params);
  }

  @CacheEvict({
    tags: ['tasks'],
    keys: function (this: CachedTaskApplicationService, params: any) {
      return [`task:${params.taskId}:user:${params.userId}`];
    },
    patterns: ['tasks:list:*'], // Invalidate all task lists
  })
  async deleteTask(params: { taskId: string; userId: string }): Promise<Result<void>> {
    return super.deleteTask(params);
  }

  @CachePut({
    ttl: 600,
    tags: ['tasks'],
    keyGenerator: function (this: CachedTaskApplicationService, params: any) {
      return `task:${params.taskId}:user:${params.userId}`;
    },
  })
  @CacheEvict({
    patterns: ['tasks:list:*'], // Invalidate task lists when status changes
  })
  async updateTaskStatus(params: {
    taskId: string;
    status: string;
    userId: string;
  }): Promise<Result<Task>> {
    return super.updateTaskStatus(params);
  }

  @Cacheable({
    ttl: 300,
    tags: ['tasks', 'projects'],
    keyGenerator: function (this: CachedTaskApplicationService, params: any) {
      return `tasks:project:${params.projectId}:user:${params.userId}:${JSON.stringify(params.filters || {})}`;
    },
  })
  async getTasksByProject(params: {
    projectId: string;
    userId: string;
    filters?: any;
  }): Promise<Result<Task[]>> {
    return super.getTasksByProject(params);
  }

  // Method to manually warm cache for frequently accessed data
  async warmFrequentlyAccessedTasks(userId: string): Promise<void> {
    try {
      // Get user's recent tasks
      const recentTasksResult = await super.getTasks({
        userId,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      if (recentTasksResult.isSuccess && recentTasksResult.data) {
        // Cache each task individually
        const cachePromises = recentTasksResult.data.map(async (task) => {
          const key = `task:${task.id}:user:${userId}`;
          await this.cache.set(key, task, {
            ttl: 600,
            tags: ['tasks'],
          });
        });

        await Promise.all(cachePromises);
      }
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  // Method to get cache statistics
  getCacheStats() {
    return this.cache.getStats();
  }

  // Method to clear user-specific cache
  async clearUserCache(userId: string): Promise<void> {
    await this.cache.invalidateByPattern(`*:user:${userId}*`);
  }
}

