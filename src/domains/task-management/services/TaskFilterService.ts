import { Task } from '../entities/Task';
import { TaskId } from '../value-objects/TaskId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskStatus, TaskStatusEnum } from '../value-objects/TaskStatus';
import { Priority, PriorityEnum } from '../value-objects/Priority';
import {
  TaskRepository,
  TaskFilters,
  TaskSearchOptions,
} from '../repositories/TaskRepository';

export interface AdvancedTaskFilters extends TaskFilters {
  // Date range filters
  dueDateRange?: {
    from?: Date;
    to?: Date;
  };
  createdDateRange?: {
    from?: Date;
    to?: Date;
  };
  completedDateRange?: {
    from?: Date;
    to?: Date;
  };

  // Effort filters
  estimatedHoursRange?: {
    min?: number;
    max?: number;
  };
  actualHoursRange?: {
    min?: number;
    max?: number;
  };
  storyPointsRange?: {
    min?: number;
    max?: number;
  };

  // Relationship filters
  hasSubtasks?: boolean;
  hasParent?: boolean;
  isEpic?: boolean;
  hasWatchers?: boolean;

  // Custom field filters
  customFields?: Record<string, any>;

  // Activity filters
  lastActivityRange?: {
    from?: Date;
    to?: Date;
  };
  hasRecentActivity?: boolean; // Activity within last 7 days
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: AdvancedTaskFilters;
  sortOptions?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  isPublic: boolean;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface TaskSearchResult {
  tasks: Task[];
  totalCount: number;
  facets: {
    status: Record<TaskStatusEnum, number>;
    priority: Record<PriorityEnum, number>;
    assignees: Record<string, number>;
    tags: Record<string, number>;
    labels: Record<string, number>;
    projects: Record<string, number>;
  };
  appliedFilters: AdvancedTaskFilters;
}

export class TaskFilterService {
  private readonly savedFilters = new Map<string, SavedFilter>();

  constructor(private readonly taskRepository: TaskRepository) {
    this.initializeDefaultFilters();
  }

  /**
   * Apply advanced filters to tasks
   */
  async filterTasks(
    workspaceId: WorkspaceId,
    filters: AdvancedTaskFilters,
    options: TaskSearchOptions = {}
  ): Promise<TaskSearchResult> {
    // Convert advanced filters to repository filters
    const repoFilters = this.convertToRepositoryFilters(filters);

    // Get tasks with basic filters
    const searchOptions: TaskSearchOptions = {
      ...options,
      filters: repoFilters,
    };

    const tasks = await this.taskRepository.findByWorkspace(
      workspaceId,
      searchOptions
    );

    // Apply additional filtering that can't be done at repository level
    const filteredTasks = this.applyAdvancedFilters(tasks, filters);

    // Generate facets for filtered results
    const facets = this.generateFacets(filteredTasks);

    return {
      tasks: filteredTasks,
      totalCount: filteredTasks.length,
      facets,
      appliedFilters: filters,
    };
  }

  /**
   * Search tasks with advanced filtering
   */
  async searchTasks(
    workspaceId: WorkspaceId,
    query: string,
    filters: AdvancedTaskFilters = {},
    options: TaskSearchOptions = {}
  ): Promise<TaskSearchResult> {
    // Combine search query with filters
    const searchOptions: TaskSearchOptions = {
      ...options,
      query,
      filters: this.convertToRepositoryFilters(filters),
    };

    const tasks = await this.taskRepository.search(
      workspaceId,
      query,
      searchOptions
    );

    // Apply additional filtering
    const filteredTasks = this.applyAdvancedFilters(tasks, filters);

    // Generate facets
    const facets = this.generateFacets(filteredTasks);

    return {
      tasks: filteredTasks,
      totalCount: filteredTasks.length,
      facets,
      appliedFilters: filters,
    };
  }

  /**
   * Save a filter for reuse
   */
  async saveFilter(
    workspaceId: WorkspaceId,
    userId: UserId,
    name: string,
    filters: AdvancedTaskFilters,
    options: {
      description?: string;
      isPublic?: boolean;
      sortOptions?: { field: string; direction: 'asc' | 'desc' };
    } = {}
  ): Promise<SavedFilter> {
    const savedFilter: SavedFilter = {
      id: this.generateId(),
      name,
      description: options.description,
      filters,
      sortOptions: options.sortOptions,
      isPublic: options.isPublic || false,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };

    this.savedFilters.set(savedFilter.id, savedFilter);
    return savedFilter;
  }

  /**
   * Get saved filters for user
   */
  async getSavedFilters(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<SavedFilter[]> {
    const allFilters = Array.from(this.savedFilters.values());

    // Return user's own filters and public filters
    return allFilters.filter(
      filter => filter.createdBy.equals(userId) || filter.isPublic
    );
  }

  /**
   * Apply saved filter
   */
  async applySavedFilter(
    workspaceId: WorkspaceId,
    filterId: string,
    userId: UserId,
    options: TaskSearchOptions = {}
  ): Promise<TaskSearchResult> {
    const savedFilter = this.savedFilters.get(filterId);
    if (!savedFilter) {
      throw new Error('Saved filter not found');
    }

    // Check access
    if (!savedFilter.isPublic && !savedFilter.createdBy.equals(userId)) {
      throw new Error('Access denied to this filter');
    }

    // Update usage count
    savedFilter.usageCount += 1;
    savedFilter.updatedAt = new Date();
    this.savedFilters.set(filterId, savedFilter);

    // Apply sort options from saved filter if not provided
    const searchOptions: TaskSearchOptions = {
      ...options,
      sort: options.sort || savedFilter.sortOptions,
    };

    return await this.filterTasks(
      workspaceId,
      savedFilter.filters,
      searchOptions
    );
  }

  /**
   * Get filter suggestions based on workspace data
   */
  async getFilterSuggestions(workspaceId: WorkspaceId): Promise<{
    tags: string[];
    labels: string[];
    assignees: { userId: string; name: string; taskCount: number }[];
    priorities: { priority: PriorityEnum; count: number }[];
    statuses: { status: TaskStatusEnum; count: number }[];
  }> {
    // Get all unique values from workspace
    const [tags, labels, stats] = await Promise.all([
      this.taskRepository.getAllTags(workspaceId),
      this.taskRepository.getAllLabels(workspaceId),
      this.taskRepository.getWorkspaceTaskStats(workspaceId),
    ]);

    return {
      tags,
      labels,
      assignees: [], // Would be populated from actual user data
      priorities: Object.entries(stats.byPriority).map(([priority, count]) => ({
        priority: priority as PriorityEnum,
        count,
      })),
      statuses: Object.entries(stats.byStatus).map(([status, count]) => ({
        status: status as TaskStatusEnum,
        count,
      })),
    };
  }

  /**
   * Create smart filters based on user behavior
   */
  async createSmartFilters(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<SavedFilter[]> {
    const smartFilters: Omit<
      SavedFilter,
      'id' | 'createdAt' | 'updatedAt' | 'usageCount'
    >[] = [
      {
        name: 'My Overdue Tasks',
        description: 'Tasks assigned to me that are overdue',
        filters: {
          assigneeId: userId,
          isOverdue: true,
        },
        sortOptions: { field: 'dueDate', direction: 'asc' },
        isPublic: false,
        createdBy: userId,
      },
      {
        name: 'High Priority Tasks',
        description: 'All high and urgent priority tasks',
        filters: {
          priority: [Priority.high(), Priority.urgent()],
        },
        sortOptions: { field: 'priority', direction: 'desc' },
        isPublic: false,
        createdBy: userId,
      },
      {
        name: 'Recently Created',
        description: 'Tasks created in the last 7 days',
        filters: {
          createdFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        sortOptions: { field: 'createdAt', direction: 'desc' },
        isPublic: false,
        createdBy: userId,
      },
      {
        name: 'Unassigned Tasks',
        description: 'Tasks that need to be assigned',
        filters: {
          assigneeId: undefined,
        },
        sortOptions: { field: 'createdAt', direction: 'desc' },
        isPublic: false,
        createdBy: userId,
      },
    ];

    const createdFilters: SavedFilter[] = [];
    for (const filterData of smartFilters) {
      const savedFilter: SavedFilter = {
        ...filterData,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      this.savedFilters.set(savedFilter.id, savedFilter);
      createdFilters.push(savedFilter);
    }

    return createdFilters;
  }

  /**
   * Convert advanced filters to repository filters
   */
  private convertToRepositoryFilters(
    filters: AdvancedTaskFilters
  ): TaskFilters {
    const repoFilters: TaskFilters = {};

    // Direct mappings
    if (filters.status) repoFilters.status = filters.status;
    if (filters.priority) repoFilters.priority = filters.priority;
    if (filters.assigneeId) repoFilters.assigneeId = filters.assigneeId;
    if (filters.creatorId) repoFilters.creatorId = filters.creatorId;
    if (filters.tags) repoFilters.tags = filters.tags;
    if (filters.labels) repoFilters.labels = filters.labels;
    if (filters.hasAttachments !== undefined)
      repoFilters.hasAttachments = filters.hasAttachments;
    if (filters.isOverdue !== undefined)
      repoFilters.isOverdue = filters.isOverdue;
    if (filters.epicId) repoFilters.epicId = filters.epicId;
    if (filters.parentTaskId) repoFilters.parentTaskId = filters.parentTaskId;

    // Date range mappings
    if (filters.dueDateRange) {
      repoFilters.dueDateFrom = filters.dueDateRange.from;
      repoFilters.dueDateTo = filters.dueDateRange.to;
    }

    if (filters.createdDateRange) {
      repoFilters.createdFrom = filters.createdDateRange.from;
      repoFilters.createdTo = filters.createdDateRange.to;
    }

    return repoFilters;
  }

  /**
   * Apply advanced filters that can't be done at repository level
   */
  private applyAdvancedFilters(
    tasks: Task[],
    filters: AdvancedTaskFilters
  ): Task[] {
    let filteredTasks = tasks;

    // Effort range filters
    if (filters.estimatedHoursRange) {
      filteredTasks = filteredTasks.filter(task => {
        const hours = task.estimatedHours;
        if (hours === undefined) return false;

        const { min, max } = filters.estimatedHoursRange!;
        return (
          (min === undefined || hours >= min) &&
          (max === undefined || hours <= max)
        );
      });
    }

    if (filters.actualHoursRange) {
      filteredTasks = filteredTasks.filter(task => {
        const hours = task.actualHours;
        if (hours === undefined) return false;

        const { min, max } = filters.actualHoursRange!;
        return (
          (min === undefined || hours >= min) &&
          (max === undefined || hours <= max)
        );
      });
    }

    if (filters.storyPointsRange) {
      filteredTasks = filteredTasks.filter(task => {
        const points = task.storyPoints;
        if (points === undefined) return false;

        const { min, max } = filters.storyPointsRange!;
        return (
          (min === undefined || points >= min) &&
          (max === undefined || points <= max)
        );
      });
    }

    // Relationship filters
    if (filters.hasSubtasks !== undefined) {
      filteredTasks = filteredTasks.filter(task => {
        // This would require checking if task has subtasks
        // For now, return all tasks
        return true;
      });
    }

    if (filters.hasParent !== undefined) {
      filteredTasks = filteredTasks.filter(task => {
        const hasParent = task.parentTaskId !== undefined;
        return hasParent === filters.hasParent;
      });
    }

    if (filters.isEpic !== undefined) {
      filteredTasks = filteredTasks.filter(task => {
        const isEpic = task.isEpic();
        return isEpic === filters.isEpic;
      });
    }

    if (filters.hasWatchers !== undefined) {
      filteredTasks = filteredTasks.filter(task => {
        const hasWatchers = task.watchers.length > 0;
        return hasWatchers === filters.hasWatchers;
      });
    }

    // Custom field filters
    if (filters.customFields) {
      filteredTasks = filteredTasks.filter(task => {
        const taskFields = task.customFields;

        return Object.entries(filters.customFields!).every(([key, value]) => {
          return taskFields[key] === value;
        });
      });
    }

    // Activity filters
    if (filters.hasRecentActivity) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filteredTasks = filteredTasks.filter(task => {
        return task.lastActivityAt > sevenDaysAgo;
      });
    }

    if (filters.lastActivityRange) {
      filteredTasks = filteredTasks.filter(task => {
        const { from, to } = filters.lastActivityRange!;
        const activityDate = task.lastActivityAt;

        return (
          (from === undefined || activityDate >= from) &&
          (to === undefined || activityDate <= to)
        );
      });
    }

    return filteredTasks;
  }

  /**
   * Generate facets for search results
   */
  private generateFacets(tasks: Task[]): TaskSearchResult['facets'] {
    const facets: TaskSearchResult['facets'] = {
      status: {} as Record<TaskStatusEnum, number>,
      priority: {} as Record<PriorityEnum, number>,
      assignees: {},
      tags: {},
      labels: {},
      projects: {},
    };

    // Initialize counters
    Object.values(TaskStatusEnum).forEach(status => {
      facets.status[status] = 0;
    });

    Object.values(PriorityEnum).forEach(priority => {
      facets.priority[priority] = 0;
    });

    // Count occurrences
    for (const task of tasks) {
      // Status facet
      facets.status[task.status.value]++;

      // Priority facet
      facets.priority[task.priority.value]++;

      // Assignee facet
      if (task.assigneeId) {
        const assigneeId = task.assigneeId.value;
        facets.assignees[assigneeId] = (facets.assignees[assigneeId] || 0) + 1;
      }

      // Tags facet
      for (const tag of task.tags) {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      }

      // Labels facet
      for (const label of task.labels) {
        facets.labels[label] = (facets.labels[label] || 0) + 1;
      }

      // Project facet
      if (task.projectId) {
        const projectId = task.projectId.value;
        facets.projects[projectId] = (facets.projects[projectId] || 0) + 1;
      }
    }

    return facets;
  }

  /**
   * Initialize default filters
   */
  private initializeDefaultFilters(): void {
    const defaultFilters: Omit<
      SavedFilter,
      'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'usageCount'
    >[] = [
      {
        name: 'All Open Tasks',
        description: 'All tasks that are not completed or cancelled',
        filters: {
          status: [
            TaskStatus.todo(),
            TaskStatus.inProgress(),
            TaskStatus.inReview(),
          ],
        },
        sortOptions: { field: 'priority', direction: 'desc' },
        isPublic: true,
      },
      {
        name: 'Completed Tasks',
        description: 'All completed tasks',
        filters: {
          status: [TaskStatus.done()],
        },
        sortOptions: { field: 'updatedAt', direction: 'desc' },
        isPublic: true,
      },
      {
        name: 'High Priority',
        description: 'High and urgent priority tasks',
        filters: {
          priority: [Priority.high(), Priority.urgent()],
        },
        sortOptions: { field: 'dueDate', direction: 'asc' },
        isPublic: true,
      },
    ];

    for (const filterData of defaultFilters) {
      const savedFilter: SavedFilter = {
        ...filterData,
        id: this.generateId(),
        createdBy: UserId.generate(), // System user
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      this.savedFilters.set(savedFilter.id, savedFilter);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
