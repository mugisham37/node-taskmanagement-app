/**
 * Project Query Handlers
 *
 * Handles queries for projects and project member management
 */

import { BaseHandler, IQueryHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { PaginatedResult, PaginationOptions } from '../queries/base-query';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

// Query interfaces
export interface GetProjectByIdQuery {
  projectId: ProjectId;
  userId: UserId;
}

export interface GetProjectsByWorkspaceQuery {
  workspaceId: WorkspaceId;
  userId: UserId;
  filters?: ProjectFilters;
  pagination?: PaginationOptions;
}

export interface GetProjectsByUserQuery {
  userId: UserId;
  filters?: ProjectFilters;
  pagination?: PaginationOptions;
}

export interface GetProjectMembersQuery {
  projectId: ProjectId;
  userId: UserId;
  pagination?: PaginationOptions;
}

export interface GetProjectStatisticsQuery {
  projectId?: ProjectId;
  workspaceId?: WorkspaceId;
  userId: UserId;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SearchProjectsQuery {
  searchTerm: string;
  userId: UserId;
  workspaceId?: WorkspaceId;
  filters?: ProjectFilters;
  pagination?: PaginationOptions;
}

// Filter interfaces
export interface ProjectFilters {
  status?: string[];
  ownerId?: string;
  tags?: string[];
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
}

// DTO interfaces
export interface ProjectDto {
  id: string;
  name: string;
  description?: string;
  status: string;
  workspaceId: string;
  ownerId: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tags: string[];
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  permissions: string[];
  joinedAt: Date;
  lastActiveAt?: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

export interface ProjectStatisticsDto {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  cancelledProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMembers: number;
  averageProjectDuration: number;
  projectCompletionRate: number;
  taskCompletionRate: number;
  projectsByStatus: Record<string, number>;
  projectsByMonth: { month: string; count: number }[];
}

/**
 * Get project by ID
 */
export class GetProjectByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetProjectByIdQuery, ProjectDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetProjectByIdQuery): Promise<ProjectDto> {
    this.logInfo('Getting project by ID', {
      projectId: query.projectId.value,
      userId: query.userId.value,
    });

    try {
      // Try cache first
      const cacheKey = `project:${query.projectId.value}`;
      const cachedProject = await this.cacheService.get<ProjectDto>(cacheKey);
      if (cachedProject) {
        // Verify user still has access
        const hasAccess = await this.canUserViewProject(
          query.userId,
          query.projectId
        );
        if (hasAccess) {
          this.logInfo('Project found in cache', {
            projectId: query.projectId.value,
          });
          return cachedProject;
        }
      }

      const project = await this.projectRepository.findById(query.projectId);
      if (!project) {
        throw new NotFoundError(
          `Project with ID ${query.projectId.value} not found`
        );
      }

      // Check if user has permission to view this project
      if (!(await this.canUserViewProject(query.userId, query.projectId))) {
        throw new AuthorizationError(
          'User does not have permission to view this project'
        );
      }

      const projectDto = await this.mapProjectToDto(project);

      // Cache the result
      await this.cacheService.set(cacheKey, projectDto, 600); // 10 minutes

      this.logInfo('Project retrieved successfully', {
        projectId: query.projectId.value,
      });

      return projectDto;
    } catch (error) {
      this.logError('Failed to get project by ID', error as Error, {
        projectId: query.projectId.value,
      });
      throw error;
    }
  }

  private async canUserViewProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
  }

  private async mapProjectToDto(project: any): Promise<ProjectDto> {
    const owner = await this.userRepository.findById(project.ownerId);
    const memberCount = await this.projectRepository.getMemberCount(project.id);
    const taskStats = await this.projectRepository.getTaskStatistics(
      project.id
    );

    return {
      id: project.id.value,
      name: project.name,
      description: project.description,
      status: project.status.value,
      workspaceId: project.workspaceId.value,
      ownerId: project.ownerId.value,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      tags: project.tags,
      memberCount,
      taskCount: taskStats.totalTasks,
      completedTaskCount: taskStats.completedTasks,
      progress:
        taskStats.totalTasks > 0
          ? (taskStats.completedTasks / taskStats.totalTasks) * 100
          : 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
      workspace: {
        id: project.workspaceId.value,
        name: 'Workspace', // Would be fetched from workspace repository
        slug: 'workspace',
      },
    };
  }
}

/**
 * Get projects by workspace
 */
export class GetProjectsByWorkspaceQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetProjectsByWorkspaceQuery, PaginatedResult<ProjectDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetProjectsByWorkspaceQuery
  ): Promise<PaginatedResult<ProjectDto>> {
    this.logInfo('Getting projects by workspace', {
      workspaceId: query.workspaceId.value,
      userId: query.userId.value,
    });

    try {
      // Generate cache key
      const cacheKey = `projects:workspace:${query.workspaceId.value}:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<ProjectDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Check if user has access to workspace
      const hasWorkspaceAccess = await this.canUserAccessWorkspace(
        query.userId,
        query.workspaceId
      );
      if (!hasWorkspaceAccess) {
        throw new AuthorizationError(
          'User does not have permission to access this workspace'
        );
      }

      const projects = await this.projectRepository.findByWorkspaceId(
        query.workspaceId,
        query.filters
      );

      // Filter projects user can view and map to DTOs
      const projectDtos: ProjectDto[] = [];
      for (const project of projects) {
        const canView = await this.canUserViewProject(query.userId, project.id);
        if (canView) {
          const dto = await this.mapProjectToDto(project);
          projectDtos.push(dto);
        }
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(
        projectDtos,
        query.pagination
      );

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, 300); // 5 minutes

      this.logInfo('Projects by workspace retrieved successfully', {
        workspaceId: query.workspaceId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get projects by workspace', error as Error, {
        workspaceId: query.workspaceId.value,
      });
      throw error;
    }
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    // This would check workspace membership
    return true; // Simplified for now
  }

  private async canUserViewProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
  }

  private async mapProjectToDto(project: any): Promise<ProjectDto> {
    const owner = await this.userRepository.findById(project.ownerId);
    const memberCount = await this.projectRepository.getMemberCount(project.id);
    const taskStats = await this.projectRepository.getTaskStatistics(
      project.id
    );

    return {
      id: project.id.value,
      name: project.name,
      description: project.description,
      status: project.status.value,
      workspaceId: project.workspaceId.value,
      ownerId: project.ownerId.value,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      tags: project.tags,
      memberCount,
      taskCount: taskStats.totalTasks,
      completedTaskCount: taskStats.completedTasks,
      progress:
        taskStats.totalTasks > 0
          ? (taskStats.completedTasks / taskStats.totalTasks) * 100
          : 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
      workspace: {
        id: project.workspaceId.value,
        name: 'Workspace',
        slug: 'workspace',
      },
    };
  }

  private applyPagination<T>(
    data: T[],
    pagination?: PaginationOptions
  ): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 10 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

/**
 * Get projects by user
 */
export class GetProjectsByUserQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetProjectsByUserQuery, PaginatedResult<ProjectDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetProjectsByUserQuery
  ): Promise<PaginatedResult<ProjectDto>> {
    this.logInfo('Getting projects by user', {
      userId: query.userId.value,
    });

    try {
      // Generate cache key
      const cacheKey = `projects:user:${query.userId.value}:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<ProjectDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const projects = await this.projectRepository.findByUserId(
        query.userId,
        query.filters
      );
      const projectDtos: ProjectDto[] = [];

      for (const project of projects) {
        const dto = await this.mapProjectToDto(project);
        projectDtos.push(dto);
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(
        projectDtos,
        query.pagination
      );

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, 300); // 5 minutes

      this.logInfo('Projects by user retrieved successfully', {
        userId: query.userId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get projects by user', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }

  private async mapProjectToDto(project: any): Promise<ProjectDto> {
    const owner = await this.userRepository.findById(project.ownerId);
    const memberCount = await this.projectRepository.getMemberCount(project.id);
    const taskStats = await this.projectRepository.getTaskStatistics(
      project.id
    );

    return {
      id: project.id.value,
      name: project.name,
      description: project.description,
      status: project.status.value,
      workspaceId: project.workspaceId.value,
      ownerId: project.ownerId.value,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      tags: project.tags,
      memberCount,
      taskCount: taskStats.totalTasks,
      completedTaskCount: taskStats.completedTasks,
      progress:
        taskStats.totalTasks > 0
          ? (taskStats.completedTasks / taskStats.totalTasks) * 100
          : 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
      workspace: {
        id: project.workspaceId.value,
        name: 'Workspace',
        slug: 'workspace',
      },
    };
  }

  private applyPagination<T>(
    data: T[],
    pagination?: PaginationOptions
  ): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 10 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

/**
 * Get project members
 */
export class GetProjectMembersQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetProjectMembersQuery, PaginatedResult<ProjectMemberDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetProjectMembersQuery
  ): Promise<PaginatedResult<ProjectMemberDto>> {
    this.logInfo('Getting project members', {
      projectId: query.projectId.value,
      userId: query.userId.value,
    });

    try {
      // Check if user can view project members
      const canView = await this.canUserViewProject(
        query.userId,
        query.projectId
      );
      if (!canView) {
        throw new AuthorizationError(
          'User does not have permission to view project members'
        );
      }

      // Try cache first
      const cacheKey = `project-members:${query.projectId.value}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<ProjectMemberDto>>(
          cacheKey
        );
      if (cachedResult) {
        return cachedResult;
      }

      const members = await this.projectRepository.getProjectMembers(
        query.projectId
      );
      const memberDtos: ProjectMemberDto[] = [];

      for (const member of members) {
        const user = await this.userRepository.findById(member.userId);
        if (user) {
          memberDtos.push({
            id: member.id.value,
            projectId: member.projectId.value,
            userId: member.userId.value,
            role: member.role.value,
            permissions: member.getPermissions(),
            joinedAt: member.joinedAt,
            lastActiveAt: member.lastActiveAt,
            user: {
              id: user.id.value,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email.value,
              avatar: user.avatar,
            },
          });
        }
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(
        memberDtos,
        query.pagination
      );

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, 600); // 10 minutes

      this.logInfo('Project members retrieved successfully', {
        projectId: query.projectId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get project members', error as Error, {
        projectId: query.projectId.value,
      });
      throw error;
    }
  }

  private async canUserViewProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
  }

  private applyPagination<T>(
    data: T[],
    pagination?: PaginationOptions
  ): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 20 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

/**
 * Get project statistics
 */
export class GetProjectStatisticsQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetProjectStatisticsQuery, ProjectStatisticsDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetProjectStatisticsQuery
  ): Promise<ProjectStatisticsDto> {
    this.logInfo('Getting project statistics', {
      projectId: query.projectId?.value,
      workspaceId: query.workspaceId?.value,
      userId: query.userId.value,
    });

    try {
      // Generate cache key
      const cacheKey = `project-stats:${query.projectId?.value || 'all'}:${query.workspaceId?.value || 'all'}:${query.dateFrom?.toISOString() || 'all'}:${query.dateTo?.toISOString() || 'all'}`;
      const cachedStats =
        await this.cacheService.get<ProjectStatisticsDto>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }

      const statistics = await this.projectRepository.getProjectStatistics(
        query.projectId,
        query.workspaceId,
        query.dateFrom,
        query.dateTo
      );

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, statistics, 300);

      this.logInfo('Project statistics retrieved successfully');

      return statistics;
    } catch (error) {
      this.logError('Failed to get project statistics', error as Error);
      throw error;
    }
  }
}

// Export aliases for backward compatibility
export const GetProjectHandler = GetProjectByIdQueryHandler;
export const ListProjectsHandler = GetProjectsByWorkspaceQueryHandler;
export const GetProjectMembersHandler = GetProjectMembersQueryHandler;
