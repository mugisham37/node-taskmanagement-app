import { CachedTaskApplicationService } from './CachedTaskApplicationService';
import { RealtimeIntegrationService } from './RealtimeIntegrationService';
import { Task } from '../../domain/entities/Task';
import { User } from '../../domain/entities/User';
import { Result } from '../../shared/types/Result';
import {
  CacheEvict,
  CachePut,
} from '../../infrastructure/caching/cache-decorators';

/**
 * Enhanced TaskApplicationService with both caching and real-time capabilities
 */
export class EnhancedTaskApplicationService extends CachedTaskApplicationService {
  private realtimeService: RealtimeIntegrationService;

  constructor(...args: any[]) {
    super(...args);
    this.realtimeService = new RealtimeIntegrationService(this.container);
  }

  @CachePut({
    ttl: 600,
    tags: ['tasks'],
    keyGenerator: function (this: EnhancedTaskApplicationService, params: any) {
      return `task:${params.taskId || 'new'}:user:${params.createdBy}`;
    },
  })
  async createTask(params: {
    title: string;
    description?: string;
    projectId: string;
    assigneeId?: string;
    priority: string;
    dueDate?: Date;
    createdBy: string;
  }): Promise<Result<Task>> {
    const result = await super.createTask(params);

    if (result.isSuccess && result.data) {
      // Broadcast real-time update
      const createdByUser = await this.getUserById(params.createdBy);
      if (createdByUser) {
        await this.realtimeService.broadcastTaskCreated(
          result.data,
          createdByUser
        );
      }

      // Invalidate related caches
      await this.cache.invalidateByTag('tasks');
      await this.cache.invalidateByPattern(
        `tasks:project:${params.projectId}:*`
      );
    }

    return result;
  }

  @CacheEvict({
    tags: ['tasks'],
    keys: function (this: EnhancedTaskApplicationService, params: any) {
      return [`task:${params.taskId}:user:${params.userId}`];
    },
  })
  @CachePut({
    ttl: 600,
    tags: ['tasks'],
    keyGenerator: function (this: EnhancedTaskApplicationService, params: any) {
      return `task:${params.taskId}:user:${params.userId}`;
    },
  })
  async updateTask(params: {
    taskId: string;
    updates: Partial<Task>;
    userId: string;
  }): Promise<Result<Task>> {
    const result = await super.updateTask(params);

    if (result.isSuccess && result.data) {
      // Broadcast real-time update
      const updatedByUser = await this.getUserById(params.userId);
      if (updatedByUser) {
        await this.realtimeService.broadcastTaskUpdated(
          params.taskId,
          params.updates,
          updatedByUser
        );
      }

      // Invalidate project-related caches if project changed
      if (params.updates.projectId) {
        await this.cache.invalidateByPattern(
          `tasks:project:${params.updates.projectId}:*`
        );
      }
    }

    return result;
  }

  @CacheEvict({
    tags: ['tasks'],
    keys: function (this: EnhancedTaskApplicationService, params: any) {
      return [`task:${params.taskId}:user:${params.userId}`];
    },
    patterns: ['tasks:list:*', 'tasks:project:*'],
  })
  async deleteTask(params: {
    taskId: string;
    userId: string;
  }): Promise<Result<void>> {
    const result = await super.deleteTask(params);

    if (result.isSuccess) {
      // Broadcast real-time update
      const deletedByUser = await this.getUserById(params.userId);
      if (deletedByUser) {
        await this.realtimeService.broadcastTaskDeleted(
          params.taskId,
          deletedByUser
        );
      }
    }

    return result;
  }

  @CachePut({
    ttl: 600,
    tags: ['tasks'],
    keyGenerator: function (this: EnhancedTaskApplicationService, params: any) {
      return `task:${params.taskId}:user:${params.userId}`;
    },
  })
  @CacheEvict({
    patterns: ['tasks:list:*', 'tasks:project:*'],
  })
  async updateTaskStatus(params: {
    taskId: string;
    status: string;
    userId: string;
  }): Promise<Result<Task>> {
    // Get current task to compare status
    const currentTaskResult = await this.getTaskById({
      taskId: params.taskId,
      userId: params.userId,
    });

    const result = await super.updateTaskStatus(params);

    if (
      result.isSuccess &&
      result.data &&
      currentTaskResult.isSuccess &&
      currentTaskResult.data
    ) {
      // Broadcast real-time update
      const changedByUser = await this.getUserById(params.userId);
      if (changedByUser) {
        await this.realtimeService.broadcastTaskStatusChanged(
          params.taskId,
          currentTaskResult.data.status,
          params.status,
          changedByUser
        );
      }
    }

    return result;
  }

  @CachePut({
    ttl: 600,
    tags: ['tasks'],
    keyGenerator: function (this: EnhancedTaskApplicationService, params: any) {
      return `task:${params.taskId}:user:${params.userId}`;
    },
  })
  async assignTask(params: {
    taskId: string;
    assigneeId: string;
    userId: string;
  }): Promise<Result<Task>> {
    const result = await super.assignTask(params);

    if (result.isSuccess && result.data) {
      // Broadcast real-time update
      const assignedByUser = await this.getUserById(params.userId);
      const assigneeUser = await this.getUserById(params.assigneeId);

      if (assignedByUser && assigneeUser) {
        await this.realtimeService.broadcastTaskAssigned(
          params.taskId,
          assigneeUser,
          assignedByUser
        );
      }

      // Invalidate assignee-related caches
      await this.cache.invalidateByPattern(
        `tasks:*:user:${params.assigneeId}:*`
      );
    }

    return result;
  }

  // Enhanced method with real-time room management
  async getTasksByProject(params: {
    projectId: string;
    userId: string;
    filters?: any;
  }): Promise<Result<Task[]>> {
    const result = await super.getTasksByProject(params);

    // Optionally notify that user is viewing project tasks
    // This could be used for presence indicators
    if (result.isSuccess) {
      // Could emit a "user_viewing_project" event here
    }

    return result;
  }

  // Utility method to get user by ID (would be injected from UserService)
  private async getUserById(userId: string): Promise<User | null> {
    try {
      // This would typically be injected as a dependency
      const userService = this.container.resolve('UserApplicationService');
      const result = await userService.getUserById({
        userId,
        requestedBy: userId,
      });
      return result.isSuccess ? result.data : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  // Method to get enhanced statistics including real-time data
  async getEnhancedStats(userId: string) {
    const cacheStats = this.getCacheStats();
    const realtimeStats = this.realtimeService.getRealtimeStats();

    return {
      cache: cacheStats,
      realtime: realtimeStats,
      userRooms: this.realtimeService.getUserRooms(userId),
    };
  }

  // Method to warm cache for a specific project
  async warmProjectCache(projectId: string, userId: string): Promise<void> {
    try {
      // Pre-load project tasks
      await this.getTasksByProject({ projectId, userId });

      // Pre-load individual tasks
      const tasksResult = await this.getTasksByProject({
        projectId,
        userId,
        filters: { limit: 50 },
      });

      if (tasksResult.isSuccess && tasksResult.data) {
        const cachePromises = tasksResult.data.map(task =>
          this.getTaskById({ taskId: task.id, userId })
        );
        await Promise.allSettled(cachePromises);
      }
    } catch (error) {
      console.error('Project cache warming failed:', error);
    }
  }
}
